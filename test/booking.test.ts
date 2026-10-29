import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { cancelByClient, expireHolds, bookingByRef } from "../src/services/bookings";
import { istToUtc } from "../src/domain/time";
import { day, fakeRazorpay, guest, req, seed, sql, webhook } from "./helpers";

// Abhyanga (v7) at Saanvi Ayur Wellness: 90 minutes, ₹2,800, ₹500 deposit, therapists s5 (08:00–18:00) and s6 (10:00–20:00) every day.
const ABHYANGA = { serviceId: "v7", ...guest };
const token = (manageUrl: string) => new URL(manageUrl).searchParams.get("t")!;

beforeAll(seed);

describe("booking with a Razorpay deposit", () => {
  const rp = fakeRazorpay();
  beforeAll(() => rp.install());
  const date = day(3);
  let first: any, second: any;

  it("lists live slots for a service", async () => {
    const r = await req("GET", `/api/slots?service=v7&staff=s5&from=${date}&days=1`);
    expect(r.status).toBe(200);
    expect(r.json.days[0].slots[0]).toMatchObject({ min: 480, label: "8:00 am", staffId: "s5" });
    expect(r.json.days[0].slots.at(-1).min).toBe(990);   // last 90-minute start before 18:00
  });

  it("holds the slot and opens a Razorpay order for the deposit", async () => {
    const r = await req("POST", "/api/bookings", { ...ABHYANGA, staffId: "s5", date, start: 600 });
    expect(r.status).toBe(201);
    first = r.json;
    expect(first.status).toBe("held");
    expect(first.ref).toMatch(/^AE-[2-9A-Z]{6}$/);
    expect(first.payment).toMatchObject({ gateway: "razorpay", keyId: "rzp_test_key", amount: 50000, currency: "INR" });
    expect(rp.calls.at(-1)).toMatchObject({ method: "POST", path: "/orders", body: { amount: 50000, currency: "INR", receipt: first.ref } });
    const slots = await sql("SELECT slot FROM staff_slots WHERE staff_id = 's5' AND date = ? ORDER BY slot", date);
    expect(slots.map((s) => s.slot)).toEqual([20, 21, 22]);   // 10:00–11:30
  });

  it("refuses a second booking that overlaps the held time, and finds another practitioner for 'any'", async () => {
    const clash = await req("POST", "/api/bookings", { ...ABHYANGA, phone: "9123456780", staffId: "s5", date, start: 630 });
    expect(clash.status).toBe(409);
    const any = await req("POST", "/api/bookings", { ...ABHYANGA, phone: "9123456780", staffId: "any", date, start: 630 });
    expect(any.status).toBe(201);
    second = any.json;
    const b = await bookingByRef(env.DB, second.ref);
    expect(b!.staff_id).toBe("s6");
    const slots = (await req("GET", `/api/slots?service=v7&staff=s5&from=${date}&days=1`)).json.days[0].slots.map((s: any) => s.min);
    expect(slots).not.toContain(600);
    expect(slots).not.toContain(570);   // a 9:30 start would run into the 10:00 hold
  });

  it("rejects a checkout callback with a bad signature", async () => {
    const paid = await rp.pay(first.payment.orderId);
    const r = await req("POST", `/api/bookings/${first.ref}/payment`, { ...paid, razorpay_signature: "0".repeat(64) });
    expect(r.status).toBe(400);
    expect((await bookingByRef(env.DB, first.ref))!.status).toBe("held");
  });

  it("confirms the booking from a verified checkout callback", async () => {
    const paid = await rp.pay(first.payment.orderId);
    const r = await req("POST", `/api/bookings/${first.ref}/payment`, paid);
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ outcome: "confirmed", status: "confirmed" });
    const [p] = await sql("SELECT status, payment_id, method FROM payments WHERE order_id = ?", first.payment.orderId);
    expect(p).toEqual({ status: "captured", payment_id: paid.razorpay_payment_id, method: "upi" });
    // Calling again is harmless.
    expect((await req("POST", `/api/bookings/${first.ref}/payment`, paid)).json.outcome).toBe("already_applied");
  });

  it("captures an authorised-only payment before confirming", async () => {
    const r0 = await req("POST", "/api/bookings", { ...ABHYANGA, phone: "9000000001", staffId: "s5", date, start: 900 });
    const paid = await rp.pay(r0.json.payment.orderId, "authorized");
    const r = await req("POST", `/api/bookings/${r0.json.ref}/payment`, paid);
    expect(r.json.status).toBe("confirmed");
    expect(rp.calls.some((c) => c.path === `/payments/${paid.razorpay_payment_id}/capture` && c.body.amount === 50000)).toBe(true);
  });

  it("confirms from the webhook when the client closed the browser, once per event", async () => {
    const paid = await rp.pay(second.payment.orderId);
    const entity = { id: paid.razorpay_payment_id, order_id: second.payment.orderId, amount: 50000, status: "captured", method: "card" };
    expect((await webhook("payment.captured", { payment: { entity } }, "evt_1", "wrong_secret")).status).toBe(401);
    const [rej] = await sql("SELECT entity_id, data_json FROM audit_log WHERE action = 'webhook.rejected' ORDER BY id DESC LIMIT 1");
    expect(rej.entity_id).toBe("payment.captured");
    expect(JSON.parse(rej.data_json).reason).toBe("signature does not match the webhook secret");
    expect((await req("GET", "/hooks/razorpay")).json).toMatchObject({ ok: true, secretConfigured: true });
    const r = await webhook("payment.captured", { payment: { entity } }, "evt_1");
    expect(r.status).toBe(200);
    expect((await bookingByRef(env.DB, second.ref))!.status).toBe("confirmed");
    expect((await webhook("payment.captured", { payment: { entity } }, "evt_1")).json.duplicate).toBe(true);
  });

  it("refunds the full deposit when the client cancels 24 hours or more before", async () => {
    const r = await req("POST", `/api/bookings/${first.ref}/cancel`, { token: token(first.manageUrl) });
    expect(r.json).toEqual({ status: "cancelled", refund: "refunded" });
    expect(rp.calls.at(-1)).toMatchObject({ method: "POST", body: { amount: 50000, speed: "normal" } });
    const [p] = await sql("SELECT status FROM payments WHERE order_id = ?", first.payment.orderId);
    expect(p.status).toBe("refunded");
    expect(await sql("SELECT * FROM staff_slots WHERE booking_id = (SELECT id FROM bookings WHERE ref = ?)", first.ref)).toEqual([]);
    const u = new URL(first.manageUrl);
    const page = await req("GET", u.pathname + u.search);
    expect(page.text).toContain("Deposit refunded");
    expect(page.text).toContain("Nothing to pay at the venue");
    expect(page.text).not.toContain("<span>Pay at the venue</span>");
    expect(page.text).toContain("A refund of ₹500 has been issued");
  });

  it("needs the secret from the booking link to cancel", async () => {
    expect((await req("POST", `/api/bookings/${second.ref}/cancel`, { token: "guess" })).status).toBe(404);
  });

  it("keeps the deposit on a late cancellation, and opens a review when asked", async () => {
    const b = (await bookingByRef(env.DB, second.ref))!;
    const twoHoursBefore = new Date(istToUtc(b.date, b.start_min).getTime() - 2 * 36e5);
    expect(await cancelByClient(env, b, { requestReview: true, reason: "Family emergency" }, twoHoursBefore)).toEqual({ refund: "review" });
    const [t] = await sql("SELECT type, status, amount_paise, reason FROM tickets WHERE booking_id = ?", b.id);
    expect(t).toMatchObject({ type: "refund", status: "open", amount_paise: 50000 });
    expect(t.reason).toContain("Family emergency");
  });
});

