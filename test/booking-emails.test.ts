import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { day, fakeRazorpay, guest, req, seed, sql } from "./helpers";
import { cancelByClinic, createDirectBooking } from "../src/services/clinic";
import { emailBookingCancelled, emailBookingConfirmed } from "../src/services/booking-emails";
import { applyCapturedPayment } from "../src/services/bookings";

type Sent = { to: string; subject: string; text: string; html: string };
let sent: Sent[] = [];
const to = (addr: string) => sent.filter((m) => m.to === addr);
const linkIn = (html: string, label: string) => new RegExp(`href="([^"]+)"[^>]*>${label}<`).exec(html)?.[1].replace(/&amp;/g, "&");

beforeAll(async () => {
  await seed();
  (env as { EMAIL: unknown }).EMAIL = { send: async (m: Sent) => { sent.push(m); return { messageId: "m" }; } };
  await sql("INSERT INTO provider_users (id, provider_id, name, email, password_hash) VALUES ('pu_ivory', 'p3', 'Front desk', 'desk@ivory.example', 'x'), ('pu_saanvi', 'p2', 'Reception', 'desk@saanvi.example', 'x')");
});

async function firstSlot(service: string, date: string) {
  const r = await req("GET", `/api/slots?service=${service}&staff=any&from=${date}&days=1`);
  return r.json.days[0].slots[0] as { min: number; staffId: string };
}

