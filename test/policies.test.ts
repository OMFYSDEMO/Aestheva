import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { pruneApplications } from "../src/services/applications";
import { req, seed, sql } from "./helpers";

beforeAll(seed);

describe("privacy and data protection", () => {
  it("publishes a privacy notice that says who is responsible, what is kept and how to complain", async () => {
    const r = await req("GET", "/policies/privacy");
    expect(r.status).toBe(200);
    for (const s of ["Who is responsible", "data fiduciary", "We don't sell or rent personal data", "Razorpay Software Private Limited", "Cloudflare, Inc.",
      "Asia-Pacific region", "8 years after the booking", "Grievance Officer", "Shaji Anandan, Haswel Care Private Limited", "Data Protection Board of India", "ae_via", "Children"]) expect(r.text, s).toContain(s);
  });

  it("publishes data protection terms for businesses that keep clinical records with the business", async () => {
    const r = await req("GET", "/policies/data-protection");
    expect(r.status).toBe(200);
    for (const s of ["Who is responsible for what", "<b>Your business only</b>", "Keep health information off Aestheva", "will indemnify", "12 months before the claim",
      "Can Aestheva see our patient records", "13 May 2027", "within 72 hours"]) expect(r.text, s).toContain(s);
    expect((await req("GET", "/policies/terms")).text).toContain("/policies/data-protection");
    expect((await req("GET", "/")).text).toContain('href="/policies/data-protection"');
    expect((await req("GET", "/sitemap.xml")).text).toContain("/policies/data-protection");
  });

  it("clears the anti-spam code after 7 days and deletes declined applications after 2 years", async () => {
    const add = (id: string, status: string, ago: string) => sql(`INSERT INTO applications (id, ref, business_name, business_type, area, address, contact_name, contact_role, phone, email, services_text, status, ip_hash, created_at)
      VALUES (?, ?, 'Test', 'Clinic', 'Pattom', 'Somewhere', 'A', 'Owner', '+919800000000', 'a@example.com', 'Facials', ?, 'hash', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?))`, id, "AP-" + id, status, ago);
    await add("RET1", "new", "-1 days"); await add("RET2", "reviewing", "-8 days"); await add("RET3", "declined", "-25 months"); await add("RET4", "declined", "-23 months");
    await pruneApplications(env.DB);
    const rows = await sql("SELECT id, ip_hash FROM applications WHERE id LIKE 'RET%' ORDER BY id");
    expect(rows).toEqual([{ id: "RET1", ip_hash: "hash" }, { id: "RET2", ip_hash: "" }, { id: "RET4", ip_hash: "" }]);
  });
});
