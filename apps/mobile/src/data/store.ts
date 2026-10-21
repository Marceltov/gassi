// What the screens read and how their taps go out, for one signed-in device, without React (GassiProvider wraps it).
// The household (me, people, dogs, exercises, treat kinds) and the running walk and training come from the server;
// taps go through @gassi/domain's command queue (kept per person) and show at once through its projection, with or
// without reception.
import { ApiError, type Client, type Output } from "@gassi/api-client";
import { type Command, type CommandQueue, createCommandQueue, type Person, project, RejectedCommands, type SessionsView } from "@gassi/domain";
import { apiFor } from "./api";
import type { Device } from "./device";
import { onQueueChanged, queueStorage } from "./queue";

export type Household = Output<"me">["household"];
export type Dog = Output<"dogs">["dogs"][number];
export type Exercise = Output<"exercises">["exercises"][number];
export type TreatKind = Output<"treatKinds">["treatKinds"][number];

export type GassiState = {
  /** null until the first answer from the server */
  me: Person | null;
  household: Household | null;
  people: Person[];
  dogs: Dog[];
  exercises: Exercise[];
  treatKinds: TreatKind[];
  /** the server's walk and training with the unsent taps laid over */
  view: SessionsView;
  /** taps not yet confirmed by the server */
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
  /** Listens to other tabs' taps while started; returns the stop. */
  start(): () => void;
};

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

  let household: Omit<GassiState, "view" | "unsent" | "online"> = { me: null, household: null, people: [], dogs: [], exercises: [], treatKinds: [] };
  let serverView = NOTHING_RUNS;
  let queue: CommandQueue | null = null;
  let early: Command[] = []; // taps before the first answer said who this is (the queue is per person)
  let started = false;
  let stopWatching = () => {};
  let state: GassiState;
  const listeners = new Set<() => void>();

  function update() {
    const { me, people, dogs } = household;
    const pending = queue?.pending() ?? [];
    const activeDogs = dogs.filter((d) => !d.archived).map((d) => d.id);
    state = { ...household, view: me ? project(serverView, pending, me, people, activeDogs) : serverView, unsent: pending.length + early.length, online };
    listeners.forEach((fn) => fn());
  }
  update();

  const sendCommands = async (commands: Command[]) => {
    try {
      return await api.commands({ commands });
    } catch (e) {
      // 400: the server (or the contract, before sending) refuses them for good
      if (e instanceof ApiError && e.status === 400) throw new RejectedCommands();
      throw e;
    }
  };

  const queueKey = (personId: string) => `gassi.commands.${personId}`;
  // another tab's taps (the queue re-reads storage) show here too
  function watch() {
    const personId = household.me?.id;
    if (started && queue && personId) stopWatching = onQueueChanged(queueKey(personId), () => queue?.refresh());
  }

  function queueFor(personId: string): CommandQueue {
    if (queue) return queue;
    queue = createCommandQueue({ storage: queueStorage(), send: sendCommands, key: queueKey(personId) });
    queue.subscribe((_, view) => {
      if (view) serverView = view;
      update();
    });
    watch();
    for (const cmd of early) void queue.push(cmd);
    early = [];
    return queue;
  }

  return {
    api,
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    send(cmd) {
      if (queue) void queue.push(cmd);
      else {
        early.push(cmd);
        update();
      }
    },
    async refresh() {
      try {
        const [me, people, dogs, exercises, treatKinds] = await Promise.all([api.me(), api.people(), api.dogs(), api.exercises(), api.treatKinds()]);
        household = { me: me.person, household: me.household, people: people.people, dogs: dogs.dogs, exercises: exercises.exercises, treatKinds: treatKinds.treatKinds };
        await queueFor(me.person.id).flush();
        serverView = await api.sessions();
      } catch (e) {
        // no reception, or signed out (the 401 already cleared the device): keep showing what we have
        if (!(e instanceof ApiError)) throw e;
      }
      update();
    },
    start() {
      started = true;
      watch();
      return () => {
        started = false;
        stopWatching();
        stopWatching = () => {};
      };
    },
  };
}
