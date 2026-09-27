import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { loginAs } from "./helpers";

// Each test starts from a freshly seeded demo so they don't depend on each other.
test.beforeEach(async ({ request }) => {
  const res = await request.get("/api/cron/reset-demo", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.ok()).toBe(true);
});

async function nextWeek(page: Page) {
  await loginAs(page, "Manager");
  await page.goto("/schedule");
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page.getByText("Draft.", { exact: false })).toBeVisible();
}

test("overtime blocks publishing until approved, then the week publishes", async ({ page }) => {
  await nextWeek(page);
  const publish = page.getByRole("button", { name: "Publish week" });
  await expect(publish).toBeDisabled();
  await expect(page.getByText(/Can't publish yet: approve overtime/)).toBeVisible();

  const rail = page.getByRole("complementary", { name: "Publish review" });
  await rail.getByRole("button", { name: /^Approve .* overtime$/ }).first().click();
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByText(/Published\. \d+ people were notified in the app\./)).toBeVisible();
  await expect(page.getByText(/^Published/).first()).toBeVisible();
});

test("dragging a shift to another person's empty day moves it", async ({ page }) => {
  // Tall enough that source and target rows are both on screen: dnd-kit auto-scrolls near the
  // viewport edge, which would move the target out from under fixed mouse coordinates.
  await page.setViewportSize({ width: 1440, height: 1600 });
  await nextWeek(page);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // A shift on Monday, and someone with nothing on Monday or Tuesday to drop it onto.
    const grid = page.getByRole("grid");
    const rows = grid.getByRole("row");
    const count = await rows.count();
    let source: { name: string } | null = null;
    let target: { name: string } | null = null;
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const name = (await row.getByRole("rowheader").innerText()).split("\n")[0].trim();
      const mon = row.getByRole("gridcell").nth(0);
      const tue = row.getByRole("gridcell").nth(1);
      const monShifts = await mon.getByRole("button", { name: / to / }).count();
      const tueShifts = await tue.getByRole("button", { name: / to / }).count();
      if (!source && monShifts === 1) source = { name };
      else if (!target && monShifts === 0 && tueShifts === 0) target = { name };
    }
    expect(source && target).toBeTruthy();
    const from = grid.getByRole("row", { name: new RegExp(source!.name) }).getByRole("gridcell").nth(0).getByRole("button", { name: / to / });
    const label = await from.getAttribute("aria-label");
    const to = grid.getByRole("row", { name: new RegExp(target!.name) }).getByRole("gridcell").nth(1);

    await to.scrollIntoViewIfNeeded();
    const a = (await from.boundingBox())!;
    const b = (await to.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 5, { steps: 5 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
    await page.mouse.up();

    await expect(page.getByText(new RegExp(`Moved to ${target!.name}`))).toBeVisible();
    await expect(grid.getByRole("row", { name: new RegExp(target!.name) }).getByRole("gridcell").nth(1).getByRole("button", { name: label! })).toBeVisible();
  } finally {
    await client.end();
  }
});

test("an open shift can be assigned from the ranked suggestions", async ({ page }) => {
  await nextWeek(page);
  const openRow = page.getByRole("gridcell", { name: /^Open shifts,/ });
  await openRow.getByRole("button", { name: / to / }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Assign…" }).click();
  await expect(page.getByText(/Best first/)).toBeVisible();
  const firstAssign = page.getByRole("dialog").getByRole("button", { name: "Assign" }).first();
  await firstAssign.click();
  await expect(page.getByText(/^Assigned to /)).toBeVisible();
});

test("employees see published weeks read-only and never see drafts or pay", async ({ page }) => {
  await loginAs(page, "Employee");
  await page.goto("/schedule");
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(page.getByText("Regular pay")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish week" })).toHaveCount(0);
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page.getByText("This week isn't published yet.")).toBeVisible();
});
