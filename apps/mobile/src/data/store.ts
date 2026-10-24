// What the screens read and how their taps go out, for one signed-in device, without React (GassiProvider wraps it).
// The household (me, people, dogs, exercises, treat kinds) and the running walk and training come from the server;
// taps go through @gassi/domain's command queue (kept per person) and show at once through its projection, with or
// without reception. What the server showed last is kept (snapshot.ts), so a reopened app shows the household and a
// running walk at once, before or without an answer.
import { ApiError, type Client, type Output } from "@gassi/api-client";
import { type Command, createCommandQueue, type Person, project, RejectedCommands, type SessionsView } from "@gassi/domain";
import { apiFor, errorMessage, NO_ANSWER_STATUS, WRITE_TIMEOUT_MS } from "./api";
import { type Device, loadDevice } from "./device";
import { onReconnect } from "./network";
import { createErrorReports } from "./reports";
import { onStoredElsewhere, storage } from "./storage";
import { loadSnapshot, saveSnapshot } from "./snapshot";

export type Household = Output<"me">["household"];
export type Dog = Output<"dogs">["dogs"][number];
export type Exercise = Output<"exercises">["exercises"][number];
export type TreatKind = Output<"treatKinds">["treatKinds"][number];

export type GassiState = {
  /** who signed in (null only while signed out) */
  me: Person | null;
  /** this device as the server knows it (null until its first answer): the walk names it when it records the route */
  device: { id: number; name: string } | null;
  household: Household | null;
  people: Person[];
  dogs: Dog[];
  exercises: Exercise[];
  treatKinds: TreatKind[];
  /** the server's walk and training with the unsent taps laid over */
  view: SessionsView;
  /** taps not yet confirmed by the server, and how many */
  pending: readonly Command[];
  unsent: number;
  /** whether the last call reached the server */
  online: boolean;
  /** what went wrong with the server other than reception (an answer that doesn't fit, a server error), until that
   * part works again; the error banner shows it during development */
  syncError: string | null;
};

export type GassiStore = {
  api: Client;
  /** The same, for writes that need the server: gives up after WRITE_TIMEOUT_MS as unreachable. */
  writeApi: Client;
  get(): GassiState;
  subscribe(fn: () => void): () => void;
  send(cmd: Command): void;
  /** Reloads the household, and sends what is queued, then reloads the sessions. */
  refresh(): Promise<void>;
  /** Sends what went wrong outside the store (a crash) to the server's log, like the store's own sync errors. */
  reportError(part: string, message: string): void;
  /** Listens to other tabs' taps and to reception coming back; returns the stop. */
  start(): () => void;
};

type Known = Omit<GassiState, "view" | "pending" | "unsent" | "online" | "me" | "syncError"> & { me: Person };

/** The parts that talk to the server, as the error banner names them. */
const PARTS = { household: "Haushalt", commands: "Senden", sessions: "Runde und Training" } as const;
type Part = keyof typeof PARTS;
// no reception or no answer in time is what `online` shows; a 401 signs the device out
const quiet = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status === NO_ANSWER_STATUS || e.status === 401);

const NOTHING_RUNS: SessionsView = { walk: null, training: null };

