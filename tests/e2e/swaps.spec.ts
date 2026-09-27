import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.beforeEach(async ({ request }) => {
  const res = await request.get("/api/cron/reset-demo", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.ok()).toBe(true);
});

test("an employee offers a shift and the admin sees it in the swap log", async ({ browser }) => {
  const emp = await browser.newPage();
  await loginAs(emp, "Employee");
  await expect(emp.getByRole("region", { name: "Your next shift" })).toBeVisible();

  const row = emp.getByRole("region", { name: "Upcoming shifts" }).getByRole("listitem")
    .filter({ has: emp.getByRole("button", { name: "Offer a swap" }) }).first();
  await row.getByRole("button", { name: "Offer a swap" }).click();
  const dialog = emp.getByRole("dialog");
  await dialog.getByLabel("Coworker").click();
  const coworker = (await emp.getByRole("option").first().innerText()).trim();
  await emp.getByRole("option").first().click();
  await dialog.getByLabel("Message (optional)").fill("Doctor visit");
  await dialog.getByRole("button", { name: "Send offer" }).click();
  await expect(emp.getByText(/^Sent to /)).toBeVisible();
  await expect(emp.getByText(new RegExp(`to ${coworker}\\. Waiting for`))).toBeVisible();

  // The shift may be at Riverside, which the Downtown manager can't see, so check as the admin.
  const admin = await browser.newPage();
  await loginAs(admin, "Admin");
  await admin.goto("/requests");
  await expect(admin.getByText(coworker).first()).toBeVisible();
  await expect(admin.getByText("Waiting for coworker").first()).toBeVisible();
});

test("the bell shows new notices and clears when opened", async ({ browser }) => {
  const emp = await browser.newPage();
  await loginAs(emp, "Employee");
  await emp.goto("/requests");
  const day = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  await emp.getByLabel("First day off").fill(day);
  await emp.getByLabel("Last day off").fill(day);
  await emp.getByRole("button", { name: "Send request" }).click();
  await expect(emp.getByText(/^Sent\./)).toBeVisible();

  const mgr = await browser.newPage();
  await loginAs(mgr, "Manager");
  const bell = mgr.getByRole("button", { name: /Notifications, \d+ new/ });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(mgr.getByText(/asked for time off/)).toBeVisible();
  await mgr.reload();
  await expect(mgr.getByRole("button", { name: "Notifications" })).toBeVisible();
});
