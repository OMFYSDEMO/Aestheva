// Visual building blocks shared by every page. Ported from the prototype (prototype/core.js) so the site keeps its look.
import { inr } from "../domain/money";

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export { inr };

export function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const PAL: string[][] = [
  ['#F3E5E8','#E8CDD4','#C58F9D','#713F54'], ['#E5EBE5','#CBD8CC','#93A898','#4C6352'],
  ['#F7EEE8','#ECD8CB','#C9A08B','#7A4E3E'], ['#F1E9EF','#DFCCDC','#AC8EA9','#5E3F5C'],
  ['#FBF2F1','#F2D6D5','#D99C9E','#8B4A55'], ['#E7EEEA','#CFDDD5','#91B1A2','#3F5E54'],
  ['#F5F1EB','#E5DCCF','#BBA98F','#6B5A45'], ['#EFE7E4','#D8C8C2','#A0867F','#4A3A37']];
export function art(seed: string, idx?: number): string {
  const r = rng(hash(String(seed)));
  const p = PAL[(idx ?? Math.floor(r()*PAL.length)) % PAL.length];
  const sx = 60 + r()*280, sy = 40 + r()*80, sr = 50 + r()*50;
  const ax = 120 + r()*160, aw = 110 + r()*40;
  const leaf = (x: number, y: number, rot: number, s: number, c: string, o: number) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" opacity="${o}"><path d="M0 0 C 28 -40 28 -100 0 -150 C -28 -100 -28 -40 0 0Z" fill="${c}"/><path d="M0 -4 L0 -146" stroke="${p[0]}" stroke-width="1.4" opacity=".55"/>${[30,60,90,115].map(k=>`<path d="M0 -${k} l14 -16 M0 -${k} l-14 -16" stroke="${p[0]}" stroke-width="1" opacity=".45"/>`).join('')}</g>`;
  const lotus = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${p[3]}" stroke-width="1.6" opacity=".55"><path d="M0 0 C -10 -18 -10 -34 0 -48 C 10 -34 10 -18 0 0Z"/><path d="M0 0 C -22 -8 -32 -24 -32 -38 C -16 -34 -6 -20 0 0Z"/><path d="M0 0 C 22 -8 32 -24 32 -38 C 16 -34 6 -20 0 0Z"/></g>`;
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="400" height="300" fill="${p[0]}"/>
    <circle cx="${sx}" cy="${sy}" r="${sr}" fill="${p[1]}" opacity=".9"/>
    <path d="M${ax-aw/2} 300 V${170} A${aw/2} ${aw/2} 0 0 1 ${ax+aw/2} 170 V300Z" fill="${p[1]}"/>
    <path d="M${ax-aw/2+14} 300 V${176} A${aw/2-14} ${aw/2-14} 0 0 1 ${ax+aw/2-14} 176 V300Z" fill="none" stroke="${p[2]}" stroke-width="1.2" opacity=".7"/>
    ${leaf(30+r()*60, 320, -25+r()*20, .9+r()*.5, p[2], .55)}
    ${leaf(330+r()*50, 330, 15+r()*20, 1+r()*.5, p[3], .35)}
    ${leaf(260+r()*40, 320, -8, .7, p[2], .4)}
    ${lotus(ax, 262, 1.1)}
    <rect y="286" width="400" height="5" fill="#B99657" opacity=".55"/><rect y="294" width="400" height="2" fill="#B99657" opacity=".45"/>
  </svg>`;
}
export const artBox = (seed: string, idx?: number, cls = "", style = "") => `<div class="art ${cls}" style="${style}">${art(seed, idx)}</div>`;

export function avatar(name: string, size = 44, seed?: string, photo?: string) {
  // A real photo when there is one: square WebP at 160 and 320 pixels, shown as a circle.
  if (photo) return `<img class="avatar avatar-photo" src="${esc(photo)}-160.webp" srcset="${esc(photo)}-160.webp 1x, ${esc(photo)}-320.webp 2x" width="${size}" height="${size}" alt="" loading="lazy" decoding="async" style="width:${size}px;height:${size}px">`;
  const p = PAL[hash(seed || name) % PAL.length];
  const ini = name.replace(/^Dr\.\s*/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("");
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${p[0]};color:${p[3]};font-size:${size * 0.4}px;border:1px solid ${p[1]}" aria-hidden="true">${esc(ini)}</div>`;
}

