import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { seed, sql } from "./helpers";

beforeAll(seed);

/** Posts a form the way a browser does and returns status, body and headers. */
async function send(method: string, path: string, form?: Record<string, string | string[]>, opts: { cookie?: string; ip?: string } = {}) {
  const body = form ? new URLSearchParams(Object.entries(form).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => [k, x]))).toString() : undefined;
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, redirect: "manual", body,
    headers: { ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(opts.cookie ? { cookie: opts.cookie } : {}), "cf-connecting-ip": opts.ip ?? "203.0.113.7" },
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  return { status: res.status, text: await res.text(), headers: res.headers };
}

const good = (patch: Record<string, string | string[]> = {}) => ({
  t: String(Date.now() - 60_000), company_website: "",
  business_name: "Sea Breeze Dental", business_type: "Clinic", area: "Pattom", address: "TC 12/345, Pattom Palace Road, Thiruvananthapuram 695004",
  website: "https://seabreeze.example", contact_name: "Anjali Menon", contact_role: "Owner", phone: "98470 12345", email: "anjali@seabreeze.example",
  categories: ["dental", "skin"], medical: "yes", team_size: "3", services_text: "Scaling, 20 min, ₹1,500\nFillings from ₹1,000",
  establishment_reg: "KL-CE-2024-0001", practitioner_reg: "Kerala State Dental Council 12345", gstin: "32ABCDE1234F1Z5", heard_from: "A friend", consent: "yes",
  ...patch,
});

describe("online applications", () => {
  it("shows the form and links to it from the practitioners page", async () => {
    const form = await send("GET", "/for-practitioners/apply");
    expect(form.status).toBe(200);
    for (const s of ["Tell us about your practice", 'name="business_name"', 'value="dental"', "Send application"]) expect(form.text).toContain(s);
    expect((await send("GET", "/for-practitioners")).text).toContain('href="/for-practitioners/apply"');
  });

  it("stores a valid application and thanks the applicant with a reference", async () => {
    const r = await send("POST", "/for-practitioners/apply", good());
    expect(r.status).toBe(200);
    const ref = /AP-[2-9A-HJ-NP-Z]{6}/.exec(r.text)?.[0];
    expect(ref).toBeTruthy();
    expect(r.text).toContain("Thank you, Anjali");
    const [a] = await sql("SELECT * FROM applications WHERE ref = ?", ref);
    expect(a).toMatchObject({ business_name: "Sea Breeze Dental", phone: "+919847012345", email: "anjali@seabreeze.example", medical: 1, team_size: 3, status: "new", area: "Pattom" });
    expect(JSON.parse(a.categories_json)).toEqual(["dental", "skin"]);
    expect(a.ip_hash).toMatch(/^[0-9a-f]{32}$/);
    expect((await sql("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'application.created' AND entity_id = ?", ref))[0].n).toBe(1);
    // Sending the same application again doesn't create a second one.
    const again = await send("POST", "/for-practitioners/apply", good());
    expect(again.text).toContain(ref!);
    expect((await sql("SELECT COUNT(*) AS n FROM applications WHERE business_name = 'Sea Breeze Dental'"))[0].n).toBe(1);
  });

  it("explains what to fix and keeps the applicant's answers", async () => {
    const r = await send("POST", "/for-practitioners/apply", good({ business_name: "Glow Studio", phone: "12345", email: "nope", categories: [], gstin: "123", consent: "" }));
    expect(r.status).toBe(400);
    for (const s of ["Please check 5 answers", "10-digit Indian mobile number", "valid email address", "at least one kind of service", "doesn&#39;t look like a GSTIN", "authorised"]) expect(r.text).toContain(s);
    expect(r.text).toContain('value="Glow Studio"');
    expect(r.text).toContain('aria-invalid="true"');
    expect((await sql("SELECT COUNT(*) AS n FROM applications WHERE business_name = 'Glow Studio'"))[0].n).toBe(0);
  });

  it("accepts an area outside the launch list", async () => {
    const r = await send("POST", "/for-practitioners/apply", good({ business_name: "Kovalam Calm Spa", business_type: "Wellness centre", area: "Other", area_other: "Kovalam", medical: "no", categories: ["ayur"], phone: "9876501234" }));
    expect(r.status).toBe(200);
    expect((await sql("SELECT area, medical FROM applications WHERE business_name = 'Kovalam Calm Spa'"))[0]).toEqual({ area: "Other: Kovalam", medical: 0 });
  });

  it("quietly ignores bots: a filled hidden field, or a form sent back in under three seconds", async () => {
    const trap = await send("POST", "/for-practitioners/apply", good({ business_name: "Spam One", company_website: "http://spam.example" }));
    const fast = await send("POST", "/for-practitioners/apply", good({ business_name: "Spam Two", t: String(Date.now()) }));
    expect(trap.status).toBe(200); expect(fast.status).toBe(200);
    expect(trap.text).toContain("Application received");
    expect((await sql("SELECT COUNT(*) AS n FROM applications WHERE business_name LIKE 'Spam%'"))[0].n).toBe(0);
  });

  it("limits how many applications one connection can send in an hour", async () => {
    const ip = "198.51.100.42";
    for (let i = 0; i < 5; i++) expect((await send("POST", "/for-practitioners/apply", good({ business_name: `Flood ${i}`, phone: `98000000${10 + i}` }), { ip })).status).toBe(200);
    const sixth = await send("POST", "/for-practitioners/apply", good({ business_name: "Flood 5", phone: "9800000020" }), { ip });
    expect(sixth.status).toBe(429);
  });
});