/** `version`: the app's, sent with the error reports. */
export function createGassiStore(device: Device, { fetch: fetchFn, version = "?" }: { fetch?: typeof fetch; version?: string } = {}): GassiStore {
  let online = true;
  const onReached = (reached: boolean) => {
    if (reached !== online) {
      online = reached;
      update();
    }
  };
  const api = apiFor(device, { fetch: fetchFn, onReached });
  const writeApi = apiFor(device, { fetch: fetchFn, onReached, timeoutMs: WRITE_TIMEOUT_MS });

  // What the server showed last time (or only who signed in), until it answers now.
  const kept = loadSnapshot(device.person.id);
  let household: Known = kept
    ? { me: kept.me, device: kept.device ?? null, household: kept.household, people: kept.people, dogs: kept.dogs, exercises: kept.exercises, treatKinds: kept.treatKinds }
    : { me: device.person, device: null, household: null, people: [device.person], dogs: [], exercises: [], treatKinds: [] };
  let serverView = kept?.view ?? NOTHING_RUNS;
  // counts the queue's answers: a sessions answer asked for before one of them is older than it and is not shown
  let answers = 0;
  const errors: Record<Part, string | null> = { household: null, commands: null, sessions: null };
  // the same error goes to the server's log too (reports.ts), once a minute at most
  const reports = createErrorReports({ send: (errors) => api.reportErrors({ errors, version }) });
  const failed = (part: Part, e: unknown) => {
    if (quiet(e)) return;
    errors[part] = e instanceof ApiError ? e.message : errorMessage(e) + (e instanceof Error ? ` (${e.message})` : "");
    void reports.report(PARTS[part], errors[part]);
  };
  const syncError = () => {
    const part = (Object.keys(errors) as Part[]).find((p) => errors[p] !== null);
    return part ? `${PARTS[part]}: ${errors[part]}` : null;
  };
  let state: GassiState;
  const listeners = new Set<() => void>();

  function update() {
    const { me, people, dogs, device: here } = household;
    const pending = queue.pending();
    const activeDogs = dogs.filter((d) => !d.archived).map((d) => d.id);
    state = { ...household, me, view: project(serverView, pending, me, people, activeDogs, here), pending, unsent: pending.length, online, syncError: syncError() };
    listeners.forEach((fn) => fn());
  }
  // only while this device is the signed-in one: an answer that comes after a 401 (or Abmelden) keeps nothing
  const keep = () => {
    if (loadDevice()?.token === device.token) saveSnapshot({ ...household, view: serverView });
  };

  const sendCommands = async (commands: Command[]) => {
    try {
      const answer = await api.commands({ commands });
      errors.commands = null;
      return answer;
    } catch (e) {
      failed("commands", e);
      update(); // the queue keeps them without telling anyone
      // 400: the server (or the contract, before sending) refuses them for good
      if (e instanceof ApiError && e.status === 400) throw new RejectedCommands();
      throw e;
    }
  };

  // the queue of the person signed in, there from the start: taps without reception are kept from the first one
  const queueKey = `gassi.commands.${device.person.id}`;
  const queue = createCommandQueue({ storage, send: sendCommands, key: queueKey });
  queue.subscribe((_, view) => {
    if (view) {
      answers++;
      serverView = view;
      keep();
    }
    update();
  });
  update();

  // The household's five calls and the queue go out side by side, each on its own: one call that fails holds up
  // neither the taps nor what came. The sessions are asked for after the queue, so they show its taps.
  async function loadHousehold() {
    try {
      const [me, people, dogs, exercises, treatKinds] = await Promise.all([api.me(), api.people(), api.dogs(), api.exercises(), api.treatKinds()]);
      errors.household = null;
      household = { me: me.person, device: { id: me.device.id, name: me.device.name }, household: me.household, people: people.people, dogs: dogs.dogs, exercises: exercises.exercises, treatKinds: treatKinds.treatKinds };
      keep();
    } catch (e) {
      failed("household", e);
      // no reception, signed out (the 401 already cleared the device), or an answer that didn't fit: keep showing
      // what we have; the next refresh tries again
    }
  }
  async function loadSessions() {
    await queue.flush(); // never throws: what doesn't go out stays queued
    try {
      const asked = answers;
      const sessions = await api.sessions();
      errors.sessions = null;
      if (asked === answers) {
        serverView = sessions;
        keep();
      }
    } catch (e) {
      failed("sessions", e);
      // as above
    }
  }
  async function refresh() {
    await Promise.all([loadHousehold(), loadSessions()]);
    update();
    void reports.flush(); // what waited without reception
  }

  return {
    api,
    writeApi,
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    send(cmd) {
      void queue.push(cmd);
    },
    refresh,
    reportError(part, message) {
      void reports.report(part, message);
    },
    start() {
      // another tab's taps (the queue re-reads storage) show here too; reception back sends the queued ones at once
      const stopWatching = onStoredElsewhere(queueKey, () => queue.refresh());
      const stopReconnect = onReconnect(() => void refresh());
      return () => {
        stopWatching();
        stopReconnect();
      };
    },
  };
}
