import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { nowIst } from "../src/domain/time";
import { PARTNER_TERMS_VERSION } from "../src/services/partner-portal";
import { seed, sql } from "./helpers";

beforeAll(seed);

async function send(method: string, path: string, form?: Record<string, string>, cookie?: string, ip = "198.51.100.71") {
  const body = form ? new URLSearchParams(form).toString() : undefined;
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, redirect: "manual", body,
    headers: { ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(cookie ? { cookie } : {}), "cf-connecting-ip": ip },
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  return { status: res.status, text: await res.text(), headers: res.headers };
}
const csrfIn = (html: string) => /name="csrf" value="([0-9a-f]{64})"/.exec(html)![1];
const cookieOf = (r: { headers: Headers }) => r.headers.get("set-cookie")!.split(";")[0];
const linkIn = (text: string) => /https:\/\/aestheva\.test(\/partners\/set-password\?t=[A-Za-z0-9_-]+)/.exec(text)![1];
const tokenOf = (path: string) => new URL("https://x" + path).searchParams.get("t")!;

type Sent = { to: string; subject: string; text: string };
let sent: Sent[] = [], failWith: string | null = null;
let ops = "", opsCsrf = "", partnerId = "", otherId = "", cookie = "", csrf = "";
const password = "chai at marine drive at six";

const application = (over: Record<string, string> = {}) => ({
  name: "Divya Menon", phone: "98470 12345", email: "divya@example.com", city: "Kochi", background: "Salon or spa manager",
  network: "I managed a salon in Kadavanthra for eight years and know most owners in Edappally and Vyttila.", businesses_90: "12",
  online: "", consent: "yes", t: String(Date.now() - 60_000), website: "", ...over,
});

