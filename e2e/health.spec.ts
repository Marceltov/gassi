import { expect, test } from "@playwright/test";

test("/health is 200 without a session", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});
