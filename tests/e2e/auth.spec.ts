import { expect, test } from "@playwright/test";
import pg from "pg";
import { loginAs } from "./helpers";

test("signed-out visitors are sent to login", async ({ page }) => {
  await page.goto("/schedule");
  await expect(page).toHaveURL(/\/login/);
});

test("each demo role lands on its home page with the right navigation", async ({ page }) => {
  await loginAs(page, "Admin");
  await expect(page).toHaveURL(/\/home/);
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.context().clearCookies();
  await loginAs(page, "Manager");
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByText("Downtown · Manager").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);

  await page.context().clearCookies();
  await loginAs(page, "Employee");
  await expect(page).toHaveURL(/\/my-shifts/);
  await expect(page.getByRole("link", { name: "Labor cost" })).toHaveCount(0);
});

test("magic link signs an invited user in; unknown emails get the same response", async ({ page }) => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await page.goto("/login");
    await page.getByLabel("Work email").fill("nobody@example.com");
    await page.getByRole("button", { name: /Email me a sign-in link/ }).click();
    await expect(page.getByText("Check your inbox.")).toBeVisible();

    await page.goto("/login");
    const email = "manager@demo.shiftmate.app";
    await page.getByLabel("Work email").fill(email);
    await page.getByRole("button", { name: /Email me a sign-in link/ }).click();
    await expect(page.getByText("Check your inbox.")).toBeVisible();

    const { rows } = await client.query(
      `select identifier from verification where value like $1 order by "createdAt" desc limit 1`,
      [`%${email}%`],
    );
    expect(rows).toHaveLength(1);
    const token = rows[0].identifier;
    await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=/`);
    await expect(page).toHaveURL(/\/home/);

    // A link works once.
    await page.context().clearCookies();
    await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=/&errorCallbackURL=/login?error=link`);
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await client.end();
  }
});

test("password sign-in is refused for non-demo accounts", async ({ request }) => {
  const res = await request.post("/api/auth/sign-in/email", {
    data: { email: "someone@example.com", password: "whatever-password" },
  });
  expect(res.status()).toBe(403);
});
