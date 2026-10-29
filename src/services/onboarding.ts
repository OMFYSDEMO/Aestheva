// Self-serve onboarding. A clinic builds its own listing in the portal (details, photos, team, treatments,
// documents, terms), submits it, and the Aestheva team publishes it. Every function is scoped to one provider.
import { AREAS, COMPANY, VENUE_TYPES } from "../config";
import type { Env } from "../env";
import { HttpError, audit, hash32, newId, nowIso } from "../db";
import { nowIst } from "../domain/time";
import { normalisePhone } from "./bookings";
import { createClinicUser, emailPasswordLink, issuePasswordLink, type ClinicUser } from "./clinic";
import { getApplication } from "./applications";
import { sendEmail, sendTeamEmail } from "./notify";
import type { ProviderRow, ServiceRow, StaffRow } from "./catalog";

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const lines = (s: string) => String(s ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
type Form = Record<string, string | string[] | File | (string | File)[]>;
const str = (f: Form, k: string) => { const v = f[k]; return String(Array.isArray(v) ? v[0] : v ?? "").trim(); };
const list = (f: Form, k: string) => { const v = f[k]; return (Array.isArray(v) ? v : v === undefined ? [] : [v]).map((x) => String(x)); };
export type Errors = Record<string, string>;
export class FormError extends HttpError { constructor(public errors: Errors) { super(400, "Please check the highlighted answers."); } }

export const STAGE = (p: { status: string; submitted_at: string | null }) =>
  p.status === "live" ? "live" : p.status === "paused" ? "paused" : p.submitted_at ? "review" : "setup";

// ---------- from application to draft venue ----------

/** Approving an application creates the clinic's draft listing and a login for the applicant, then emails them an invitation. */
export async function approveApplication(env: Env, ref: string, siteUrl: string) {
  const db = env.DB, a = await getApplication(db, ref);
  if (a.provider_id) throw new HttpError(409, "This application already has a listing.");
  const taken = async (col: "id" | "slug", v: string) => !!(await db.prepare(`SELECT 1 FROM providers WHERE ${col} = ?`).bind(v).first());
  let id = slug(a.business_name) || "venue";
  for (let n = 2; await taken("id", id); n++) id = `${slug(a.business_name)}-${n}`;
  const area = (AREAS as readonly string[]).includes(a.area) ? a.area : "";
  let s = `${id}-${slug(area || "thiruvananthapuram")}`;
  for (let n = 2; await taken("slug", s); n++) s = `${id}-${slug(area || "thiruvananthapuram")}-${n}`;
  await db.batch([
    db.prepare(`INSERT INTO providers (id, slug, name, type, area, address, phone, art, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`)
      .bind(id, s, a.business_name, a.business_type, area, a.address, a.phone, hash32(id) % 8),
    db.prepare("UPDATE applications SET status = 'approved', provider_id = ?, updated_at = ? WHERE ref = ?").bind(id, nowIso(), ref),
    audit(db, "ops", "application.approved", "application", ref, { providerId: id }),
  ]);
  let user: ClinicUser;
  try { user = await createClinicUser(db, id, a.contact_name, a.email); }
  catch (e) { if (e instanceof HttpError && e.status === 409) return { providerId: id, invited: false as const, reason: "That email already has a clinic login, so no new invitation was sent." }; throw e; }
  const link = `${siteUrl}/clinic/set-password?t=${await issuePasswordLink(db, user.id, "invite", "ops")}`;
  const r = await emailPasswordLink(env, user, a.business_name, link, "invite");
  await audit(db, "ops", r.ok ? "clinic_user.invite_emailed" : "clinic_user.invite_email_failed", "provider_user", user.id, r.ok ? { to: user.email } : { to: user.email, code: r.code }).run();
  return { providerId: id, invited: true as const, email: user.email, sent: r.ok, code: r.code, link: r.ok ? undefined : link };
}

// ---------- details ----------

export const AMENITY_IDEAS = ["Parking", "Wheelchair access", "Air-conditioned rooms", "Women professionals available", "UPI and cards accepted", "Lift access"];

export function validateDetails(f: Form) {
  const e: Errors = {};
  const v = { name: str(f, "name"), type: str(f, "type"), area: str(f, "area"), address: str(f, "address"), phone: str(f, "phone"),
    tagline: str(f, "tagline"), about: str(f, "about"), hours_text: str(f, "hours_text"), amenities: lines(str(f, "amenities")) };
  if (v.name.length < 2 || v.name.length > 120) e.name = "Please enter your business name as clients know it.";
  if (!(VENUE_TYPES as readonly string[]).includes(v.type)) e.type = "Please choose what kind of business you are.";
  if (!(AREAS as readonly string[]).includes(v.area)) e.area = "Please choose your area.";
  if (v.address.length < 10 || v.address.length > 300) e.address = "Please enter the full address, with the PIN code.";
  const phone = normalisePhone(v.phone);
  if (!phone) e.phone = "Please enter a 10-digit mobile number clients can call.";
  if (v.tagline.length < 10 || v.tagline.length > 90) e.tagline = "One line of 10 to 90 characters, for example “Skin and hair care near Technopark”.";
  if (v.about.length < 60 || v.about.length > 700) e.about = `Two or three sentences, 60 to 700 characters (now ${v.about.length}).`;
  if (v.hours_text.length < 5 || v.hours_text.length > 120) e.hours_text = "For example “Mon–Sat · 10:00–19:00 · Sunday closed”.";
  if (v.amenities.length > 6 || v.amenities.some((x) => x.length > 80)) e.amenities = "Up to 6 short lines of up to 80 characters each.";
  if (Object.keys(e).length) throw new FormError(e);
  return { ...v, phone: phone! };
}
export async function saveDetails(db: D1Database, pid: string, v: ReturnType<typeof validateDetails>, actor: string) {
  await db.batch([
    db.prepare(`UPDATE providers SET name = ?, type = ?, area = ?, address = ?, phone = ?, tagline = ?, about = ?, hours_text = ?, amenities_json = ? WHERE id = ?`)
      .bind(v.name, v.type, v.area, v.address, v.phone, v.tagline, v.about, v.hours_text, JSON.stringify(v.amenities), pid),
    audit(db, actor, "listing.details", "provider", pid),
  ]);
}

// ---------- team ----------

export const LANGS = ["Malayalam", "English", "Hindi", "Tamil"];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function validateStaff(f: Form) {
  const e: Errors = {};
  const v = { name: str(f, "name"), role: str(f, "role"), medical: str(f, "medical"), quals: lines(str(f, "quals")), registration: str(f, "registration"),
    langs: [...new Set([...list(f, "langs").filter((l) => LANGS.includes(l)), ...lines(str(f, "langs_other").replace(/,/g, "\n"))])].slice(0, 8), bio: str(f, "bio") };
  if (v.name.length < 2 || v.name.length > 80) e.name = "Please enter their name as clients should see it, for example “Dr. Anjali Menon”.";
  if (v.role.length < 2 || v.role.length > 60) e.role = "For example “Dermatologist”, “Dentist” or “Senior beautician”.";
  if (v.medical !== "yes" && v.medical !== "no") e.medical = "Please choose one.";
  if (v.quals.length > 6 || v.quals.some((q) => q.length > 120)) e.quals = "Up to 6 lines.";
  if (v.medical === "yes" && (v.registration.length < 5 || v.registration.length > 120)) e.registration = "Doctors and dentists need their council registration, for example “Kerala State Dental Council, Reg. No. 12345”.";
  if (v.bio.length > 400) e.bio = "Up to 400 characters.";
  const hours: [number, number, number][] = [];
  for (const d of DAY_ORDER) {
    if (str(f, `day${d}`) !== "on") continue;
    const a = Number(str(f, `from${d}`)), b = Number(str(f, `to${d}`));
    if (!(Number.isInteger(a) && Number.isInteger(b) && a % 30 === 0 && b % 30 === 0 && a >= 360 && b <= 1380 && b > a)) e[`day${d}`] = `${DAY_NAMES[d]}: the finish time must be after the start time.`;
    else hours.push([d, a, b]);
  }
  if (!hours.length && !Object.keys(e).some((k) => k.startsWith("day"))) e.hours = "Tick at least one day they can be booked online.";
  if (Object.keys(e).length) throw new FormError(e);
  return { ...v, medical: v.medical === "yes", hours };
}
export async function saveStaff(db: D1Database, pid: string, staffId: string | null, v: ReturnType<typeof validateStaff>, actor: string) {
  if (staffId && !(await db.prepare("SELECT 1 FROM staff WHERE id = ? AND provider_id = ? AND active = 1").bind(staffId, pid).first())) throw new HttpError(404, "We couldn't find that team member.");
  const id = staffId ?? `${pid}-${slug(v.name) || "staff"}-${newId("s").slice(-5).toLowerCase()}`;
  const row = [v.name, v.role, v.medical ? 1 : 0, JSON.stringify(v.quals), v.registration, JSON.stringify(v.langs), v.bio];
  await db.batch([
    staffId ? db.prepare("UPDATE staff SET name = ?, role = ?, medical = ?, quals_json = ?, registration = ?, langs_json = ?, bio = ? WHERE id = ?").bind(...row, id)
      : db.prepare("INSERT INTO staff (id, provider_id, name, role, medical, quals_json, registration, langs_json, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, pid, ...row),
    db.prepare("DELETE FROM staff_hours WHERE staff_id = ?").bind(id),
    ...v.hours.map(([d, a, b]) => db.prepare("INSERT INTO staff_hours (staff_id, dow, start_min, end_min) VALUES (?, ?, ?, ?)").bind(id, d, a, b)),
    // A non-medical person can't stay linked to medical treatments.
    ...(v.medical ? [] : [db.prepare("DELETE FROM service_staff WHERE staff_id = ? AND service_id IN (SELECT id FROM services WHERE kind IN ('consult','treatment'))").bind(id)]),
    audit(db, actor, staffId ? "listing.staff_updated" : "listing.staff_added", "staff", id),
  ]);
  return id;
}
export async function removeStaff(db: D1Database, pid: string, staffId: string, actor: string) {
  const s = await db.prepare("SELECT name FROM staff WHERE id = ? AND provider_id = ? AND active = 1").bind(staffId, pid).first<{ name: string }>();
  if (!s) throw new HttpError(404, "We couldn't find that team member.");
  const future = await db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE staff_id = ? AND date >= ? AND status IN ('held','confirmed')").bind(staffId, nowIst().date).first<{ n: number }>();
  if (future?.n) throw new HttpError(409, `${s.name} has ${future.n} upcoming booking${future.n === 1 ? "" : "s"}. Cancel or move them first.`);
  await db.batch([
    db.prepare("UPDATE staff SET active = 0 WHERE id = ?").bind(staffId),
    db.prepare("DELETE FROM service_staff WHERE staff_id = ?").bind(staffId),
    audit(db, actor, "listing.staff_removed", "staff", staffId),
  ]);
}

// ---------- treatments ----------

export const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180];

export function validateService(f: Form, staff: StaffRow[], catIds: string[]) {
  const e: Errors = {};
  const v = { name: str(f, "name"), cat: str(f, "cat"), kind: str(f, "kind"), dur: Number(str(f, "dur")), price: Number(str(f, "price").replace(/[₹,\s]/g, "")),
    description: str(f, "description"), staff: [...new Set(list(f, "staff"))] };
  if (v.name.length < 3 || v.name.length > 90) e.name = "Name it as clients would search for it, for example “Hydrating facial” or “Scaling and polishing”.";
  if (!catIds.includes(v.cat)) e.cat = "Please choose a category.";
  if (!["consult", "treatment", "beauty"].includes(v.kind)) e.kind = "Please choose one.";
  if (!DURATIONS.includes(v.dur)) e.dur = "Please choose how long it takes.";
  if (!Number.isInteger(v.price) || v.price < 1 || v.price > 500000) e.price = "Enter the full price in rupees, for example 1500.";
  if (v.description.length < 20 || v.description.length > 500) e.description = "One or two plain sentences on what happens (20 to 500 characters).";
  const chosen = staff.filter((s) => v.staff.includes(s.id));
  if (!chosen.length) e.staff = "Choose who can do this service.";
  else if (v.kind !== "beauty" && chosen.some((s) => !s.medical)) e.staff = "Medical consultations and treatments can only be done by a doctor, dentist or other registered practitioner. Untick the others, or choose “Beauty & wellness”.";
  if (Object.keys(e).length) throw new FormError(e);
  return { ...v, staff: chosen.map((s) => s.id) };
}
export async function saveService(db: D1Database, pid: string, serviceId: string | null, v: ReturnType<typeof validateService>, actor: string) {
  if (serviceId && !(await db.prepare("SELECT 1 FROM services WHERE id = ? AND provider_id = ? AND active = 1").bind(serviceId, pid).first())) throw new HttpError(404, "We couldn't find that treatment.");
  const id = serviceId ?? `${pid}-${slug(v.name) || "treatment"}-${newId("v").slice(-5).toLowerCase()}`;
  const sort = serviceId ? null : ((await db.prepare("SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM services WHERE provider_id = ?").bind(pid).first<{ n: number }>())?.n ?? 0);
  await db.batch([
    serviceId ? db.prepare("UPDATE services SET name = ?, cat = ?, kind = ?, dur_min = ?, price_paise = ?, description = ?, deposit_paise = MIN(deposit_paise, ?) WHERE id = ?")
      .bind(v.name, v.cat, v.kind, v.dur, v.price * 100, v.description, v.price * 100, id)
      : db.prepare("INSERT INTO services (id, provider_id, name, cat, kind, dur_min, price_paise, deposit_paise, description, sort) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)")
        .bind(id, pid, v.name, v.cat, v.kind, v.dur, v.price * 100, v.description, sort),
    db.prepare("DELETE FROM service_staff WHERE service_id = ?").bind(id),
    ...v.staff.map((s) => db.prepare("INSERT INTO service_staff (service_id, staff_id) VALUES (?, ?)").bind(id, s)),
    audit(db, actor, serviceId ? "listing.service_updated" : "listing.service_added", "service", id),
  ]);
  return id;
}
export async function removeService(db: D1Database, pid: string, serviceId: string, actor: string) {
  const s = await db.prepare("SELECT 1 FROM services WHERE id = ? AND provider_id = ? AND active = 1").bind(serviceId, pid).first();
  if (!s) throw new HttpError(404, "We couldn't find that treatment.");
  await db.batch([db.prepare("UPDATE services SET active = 0 WHERE id = ?").bind(serviceId), audit(db, actor, "listing.service_removed", "service", serviceId)]);
}

// ---------- photos (public, served from /media) and documents (private) ----------

const isWebp = (b: Uint8Array) => b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const isPdf = (b: Uint8Array) => String.fromCharCode(...b.slice(0, 5)) === "%PDF-";
export const MAX_PHOTOS = 6;

/** The browser resizes each photo to 400, 800 and 1500 px WebP plus a 1200×630 JPEG for link previews (public/setup.js). */
export async function addPhoto(env: Env, pid: string, files: Record<"w400" | "w800" | "w1500" | "og", unknown>, alt: string, actor: string) {
  if (!env.MEDIA) throw new HttpError(503, "Photo storage isn't available.");
  const p = await env.DB.prepare("SELECT photos_json FROM providers WHERE id = ?").bind(pid).first<{ photos_json: string }>();
  const photos: { src: string; alt: string }[] = JSON.parse(p?.photos_json || "[]");
  if (photos.length >= MAX_PHOTOS) throw new HttpError(400, `Up to ${MAX_PHOTOS} photos. Remove one first.`);
  alt = alt.trim();
  if (alt.length < 10 || alt.length > 140) throw new HttpError(400, "Please describe the photo in a short sentence, for example “Reception with the waiting area”. It helps clients who use screen readers.");
  const bytes: Record<string, Uint8Array> = {};
  for (const k of ["w400", "w800", "w1500", "og"] as const) {
    const f = files[k];
    if (!(f instanceof File) || f.size > 3_000_000) throw new HttpError(400, "That photo couldn't be prepared. Please try a different photo (JPEG or PNG, taken on a phone is fine).");
    bytes[k] = new Uint8Array(await f.arrayBuffer());
    // WebP where the browser can make it; Safari sends JPEG. Either is served with its true content type.
    if (k === "og" ? !isJpeg(bytes[k]) : !(isWebp(bytes[k]) || isJpeg(bytes[k]))) throw new HttpError(400, "That photo couldn't be prepared. Please try a different photo.");
  }
  const typeOf = (b: Uint8Array) => (isWebp(b) ? "image/webp" : "image/jpeg");
  const id = newId("ph").slice(3).toLowerCase(), base = `media/${pid}/${id}`;
  await Promise.all([
    env.MEDIA.put(`${base}-400.webp`, bytes.w400, { httpMetadata: { contentType: typeOf(bytes.w400) } }),
    env.MEDIA.put(`${base}-800.webp`, bytes.w800, { httpMetadata: { contentType: typeOf(bytes.w800) } }),
    env.MEDIA.put(`${base}-1500.webp`, bytes.w1500, { httpMetadata: { contentType: typeOf(bytes.w1500) } }),
    env.MEDIA.put(`${base}-og.jpg`, bytes.og, { httpMetadata: { contentType: "image/jpeg" } }),
  ]);
  photos.push({ src: `/media/${pid}/${id}`, alt });
  await env.DB.batch([env.DB.prepare("UPDATE providers SET photos_json = ? WHERE id = ?").bind(JSON.stringify(photos), pid), audit(env.DB, actor, "listing.photo_added", "provider", pid)]);
}
export async function changePhoto(env: Env, pid: string, src: string, action: "remove" | "cover", actor: string) {
  const p = await env.DB.prepare("SELECT photos_json FROM providers WHERE id = ?").bind(pid).first<{ photos_json: string }>();
  const photos: { src: string; alt: string }[] = JSON.parse(p?.photos_json || "[]");
  const i = photos.findIndex((x) => x.src === src);
  if (i < 0) throw new HttpError(404, "That photo is no longer there.");
  const [ph] = photos.splice(i, 1);
  if (action === "cover") photos.unshift(ph);
  else if (env.MEDIA && ph.src.startsWith(`/media/${pid}/`)) await env.MEDIA.delete(["-400.webp", "-800.webp", "-1500.webp", "-og.jpg"].map((x) => `media${ph.src.slice(6)}${x}`));
  await env.DB.batch([env.DB.prepare("UPDATE providers SET photos_json = ? WHERE id = ?").bind(JSON.stringify(photos), pid), audit(env.DB, actor, `listing.photo_${action}`, "provider", pid)]);
}

export const DOC_KINDS = ["Professional certificate", "Portfolio or proof of work", "ID proof (PAN or masked Aadhaar)", "Business identity (GST, trade licence or Udyam)", "Practitioner council registration", "Clinical establishment registration", "Other"];
export async function addDocument(env: Env, pid: string, kind: string, file: unknown, actor: string) {
  if (!env.MEDIA) throw new HttpError(503, "Document storage isn't available.");
  if (!DOC_KINDS.includes(kind)) throw new HttpError(400, "Please choose what the document is.");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Please choose a file.");
  if (file.size > 8_000_000) throw new HttpError(400, "That file is over 8 MB. A phone photo or a PDF scan is usually much smaller.");
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const type = isPdf(b) ? "application/pdf" : isJpeg(b) ? "image/jpeg" : isPng(b) ? "image/png" : isWebp(b) ? "image/webp" : "";
  if (!type) throw new HttpError(400, "Please upload a PDF or a photo (JPEG or PNG).");
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM provider_documents WHERE provider_id = ?").bind(pid).first<{ n: number }>();
  if ((count?.n ?? 0) >= 20) throw new HttpError(400, "That's the most documents we can take here. Email us if you need to send more.");
  const id = newId("doc"), key = `docs/${pid}/${id}`;
  await env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
  const filename = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "document";
  await env.DB.batch([
    env.DB.prepare("INSERT INTO provider_documents (id, provider_id, kind, filename, content_type, size_bytes, r2_key, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, pid, kind, filename, type, file.size, key, actor),
    audit(env.DB, actor, "listing.document_added", "provider", pid, { kind }),
  ]);
}
export async function removeDocument(env: Env, pid: string, docId: string, actor: string) {
  const d = await env.DB.prepare("SELECT r2_key FROM provider_documents WHERE id = ? AND provider_id = ?").bind(docId, pid).first<{ r2_key: string }>();
  if (!d) throw new HttpError(404, "That document is no longer there.");
  await env.MEDIA?.delete(d.r2_key);
  await env.DB.batch([env.DB.prepare("DELETE FROM provider_documents WHERE id = ?").bind(docId), audit(env.DB, actor, "listing.document_removed", "provider", pid)]);
}
export const listDocuments = async (db: D1Database, pid: string) =>
  (await db.prepare("SELECT id, kind, filename, content_type, size_bytes, created_at FROM provider_documents WHERE provider_id = ? ORDER BY created_at").bind(pid)
    .all<{ id: string; kind: string; filename: string; content_type: string; size_bytes: number; created_at: string }>()).results;

// ---------- the listing as a whole ----------

export async function listing(db: D1Database, pid: string) {
  const p = (await db.prepare("SELECT * FROM providers WHERE id = ?").bind(pid).first<ProviderRow>())!;
  const [staff, hours, services, links, docs] = await Promise.all([
    db.prepare("SELECT * FROM staff WHERE provider_id = ? AND active = 1 ORDER BY rowid").bind(pid).all<StaffRow>(),
    db.prepare("SELECT h.* FROM staff_hours h JOIN staff t ON t.id = h.staff_id WHERE t.provider_id = ? AND t.active = 1").bind(pid).all<{ staff_id: string; dow: number; start_min: number; end_min: number }>(),
    db.prepare("SELECT * FROM services WHERE provider_id = ? AND active = 1 ORDER BY sort").bind(pid).all<ServiceRow>(),
    db.prepare("SELECT ss.service_id, ss.staff_id FROM service_staff ss JOIN services s ON s.id = ss.service_id WHERE s.provider_id = ?").bind(pid).all<{ service_id: string; staff_id: string }>(),
    listDocuments(db, pid),
  ]);
  const svc = services.results.map((s) => ({ ...s, staff: links.results.filter((l) => l.service_id === s.id).map((l) => l.staff_id) }));
  return { p, staff: staff.results, hours: hours.results, services: svc, docs };
}

export interface Step { key: string; title: string; done: boolean; summary: string }
export function checklist(l: Awaited<ReturnType<typeof listing>>) {
  const photos = JSON.parse(l.p.photos_json || "[]").length;
  const medical = l.staff.some((s) => s.medical) || l.services.some((s) => s.kind !== "beauty");
  const bookable = l.services.filter((s) => s.staff.length);
  const steps: Step[] = [
    { key: "details", title: "Your business", done: !!(l.p.tagline && l.p.about && l.p.hours_text && l.p.area && l.p.phone), summary: l.p.tagline ? `${l.p.area || "Area not chosen"} · ${l.p.hours_text || "hours to add"}` : "Name, address, phone, hours and a short introduction" },
    { key: "photos", title: "Photos", done: photos > 0, summary: photos ? `${photos} photo${photos === 1 ? "" : "s"}${photos < 3 ? " · 3 or more look best" : ""}` : "At least one; your space or your work works well" },
    { key: "team", title: "You and your team", done: l.staff.length > 0 && l.staff.every((s) => l.hours.some((h) => h.staff_id === s.id)), summary: l.staff.length ? l.staff.map((s) => s.name).join(", ") : "Who clients can book (just you is fine), with their hours" },
    { key: "treatments", title: "Services & prices", done: bookable.length > 0, summary: l.services.length ? `${l.services.length} service${l.services.length === 1 ? "" : "s"}${bookable.length < l.services.length ? ` · ${l.services.length - bookable.length} without anyone to do them` : ""}` : "What clients can book, how long it takes and the full price" },
    { key: "documents", title: "Verification documents", done: l.docs.length > 0, summary: l.docs.length ? `${l.docs.length} uploaded · only the Aestheva team can see them` : medical ? "Council registration for each doctor or dentist, and your business identity" : "A certificate or proof of your work, and an ID or business proof" },
    { key: "terms", title: "Terms", done: !!l.p.terms_accepted_at, summary: l.p.terms_accepted_at ? "Accepted" : "Commission, cancellations and your responsibilities" },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, percent: Math.round((done / steps.length) * 100), complete: done === steps.length, medical };
}

export async function acceptTerms(db: D1Database, pid: string, userId: string) {
  await db.batch([db.prepare("UPDATE providers SET terms_accepted_at = ?, terms_accepted_by = ? WHERE id = ?").bind(nowIso(), userId, pid), audit(db, `provider_user:${userId}`, "listing.terms_accepted", "provider", pid)]);
}

const clinicEmails = async (db: D1Database, pid: string) => (await db.prepare("SELECT name, email FROM provider_users WHERE provider_id = ? AND active = 1").bind(pid).all<{ name: string; email: string }>()).results;
const escH = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const mail = (title: string, paras: string[], button?: [string, string]) => ({
  text: `${title}\n\n${paras.join("\n\n")}${button ? `\n\n${button[0]}: ${button[1]}` : ""}\n\nAestheva`,
  html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#302A2E;line-height:1.55;max-width:540px"><p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#713F54;font-weight:bold;margin:0">Aestheva for business</p><h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:8px 0 14px">${escH(title)}</h1>${paras.map((p) => `<p style="white-space:pre-wrap">${escH(p)}</p>`).join("")}${button ? `<p style="margin:24px 0"><a href="${escH(button[1])}" style="background:#713F54;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">${escH(button[0])}</a></p>` : ""}</div>`,
});

export async function submitForReview(env: Env, pid: string, user: ClinicUser, siteUrl: string) {
  const l = await listing(env.DB, pid), c = checklist(l);
  if (!c.complete) throw new HttpError(400, "A few steps still need finishing before you can submit.");
  if (l.p.status === "live") throw new HttpError(409, "Your listing is already live.");
  await env.DB.batch([env.DB.prepare("UPDATE providers SET submitted_at = ?, review_note = '' WHERE id = ?").bind(nowIso(), pid), audit(env.DB, `provider_user:${user.id}`, "listing.submitted", "provider", pid)]);
  const m = mail(`${l.p.name} is ready for review`, [`${user.name} (${user.email}) submitted ${l.p.name}, ${l.p.type} in ${l.p.area}: ${l.staff.length} team member(s), ${l.services.length} service(s), ${JSON.parse(l.p.photos_json || "[]").length} photo(s), ${l.docs.length} document(s).`], ["Review the listing", `${siteUrl}/ops/venues/${pid}`]);
  await sendTeamEmail(env, { subject: `Listing ready for review: ${l.p.name}`, ...m });
}

/** Team: publish, send back with a note, or pause. Each emails the clinic's logins. */
export async function setVenueStage(env: Env, pid: string, action: "publish" | "send_back" | "pause", note: string, siteUrl: string) {
  const db = env.DB;
  const p = await db.prepare("SELECT * FROM providers WHERE id = ?").bind(pid).first<ProviderRow>();
  if (!p) throw new HttpError(404, "Unknown venue");
  note = note.trim().slice(0, 2000);
  if (action === "send_back" && note.length < 5) throw new HttpError(400, "Please write what needs changing. They see this note.");
  if (action === "publish") await db.batch([db.prepare("UPDATE providers SET status = 'live', live_since = COALESCE(live_since, date('now')), review_note = '' WHERE id = ?").bind(pid), audit(db, "ops", "provider.live", "provider", pid)]);
  if (action === "send_back") await db.batch([db.prepare("UPDATE providers SET submitted_at = NULL, review_note = ? WHERE id = ?").bind(note, pid), audit(db, "ops", "provider.sent_back", "provider", pid)]);
  if (action === "pause") await db.batch([db.prepare("UPDATE providers SET status = 'paused' WHERE id = ?").bind(pid), audit(db, "ops", "provider.paused", "provider", pid, { note })]);
  const m = action === "publish" ? mail(`${p.name} is live on Aestheva`, ["Clients can now find you and book online. New bookings appear in your Aestheva portal under Today and Calendar. Phone and walk-in bookings you add there hold the time too.", "Tip: share your page on WhatsApp and Instagram so your regular clients can book you directly."], ["See your page", `${siteUrl}/p/${p.slug}`])
    : action === "send_back" ? mail(`A few changes for ${p.name}`, ["Thanks for setting up your listing. Before we publish it, please look at this note from the Aestheva team:", note, "Make the changes in your Aestheva portal, then press Submit for review again."], ["Open your listing", `${siteUrl}/clinic/setup`])
    : mail(`${p.name} is paused on Aestheva`, ["Your listing is hidden from clients for now, and no new bookings can be made. Existing bookings stay as they are.", ...(note ? [note] : []), `Questions? Write to ${COMPANY.supportEmail}.`]);
  const subject = action === "publish" ? `You're live: ${p.name}` : action === "send_back" ? `Changes needed: ${p.name}` : `Paused: ${p.name}`;
  for (const u of await clinicEmails(db, pid)) await sendEmail(env, u.email, { subject, ...m });
}

export async function addVerification(db: D1Database, pid: string, label: string, scope: string, checkedOn: string) {
  label = label.trim(); scope = scope.trim(); checkedOn = checkedOn.trim();
  if (label.length < 5 || scope.length < 3 || checkedOn.length < 3) throw new HttpError(400, "Fill in what was checked, its scope and when.");
  const n = (await db.prepare("SELECT COUNT(*) AS n FROM verifications WHERE provider_id = ?").bind(pid).first<{ n: number }>())?.n ?? 0;
  await db.batch([db.prepare("INSERT INTO verifications (provider_id, label, scope, checked_on, sort) VALUES (?, ?, ?, ?, ?)").bind(pid, label.slice(0, 120), scope.slice(0, 160), checkedOn.slice(0, 40), n), audit(db, "ops", "provider.verification_added", "provider", pid, { label })]);
}
export async function removeVerification(db: D1Database, pid: string, id: number) {
  await db.batch([db.prepare("DELETE FROM verifications WHERE id = ? AND provider_id = ?").bind(id, pid), audit(db, "ops", "provider.verification_removed", "provider", pid)]);
}

