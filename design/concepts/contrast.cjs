// Checks key text/background pairs in each concept's light + dark token blocks.
const fs = require('fs');
const L = h => { const c = [1,3,5].map(i => parseInt(h.slice(i, i+2), 16) / 255).map(v => v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => '#' + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16)*t + parseInt(b.slice(i,i+2),16)*(1-t)).toString(16).padStart(2,'0')).join('');
const vars = blk => Object.fromEntries([...blk.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
for (const slug of ['shelf-edge','stockroom','magnet-board']) {
  const s = fs.readFileSync(`${slug}/index.html`, 'utf8');
  const light = vars(s.match(/:root \{([\s\S]*?)\}/)[1]), dark = { ...light, ...vars(s.match(/\[data-theme="dark"\] \{([\s\S]*?)\}/)[1]) };
  for (const [mode, v] of [['light', light], ['dark', dark]]) {
    const pairs = [['foreground','background'],['foreground','card'],['muted-foreground','card'],['muted-foreground','background'],['muted-foreground','muted'],['primary-foreground','primary'],['danger','danger-bg'],['overtime','overtime-bg'],['overtime','card'],['danger','card']];
    if (v['warning-foreground']) pairs.push(['warning-foreground','warning-bg'],['warning-foreground','card']); else pairs.push(['warning','warning-bg'],['warning','card']);
    if (v['kraft-foreground']) pairs.push(['kraft-foreground','kraft']);
    const out = pairs.map(([a, b]) => [a+'/'+b, cr(v[a], v[b])]);
    for (const p of ['pos-cashier','pos-stock','pos-floor','pos-supervisor']) {
      if (slug === 'magnet-board') out.push(['on-pos/'+p, cr(v['on-pos'], v[p])]);
      else if (slug === 'shelf-edge') { const t = mode === 'light' ? .11 : .20; out.push(['fg/'+p+' tint', cr(v.foreground, mix(v[p], v.card, t))], ['mutedfg/'+p+' tint', cr(v['muted-foreground'], mix(v[p], v.card, t))]); }
      else out.push([p+'/track (non-text 3:1)', cr(v[p], v.track)]);
    }
    const bad = out.filter(([k, r]) => r < (k.includes('non-text') ? 3 : 4.5));
    console.log(`${slug} ${mode}: ${out.length} pairs, min ${Math.min(...out.map(o => o[1])).toFixed(2)}${bad.length ? '  FAIL: ' + bad.map(([k, r]) => `${k}=${r.toFixed(2)}`).join(', ') : '  all pass'}`);
  }
}
