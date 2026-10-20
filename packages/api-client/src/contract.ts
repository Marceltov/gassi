// The API as one table: every endpoint with its method, path, whether it needs a device token, and the zod schemas
// of what goes in and what comes back. The client is built from it and the server's router validates against it, so
// the two can't drift apart. Path params (":id") are filled from the input; the rest of a GET or DELETE input goes
// into the query string, of a POST or PATCH into the JSON body.
import { z } from "zod";

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

export type Endpoint<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType, A extends boolean = boolean> = {
  method: Method;
  path: string;
  auth: A;
  input: I;
  output: O;
};

export function endpoint<I extends z.ZodType, O extends z.ZodType, A extends boolean = true>(e: { method: Method; path: string; auth?: A; input: I; output: O }): Endpoint<I, O, A> {
  return { ...e, auth: (e.auth ?? true) as A };
}

const none = z.object({});
const id = z.coerce.number().int().positive();

export const personSchema = z.object({ id: z.string(), name: z.string() });
export const deviceKinds = ["phone", "watch", "web", "script"] as const;
export const deviceSchema = z.object({ id: z.number(), kind: z.enum(deviceKinds), name: z.string() });

export const linkKinds = ["setup", "person", "device", "watch", "magic"] as const;
const openLink = z.object({ id: z.number(), kind: z.enum(linkKinds), createdAt: z.string(), expiresAt: z.string() });

export const contract = {
  redeem: endpoint({
    method: "POST",
    path: "/api/auth/redeem",
    auth: false,
    input: z.object({
      token: z.string().min(1).max(100),
      deviceKind: z.enum(deviceKinds),
      deviceName: z.string().trim().min(1).max(60),
      personName: z.string().optional(),
      dogName: z.string().optional(),
    }),
    output: z.object({ deviceToken: z.string(), person: personSchema, device: deviceSchema }),
  }),
  createInvite: endpoint({
    method: "POST",
    path: "/api/invites",
    input: z.object({ kind: z.enum(["person", "device", "watch"]) }),
    output: z.object({ id: z.number(), url: z.string(), appLink: z.string(), expiresAt: z.string() }),
  }),
  invites: endpoint({ method: "GET", path: "/api/invites", input: none, output: z.object({ invites: z.array(openLink) }) }),
  revokeInvite: endpoint({ method: "DELETE", path: "/api/invites/:id", input: z.object({ id }), output: z.object({ revoked: z.literal(true) }) }),
  updateMe: endpoint({
    method: "PATCH",
    path: "/api/me",
    input: z.object({ name: z.string().trim().min(1).max(40).optional(), email: z.email().nullable().optional() }),
    output: z.object({ person: personSchema.extend({ email: z.string().nullable() }) }),
  }),
  me: endpoint({
    method: "GET",
    path: "/api/me",
    input: none,
    output: z.object({ person: personSchema, device: deviceSchema, household: z.object({ oidc: z.boolean(), mail: z.boolean() }) }),
  }),
  devices: endpoint({
    method: "GET",
    path: "/api/devices",
    input: none,
    output: z.object({ devices: z.array(deviceSchema.extend({ createdAt: z.string(), lastSeenAt: z.string().nullable(), current: z.boolean() })) }),
  }),
  removeDevice: endpoint({ method: "DELETE", path: "/api/devices/:id", input: z.object({ id }), output: z.object({ removed: z.literal(true) }) }),
};

export type Contract = typeof contract;
export type EndpointName = keyof Contract;
/** What a caller passes (before parsing) and what the server's handler gets (after parsing). */
export type Input<K extends EndpointName> = z.input<Contract[K]["input"]>;
export type ParsedInput<K extends EndpointName> = z.output<Contract[K]["input"]>;
export type Output<K extends EndpointName> = z.output<Contract[K]["output"]>;

/** "/api/devices/:id" with { id: 7, x: 1 } → "/api/devices/7" and the rest { x: 1 }. */
export function fillPath(pattern: string, input: Record<string, unknown>): { path: string; rest: Record<string, unknown> } {
  const rest = { ...input };
  const path = pattern.replace(/:(\w+)/g, (_, name: string) => {
    const value = rest[name];
    delete rest[name];
    return encodeURIComponent(String(value));
  });
  return { path, rest };
}

/** The path params when `pathname` fits `pattern`, else null. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const names: string[] = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, name: string) => (names.push(name), "([^/]+)"))}$`);
  const m = re.exec(pathname);
  return m ? Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) : null;
}

export const sendsBody = (method: Method) => method === "POST" || method === "PATCH";
