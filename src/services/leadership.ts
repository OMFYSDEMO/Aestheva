// The leadership record: an append-only, hash-chained timeline of the communications, documents and agreements between
// Aestheva's leaders, with their own logins. Nothing in it is ever changed or deleted (the database refuses); a
// correction, a new version, a confirmation or a dispute is a new entry that refers to an earlier one. Each new entry is
// emailed to every leader, so copies of the record exist outside the system too.
import type { Env } from "../env";
import { HttpError, audit, hmacSha256Hex, newId, newToken, nowIso, safeEqual, sha256Hex } from "../db";
import { checkPassword, hashPassword, passwordProblem } from "./clinic";
import { sendEmail } from "./notify";

export interface Leader { id: string; name: string; role: string; email: string; password_hash: string; active: number; last_login_at: string | null; created_at: string }
export interface FileMeta { name: string; type: string; size: number; sha256: string; key: string }
export interface Entry {
  id: string; seq: number; recorded_at: string; occurred_on: string; kind: Kind; channel: string; title: string; body: string;
  author_id: string | null; author_name: string; refers_to: number | null; files_json: string; prev_hash: string; hash: string;
}
export type Kind = "opened" | "note" | "message" | "meeting" | "document" | "agreement" | "revision" | "correction" | "confirm" | "dispute" | "access";

/** What a leader can add from the form, with the wording people see. Confirm and dispute come from an entry's page. */
export const ADD_KINDS: [Kind, string, string][] = [
  ["message", "Message", "An email, WhatsApp message or call between you, in its own words or summarised"],
  ["meeting", "Meeting", "Notes of a meeting: who was there, what was discussed and decided"],
  ["document", "Document", "A document one of you shared, such as a plan or a proposal"],
  ["agreement", "Agreement in principle", "Something you both agree: objectives, a roadmap, terms. The other leader confirms it"],
  ["revision", "New version of an agreement", "Replaces an earlier agreement; give its number"],
  ["correction", "Correction", "Corrects an earlier entry; give its number. The earlier entry stays as it was"],
  ["note", "Note", "Anything else worth keeping on the record"],
];
export const KIND_LABEL: Record<Kind, string> = {
  opened: "Record opened", note: "Note", message: "Message", meeting: "Meeting", document: "Document", agreement: "Agreement in principle",
  revision: "New version", correction: "Correction", confirm: "Confirmed", dispute: "Disputed", access: "Access",
};
export const CHANNELS = ["Email", "WhatsApp", "Phone call", "Video call", "In person", "Document", "Other"] as const;
const NEEDS_REF: Kind[] = ["revision", "correction", "confirm", "dispute"];
const GENESIS = "0".repeat(64);

// ---------- the chain ----------

/** The exact text an entry's hash is taken over. Any change to a stored field changes the hash. */
function canonical(e: Omit<Entry, "id" | "hash">) {
  const files = (JSON.parse(e.files_json) as FileMeta[]).map((f) => [f.name, f.type, f.size, f.sha256]);
  return JSON.stringify([e.seq, e.recorded_at, e.occurred_on, e.kind, e.channel, e.title, e.body, e.author_id, e.author_name, e.refers_to, files, e.prev_hash]);
}
const hashOf = (e: Omit<Entry, "id" | "hash">) => sha256Hex(canonical(e));

export interface NewEntry { occurred_on: string; kind: Kind; channel: string; title: string; body: string; author_id: string | null; author_name: string; refers_to: number | null; files: FileMeta[] }

