// The Regional Partner portal: logins, set-password links and sessions (the same safeguards as the business portal),
// the partner terms, what a partner sees about their own businesses, and applications to become a partner.
// A partner sees their businesses' names, setup progress, booking counts and value, and commission: never client data.
import type { Env } from "../env";
import { HttpError, audit, hmacSha256Hex, newId, newRef, newToken, nowIso, safeEqual, sha256Hex } from "../db";
import { checkPassword, hashPassword, passwordProblem } from "./clinic";
import { checklist, listing, STAGE } from "./onboarding";
import { getPartner, type PartnerRow } from "./partners";
import { sendEmail, teamInbox } from "./notify";

export const PARTNER_TERMS_VERSION = "2026-11-03";
export interface PartnerUser { id: string; partner_id: string; email: string; password_hash: string; active: number; last_login_at: string | null; created_at: string }

// ---------- logins ----------
export async function partnerLogin(db: D1Database, partnerId: string) {
  return db.prepare("SELECT * FROM partner_users WHERE partner_id = ? ORDER BY created_at LIMIT 1").bind(partnerId).first<PartnerUser>();
}

/** Gives a partner a portal login on their email, if they don't have one. It can't be used until a password is set. */
export async function createPartnerLogin(db: D1Database, partner: PartnerRow) {
  const email = partner.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "Add the partner's email address first: the invitation is sent there and it becomes their login.");
  const existing = await partnerLogin(db, partner.id);
  if (existing) return existing;
  if (await db.prepare("SELECT 1 FROM partner_users WHERE email = ?").bind(email).first()) throw new HttpError(409, "That email is already a partner login.");
  const id = newId("pu");
  await db.batch([
    db.prepare("INSERT INTO partner_users (id, partner_id, email, password_hash) VALUES (?, ?, ?, ?)").bind(id, partner.id, email, `unset$${newToken()}`),
    audit(db, "ops", "partner_user.created", "partner", partner.id, { email }),
  ]);
  return (await db.prepare("SELECT * FROM partner_users WHERE id = ?").bind(id).first<PartnerUser>())!;
}

export async function setPartnerLoginActive(db: D1Database, userId: string, active: boolean) {
  await db.batch([
    db.prepare("UPDATE partner_users SET active = ?, updated_at = ? WHERE id = ?").bind(active ? 1 : 0, nowIso(), userId),
    audit(db, "ops", active ? "partner_user.enabled" : "partner_user.disabled", "partner_user", userId),
  ]);
}

