// Turns a venue file (providers/<venue>.json) into SQL that adds or updates that venue in D1.
// Until an operations console exists, this is how venues are onboarded.
//
//   node scripts/provider-sql.mjs providers/hasta-wellness.json --check     list what is still missing
//   node scripts/provider-sql.mjs providers/hasta-wellness.json > /tmp/v.sql
//   npx wrangler d1 execute aestheva --remote --file=/tmp/v.sql
//
// Re-running it is safe: rows are upserted, services and staff removed from the file are deactivated
// (never deleted, because bookings point at them), and rotas, service links and verifications are replaced.
// Prices and deposits in the file are rupees; the database stores paise.
import fs from 'node:fs';

// The localities list lives in src/config.ts; read the names from there so the two never drift.
const AREAS = [...fs.readFileSync(new URL('../src/config.ts', import.meta.url), 'utf8').matchAll(/\{ name: "([^"]+)", zone:/g)].map((m) => m[1]);
const TYPES = ['Clinic', 'Salon & studio', 'Wellness centre', 'Independent practitioner'];
const CATS = ['skin', 'medaes', 'hair', 'ayur', 'nails', 'body', 'dental', 'groom'];
const KINDS = ['consult', 'treatment', 'beauty'];
const DAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const [file, ...flags] = process.argv.slice(2);
if (!file) { console.error('usage: node scripts/provider-sql.mjs providers/<venue>.json [--check]'); process.exit(2); }
const v = JSON.parse(fs.readFileSync(file, 'utf8'));

const problems = [];
const walk = (x, path) => {
  if (typeof x === 'string' && /\bTODO\b/.test(x)) problems.push(`${path}: ${x}`);
  else if (Array.isArray(x)) x.forEach((y, i) => walk(y, `${path}[${i}]`));
  else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) if (k !== '_about') walk(y, path ? `${path}.${k}` : k);
};
walk(v, '');
const need = (ok, msg) => { if (!ok) problems.push(msg); };
need(/^[a-z0-9-]+$/.test(v.id ?? ''), 'id: lowercase letters, digits and hyphens');
need(/^[a-z0-9-]+$/.test(v.slug ?? ''), 'slug: lowercase letters, digits and hyphens');
need(TYPES.includes(v.type), `type: one of ${TYPES.join(', ')}`);
need(AREAS.includes(v.area), `area: one of ${AREAS.join(', ')}`);
need(['draft', 'live', 'paused'].includes(v.status), 'status: draft, live or paused');
const staffIds = new Set((v.staff ?? []).map((s) => s.id));
const resourceIds = new Set((v.resources ?? []).map((r) => r.id));
// Photos: {"src": "/venues/<venue>/<name>", "alt": "..."}; the -400/-800/-1500.webp and -og.jpg (1200x630) files must exist in public/.
for (const ph of v.photos ?? []) {
  need(/^\/venues\/[a-z0-9-]+\/[a-z0-9-]+$/.test(ph.src ?? '') && (ph.alt ?? '').length > 10, `photo ${ph.src}: needs a src like /venues/${v.id}/reception and a descriptive alt text`);
  for (const f of ['-400.webp', '-800.webp', '-1500.webp', '-og.jpg']) need(fs.existsSync(`public${ph.src}${f}`), `photo ${ph.src}: public${ph.src}${f} is missing`);
}
for (const r of v.resources ?? []) need(/^[a-z0-9-]+$/.test(r.id ?? '') && r.name, `resource ${r.id}: needs an id (lowercase, hyphens) and a name`);
const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t); return m ? +m[1] * 60 + +m[2] : NaN; };
const rota = (s) => {
  const out = new Map();
  for (const [key, span] of Object.entries(s.hours ?? {})) {
    const [a, b] = String(span).split('-').map(toMin);
    const [d1, d2] = key.split('-');
    if (!(d1 in DAYS) || (d2 && !(d2 in DAYS)) || !(b > a)) { problems.push(`staff ${s.id}: hours "${key}": "${span}" is not like "mon-sat": "10:00-20:00"`); continue; }
    for (let d = DAYS[d1]; ; d = (d + 1) % 7) { out.set(d, [a, b]); if (d === DAYS[d2 ?? d1]) break; }
  }
  if (!out.size) problems.push(`staff ${s.id}: no working hours`);
  return out;
};
const rotas = new Map((v.staff ?? []).map((s) => [s.id, rota(s)]));
for (const s of v.services ?? []) {
  need(CATS.includes(s.cat), `service ${s.id}: cat must be one of ${CATS.join(', ')}`);
  if (!/\bTODO\b/.test(String(s.kind))) need(KINDS.includes(s.kind), `service ${s.id}: kind must be consult, treatment or beauty`);
  for (const k of ['dur', 'price', 'deposit']) if (!/\bTODO\b/.test(String(s[k]))) need(Number.isInteger(s[k]) && s[k] >= 0, `service ${s.id}: ${k} must be a whole number`);
  if (Number.isInteger(s.price) && Number.isInteger(s.deposit)) need(s.deposit <= s.price, `service ${s.id}: deposit is more than the price`);
  need((s.staff ?? []).length && s.staff.every((x) => staffIds.has(x)), `service ${s.id}: staff must list ids from "staff"`);
  need((s.resources ?? []).every((x) => resourceIds.has(x)), `service ${s.id}: resources must list ids from "resources"`);
}
need((v.services ?? []).length > 0, 'services: at least one');

