import { chromium } from "@playwright/test";
const BASE = "http://localhost:3000", OUT = "design/review/shots";
const browser = await chromium.launch();
async function login(role, vw = 1440, vh = 900, cs = "light") {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, colorScheme: cs, hasTouch: vw < 500 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/login");
  await p.getByRole("button", { name: new RegExp(`Try as ${role}`, "i") }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  return [ctx, p];
}
const shot = (p, n, full = false) => p.screenshot({ path: `${OUT}/ix-${n}.png`, fullPage: full });
const safe = async (label, fn) => { try { await fn(); } catch (e) { console.log("FAIL", label, e.message.split("\n")[0]); } };

let [ctx, p] = await login("manager");
await p.goto(BASE + "/schedule?week=2026-09-28"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500);
// 1 popover: Diego Tue warning shift
await safe("popover", async () => {
  const bar = p.locator('button[aria-label*="Diego" i], button[aria-label*="unavailable" i]').first();
  await bar.click(); await p.waitForTimeout(500); await shot(p, "popover-warn");
  await p.keyboard.press("Escape");
  const any = p.locator("button[aria-label*=','][class*='group/bar']").nth(3);
  await any.click(); await p.waitForTimeout(500); await shot(p, "popover-normal");
  await p.keyboard.press("Escape");
});
// 2 assign panel from rail
await safe("assign", async () => {
  await p.getByRole("button", { name: /^Assign/ }).first().click(); await p.waitForTimeout(700); await shot(p, "assign");
  await p.keyboard.press("Escape");
});
// 3 bell
await safe("bell", async () => {
  await p.getByRole("button", { name: /notif|bell/i }).first().click(); await p.waitForTimeout(600); await shot(p, "bell");
  await p.keyboard.press("Escape");
});
// 4 add shift dialog
await safe("add", async () => {
  await p.getByRole("button", { name: /Add shift/ }).first().click(); await p.waitForTimeout(600); await shot(p, "add-shift");
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
});
// 5 drag and cancel
await safe("drag", async () => {
  const bars = p.locator("[class*='group/bar'][aria-roledescription]");
  console.log("draggable bars", await bars.count());
  const src = bars.nth(2); const b = await src.boundingBox();
  await p.mouse.move(b.x + 20, b.y + 8); await p.mouse.down();
  await p.mouse.move(b.x + 40, b.y + 20, { steps: 5 });
  await p.mouse.move(b.x + 140, b.y + 60, { steps: 10 }); await p.waitForTimeout(400); await shot(p, "drag-mid");
  await p.keyboard.press("Escape"); await p.waitForTimeout(200); await p.mouse.up(); await p.waitForTimeout(400);
  await shot(p, "drag-after");
});
// 6 tab order
await safe("tab", async () => {
  await p.goto(BASE + "/schedule?week=2026-09-28"); await p.waitForLoadState("networkidle");
  const seq = [];
  for (let i = 0; i < 45; i++) {
    await p.keyboard.press("Tab");
    const d = await p.evaluate(() => { const e = document.activeElement; const r = e.getBoundingClientRect();
      return `${e.tagName} "${(e.getAttribute("aria-label") || e.innerText || e.getAttribute("placeholder") || "").slice(0, 50).replace(/\n/g, " ")}" @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`; });
    seq.push(`${i + 1}. ${d}`);
    if (i === 0 || i === 12 || i === 30) await shot(p, `tab-${i + 1}`);
  }
  console.log(seq.join("\n"));
});
// 7 empty week + activity
await p.goto(BASE + "/activity"); await p.waitForLoadState("networkidle"); await shot(p, "activity", true);
await ctx.close();

// admin activity + dark popover
[ctx, p] = await login("admin", 1440, 900, "dark");
await p.goto(BASE + "/activity"); await p.waitForLoadState("networkidle"); await shot(p, "activity-admin-dark", true);
await p.goto(BASE + "/schedule?week=2026-09-28"); await p.waitForLoadState("networkidle");
await safe("dark popover", async () => { await p.locator("[class*='group/bar']").nth(4).click(); await p.waitForTimeout(500); await shot(p, "popover-dark"); });
await ctx.close();

// mobile checks
for (const role of ["manager", "employee"]) {
  [ctx, p] = await login(role, 390, 844);
  for (const r of ["/schedule?week=2026-09-28", "/my-shifts", "/requests", "/availability", "/team", "/labor"]) {
    await p.goto(BASE + r); await p.waitForLoadState("networkidle");
    const m = await p.evaluate(() => {
      const sw = document.documentElement.scrollWidth;
      const small = [...document.querySelectorAll("button, a, input, [role=button], select")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44); })
        .map(e => `${(e.innerText || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 24).replace(/\n/g, " ")}(${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)})`);
      return { sw, small: small.length, examples: [...new Set(small)].slice(0, 12) };
    });
    console.log(role, r, "scrollWidth", m.sw, "small targets", m.small, m.examples.join(" | "));
  }
  await safe("menu", async () => { await p.getByRole("button", { name: /menu|open nav/i }).first().click(); await p.waitForTimeout(500); await shot(p, `${role}-mobile-menu`); await p.keyboard.press("Escape"); });
  if (role === "employee") await safe("bell-m", async () => { await p.getByRole("button", { name: /notif|bell/i }).first().click(); await p.waitForTimeout(500); await shot(p, "employee-mobile-bell"); await p.keyboard.press("Escape"); });
  if (role === "manager") await safe("popover-m", async () => { await p.goto(BASE + "/schedule?week=2026-09-28"); await p.waitForLoadState("networkidle"); await p.locator("[class*='group/bar']").nth(1).click(); await p.waitForTimeout(500); await shot(p, "manager-mobile-popover");
    await p.keyboard.press("Escape"); await p.getByRole("button", { name: /Review/ }).first().click(); await p.waitForTimeout(500); await shot(p, "manager-mobile-review"); });
  if (role === "employee") await safe("swap-dialog", async () => { await p.goto(BASE + "/my-shifts"); await p.waitForLoadState("networkidle"); await p.getByRole("button", { name: /Offer a swap/ }).first().click(); await p.waitForTimeout(500); await shot(p, "employee-mobile-swap-dialog"); await p.keyboard.press("Escape"); });
  await ctx.close();
}
await browser.close();
