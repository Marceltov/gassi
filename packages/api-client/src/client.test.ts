import { describe, expect, test } from "vitest";
import { ApiError, createClient } from "./client";
import { fillPath, matchPath } from "./contract";

type Call = { url: string; method: string; headers: Record<string, string>; body: string | undefined };

function recorder(answer: { status?: number; body: unknown }) {
  const calls: Call[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", headers: Object.fromEntries(new Headers(init?.headers).entries()), body: init?.body as string | undefined });
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200, headers: { "content-type": "application/json" } });
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

const ME = { person: { id: "marcel", name: "Hirsch" }, device: { id: 3, kind: "phone", name: "iPhone" }, household: { oidc: false, mail: false } };

describe("createClient", () => {
  test("calls method and path with the token, and returns the checked answer", async () => {
    const r = recorder({ body: ME });
    const api = createClient({ baseUrl: "https://gassi.example/", token: "t0k", fetch: r.fetch });
    expect(await api.me()).toEqual(ME);
    expect(r.calls).toEqual([{ url: "https://gassi.example/api/me", method: "GET", headers: { authorization: "Bearer t0k", accept: "application/json" }, body: undefined }]);
  });

  test("path params are filled from the input, the rest goes as JSON", async () => {
    const r = recorder({ body: { removed: true } });
    await createClient({ baseUrl: "https://gassi.example", token: "t", fetch: r.fetch }).removeDevice({ id: 7 });
    expect(r.calls[0]).toMatchObject({ url: "https://gassi.example/api/devices/7", method: "DELETE", body: undefined });
  });

  test("an error answer becomes an ApiError with the server's message", async () => {
    const r = recorder({ status: 401, body: { error: "Bitte anmelden." } });
    await expect(createClient({ baseUrl: "https://gassi.example", fetch: r.fetch }).me()).rejects.toEqual(new ApiError(401, "Bitte anmelden."));
  });

  test("an answer that doesn't fit the contract is an error, not data", async () => {
    const r = recorder({ body: { person: "nobody" } });
    await expect(createClient({ baseUrl: "https://gassi.example", token: "t", fetch: r.fetch }).me()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("paths", () => {
  test("fill and match are each other's inverse", () => {
    expect(fillPath("/api/devices/:id", { id: 7, x: 1 })).toEqual({ path: "/api/devices/7", rest: { x: 1 } });
    expect(matchPath("/api/devices/:id", "/api/devices/7")).toEqual({ id: "7" });
    expect(matchPath("/api/devices/:id", "/api/devices")).toBeNull();
    expect(matchPath("/api/me", "/api/me")).toEqual({});
  });
});
