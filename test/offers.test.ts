import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { addDays, dowOf, nowIst } from "../src/domain/time";
import { daysLabel, discountFor, offerCovers, validateOffer, OfferFormError, type OfferRow } from "../src/services/offers";
import { monthMoney } from "../src/services/clinic";
import { day, fakeRazorpay, guest, req, seed, sql } from "./helpers";

const today = nowIst().date;

async function send(method: string, path: string, form?: Record<string, string | string[]>, cookie?: string) {
  const body = form ? new URLSearchParams(Object.entries(form).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string]))).toString() : undefined;
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, redirect: "manual", body, headers: { ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(cookie ? { cookie } : {}) },
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  return { status: res.status, text: await res.text(), headers: res.headers };
}
const csrfIn = (html: string) => /name="csrf" value="([0-9a-f]{64})"/.exec(html)![1];
const slots = async (service: string, date: string) => (await req("GET", `/api/slots?service=${service}&staff=any&from=${date}&days=1`)).json.days[0].slots as { min: number; offer?: number }[];
const book = (body: Record<string, unknown>) => req("POST", "/api/bookings", body);

const base: OfferRow = {
  id: "o", provider_id: "p6", amount_type: "fixed", amount: 20000, services_json: '["v23"]', days: "0,1,2,3,4,5,6", start_min: 660, end_min: 900,
  starts_on: today, ends_on: addDays(today, 30), monthly_cap: 20, status: "on", paused_by: null, created_at: "", updated_at: "",
};

