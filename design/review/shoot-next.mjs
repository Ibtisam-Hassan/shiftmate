import { chromium } from "@playwright/test";
const BASE = "http://localhost:3000", OUT = "design/review/shots";
const browser = await chromium.launch();
for (const role of ["admin", "manager", "employee"]) for (const [vw, vh, tag] of [[1440, 900, "d"], [390, 844, "m"]]) for (const cs of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, colorScheme: cs });
  const p = await ctx.newPage();
  await p.goto(BASE + "/login");
  await p.getByRole("button", { name: new RegExp(`Try as ${role}`, "i") }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  await p.goto(BASE + "/schedule?week=2026-09-28"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${role}-next-${tag}-${cs}.png`, fullPage: tag === "m" });
  if (tag === "d") await p.screenshot({ path: `${OUT}/${role}-next-${tag}-${cs}-full.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
