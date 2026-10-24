import { expect, test } from "vitest";
import { createErrorReports, type ErrorReport, errorText } from "./reports";

function setup() {
  let time = Date.parse("2026-10-24T21:00:00Z");
  const sent: ErrorReport[][] = [];
  const server = { reachable: true };
  const reports = createErrorReports({
    send: async (errors) => {
      if (!server.reachable) throw new Error("no reception");
      sent.push(errors);
    },
    now: () => new Date(time),
  });
  return { reports, sent, server, later: (ms: number) => void (time += ms) };
}

test("an error goes out at once, the same one again only after a minute", async () => {
  const { reports, sent, later } = setup();
  await reports.report("Senden", "kaputt");
  await reports.report("Senden", "kaputt");
  later(59_000);
  await reports.report("Senden", "kaputt");
  await reports.report("Runde und Training", "kaputt");
  later(2_000);
  await reports.report("Senden", "kaputt");
  expect(sent).toEqual([
    [{ at: "2026-10-24T21:00:00.000Z", part: "Senden", message: "kaputt" }],
    [{ at: "2026-10-24T21:00:59.000Z", part: "Runde und Training", message: "kaputt" }],
    [{ at: "2026-10-24T21:01:01.000Z", part: "Senden", message: "kaputt" }],
  ]);
});

test("without reception the errors wait and go out together with the next", async () => {
  const { reports, sent, server } = setup();
  server.reachable = false;
  await reports.report("Senden", "a");
  await reports.report("Absturz", "b");
  server.reachable = true;
  await reports.flush();
  expect(sent).toEqual([[expect.objectContaining({ message: "a" }), expect.objectContaining({ message: "b" })]]);
  await reports.flush();
  expect(sent).toHaveLength(1);
});

test("at most 20 wait, the newest, and a long message is cut", async () => {
  const { reports, sent, server } = setup();
  server.reachable = false;
  for (let i = 0; i < 25; i++) await reports.report("Senden", `e${i}`);
  await reports.report("Absturz", "x".repeat(3000));
  server.reachable = true;
  await reports.flush();
  expect(sent[0]).toHaveLength(20);
  expect(sent[0]![0]!.message).toBe("e6");
  expect(sent[0]![19]!.message).toHaveLength(2000);
});

test("a crash is described by its name, message and the top of its stack", () => {
  const e = new TypeError("x is undefined");
  e.stack = "TypeError: x is undefined\n    at a (app.js:1:2)\n    at b (app.js:3:4)\n    at c\n    at d\n    at e\n    at f";
  expect(errorText(e)).toBe("TypeError: x is undefined\n    at a (app.js:1:2)\n    at b (app.js:3:4)\n    at c\n    at d\n    at e");
  expect(errorText("kaputt")).toBe("kaputt");
});