describe("team review pages", () => {
  const signIn = async () => {
    const r = await send("POST", "/ops/login", { key: "test-ops-key" });
    expect(r.status).toBe(303);
    const cookie = r.headers.get("set-cookie")!;
    expect(cookie).toMatch(/ae_ops=\d+\.[0-9a-f]{64}/);
    expect(cookie).toMatch(/HttpOnly/i); expect(cookie).toMatch(/SameSite=Strict/i); expect(cookie).toMatch(/Path=\/ops/);
    return cookie.split(";")[0];
  };

  it("keeps applications private until the team signs in", async () => {
    for (const p of ["/ops", "/ops/applications"]) {
      const r = await send("GET", p);
      expect(r.status, p).toBe(303);
      expect(r.headers.get("location")).toBe("/ops/login");
    }
    expect((await send("GET", "/ops/applications", undefined, { cookie: "ae_ops=9999999999999.forged" })).status).toBe(303);
    const wrong = await send("POST", "/ops/login", { key: "guess" });
    expect(wrong.status).toBe(401);
    expect(wrong.text).toContain("That password isn&#39;t right.");
  });

  it("lists applications, shows one with a venue file draft, and saves a review", async () => {
    const cookie = await signIn();
    const list = await send("GET", "/ops/applications", undefined, { cookie });
    expect(list.status).toBe(200);
    expect(list.headers.get("cache-control")).toBe("no-store");
    expect(list.text).toContain("Sea Breeze Dental");
    const [a] = await sql("SELECT ref FROM applications WHERE business_name = 'Sea Breeze Dental'");
    const detail = await send("GET", `/ops/applications/${a.ref}`, undefined, { cookie });
    for (const s of ["Kerala State Dental Council 12345", "providers/sea-breeze-dental.json", "&quot;slug&quot;: &quot;sea-breeze-dental-pattom&quot;", 'href="tel:+919847012345"']) expect(detail.text).toContain(s);
    const csrf = /name="csrf" value="([0-9a-f]{64})"/.exec(detail.text)![1];

    const forged = await send("POST", `/ops/applications/${a.ref}`, { csrf: "0".repeat(64), status: "approved", notes: "x" }, { cookie });
    expect(forged.status).toBe(403);
    const saved = await send("POST", `/ops/applications/${a.ref}`, { csrf, status: "reviewing", notes: "Called on Monday; visiting Thursday." }, { cookie });
    expect(saved.status).toBe(303);
    expect((await sql("SELECT status, team_notes FROM applications WHERE ref = ?", a.ref))[0]).toEqual({ status: "reviewing", team_notes: "Called on Monday; visiting Thursday." });
    expect((await send("GET", "/ops/applications?status=reviewing", undefined, { cookie })).text).toContain("Sea Breeze Dental");
  });

  it("keeps team notes out of public pages and the sitemap", async () => {
    expect((await send("GET", "/robots.txt")).text).not.toContain("Called on Monday");
    expect((await send("GET", "/sitemap.xml")).text).not.toContain("/ops");
  });
});
