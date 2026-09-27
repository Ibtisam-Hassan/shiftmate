import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("a manager sees the labor chart and downloads the week as CSV", async ({ page }) => {
  await loginAs(page, "Manager");
  await page.goto("/labor");
  await expect(page.getByRole("img", { name: /Downtown\. Weekly labor cost/ })).toBeVisible();
  await page.getByText("Show the numbers for Downtown").click();
  await expect(page.getByRole("cell", { name: /%$/ }).first()).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download CSV" }).click()]);
  const csv = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
  const [header, ...rows] = csv.trim().split("\n");
  expect(header).toBe("Date,Store,Person,Position,Start,End,Break (min),Paid hours,Rate,Regular,Overtime,Total");
  expect(rows.length).toBeGreaterThan(20);
  expect(rows.every((r) => r.includes(",Downtown,"))).toBe(true);
});

test("employees can't see labor cost or download it", async ({ page }) => {
  await loginAs(page, "Employee");
  await page.goto("/labor");
  await expect(page).toHaveURL(/\/my-shifts/);
  const res = await page.request.get("/labor/export");
  expect(res.status()).toBe(403);
});
