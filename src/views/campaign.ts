// Seasonal banners. Each runs between its dates (India time) and disappears by itself afterwards.
import { inr } from "./ui";

export interface Campaign { id: string; from: string; until: string }   // inclusive ISO dates
export const CAMPAIGNS: Campaign[] = [
  { id: "deepavali-2026", from: "2026-10-30", until: "2026-11-09" },   // Deepavali is Sunday 8 November 2026
];
export const activeCampaign = (today: string) => CAMPAIGNS.find((c) => today >= c.from && today <= c.until) ?? null;

/** A diya in hairline strokes with a soft flame, matching the footer sketch. */
const DIYA = `<svg class="cb-diya" viewBox="0 0 86 70" fill="none" stroke="#F6D58E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M6 40c8 16 66 16 74 0"/><path d="M6 40c14 6 60 6 74 0"/><path d="M80 40c2-2 4-5 5-8-4 1-7 3-9 5"/><path d="M30 56c0 6 26 6 26 0"/>
  <path d="M43 34c-6-7-4-15 0-22 4 7 6 15 0 22z" fill="#FFB48F" fill-opacity=".85" stroke="#FFD27A"/><path d="M43 30c-2-3-1-6 0-9 1 3 2 6 0 9z" fill="#FFF3C4" stroke="none"/></svg>`;

const TONES = ["#F5A3B7", "#FFB48F", "#EDC06A", "#8ED3C3", "#A795E3"];

/** A rangoli rosette: rings of coloured dots around gold petals. */
function rangoli(r = 90) {
  let g = "";
  for (let ring = 0; ring < 4; ring++) {
    const n = 8 + ring * 8, rr = 14 + ring * 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g += `<circle cx="${(r + rr * Math.cos(a)).toFixed(1)}" cy="${(r + rr * Math.sin(a)).toFixed(1)}" r="${(2.6 - ring * 0.35).toFixed(2)}" fill="${TONES[(i + ring) % TONES.length]}"/>`;
    }
  }
  for (let i = 0; i < 8; i++) g += `<ellipse cx="${r}" cy="${r - 8}" rx="3.5" ry="8" fill="none" stroke="#F6D58E" stroke-width="1.2" transform="rotate(${i * 45} ${r} ${r})"/>`;
  return `<svg class="cb-rangoli" viewBox="0 0 ${r * 2} ${r * 2}" aria-hidden="true">${g}<circle cx="${r}" cy="${r}" r="3" fill="#F6D58E"/></svg>`;
}

/** Festive confetti, the same on every load (a fixed seed), so the banner never jumps around. */
function confetti(n = 70, w = 1200, h = 200, seed = 3) {
  let s = seed;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  let o = "";
  for (let i = 0; i < n; i++) o += `<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * h).toFixed(0)}" r="${(1 + rnd() * 2.4).toFixed(1)}" fill="${[...TONES, "#F6D58E"][i % 6]}" opacity="${(0.35 + rnd() * 0.45).toFixed(2)}"/>`;
  return `<svg class="cb-confetti" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${o}</svg>`;
}

/**
 * The current seasonal banner, or nothing. `welcome` is the welcome offer in paise (0 hides that line).
 * `beauty` says whether any non-medical service is bookable: festive wording names facials, nails and makeup only when
 * someone offers them, and never promotes medical treatments.
 */
export function campaignBanner(today: string, welcome = 0, compact = false, beauty = false) {
  const c = activeCampaign(today);
  if (!c || c.id !== "deepavali-2026") return "";
  return `<aside class="campaign${compact ? " campaign-compact" : ""}" aria-label="Deepavali">
    ${confetti()}${DIYA}
    <div class="cb-text"><div class="cb-eyebrow">Deepavali · Sunday 8 November</div>
      <h2>Glow for Deepavali.</h2>
      ${compact ? "" : beauty ? `<p>Facials, nails, mehendi-ready hands, makeup and hair across Trivandrum, booked in a minute before the lamps are lit.</p>`
        : `<p>Get your festive appointments booked before the lamps are lit: full prices, real free times and booking in a minute, across Trivandrum.</p>`}</div>
    <div class="cb-cta"><a class="btn btn-light" href="${beauty ? "/search?kind=beauty" : "/search"}">Find a festive slot →</a>${welcome ? `<span class="cb-offer">New here? ${inr(welcome)} off your first deposit</span>` : ""}</div>
    ${compact ? "" : rangoli()}
  </aside>`;
}
