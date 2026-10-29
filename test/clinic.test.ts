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

describe("clinic portal", () => {
  const rp = fakeRazorpay();
  let opsCookie = "", cookie = "", csrf = "", password = "";
  const date = workday();

  beforeAll(async () => {
    rp.install();
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

  it("lets the team issue a login, shown once, and the clinic sign in with it", async () => {
    const page = await send("GET", "/ops/clinics", undefined, opsCookie);
    expect(page.text).toContain("Lumière Skin &amp; Laser Clinic");
    const made = await send("POST", "/ops/clinics", { csrf: csrfIn(page.text), provider: "p1", name: "Front desk", email: "Desk@Lumiere.example" }, opsCookie);
    password = /<code[^>]*>([a-z0-9-]{19})<\/code>/.exec(made.text)![1];
    expect(made.text).toContain("desk@lumiere.example");
    const [u] = await sql("SELECT password_hash FROM provider_users WHERE email = 'desk@lumiere.example'");
    expect(u.password_hash).toMatch(/^pbkdf2-sha256\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(u.password_hash).not.toContain(password);

    expect((await send("POST", "/clinic/login", { email: "desk@lumiere.example", password: "wrong-pass" })).status).toBe(401);
    const ok = await send("POST", "/clinic/login", { email: " DESK@lumiere.example ", password });
    expect(ok.status).toBe(303);
    const set = ok.headers.get("set-cookie")!;
    expect(set).toMatch(/HttpOnly/i); expect(set).toMatch(/SameSite=Strict/i); expect(set).toMatch(/Path=\/clinic/);
    cookie = set.split(";")[0];
    const today = await send("GET", "/clinic", undefined, cookie);
    expect(today.status).toBe(200);
    expect(today.text).toContain("Lumière Skin &amp; Laser Clinic");
    expect(today.headers.get("cache-control")).toBe("no-store");
    csrf = csrfIn(today.text);
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
    expect(page.text).toContain("₹500</b> at the clinic");
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

  it("rejects forged forms, and a password reset ends existing sessions", async () => {
    expect((await send("POST", "/clinic/new", { csrf: "0".repeat(64), service: "v1", staff: "s1", date, start: "900", name: "Forged", phone: "9847077777" }, cookie)).status).toBe(403);
    const ops = await send("GET", "/ops/clinics", undefined, opsCookie);
    const [u] = await sql("SELECT id FROM provider_users WHERE email = 'desk@lumiere.example'");
    const reset = await send("POST", `/ops/clinics/${u.id}/reset`, { csrf: csrfIn(ops.text) }, opsCookie);
    expect(reset.text).toContain("The old one no longer works");
    expect((await send("GET", "/clinic", undefined, cookie)).status).toBe(303);
    expect((await send("POST", "/clinic/login", { email: "desk@lumiere.example", password })).status).toBe(401);
  });

  it("locks an email after five wrong passwords in 15 minutes", async () => {
    for (let i = 0; i < 5; i++) await send("POST", "/clinic/login", { email: "lock@example.com", password: "x" });
    expect((await send("POST", "/clinic/login", { email: "lock@example.com", password: "x" })).status).toBe(429);
  });
});
