import { expect, test } from "vitest";
import { clientOf, Throttle } from "./throttle";

const limits = { client: { burst: 3, everyMs: 1000 }, all: { burst: 5, everyMs: 100 } };

test("a client is blocked after its burst of wrong codes and may try again as its bucket drains", () => {
  const t = new Throttle(limits);
  for (let i = 0; i < 3; i++) {
    expect(t.blocked("a", 0)).toBe(false);
    t.failed("a", 0);
  }
  expect(t.blocked("a", 0)).toBe(true);
  expect(t.blocked("b", 0)).toBe(false); // another client isn't
  expect(t.blocked("a", 999)).toBe(true);
  expect(t.blocked("a", 1000)).toBe(false); // one drained
});

test("many clients together are blocked by the shared bucket", () => {
  const t = new Throttle(limits);
  for (let i = 0; i < 5; i++) t.failed(`c${i}`, 0);
  expect(t.blocked("new", 0)).toBe(true);
  expect(t.blocked("new", 100)).toBe(false);
});

test("the client is the first forwarded address, else the real IP, else one shared name", () => {
  const req = (h: Record<string, string>) => new Request("https://gassi.example/api/auth/redeem", { headers: h });
  expect(clientOf(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  expect(clientOf(req({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
  expect(clientOf(req({}))).toBe("direct");
});
