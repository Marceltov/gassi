// A problem with what someone entered, with a German message the screen can show as it is.
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

/** Something the server depends on (GitHub) didn't answer or refused: a 502 with a German message. */
export class Unavailable extends Error {}
