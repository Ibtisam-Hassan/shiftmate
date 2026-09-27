// Static mockup data: Downtown, Sunday Sep 27 (matches the live demo's Sep 21 week, Sun column).
const START = 6, END = 23, OPEN = 8, CLOSE = 22, MIN = 2;
const pct = (h) => ((h - START) / (END - START)) * 100;
const POS = { Cashier: "var(--pos-cashier)", Stock: "var(--pos-stock)", Floor: "var(--pos-floor)", Supervisor: "var(--pos-supervisor)" };
const fmt = (h) => { const hh = Math.floor(h) % 12 || 12; const m = Math.round((h % 1) * 60); return `${hh}:${String(m).padStart(2, "0")}`; };
const NOW = 8 + 10 / 60;

const today = [
  { name: "Noah Berg", pos: "Cashier", s: 8, e: 16 },
  { name: "Ethan Mensah", pos: "Stock", s: 8, e: 16 },
  { name: "Liam Novak", pos: "Supervisor", s: 10, e: 18 },
  { name: "Zara Dubois", pos: "Floor", s: 11, e: 19 },
];
const open = [
  { pos: "Cashier", s: 12, e: 22 },
  { pos: "Cashier", s: 14, e: 22 },
  { pos: "Floor", s: 14, e: 22 },
];

function status(p) {
  if (NOW >= p.s && NOW < p.e) return `<b>On now</b>, until ${fmt(p.e)}`;
  const mins = Math.round((p.s - NOW) * 60);
  return `Starts in ${Math.floor(mins / 60) ? Math.floor(mins / 60) + " h " : ""}${mins % 60} min`;
}

function renderDay() {
  const el = document.getElementById("day");
  if (!el) return;
  const cols = [];
  const gaps = [];
  for (let h = START; h < END; h++) {
    const closed = h < OPEN || h >= CLOSE;
    const n = today.filter((p) => p.s <= h && p.e > h).length;
    const o = open.filter((p) => p.s <= h && p.e > h).length;
    const gap = !closed && n < MIN;
    if (gap) gaps.push(h);
    const title = closed ? `${fmt(h)}: store closed` : `${fmt(h)}: ${n} ${n === 1 ? "person" : "people"}${o ? `, ${o} more if open shifts are filled` : ""}${gap ? ", below minimum" : ""}`;
    cols.push(`<span class="${closed ? "closed" : gap ? "gap" : ""}" title="${title}">${o && !closed ? `<u style="height:${(o / 7) * 100}%"></u>` : ""}${n ? `<i style="height:${(n / 7) * 100}%"></i>` : ""}</span>`);
  }
  const ticks = [6, 9, 12, 15, 18, 21].filter((h) => Math.abs(h - NOW) > 1.2).map((h) => `<span style="left:${pct(h)}%">${h === 12 ? "12p" : (h % 12) + (h < 12 ? "a" : "p")}</span>`).join("");
  const guides = [12, 18].map((h) => `<i class="guide" style="left:${pct(h)}%"></i>`).join("");
  const gapBox = gaps.length ? `<i class="gapcol" style="left:${pct(gaps[0])}%;width:${pct(gaps.at(-1) + 1) - pct(gaps[0])}%"></i>` : "";
  const lane = (p, isOpen) => `
    <div class="lane${isOpen ? " openrow" : ""}">
      <div class="nm"><i style="background:${POS[p.pos]}"></i><span>${isOpen ? "Open shift" : p.name}<small>${p.pos}</small><em class="tt">${fmt(p.s)}–${fmt(p.e)}</em></span></div>
      <div class="track overlay">${guides}${gapBox}<i class="now" style="left:${pct(NOW)}%"></i>
        <span class="bar${isOpen ? " open" : ""}" style="--c:${POS[p.pos]};left:${pct(p.s)}%;width:${pct(p.e) - pct(p.s)}%"><span class="tm">${fmt(p.s)}–${fmt(p.e)}</span></span>
      </div>
      ${isOpen ? `<div><button class="btn as" type="button">Assign…</button></div>` : `<div class="lst">${status(p)}</div>`}
    </div>`;
  el.innerHTML = `
    <div class="axis"><span></span><div class="t">${ticks}</div><span></span></div>
    <div class="cov"><div class="lbl"><b>Coverage</b>people each hour</div>
      <div class="hist overlay">${cols.join("")}<i class="now" style="left:${pct(NOW)}%"><em>now</em></i></div>
      <div class="note">6–10 pm <br>below 2</div></div>
    ${today.map((p) => lane(p, false)).join("")}
    ${open.map((p) => lane(p, true)).join("")}`;
}