const ICONS: Record<string, string> = {
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', pin:'<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  heart:'<path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 4 4 7.2 4c2 0 3.4 1.1 4.8 2.8C13.4 5.1 14.8 4 16.8 4 20 4 22.4 7.2 21.2 10.6 19.5 15.4 12 20 12 20z"/>',
  star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  shield:'<path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.1"/>',
  cal:'<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>', users:'<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c.9-3.2 3.4-4.8 6.5-4.8s5.6 1.6 6.5 4.8"/><path d="M15.5 5.3a3.5 3.5 0 0 1 0 6.4M17.5 14.9c2 .6 3.4 2.1 4 4.6"/>',
  home:'<path d="M4 11 12 4l8 7v9h-5.5v-6h-5v6H4z"/>', grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  wallet:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14.5h2"/>', doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  inbox:'<path d="M4 13 6.5 5h11L20 13v6H4z"/><path d="M4 13h4.5l1 2.5h5l1-2.5H20"/>', chart:'<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  map:'<path d="m9 4-5.5 2v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>', alert:'<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>', chevL:'<path d="m15 5-7 7 7 7"/>', chevR:'<path d="m9 5 7 7-7 7"/>', plus:'<path d="M12 5v14M5 12h14"/>',
  filter:'<path d="M4 6h16M7 12h10M10 18h4"/>', leaf:'<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19 13 11"/>', sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>', card:'<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18"/>', refresh:'<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
  out:'<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  tooth:'<path d="M7.5 4C5 4 3.8 6.2 4.3 9c.4 2.2 1.3 3.6 1.7 6 .4 2.6.8 5 2.2 5 1.6 0 1.6-4.5 3.8-4.5s2.2 4.5 3.8 4.5c1.4 0 1.8-2.4 2.2-5 .4-2.4 1.3-3.8 1.7-6C20.2 6.2 19 4 16.5 4c-1.8 0-2.7 1-4.5 1S9.3 4 7.5 4z"/>',
  drop:'<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  comb:'<path d="M4 7.5h16v3.5H4z"/><path d="M6.5 11v6M9.5 11v6M12.5 11v6M15.5 11v6M18.5 11v4"/>',
  hand:'<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-2.6 0-4.2-1.4-5.5-3.6L4 14.5a1.4 1.4 0 0 1 2.3-1.6L8 15"/>',
  body:'<circle cx="12" cy="5" r="2"/><path d="M12 7.5V14M7.5 10.5 12 8.5l4.5 2M9 21l3-7 3 7"/>',
  brush:'<path d="M14.5 3.5 20.5 9.5 12 18H6v-6z"/><path d="M6 18l-2.5 2.5M11 7l6 6"/>',
  needle:'<path d="M17 3l4 4-9.5 9.5-4-4z"/><path d="M7.5 12.5 4 20l7.5-3.5M14.5 5.5l4 4"/>',
  phone:'<path d="M5 4h3.5l2 5-2.4 1.5a11 11 0 0 0 4.9 4.9L14.5 13l5 2v3.5a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 7 8.5-7"/>',
  arrowR:'<path d="M5 12h14M13 6l6 6-6 6"/>', nav:'<path d="M3.5 11 20.5 3.5 13 20.5l-2-7.5z"/>',
  chat:'<path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z"/>', receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'
};
export const ic = (n: string, s = 18, extra = "") => `<svg ${extra} width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;
export const stars = (v: number, n?: number) => `<span class="stars">${ic("star", 14, 'fill="currentColor"')} ${v.toFixed(1)}${n != null ? ` <span class="muted" style="font-weight:500">(${n})</span>` : ""}<span class="sr"> out of 5 from ${n} reviews</span></span>`;
export const kindBadge = (s: { kind: string }) => s.kind === "beauty" ? `<span class="badge b-beauty">${ic("leaf", 12)} Beauty &amp; wellness</span>`
  : s.kind === "consult" ? `<span class="badge b-med">${ic("shield", 12)} Medical consultation</span>`
  : `<span class="badge b-med">${ic("shield", 12)} Medical · prior assessment required</span>`;
export const MED_NOTE = `<div class="note n-med">${ic("info", 16)}<div><b>Medical services:</b> booking reserves time with a registered practitioner. Your suitability for any treatment is decided at assessment. A booking doesn't mean a treatment is right for you.</div></div>`;


