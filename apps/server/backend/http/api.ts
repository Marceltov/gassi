// The implementations of the API contract, each a thin call into a use case.
import { Devices } from "../auth/devices";
import type { DB } from "../db/open";
import { type Implementations, NotFound, router } from "./router";

export type ApiDeps = { db: DB; now: () => Date; publicUrl: string; oidc: boolean; mail: boolean };

const implementations: Implementations<ApiDeps> = {
  me: async ({ auth, deps }) => ({ person: auth.person, device: auth.device, household: { oidc: deps.oidc, mail: deps.mail } }),
  devices: async ({ auth, deps }) => ({
    devices: (await new Devices(deps.db, deps.now).list(auth.person.id)).map((d) => ({ ...d, current: d.id === auth.device.id })),
  }),
  removeDevice: async ({ input, auth, deps }) => {
    if (!(await new Devices(deps.db, deps.now).remove(auth.person.id, input.id))) throw new NotFound("Dieses Gerät gibt es nicht.");
    return { removed: true as const };
  },
};

export function apiRouter(deps: ApiDeps) {
  return router(implementations, deps, (authorization) => new Devices(deps.db, deps.now).authenticate(authorization));
}