const week = [
  { dn: 28, dw: "Mon", peak: [3, 3, 4, 5, 5, 5, 5, 5, 4, 3, 3, 2, 2, 2] },
  { dn: 29, dw: "Tue", peak: [2, 2, 3, 4, 4, 4, 5, 5, 4, 4, 3, 2, 2, 2], flag: ["warn", "! Diego 8–4"] },
  { dn: 30, dw: "Wed", peak: [3, 3, 4, 4, 5, 5, 5, 5, 4, 3, 3, 2, 2, 2] },
  { dn: 1, dw: "Thu", peak: [2, 2, 3, 4, 4, 4, 5, 5, 4, 3, 3, 2, 2, 2] },
  { dn: 2, dw: "Fri", peak: [1, 1, 3, 4, 4, 4, 5, 5, 4, 4, 3, 3, 2, 2], gaps: [0, 1], flag: ["bad", "8–10 am short"] },
  { dn: 3, dw: "Sat", peak: [2, 2, 3, 4, 5, 5, 6, 6, 5, 4, 3, 3, 2, 2] },
  { dn: 4, dw: "Sun", peak: [2, 2, 3, 3, 4, 4, 4, 4, 3, 2, 1, 1, 1, 1], gaps: [10, 11, 12, 13], flag: ["bad", "6–10 pm short"] },
];

function renderWeek() {
  const el = document.getElementById("week");
  if (!el) return;
  el.innerHTML = week.map((d) => {
    const bars = [6, 7].map(() => `<span class="closed"></span>`)
      .concat(d.peak.map((n, i) => `<span class="${d.gaps?.includes(i) ? "gap" : ""}" style="height:${(n / 7) * 100}%"></span>`))
      .concat([`<span class="closed"></span>`]).join("");
    const f = d.flag ? `<span class="flag ${d.flag[0]}">${d.flag[1]}</span>` : `<span class="flag"></span>`;
    return `<div class="wd"><span class="dh"><span class="dn">${d.dn}</span><span class="dw">${d.dw}</span></span><span class="mh">${bars}</span>${f}</div>`;
  }).join("");
}

const hours = [
  { name: "Omar Haddad", h: 45, note: "5 h overtime, needs your approval" },
  { name: "Aisha Okafor", h: 37.5 },
  { name: "Diego Tanaka", h: 37.5 },
  { name: "Noah Berg", h: 37.5 },
  { name: "Maya Patel", h: 37.5, sub: "mostly Riverside" },
];

function renderHours() {
  const el = document.getElementById("hours");
  if (!el) return;
  el.innerHTML = hours.map((p) => {
    const f = Math.min(p.h, 40) / 48 * 100;
    const fo = p.h > 40 ? `<i class="fo" style="left:83.33%;width:${(p.h - 40) / 48 * 100}%"></i>` : "";
    const left = p.h < 40 ? `${40 - p.h} h left` : "";
    return `<li class="${p.h > 40 ? "over" : ""}" aria-label="${p.name}, ${p.h} hours${p.note ? ", " + p.note : ", " + left}">
      <span class="who">${p.name}</span>
      <span class="hm"><i class="otz"></i><i class="f" style="width:${f}%"></i>${fo}<i class="tick"></i></span>
      <span class="h">${p.h} h</span>
      ${p.note ? `<span class="note">${p.note}</span>` : ""}</li>`;
  }).join("");
}

function setupControls() {
  const root = document.documentElement;
  const tb = document.getElementById("theme");
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const label = () => { if (tb && !tb.querySelector("svg")) tb.textContent = isDark() ? "Light mode" : "Dark mode"; };
  const q = new URLSearchParams(location.search);
  if (q.get("theme")) root.dataset.theme = q.get("theme");
  tb?.addEventListener("click", () => { root.dataset.theme = isDark() ? "light" : "dark"; label(); });
  label();
  const setRole = (r) => {
    document.body.classList.toggle("admin", r === "admin");
    document.querySelectorAll("[data-role]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.role === r)));
    const admin = r === "admin";
    document.querySelectorAll(".who-name").forEach((n) => (n.textContent = admin ? "Alex Rivera" : "Jordan Blake"));
    document.querySelectorAll(".who-scope").forEach((n) => (n.textContent = admin ? "All stores, admin" : "Downtown manager"));
    const sub = document.querySelector(".head .sub");
    if (sub) sub.textContent = admin ? "8:10 am. All three stores open 8:00 am to 10:00 pm. Below: Downtown, the store that needs you most." : "Downtown, 8:10 am. Open 8:00 am to 10:00 pm.";
    document.querySelectorAll(".who-init").forEach((n) => (n.textContent = admin ? "AR" : "JB"));
  };
  document.querySelectorAll("[data-role]").forEach((b) => b.addEventListener("click", () => setRole(b.dataset.role)));
  setRole(q.get("role") === "admin" ? "admin" : "manager");
}

renderDay();
renderWeek();
renderHours();
setupControls();