const LINK_HOURS = { invite: 72, reset: 1 } as const;
type Purpose = keyof typeof LINK_HOURS;
export async function issuePartnerLink(db: D1Database, userId: string, purpose: Purpose, actor: string) {
  const token = newToken() + newToken();
  await db.batch([
    db.prepare("INSERT INTO partner_password_links (id, user_id, token_hash, purpose, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(newId("ppl"), userId, await sha256Hex(token), purpose, new Date(Date.now() + LINK_HOURS[purpose] * 36e5).toISOString()),
    audit(db, actor, `partner_user.${purpose}_link`, "partner_user", userId),
  ]);
  return token;
}
export async function partnerUserForLink(db: D1Database, token: string) {
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return null;
  return db.prepare(`SELECT l.purpose, u.* FROM partner_password_links l JOIN partner_users u ON u.id = l.user_id
    WHERE l.token_hash = ? AND l.used_at IS NULL AND l.expires_at > ? AND u.active = 1`).bind(await sha256Hex(token), nowIso()).first<PartnerUser & { purpose: Purpose }>();
}
export async function setPartnerPassword(db: D1Database, token: string, password: string, confirm: string) {
  const u = await partnerUserForLink(db, token);
  if (!u) throw new HttpError(410, "This link has expired or has already been used.");
  if (password !== confirm) throw new HttpError(400, "The two passwords don't match.");
  const problem = passwordProblem(password, u.email);
  if (problem) throw new HttpError(400, problem);
  const ts = nowIso();
  await db.batch([
    db.prepare("UPDATE partner_users SET password_hash = ?, updated_at = ? WHERE id = ?").bind(await hashPassword(password), ts, u.id),
    db.prepare("UPDATE partner_password_links SET used_at = ? WHERE user_id = ? AND used_at IS NULL").bind(ts, u.id),
    audit(db, `partner_user:${u.id}`, "partner_user.password_set", "partner_user", u.id, { via: u.purpose }),
  ]);
}

const escH = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export async function emailPartnerLink(env: Env, p: { name: string; email: string }, url: string, purpose: Purpose) {
  const invite = purpose === "invite", first = p.name.split(" ")[0];
  const subject = invite ? "Your Aestheva Regional Partner portal" : "Reset your Aestheva partner password";
  const lead = invite ? "Welcome to Aestheva. Your partner portal shows your link and code, the businesses you bring, how they're doing, your earnings and your monthly statements."
    : "Someone asked to reset the password for your Aestheva partner portal. If it wasn't you, ignore this email.";
  const until = invite ? "3 days" : "1 hour";
  const text = `Hello ${first},\n\n${lead}\n\n${invite ? "Set your password" : "Choose a new password"} here (the link works once, for ${until}):\n${url}\n\nYour login email is ${p.email}. After that, sign in at ${new URL(url).origin}/partners/login.\n\nAestheva partners team`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#302A2E;line-height:1.55;max-width:520px">
    <p style="font-size:24px;font-weight:bold;color:#8A2E5C;margin:0">aestheva <span style="font-size:15px;font-weight:normal;color:#857A80">partners</span></p>
    <h1 style="font-size:24px;color:#1D1A1C;margin:18px 0 14px">${invite ? `Welcome, ${escH(first)}` : "Reset your password"}</h1><p>${escH(lead)}</p>
    <p style="margin:24px 0"><a href="${escH(url)}" style="background:#8A2E5C;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">${invite ? "Set your password" : "Choose a new password"}</a></p>
    <p style="color:#6B5F65;font-size:13px">The link works once, for ${until}. Your login email is <b>${escH(p.email)}</b>.</p>
    <p style="color:#8A7C83;font-size:12px">If the button doesn't work, copy this link into your browser:<br>${escH(url)}</p></div>`;
  return sendEmail(env, p.email, { subject, text, html });
}

/** Invites a partner: creates their login if needed and emails a set-password link. Returns the link if the email failed. */
export async function invitePartner(env: Env, partnerId: string, site: string) {
  const partner = await getPartner(env.DB, partnerId);
  if (!partner) throw new HttpError(404, "Unknown partner");
  const u = await createPartnerLogin(env.DB, partner);
  const url = `${site}/partners/set-password?t=${await issuePartnerLink(env.DB, u.id, "invite", "ops")}`;
  const r = await emailPartnerLink(env, { name: partner.name, email: u.email }, url, "invite");
  return { sent: r.ok, email: u.email, link: r.ok ? undefined : url, code: r.code };
}

/** "Forgot password": the same answer whether or not the email has a login. */
export async function requestPartnerReset(env: Env, email: string, site: string) {
  const u = await env.DB.prepare("SELECT u.*, p.name FROM partner_users u JOIN partners p ON p.id = u.partner_id WHERE u.email = ? AND u.active = 1").bind(email.trim().toLowerCase()).first<PartnerUser & { name: string }>();
  if (!u) return;
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM partner_password_links WHERE user_id = ? AND purpose = 'reset' AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')").bind(u.id).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 3) return;
  await emailPartnerLink(env, u, `${site}/partners/set-password?t=${await issuePartnerLink(env.DB, u.id, "reset", "partner")}`, "reset");
}

export async function checkPartnerLogin(db: D1Database, email: string, password: string) {
  const u = await db.prepare("SELECT * FROM partner_users WHERE email = ?").bind(email).first<PartnerUser>();
  return u && u.active && (await checkPassword(password, u.password_hash)) ? u : null;
}

/** Sessions are signed with OPS_KEY and tied to the password hash, so a reset or a disabled login ends them. */
export async function partnerSession(key: string, u: PartnerUser, exp: number) {
  return `${u.id}.${exp}.${await hmacSha256Hex(key, `partner|${u.id}|${exp}|${u.password_hash.slice(-16)}|${u.active}`)}`;
}
export async function partnerFromSession(db: D1Database, key: string, cookie: string) {
  const [id, expS, sig] = cookie.split(".");
  const exp = Number(expS);
  if (!key || !id || !sig || !(exp > Date.now())) return null;
  const u = await db.prepare("SELECT * FROM partner_users WHERE id = ?").bind(id).first<PartnerUser>();
  if (!u || !u.active) return null;
  if (!safeEqual(sig, (await partnerSession(key, u, exp)).split(".")[2])) return null;
  const partner = await getPartner(db, u.partner_id);
  return partner && partner.status !== "terminated" ? { user: u, partner, exp } : null;
}

// ---------- terms ----------
export async function acceptPartnerTerms(db: D1Database, partner: PartnerRow, userId: string) {
  await db.batch([
    db.prepare("UPDATE partners SET terms_version = ?, terms_accepted_at = ? WHERE id = ?").bind(PARTNER_TERMS_VERSION, nowIso(), partner.id),
    audit(db, `partner_user:${userId}`, "partner.terms_accepted", "partner", partner.id, { version: PARTNER_TERMS_VERSION }),
  ]);
}
export const termsCurrent = (p: PartnerRow) => (p as PartnerRow & { terms_version?: string }).terms_version === PARTNER_TERMS_VERSION;

// ---------- what the partner sees about their businesses ----------
export interface PartnerBusiness {
  id: string; name: string; area: string; stage: string; liveSince: string | null; done: number; total: number;
  todo: string[]; bookingsMonth: number; valueMonth: number;
}
export async function partnerBusinesses(db: D1Database, partnerId: string, month: string): Promise<PartnerBusiness[]> {
  const ids = (await db.prepare("SELECT id FROM providers WHERE partner_id = ? ORDER BY name").bind(partnerId).all<{ id: string }>()).results;
  const out: PartnerBusiness[] = [];
  for (const { id } of ids) {
    const l = await listing(db, id), ch = checklist(l);
    const m = await db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(price_paise), 0) AS v FROM bookings WHERE provider_id = ? AND source = 'marketplace' AND status = 'completed' AND substr(date, 1, 7) = ?`).bind(id, month).first<{ n: number; v: number }>();
    out.push({ id, name: l.p.name, area: l.p.area, stage: STAGE(l.p), liveSince: l.p.live_since ?? null, done: ch.done, total: ch.steps.length,
      todo: ch.steps.filter((s) => !s.done).map((s) => s.title), bookingsMonth: m?.n ?? 0, valueMonth: m?.v ?? 0 });
  }
  return out;
}

// ---------- applications to become a partner ----------
export const PARTNER_BACKGROUNDS = ["Salon or spa manager", "Beauty academy trainer", "Makeup artist or wedding planner", "Cosmetics or pharma sales", "Beautician or stylist", "Other"] as const;
export const PARTNER_CITIES = ["Kochi", "Thrissur", "Kozhikode", "Other"] as const;
export const APPLICATION_STATUSES = ["new", "talking", "accepted", "declined"] as const;
export interface PartnerApplication {
  id: string; ref: string; name: string; email: string; phone: string; city: string; background: string; network: string; businesses_90: number;
  online: string; status: (typeof APPLICATION_STATUSES)[number]; team_notes: string; partner_id: string | null; created_at: string;
}

export function validatePartnerApplication(f: Record<string, unknown>) {
  const s = (k: string) => String(f[k] ?? "").trim();
  const v = { name: s("name"), email: s("email").toLowerCase(), phone: s("phone").replace(/[\s-]/g, ""), city: s("city"), city_other: s("city_other"),
    background: s("background"), network: s("network"), businesses_90: Number(s("businesses_90")), online: s("online") };
  const e: Record<string, string> = {};
  if (v.name.length < 2 || v.name.length > 80) e.name = "Please enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email) || v.email.length > 120) e.email = "Please enter a valid email address.";
  if (!/^(\+?91)?[6-9]\d{9}$/.test(v.phone)) e.phone = "Please enter a 10-digit Indian mobile number.";
  if (!(PARTNER_CITIES as readonly string[]).includes(v.city)) e.city = "Please choose your city.";
  else if (v.city === "Other" && (v.city_other.length < 2 || v.city_other.length > 60)) e.city_other = "Please tell us your city.";
  if (!(PARTNER_BACKGROUNDS as readonly string[]).includes(v.background)) e.background = "Please choose what describes you best.";
  if (v.network.length < 30 || v.network.length > 1500) e.network = "Please tell us about the salons, studios and clinics you know (a few sentences).";
  if (!Number.isInteger(v.businesses_90) || v.businesses_90 < 0 || v.businesses_90 > 500) e.businesses_90 = "Please give a number, for example 10.";
  if (v.online.length > 200) e.online = "That link is too long.";
  if (s("consent") !== "yes") e.consent = "Please confirm we can contact you about your application.";
  if (Object.keys(e).length) return { ok: false as const, errors: e };
  return { ok: true as const, value: { name: v.name, email: v.email, phone: "+91" + v.phone.slice(-10), city: v.city === "Other" ? `Other: ${v.city_other}` : v.city,
    background: v.background, network: v.network, businesses_90: v.businesses_90, online: v.online } };
}

export async function createPartnerApplication(env: Env, v: Extract<ReturnType<typeof validatePartnerApplication>, { ok: true }>["value"], ip: string, site: string) {
  const db = env.DB, ipHash = (await sha256Hex(`partner-apply|${ip}|${env.OPS_KEY ?? ""}`)).slice(0, 32);
  const dup = await db.prepare("SELECT ref FROM partner_applications WHERE email = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')").bind(v.email).first<{ ref: string }>();
  if (dup) return dup.ref;
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM partner_applications WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')").bind(ipHash).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) throw new HttpError(429, "We've received several applications from this connection in the last hour. Please try again later.");
  const id = newId("pa"), ref = newRef("RP");
  await db.batch([
    db.prepare(`INSERT INTO partner_applications (id, ref, name, email, phone, city, background, network, businesses_90, online, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, ref, v.name, v.email, v.phone, v.city, v.background, v.network, v.businesses_90, v.online, ipHash),
    audit(db, "applicant", "partner_application.created", "partner_application", ref, { city: v.city }),
  ]);
  const text = [`New Regional Partner application ${ref}`, `${v.name} · ${v.city} · ${v.background}`, `Mobile ${v.phone} · ${v.email}${v.online ? ` · ${v.online}` : ""}`,
    `Could bring live in 90 days: ${v.businesses_90}`, `Their network:\n${v.network}`, `Open it: ${site}/ops/partners/applications/${ref}`].join("\n\n");
  await sendEmail(env, teamInbox(env), { subject: `Partner application: ${v.name}, ${v.city}`, text, html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${escH(text)}</pre>`, replyTo: { email: v.email, name: v.name } })
    .catch((e) => console.error("partner application email failed", e));
  return ref;
}

export async function partnerApplications(db: D1Database) {
  return (await db.prepare("SELECT * FROM partner_applications ORDER BY status = 'new' DESC, created_at DESC LIMIT 200").all<PartnerApplication>()).results;
}
export const partnerApplication = (db: D1Database, ref: string) => db.prepare("SELECT * FROM partner_applications WHERE ref = ?").bind(ref).first<PartnerApplication>();
export async function updatePartnerApplication(db: D1Database, ref: string, status: string, notes: string) {
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, "Unknown status");
  const r = await db.prepare("UPDATE partner_applications SET status = ?, team_notes = ? WHERE ref = ?").bind(status, notes.slice(0, 4000), ref).run();
  if (!r.meta.changes) throw new HttpError(404, "Unknown application");
  await audit(db, "ops", "partner_application.updated", "partner_application", ref, { status }).run();
}
export async function linkApplicationToPartner(db: D1Database, ref: string, partnerId: string) {
  await db.prepare("UPDATE partner_applications SET status = 'accepted', partner_id = ? WHERE ref = ?").bind(partnerId, ref).run();
}

