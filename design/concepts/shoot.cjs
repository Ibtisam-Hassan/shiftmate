// Usage: node design/concepts/shoot.cjs <slug> [grid|mobile|all]
const { chromium } = require('@playwright/test');
const path = require('path');
(async () => {
  const slug = process.argv[2], what = process.argv[3] || 'all';
  const dir = path.join(__dirname, slug);
  const b = await chromium.launch();
  const shots = [];
  if (what !== 'mobile') shots.push(['index.html?theme=light', 'grid-light.png', 1440, 900], ['index.html?theme=dark', 'grid-dark.png', 1440, 900]);
  if (what !== 'grid') shots.push(['mobile.html', 'mobile.png', 390, 844]);
  for (const [f, out, w, h] of shots) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.goto('file://' + path.join(dir, f));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(dir, out) });
    await p.close();
  }
  await b.close();
})();
