import { describe, expect, test } from "vitest";
import { cors } from "./cors";

const ORIGIN = "http://localhost:8081";
const handler = async (req: Request) => Response.json({ path: new URL(req.url).pathname }, { status: 401 });
const request = (method: string) => new Request("http://localhost:3000/api/me", { method, headers: { origin: ORIGIN } });

describe("cors", () => {
  test("with an origin, a preflight is answered for it and every answer allows it", async () => {
    const preflight = await cors(ORIGIN, handler)(request("OPTIONS"));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(preflight.headers.get("access-control-allow-methods")).toBe("GET, POST, PATCH, DELETE");
    expect(preflight.headers.get("access-control-allow-headers")).toBe("authorization, content-type");

    const res = await cors(ORIGIN, handler)(request("GET"));
    expect(res.status).toBe(401);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("vary")).toBe("Origin");
    expect(await res.json()).toEqual({ path: "/api/me" });
  });

  test("without one (production: the web app is same-origin), nothing is allowed", async () => {
    const preflight = await cors(null, handler)(request("OPTIONS"));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
    const res = await cors(null, handler)(request("GET"));
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
