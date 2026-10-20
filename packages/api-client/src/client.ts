// A typed client for the whole API, built from the contract: one method per endpoint, input and answer checked by the
// same schemas the server uses. `fetch` is injected (tests, React Native, the watch bridge).
import { contract, type Contract, type EndpointName, fillPath, type Input, type Output, sendsBody } from "./contract";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Endpoints whose input may be empty can be called without an argument.
type Call<K extends EndpointName> = Record<never, never> extends Input<K> ? (input?: Input<K>) => Promise<Output<K>> : (input: Input<K>) => Promise<Output<K>>;
export type Client = { [K in EndpointName]: Call<K> };

export type ClientOptions = { baseUrl: string; token?: string | null; fetch?: typeof fetch };

export function createClient({ baseUrl, token, fetch: fetchFn = (...a) => fetch(...a) }: ClientOptions): Client {
  const base = baseUrl.replace(/\/+$/, "");
  const call = async (name: EndpointName, input: unknown = {}) => {
    const e = contract[name];
    const { path, rest } = fillPath(e.path, e.input.parse(input) as Record<string, unknown>);
    const query = !sendsBody(e.method) && Object.keys(rest).length ? `?${new URLSearchParams(Object.entries(rest).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}` : "";
    const res = await fetchFn(`${base}${path}${query}`, {
      method: e.method,
      headers: { accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(sendsBody(e.method) ? { "content-type": "application/json" } : {}) },
      body: sendsBody(e.method) ? JSON.stringify(rest) : undefined,
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
    const parsed = e.output.safeParse(body);
    if (!parsed.success) throw new ApiError(502, "Die Antwort des Servers passt nicht zu dieser App-Version.");
    return parsed.data;
  };
  return Object.fromEntries(Object.keys(contract).map((name) => [name, (input?: unknown) => call(name as EndpointName, input)])) as Client;
}

export type { Contract };
