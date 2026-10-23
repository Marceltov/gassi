// Wünsche und Fehler (#45, #39): the repo's GitHub issues, read and filed by the server with one token, so the app
// never talks to GitHub. The list is kept for a few minutes (and shown stale when GitHub doesn't answer); a report
// from the app gets its kind's label and `from-app`, and says who sent it from which device and app version.
import type { Output, ParsedInput } from "@gassi/api-client";
import { Unavailable } from "./errors";

export type Fetch = typeof fetch;
export type Issue = Output<"reportIssue">;
type IssueKind = ParsedInput<"reportIssue">["kind"];

/** GitHub's labels for the two kinds, and the one for what came from the app. */
const LABELS: Record<IssueKind, string> = { wish: "enhancement", bug: "bug" };
export const FROM_APP = "from-app";
/** How long a read list is shown before GitHub is asked again. */
export const LIST_TTL_MS = 5 * 60_000;
/** How many of the recently closed are shown below the open ones. */
const CLOSED = 15;

type GitHubIssue = { number: number; title: string; state: string; html_url: string; created_at: string; closed_at: string | null; labels: ({ name?: string } | string)[]; pull_request?: unknown };

export class Issues {
  private cached: { at: number; issues: Issue[] } | null = null;

  /** `repo`: "owner/name". */
  constructor(
    private readonly repo: string,
    private readonly token: string,
    private readonly fetchFn: Fetch = fetch,
  ) {}

  /** Open issues first (newest first), then the recently closed (closed last first); pull requests left out. */
  async list(now: number): Promise<Issue[]> {
    if (this.cached && now - this.cached.at < LIST_TTL_MS) return this.cached.issues;
    try {
      const [open, closed] = await Promise.all([this.call("issues?state=open&per_page=100"), this.call("issues?state=closed&sort=updated&per_page=50")]);
      const issues = [...asIssues(open), ...asIssues(closed).sort((a, b) => b.at.localeCompare(a.at)).slice(0, CLOSED)];
      this.cached = { at: now, issues };
      return issues;
    } catch (e) {
      if (this.cached) return this.cached.issues;
      throw e;
    }
  }

  /** Files a wish or a bug as `by` from `device`; the next list asks GitHub again, so it shows. */
  async report(r: ParsedInput<"reportIssue">, by: string, device: string): Promise<Issue> {
    const body = [r.text, r.text && "---", `From ${by} in the app · ${device} · Gassi ${r.version}`].filter(Boolean).join("\n\n");
    const created = await this.call("issues", { method: "POST", body: JSON.stringify({ title: r.title, body, labels: [LABELS[r.kind], FROM_APP] }) });
    this.cached = null;
    return asIssues([created])[0];
  }

  private async call(path: string, init: RequestInit = {}): Promise<unknown> {
    let res: Response;
    try {
      res = await this.fetchFn(`https://api.github.com/repos/${this.repo}/${path}`, {
        ...init,
        headers: { accept: "application/vnd.github+json", authorization: `Bearer ${this.token}`, "x-github-api-version": "2022-11-28", "user-agent": "gassi" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new Unavailable("GitHub antwortet gerade nicht.");
    }
    if (!res.ok) throw new Unavailable(`GitHub hat abgelehnt (${res.status}).`);
    return res.json();
  }
}

function asIssues(raw: unknown): Issue[] {
  return (raw as GitHubIssue[])
    .filter((i) => !i.pull_request)
    .map((i) => {
      const labels = i.labels.map((l) => (typeof l === "string" ? l : (l.name ?? "")));
      const open = i.state === "open";
      return {
        number: i.number,
        title: i.title,
        open,
        kind: labels.includes(LABELS.bug) ? "bug" : labels.includes(LABELS.wish) ? "wish" : null,
        fromApp: labels.includes(FROM_APP),
        at: open ? i.created_at : (i.closed_at ?? i.created_at),
        url: i.html_url,
      };
    });
}
