import { expect, test } from "@playwright/test";
import pg from "pg";
import { loginAs } from "./helpers";

test("a manager adds an employee to their store", async ({ page }) => {
  const email = `e2e.${Date.now()}@example.com`;
  await loginAs(page, "Manager");
  await page.goto("/team");
  await page.getByRole("button", { name: "Add person" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Robin Test");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Hourly rate (USD)").fill("18.25");
  await dialog.getByRole("button", { name: "Add person" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole("row", { name: /Robin Test/ });
  await expect(row).toContainText("Invited");
  await expect(row).toContainText("Downtown");
  await expect(row).toContainText("$18.25/h");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`delete from "user" where email = $1`, [email]);
  await client.end();
});

test("employees can't open the team or settings pages", async ({ page }) => {
  await loginAs(page, "Employee");
  await page.goto("/team");
  await expect(page).toHaveURL(/\/my-shifts/);
  await page.goto("/settings");
  await expect(page).not.toHaveURL(/\/settings/);
});
