import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { dowOf } from "../src/domain/time";
import { day, fakeRazorpay, guest, req, seed, sql } from "./helpers";

beforeAll(seed);

async function send(method: string, path: string, form?: Record<string, string>, cookie?: string) {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, redirect: "manual", body: form ? new URLSearchParams(form).toString() : undefined,
    headers: { ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(cookie ? { cookie } : {}) },
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  return { status: res.status, text: await res.text(), headers: res.headers };
}
const csrfIn = (html: string) => /name="csrf" value="([0-9a-f]{64})"/.exec(html)![1];
// A Monday-to-Saturday date a few days ahead, when Dr. Meera Nair (s1) has online hours 10:00–17:00.
const workday = () => { for (let n = 3; ; n++) if (dowOf(day(n)) !== 0) return day(n); };

const linkIn = (text: string) => /https:\/\/aestheva\.test(\/clinic\/set-password\?t=[A-Za-z0-9_-]+)/.exec(text)![1];

describe("clinic portal", () => {
  const rp = fakeRazorpay();
  let opsCookie = "", cookie = "", csrf = "";
  const password = "tea at technopark at four";
  type Sent = { to: string; subject: string; text: string };
  let sent: Sent[] = [], failWith: string | null = null;
  const date = workday();

  beforeAll(async () => {
    rp.install();
    (env as { EMAIL: unknown }).EMAIL = { send: async (m: Sent) => { if (failWith) throw Object.assign(new Error("nope"), { code: failWith }); sent.push(m); return { messageId: "m" }; } };
    const login = await send("POST", "/ops/login", { key: "test-ops-key" });
    opsCookie = login.headers.get("set-cookie")!.split(";")[0];
  });

  it("is private: signed-out visitors are sent to sign in", async () => {
    for (const p of ["/clinic", "/clinic/calendar", "/clinic/bookings", "/clinic/payments"]) {
      const r = await send("GET", p);
      expect(r.status, p).toBe(303);
      expect(r.headers.get("location")).toBe("/clinic/login");
    }
  });

  it("emails an invitation with a one-time link; the clinic sets its own password and signs in", async () => {
    const page = await send("GET", "/ops/clinics", undefined, opsCookie);
    expect(page.text).toContain("Lumière Skin &amp; Laser Clinic");
    sent = [];
    const made = await send("POST", "/ops/clinics", { csrf: csrfIn(page.text), provider: "p1", name: "Front desk", email: "Desk@Lumiere.example" }, opsCookie);
    expect(made.text).toContain("emailed desk@lumiere.example a link");
    expect(made.text).not.toContain("/clinic/set-password?t=");   // sent by email, so not shown
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("desk@lumiere.example");
    expect(sent[0].subject).toBe("Your Aestheva login for Lumière Skin & Laser Clinic");
    const link = linkIn(sent[0].text);
    // Until the password is set, nothing signs in.
    expect((await send("POST", "/clinic/login", { email: "desk@lumiere.example", password: "" })).status).toBe(401);
    const form = await send("GET", link);
    expect(form.status).toBe(200);
    expect(form.text).toContain("Set your password");
    expect(form.headers.get("referrer-policy")).toBe("no-referrer");
    const t = new URL(`https://x${link}`).searchParams.get("t")!;
    for (const [pw, msg] of [["short", "at least 10 characters"], ["desk-12345678", "too easy to guess"], ["password2026!", "too easy to guess"]] as const) {
      const r = await send("POST", "/clinic/set-password", { t, password: pw, confirm: pw });
      expect(r.status).toBe(400); expect(r.text).toContain(msg);
    }
    expect((await send("POST", "/clinic/set-password", { t, password: "monsoon over kovalam", confirm: "monsoon over kowdiar" })).text).toContain("don&#39;t match");
    const ok = await send("POST", "/clinic/set-password", { t, password: password, confirm: password });
    expect(ok.headers.get("location")).toBe("/clinic/login?set=1");
    expect((await send("GET", link)).status).toBe(410);   // a link works once
    const [u] = await sql("SELECT password_hash FROM provider_users WHERE email = 'desk@lumiere.example'");
    expect(u.password_hash).toMatch(/^pbkdf2-sha256\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);

    expect((await send("POST", "/clinic/login", { email: "desk@lumiere.example", password: "wrong-pass" })).status).toBe(401);
    const signed = await send("POST", "/clinic/login", { email: " DESK@lumiere.example ", password });
    expect(signed.status).toBe(303);
    const set = signed.headers.get("set-cookie")!;
    expect(set).toMatch(/HttpOnly/i); expect(set).toMatch(/SameSite=Strict/i); expect(set).toMatch(/Path=\/clinic/);
    cookie = set.split(";")[0];
    const today = await send("GET", "/clinic", undefined, cookie);
    expect(today.status).toBe(200);
    expect(today.text).toContain("Lumière Skin &amp; Laser Clinic");
    expect(today.headers.get("cache-control")).toBe("no-store");
    csrf = csrfIn(today.text);
  });

  it("shows the link once on the team page when the email can't be sent", async () => {
    const page = await send("GET", "/ops/clinics", undefined, opsCookie);
    failWith = "E_RECIPIENT_NOT_ALLOWED";
    try {
      const r = await send("POST", "/ops/clinics", { csrf: csrfIn(page.text), provider: "p1", name: "Owner", email: "owner@lumiere.example" }, opsCookie);
      expect(r.text).toContain("the email didn't send (E_RECIPIENT_NOT_ALLOWED)");
      expect(r.text).toMatch(/\/clinic\/set-password\?t=[A-Za-z0-9_-]{40,}/);
      expect(r.text).toContain("Email Sending");
    } finally { failWith = null; }
  });

  it("takes a phone booking outside online hours that then blocks online clients", async () => {
    // 9:30 is before Dr. Meera's online hours; 10:00 is inside them.
    const early = await send("POST", "/clinic/new", { csrf, service: "v1", staff: "s1", date, start: "570", name: "Lakshmi Varma", phone: "9847011111", email: "", note: "Prefers mornings" }, cookie);
    expect(early.status).toBe(200);
    expect(early.text).toContain("Send confirmation on WhatsApp");
    expect(early.text).toMatch(/https:\/\/wa\.me\/919847011111\?text=/);
    const inside = await send("POST", "/clinic/new", { csrf, service: "v1", staff: "s1", date, start: "600", name: "Lakshmi Varma", phone: "9847011111" }, cookie);
    const ref = /Booked · (AE-[A-Z0-9]{6})/.exec(inside.text)![1];
    const [b] = await sql("SELECT source, deposit_paise, commission_bp, status FROM bookings WHERE ref = ?", ref);
    expect(b).toEqual({ source: "direct", deposit_paise: 0, commission_bp: 0, status: "confirmed" });
    const slots = await req("GET", `/api/slots?service=v1&staff=s1&from=${date}&days=1`);
    expect(slots.json.days[0].slots.map((s: { min: number }) => s.min)).not.toContain(600);
    // The same time again is refused, with a reason the desk can act on.
    const again = await send("POST", "/clinic/new", { csrf, service: "v1", staff: "s1", date, start: "600", name: "Someone Else", phone: "9847022222" }, cookie);
    expect(again.status).toBe(409);
    expect(again.text).toContain("already has a booking at that time");
    expect(again.text).toContain('value="Someone Else"');
  });

  it("shows the day on the calendar with practitioner columns", async () => {
    const cal = await send("GET", `/clinic/calendar?date=${date}`, undefined, cookie);
    for (const s of ["Dr. Meera Nair", "Dr. Arjun Menon", "Lakshmi Varma", "Online 10:00 am–5:00 pm", `/clinic/new?date=${date}&amp;staff=s1&amp;start=`]) expect(cal.text).toContain(s);
  });

  it("blocks time so online booking skips it, refuses a block over a booking, and removes it", async () => {
    const r = await send("POST", "/clinic/blocks", { csrf, staff: "s1", date, start: "660", end: "720", reason: "Leave" }, cookie);
    expect(r.status).toBe(303);
    let mins = (await req("GET", `/api/slots?service=v1&staff=s1&from=${date}&days=1`)).json.days[0].slots.map((s: { min: number }) => s.min);
    expect(mins).not.toContain(660); expect(mins).not.toContain(690); expect(mins).toContain(720);
    const clash = await send("POST", "/clinic/blocks", { csrf, staff: "s1", date, start: "600", end: "630", reason: "" }, cookie);
    expect(clash.status).toBe(409);
    expect(clash.text).toContain("has a booking");
    const into = await send("POST", "/clinic/new", { csrf, service: "v1", staff: "s1", date, start: "660", name: "Blocked Try", phone: "9847033333" }, cookie);
    expect(into.text).toContain("marked unavailable");
    const [blk] = await sql("SELECT id FROM staff_blocks WHERE staff_id = 's1' AND date = ?", date);
    await send("POST", `/clinic/blocks/${blk.id}/delete`, { csrf, date }, cookie);
    mins = (await req("GET", `/api/slots?service=v1&staff=s1&from=${date}&days=1`)).json.days[0].slots.map((s: { min: number }) => s.min);
    expect(mins).toContain(660);
  });

  it("cancels an online booking with a full deposit refund", async () => {
    const r0 = await req("POST", "/api/bookings", { serviceId: "v1", staffId: "s1", date, start: 840, ...guest, phone: "9847044444", ackMedical: true });
    await req("POST", `/api/bookings/${r0.json.ref}/payment`, await rp.pay(r0.json.payment.orderId));
    const page = await send("GET", `/clinic/bookings/${r0.json.ref}`, undefined, cookie);
    expect(page.text).toContain("Deposit</dt><dd>₹300 paid online");
    expect(page.text).toContain("₹500</b> on the day");
    const noReason = await send("POST", `/clinic/bookings/${r0.json.ref}`, { csrf, action: "cancel", reason: "" }, cookie);
    expect(noReason.status).toBe(400);
    const done = await send("POST", `/clinic/bookings/${r0.json.ref}`, { csrf, action: "cancel", reason: "Doctor unwell" }, cookie);
    expect(done.headers.get("location")).toBe(`/clinic/bookings/${r0.json.ref}?done=refunded`);
    expect((await sql("SELECT status, cancelled_by, cancel_reason FROM bookings WHERE ref = ?", r0.json.ref))[0]).toEqual({ status: "cancelled", cancelled_by: "provider", cancel_reason: "Doctor unwell" });
    expect((await sql("SELECT p.status FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.ref = ?", r0.json.ref))[0].status).toBe("refunded");
    expect(rp.calls.some((c) => c.path.endsWith("/refund") && c.body.amount === 30000)).toBe(true);
  });

  it("marks past appointments completed or no-show, never future ones", async () => {
    const [b] = await sql("SELECT ref FROM bookings WHERE source = 'direct' AND start_min = 600 AND date = ?", date);
    const early = await send("POST", `/clinic/bookings/${b.ref}`, { csrf, action: "completed" }, cookie);
    expect(early.status).toBe(409);
    await sql("UPDATE bookings SET date = ? WHERE ref = ?", day(-1), b.ref);
    const ok = await send("POST", `/clinic/bookings/${b.ref}`, { csrf, action: "completed" }, cookie);
    expect(ok.status).toBe(303);
    expect((await sql("SELECT status FROM bookings WHERE ref = ?", b.ref))[0].status).toBe("completed");
    const pay = await send("GET", `/clinic/payments?month=${day(-1).slice(0, 7)}`, undefined, cookie);
    expect(pay.text).toContain("Lakshmi Varma");
  });

  it("never shows or changes another clinic's bookings", async () => {
    const other = await req("POST", "/api/bookings", { serviceId: "v7", staffId: "s5", date, start: 600, ...guest, phone: "9847055555" });
    expect((await send("GET", `/clinic/bookings/${other.json.ref}`, undefined, cookie)).status).toBe(404);
    expect((await send("POST", `/clinic/bookings/${other.json.ref}`, { csrf, action: "cancel", reason: "nope" }, cookie)).status).toBe(404);
    expect((await sql("SELECT status FROM bookings WHERE ref = ?", other.json.ref))[0].status).toBe("held");
    const foreign = await send("POST", "/clinic/new", { csrf, service: "v7", staff: "s5", date, start: "600", name: "Cross Venue", phone: "9847066666" }, cookie);
    expect(foreign.status).toBe(400);
    const bookings = await send("GET", "/clinic/bookings", undefined, cookie);
    expect(bookings.text).not.toContain(other.json.ref);
  });

  it("rejects forged forms, and resetting the password by email ends existing sessions", async () => {
    expect((await send("POST", "/clinic/new", { csrf: "0".repeat(64), service: "v1", staff: "s1", date, start: "900", name: "Forged", phone: "9847077777" }, cookie)).status).toBe(403);
    sent = [];
    const unknown = await send("POST", "/clinic/forgot", { email: "nobody@example.com" });
    const known = await send("POST", "/clinic/forgot", { email: "desk@lumiere.example" });
    expect(unknown.text).toContain("If that email has a clinic login");
    expect(known.text).toContain("If that email has a clinic login");   // same answer either way
    expect(sent.map((m) => m.to)).toEqual(["desk@lumiere.example"]);
    expect(sent[0].subject).toBe("Reset your Aestheva password");
    const t = new URL(`https://x${linkIn(sent[0].text)}`).searchParams.get("t")!;
    await send("POST", "/clinic/set-password", { t, password: "a new kerala morning", confirm: "a new kerala morning" });
    expect((await send("GET", "/clinic", undefined, cookie)).status).toBe(303);
    expect((await send("POST", "/clinic/login", { email: "desk@lumiere.example", password })).status).toBe(401);
    expect((await send("POST", "/clinic/login", { email: "desk@lumiere.example", password: "a new kerala morning" })).status).toBe(303);
  });

  it("refuses expired links and limits reset emails to three an hour", async () => {
    sent = [];
    await sql("DELETE FROM password_links WHERE purpose = 'reset'");   // the previous test's reset counts towards the hour
    for (let i = 0; i < 4; i++) await send("POST", "/clinic/forgot", { email: "desk@lumiere.example" });
    expect(sent).toHaveLength(3);
    const t = new URL(`https://x${linkIn(sent[0].text)}`).searchParams.get("t")!;
    await sql("UPDATE password_links SET expires_at = '2000-01-01T00:00:00Z' WHERE used_at IS NULL");
    const r = await send("POST", "/clinic/set-password", { t, password: "too late for this", confirm: "too late for this" });
    expect(r.status).toBe(410);
    expect(r.text).toContain("This link has expired");
  });

  it("locks an email after five wrong passwords in 15 minutes", async () => {
    for (let i = 0; i < 5; i++) await send("POST", "/clinic/login", { email: "lock@example.com", password: "x" });
    expect((await send("POST", "/clinic/login", { email: "lock@example.com", password: "x" })).status).toBe(429);
  });
});