/** Adds an entry at the end of the chain. Two leaders saving at once: the loser retries on the new end. */
export async function appendEntry(db: D1Database, n: NewEntry, id = newId("le")): Promise<Entry> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const last = await db.prepare("SELECT seq, hash FROM leader_entries ORDER BY seq DESC LIMIT 1").first<{ seq: number; hash: string }>();
    const base = {
      seq: (last?.seq ?? 0) + 1, recorded_at: nowIso(), occurred_on: n.occurred_on, kind: n.kind, channel: n.channel, title: n.title, body: n.body,
      author_id: n.author_id, author_name: n.author_name, refers_to: n.refers_to, files_json: JSON.stringify(n.files), prev_hash: last?.hash ?? GENESIS,
    };
    const hash = await hashOf(base);
    try {
      await db.prepare(`INSERT INTO leader_entries (id, seq, recorded_at, occurred_on, kind, channel, title, body, author_id, author_name, refers_to, files_json, prev_hash, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, base.seq, base.recorded_at, base.occurred_on, base.kind, base.channel, base.title, base.body,
        base.author_id, base.author_name, base.refers_to, base.files_json, base.prev_hash, hash).run();
      return { id, ...base, hash };
    } catch (e) {
      if (!/UNIQUE/i.test(String((e as Error)?.message ?? e))) throw e;
    }
  }
  throw new HttpError(409, "Someone else saved at the same moment. Please try again.");
}

/** Recomputes every hash and link. A changed, removed or reordered entry shows as the first entry that fails. */
export async function verifyChain(db: D1Database) {
  const rows = (await db.prepare("SELECT * FROM leader_entries ORDER BY seq").all<Entry>()).results;
  let prev = GENESIS;
  for (let i = 0; i < rows.length; i++) {
    const e = rows[i];
    if (e.seq !== i + 1 || e.prev_hash !== prev || (await hashOf(e)) !== e.hash) return { ok: false, count: rows.length, brokenAt: e.seq };
    prev = e.hash;
  }
  return { ok: true, count: rows.length, last: rows.length ? rows[rows.length - 1].hash : GENESIS };
}

export const entries = async (db: D1Database) => (await db.prepare("SELECT * FROM leader_entries ORDER BY seq").all<Entry>()).results;
export const entryBySeq = (db: D1Database, seq: number) => db.prepare("SELECT * FROM leader_entries WHERE seq = ?").bind(seq).first<Entry>();
export const filesOf = (e: Pick<Entry, "files_json">) => JSON.parse(e.files_json) as FileMeta[];

/** Where each agreement stands: who confirmed or disputed it (their latest answer counts), and whether it was replaced. */
export interface AgreementStatus { entry: Entry; answers: { leader: string; kind: "confirm" | "dispute"; seq: number; on: string }[]; awaiting: string[]; supersededBy: number | null }
export function agreementStatus(all: Entry[], leaders: Pick<Leader, "id" | "name" | "active">[]): AgreementStatus[] {
  return all.filter((e) => e.kind === "agreement" || e.kind === "revision").map((e) => {
    const latest = new Map<string, Entry>();
    for (const r of all) if ((r.kind === "confirm" || r.kind === "dispute") && r.refers_to === e.seq && r.author_id) latest.set(r.author_id, r);
    const answers = [...latest.values()].map((r) => ({ leader: r.author_name, kind: r.kind as "confirm" | "dispute", seq: r.seq, on: r.recorded_at.slice(0, 10) }));
    const awaiting = leaders.filter((l) => l.active && l.id !== e.author_id && !latest.has(l.id)).map((l) => l.name);
    const sup = all.find((r) => r.kind === "revision" && r.refers_to === e.seq);
    return { entry: e, answers, awaiting, supersededBy: sup?.seq ?? null };
  });
}

// ---------- adding entries ----------

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export function validateEntry(f: Record<string, unknown>, today: string, maxSeq: number) {
  const s = (k: string) => String(f[k] ?? "").trim();
  const kind = s("kind") as Kind, ref = s("refers_to").replace(/^#/, "");
  const v = { kind, occurred_on: s("occurred_on"), channel: s("channel"), title: s("title"), body: s("body"), refers_to: ref ? Number(ref) : null };
  const e: Record<string, string> = {};
  if (!ADD_KINDS.some(([k]) => k === kind)) e.kind = "Please choose what kind of entry this is.";
  if (!isDate(v.occurred_on) || v.occurred_on > today) e.occurred_on = "Please give the date it happened (today or earlier).";
  if (v.channel && !(CHANNELS as readonly string[]).includes(v.channel)) e.channel = "Please choose how it happened.";
  if (v.title.length < 3 || v.title.length > 140) e.title = "Please give a short title (3 to 140 characters).";
  if (v.body.length > 20000) e.body = "That's too long for one entry. Attach it as a document instead.";
  if (NEEDS_REF.includes(kind) && !(v.refers_to && Number.isInteger(v.refers_to) && v.refers_to >= 1 && v.refers_to <= maxSeq)) e.refers_to = "Please give the number of the earlier entry this refers to.";
  if (v.refers_to !== null && !(Number.isInteger(v.refers_to) && v.refers_to >= 1 && v.refers_to <= maxSeq)) e.refers_to = "There's no entry with that number.";
  return Object.keys(e).length ? { ok: false as const, errors: e } : { ok: true as const, value: v };
}

const ZIP_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
/** The file's real type, from its first bytes (and its extension for Office files and plain text), or "" if not allowed. */
export function fileType(head: Uint8Array, name: string) {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const at = (i: number, ...b: number[]) => b.every((x, j) => head[i + j] === x);
  if (at(0, 0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (at(0, 0x50, 0x4b, 0x03, 0x04) && ZIP_TYPES[ext]) return ZIP_TYPES[ext];
  if ((ext === "txt" || ext === "eml") && !head.includes(0)) return ext === "eml" ? "message/rfc822" : "text/plain";
  return "";
}
export const MAX_FILES = 5, MAX_FILE_BYTES = 10_000_000;

/** Stores the attachments in R2 under the entry's id and returns their details, hashes included. */
export async function storeFiles(env: Env, entryId: string, files: File[]) {
  const real = files.filter((f) => f instanceof File && f.size > 0);
  if (!real.length) return [] as FileMeta[];
  if (!env.MEDIA) throw new HttpError(503, "File storage isn't available.");
  if (real.length > MAX_FILES) throw new HttpError(400, `Please attach at most ${MAX_FILES} files to one entry.`);
  const out: FileMeta[] = [], bufs: Uint8Array[] = [];
  for (const [i, f] of real.entries()) {
    if (f.size > MAX_FILE_BYTES) throw new HttpError(400, `${f.name} is over 10 MB.`);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const type = fileType(bytes.slice(0, 16), f.name);
    if (!type) throw new HttpError(400, `${f.name}: please attach a PDF, Word, Excel or PowerPoint file, a photo (JPEG, PNG, WebP), a text file or a saved email (.eml).`);
    const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const name = f.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || `file-${i + 1}`;
    out.push({ name, type, size: f.size, sha256: sha, key: `leadership/${entryId}/${i + 1}` }); bufs.push(bytes);
  }
  await Promise.all(out.map((m, i) => env.MEDIA!.put(m.key, bufs[i], { httpMetadata: { contentType: m.type } })));
  return out;
}
export async function dropFiles(env: Env, files: FileMeta[]) { await Promise.all(files.map((f) => env.MEDIA?.delete(f.key))); }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Emails each active leader a copy of a new entry: a witness copy of the record outside the system. Never throws. */
export async function emailEntry(env: Env, e: Entry, site: string) {
  const leaders = (await env.DB.prepare("SELECT name, email FROM leaders WHERE active = 1").all<{ name: string; email: string }>()).results;
  const files = filesOf(e);
  const lines = [
    `Leadership record, entry #${e.seq}: ${KIND_LABEL[e.kind]}`, `${e.title}`,
    `Happened on ${e.occurred_on}${e.channel ? ` (${e.channel})` : ""}. Recorded ${e.recorded_at.replace("T", " ").slice(0, 16)} UTC by ${e.author_name}.`,
    ...(e.refers_to ? [`Refers to entry #${e.refers_to}.`] : []),
    ...(e.body ? ["", e.body.slice(0, 4000) + (e.body.length > 4000 ? "\n[…continues in the record]" : "")] : []),
    ...(files.length ? ["", "Files:", ...files.map((f) => `- ${f.name} (${Math.ceil(f.size / 1024)} KB, SHA-256 ${f.sha256})`)] : []),
    "", `Entry fingerprint (SHA-256): ${e.hash}`, `Open it: ${site}/leadership/entries/${e.seq}`,
    "", "Keep this email: it is your copy of the entry. The record cannot be changed; corrections are added as new entries.",
  ];
  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#302A2E;line-height:1.55;max-width:600px"><p style="font-size:20px;font-weight:bold;color:#8A2E5C;margin:0">aestheva <span style="font-size:13px;font-weight:normal;color:#857A80">leadership record</span></p><pre style="font-family:Arial,sans-serif;white-space:pre-wrap;margin-top:14px">${esc(text)}</pre></div>`;
  await Promise.all(leaders.map((l) => sendEmail(env, l.email, { subject: `Leadership record #${e.seq}: ${e.title}`, text, html }).catch(() => null)));
}

