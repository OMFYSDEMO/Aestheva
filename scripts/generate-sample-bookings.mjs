// Generates the dashboard's sample booking history from the prototype catalogue.
// Every provider, service, price, staff rota and the 10% commission come from prototype/data.js
// and prototype/core.js; only the bookings themselves are simulated. Output is deterministic.
//
//   node scripts/generate-sample-bookings.mjs        -> dashboard/sample-data.json
//
// To use real data instead, write the same JSON shape from your bookings database
// (see docs in dashboard/README.md) and run scripts/build-dashboard.mjs.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'prototype/data.js'), 'utf8'), ctx);
const D = ctx.window.AE_DATA;

const LAUNCH = '2026-08-03';          // Phase 1 went live in Thiruvananthapuram (Aug 2026)
const AS_OF = '2026-10-29';           // snapshot date
const SNAPSHOT_MIN = 13 * 60;         // snapshot taken at 1:00 pm IST
const AHEAD = 14;                     // days of forward bookings kept
const COMMISSION = 0.10;              // prototype/core.js COMMISSION

const dayMs = 864e5;
const toDate = s => new Date(s + 'T00:00:00Z');
const iso = d => d.toISOString().slice(0, 10);
const dayIdx = s => Math.round((toDate(s) - toDate(LAUNCH)) / dayMs);
const fromIdx = i => iso(new Date(toDate(LAUNCH).getTime() + i * dayMs));
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const r = rng(20261029);
const poisson = l => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; };
const weighted = (items, w) => { const tot = w.reduce((a, b) => a + b, 0); let x = r() * tot; for (let i = 0; i < items.length; i++) { x -= w[i]; if (x <= 0) return items[i]; } return items[items.length - 1]; };

// Go-live dates follow each provider's verification month in the catalogue.
const LIVE = { p1: '2026-08-03', p2: '2026-08-03', p4: '2026-08-03', p7: '2026-08-10', p5: '2026-08-24', p3: '2026-09-07', p6: '2026-09-14', p8: '2026-10-06' };
const BASE = { p1: 6.0, p2: 3.2, p3: 4.4, p4: 2.2, p5: 3.4, p6: 3.8, p7: 1.9, p8: 4.6 };   // bookings/day at maturity
const MKT_ADJ = { p1: -0.05, p4: 0.05, p8: 0.10 };
const SALON = new Set(['p3', 'p6', 'p8']);
const ONAM = [dayIdx('2026-08-20'), dayIdx('2026-08-26')];   // Thiruvonam 26 Aug 2026
const DEEPAVALI = [dayIdx('2026-11-05'), dayIdx('2026-11-08')];
const hourW = h => h < 11 ? 0.7 : h < 13 ? 1.0 : h < 15 ? 0.7 : h < 17 ? 0.9 : h < 20 ? 1.45 : 0.8;

const provIdx = Object.fromEntries(D.providers.map((p, i) => [p.id, i]));
const svcIdx = Object.fromEntries(D.services.map((s, i) => [s.id, i]));
const staffIdx = Object.fromEntries(D.staff.map((s, i) => [s.id, i]));
const asOf = dayIdx(AS_OF), last = asOf + AHEAD;
const rows = [];
const busy = new Map();                 // staff|day -> [[start,end]]
const clients = {};                     // provider -> client count

