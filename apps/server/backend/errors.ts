// A problem with what someone entered, with a German message the screen can show as it is.
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}