describe("unpaid holds", () => {
  const rp = fakeRazorpay();
  beforeAll(() => rp.install());
  const date = day(5);

  it("releases a hold after 15 minutes, then takes the slot back if the payment arrives late", async () => {
    const r = await req("POST", "/api/bookings", { ...ABHYANGA, staffId: "s5", date, start: 600 });
    expect(await expireHolds(env, new Date(Date.now() + 10 * 6e4))).toBe(0);
    expect(await expireHolds(env, new Date(Date.now() + 16 * 6e4))).toBe(1);
    expect((await bookingByRef(env.DB, r.json.ref))!.status).toBe("expired");
    expect((await req("GET", `/api/slots?service=v7&staff=s5&from=${date}&days=1`)).json.days[0].slots.map((s: any) => s.min)).toContain(600);
    const paid = await rp.pay(r.json.payment.orderId);
    await webhook("order.paid", { payment: { entity: { id: paid.razorpay_payment_id, order_id: r.json.payment.orderId, amount: 50000, method: "upi" } } }, "evt_late_ok");
    expect((await bookingByRef(env.DB, r.json.ref))!.status).toBe("confirmed");
  });

  it("refunds a late payment when someone else has taken the slot", async () => {
    const r = await req("POST", "/api/bookings", { ...ABHYANGA, staffId: "s5", date, start: 900 });
    await expireHolds(env, new Date(Date.now() + 16 * 6e4));
    const other = await req("POST", "/api/bookings", { ...ABHYANGA, phone: "9988776655", staffId: "s5", date, start: 900 });
    expect(other.status).toBe(201);
    const paid = await rp.pay(r.json.payment.orderId);
    await webhook("payment.captured", { payment: { entity: { id: paid.razorpay_payment_id, order_id: r.json.payment.orderId, amount: 50000, method: "upi" } } }, "evt_late_lost");
    const b = (await bookingByRef(env.DB, r.json.ref))!;
    expect(b.status).toBe("cancelled");
    expect(b.cancel_reason).toContain("no longer available");
    const [p] = await sql("SELECT status FROM payments WHERE order_id = ?", r.json.payment.orderId);
    expect(p.status).toBe("refunded");
  });
});

