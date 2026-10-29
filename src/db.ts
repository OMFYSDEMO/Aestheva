export class HttpError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) { super(message); }
}

export const nowIso = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

// Booking references avoid look-alike characters (0/O, 1/I/L).
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newRef(prefix = "AE"): string {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return prefix + "-" + Array.from(b, (x) => REF_ALPHABET[x % REF_ALPHABET.length]).join("");
}
export function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, "0")).join("");
export async function sha256Hex(s: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}
/** Constant-time comparison of two strings. */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function isUniqueViolation(e: unknown, table?: string): boolean {
  const m = String((e as Error)?.message ?? e);
  return m.includes("UNIQUE constraint failed") && (!table || m.includes(table));
}

export function audit(db: D1Database, actor: string, action: string, entity: string, entityId: string, data?: unknown): D1PreparedStatement {
  return db.prepare("INSERT INTO audit_log (actor, action, entity, entity_id, data_json) VALUES (?, ?, ?, ?, ?)")
    .bind(actor, action, entity, entityId, data === undefined ? null : JSON.stringify(data));
}