if (flags.includes('--check') || problems.length) {
  if (problems.length) { console.error(`${file}: ${problems.length} item(s) to complete before this venue can be loaded:\n- ` + problems.join('\n- ')); process.exit(1); }
  console.error(`${file}: complete.`); process.exit(0);
}

const q = (x) => (x === null || x === undefined ? 'NULL' : typeof x === 'number' ? String(x) : `'${String(x).replace(/'/g, "''")}'`);
const sql = [`-- ${v.name}: generated by scripts/provider-sql.mjs from ${file}`];
sql.push(`INSERT INTO providers (id, slug, name, type, area, address, tagline, about, hours_text, amenities_json, photos_json, art, status, live_since)
VALUES (${[v.id, v.slug, v.name, v.type, v.area, v.address, v.tagline, v.about, v.hours_text, JSON.stringify(v.amenities ?? []), JSON.stringify((v.photos ?? []).map(({ src, alt }) => ({ src, alt }))), v.art ?? 0, v.status].map(q).join(', ')}, ${v.status === 'live' ? "date('now')" : 'NULL'})
ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name, type=excluded.type, area=excluded.area, address=excluded.address, tagline=excluded.tagline,
  about=excluded.about, hours_text=excluded.hours_text, amenities_json=excluded.amenities_json, photos_json=excluded.photos_json, art=excluded.art, status=excluded.status,
  live_since=COALESCE(providers.live_since, excluded.live_since);`);
sql.push(`DELETE FROM verifications WHERE provider_id = ${q(v.id)};`);
(v.verifications ?? []).forEach((x, i) => sql.push(`INSERT INTO verifications (provider_id, label, scope, checked_on, sort) VALUES (${[v.id, x.label, x.scope, x.checked_on, i].map(q).join(', ')});`));
for (const s of v.staff) {
  sql.push(`INSERT INTO staff (id, provider_id, name, role, medical, quals_json, registration, years, langs_json, bio, active)
VALUES (${[s.id, v.id, s.name, s.role, s.medical ? 1 : 0, JSON.stringify(s.quals ?? []), s.registration ?? '', s.years ?? 0, JSON.stringify(s.langs ?? []), s.bio ?? ''].map(q).join(', ')}, 1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name, role=excluded.role, medical=excluded.medical, quals_json=excluded.quals_json, registration=excluded.registration,
  years=excluded.years, langs_json=excluded.langs_json, bio=excluded.bio, active=1;`);
  sql.push(`DELETE FROM staff_hours WHERE staff_id = ${q(s.id)};`);
  for (const [dow, [a, b]] of rotas.get(s.id)) sql.push(`INSERT INTO staff_hours (staff_id, dow, start_min, end_min) VALUES (${q(s.id)}, ${dow}, ${a}, ${b});`);
}
for (const r of v.resources ?? []) sql.push(`INSERT INTO resources (id, provider_id, name, active) VALUES (${[r.id, v.id, r.name].map(q).join(', ')}, 1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name, active=1;`);
sql.push(`UPDATE resources SET active = 0 WHERE provider_id = ${q(v.id)}${(v.resources ?? []).length ? ` AND id NOT IN (${v.resources.map((r) => q(r.id)).join(', ')})` : ''};`);
sql.push(`UPDATE staff SET active = 0 WHERE provider_id = ${q(v.id)} AND id NOT IN (${v.staff.map((s) => q(s.id)).join(', ')});`);
v.services.forEach((s, i) => {
  sql.push(`INSERT INTO services (id, provider_id, name, cat, kind, dur_min, price_paise, deposit_paise, description, active, sort)
VALUES (${[s.id, v.id, s.name, s.cat, s.kind, s.dur, s.price * 100, s.deposit * 100, s.desc ?? '', 1, i].map(q).join(', ')})
ON CONFLICT(id) DO UPDATE SET name=excluded.name, cat=excluded.cat, kind=excluded.kind, dur_min=excluded.dur_min, price_paise=excluded.price_paise,
  deposit_paise=excluded.deposit_paise, description=excluded.description, active=1, sort=excluded.sort;`);
});
sql.push(`UPDATE services SET active = 0 WHERE provider_id = ${q(v.id)} AND id NOT IN (${v.services.map((s) => q(s.id)).join(', ')});`);
sql.push(`DELETE FROM service_staff WHERE service_id IN (SELECT id FROM services WHERE provider_id = ${q(v.id)});`);
for (const s of v.services) for (const t of s.staff) sql.push(`INSERT INTO service_staff (service_id, staff_id) VALUES (${q(s.id)}, ${q(t)});`);
sql.push(`DELETE FROM service_resources WHERE service_id IN (SELECT id FROM services WHERE provider_id = ${q(v.id)});`);
for (const s of v.services) for (const r of s.resources ?? []) sql.push(`INSERT INTO service_resources (service_id, resource_id) VALUES (${q(s.id)}, ${q(r)});`);
sql.push(`INSERT INTO audit_log (actor, action, entity, entity_id, data_json) VALUES ('ops:provider-sql', 'provider.loaded', 'provider', ${q(v.id)}, ${q(JSON.stringify({ file, status: v.status, services: v.services.length, staff: v.staff.length }))});`);
process.stdout.write(sql.join('\n') + '\n');