describe("Regional Partner portal", () => {
  beforeAll(async () => {
    (env as { EMAIL: unknown }).EMAIL = { send: async (m: Sent) => { if (failWith) throw Object.assign(new Error("nope"), { code: failWith }); sent.push(m); return { messageId: "m" }; } };
    ops = cookieOf(await send("POST", "/ops/login", { key: "test-ops-key" }));
    opsCsrf = csrfIn((await send("GET", "/ops/partners", undefined, ops)).text);
  });

  it("takes applications on the public page, with checks, and ignores bots", async () => {
    const page = await send("GET", "/become-a-partner");
    expect(page.status).toBe(200);
    expect(page.text).toContain("Become an Aestheva Regional Partner");
    expect(page.text).toContain('action="/become-a-partner#apply"');
    expect((await send("GET", "/sitemap.xml")).text).toContain("/become-a-partner");
    expect((await send("GET", "/")).text).toContain('href="/become-a-partner"');

    const bad = await send("POST", "/become-a-partner", application({ phone: "12345", network: "short", consent: "" }));
    expect(bad.status).toBe(400);
    expect(bad.text).toContain("10-digit Indian mobile");
    expect(bad.text).toContain("Please check 3 answers");

    const bot = await send("POST", "/become-a-partner", application({ website: "http://spam.example" }));
    expect(bot.status).toBe(200);
    expect(await sql("SELECT * FROM partner_applications")).toHaveLength(0);

    sent = [];
    const ok = await send("POST", "/become-a-partner", application());
    expect(ok.status).toBe(200);
    const [a] = await sql("SELECT * FROM partner_applications");
    expect(a.ref).toMatch(/^RP-/);
    expect(a.phone).toBe("+919847012345");
    expect(ok.text).toContain(a.ref);
    expect(sent.some((m) => m.subject.includes("Partner application: Divya Menon"))).toBe(true);
    // The same person sending it twice on a day gets the same reference, not a second record.
    const again = await send("POST", "/become-a-partner", application());
    expect(again.text).toContain(a.ref);
    expect(await sql("SELECT * FROM partner_applications")).toHaveLength(1);
  });

  it("lets the team review an application and create a partner from it", async () => {
    const list = (await send("GET", "/ops/partners", undefined, ops)).text;
    expect(list).toContain("Applications to become a partner");
    expect(list).toContain("Divya Menon");
    const [a] = await sql("SELECT ref FROM partner_applications");
    expect((await send("GET", `/ops/partners/applications/${a.ref}`, undefined, ops)).text).toContain("Edappally and Vyttila");
    expect((await send("GET", `/ops/partners/applications/${a.ref}`)).status).toBe(303);   // team only

    const saved = await send("POST", `/ops/partners/applications/${a.ref}`, { csrf: opsCsrf, status: "talking", team_notes: "Called; two references fine." }, ops);
    expect(saved.status).toBe(303);
    expect((await sql("SELECT status, team_notes FROM partner_applications"))[0]).toMatchObject({ status: "talking", team_notes: "Called; two references fine." });

    const prefilled = (await send("GET", `/ops/partners?from=${a.ref}`, undefined, ops)).text;
    expect(prefilled).toContain('value="divya@example.com"');
    expect(prefilled).toContain(`name="application_ref" value="${a.ref}"`);
    const made = await send("POST", "/ops/partners", { csrf: opsCsrf, application_ref: a.ref, name: "Divya Menon", region: "Kochi", code: "KOCHI02",
      email: "divya@example.com", phone: "+919847012345", pan: "ABCDE1234F", bank_name: "Divya Menon", bank_account: "987654321012", bank_ifsc: "SBIN0070123", status: "active" }, ops);
    expect(made.status).toBe(303);
    partnerId = (await sql("SELECT id FROM partners WHERE code = 'KOCHI02'"))[0].id;
    expect((await sql("SELECT status, partner_id FROM partner_applications"))[0]).toMatchObject({ status: "accepted", partner_id: partnerId });

    // A second partner, to check one partner never sees another's records.
    await send("POST", "/ops/partners", { csrf: opsCsrf, name: "Other Partner", region: "Thrissur", code: "THR01", email: "other@example.com", status: "active" }, ops);
    otherId = (await sql("SELECT id FROM partners WHERE code = 'THR01'"))[0].id;
  });

  it("keeps the portal private", async () => {
    for (const p of ["/partners", "/partners/statements", "/partners/toolkit", "/partners/terms", "/partners/profile"]) {
      const r = await send("GET", p);
      expect(r.status).toBe(303);
      expect(r.headers.get("location")).toBe("/partners/login");
    }
    expect((await send("GET", "/partners/login")).text).toContain("For Aestheva Regional Partners");
  });

  it("invites a partner by email, with a one-time link to set a password", async () => {
    sent = [];
    const r = await send("POST", `/ops/partners/${partnerId}/portal`, { csrf: opsCsrf, action: "invite" }, ops);
    expect(r.status).toBe(303);
    const mail = sent.find((m) => m.to === "divya@example.com")!;
    expect(mail.subject).toBe("Your Aestheva Regional Partner portal");
    const link = linkIn(mail.text);
    expect((await send("GET", link)).text).toContain("divya@example.com");
    expect((await send("POST", "/partners/set-password", { t: tokenOf(link), password: "short", confirm: "short" })).status).toBe(400);
    const set = await send("POST", "/partners/set-password", { t: tokenOf(link), password, confirm: password });
    expect(set.headers.get("location")).toBe("/partners/login?set=1");
    expect((await send("GET", link)).status).toBe(410);   // used once

    const page = (await send("GET", `/ops/partners/${partnerId}`, undefined, ops)).text;
    expect(page).toContain("Password set");
    expect(page).toContain("Not yet accepted");
  });

  it("shows the team the link when the email can't be sent", async () => {
    failWith = "E_SENDER_NOT_VERIFIED";
    const r = await send("POST", `/ops/partners/${otherId}/portal`, { csrf: opsCsrf, action: "invite" }, ops);
    failWith = null;
    expect(r.status).toBe(200);
    expect(r.text).toContain("couldn");
    expect(r.text).toMatch(/\/partners\/set-password\?t=[A-Za-z0-9_-]{40,}/);
  });

  it("signs in, locks out after repeated failures, and asks for the terms", async () => {
    const wrong = await send("POST", "/partners/login", { email: "divya@example.com", password: "not the password" });
    expect(wrong.status).toBe(401);
    const ok = await send("POST", "/partners/login", { email: "Divya@Example.com", password });
    expect(ok.status).toBe(303);
    expect(ok.headers.get("set-cookie")).toMatch(/ae_partner=.*Path=\/partners.*HttpOnly/i);
    cookie = cookieOf(ok);
    const home = await send("GET", "/partners", undefined, cookie);
    expect(home.status).toBe(200);
    expect(home.text).toContain("Hello, Divya");
    expect(home.text).toContain("https://aestheva.test/partner/KOCHI02");
    expect(home.text).toContain("Please read and accept the partner terms");
    csrf = csrfIn(home.text);

    for (let i = 0; i < 5; i++) await send("POST", "/partners/login", { email: "other@example.com", password: "guessing again" });
    expect((await send("POST", "/partners/login", { email: "other@example.com", password: "guessing again" })).status).toBe(429);
  });

  it("records acceptance of the partner terms, with a form token", async () => {
    const terms = (await send("GET", "/partners/terms", undefined, cookie)).text;
    expect(terms).toContain("Code of conduct");
    expect(terms).toContain("TVDH01489F");
    expect((await send("POST", "/partners/terms", { csrf: "0".repeat(64), agree: "yes" }, cookie)).status).toBe(403);
    expect((await send("POST", "/partners/terms", { csrf }, cookie)).status).toBe(400);
    expect((await send("POST", "/partners/terms", { csrf, agree: "yes" }, cookie)).status).toBe(303);
    const p = (await sql("SELECT terms_version, terms_accepted_at FROM partners WHERE id = ?", partnerId))[0];
    expect(p.terms_version).toBe(PARTNER_TERMS_VERSION);
    expect(p.terms_accepted_at).toBeTruthy();
    expect((await send("GET", "/partners", undefined, cookie)).text).not.toContain("Please read and accept");
    expect((await sql("SELECT * FROM audit_log WHERE action = 'partner.terms_accepted'"))).toHaveLength(1);
  });

  it("shows only the partner's own businesses and statements", async () => {
    const [v1, v2] = await sql("SELECT id, name FROM providers ORDER BY name LIMIT 2");
    await sql("UPDATE providers SET partner_id = ? WHERE id = ?", partnerId, v1.id);
    await sql("UPDATE providers SET partner_id = ? WHERE id = ?", otherId, v2.id);
    const month = nowIst().date.slice(0, 7);
    await sql(`INSERT INTO partner_statements (id, partner_id, month, number, share_paise, bonus_paise, gross_paise, gst_paise, tds_paise, net_paise, status) VALUES
      ('ps_mine', ?, ?, 'PS/TEST/0001', 50000, 75000, 125000, 0, 0, 125000, 'issued'), ('ps_theirs', ?, ?, 'PS/TEST/0002', 9900, 0, 9900, 0, 0, 9900, 'issued')`, partnerId, month, otherId, month);

    const home = (await send("GET", "/partners", undefined, cookie)).text;
    expect(home).toContain(v1.name.replace(/'/g, "&#39;"));
    expect(home).not.toContain(v2.name.replace(/'/g, "&#39;"));
    expect(home).toContain("setup steps");
    expect(home).toContain("₹1,250");

    const list = (await send("GET", "/partners/statements", undefined, cookie)).text;
    expect(list).toContain("PS/TEST/0001");
    expect(list).not.toContain("PS/TEST/0002");
    const mine = await send("GET", "/partners/statements/ps_mine", undefined, cookie);
    expect(mine.status).toBe(200);
    expect(mine.text).not.toContain("Mark as paid");
    expect((await send("GET", "/partners/statements/ps_theirs", undefined, cookie)).status).toBe(404);
  });

  it("gives the toolkit with their link, and shows their details with the account masked", async () => {
    const kit = (await send("GET", "/partners/toolkit", undefined, cookie)).text;
    expect(kit).toContain("WhatsApp message");
    expect(kit).toContain("https://aestheva.test/partner/KOCHI02");
    const me = (await send("GET", "/partners/profile", undefined, cookie)).text;
    expect(me).toContain("•••• 1012");
    expect(me).not.toContain("987654321012");
  });

  it("ends the session when the team turns the login off", async () => {
    expect((await send("POST", `/ops/partners/${partnerId}/portal`, { csrf: opsCsrf, action: "disable" }, ops)).status).toBe(303);
    expect((await send("GET", "/partners", undefined, cookie)).status).toBe(303);
    expect((await send("POST", "/partners/login", { email: "divya@example.com", password })).status).toBe(401);
    await send("POST", `/ops/partners/${partnerId}/portal`, { csrf: opsCsrf, action: "enable" }, ops);
    expect((await send("POST", "/partners/login", { email: "divya@example.com", password })).status).toBe(303);
  });

  it("answers 'forgot password' the same way whether or not the email has a login", async () => {
    sent = [];
    const a = await send("POST", "/partners/forgot", { email: "divya@example.com" });
    const b = await send("POST", "/partners/forgot", { email: "nobody@example.com" });
    expect(a.text).toContain("If that email has a partner login");
    expect(b.text).toContain("If that email has a partner login");
    expect(sent.filter((m) => m.subject.includes("Reset your Aestheva partner password"))).toHaveLength(1);
  });
});