describe("when Razorpay rejects the keys", () => {
  it("releases the slot and tells the client payments are unavailable", async () => {
    const { RazorpayGateway, setGatewayForTests } = await import("../src/services/gateway");
    setGatewayForTests(new RazorpayGateway("rzp_test_key", "wrong", (async () => new Response(JSON.stringify({ error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" } }), { status: 401 })) as typeof fetch));
    const r = await req("POST", "/api/bookings", { ...ABHYANGA, staffId: "s5", date: day(8), start: 600 });
    expect(r.status).toBe(503);
    expect(r.json.error).toMatch(/temporarily unavailable/);
    expect((await req("GET", `/api/slots?service=v7&staff=s5&from=${day(8)}&days=1`)).json.days[0].slots.map((s: any) => s.min)).toContain(600);
  });
});

describe("shared equipment", () => {
  const rp = fakeRazorpay();
  beforeAll(async () => {
    rp.install();
    // One machine needed by Abhyanga (v7) and Shirodhara (v8); Elakizhi (v9) doesn't need it.
    await sql("INSERT INTO resources (id, provider_id, name) VALUES ('r-machine', 'p2', 'Machine')");
    await sql("INSERT INTO service_resources (service_id, resource_id) VALUES ('v7', 'r-machine'), ('v8', 'r-machine')");
  });
  const date = day(9);
  let held: any;

  it("blocks the machine for every practitioner once one booking uses it", async () => {
    held = (await req("POST", "/api/bookings", { ...ABHYANGA, phone: "9000000101", staffId: "s5", date, start: 600 })).json;   // 10:00–11:30
    const v8 = (await req("GET", `/api/slots?service=v8&staff=s6&from=${date}&days=1`)).json.days[0].slots.map((s: any) => s.min);
    expect(v8).not.toContain(600);
    expect(v8).not.toContain(570);   // a 60-minute 9:30 start would overlap
    expect(v8).toContain(690);       // free again from 11:30
    const clash = await req("POST", "/api/bookings", { serviceId: "v8", staffId: "s6", date, start: 600, ...guest, phone: "9000000102" });
    expect(clash.status).toBe(409);
  });

  it("leaves services that don't need the machine bookable", async () => {
    const other = await req("POST", "/api/bookings", { serviceId: "v9", staffId: "s6", date, start: 600, ...guest, phone: "9000000103" });
    expect(other.status).toBe(201);
  });

  it("frees the machine when the booking is cancelled", async () => {
    await req("POST", `/api/bookings/${held.ref}/cancel`, { token: token(held.manageUrl) });
    expect(await sql("SELECT * FROM resource_slots WHERE booking_id = (SELECT id FROM bookings WHERE ref = ?)", held.ref)).toEqual([]);
    const v8 = (await req("GET", `/api/slots?service=v8&staff=s5&from=${date}&days=1`)).json.days[0].slots.map((s: any) => s.min);
    expect(v8).toContain(600);
  });
});

describe("booking rules", () => {
  beforeAll(() => fakeRazorpay().install());

  it("confirms straight away when the service takes no deposit", async () => {
    const r = await req("POST", "/api/bookings", { serviceId: "v31", staffId: "s16", date: day(4), start: 660, ...guest });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ status: "confirmed", payment: null });
  });

  it("asks for the medical acknowledgement on a consultation", async () => {
    const r = await req("POST", "/api/bookings", { serviceId: "v1", staffId: "s1", date: day(4), start: 600, ...guest });
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/medical appointment/);
    const ok = await req("POST", "/api/bookings", { serviceId: "v1", staffId: "any", date: day(4), start: 600, ...guest, ackMedical: true });
    expect([201, 409]).toContain(ok.status);   // 409 only if day(4) is a Sunday, when the clinic is closed
  });

  it("validates contact details", async () => {
    const r = await req("POST", "/api/bookings", { serviceId: "v31", staffId: "s16", date: day(4), start: 720, ...guest, phone: "12345" });
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/mobile number/);
  });

  it("keeps one client record per mobile number", async () => {
    await req("POST", "/api/bookings", { serviceId: "v31", staffId: "s16", date: day(6), start: 660, ...guest, phone: "+91 98765 43210", name: "Test C. Client" });
    const rows = await sql("SELECT name FROM clients WHERE phone = '+919876543210'");
    expect(rows).toEqual([{ name: "Test C. Client" }]);
  });
});
