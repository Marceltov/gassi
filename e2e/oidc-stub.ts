// A minimal OIDC issuer for the e2e tests, on 127.0.0.1:3199 (plain http is allowed on loopback). /authorize signs in
// whoever the `stub_user` cookie (or `?user=`) names, without asking, and redirects straight back with a code; /token
// answers that code with an unsigned id_token. Stateless: the code carries the user and the nonce. For trying the app
// by hand (`npm run oidc-stub`), /as?user=bille sets that cookie, so the next sign-in is bille.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export const STUB_PORT = 3199;
export const STUB_ISSUER = `http://127.0.0.1:${STUB_PORT}`;
export const STUB_CLIENT_ID = "gassi";

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");

function cookie(req: IncomingMessage, name: string): string | undefined {
  return req.headers.cookie?.split(";").map((c) => c.trim().split("=")).find(([k]) => k === name)?.[1];
}

async function body(req: IncomingMessage): Promise<URLSearchParams> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return new URLSearchParams(raw);
}

function discovery(res: ServerResponse) {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ issuer: STUB_ISSUER, authorization_endpoint: `${STUB_ISSUER}/authorize`, token_endpoint: `${STUB_ISSUER}/token` }));
}

function authorize(req: IncomingMessage, res: ServerResponse, url: URL) {
  const q = url.searchParams;
  const user = q.get("user") ?? cookie(req, "stub_user") ?? "marcel";
  const back = new URL(q.get("redirect_uri")!);
  back.searchParams.set("code", b64({ user, nonce: q.get("nonce") }));
  back.searchParams.set("state", q.get("state") ?? "");
  res.writeHead(302, { location: back.href }).end();
}

async function token(req: IncomingMessage, res: ServerResponse) {
  const { user, nonce } = JSON.parse(Buffer.from((await body(req)).get("code") ?? "", "base64url").toString() || "{}");
  const claims = { iss: STUB_ISSUER, aud: STUB_CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 300, nonce, preferred_username: user };
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ access_token: "stub", token_type: "Bearer", id_token: `${b64({ alg: "none" })}.${b64(claims)}.` }));
}

function signInAs(res: ServerResponse, url: URL) {
  const user = url.searchParams.get("user") ?? "marcel";
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "set-cookie": `stub_user=${encodeURIComponent(user)}; Path=/` });
  res.end(`The next sign-in is ${user}.`);
}

export function startOidcStub(): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", STUB_ISSUER);
    if (url.pathname === "/.well-known/openid-configuration") return discovery(res);
    if (url.pathname === "/authorize") return authorize(req, res, url);
    if (url.pathname === "/token" && req.method === "POST") return void token(req, res);
    if (url.pathname === "/as") return signInAs(res, url);
    res.writeHead(404).end();
  });
  return new Promise((resolve) => server.listen(STUB_PORT, "127.0.0.1", () => resolve(server)));
}
