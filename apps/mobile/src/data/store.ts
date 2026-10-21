// What the screens read and how their taps go out, for one signed-in device, without React (GassiProvider wraps it).
// The household (me, people, dogs, exercises, treat kinds) and the running walk and training come from the server;
// taps go through @gassi/domain's command queue (kept per person) and show at once through its projection, with or
// without reception. What the server showed last is kept (snapshot.ts), so a reopened app shows the household and a
// running walk at once, before or without an answer.
import { ApiError, type Client, type Output } from "@gassi/api-client";
import { type Command, createCommandQueue, type Person, project, RejectedCommands, type SessionsView } from "@gassi/domain";
import { apiFor } from "./api";
import type { Device } from "./device";
import { onReconnect } from "./network";
import { onQueueChanged, queueStorage } from "./queue";
import { loadSnapshot, saveSnapshot } from "./snapshot";

export type Household = Output<"me">["household"];
export type Dog = Output<"dogs">["dogs"][number];
export type Exercise = Output<"exercises">["exercises"][number];
export type TreatKind = Output<"treatKinds">["treatKinds"][number];

export type GassiState = {
  /** who signed in (null only while signed out) */
  me: Person | null;
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
};

export type GassiStore = {
  api: Client;
  get(): GassiState;
  subscribe(fn: () => void): () => void;
  send(cmd: Command): void;
  /** Sends what is queued, then reloads the household and the sessions. */
  refresh(): Promise<void>;
  /** Listens to other tabs' taps and to reception coming back; returns the stop. */
  start(): () => void;
};

type Known = Omit<GassiState, "view" | "pending" | "unsent" | "online" | "me"> & { me: Person };

const NOTHING_RUNS: SessionsView = { walk: null, training: null };

export function createGassiStore(device: Device, { fetch: fetchFn }: { fetch?: typeof fetch } = {}): GassiStore {
  let online = true;
  const api = apiFor(device, {
    fetch: fetchFn,
    onReached: (reached) => {
      if (reached !== online) {
        online = reached;
        update();
      }
    },
  });

  // What the server showed last time (or only who signed in), until it answers now.
  const kept = loadSnapshot(device.person.id);
  let household: Known = kept
    ? { me: kept.me, household: kept.household, people: kept.people, dogs: kept.dogs, exercises: kept.exercises, treatKinds: kept.treatKinds }
    : { me: device.person, household: null, people: [device.person], dogs: [], exercises: [], treatKinds: [] };
  let serverView = kept?.view ?? NOTHING_RUNS;
  // counts the queue's answers: a sessions answer asked for before one of them is older than it and is not shown
  let answers = 0;
  let state: GassiState;
  const listeners = new Set<() => void>();

  function update() {
    const { me, people, dogs } = household;
    const pending = queue.pending();
    const activeDogs = dogs.filter((d) => !d.archived).map((d) => d.id);
    state = { ...household, me, view: project(serverView, pending, me, people, activeDogs), pending, unsent: pending.length, online };
    listeners.forEach((fn) => fn());
  }
  const keep = () => saveSnapshot({ ...household, view: serverView });

  const sendCommands = async (commands: Command[]) => {
    try {
      return await api.commands({ commands });
    } catch (e) {
      // 400: the server (or the contract, before sending) refuses them for good
      if (e instanceof ApiError && e.status === 400) throw new RejectedCommands();
      throw e;
    }
  };

  // the queue of the person signed in, there from the start: taps without reception are kept from the first one
  const queueKey = `gassi.commands.${device.person.id}`;
  const queue = createCommandQueue({ storage: queueStorage(), send: sendCommands, key: queueKey });
  queue.subscribe((_, view) => {
    if (view) {
      answers++;
      serverView = view;
      keep();
    }
    update();
  });
  update();

  async function refresh() {
    try {
      const [me, people, dogs, exercises, treatKinds] = await Promise.all([api.me(), api.people(), api.dogs(), api.exercises(), api.treatKinds()]);
      household = { me: me.person, household: me.household, people: people.people, dogs: dogs.dogs, exercises: exercises.exercises, treatKinds: treatKinds.treatKinds };
      await queue.flush();
      const asked = answers;
      const sessions = await api.sessions();
      if (asked === answers) {
        serverView = sessions;
        keep();
      }
    } catch {
      // no reception, signed out (the 401 already cleared the device), or an answer that didn't fit: keep showing
      // what we have; the next refresh tries again
    }
    update();
  }

  return {
    api,
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    send(cmd) {
      void queue.push(cmd);
    },
    refresh,
    start() {
      // another tab's taps (the queue re-reads storage) show here too; reception back sends the queued ones at once
      const stopWatching = onQueueChanged(queueKey, () => queue.refresh());
      const stopReconnect = onReconnect(() => void refresh());
      return () => {
        stopWatching();
        stopReconnect();
      };
    },
  };
}
