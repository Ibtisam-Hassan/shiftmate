// node design/concepts/stockroom-v2/shoot.cjs [what...]  (run from the shiftmate dir)
const { chromium } = require('@playwright/test');
const path = require('path');
const all = {
  'grid-light': ['index.html?theme=light', 1440, 900],
  'grid-dark': ['index.html?theme=dark', 1440, 900],
  'grid-1280': ['index.html', 1280, 800],
  'states': ['states.html', 1440, 3160, true],
  'mobile': ['mobile.html', 390, 844],
};
(async () => {
  const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(all);
  const b = await chromium.launch();
  const errors = [];
  for (const k of want) {
    const [f, w, h, full] = all[k] || [k, 1440, 900];
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => errors.push(`${k}: ${e.message}`));
    await p.goto('file://' + path.join(__dirname, f));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(full ? 2500 : 600);
    await p.screenshot({ path: path.join(__dirname, (all[k] ? k : 'tmp') + '.png'), fullPage: !!full });
    await p.close();
  }
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'no page errors');
})();
