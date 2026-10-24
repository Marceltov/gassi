// What went wrong in the app (a sync that failed, a crash), sent to the server's log for debugging (#106): at once,
// the same error again only after a minute (a refresh that fails every 30 seconds says so once a minute), and without
// reception kept here (the newest 20, for as long as the app runs) until the next goes out.
export type ErrorReport = { at: string; part: string; message: string };

const AGAIN_MS = 60_000;
const KEEP = 20;
const LONGEST = 2000;

type Options = { send: (errors: ErrorReport[]) => Promise<unknown>; now?: () => Date };

export function createErrorReports({ send, now = () => new Date() }: Options) {
  let waiting: ErrorReport[] = [];
  const last = new Map<string, number>(); // part and message → when last reported
  let sending: Promise<void> | null = null;

  function flush(): Promise<void> {
    if (sending || waiting.length === 0) return sending ?? Promise.resolve();
    const batch = waiting;
    sending = send(batch)
      .then(() => {
        waiting = waiting.filter((r) => !batch.includes(r));
      })
      .catch(() => {
        // no reception: they wait for the next
      })
      .finally(() => {
        sending = null;
      });
    return sending;
  }

  return {
    async report(part: string, message: string): Promise<void> {
      const at = now();
      const key = `${part}\n${message}`;
      const before = last.get(key);
      if (before !== undefined && at.getTime() - before < AGAIN_MS) return;
      last.set(key, at.getTime());
      waiting = [...waiting, { at: at.toISOString(), part, message: message.slice(0, LONGEST) }].slice(-KEEP);
      await sending;
      return flush();
    },
    flush,
  };
}

/** A crash as one report's message: its stack's first lines (they start with name and message), else what it says. */
export function errorText(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  return e.stack?.split("\n").slice(0, 6).join("\n") ?? `${e.name}: ${e.message}`;
}
