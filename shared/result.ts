// What a server action answers: the value, or a German message to show.
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
