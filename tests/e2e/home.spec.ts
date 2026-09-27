import { devices, expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.beforeEach(async ({ request }) => {
  const res = await request.get("/api/cron/reset-demo", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.ok()).toBe(true);
});

test("a manager lands on Home and can act on what waits for them", async ({ page }) => {
  await loginAs(page, "Manager");
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByRole("heading", { name: /Today at Downtown/ })).toBeVisible();
  const waiting = page.getByRole("region", { name: "Waiting on you" });
  await expect(waiting.getByText(/Approve .+ overtime/)).toBeVisible();
  await waiting.getByRole("button", { name: /^Approve \d+(\.\d)? h$/ }).click();
  await expect(page.getByText(/^Approved .+ overtime\.$/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Requests/ })).toContainText("1");
});

test.describe("on a phone", () => {
  // The phone settings of the preset; its browser type can't change inside a describe group.
  const { userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
  test.use({ userAgent, deviceScaleFactor, isMobile, hasTouch, viewport: { width: 390, height: 844 } });

  test("the schedule shows one day at a time without sideways scrolling", async ({ page }) => {
    await loginAs(page, "Manager");
    await page.goto("/schedule");
    await page.getByRole("link", { name: "Next week" }).click();
    const days = page.getByRole("navigation", { name: "Day" });
    await expect(days.getByRole("button")).toHaveCount(7);
    await days.getByRole("button").nth(1).click();
    await expect(page.getByRole("grid")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole("button", { name: / to / }).first().click();
    await expect(page.getByRole("dialog", { name: "Shift details" })).toBeVisible();
  });

  test("employees get a bottom tab bar", async ({ page }) => {
    await loginAs(page, "Employee");
    const tabs = page.getByRole("navigation", { name: "Main" });
    await expect(tabs.getByRole("link")).toHaveCount(4);
    await tabs.getByRole("link", { name: /Availability/ }).click();
    await expect(page).toHaveURL(/\/availability/);
  });
});
