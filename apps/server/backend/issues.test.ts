import { describe, expect, test } from "vitest";
import { Unavailable } from "./errors";
import { type Fetch, Issues, LIST_TTL_MS } from "./issues";

const issue = (number: number, more: Record<string, unknown> = {}) => ({
  number,
  title: `Issue ${number}`,
  state: "open",
  html_url: `https://github.com/o/r/issues/${number}`,
  created_at: `2026-10-${10 + number}T10:00:00Z`,
  closed_at: null,
  labels: [],
  ...more,
});

/** A stub GitHub: the open and closed lists as given, a created issue gets number 99; it remembers what was asked. */
function gitHub(open: unknown[], closed: unknown[] = []) {
  const asked: { url: string; init?: RequestInit }[] = [];
  let down = false;
  const fetchFn: Fetch = async (url, init) => {
    asked.push({ url: String(url), init });
    if (down) throw new Error("offline");
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { title: string; labels: string[] };
      return Response.json(issue(99, { title: body.title, labels: body.labels.map((name) => ({ name })) }), { status: 201 });
    }
    return Response.json(String(url).includes("state=open") ? open : closed);
  };
  return { fetchFn, asked, goDown: () => (down = true) };
}

describe("Issues", () => {
  test("open first, then the recently closed by when they closed; pull requests left out; kind and from-app from the labels", async () => {
    const gh = gitHub(
      [issue(3, { labels: [{ name: "bug" }, { name: "from-app" }] }), issue(2, { labels: [{ name: "enhancement" }] }), issue(4, { pull_request: {} })],
      [issue(1, { state: "closed", closed_at: "2026-10-20T10:00:00Z" }), issue(5, { state: "closed", closed_at: "2026-10-22T10:00:00Z" })],
    );
    const list = await new Issues("o/r", "token", gh.fetchFn).list(0);
    expect(list.map((i) => [i.number, i.open, i.kind, i.fromApp, i.at])).toEqual([
      [3, true, "bug", true, "2026-10-13T10:00:00Z"],
      [2, true, "wish", false, "2026-10-12T10:00:00Z"],
      [5, false, null, false, "2026-10-22T10:00:00Z"],
      [1, false, null, false, "2026-10-20T10:00:00Z"],
    ]);
    expect(gh.asked[0].url).toMatch(/^https:\/\/api\.github\.com\/repos\/o\/r\/issues\?/);
    expect(new Headers(gh.asked[0].init?.headers).get("authorization")).toBe("Bearer token");
  });

  test("kept for a few minutes; shown as it was when GitHub doesn't answer; without one read, says so", async () => {
    const gh = gitHub([issue(1)]);
    const issues = new Issues("o/r", "t", gh.fetchFn);
    await issues.list(0);
    await issues.list(LIST_TTL_MS - 1);
    expect(gh.asked).toHaveLength(2); // the open and the closed, once
    gh.goDown();
    expect((await issues.list(LIST_TTL_MS)).map((i) => i.number)).toEqual([1]);
    await expect(new Issues("o/r", "t", gh.fetchFn).list(0)).rejects.toThrow(Unavailable);
  });

  test("a report is filed with its kind's label and from-app, says who sent it, and the next list asks again", async () => {
    const gh = gitHub([]);
    const issues = new Issues("o/r", "t", gh.fetchFn);
    await issues.list(0);
    const filed = await issues.report({ kind: "wish", title: "Konsistenz", text: "Beim Kot auswählen", version: "0.3.0" }, "Herzii", "iPhone (Web)");
    expect(filed).toMatchObject({ number: 99, title: "Konsistenz", open: true, kind: "wish", fromApp: true });
    expect(JSON.parse(String(gh.asked[2].init?.body))).toEqual({ title: "Konsistenz", body: "Beim Kot auswählen\n\n---\n\nFrom Herzii in the app · iPhone (Web) · Gassi 0.3.0", labels: ["enhancement", "from-app"] });
    await issues.list(1);
    expect(gh.asked).toHaveLength(5);
  });
});
