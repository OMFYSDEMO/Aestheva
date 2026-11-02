// Where a business application came from, without cookies or trackers.
// An ad click lands with ?gclid=… (Google adds it) and any utm_… tags we put on our own links. The business pages carry those
// on their links to the application form, the form keeps them in a hidden field, and they are saved with the application.
// The team sees them per application and per campaign, and downloads the Google Ads click IDs as offline conversions.
// Click IDs are wiped after 90 days, which is as long as Google accepts them; campaign names (not personal) stay.

export const CLICK_KEYS = ["gclid", "gbraid", "wbraid"] as const;
export const TAG_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const KEYS = [...CLICK_KEYS, ...TAG_KEYS] as const;
export type AdSource = Partial<Record<(typeof KEYS)[number] | "from", string>>;

const CLICK = /^[A-Za-z0-9_-]{8,200}$/;
const TAG = /^[\p{L}\p{N} _.+\-|:/()&']{1,100}$/u;
const PATH = /^\/[a-z0-9/-]{0,80}$/;
export const CLICK_ID_DAYS = 90;

/** The trusted subset of a query string or a stored hidden field. `landing` is used as `from` when none came with it. */
export function readSource(q: URLSearchParams | Record<string, string | undefined>, landing?: string): AdSource {
  const get = (k: string) => (q instanceof URLSearchParams ? q.get(k) : q[k]) ?? "";
  const s: AdSource = {};
  for (const k of CLICK_KEYS) { const v = get(k).trim(); if (CLICK.test(v)) s[k] = v; }
  for (const k of TAG_KEYS) { const v = get(k).trim(); if (TAG.test(v)) s[k] = v; }
  const from = [get("from").trim(), landing ?? ""].find((p) => PATH.test(p));
  if (from) s.from = from;
  return s;
}

export const sourceQuery = (s: AdSource) => new URLSearchParams(s as Record<string, string>).toString();

/** Adds the visitor's ad source to every link into the business pages and the application form in a page body. */
// Without an ad or tag, only the form links get the landing page, so the pages Google crawls keep their plain addresses.
export function carrySource(html: string, s: AdSource) {
  if (!Object.keys(s).length) return html;
  const tagged = Object.keys(s).some((k) => k !== "from");
  return html.replace(/href="(\/for-practitioners[a-z0-9/-]*)(\?[^"#]*)?(#[^"]*)?"/g, (m, path: string, qs = "", hash = "") => {
    if (!tagged && path !== "/for-practitioners/apply") return m;
    const p = new URLSearchParams(qs.replace(/&amp;/g, "&").slice(1));
    for (const [k, v] of Object.entries(s)) if (!p.has(k)) p.set(k, v!);
    return `href="${path}?${p.toString().replace(/&/g, "&amp;")}${hash}"`;
  });
}

/** What's stored on the application: JSON, or '' when nothing is known. */
export const sourceJson = (s: AdSource) => (Object.keys(s).length ? JSON.stringify(s) : "");
export function parseSource(json: string): AdSource {
  try { const v = JSON.parse(json || "{}"); return v && typeof v === "object" ? (v as AdSource) : {}; } catch { return {}; }
}

/** One line for the team: "Google Ads · salons-tvm · from /for-practitioners/salons". */
export function describeSource(s: AdSource) {
  const paid = s.gclid || s.gbraid || s.wbraid;
  const who = paid ? "Google Ads" : s.utm_source ? [s.utm_source, s.utm_medium].filter(Boolean).join(" / ") : "";
  return [who, s.utm_campaign, s.utm_term && `“${s.utm_term}”`, s.from && `landed on ${s.from}`].filter(Boolean).join(" · ");
}

/** The group an application counts under in the campaign report. */
export function sourceGroup(s: AdSource) {
  if (s.gclid || s.gbraid || s.wbraid || ((s.utm_source ?? "").toLowerCase() === "google" && /cpc|paid|ads?/i.test(s.utm_medium ?? "")))
    return `Google Ads${s.utm_campaign ? ` · ${s.utm_campaign}` : ""}`;
  if (s.utm_source) return [s.utm_source, s.utm_medium, s.utm_campaign].filter(Boolean).join(" · ");
  return "No ad or tagged link";
}

/** Removes click IDs older than 90 days; keeps campaign names and landing pages. */
export async function pruneClickIds(db: D1Database) {
  const r = await db.prepare(`UPDATE applications SET ad_source = json_remove(ad_source, '$.gclid', '$.gbraid', '$.wbraid')
    WHERE ad_source <> '' AND (json_extract(ad_source, '$.gclid') IS NOT NULL OR json_extract(ad_source, '$.gbraid') IS NOT NULL OR json_extract(ad_source, '$.wbraid') IS NOT NULL)
    AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${CLICK_ID_DAYS} days')`).run();
  return r.meta.changes;
}

export const CONVERSIONS = { applied: "Aestheva business application", live: "Aestheva business went live" } as const;

/** "2026-11-02 14:05:09" in India time, for the upload file's Asia/Calcutta time zone. */
const ist = (iso: string) => new Date(Date.parse(iso) + 330 * 60e3).toISOString().slice(0, 19).replace("T", " ");

/**
 * Google Ads offline conversions (Goals > Conversions > Uploads), one row per conversion with a Google click ID:
 * the application, and the day that business went live. Create two conversion actions in Google Ads with exactly these names
 * (source "Import", "Track conversions from clicks") before the first upload.
 */
export async function conversionsCsv(db: D1Database) {
  const rows = (await db.prepare(`SELECT a.ad_source, a.created_at, a.provider_id,
      (SELECT MIN(l.at) FROM audit_log l WHERE l.action = 'provider.live' AND l.entity_id = a.provider_id) AS live_at
    FROM applications a WHERE a.ad_source <> '' AND json_extract(a.ad_source, '$.gclid') IS NOT NULL ORDER BY a.created_at`)
    .all<{ ad_source: string; created_at: string; provider_id: string | null; live_at: string | null }>()).results;
  const lines = ["Parameters:TimeZone=Asia/Calcutta", "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency"];
  for (const r of rows) {
    const g = parseSource(r.ad_source).gclid!;
    lines.push(`${g},${CONVERSIONS.applied},${ist(r.created_at)},,INR`);
    if (r.live_at) lines.push(`${g},${CONVERSIONS.live},${ist(r.live_at)},,INR`);
  }
  return lines.join("\n") + "\n";
}

/** Applications and businesses gone live, per campaign or source. */
export async function sourceReport(db: D1Database) {
  const rows = (await db.prepare(`SELECT a.ad_source, a.status, a.created_at,
      (SELECT p.status FROM providers p WHERE p.id = a.provider_id) AS provider_status FROM applications a ORDER BY a.created_at DESC`)
    .all<{ ad_source: string; status: string; created_at: string; provider_status: string | null }>()).results;
  const groups = new Map<string, { group: string; applied: number; approved: number; live: number; landings: Map<string, number>; last: string }>();
  for (const r of rows) {
    const s = parseSource(r.ad_source), key = sourceGroup(s);
    const g = groups.get(key) ?? { group: key, applied: 0, approved: 0, live: 0, landings: new Map(), last: r.created_at };
    g.applied++;
    if (r.status === "approved") g.approved++;
    if (r.provider_status === "live") g.live++;
    if (s.from) g.landings.set(s.from, (g.landings.get(s.from) ?? 0) + 1);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.applied - a.applied);
}
