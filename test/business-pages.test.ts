import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { TRADES } from "../src/views/trades";
import { carrySource, pruneClickIds, readSource } from "../src/services/adsource";
import { seed, sql } from "./helpers";

beforeAll(seed);

async function send(method: string, path: string, form?: Record<string, string | string[]>, cookie?: string) {
  const body = form ? new URLSearchParams(Object.entries(form).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => [k, x]))).toString() : undefined;
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, redirect: "manual", body,
    headers: { ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(cookie ? { cookie } : {}), "cf-connecting-ip": "198.51.100.9" },
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  return { status: res.status, text: await res.text(), headers: res.headers };
}

const application = (patch: Record<string, string | string[]> = {}) => ({
  t: String(Date.now() - 60_000), company_website: "",
  business_name: "Mirror Mirror Unisex Salon", business_type: "Salon & studio", area: "Pattom", address: "TC 9/120, Pattom, Thiruvananthapuram 695004",
  website: "", contact_name: "Rahul Nair", contact_role: "Owner", phone: "98470 55555", email: "rahul@mirror.example",
  categories: ["hair"], medical: "no", team_size: "4", services_text: "Haircut ₹350, colour from ₹1,800", heard_from: "", consent: "yes",
  ...patch,
});

describe("business-type pages", () => {
  it("has a page for each trade, each with its own title, and links them all", async () => {
    const main = await send("GET", "/for-practitioners"), map = await send("GET", "/sitemap.xml");
    for (const t of TRADES) {
      const r = await send("GET", `/for-practitioners/${t.slug}`);
      expect(r.status, t.slug).toBe(200);
      expect(r.text).toContain(`<title>${t.title.replace(/&/g, "&amp;")}</title>`);
      expect(r.text).toContain(`href="/for-practitioners/apply?cat=${t.cat}&amp;from=%2Ffor-practitioners%2F${t.slug}"`);
      expect(r.text).toContain('"@type":"BreadcrumbList"');
      expect(t.title.length, t.slug).toBeLessThanOrEqual(65);
      expect(t.description.length, t.slug).toBeLessThanOrEqual(165);
      expect(main.text).toContain(`href="/for-practitioners/${t.slug}"`);
      expect(map.text).toContain(`/for-practitioners/${t.slug}</loc>`);
    }
    const dental = (await send("GET", "/for-practitioners/dental-clinics")).text;
    expect(dental).toContain("never sold as an offer");
    expect(dental).not.toContain("Fill the quiet hours");
  });
});

