import { chromium } from "@playwright/test";
const BASE = "http://localhost:3000";
const OUT = "design/review/shots";
const roles0 = {
  admin: ["/schedule", "/team", "/requests", "/labor", "/settings", "/help"],
  manager: ["/schedule", "/team", "/requests", "/labor", "/help"],
  employee: ["/my-shifts", "/schedule", "/availability", "/requests", "/help"],
};
const only = process.argv[2];
const browser = await chromium.launch();
// login page itself
for (const [vw, vh, tag] of [[1440, 900, "d"], [390, 844, "m"]]) for (const cs of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, colorScheme: cs });
  const p = await ctx.newPage(); await p.goto(BASE + "/login"); await p.waitForLoadState("networkidle");
  await p.screenshot({ path: `${OUT}/login-${tag}-${cs}.png` }); await ctx.close();
}
for (const [role, routes] of Object.entries(roles)) {
  if (only && only !== role) continue;
  for (const [vw, vh, tag] of [[1440, 900, "d"], [390, 844, "m"]]) for (const cs of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, colorScheme: cs });
    const p = await ctx.newPage();
    await p.goto(BASE + "/login");
    await p.getByRole("button", { name: new RegExp(`Try as ${role}`, "i") }).click();
    await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
    await p.waitForLoadState("networkidle");
    const landed = new URL(p.url()).pathname;
    console.log(role, tag, cs, "landed", landed);
    for (const r of routes) {
      let url = r;
      if (r.includes("NEXT")) {
        const d = new Date("2026-09-28"); // fallback
        url = "/schedule?week=2026-10-05";
      }
      try {
        await p.goto(BASE + url, { timeout: 60000 }); await p.waitForLoadState("networkidle"); await p.waitForTimeout(400);
      } catch (e) { console.log("ERR", url, e.message); }
      const name = `${role}-${url.replace(/[/?=]/g, "_").replace(/^_/, "")}-${tag}-${cs}`;
      await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: tag === "m" });
      if (tag === "d") await p.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
    }
    await ctx.close();
  }
}
await browser.close();