// ---------- leaders and access (managed from the team area) ----------

export const leaders = async (db: D1Database) => (await db.prepare("SELECT * FROM leaders ORDER BY created_at").all<Leader>()).results;
export const leaderById = (db: D1Database, id: string) => db.prepare("SELECT * FROM leaders WHERE id = ?").bind(id).first<Leader>();

async function ensureOpened(db: D1Database) {
  if (await db.prepare("SELECT 1 FROM leader_entries LIMIT 1").first()) return;
  await appendEntry(db, { occurred_on: nowIso().slice(0, 10), kind: "opened", channel: "", title: "Leadership record opened",
    body: "A private record of the communications, documents and agreements between Aestheva's leaders, kept in order. Entries cannot be changed or deleted; corrections and new versions are added as new entries. Each entry is emailed to every leader.",
    author_id: null, author_name: "Aestheva (system)", refers_to: null, files: [] });
}

/** Adds a leader's login. Every change of access is itself an entry in the record, so it is visible to all leaders. */
export async function addLeader(db: D1Database, f: Record<string, unknown>) {
  const name = String(f.name ?? "").trim(), role = String(f.role ?? "").trim(), email = String(f.email ?? "").trim().toLowerCase();
  if (name.length < 2 || name.length > 80) throw new HttpError(400, "Please give the leader's full name.");
  if (role.length < 2 || role.length > 80) throw new HttpError(400, "Please give their role, for example Managing Director.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "Please give a valid email address: it becomes their login.");
  if (await db.prepare("SELECT 1 FROM leaders WHERE email = ?").bind(email).first()) throw new HttpError(409, "That email already has a leadership login.");
  await ensureOpened(db);
  const id = newId("ld");
  await db.batch([
    db.prepare("INSERT INTO leaders (id, name, role, email, password_hash) VALUES (?, ?, ?, ?, ?)").bind(id, name, role, email, `unset$${newToken()}`),
    audit(db, "ops", "leader.added", "leader", id, { role }),
  ]);
  await appendEntry(db, { occurred_on: nowIso().slice(0, 10), kind: "access", channel: "", title: `Access given: ${name}, ${role}`,
    body: `${name} (${role}) was given a login to the leadership record.`, author_id: null, author_name: "Aestheva team area", refers_to: null, files: [] });
  return id;
}
export async function setLeaderActive(db: D1Database, id: string, active: boolean) {
  const l = await leaderById(db, id);
  if (!l) throw new HttpError(404, "Unknown leader");
  if (!!l.active === active) return;
  await db.batch([db.prepare("UPDATE leaders SET active = ? WHERE id = ?").bind(active ? 1 : 0, id), audit(db, "ops", active ? "leader.enabled" : "leader.disabled", "leader", id)]);
  await appendEntry(db, { occurred_on: nowIso().slice(0, 10), kind: "access", channel: "", title: `${active ? "Access restored" : "Access turned off"}: ${l.name}`,
    body: `${l.name}'s login to the leadership record was ${active ? "turned back on" : "turned off"}. Their entries stay in the record.`, author_id: null, author_name: "Aestheva team area", refers_to: null, files: [] });
}

// ---------- sign-in, set-password links and sessions ----------

const LINK_HOURS = { invite: 72, reset: 1 } as const;
type Purpose = keyof typeof LINK_HOURS;
export async function issueLeaderLink(db: D1Database, leaderId: string, purpose: Purpose, actor: string) {
  const token = newToken() + newToken();
  await db.batch([
    db.prepare("INSERT INTO leader_links (id, leader_id, token_hash, purpose, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(newId("ll"), leaderId, await sha256Hex(token), purpose, new Date(Date.now() + LINK_HOURS[purpose] * 36e5).toISOString()),
    audit(db, actor, `leader.${purpose}_link`, "leader", leaderId),
  ]);
  return token;
}
export async function leaderForLink(db: D1Database, token: string) {
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return null;
  return db.prepare(`SELECT k.purpose, l.* FROM leader_links k JOIN leaders l ON l.id = k.leader_id
    WHERE k.token_hash = ? AND k.used_at IS NULL AND k.expires_at > ? AND l.active = 1`).bind(await sha256Hex(token), nowIso()).first<Leader & { purpose: Purpose }>();
}
export async function setLeaderPassword(db: D1Database, token: string, password: string, confirm: string) {
  const l = await leaderForLink(db, token);
  if (!l) throw new HttpError(410, "This link has expired or has already been used.");
  if (password !== confirm) throw new HttpError(400, "The two passwords don't match.");
  const problem = passwordProblem(password, l.email);
  if (problem) throw new HttpError(400, problem);
  const ts = nowIso();
  await db.batch([
    db.prepare("UPDATE leaders SET password_hash = ? WHERE id = ?").bind(await hashPassword(password), l.id),
    db.prepare("UPDATE leader_links SET used_at = ? WHERE leader_id = ? AND used_at IS NULL").bind(ts, l.id),
    audit(db, `leader:${l.id}`, "leader.password_set", "leader", l.id, { via: l.purpose }),
  ]);
}
export async function emailLeaderLink(env: Env, l: Pick<Leader, "name" | "email">, url: string, purpose: Purpose) {
  const invite = purpose === "invite", first = l.name.split(" ")[0], until = invite ? "3 days" : "1 hour";
  const lead = invite ? "You have been given access to Aestheva's leadership record: the private, dated record of the communications, documents and agreements between Aestheva's leaders. You can read every entry, add your own and confirm or dispute agreements."
    : "Someone asked to reset your password for Aestheva's leadership record. If it wasn't you, ignore this email.";
  const text = `Hello ${first},\n\n${lead}\n\n${invite ? "Set your password" : "Choose a new password"} here (the link works once, for ${until}):\n${url}\n\nYour login email is ${l.email}. After that, sign in at ${new URL(url).origin}/leadership.\n\nAestheva`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#302A2E;line-height:1.55;max-width:520px"><p style="font-size:22px;font-weight:bold;color:#8A2E5C;margin:0">aestheva <span style="font-size:14px;font-weight:normal;color:#857A80">leadership</span></p>
    <p style="margin-top:16px">Hello ${esc(first)},</p><p>${esc(lead)}</p><p style="margin:22px 0"><a href="${esc(url)}" style="background:#8A2E5C;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">${invite ? "Set your password" : "Choose a new password"}</a></p>
    <p style="color:#6B5F65;font-size:13px">The link works once, for ${until}. Your login email is <b>${esc(l.email)}</b>.</p></div>`;
  return sendEmail(env, l.email, { subject: invite ? "Your access to Aestheva's leadership record" : "Reset your Aestheva leadership password", text, html });
}
export async function inviteLeader(env: Env, id: string, site: string) {
  const l = await leaderById(env.DB, id);
  if (!l || !l.active) throw new HttpError(404, "Unknown leader");
  const url = `${site}/leadership/set-password?t=${await issueLeaderLink(env.DB, id, "invite", "ops")}`;
  const r = await emailLeaderLink(env, l, url, "invite");
  return { sent: r.ok, email: l.email, link: r.ok ? undefined : url, code: r.code };
}
export async function requestLeaderReset(env: Env, email: string, site: string) {
  const l = await env.DB.prepare("SELECT * FROM leaders WHERE email = ? AND active = 1").bind(email.trim().toLowerCase()).first<Leader>();
  if (!l) return;
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM leader_links WHERE leader_id = ? AND purpose = 'reset' AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')").bind(l.id).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 3) return;
  await emailLeaderLink(env, l, `${site}/leadership/set-password?t=${await issueLeaderLink(env.DB, l.id, "reset", "leader")}`, "reset");
}
export async function checkLeaderLogin(db: D1Database, email: string, password: string) {
  const l = await db.prepare("SELECT * FROM leaders WHERE email = ?").bind(email).first<Leader>();
  return l && l.active && (await checkPassword(password, l.password_hash)) ? l : null;
}
/** Sessions are signed with OPS_KEY and tied to the password hash and the login being on, so a reset or a turned-off login ends them. */
export async function leaderSession(key: string, l: Leader, exp: number) {
  return `${l.id}.${exp}.${await hmacSha256Hex(key, `leader|${l.id}|${exp}|${l.password_hash.slice(-16)}|${l.active}`)}`;
}
export async function leaderFromSession(db: D1Database, key: string, cookie: string) {
  const [id, expS, sig] = cookie.split(".");
  const exp = Number(expS);
  if (!key || !id || !sig || !(exp > Date.now())) return null;
  const l = await leaderById(db, id);
  if (!l || !l.active) return null;
  return safeEqual(sig, (await leaderSession(key, l, exp)).split(".")[2]) ? { leader: l, exp } : null;
}

// ---------- export ----------

const csvCell = (v: unknown) => { const t = String(v ?? ""); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function recordCsv(all: Entry[]) {
  const rows = [["#", "Recorded at (UTC)", "Happened on", "Kind", "Channel", "Title", "Text", "Recorded by", "Refers to", "Files (name, SHA-256)", "Previous fingerprint", "Fingerprint"],
    ...all.map((e) => [e.seq, e.recorded_at, e.occurred_on, KIND_LABEL[e.kind], e.channel, e.title, e.body, e.author_name, e.refers_to ?? "",
      filesOf(e).map((f) => `${f.name} ${f.sha256}`).join("; "), e.prev_hash, e.hash])];
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
