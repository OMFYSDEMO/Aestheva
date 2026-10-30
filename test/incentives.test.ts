import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { addDays, nowIst } from "../src/domain/time";
import { addMonths, assignFoundingNo, commissionBp, foundingPlacesLeft, foundingTerms } from "../src/services/incentives";
import { monthMoney } from "../src/services/clinic";
import { day, fakeRazorpay, guest, req, seed, sql } from "./helpers";

const today = nowIst().date;

async function raw(path: string, init: RequestInit = {}) {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, { redirect: "manual", ...init }), env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}
async function book(body: Record<string, unknown>, cookie?: string) {
  const r = await raw("/api/bookings", { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() as any };
}
async function slot(service: string, date: string) {
  return (await req("GET", `/api/slots?service=${service}&staff=any&from=${date}&days=1`)).json.days[0].slots[0] as { min: number };
}

beforeAll(seed);

describe("founding partners", () => {
  it("charge 0% for three months, 7.5% to the first anniversary, then the standard 10%", () => {
    const live = "2026-10-29";
    expect(addMonths(live, 3)).toBe("2027-01-29");
    expect(foundingTerms({ founding_no: 1, live_since: live }, "2026-12-01")).toMatchObject({ no: 1, phase: "free", rateBp: 0, freeUntil: "2027-01-29", foundingUntil: "2027-10-29" });
    expect(commissionBp({ founding_no: 1, live_since: live }, "", "2027-01-28")).toBe(0);
    expect(commissionBp({ founding_no: 1, live_since: live }, "", "2027-01-29")).toBe(750);
    expect(commissionBp({ founding_no: 1, live_since: live }, "", "2027-10-29")).toBe(1000);
    expect(commissionBp({ founding_no: null, live_since: live }, "", "2026-12-01")).toBe(1000);
    expect(commissionBp({ founding_no: null, live_since: live }, "own_link", "2026-12-01")).toBe(0);
  });

  it("number businesses as they go live, until the places run out", async () => {
    const before = await foundingPlacesLeft(env.DB);
    const a = await assignFoundingNo(env.DB, "p1"), b = await assignFoundingNo(env.DB, "p2");
    expect(b).toBe(a! + 1);
    expect(await assignFoundingNo(env.DB, "p1")).toBe(a);   // a number is kept, never reissued
    expect(await foundingPlacesLeft(env.DB)).toBe(before - 2);
    expect((await req("GET", "/for-practitioners")).text).toContain(`${before - 2} of 50 places left`);
    // fill the remaining places with placeholder businesses, then the next one gets no number
    await sql(`INSERT INTO providers (id, slug, name, type, area, address, tagline, about, hours_text, status, founding_no)
      WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < ?) SELECT 'fill' || x, 'fill-' || x, 'Fill ' || x, 'Clinic', 'Pattom', 'Somewhere 695001', '', '', '', 'draft', 100 + x FROM n`, before - 2);
    expect(await foundingPlacesLeft(env.DB)).toBe(0);
    expect(await assignFoundingNo(env.DB, "p3")).toBeNull();
    expect((await req("GET", "/for-practitioners")).text).not.toContain("places left");
    await sql("DELETE FROM providers WHERE id LIKE 'fill%'");
  });

  it("apply the founding rate to new online bookings", async () => {
    await sql("UPDATE providers SET founding_no = 1, live_since = ? WHERE id = 'p3'", today);
    const s = await slot("v15", day(4));
    const r = await book({ serviceId: "v15", staffId: "any", date: day(4), start: s.min, ...guest, phone: "9700000001" });
    expect((await sql("SELECT commission_bp FROM bookings WHERE ref = ?", r.json.ref))[0].commission_bp).toBe(0);
    await sql("UPDATE providers SET live_since = ? WHERE id = 'p3'", addDays(today, -200));
    const s2 = await slot("v15", day(5));
    const r2 = await book({ serviceId: "v15", staffId: "any", date: day(5), start: s2.min, ...guest, phone: "9700000002" });
    expect((await sql("SELECT commission_bp FROM bookings WHERE ref = ?", r2.json.ref))[0].commission_bp).toBe(750);
    await sql("UPDATE providers SET founding_no = NULL WHERE id = 'p3'");
  });
});

describe("your link, zero commission", () => {
  it("remembers the business a client arrived through for 30 days", async () => {
    const r = await raw("/b/ivory-room-beauty-studio");
    expect(r.status).toBe(302); expect(r.headers.get("location")).toBe("/p/ivory-room-beauty-studio");
    expect(r.headers.get("set-cookie")).toMatch(/ae_via=ivory-room-beauty-studio; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    expect((await raw("/b/not-a-business")).headers.get("location")).toBe("/");
  });

  it("books with no commission through the business's own link, and only for that business", async () => {
    const s = await slot("v15", day(6));
    const own = await book({ serviceId: "v15", staffId: "any", date: day(6), start: s.min, ...guest, phone: "9700000003" }, "ae_via=ivory-room-beauty-studio");
    expect(await sql("SELECT channel, commission_bp FROM bookings WHERE ref = ?", own.json.ref)).toEqual([{ channel: "own_link", commission_bp: 0 }]);
    const s2 = await slot("v30", day(6));   // a different business: the link doesn't carry over
    const other = await book({ serviceId: "v30", staffId: "any", date: day(6), start: s2.min, ...guest, phone: "9700000004" }, "ae_via=ivory-room-beauty-studio");
    expect(await sql("SELECT channel, commission_bp FROM bookings WHERE ref = ?", other.json.ref)).toEqual([{ channel: "", commission_bp: 1000 }]);
  });
});

describe("welcome offer", () => {
  const rp = fakeRazorpay();
  beforeAll(() => { rp.install(); (env as { WELCOME_CREDIT_PAISE?: string }).WELCOME_CREDIT_PAISE = "10000"; });
  afterAll(() => { (env as { WELCOME_CREDIT_PAISE?: string }).WELCOME_CREDIT_PAISE = "0"; });
  const phone = "9700000010";

  it("takes ₹100 off a new client's first deposit, paid by Aestheva", async () => {
    const s = await slot("v7", day(7));
    const r = await book({ serviceId: "v7", staffId: "any", date: day(7), start: s.min, ...guest, phone });
    expect(r.json.credit).toBe(10000);
    expect(r.json.payment.amount).toBe(40000);   // ₹500 deposit less ₹100
    expect(rp.orders.get(r.json.payment.orderId)).toBe(40000);
    expect(r.json.payment.description).toContain("₹100 welcome offer applied");
    // a second tab before paying doesn't get a second offer
    const s2 = await slot("v7", day(8));
    expect((await book({ serviceId: "v7", staffId: "any", date: day(8), start: s2.min, ...guest, phone })).json.credit).toBe(0);
    const paid = await rp.pay(r.json.payment.orderId);
    expect((await req("POST", `/api/bookings/${r.json.ref}/payment`, paid)).json.status).toBe("confirmed");
    const page = await req("GET", new URL(r.json.manageUrl).pathname + new URL(r.json.manageUrl).search);
    expect(page.text).toContain("Welcome offer, paid by Aestheva"); expect(page.text).toContain("₹2,300");   // still ₹2,300 on the day
  });

  it("is once per client, and counts the credit in the business's figures", async () => {
    const s = await slot("v7", day(9));
    expect((await book({ serviceId: "v7", staffId: "any", date: day(9), start: s.min, ...guest, phone })).json.credit).toBe(0);
    const [b] = await sql("SELECT id, provider_id, date FROM bookings WHERE credit_paise = 10000");
    await sql("UPDATE bookings SET status = 'completed' WHERE id = ?", b.id);
    const m = await monthMoney(env.DB, b.provider_id, b.date.slice(0, 7));
    expect(m.welcomeCredits).toBe(10000);
    const row = m.rows.find((x) => x.credit_paise === 10000)!;
    expect(row.paid).toBe(40000);
    expect(m.balanceAtClinic).toBeGreaterThanOrEqual(230000);   // the client owes ₹2,300 on the day, not ₹2,400
  });

  it("can be paused with WELCOME_CREDIT_PAISE=0", async () => {
    (env as { WELCOME_CREDIT_PAISE?: string }).WELCOME_CREDIT_PAISE = "0";
    const s = await slot("v7", day(10));
    const r = await book({ serviceId: "v7", staffId: "any", date: day(10), start: s.min, ...guest, phone: "9700000011" });
    expect(r.json.credit).toBe(0); expect(r.json.payment.amount).toBe(50000);
    expect((await req("GET", "/")).text).not.toContain("off the deposit on your first booking");
    (env as { WELCOME_CREDIT_PAISE?: string }).WELCOME_CREDIT_PAISE = "10000";
    expect((await req("GET", "/")).text).toContain("₹100</b> off the deposit on your first booking".replace("</b>", ""));
  });
});