for (let d = 0; d <= last; d++) {
  const dow = toDate(fromIdx(d)).getUTCDay();
  const growth = 0.45 + 0.55 * Math.min(1, d / 80);
  for (const p of D.providers) {
    const live = dayIdx(LIVE[p.id]); if (d < live) continue;
    const ramp = Math.min(1, 0.3 + 0.7 * (d - live) / 21);
    let dowF = SALON.has(p.id) ? (dow === 0 ? 1.35 : dow === 6 ? 1.4 : 0.9) : (dow === 6 ? 1.15 : dow === 0 ? 0.6 : 1);
    let fest = 1;
    if (d >= ONAM[0] && d <= ONAM[1]) fest = SALON.has(p.id) || p.id === 'p2' ? 1.6 : 1.1;
    if (d >= DEEPAVALI[0] && d <= DEEPAVALI[1]) fest = SALON.has(p.id) ? 1.35 : 1.05;
    let n = poisson(BASE[p.id] * growth * ramp * dowF * fest);
    const ahead = d - asOf;
    const svcs = D.services.filter(s => s.providerId === p.id);
    for (let k = 0; k < n; k++) {
      if (ahead > 0 && r() > 0.95 * Math.exp(-ahead / 7)) continue;          // not booked yet
      const sv = weighted(svcs, svcs.map(s => (s.kind === 'treatment' ? 0.5 : 1) / Math.sqrt(s.price)));
      const staffOk = sv.staff.map(id => D.staff.find(s => s.id === id)).filter(s => s.avail.days.includes(dow));
      if (!staffOk.length) continue;
      const sf = staffOk[Math.floor(r() * staffOk.length)];
      const s0 = toMin(sf.avail.start), e0 = toMin(sf.avail.end);
      const slots = []; for (let t = s0; t + sv.dur <= e0; t += 30) slots.push(t);
      if (!slots.length) continue;
      const key = sf.id + '|' + d, taken = busy.get(key) || [];
      let start = null;
      for (let tries = 0; tries < 6 && start === null; tries++) {
        const t = weighted(slots, slots.map(x => hourW(Math.floor(x / 60))));
        if (!taken.some(([a, b]) => t < b && a < t + sv.dur)) start = t;
      }
      if (start === null) continue;
      const progress = Math.min(1, d / asOf);
      const mkt = r() < 0.42 + 0.26 * Math.min(1, d / 85) + (MKT_ADJ[p.id] || 0) ? 1 : 0;
      let status;                        // 0 completed · 1 confirmed · 2 cancelled · 3 no-show
      if (d < asOf || (d === asOf && start + sv.dur <= SNAPSHOT_MIN)) {
        const x = r(), canc = 0.085 - 0.02 * progress, ns = sv.kind === 'beauty' ? 0.05 : 0.03;
        status = x < canc ? 2 : x < canc + ns ? 3 : 0;
      } else status = r() < 0.04 ? 2 : 1;
      if (status !== 2) { taken.push([start, start + sv.dur]); busy.set(key, taken); }
      const pool = clients[p.id] || 0;
      const returning = pool > 3 && r() < 0.15 + 0.27 * progress ? 1 : 0;
      if (!returning) clients[p.id] = pool + 1;
      rows.push([d, start / 30, provIdx[p.id], svcIdx[sv.id], staffIdx[sf.id], mkt, status, returning]);
    }
  }
}
rows.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

const rating = id => { const rv = D.reviews.filter(x => x.providerId === id); return rv.length ? [+(rv.reduce((a, b) => a + b.rating, 0) / rv.length).toFixed(2), rv.length] : [null, 0]; };
const out = {
  meta: { generated: 'sample', launch: LAUNCH, asOf: AS_OF, snapshot: '13:00 IST', ahead: AHEAD, commission: COMMISSION, city: 'Thiruvananthapuram', phase: 'Phase 1' },
  areas: D.AREAS,
  categories: D.CATEGORIES.map(c => ({ id: c.id, name: c.name })),
  providers: D.providers.map(p => ({ id: p.id, name: p.name, type: p.type, area: p.area, medical: p.medical, live: LIVE[p.id], rating: rating(p.id) })),
  services: D.services.map(s => ({ name: s.name, p: provIdx[s.providerId], cat: s.cat, kind: s.kind, price: s.price, dur: s.dur })),
  staff: D.staff.map(s => ({ name: s.name, p: provIdx[s.providerId] })),
  bookings: { cols: ['day', 'slot30', 'provider', 'service', 'staff', 'marketplace', 'status', 'returning'], rows },
  queue: {
    applications: D.applications.filter(a => a.status !== 'approved').map(a => ({ id: a.id, name: a.name, type: a.type, area: a.area, medical: a.medical, status: a.status, submitted: a.submitted, docs: a.docs.length, note: a.notes.length ? a.notes[a.notes.length - 1].text : '' })),
    tickets: D.tickets.filter(t => t.status !== 'resolved').map(t => ({ id: t.id, type: t.type, status: t.status, created: t.created, provider: D.providers.find(p => p.id === t.providerId).name, service: t.service, amount: t.amount, reason: t.reason })),
  },
  cities: D.cities.map(c => ({ name: c.name, phase: c.phase, status: c.status, target: c.target, waitlist: c.waitlist, ready: Object.values(c.checks).filter(Boolean).length, checks: Object.keys(c.checks).length })),
};
fs.writeFileSync(path.join(root, 'dashboard/sample-data.json'), JSON.stringify(out));
const past = rows.filter(x => x[0] <= asOf);
console.log(`bookings: ${rows.length} (${past.length} up to ${AS_OF}, ${rows.length - past.length} ahead)`);
