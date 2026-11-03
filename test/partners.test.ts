import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { addMonths, inWindow, makePartnerStatements, partnerEarns } from "../src/services/partners";
import { seed, sql } from "./helpers";

beforeAll(seed);

async function send(method: string, path: string, form?: Record<string, string | string[]>, cookie?: string) {
  const body = form ? new URLSearchParams(Object.entries(form).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => [k, x]))).toString() : undefined;
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, redirect: "manual", body,
    headers: { ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(cookie ? { cookie } : {}), "cf-connecting-ip": "198.51.100.44" },
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  return { status: res.status, text: await res.text(), headers: res.headers };
}
const csrfIn = (html: string) => /name="csrf" value="([0-9a-f]{64})"/.exec(html)![1];
/** 10:00 India time on a date, as the scheduled job would see it. */
const at = (date: string) => new Date(`${date}T04:30:00Z`);

let ops = "", csrf = "", partnerId = "";

describe("Regional Partners", () => {
  beforeAll(async () => {
    ops = (await send("POST", "/ops/login", { key: "test-ops-key" })).headers.get("set-cookie")!.split(";")[0];
    csrf = csrfIn((await send("GET", "/ops/partners", undefined, ops)).text);
  });

  it("works out months, the 24-month window and when an ended partner stops earning", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(inWindow("2026-08", "2026-08-15")).toBe(true);
    expect(inWindow("2028-07", "2026-08-15")).toBe(true);
    expect(inWindow("2028-08", "2026-08-15")).toBe(false);
    expect(inWindow("2026-07", "2026-08-15")).toBe(false);
    expect(partnerEarns({ status: "ended", ended_on: "2026-03-20" }, "2026-09")).toBe(true);
    expect(partnerEarns({ status: "ended", ended_on: "2026-03-20" }, "2026-10")).toBe(false);
    expect(partnerEarns({ status: "terminated", ended_on: "2026-03-20" }, "2026-04")).toBe(false);
  });

  it("adds a partner, with checks on PAN, bank details and a unique code", async () => {
    const bad = await send("POST", "/ops/partners", { csrf, name: "Anitha Joseph", region: "Kochi", code: "KOCHI01", pan: "1234", status: "active" }, ops);
    expect(bad.status).toBe(400);
    expect(bad.text).toContain("A PAN has 10 characters");
    const ok = await send("POST", "/ops/partners", { csrf, name: "Anitha Joseph", region: "Kochi", code: "kochi01", email: "anitha@example.com", phone: "9847000001",
      pan: "ABCDE1234F", bank_name: "Anitha Joseph", bank_account: "123456789012", bank_ifsc: "SBIN0070123", agreement_date: "2026-08-01", status: "active" }, ops);
    expect(ok.status).toBe(303);
    partnerId = (await sql("SELECT id FROM partners WHERE code = 'KOCHI01'"))[0].id;
    const dup = await send("POST", "/ops/partners", { csrf, name: "Someone Else", region: "Kochi", code: "KOCHI01", status: "active" }, ops);
    expect(dup.status).toBe(409);
    const page = (await send("GET", `/ops/partners/${partnerId}`, undefined, ops)).text;
    expect(page).toContain("/partner/KOCHI01");
    expect(page).toContain("•••• 9012");        // shown masked; the full number is only in the edit form
  });

  it("carries the partner's link to the application, and credits the business when it is approved", async () => {
    const r = await send("GET", "/partner/kochi01");
    expect(r.headers.get("location")).toBe("/for-practitioners?partner=KOCHI01&utm_source=partner&utm_campaign=KOCHI01");
    expect((await send("GET", "/partner/NOBODY1")).headers.get("location")).toBe("/for-practitioners");
    const landing = await send("GET", "/for-practitioners?partner=KOCHI01&utm_source=partner&utm_campaign=KOCHI01");
    expect(landing.text).toContain("partner=KOCHI01");
    const form = await send("GET", "/for-practitioners/apply?partner=KOCHI01&utm_source=partner&utm_campaign=KOCHI01");
    expect(form.text).toContain('name="partner_code"');
    expect(form.text).toMatch(/name="partner_code"[^>]*value="KOCHI01"|value="KOCHI01"[^>]*name="partner_code"/);

    const app_ = (patch: Record<string, string | string[]> = {}) => ({
      t: String(Date.now() - 60_000), company_website: "", business_name: "Marine Drive Glow Studio", business_type: "Salon & studio", area: "Pattom",
      address: "12 Shanmugham Road, Marine Drive, Ernakulam 682031", website: "", contact_name: "Riya Thomas", contact_role: "Owner", phone: "98470 77701",
      email: "riya@glow.example", categories: ["skin"], medical: "no", team_size: "2", services_text: "Facial ₹1,500, threading ₹80", heard_from: "", consent: "yes", ...patch,
    });
    const unknown = await send("POST", "/for-practitioners/apply", app_({ partner_code: "NOBODY1" }));
    expect(unknown.status).toBe(400);
    expect(unknown.text).toContain("recognise that partner code");
    const done = await send("POST", "/for-practitioners/apply", app_({ partner_code: "kochi01" }));
    const ref = /AP-[2-9A-HJ-NP-Z]{6}/.exec(done.text)![0];
    expect((await sql("SELECT partner_code FROM applications WHERE ref = ?", ref))[0].partner_code).toBe("KOCHI01");
    const detail = await send("GET", `/ops/applications/${ref}`, undefined, ops);
    expect(detail.text).toContain("KOCHI01");
    await send("POST", `/ops/applications/${ref}/approve`, { csrf: csrfIn(detail.text) }, ops);
    const [a] = await sql("SELECT provider_id FROM applications WHERE ref = ?", ref);
    expect((await sql("SELECT partner_id FROM providers WHERE id = ?", a.provider_id))[0].partner_id).toBe(partnerId);
  });

  it("never credits Haswel Care's own businesses to a partner", async () => {
    const r = await send("POST", `/ops/partners/${partnerId}/businesses`, { csrf, provider_id: "p2" }, ops);   // the sample venues are all 'own'
    expect(r.status).toBe(400);
    expect(r.text).toContain("own businesses, so it");
  });

  it("makes the monthly statement: 25% of commission received, the activation bonus, TDS once past ₹20,000", async () => {
    // A live business of the partner's, live since 15 August, with October's commission (₹3,000) paid in November
    // and September's (₹2,000) paid in October; plus a statement from two years ago, outside the 24 months.
    const [v] = await sql("SELECT id FROM providers WHERE status = 'live' AND id <> 'p2' ORDER BY id LIMIT 1");
    await sql("UPDATE providers SET payout_mode = 'invoice', partner_id = ?, live_since = '2026-08-15' WHERE id = ?", partnerId, v.id);
    const stmt = (id: string, month: string, commission: number, status: string, paidAt: string | null) =>
      sql(`INSERT INTO statements (id, provider_id, month, payout_mode, bookings, gross_paise, collected_paise, commission_paise, gst_paise, tds_paise, tcs_paise, net_paise, status, issued_at, paid_at)
           VALUES (?, ?, ?, 'invoice', 1, 0, 0, ?, 0, 0, 0, 0, ?, ?, ?)`, id, v.id, month, commission, status, paidAt ?? "2026-10-03T05:00:00.000Z", paidAt);
    await stmt("st_sep", "2026-09", 200000, "paid", "2026-10-06T06:00:00.000Z");
    await stmt("st_old", "2024-06", 900000, "paid", "2026-10-07T06:00:00.000Z");
    await stmt("st_oct", "2026-10", 300000, "paid", "2026-11-04T06:00:00.000Z");
    // Five completed online bookings in its first 60 days: the ₹750 bonus. A booking the business added itself doesn't count.
    const [sv] = await sql("SELECT s.id, (SELECT id FROM staff WHERE provider_id = s.provider_id LIMIT 1) AS staff_id FROM services s WHERE s.provider_id = ? LIMIT 1", v.id);
    await sql("INSERT INTO clients (id, name, phone) VALUES ('cl_partner_test', 'Test Client', '+919700000099')");
    for (let i = 0; i < 6; i++)
      await sql(`INSERT INTO bookings (id, ref, provider_id, service_id, staff_id, client_id, date, start_min, dur_min, service_name, kind, price_paise, deposit_paise, commission_bp, source, status, manage_token_hash)
        VALUES (?, ?, ?, ?, ?, 'cl_partner_test', ?, 600, 30, 'Facial', 'beauty', 100000, 0, 750, ?, 'completed', 'x')`,
        `bk_pt_${i}`, `AE-PT${i}AAA`, v.id, sv.id, sv.staff_id, `2026-09-${String(10 + i).padStart(2, "0")}`, i === 0 ? "direct" : "marketplace");

    // Before the 10th nothing is made.
    expect(await makePartnerStatements(env, at("2026-11-09"))).toBe(0);
    // On 10 November, October's statement: September's commission (received in October) and the bonus reached in September.
    // The 2024 statement is outside the 24 months; October's commission was received in November, so it waits.
    expect(await makePartnerStatements(env, at("2026-11-10"))).toBe(1);
    expect(await makePartnerStatements(env, at("2026-11-11"))).toBe(0);   // safe to run again
    const [oct] = await sql("SELECT * FROM partner_statements WHERE partner_id = ? AND month = '2026-10'", partnerId);
    expect(oct).toMatchObject({ number: "PS/2627/0001", share_paise: 50000, bonus_paise: 75000, gross_paise: 125000, gst_paise: 0, tds_paise: 0, net_paise: 125000, status: "issued" });
    expect(await sql("SELECT kind, source_statement_id, base_paise, amount_paise FROM partner_lines WHERE statement_id = ? ORDER BY kind", oct.id)).toEqual([
      { kind: "bonus", source_statement_id: null, base_paise: 0, amount_paise: 75000 },
      { kind: "share", source_statement_id: "st_sep", base_paise: 200000, amount_paise: 50000 },
    ]);

    // Earlier this year the partner was paid ₹19,000 without TDS. December's run passes ₹20,000, so 2% TDS is taken on the
    // whole year's amount so far.
    await sql(`INSERT INTO partner_statements (id, partner_id, month, number, share_paise, bonus_paise, gross_paise, gst_paise, tds_paise, net_paise, status)
               VALUES ('ps_earlier', ?, '2026-07', 'PS/2627/0050', 1900000, 0, 1900000, 0, 0, 1900000, 'paid')`, partnerId);
    expect(await makePartnerStatements(env, at("2026-12-10"))).toBe(1);
    const [nov] = await sql("SELECT * FROM partner_statements WHERE partner_id = ? AND month = '2026-11'", partnerId);
    expect(nov).toMatchObject({ share_paise: 75000, bonus_paise: 0, gross_paise: 75000, tds_paise: Math.round((75000 + 125000 + 1900000) * 0.02), net_paise: 75000 - 42000 });

    // The team pays it and records the reference; the accountant and bank files have it.
    const bank = (await send("GET", "/ops/partners/bank.csv", undefined, ops)).text;
    expect(bank).toContain("Anitha Joseph,123456789012,SBIN0070123,330.00,Aestheva partner");
    const st = await send("GET", `/ops/partners/statements/${nov.id}`, undefined, ops);
    expect(st.text).toContain("section 393(1)");
    expect(st.text).toContain("TAN TVDH01489F");
    expect((await send("POST", `/ops/partners/statements/${nov.id}/paid`, { csrf, paid_on: "2026-12-12", paid_ref: "UTR1234567" }, ops)).status).toBe(303);
    expect((await send("POST", `/ops/partners/statements/${nov.id}/paid`, { csrf, paid_on: "2026-12-12", paid_ref: "UTR1234567" }, ops)).status).toBe(409);
    const accounts = (await send("GET", "/ops/partners.csv?month=2026-11", undefined, ops)).text;
    expect(accounts).toContain("Anitha Joseph,KOCHI01,Kochi,ABCDE1234F,,750.00,0.00,750.00,0.00,420.00,330.00,paid,2026-12-12,UTR1234567,TVDH01489F");
    expect((await send("GET", "/ops/partners/bank.csv", undefined, ops)).text).not.toContain("330.00");
    const list = (await send("GET", "/ops/partners", undefined, ops)).text;
    expect(list).toContain("Anitha Joseph");
    const card = (await send("GET", `/ops/partners/${partnerId}?month=2026-11`, undefined, ops)).text;
    expect(card).toContain("Scorecard");
    expect(card).toContain("PS/2627/0001");
  });
});
