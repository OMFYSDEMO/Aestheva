// Service guide pages: "Teeth cleaning in Trivandrum", with live places, full prices and plain answers.
import { SERVICE_AREA } from "../config";
import type { Topic } from "../content/topics";
import { fmtTime, relDay } from "../domain/time";
import type { ProviderRow, ServiceRow } from "../services/catalog";
import { MED_NOTE, catTile, esc, ic, inr, venueThumb } from "./ui";

export interface TopicRow { p: ProviderRow; s: ServiceRow; next?: { date: string; min: number } }

const range = (rows: TopicRow[]) => {
  const ps = rows.map((r) => r.s.price_paise);
  const lo = Math.min(...ps), hi = Math.max(...ps);
  return lo === hi ? inr(lo) : `${inr(lo)} to ${inr(hi)}`;
};

export function topicPage(d: { t: Topic; rows: TopicRow[]; related: Topic[]; today: string }) {
  const { t, rows } = d;
  const where = SERVICE_AREA.short;
  const areas = [...new Set(rows.map((r) => r.p.area))];
  const durs = [...new Set(rows.map((r) => r.s.dur_min))].sort((a, b) => a - b);
  return `<div class="page topic" style="padding-top:0">
  <section class="story-hero topic-hero">
    <div>
      <a class="btn btn-g btn-s" href="/trivandrum" style="margin-left:-10px">${ic("chevL", 16)} Service guides</a>
      <div class="row mt12" style="gap:12px">${catTile(t.cat, 22)}<div class="eyebrow">${esc(SERVICE_AREA.name)} (${esc(where)})</div></div>
      <h1 class="mt12">${esc(t.name)} in ${esc(where)}</h1>
      ${rows.length ? `<p class="lede mt16">Compare ${rows.length} ${t.name.toLowerCase()} option${rows.length === 1 ? "" : "s"}${t.alt ? ` (${esc(t.alt)})` : ""} in ${esc(areas.join(", "))}, with full prices from ${range(rows)}. See the next free time and book online in a minute.</p>`
        : `<p class="lede mt16">No one on Aestheva offers ${esc(t.name.toLowerCase())} in ${esc(where)} yet. We're adding salons, studios, clinics and independent professionals every week.</p>`}
      <div class="row wrap mt24" style="gap:10px">${rows.length ? `<a class="btn btn-p" href="#book">See prices and times</a>` : `<a class="btn btn-p" href="/search">Explore what's bookable now</a>`}<a class="btn btn-o" href="/for-practitioners">Offer ${esc(t.name.toLowerCase())}? List your business</a></div>
    </div>
    ${rows.length ? `<aside class="story-facts" aria-label="${esc(t.name)} at a glance">
      <div><b>Price</b><span>${range(rows)}, shown in full before you book</span></div>
      <div><b>Time</b><span>${durs.length > 1 ? `${durs[0]} to ${durs[durs.length - 1]}` : durs[0]} minutes</span></div>
      <div><b>Where</b><span>${esc(areas.join(", "))}</span></div>
      <div><b>Who</b><span>${t.medical ? (t.cat === "dental" ? "Registered dentists" : "Registered doctors") : "Salons, studios and independent professionals"}</span></div>
    </aside>` : ""}
  </section>

  ${rows.length ? `<section class="mt48" id="book"><h2>Where to book ${esc(t.name.toLowerCase())} in ${esc(where)}</h2>
    ${t.medical ? `<div class="mt16">${MED_NOTE}</div>` : ""}
    <div class="topic-rows mt16">${rows.map((r) => `<div class="topic-row">
      <a class="row grow" style="gap:12px;min-width:0;text-decoration:none;color:inherit" href="/p/${esc(r.p.slug)}">${venueThumb(r.p, "s")}<span class="col" style="gap:1px;min-width:0"><b>${esc(r.s.name)}</b><span class="small muted">${esc(r.p.name)} · ${esc(r.p.area)}</span></span></a>
      <span class="small muted nowrap">${r.s.dur_min} min</span>
      <b class="nowrap">${inr(r.s.price_paise)}</b>
      <span class="small nowrap" style="color:var(--sage-d);font-weight:600">${r.next ? `${ic("clock", 13)} ${relDay(r.next.date, d.today)}, ${fmtTime(r.next.min)}` : "Fully booked"}</span>
      <a class="btn btn-p btn-s" href="/book/${esc(r.p.slug)}?service=${encodeURIComponent(r.s.id)}" aria-label="Book ${esc(r.s.name)} at ${esc(r.p.name)}">Book</a>
    </div>`).join("")}</div>
    <p class="xs muted mt12">Prices are set by each business and shown in full. ${rows.some((r) => r.s.deposit_paise) ? "Some take a small deposit when you book." : "Nothing to pay online: you pay on the day."}</p>
  </section>` : ""}

  <section class="story-two mt64">
    <div><h2>What is ${esc(t.name.toLowerCase())}?</h2><p class="mt12">${esc(t.what)}</p>${t.medical ? `<p class="mt12 small muted">This is a medical treatment. The doctor or dentist decides at your appointment whether it suits you. Results vary from person to person.</p>` : ""}</div>
    <div><h2>What to expect</h2><ol class="join-steps">${t.expect.map((x, i) => `<li><span>${i + 1}</span><div><p style="color:var(--charcoal);margin:3px 0 0">${esc(x)}</p></div></li>`).join("")}</ol></div>
  </section>

  <section class="mt64"><h2>Questions people ask</h2>
    <div class="faq mt16">${t.faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
  </section>

  ${d.related.length ? `<section class="mt64"><h2>Related in ${esc(where)}</h2><div class="tile-grid mt16">${d.related.map((r) => `<a class="tile" href="/trivandrum/${r.slug}">${catTile(r.cat, 20)}<b>${esc(r.name)}</b></a>`).join("")}</div></section>` : ""}
  </div>`;
}

export function topicIndexPage(d: { live: { t: Topic; n: number; from: number }[]; soon: Topic[] }) {
  const where = SERVICE_AREA.short;
  return `<div class="page" style="padding-top:0">
  <section class="story-hero"><div>
    <div class="eyebrow">Service guides</div>
    <h1 class="mt12">Beauty, wellness and care in ${esc(where)}: prices and where to book</h1>
    <p class="lede mt16">Plain guides to what people book most in ${esc(SERVICE_AREA.name)}, with real, full prices from the places that offer them and the next free time.</p>
  </div></section>
  ${d.live.length ? `<section class="mt48"><h2>Bookable now</h2><div class="tile-grid mt16">${d.live.map(({ t, n, from }) => `<a class="tile" href="/trivandrum/${t.slug}">${catTile(t.cat, 22)}<span class="col" style="gap:1px;min-width:0"><b>${esc(t.name)}</b><span class="xs muted">${n} option${n === 1 ? "" : "s"} · from ${inr(from)}</span></span></a>`).join("")}</div></section>` : ""}
  ${d.soon.length ? `<section class="mt48"><h2>Coming soon</h2><p class="muted mt8">We're adding businesses for these. Offer one? <a href="/for-practitioners">List your business</a>.</p><div class="tile-grid mt16">${d.soon.map((t) => `<a class="tile" href="/trivandrum/${t.slug}">${catTile(t.cat, 20)}<b>${esc(t.name)}</b></a>`).join("")}</div></section>` : ""}
  </div>`;
}
