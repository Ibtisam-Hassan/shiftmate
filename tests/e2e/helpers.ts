import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, role: "Admin" | "Manager" | "Employee") {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`Try as ${role}`) }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
