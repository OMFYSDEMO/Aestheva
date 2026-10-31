import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { addDays, nowIst } from "../src/domain/time";
import { autoComplete, depositFor, financialYear, gstSplit, issueStatements, lineFor, makeStatements, monthBefore, checkLinks } from "../src/services/statements";
import { day, fakeRazorpay, guest, req, seed, sql, webhook } from "./helpers";

async function send(method: string, path: string, form?: Record<string, string>, cookie?: string) {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, redirect: "manual", body: form ? new URLSearchParams(form).toString() : undefined,
    headers: { ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(cookie ? { cookie } : {}) },
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  return { status: res.status, text: await res.text(), headers: res.headers };
}
beforeAll(seed);
const slot = async (service: string, date: string) => (await req("GET", `/api/slots?service=${service}&staff=any&from=${date}&days=1`)).json.days[0].slots[0] as { min: number };

describe("money rules", () => {
  it("sizes the online deposit by how the business is paid", () => {
    expect(depositFor("invoice", { price_paise: 110000, deposit_paise: 20000 })).toBe(0);
    expect(depositFor("own", { price_paise: 110000, deposit_paise: 20000 })).toBe(20000);
    expect(depositFor("route", { price_paise: 230000, deposit_paise: 0 })).toBe(46000);    // 20%
    expect(depositFor("route", { price_paise: 112345, deposit_paise: 0 })).toBe(23000);    // ₹224.69 rounded up to ₹230
    expect(depositFor("route", { price_paise: 220000, deposit_paise: 60000 })).toBe(60000); // the business asked for more
  });

  it("charges commission and GST to the business, only on completed bookings, and withholds TDS and TCS", () => {
    const b = { source: "marketplace", price_paise: 100000, commission_bp: 750, credit_paise: 0, paid: 0, refunded: 0 };
    // Paid at the venue: TDS on the full ₹1,000 still applies; no TCS, as Aestheva collected nothing.
    expect(lineFor({ ...b, status: "completed" }, { gstRegistered: true, gstRateBp: 500 })).toMatchObject({ outcome: "completed", commission: 7500, gst: 1350, tds: 100, tcs: 0, net: -8950 });
    // A deposit held for the business: commission, GST, TDS and TCS come out of it. TCS is 0.5% of the value excluding 5% GST.
    expect(lineFor({ ...b, status: "completed", commission_bp: 1000, paid: 20000 }, { gstRegistered: true, gstRateBp: 500 })).toMatchObject({ taxable: 95238, collected: 20000, commission: 10000, gst: 1800, tds: 100, tcs: 476, net: 7624 });
    // Not registered, or exempt healthcare: no TCS. An exempt business: no TDS.
    expect(lineFor({ ...b, status: "completed", paid: 20000 }, { gstRegistered: true, gstRateBp: 0 })).toMatchObject({ tcs: 0, tds: 100 });
    expect(lineFor({ ...b, status: "completed", paid: 20000 }, { gstRegistered: false, gstRateBp: 500, tdsExempt: true })).toMatchObject({ tcs: 0, tds: 0 });
    // Aestheva's welcome credit is owed to the business on top of what the client paid.
    expect(lineFor({ ...b, status: "completed", commission_bp: 0, paid: 10000, credit_paise: 10000 }, { gstRegistered: false })).toMatchObject({ collected: 20000, commission: 0, tds: 100, net: 19900 });
    expect(lineFor({ ...b, status: "no_show", paid: 20000 }, { gstRegistered: false })).toMatchObject({ outcome: "no_show", commission: 0, net: 20000 });
    expect(lineFor({ ...b, status: "cancelled", cancelled_by: "client", paid: 20000 }, { gstRegistered: false })).toMatchObject({ outcome: "late_cancel", net: 20000 });
    expect(lineFor({ ...b, status: "cancelled", cancelled_by: "client", paid: 20000, refunded: 20000 }, { gstRegistered: false })).toBeNull();
    expect(lineFor({ ...b, status: "completed", source: "direct" }, { gstRegistered: false })).toBeNull();
  });

  it("numbers invoices by financial year and splits GST within Kerala", () => {
    expect(financialYear("2026-11-03")).toBe("2627");
    expect(financialYear("2027-03-31")).toBe("2627");
    expect(financialYear("2027-04-01")).toBe("2728");
    expect(monthBefore("2026-12-03")).toBe("2026-11");
    expect(gstSplit("", 1801)).toEqual({ igst: 0, cgst: 900, sgst: 901 });
    expect(gstSplit("32ABCDE1234F1Z5", 1800)).toEqual({ igst: 0, cgst: 900, sgst: 900 });
    expect(gstSplit("29ABCDE1234F1Z5", 1800)).toEqual({ igst: 1800, cgst: 0, sgst: 0 });
  });
});