describe("booking emails", () => {
  const date = day(4);
  let booking: any;

  it("emails the client a confirmation with a private link and calendar, and alerts the business", async () => {
    sent = [];
    const slot = await firstSlot("v15", date);
    booking = (await req("POST", "/api/bookings", { serviceId: "v15", staffId: "any", date, start: slot.min, ...guest })).json;
    expect(booking.status).toBe("confirmed");

    const [mail] = to(guest.email);
    expect(mail.subject).toMatch(/^Booked: Threading & brow shaping at Ivory Room Beauty Studio, \w{3} \d+ \w{3} at /);
    for (const s of ["You&#39;re booked, Test", "Ivory Room Beauty Studio", "₹250", "Nothing to pay online", booking.ref, "Get directions"]) expect(mail.html).toContain(s);
    expect(mail.text).toContain("View or cancel your booking: ");

    const manage = linkIn(mail.html, "View or cancel your booking")!;
    expect(manage).toMatch(new RegExp(`/booking/${booking.ref}\\?t=`));
    expect((await req("GET", new URL(manage).pathname + new URL(manage).search)).status).toBe(200);              // the emailed link works
    expect((await req("GET", new URL(booking.manageUrl).pathname + new URL(booking.manageUrl).search)).status).toBe(200);   // and so does the one from the booking page
    const ics = await req("GET", new URL(linkIn(mail.html, "Add to Apple Calendar or Outlook")!).pathname + new URL(linkIn(mail.html, "Add to Apple Calendar or Outlook")!).search);
    expect(ics.text).toContain("BEGIN:VEVENT"); expect(ics.text).toMatch(/DTSTART:\d{8}T\d{6}Z/); expect(ics.text).toContain("Threading & brow shaping at Ivory Room Beauty Studio");
    expect(linkIn(mail.html, "Add to Google Calendar")).toContain("calendar.google.com");
    expect((await req("GET", `/booking/${booking.ref}/calendar.ics?t=wrong`)).status).toBe(404);

    const [alert] = to("desk@ivory.example");
    expect(alert.subject).toMatch(/^New booking: Test Client · Threading & brow shaping, /);
    expect(alert.html).toContain("+91 98765 43210"); expect(alert.html).toContain(`/clinic/bookings/${booking.ref}`);
    expect(to("desk@saanvi.example")).toHaveLength(0);   // other businesses hear nothing
    expect(await sql("SELECT action FROM audit_log WHERE action LIKE 'email.%' AND entity_id = (SELECT id FROM bookings WHERE ref = ?) ORDER BY id", booking.ref))
      .toEqual([{ action: "email.booking_confirmed" }, { action: "email.business_new_booking" }]);
  });

  it("emails both sides when the client cancels", async () => {
    sent = [];
    const t = new URL(booking.manageUrl).searchParams.get("t");
    expect((await req("POST", `/api/bookings/${booking.ref}/cancel`, { token: t })).status).toBe(200);
    expect(to(guest.email)[0].subject).toMatch(/^Cancelled: Threading & brow shaping at Ivory Room Beauty Studio/);
    expect(to(guest.email)[0].html).toContain("Your booking is cancelled");
    expect(to("desk@ivory.example")[0].subject).toMatch(/^Cancelled: Test Client · Threading/);
  });

  it("confirms a deposit booking only once the deposit is paid", async () => {
    const rp = fakeRazorpay(); rp.install(); sent = [];
    const slot = await firstSlot("v7", date);
    const held = (await req("POST", "/api/bookings", { serviceId: "v7", staffId: "any", date, start: slot.min, ...guest, phone: "9811122233" })).json;
    expect(held.status).toBe("held");
    expect(sent).toHaveLength(0);
    const paid = await rp.pay(held.payment.orderId);
    await req("POST", `/api/bookings/${held.ref}/payment`, paid);
    const [mail] = to(guest.email);
    expect(mail.html).toContain("₹500 deposit paid"); expect(mail.html).toContain("₹2,300 to pay on the day");
    expect(mail.html).toContain("Cancel free up to 24 hours before");
    expect((await req("GET", new URL(linkIn(mail.html, "View or cancel your booking")!).pathname + new URL(linkIn(mail.html, "View or cancel your booking")!).search)).status).toBe(200);
    expect(to("desk@saanvi.example")).toHaveLength(1);
    await req("POST", `/api/bookings/${held.ref}/payment`, paid);   // a repeat callback sends nothing new
    expect(to(guest.email)).toHaveLength(1);
  });

  it("sends one confirmation when Razorpay's notifications and the checkout callback arrive at the same moment", async () => {
    const rp = fakeRazorpay(); rp.install(); sent = [];
    const slot = await firstSlot("v7", day(8));
    const held = (await req("POST", "/api/bookings", { serviceId: "v7", staffId: "any", date: day(8), start: slot.min, ...guest, phone: "9811144455" })).json;
    const paid = await rp.pay(held.payment.orderId);
    const pay = { orderId: held.payment.orderId, paymentId: paid.razorpay_payment_id, amount: held.payment.amount, method: "upi" };
    const outcomes = await Promise.all([
      applyCapturedPayment(env, pay, "razorpay"), applyCapturedPayment(env, pay, "razorpay"),
      req("POST", `/api/bookings/${held.ref}/payment`, paid).then((r) => ({ outcome: r.json.outcome })),
    ]);
    expect(outcomes.filter((o) => o.outcome === "confirmed")).toHaveLength(1);
    expect(outcomes.filter((o) => o.outcome === "already_applied")).toHaveLength(2);
    expect(await sql("SELECT action FROM audit_log WHERE action = 'booking.confirmed' AND entity_id = (SELECT id FROM bookings WHERE ref = ?)", held.ref)).toHaveLength(1);
    expect((await sql("SELECT status FROM bookings WHERE ref = ?", held.ref))[0].status).toBe("confirmed");
  });

  it("tells a client the business booked them in, and when the business cancels", async () => {
    sent = [];
    const { ref } = await createDirectBooking(env.DB, "p3", { serviceId: "v15", staffId: "s9", date: day(5), start: 660, name: "Walk In", phone: "9822233344", email: "walkin@example.com" }, "test");
    const [{ id }] = await sql("SELECT id FROM bookings WHERE ref = ?", ref);
    await emailBookingConfirmed(env, id, "https://aestheva.test");
    expect(to("walkin@example.com")[0].html).toContain("Ivory Room Beauty Studio has booked this appointment for you.");
    await cancelByClinic(env, "p3", ref, "therapist unwell", "test");
    await emailBookingCancelled(env, id, "https://aestheva.test", "none");
    const cancelled = to("walkin@example.com")[1];
    expect(cancelled.html).toContain("Ivory Room Beauty Studio has cancelled your appointment");
    expect(cancelled.html).not.toContain("therapist unwell");   // the business's internal reason stays private
    expect(to("desk@ivory.example")).toHaveLength(0);   // businesses aren't alerted about their own bookings
  });

  it("skips clients without an email, and never lets an email failure break a booking", async () => {
    const { ref } = await createDirectBooking(env.DB, "p3", { serviceId: "v15", staffId: "s9", date: day(6), start: 660, name: "No Email", phone: "9833344455" }, "test");
    const [{ id }] = await sql("SELECT id FROM bookings WHERE ref = ?", ref);
    sent = [];
    await emailBookingConfirmed(env, id, "https://aestheva.test");
    expect(sent).toHaveLength(0);
    (env as { EMAIL: unknown }).EMAIL = { send: async () => { throw Object.assign(new Error("down"), { code: "E_DOWN" }); } };
    const slot = await firstSlot("v15", day(7));
    const r = await req("POST", "/api/bookings", { serviceId: "v15", staffId: "any", date: day(7), start: slot.min, ...guest, phone: "9844455566" });
    expect(r.status).toBe(201); expect(r.json.status).toBe("confirmed");
    expect(await sql("SELECT action FROM audit_log WHERE action = 'email.booking_confirmed_failed'")).toHaveLength(1);
    (env as { EMAIL: unknown }).EMAIL = { send: async (m: Sent) => { sent.push(m); return { messageId: "m" }; } };
  });
});