/** Icon and one-line introduction for each treatment category. Written to hold for any venue in the category. */
export const CAT_META: Record<string, { icon: string; line: string; tone?: string }> = {
  dental: { icon: "tooth", line: "Cleaning, fillings and brightening with a registered dentist.", tone: "#8ED3C3" },
  skin: { icon: "drop", line: "Facials, peels and skin care, planned around your skin.", tone: "#F5A3B7" },
  medaes: { icon: "sparkle", line: "Doctor-led treatments, from laser hair reduction to mesotherapy.", tone: "#D7A6DA" },
  hair: { icon: "comb", line: "Cuts, colour, styling, and hair-fall and scalp care.", tone: "#7FC4CF" },
  ayur: { icon: "leaf", line: "Abhyanga, Shirodhara and Kerala's own therapies.", tone: "#A3CE7F" },
  nails: { icon: "hand", line: "Manicures, nail art, lashes and brows.", tone: "#FFB48F" },
  body: { icon: "body", line: "Massage, physiotherapy and body care.", tone: "#93B9EA" },
  groom: { icon: "brush", line: "Bridal and party makeup, styling and grooming.", tone: "#EDC06A" },
  tattoo: { icon: "needle", line: "Custom tattoos, cover-ups and piercing, with clean single-use kit.", tone: "#A795E3" },
};
export const catIcon = (id: string, s = 20) => ic(CAT_META[id]?.icon ?? "sparkle", s);
/** A category's icon on its own colour square, like a shop sign. */
export const catTile = (id: string, s = 20) => `<span class="ctile" style="--tone:${CAT_META[id]?.tone ?? "#F5A3B7"}" aria-hidden="true">${catIcon(id, s)}</span>`;

/** A venue's mark until it has photographs: its initials on a soft colour from the prototype palette. */
export function venueMark(name: string, seed: string, idx?: number, size: "s" | "m" | "l" = "m") {
  const p = PAL[(idx ?? hash(seed)) % PAL.length];
  const ini = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return `<div class="vmark vmark-${size}" style="--v0:${p[0]};--v1:${p[1]};--v2:${p[2]};--v3:${p[3]}" aria-hidden="true"><span>${esc(ini)}</span></div>`;
}

/** Turns Indian phone numbers inside plain text into tap-to-call links. Escapes everything else. */
export function linkPhones(text: string) {
  return esc(text).replace(/(\+91[\s-]?\d{5}[\s-]?\d{5})/g, (m) => `<a href="tel:${m.replace(/[\s-]/g, "")}">${m}</a>`);
}

export const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export interface Photo { src: string; alt: string }
/** A venue's photographs (see migrations/0003). Each src has -400/-800/-1500.webp and -og.jpg variants: in public/ for
 * /venues/..., or in the MEDIA bucket for /media/... (uploaded by clinics in the portal). */
export function photosOf(p: { photos_json?: string | null }): Photo[] {
  try {
    const x = JSON.parse(p.photos_json || "[]");
    return Array.isArray(x) ? x.filter((ph) => typeof ph?.src === "string" && /^\/(venues|media)\/[a-z0-9-]+\/[a-z0-9-]+$/.test(ph.src)).map((ph) => ({ src: ph.src, alt: String(ph.alt ?? "") })) : [];
  } catch { return []; }
}
export function photoImg(ph: Photo, sizes: string, opts: { eager?: boolean; decorative?: boolean } = {}) {
  const set = [400, 800, 1500].map((w) => `${esc(ph.src)}-${w}.webp ${w}w`).join(", ");
  return `<img src="${esc(ph.src)}-800.webp" srcset="${set}" sizes="${sizes}" alt="${opts.decorative ? "" : esc(ph.alt)}" ${opts.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}
/** A venue's small square image: its first photo when it has one, otherwise its mark. */
export function venueThumb(p: { name: string; id: string; art: number; photos_json?: string | null }, size: "s" | "m" | "l" = "m") {
  const ph = photosOf(p)[0];
  return ph ? `<div class="vmark vmark-${size} vthumb" aria-hidden="true">${photoImg(ph, { s: "42px", m: "72px", l: "104px" }[size], { decorative: true })}</div>` : venueMark(p.name, p.id, p.art, size);
}