describe("deposits follow the payout mode", () => {
  const rp = fakeRazorpay();
  beforeAll(() => rp.install());

  it("takes no deposit at a business paid at the venue", async () => {
    await sql("UPDATE providers SET payout_mode = 'invoice' WHERE id = 'p6'");
    const s = await slot("v23", day(3));
    const r = await req("POST", "/api/bookings", { serviceId: "v23", staffId: "any", date: day(3), start: s.min, ...guest, phone: "9822200001" });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ status: "confirmed", deposit: 0, payment: null });
    expect((await req("GET", "/p/thalam-nail-and-brow-bar")).text).toContain("Nothing to pay online");
  });

  it("takes a 20% deposit at a business paid through Razorpay Route", async () => {
    await sql("UPDATE providers SET payout_mode = 'route' WHERE id = 'p3'");
    const s = await slot("v14", day(3));
    const r = await req("POST", "/api/bookings", { serviceId: "v14", staffId: "any", date: day(3), start: s.min, ...guest, phone: "9822200002" });
    expect(r.json.deposit).toBe(44000);   // 20% of ₹2,200
    expect(r.json.payment.amount).toBe(44000);
  });
});

describe("monthly statements", () => {
  const rp = fakeRazorpay();
  type Sent = { to: string; subject: string; text: string };
  const sent: Sent[] = [];
  const now = new Date("2026-12-05T06:00:00Z");   // 5 December, India time: November's statements are due
  let n = 0;
  const booking = (provider: string, service: string, staff: string, status: string, bp: number, price: number, extra: { date?: string; source?: string; paid?: number } = {}) => {
    const id = `bkg_t${++n}`;
    return sql(`INSERT INTO bookings (id, ref, provider_id, service_id, staff_id, client_id, date, start_min, dur_min, service_name, kind, price_paise, deposit_paise, commission_bp, source, status, manage_token_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'cli_t', ?, 660, 60, 'Test service', 'beauty', ?, 0, ?, ?, ?, 'x', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')`,
      id, `AE-T${String(n).padStart(4, "0")}`, provider, service, staff, extra.date ?? "2026-11-10", price, bp, extra.source ?? "marketplace", status).then(() => id);
  };

  beforeAll(async () => {
    rp.install();
    (env as { EMAIL: unknown }).EMAIL = { send: async (m: Sent) => { sent.push(m); return { messageId: "m" }; } };
    await sql("INSERT INTO clients (id, name, phone, email) VALUES ('cli_t', 'Test Client', '+919811111111', 't@example.com')");
    await sql("UPDATE providers SET payout_mode = 'invoice', gstin = '' WHERE id = 'p6'");
    await sql("UPDATE providers SET payout_mode = 'own' WHERE id = 'p1'");
    await sql("INSERT INTO provider_users (id, provider_id, name, email, password_hash) VALUES ('pu_t6', 'p6', 'Meenu', 'desk@thalam.example', 'x')");
    await booking("p6", "v23", "s13", "completed", 1000, 110000);
    await booking("p6", "v24", "s13", "completed", 750, 140000);
    await booking("p6", "v23", "s13", "no_show", 1000, 110000);
    await booking("p6", "v23", "s13", "completed", 1000, 110000, { source: "direct" });   // added by the business: no commission
    await booking("p6", "v23", "s13", "completed", 1000, 110000, { date: "2026-10-20" });  // another month
    await booking("p1", "v5", "s3", "completed", 1000, 420000);
  });

  it("marks confirmed bookings completed 48 hours after they end", async () => {
    const today = nowIst().date;
    const old = await booking("p6", "v23", "s13", "confirmed", 1000, 110000, { date: addDays(today, -3) });
    const recent = await booking("p6", "v23", "s13", "confirmed", 1000, 110000, { date: today });
    expect(await autoComplete(env.DB)).toBeGreaterThanOrEqual(1);
    expect((await sql("SELECT status FROM bookings WHERE id = ?", old))[0].status).toBe("completed");
    expect((await sql("SELECT status FROM bookings WHERE id = ?", recent))[0].status).toBe("confirmed");
    await sql("DELETE FROM bookings WHERE id IN (?, ?)", old, recent);
  });

  it("makes one statement per business for the month, with commission and GST on completed online bookings", async () => {
    expect(await makeStatements(env, new Date("2026-12-01T06:00:00Z"))).toBe(0);   // before the issue day
    expect(await makeStatements(env, now)).toBe(2);
    expect(await makeStatements(env, now)).toBe(0);   // never twice
    const [s] = await sql("SELECT * FROM statements WHERE provider_id = 'p6' AND month = '2026-11'");
    expect(s).toMatchObject({ payout_mode: "invoice", bookings: 3, gross_paise: 250000, collected_paise: 0, commission_paise: 11000 + 10500, gst_paise: 1980 + 1890, tds_paise: 110 + 140, tcs_paise: 0, net_paise: -(21500 + 3870 + 250), status: "draft" });
    const [own] = await sql("SELECT status, commission_paise FROM statements WHERE provider_id = 'p1'");
    expect(own).toEqual({ status: "nothing_due", commission_paise: 42000 });
  });

  it("issues a numbered GST invoice with a payment link and emails it", async () => {
    {
      expect(await issueStatements(env, "https://aestheva.test", now)).toBe(1);
      const [s] = await sql("SELECT * FROM statements WHERE provider_id = 'p6'");
      expect(s).toMatchObject({ status: "issued", invoice_no: "AEV/2627/0001" });
      const link = rp.links.get(s.payment_link_id)!;
      expect(link).toMatchObject({ amount: 25620, reference_id: "AEV/2627/0001" });
      expect(link.customer).toMatchObject({ name: "Thalam Nail & Brow Bar", email: "desk@thalam.example" });
      const mail = sent.find((m) => m.to === "desk@thalam.example")!;
      expect(mail.subject).toBe("Aestheva statement, November 2026 · AEV/2627/0001");
      expect(mail.text).toContain("Amount due: ₹256.20");
      expect(mail.text).toContain(link.short_url);
      expect(await issueStatements(env, "https://aestheva.test", now)).toBe(0);   // already issued

      // The team sees it, with the invoice.
      const opsCookie = (await send("POST", "/ops/login", { key: "test-ops-key" })).headers.get("set-cookie")!.split(";")[0];
      expect((await send("GET", "/ops/money", undefined, opsCookie)).text).toContain("AEV/2627/0001");
      const page = await send("GET", `/ops/statements/${s.id}`, undefined, opsCookie);
      for (const t of ["Tax invoice", "GSTIN 32AAHCH7753F1ZL", "CIN U47720KL2025PTC092343", "CGST 9%", "SGST 9%", "₹215", "₹38.70", "Invoice total", "₹253.70", "No-show", "Income-tax TDS, 0.1% of the gross value", "₹2.50", "You pay Aestheva", "₹256.20"]) expect(page.text, t).toContain(t);
    }
  });

  it("marks the statement paid when Razorpay says the link was paid", async () => {
    const [s] = await sql("SELECT id, payment_link_id FROM statements WHERE provider_id = 'p6'");
    const r = await webhook("payment_link.paid", { payment_link: { entity: { id: s.payment_link_id, status: "paid" } } }, "evt_plink_1");
    expect(r.status).toBe(200);
    expect((await sql("SELECT status, paid_at FROM statements WHERE id = ?", s.id))[0].status).toBe("paid");
  });

  it("gives the CA a tax file for the month", async () => {
    const opsCookie = (await send("POST", "/ops/login", { key: "test-ops-key" })).headers.get("set-cookie")!.split(";")[0];
    const r = await send("GET", "/ops/money.csv?month=2026-11", undefined, opsCookie);
    expect(r.headers.get("content-type")).toContain("text/csv");
    expect(r.text).toContain("Gross value (₹),Value excl. GST (₹)");
    expect(r.text).toMatch(/AEV\/2627\/0001,Thalam Nail & Brow Bar,,,AE-T\d+,2026-11-10,completed,1100\.00,1100\.00,0\.00,110\.00,19\.80,1\.10,0\.00,-130\.90/);
  });

  it("also finds paid links by asking Razorpay, in case a webhook is missed", async () => {
    await sql("UPDATE statements SET status = 'issued', paid_at = NULL WHERE provider_id = 'p6'");
    const [s] = await sql("SELECT payment_link_id FROM statements WHERE provider_id = 'p6'");
    rp.links.get(s.payment_link_id)!.status = "paid";
    expect(await checkLinks(env)).toBe(1);
    expect((await sql("SELECT status FROM statements WHERE provider_id = 'p6'"))[0].status).toBe("paid");
  });
});
