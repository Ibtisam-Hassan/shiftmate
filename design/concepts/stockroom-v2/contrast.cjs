// v2 contrast check: the v1 pairs from ../contrast.cjs plus the pairs v2 introduces.
// Run: node design/concepts/stockroom-v2/contrast.cjs
const fs = require('fs'), path = require('path');
const L = h => { const c = [1,3,5].map(i => parseInt(h.slice(i, i+2), 16) / 255).map(v => v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => '#' + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16)*t + parseInt(b.slice(i,i+2),16)*(1-t)).toString(16).padStart(2,'0')).join('');
const vars = blk => Object.fromEntries([...blk.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
const s = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const light = vars(s.match(/:root \{([\s\S]*?)\}/)[1]), dark = { ...light, ...vars(s.match(/\[data-theme="dark"\] \{([\s\S]*?)\}/)[1]) };
let fails = 0;
for (const [mode, v] of [['light', light], ['dark', dark]]) {
  const T = [ // [label, fg, bg, min]
    ['foreground/background', v.foreground, v.background, 4.5], ['foreground/card', v.foreground, v.card, 4.5],
    ['muted-fg/card', v['muted-foreground'], v.card, 4.5], ['muted-fg/muted', v['muted-foreground'], v.muted, 4.5],
    ['primary-fg/primary', v['primary-foreground'], v.primary, 4.5], ['kraft-fg/kraft', v['kraft-foreground'], v.kraft, 4.5],
    ['warning/card (status words)', v.warning, v.card, 4.5], ['foreground/warning-bg (banner)', v.foreground, v['warning-bg'], 4.5],
    ['danger/card', v.danger, v.card, 4.5], ['danger/danger-bg (why text, cells)', v.danger, v['danger-bg'], 4.5],
    ['foreground/danger-bg (popover problems)', v.foreground, v['danger-bg'], 4.5],
    ['overtime/card', v.overtime, v.card, 4.5], ['overtime/overtime-bg', v.overtime, v['overtime-bg'], 4.5],
    ['muted-fg/accent-50% (open row)', v['muted-foreground'], mix(v.accent, v.card, .5), 4.5], ['foreground/accent (published banner)', v.foreground, v.accent, 4.5],
    ['card glyph on danger (✕ icon)', v.card, v.danger, 3], ['card glyph on warning (! icon)', v.card, v.warning, 3], ['card glyph on overtime (OT icon)', v.card, v.overtime, 3],
    ['hint: card on foreground', v.card, v.foreground, 4.5], ['hint OT text on foreground', mix(v.overtime, v.card, .45), v.foreground, 4.5],
    ['foreground on drop-ok tint', v.foreground, mix(v.ring, v.card, .16), 4.5], ['muted-fg on drop-no hatch (muted)', v['muted-foreground'], v.muted, 4.5],
    ['focus ring vs card (non-text)', v.ring, v.card, 3], ['focus ring vs danger-bg (non-text)', v.ring, v['danger-bg'], 3],
    ['meter fill vs track (non-text)', v.foreground, v.track, 3], ['meter OT vs track (non-text)', v.overtime, v.track, 3],
    ...['cashier','stock','floor','supervisor'].map(p => [`pos-${p} bar vs track (non-text)`, v['pos-' + p], v.track, 3]),
    ['danger outline vs danger-bg (non-text)', v.danger, v['danger-bg'], 3], ['coverage bar vs card (non-text)', mix(v['muted-foreground'], v.card, .45), v.card, 1.5],
  ];
  const bad = T.filter(([, a, b, m]) => cr(a, b) < m); fails += bad.length;
  console.log(`${mode}: ${T.length} pairs, lowest text pair ${Math.min(...T.filter(t => t[3] === 4.5).map(([, a, b]) => cr(a, b))).toFixed(2)}${bad.length ? '\n  FAIL ' + bad.map(([k, a, b, m]) => `${k} ${cr(a, b).toFixed(2)} < ${m}`).join('\n  FAIL ') : ', all pass'}`);
}
process.exitCode = fails ? 1 : 0;