describe("offer rules", () => {
  it("rounds to whole rupees and never takes more than half the price", () => {
    expect(discountFor({ amount_type: "fixed", amount: 20000 }, 110000)).toBe(20000);
    expect(discountFor({ amount_type: "percent", amount: 15 }, 110000)).toBe(16500);
    expect(discountFor({ amount_type: "percent", amount: 15 }, 99900)).toBe(15000);   // ₹149.85 → ₹150
    expect(discountFor({ amount_type: "fixed", amount: 50000 }, 60000)).toBe(30000);   // capped at half of ₹600
  });

  it("covers only the chosen services, days, dates and start times, and never medical services", () => {
    const svc = { id: "v23", kind: "beauty" as const };
    const d = day(3);
    expect(offerCovers(base, svc, d, 660)).toBe(true);
    expect(offerCovers(base, svc, d, 870)).toBe(true);
    expect(offerCovers(base, svc, d, 900)).toBe(false);   // starts when the quiet hours end
    expect(offerCovers(base, svc, d, 630)).toBe(false);
    expect(offerCovers({ ...base, days: String((dowOf(d) + 1) % 7) }, svc, d, 660)).toBe(false);
    expect(offerCovers(base, { id: "v24", kind: "beauty" as const }, d, 660)).toBe(false);
    expect(offerCovers({ ...base, services_json: '["v1"]' }, { id: "v1", kind: "consult" as const }, d, 660)).toBe(false);
    expect(offerCovers({ ...base, ends_on: addDays(d, -1) }, svc, d, 660)).toBe(false);
    expect(offerCovers({ ...base, status: "paused" }, svc, d, 660)).toBe(false);
    expect(daysLabel([2, 3, 4])).toBe("Tue–Thu");
    expect(daysLabel([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
  });

  it("checks the form a business fills in", () => {
    const services = [{ id: "v23", kind: "beauty" as const }, { id: "v1", kind: "consult" as const }];
    const ok = { amount_type: "fixed", amount: "200", services: ["v23"], days: ["2", "3"], start: "660", end: "900", starts_on: today, ends_on: addDays(today, 30), monthly_cap: "20" };
    expect(validateOffer(ok, services, today)).toMatchObject({ amount: 20000, services: ["v23"], days: [2, 3], start_min: 660, end_min: 900, monthly_cap: 20 });
    const errs = (f: Record<string, unknown>) => { try { validateOffer(f, services, today); return {}; } catch (e) { return (e as OfferFormError).errors; } };
    expect(errs({ ...ok, services: ["v1"] }).services).toContain("Medical");
    expect(errs({ ...ok, amount_type: "percent", amount: "60" }).amount).toContain("5 to 50");
    expect(errs({ ...ok, amount: "20" }).amount).toContain("₹50");
    expect(errs({ ...ok, start: "900", end: "660" }).hours).toBeTruthy();
    expect(errs({ ...ok, days: [] }).days).toBeTruthy();
    expect(errs({ ...ok, ends_on: addDays(today, 400) }).ends_on).toContain("6 months");
    expect(errs({ ...ok, starts_on: addDays(today, -1) }).starts_on).toContain("past");
    expect(errs({ ...ok, monthly_cap: "0" }).monthly_cap).toBeTruthy();
  });
});

describe("quiet-hour offers", () => {
  let cookie = "", csrf = "", opsCookie = "";
  const date = day(3), date2 = day(4);

  const rp = fakeRazorpay();
  beforeAll(async () => {
    await seed();
    rp.install();
    (env as { EMAIL: unknown }).EMAIL = { send: async () => ({ messageId: "m" }) };
    // A login for Thalam Nail & Brow Bar, set up the way the team does it.
    opsCookie = (await send("POST", "/ops/login", { key: "test-ops-key" })).headers.get("set-cookie")!.split(";")[0];
    const sent: { text: string }[] = [];
    (env as { EMAIL: unknown }).EMAIL = { send: async (m: { text: string }) => { sent.push(m); return { messageId: "m" }; } };
    const page = await send("GET", "/ops/clinics", undefined, opsCookie);
    await send("POST", "/ops/clinics", { csrf: csrfIn(page.text), provider: "p6", name: "Meenu", email: "desk@thalam.example" }, opsCookie);
    const link = /https:\/\/aestheva\.test(\/clinic\/set-password\?t=[A-Za-z0-9_-]+)/.exec(sent[0].text)![1];
    const t = new URL(`https://x${link}`).searchParams.get("t")!;
    await send("POST", "/clinic/set-password", { t, password: "gold nails on a tuesday", confirm: "gold nails on a tuesday" });
    cookie = (await send("POST", "/clinic/login", { email: "desk@thalam.example", password: "gold nails on a tuesday" })).headers.get("set-cookie")!.split(";")[0];
    csrf = csrfIn((await send("GET", "/clinic/offers", undefined, cookie)).text);
  });

  it("lets a business turn an offer on from its portal", async () => {
    const empty = await send("GET", "/clinic/offers", undefined, cookie);
    expect(empty.text).toContain("No offers yet");
    const form = await send("GET", "/clinic/offers/new", undefined, cookie);
    expect(form.text).toContain("New quiet-hour offer");
    const bad = await send("POST", "/clinic/offers/new", { csrf, amount_type: "fixed", amount: "200", days: ["1"], start: "660", end: "900", starts_on: today, ends_on: addDays(today, 30), monthly_cap: "20" }, cookie);
    expect(bad.status).toBe(400); expect(bad.text).toContain("Choose at least one service");
    const made = await send("POST", "/clinic/offers/new", { csrf, amount_type: "fixed", amount: "200", services: ["v23", "v24"], days: ["0", "1", "2", "3", "4", "5", "6"], start: "660", end: "900", starts_on: today, ends_on: addDays(today, 30), monthly_cap: "20" }, cookie);
    expect(made.status).toBe(303);
    const list = await send("GET", "/clinic/offers?done=created", undefined, cookie);
    expect(list.text).toContain("Offer is on");
    expect(list.text).toContain("₹200 off");
    expect(list.text).toContain("Gel manicure, Gel pedicure");
    expect(list.text).toContain("Every day, 11:00 am – 3:00 pm");
    expect(list.text).toContain("0 of 20 places used this month");
  });

  it("shows gold times in the time picker, and the offer on the business's page and in search", async () => {
    const s = await slots("v23", date);
    expect(s.find((x) => x.min === 660)?.offer).toBe(20000);
    expect(s.find((x) => x.min === 840)?.offer).toBe(20000);
    expect(s.find((x) => x.min === 900)?.offer).toBeUndefined();
    expect((await slots("v25", date)).some((x) => x.offer)).toBe(false);   // not a service the offer covers
    const venue = await req("GET", "/p/thalam-nail-and-brow-bar");
    expect(venue.text).toContain("Quiet-hour offers");
    expect(venue.text).toContain("Up to ₹200 off at quiet times");
    const bookPage = await req("GET", "/book/thalam-nail-and-brow-bar");
    expect(bookPage.text).toContain('"amount":"₹200 off"');
    const search = await req("GET", "/search?offers=1");
    expect(search.text).toContain("Thalam Nail &amp; Brow Bar");
    expect(search.text).not.toContain("Lumière Skin &amp; Laser Clinic");
    expect(search.text).toContain("Quiet-hour offers: up to ₹200 off");
  });

  let firstRef = "", firstToken = "";
  it("takes the discount off the price, keeps the deposit, and charges commission on what the client pays", async () => {
    const r = await book({ serviceId: "v23", staffId: "any", date, start: 660, ...guest, phone: "9811100001", expectOffer: true });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ price: 90000, deposit: 20000, offer: 20000 });
    expect(r.json.payment.amount).toBe(20000);
    expect(r.json.payment.description).toContain("₹200 quiet-hour offer");
    firstRef = r.json.ref; firstToken = new URL(r.json.manageUrl).searchParams.get("t")!;
    const [b] = await sql("SELECT price_paise, offer_paise, offer_id, deposit_paise FROM bookings WHERE ref = ?", firstRef);
    expect(b).toMatchObject({ price_paise: 90000, offer_paise: 20000, deposit_paise: 20000 });
    expect(b.offer_id).toMatch(/^off_/);
    const manage = await req("GET", `/booking/${firstRef}?t=${firstToken}`);
    expect(manage.text).toContain("Quiet-hour offer from Thalam Nail &amp; Brow Bar");
    expect(manage.text).toContain("₹1,100");
    expect(manage.text).toContain("₹700");   // ₹900 less the ₹200 deposit, on the day
  });

  it("is once per mobile number, and tells the client when the offer has gone", async () => {
    const again = await book({ serviceId: "v23", staffId: "any", date: date2, start: 690, ...guest, phone: "9811100001", expectOffer: true });
    expect(again.status).toBe(409);
    expect(again.json.error).toContain("already been used with this mobile number");
    expect(again.json.error).toContain("full price of ₹1,100");
    const full = await book({ serviceId: "v23", staffId: "any", date: date2, start: 690, ...guest, phone: "9811100001" });
    expect(full.json).toMatchObject({ price: 110000, offer: 0 });
    // Cancelling the discounted booking gives the offer back.
    await req("POST", `/api/bookings/${full.json.ref}/cancel`, { token: new URL(full.json.manageUrl).searchParams.get("t") });
    await req("POST", `/api/bookings/${firstRef}/cancel`, { token: firstToken });
    const back = await book({ serviceId: "v23", staffId: "any", date: date2, start: 690, ...guest, phone: "9811100001", expectOffer: true });
    expect(back.json).toMatchObject({ price: 90000, offer: 20000 });
  });

  it("stops at the monthly limit", async () => {
    const [o] = await sql("SELECT id FROM offers WHERE provider_id = 'p6'");
    await sql("UPDATE offers SET monthly_cap = 1 WHERE id = ?", o.id);
    const month = date2.slice(0, 7);
    // The one place this month is taken (if both test dates fall in the same month), so its times are back at full price.
    if (date.slice(0, 7) === month) {
      expect((await slots("v23", date)).some((x) => x.offer)).toBe(false);
      const r = await book({ serviceId: "v23", staffId: "any", date, start: 720, ...guest, phone: "9811100002", expectOffer: true });
      expect(r.status).toBe(409); expect(r.json.error).toContain("has just been taken");
    }
    await sql("UPDATE offers SET monthly_cap = 20 WHERE id = ?", o.id);
  });

  it("never applies to medical services, even if an offer names one", async () => {
    await sql(`INSERT INTO offers (id, provider_id, amount_type, amount, services_json, days, start_min, end_min, starts_on, ends_on, monthly_cap)
      VALUES ('off_med', 'p1', 'fixed', 20000, '["v1","v5"]', '0,1,2,3,4,5,6', 0, 1440, ?, ?, 50)`, today, addDays(today, 30));
    const workday = [3, 4, 5, 6].map(day).find((d) => dowOf(d) !== 0)!;
    expect((await slots("v1", workday)).some((x) => x.offer)).toBe(false);
    const venue = await req("GET", "/p/lumiere-skin-and-laser-clinic");
    expect(venue.text).not.toContain("Dermatology consultation</b>, ");
    expect(venue.text).toContain("Hydrating deep-cleanse facial");   // the non-medical service on the same offer is fine
    await sql("DELETE FROM offers WHERE id = 'off_med'");
  });

  it("can be paused and ended by the business, and paused by the Aestheva team", async () => {
    const [o] = await sql("SELECT id FROM offers WHERE provider_id = 'p6'");
    expect((await send("POST", `/clinic/offers/${o.id}/pause`, { csrf }, cookie)).status).toBe(303);
    expect((await slots("v23", date)).some((x) => x.offer)).toBe(false);
    expect((await send("GET", "/clinic/offers", undefined, cookie)).text).toContain("Turn back on");
    await send("POST", `/clinic/offers/${o.id}/resume`, { csrf }, cookie);
    expect((await slots("v23", date)).some((x) => x.offer)).toBe(true);

    const opsPage = await send("GET", "/ops/offers", undefined, opsCookie);
    expect(opsPage.text).toContain("Thalam Nail &amp; Brow Bar");
    expect((await send("POST", `/ops/offers/${o.id}/pause`, { csrf: csrfIn(opsPage.text) }, opsCookie)).status).toBe(303);
    const blocked = await send("POST", `/clinic/offers/${o.id}/resume`, { csrf }, cookie);
    expect(blocked.status).toBe(409); expect(blocked.text).toContain("The Aestheva team paused this offer");
    await send("POST", `/ops/offers/${o.id}/resume`, { csrf: csrfIn(opsPage.text) }, opsCookie);

    expect((await send("POST", `/clinic/offers/${o.id}/end`, { csrf }, cookie)).status).toBe(303);
    expect((await slots("v23", date)).some((x) => x.offer)).toBe(false);
    // The booking made under the offer keeps its price.
    const [b] = await sql("SELECT price_paise, offer_paise FROM bookings WHERE offer_id = ? AND status = 'held'", o.id);
    expect(b).toMatchObject({ price_paise: 90000, offer_paise: 20000 });
    expect((await send("GET", "/clinic/offers", undefined, cookie)).text).toContain("Past offers");
  });

  it("shows the business what its offers gave away, with commission on the discounted price", async () => {
    const [b] = await sql("SELECT id, date FROM bookings WHERE offer_paise > 0 AND status = 'held'");
    await sql("UPDATE bookings SET status = 'completed' WHERE id = ?", b.id);
    const m = await monthMoney(env.DB, "p6", b.date.slice(0, 7));
    expect(m.offerBookings).toBe(1);
    expect(m.offersGiven).toBe(20000);
    expect(m.commission).toBe(9000);   // 10% of ₹900, not of ₹1,100
    // The Payments page goes up to the current month (the test appointment may fall in the next one).
    if (b.date.slice(0, 7) === today.slice(0, 7)) expect((await send("GET", `/clinic/payments?month=${b.date.slice(0, 7)}`, undefined, cookie)).text).toContain("Quiet-hour offers this month");
  });
});
