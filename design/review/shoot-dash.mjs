import { chromium } from "@playwright/test";
import path from "node:path";
const dir = path.resolve("design/concepts/dashboard");
const b = await chromium.launch();
const shots = [
  ["index.html", 1440, 900, "light", "dashboard-light.png", ""],
  ["index.html", 1440, 900, "dark", "dashboard-dark.png", "?theme=dark"],
  ["index.html", 1440, 900, "light", "dashboard-admin.png", "?role=admin"],
  ["index.html", 1024, 800, "light", "dashboard-1024.png", ""],
  ["mobile.html", 390, 844, "light", "dashboard-mobile.png", ""],
  ["mobile.html", 390, 844, "dark", "dashboard-mobile-dark.png", "?theme=dark"],
];
for (const [f, w, h, cs, out, q] of shots) {
  try {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: cs });
    const p = await ctx.newPage();
    p.on("console", (m) => m.type() === "error" && console.log(out, "console:", m.text()));
    p.on("pageerror", (e) => console.log(out, "pageerror:", e.message));
    await p.goto("file://" + dir + "/" + f + q); await p.waitForTimeout(1200);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    console.log(out, "scrollWidth", sw);
    if (f === "mobile.html") {
      await p.screenshot({ path: dir + "/" + out.replace(".png", "-fold.png") });
      await p.addStyleTag({ content: ".tabbar{position:static!important}" });
    }
    await p.screenshot({ path: dir + "/" + out, fullPage: true });
    await ctx.close();
  } catch (e) { console.log(out, "ERR", e.message.split("\n")[0]); }
}
await b.close();
