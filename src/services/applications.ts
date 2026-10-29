import { AREAS, VENUE_TYPES } from "../config";
import type { Env } from "../env";
import { HttpError, audit, newId, newRef, sha256Hex } from "../db";
import { normalisePhone } from "./bookings";

export const ROLES = ["Owner", "Manager", "Practitioner", "Other"] as const;
export const APP_STATUSES = ["new", "reviewing", "approved", "declined"] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export interface ApplicationRow {
  id: string; ref: string; status: AppStatus; business_name: string; business_type: string; area: string; address: string; website: string;
  contact_name: string; contact_role: string; phone: string; email: string; categories_json: string; medical: number; team_size: number;
  services_text: string; establishment_reg: string; practitioner_reg: string; gstin: string; heard_from: string; team_notes: string;
  created_at: string; updated_at: string;
}

/** What the applicant typed, kept as strings so the form can be shown again with their answers. */
export type ApplicationForm = Record<string, string | string[]>;
export interface CleanApplication {
  business_name: string; business_type: string; area: string; address: string; website: string; contact_name: string; contact_role: string;
  phone: string; email: string; categories: string[]; medical: boolean; team_size: number; services_text: string;
  establishment_reg: string; practitioner_reg: string; gstin: string; heard_from: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const str = (f: ApplicationForm, k: string) => String(Array.isArray(f[k]) ? f[k][0] : f[k] ?? "").trim();
const list = (f: ApplicationForm, k: string) => (Array.isArray(f[k]) ? f[k] : f[k] ? [f[k] as string] : []).map(String);

/** Checks an application. Returns the cleaned values, or a message per field that needs attention. */
export function validateApplication(f: ApplicationForm, categoryIds: string[]): { ok: true; value: CleanApplication } | { ok: false; errors: Record<string, string> } {
  const e: Record<string, string> = {};
  const v = {
    business_name: str(f, "business_name"), business_type: str(f, "business_type"), area: str(f, "area"), area_other: str(f, "area_other"),
    address: str(f, "address"), website: str(f, "website"), contact_name: str(f, "contact_name"), contact_role: str(f, "contact_role"),
    phone: str(f, "phone"), email: str(f, "email").toLowerCase(), categories: [...new Set(list(f, "categories"))], medical: str(f, "medical"),
    team_size: str(f, "team_size"), services_text: str(f, "services_text"), establishment_reg: str(f, "establishment_reg"),
    practitioner_reg: str(f, "practitioner_reg"), gstin: str(f, "gstin").toUpperCase().replace(/\s/g, ""), heard_from: str(f, "heard_from"),
  };
  if (v.business_name.length < 2 || v.business_name.length > 120) e.business_name = "Please enter the name of your clinic, salon or practice.";
  if (!(VENUE_TYPES as readonly string[]).includes(v.business_type)) e.business_type = "Please choose what kind of business it is.";
  if (v.area === "Other") { if (v.area_other.length < 2 || v.area_other.length > 60) e.area_other = "Please tell us the area."; }
  else if (!(AREAS as readonly string[]).includes(v.area)) e.area = "Please choose an area.";
  if (v.address.length < 10 || v.address.length > 300) e.address = "Please enter the full address, with the PIN code.";
  if (v.website.length > 200) e.website = "That link is too long.";
  if (v.contact_name.length < 2 || v.contact_name.length > 80) e.contact_name = "Please enter your full name.";
  if (!(ROLES as readonly string[]).includes(v.contact_role)) e.contact_role = "Please choose your role.";
  const phone = normalisePhone(v.phone);
  if (!phone) e.phone = "Please enter a 10-digit Indian mobile number.";
  if (!EMAIL.test(v.email) || v.email.length > 120) e.email = "Please enter a valid email address.";
  const cats = v.categories.filter((c) => categoryIds.includes(c));
  if (!cats.length) e.categories = "Please choose at least one kind of service.";
  if (v.medical !== "yes" && v.medical !== "no") e.medical = "Please tell us whether you offer medical services.";
  const team = Number(v.team_size);
  if (!Number.isInteger(team) || team < 1 || team > 500) e.team_size = "Please enter the number of practitioners, for example 2.";
  if (v.services_text.length < 10 || v.services_text.length > 2000) e.services_text = "Please list your main services, ideally with prices (up to 2,000 characters).";
  if (v.establishment_reg.length > 80) e.establishment_reg = "That's too long.";
  if (v.practitioner_reg.length > 120) e.practitioner_reg = "That's too long.";
  if (v.gstin && !GSTIN.test(v.gstin)) e.gstin = "That doesn't look like a GSTIN. It has 15 characters, for example 32ABCDE1234F1Z5. Leave it blank if you don't have one.";
  if (v.heard_from.length > 120) e.heard_from = "That's too long.";
  if (str(f, "consent") !== "yes") e.consent = "Please confirm you can apply for this business.";
  if (Object.keys(e).length) return { ok: false, errors: e };
  return { ok: true, value: {
    business_name: v.business_name, business_type: v.business_type, area: v.area === "Other" ? `Other: ${v.area_other}` : v.area, address: v.address,
    website: v.website, contact_name: v.contact_name, contact_role: v.contact_role, phone: phone!, email: v.email, categories: cats,
    medical: v.medical === "yes", team_size: team, services_text: v.services_text, establishment_reg: v.establishment_reg,
    practitioner_reg: v.practitioner_reg, gstin: v.gstin, heard_from: v.heard_from,
  } };
}

/** Stores an application. Repeats of the same application within a day return the first reference. */
export async function createApplication(env: Env, a: CleanApplication, ip: string): Promise<{ ref: string; repeat: boolean }> {
  const db = env.DB;
  const ipHash = (await sha256Hex(`apply|${ip}|${env.OPS_KEY ?? ""}`)).slice(0, 32);
  const dup = await db.prepare(
    "SELECT ref FROM applications WHERE phone = ? AND lower(business_name) = lower(?) AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day') ORDER BY created_at LIMIT 1",
  ).bind(a.phone, a.business_name).first<{ ref: string }>();
  if (dup) return { ref: dup.ref, repeat: true };
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM applications WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')").bind(ipHash).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) throw new HttpError(429, "We've received several applications from this connection in the last hour. Please try again later, or email us.");
  const id = newId("app"), ref = newRef("AP");
  await db.batch([
    db.prepare(`INSERT INTO applications (id, ref, business_name, business_type, area, address, website, contact_name, contact_role, phone, email,
      categories_json, medical, team_size, services_text, establishment_reg, practitioner_reg, gstin, heard_from, ip_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      id, ref, a.business_name, a.business_type, a.area, a.address, a.website, a.contact_name, a.contact_role, a.phone, a.email,
      JSON.stringify(a.categories), a.medical ? 1 : 0, a.team_size, a.services_text, a.establishment_reg, a.practitioner_reg, a.gstin, a.heard_from, ipHash),
    audit(db, "applicant", "application.created", "application", ref, { business: a.business_name, type: a.business_type, area: a.area }),
  ]);
  return { ref, repeat: false };
}

export async function listApplications(db: D1Database, status?: string) {
  const ok = (APP_STATUSES as readonly string[]).includes(status ?? "");
  const rows = await db.prepare(`SELECT * FROM applications ${ok ? "WHERE status = ?" : ""} ORDER BY created_at DESC LIMIT 200`).bind(...(ok ? [status] : [])).all<ApplicationRow>();
  const counts = await db.prepare("SELECT status, COUNT(*) AS n FROM applications GROUP BY status").all<{ status: string; n: number }>();
  return { rows: rows.results, counts: Object.fromEntries(counts.results.map((r) => [r.status, r.n])) as Record<string, number> };
}

export async function getApplication(db: D1Database, ref: string) {
  const a = await db.prepare("SELECT * FROM applications WHERE ref = ?").bind(ref).first<ApplicationRow>();
  if (!a) throw new HttpError(404, "We couldn't find that application.");
  return a;
}

export async function updateApplication(db: D1Database, ref: string, status: string, notes: string) {
  if (!(APP_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, "Unknown status");
  const a = await getApplication(db, ref);
  await db.batch([
    db.prepare("UPDATE applications SET status = ?, team_notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE ref = ?").bind(status, notes.slice(0, 4000), ref),
    audit(db, "ops", "application.updated", "application", ref, { from: a.status, to: status }),
  ]);
}

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** A starting providers/<venue>.json for an approved application. Everything we don't know yet is a TODO. */
export function venueDraft(a: ApplicationRow) {
  const id = slug(a.business_name) || "venue";
  const area = (AREAS as readonly string[]).includes(a.area) ? a.area : `TODO: one of ${AREAS.join(", ")} (applied as "${a.area}")`;
  const cats: string[] = (() => { try { return JSON.parse(a.categories_json); } catch { return []; } })();
  const staffId = `${id}-TODO-practitioner`;
  return {
    _about: `Draft from application ${a.ref} (${a.created_at.slice(0, 10)}). Contact: ${a.contact_name} (${a.contact_role}), ${a.phone}, ${a.email}. Fill every TODO, then run: node scripts/provider-sql.mjs providers/${id}.json --check`,
    id, slug: `${id}-${slug((AREAS as readonly string[]).includes(a.area) ? a.area : "thiruvananthapuram")}`, name: a.business_name, type: a.business_type, area,
    address: a.address, tagline: "TODO: one line, e.g. what they offer and where", about: "TODO: two or three sentences in plain language",
    hours_text: "TODO: e.g. Mon–Sat · 10:00–19:00", amenities: [], photos: [], art: 0, status: "draft", verifications: [],
    staff: [{ id: staffId, name: "TODO", role: "TODO", medical: !!a.medical, quals: [], registration: a.practitioner_reg || (a.medical ? "TODO: council registration" : ""), years: 0, langs: ["Malayalam", "English"], bio: "", hours: { "mon-sat": "TODO: 10:00-19:00" } }],
    services: (cats.length ? cats : ["TODO"]).map((c, i) => ({ id: `${id}-TODO-service-${i + 1}`, name: "TODO", cat: c, kind: a.medical ? "TODO: consult or treatment (beauty if non-medical)" : "beauty", dur: "TODO", price: "TODO", deposit: "TODO", desc: "", staff: [staffId] })),
  };
}