describe("where applications come from", () => {
  it("keeps only clean ad details", () => {
    expect(readSource(new URLSearchParams("gclid=Cj0KCQiA_abc-123&utm_source=google&utm_campaign=Salons TVM&utm_term=<script>&evil=1&from=/x\"y"), "/for-practitioners"))
      .toEqual({ gclid: "Cj0KCQiA_abc-123", utm_source: "google", utm_campaign: "Salons TVM", from: "/for-practitioners" });
    expect(carrySource('<a href="/for-practitioners/apply?cat=hair#f">a</a><a href="/search">b</a>', { gclid: "Cj0KCQiA_abc-123" }))
      .toBe('<a href="/for-practitioners/apply?cat=hair&amp;gclid=Cj0KCQiA_abc-123#f">a</a><a href="/search">b</a>');
    expect(carrySource('<a href="/for-practitioners/apply">a</a>', {})).toBe('<a href="/for-practitioners/apply">a</a>');
  });

  it("carries an ad click from the landing page to the application, the team's pages and the Google Ads file", async () => {
    const landing = await send("GET", "/for-practitioners/salons?gclid=Cj0KCQiA_salon42&utm_source=google&utm_medium=cpc&utm_campaign=salons-tvm");
    expect(landing.text).toContain("href=\"/for-practitioners/apply?cat=hair&amp;gclid=Cj0KCQiA_salon42&amp;utm_source=google&amp;utm_medium=cpc&amp;utm_campaign=salons-tvm&amp;from=%2Ffor-practitioners%2Fsalons\"");
    expect(landing.text).toContain('<link rel="canonical" href="https://aestheva.test/for-practitioners/salons">');

    const form = await send("GET", "/for-practitioners/apply?cat=hair&gclid=Cj0KCQiA_salon42&utm_source=google&utm_medium=cpc&utm_campaign=salons-tvm&from=%2Ffor-practitioners%2Fsalons");
    const src = /name="src" value="([^"]*)"/.exec(form.text)?.[1].replace(/&amp;/g, "&");
    expect(src).toBe("gclid=Cj0KCQiA_salon42&utm_source=google&utm_medium=cpc&utm_campaign=salons-tvm&from=%2Ffor-practitioners%2Fsalons");
    // A wrong answer shows the form again without losing where they came from.
    expect((await send("POST", "/for-practitioners/apply", application({ src: src!, email: "nope" }))).text).toContain('name="src"');

    const done = await send("POST", "/for-practitioners/apply", application({ src: src! }));
    const ref = /AP-[2-9A-HJ-NP-Z]{6}/.exec(done.text)![0];
    const [a] = await sql("SELECT ad_source FROM applications WHERE ref = ?", ref);
    expect(JSON.parse(a.ad_source)).toEqual({ gclid: "Cj0KCQiA_salon42", utm_source: "google", utm_medium: "cpc", utm_campaign: "salons-tvm", from: "/for-practitioners/salons" });

    // An organic application stores nothing.
    await send("POST", "/for-practitioners/apply", application({ business_name: "Quiet Corner Parlour", phone: "98470 66666" }));
    expect((await sql("SELECT ad_source FROM applications WHERE business_name = 'Quiet Corner Parlour'"))[0].ad_source).toBe("");

    const cookie = (await send("POST", "/ops/login", { key: "test-ops-key" })).headers.get("set-cookie")!.split(";")[0];
    expect((await send("GET", "/ops/ads")).status).toBe(303);   // team only
    const detail = await send("GET", `/ops/applications/${ref}`, undefined, cookie);
    expect(detail.text).toContain("Google Ads · salons-tvm · landed on /for-practitioners/salons");
    const report = await send("GET", "/ops/ads", undefined, cookie);
    expect(report.text).toContain("Google Ads · salons-tvm");
    expect(report.text).toContain("/for-practitioners/salons (1)");

    // Going live adds a second conversion to the upload.
    await sql("INSERT INTO audit_log (actor, action, entity, entity_id, at) VALUES ('ops', 'provider.live', 'provider', 'prov_fake_live', '2026-11-20T04:30:00.000Z')");
    await sql("UPDATE applications SET provider_id = 'prov_fake_live', created_at = '2026-11-02T08:35:00.000Z' WHERE ref = ?", ref);
    const csv = (await send("GET", "/ops/ads/conversions.csv", undefined, cookie)).text.split("\n");
    expect(csv.slice(0, 3)).toEqual([
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
      "Cj0KCQiA_salon42,Aestheva business application,2026-11-02 14:05:00+05:30,,INR",
      "Cj0KCQiA_salon42,Aestheva business went live,2026-11-20 10:00:00+05:30,,INR",
    ]);

    // After 90 days the click ID goes; the campaign stays.
    await sql("UPDATE applications SET created_at = '2020-01-01T00:00:00.000Z' WHERE ref = ?", ref);
    expect(await pruneClickIds(env.DB)).toBe(1);
    expect(JSON.parse((await sql("SELECT ad_source FROM applications WHERE ref = ?", ref))[0].ad_source)).toEqual({ utm_source: "google", utm_medium: "cpc", utm_campaign: "salons-tvm", from: "/for-practitioners/salons" });
  });

  it("tells people about it in the privacy notice", async () => {
    const t = (await send("GET", "/policies/privacy")).text;
    expect(t).toContain("click reference and campaign name");
    expect(t).toContain("Google (Google Ads)");
  });
});
