import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.beforeEach(async ({ request }) => {
  const res = await request.get("/api/cron/reset-demo", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.ok()).toBe(true);
});

test("an employee asks for time off and the manager approves it", async ({ browser }) => {
  const day = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);

  const emp = await browser.newPage();
  await loginAs(emp, "Employee");
  await emp.goto("/requests");
  await emp.getByLabel("First day off").fill(day);
  await emp.getByLabel("Last day off").fill(day);
  await emp.getByLabel("Reason (optional)").fill("Graduation");
  await emp.getByRole("button", { name: "Send request" }).click();
  await expect(emp.getByText("Sent. Your manager gets a notice.")).toBeVisible();
  await expect(emp.getByText("Waiting").first()).toBeVisible();

  const mgr = await browser.newPage();
  await loginAs(mgr, "Manager");
  await mgr.goto("/requests");
  const item = mgr.getByRole("listitem").filter({ hasText: "Graduation" });
  await item.getByLabel("Note").fill("Congratulations");
  await item.getByRole("button", { name: "Approve" }).click();
  await expect(mgr.getByText(/^Approved\./)).toBeVisible();

  await emp.reload();
  const mine = emp.getByRole("listitem").filter({ hasText: "Graduation" });
  await expect(mine.getByText("Approved")).toBeVisible();
  await expect(mine.getByText(/Congratulations/)).toBeVisible();
});

test("an employee blocks Mondays and saves", async ({ page }) => {
  await loginAs(page, "Employee");
  await page.goto("/availability");
  await page.getByRole("listitem").filter({ hasText: "Monday" }).getByRole("button", { name: "Block all day" }).click();
  await page.getByRole("button", { name: "Save availability" }).click();
  await expect(page.getByText(/^Saved\./)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "Monday" }).getByText("Cannot work: All day")).toBeVisible();
});
