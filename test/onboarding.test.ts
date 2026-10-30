import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { dowOf } from "../src/domain/time";
import { day, req, seed, sql } from "./helpers";

beforeAll(seed);

async function send(method: string, path: string, body?: Record<string, string | string[]> | FormData, opts: { cookie?: string; headers?: Record<string, string> } = {}) {
  const fd = body instanceof FormData;
  const enc = body && !fd ? new URLSearchParams(Object.entries(body).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => [k, x]))).toString() : undefined;
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, redirect: "manual", body: fd ? body : enc,
    headers: { ...(enc ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(opts.cookie ? { cookie: opts.cookie } : {}), "cf-connecting-ip": "192.0.2.77", ...opts.headers },
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  return { status: res.status, text: await res.text(), headers: res.headers };
}
const csrfIn = (html: string) => /name="csrf" value="([0-9a-f]{64})"/.exec(html)![1];
const webp = (n = 64) => new File([new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBPVP8 "), ...new Uint8Array(n)])], "w.webp", { type: "image/webp" });
const jpeg = (n = 64) => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Uint8Array(n)])], "og.jpg", { type: "image/jpeg" });

describe("self-serve onboarding, from application to a live listing", () => {
  type Sent = { to: string; subject: string; text: string };
  let sent: Sent[] = [];
  let ops = "", opsCsrf = "", clinic = "", csrf = "", pid = "", slug = "";
  const password = "rose petals and rain";

  beforeAll(async () => {
    (env as { EMAIL: unknown }).EMAIL = { send: async (m: Sent) => { sent.push(m); return { messageId: "m" }; } };
    const login = await send("POST", "/ops/login", { key: "test-ops-key" });
    ops = login.headers.get("set-cookie")!.split(";")[0];
  });

  it("approving an application creates a draft listing and emails an invitation", async () => {
    await send("POST", "/for-practitioners/apply", {
      t: String(Date.now() - 60_000), company_website: "", business_name: "Glow Lounge", business_type: "Salon & studio", area: "Pattom", address: "Near Pattom Junction, Thiruvananthapuram 695004",
      contact_name: "Nisha Raj", contact_role: "Owner", phone: "9895033333", email: "nisha@glow.example", categories: ["skin", "nails"], medical: "no", team_size: "2",
      services_text: "Facials from ₹1,200; manicure ₹600", consent: "yes",
    });
    const [a] = await sql("SELECT ref FROM applications WHERE business_name = 'Glow Lounge'");
    const page = await send("GET", `/ops/applications/${a.ref}`, undefined, { cookie: ops });
    opsCsrf = csrfIn(page.text);
    expect(page.text).toContain("Approve and invite to set up");
    sent = [];
    const r = await send("POST", `/ops/applications/${a.ref}/approve`, { csrf: opsCsrf }, { cookie: ops });
    expect(r.text).toContain("emailed an invitation to set it up");
    const [p] = await sql("SELECT id, slug, status, area, phone, type FROM providers WHERE name = 'Glow Lounge'");
    expect(p).toMatchObject({ id: "glow-lounge", slug: "glow-lounge-pattom", status: "draft", area: "Pattom", phone: "+919895033333", type: "Salon & studio" });
    pid = p.id; slug = p.slug;
    expect((await sql("SELECT status, provider_id FROM applications WHERE ref = ?", a.ref))[0]).toEqual({ status: "approved", provider_id: "glow-lounge" });
    expect(sent[0].to).toBe("nisha@glow.example");
    const t = /set-password\?t=([A-Za-z0-9_-]+)/.exec(sent[0].text)![1];
    await send("POST", "/clinic/set-password", { t, password, confirm: password });
    const signed = await send("POST", "/clinic/login", { email: "nisha@glow.example", password });
    clinic = signed.headers.get("set-cookie")!.split(";")[0];
    // Approving twice is refused.
    expect((await send("POST", `/ops/applications/${a.ref}/approve`, { csrf: opsCsrf }, { cookie: ops })).status).toBe(409);
  });

  it("lands a new clinic on its setup checklist", async () => {
    const home = await send("GET", "/clinic", undefined, { cookie: clinic });
    expect(home.headers.get("location")).toBe("/clinic/setup");
    const setup = await send("GET", "/clinic/setup", undefined, { cookie: clinic });
    for (const s of ["Welcome, Nisha", "Six short steps", "0 of 6 steps done", "Your business", "Photos", "You and your team", "Services &amp; prices", "Verification documents", "Terms"]) expect(setup.text).toContain(s);
    expect(setup.text).toMatch(/<button class="btn btn-p" type="submit" disabled>Submit for review<\/button>/);
    csrf = csrfIn(setup.text);
  });

  it("step 1: explains what to fix, then saves the clinic's details", async () => {
    const bad = await send("POST", "/clinic/setup/details", { csrf, name: "Glow Lounge", type: "Salon & studio", area: "Pattom", address: "short", phone: "123", tagline: "x", about: "Too short", hours_text: "" }, { cookie: clinic });
    expect(bad.status).toBe(400);
    for (const s of ["Please check", "full address", "10-digit mobile", "One line of 10 to 90", "60 to 700 characters (now 9)"]) expect(bad.text).toContain(s);
    expect(bad.text).toContain('value="Glow Lounge"');
    const ok = await send("POST", "/clinic/setup/details", { csrf, name: "Glow Lounge", type: "Salon & studio", area: "Pattom", address: "Near Pattom Junction, Thiruvananthapuram 695004", phone: "98950 33333",
      tagline: "Facials, nails and brows in Pattom", about: "A calm studio for facials, manicures and brows, run by certified beauticians who take time to understand your skin.", hours_text: "Tue–Sun · 10:00–19:00 · Monday closed", amenities: "Parking\nUPI and cards accepted" }, { cookie: clinic });
    expect(ok.status).toBe(303);
  });

  it("step 2: stores resized photos privately per venue and serves them", async () => {
    const fd = new FormData();
    fd.append("csrf", csrf); fd.append("alt", "Studio with two facial beds");
    fd.append("w400", webp()); fd.append("w800", webp()); fd.append("w1500", jpeg()); fd.append("og", jpeg());
    const r = await send("POST", "/clinic/setup/photos", fd, { cookie: clinic, headers: { "x-requested-with": "fetch" } });
    expect(r.status).toBe(200);
    const [p] = await sql("SELECT photos_json FROM providers WHERE id = ?", pid);
    const [ph] = JSON.parse(p.photos_json);
    expect(ph.src).toMatch(new RegExp(`^/media/${pid}/[a-z0-9]+$`));
    const img = await send("GET", `${ph.src}-400.webp`);
    expect(img.status).toBe(200); expect(img.headers.get("content-type")).toBe("image/webp");
    expect((await send("GET", `${ph.src}-1500.webp`)).headers.get("content-type")).toBe("image/jpeg");   // Safari's JPEG fallback keeps its true type
    const fake = new FormData(); fake.append("csrf", csrf); fake.append("alt", "Not really a picture");
    for (const k of ["w400", "w800", "w1500", "og"]) fake.append(k, new File(["<script>alert(1)</script>"], "x.webp"));
    const rej = await send("POST", "/clinic/setup/photos", fake, { cookie: clinic, headers: { "x-requested-with": "fetch" } });
    expect(rej.status).toBe(400);
    expect(JSON.parse(rej.text).error).toContain("couldn't be prepared");
  });

  it("step 3: adds a team member with online hours; doctors must give a registration", async () => {
    const days = { day2: "on", from2: "600", to2: "1140", day3: "on", from3: "600", to3: "1140", day6: "on", from6: "540", to6: "1200" };
    const noReg = await send("POST", "/clinic/setup/team/new", { csrf, name: "Dr. Test", role: "Dermatologist", medical: "yes", registration: "", ...days }, { cookie: clinic });
    expect(noReg.status).toBe(400); expect(noReg.text).toContain("council registration");
    const badHours = await send("POST", "/clinic/setup/team/new", { csrf, name: "Nisha Raj", role: "Senior beautician", medical: "no", day2: "on", from2: "1140", to2: "600" }, { cookie: clinic });
    expect(badHours.text).toContain("Tuesday: the finish time must be after the start time.");
    const ok = await send("POST", "/clinic/setup/team/new", { csrf, name: "Nisha Raj", role: "Senior beautician", medical: "no", quals: "CIDESCO Diploma", langs: ["Malayalam", "English"], langs_other: "Tamil", ...days }, { cookie: clinic });
    expect(ok.status).toBe(303);
    const [s] = await sql("SELECT id, medical, langs_json FROM staff WHERE provider_id = ?", pid);
    expect(s.medical).toBe(0); expect(JSON.parse(s.langs_json)).toEqual(["Malayalam", "English", "Tamil"]);
    expect((await sql("SELECT dow, start_min, end_min FROM staff_hours WHERE staff_id = ? ORDER BY dow", s.id))).toEqual([{ dow: 2, start_min: 600, end_min: 1140 }, { dow: 3, start_min: 600, end_min: 1140 }, { dow: 6, start_min: 540, end_min: 1200 }]);
  });

  it("step 4: adds treatments; medical ones need a registered practitioner", async () => {
    const [s] = await sql("SELECT id FROM staff WHERE provider_id = ?", pid);
    const med = await send("POST", "/clinic/setup/treatments/new", { csrf, name: "Chemical peel", cat: "skin", kind: "treatment", dur: "45", price: "2500", description: "A light peel for dull skin, applied and removed after a set time.", staff: s.id }, { cookie: clinic });
    expect(med.status).toBe(400); expect(med.text).toContain("can only be done by a doctor, dentist or other registered practitioner");
    const ok = await send("POST", "/clinic/setup/treatments/new", { csrf, name: "Hydrating facial", cat: "skin", kind: "beauty", dur: "60", price: "₹1,800", description: "A deep cleanse, gentle exfoliation and a hydrating mask, finished with a short massage.", staff: s.id }, { cookie: clinic });
    expect(ok.status).toBe(303);
    expect((await sql("SELECT price_paise, deposit_paise, kind FROM services WHERE provider_id = ?", pid))[0]).toEqual({ price_paise: 180000, deposit_paise: 0, kind: "beauty" });
  });

  it("step 5: keeps verification documents private", async () => {
    const bad = new FormData(); bad.append("csrf", csrf); bad.append("kind", "Professional certificate"); bad.append("file", new File(["MZ not a pdf"], "x.exe"));
    expect((await send("POST", "/clinic/setup/documents", bad, { cookie: clinic })).text).toContain("Please upload a PDF or a photo");
    const fd = new FormData(); fd.append("csrf", csrf); fd.append("kind", "Professional certificate"); fd.append("file", new File(["%PDF-1.4 certificate"], "cidesco.pdf", { type: "application/pdf" }));
    expect((await send("POST", "/clinic/setup/documents", fd, { cookie: clinic })).status).toBe(303);
    const [d] = await sql("SELECT id, r2_key FROM provider_documents WHERE provider_id = ?", pid);
    expect(d.r2_key).toBe(`docs/${pid}/${d.id}`);
    expect((await send("GET", `/media/${pid}/${d.id}`)).status).toBe(404);                 // never served publicly
    expect((await send("GET", `/ops/documents/${d.id}`)).status).toBe(303);                 // team sign-in required
    expect((await send("GET", `/ops/documents/${d.id}`, undefined, { cookie: clinic })).status).toBe(303);   // a clinic cookie is not a team session
  });

  it("step 6 and submit: the team is told the listing is ready", async () => {
    expect((await send("POST", "/clinic/setup/terms", { csrf }, { cookie: clinic })).status).toBe(400);
    await send("POST", "/clinic/setup/terms", { csrf, agree: "yes" }, { cookie: clinic });
    const setup = await send("GET", "/clinic/setup", undefined, { cookie: clinic });
    expect(setup.text).toContain("6 of 6 steps done");
    sent = [];
    expect((await send("POST", "/clinic/setup/submit", { csrf }, { cookie: clinic })).status).toBe(303);
    expect(sent.map((m) => [m.to, m.subject])).toEqual([["hello@bookaestheva.com", "Listing ready for review: Glow Lounge"]]);
    expect((await send("GET", "/clinic/setup", undefined, { cookie: clinic })).text).toContain("Submitted for review.");
    expect((await req("GET", `/p/${slug}`)).status).toBe(404);   // still not public
    const preview = await send("GET", "/clinic/setup/preview", undefined, { cookie: clinic });
    expect(preview.text).toContain("Preview of your page."); expect(preview.text).toContain("Hydrating facial");
  });

  it("the team reviews, sends it back with a note, then publishes it", async () => {
    const list = await send("GET", "/ops/venues", undefined, { cookie: ops });
    expect(list.text).toContain("Ready for review");
    const page = await send("GET", `/ops/venues/${pid}`, undefined, { cookie: ops });
    const oc = csrfIn(page.text);
    for (const s of ["Glow Lounge", "Professional certificate", "cidesco.pdf", "Nisha Raj", "Hydrating facial", "₹1,800"]) expect(page.text).toContain(s);
    const [d] = await sql("SELECT id FROM provider_documents WHERE provider_id = ?", pid);
    const doc = await send("GET", `/ops/documents/${d.id}`, undefined, { cookie: ops });
    expect(doc.status).toBe(200); expect(doc.text).toBe("%PDF-1.4 certificate");
    expect(doc.headers.get("content-security-policy")).toContain("sandbox");
    expect((await send("POST", `/ops/venues/${pid}/stage`, { csrf: oc, action: "send_back", note: "" }, { cookie: ops })).status).toBe(400);
    sent = [];
    await send("POST", `/ops/venues/${pid}/stage`, { csrf: oc, action: "send_back", note: "Please add a photo of your reception." }, { cookie: ops });
    expect(sent[0]).toMatchObject({ to: "nisha@glow.example", subject: "Changes needed: Glow Lounge" });
    expect(sent[0].text).toContain("Please add a photo of your reception.");
    expect((await send("GET", "/clinic/setup", undefined, { cookie: clinic })).text).toContain("A note from the Aestheva team:");
    await send("POST", `/ops/venues/${pid}/verifications`, { csrf: oc, label: "Beautician certificates checked", scope: "1 beautician · CIDESCO", checked_on: "Oct 2026" }, { cookie: ops });
    sent = [];
    await send("POST", `/ops/venues/${pid}/stage`, { csrf: oc, action: "publish" }, { cookie: ops });
    expect(sent[0]).toMatchObject({ to: "nisha@glow.example", subject: "You're live: Glow Lounge" });
    const pub = await req("GET", `/p/${slug}`);
    expect(pub.status).toBe(200);
    for (const s of ["Glow Lounge", "Beautician certificates checked", "Professional (non-medical)", "Call Glow Lounge", `/media/${pid}/`]) expect(pub.text).toContain(s);
    const todayPage = await send("GET", "/clinic", undefined, { cookie: clinic });   // now opens on Today
    expect(todayPage.status).toBe(200);
    expect(todayPage.text).toContain("Your booking link"); expect(todayPage.text).toContain(`/b/${slug}`);
    expect(todayPage.text).toMatch(/Founding partner #\d+/);   // published while places remain
    expect(sent[0].text).toMatch(/You're founding partner #\d+: no commission for your first 3 months/);
    expect(sent[0].text).toContain(`/b/${slug}`);
  });

  it("clients can book the new venue online", async () => {
    let n = 2; while (![2, 3, 6].includes(dowOf(day(n)))) n++;
    const [svc] = await sql("SELECT id FROM services WHERE provider_id = ?", pid);
    const slots = await req("GET", `/api/slots?service=${svc.id}&staff=any&from=${day(n)}&days=1`);
    expect(slots.json.days[0].slots.length).toBeGreaterThan(0);
    const b = await req("POST", "/api/bookings", { serviceId: svc.id, staffId: "any", date: day(n), start: slots.json.days[0].slots[0].min, name: "Client One", phone: "9847000123", email: "c1@example.com" });
    expect(b.json.payment).toBeNull();
    expect((await sql("SELECT status FROM bookings WHERE ref = ?", b.json.ref))[0].status).toBe("confirmed");
  });

  it("a venue that went live before the checklist shows what's left, and the team can file documents for it", async () => {
    const list = await send("GET", "/ops/venues", undefined, { cookie: ops });
    expect(list.text).toMatch(/Lumière Skin &amp; Laser Clinic[\s\S]*?To finish: Your business, Photos, Verification documents, Terms/);
    const page = await send("GET", "/ops/venues/p1", undefined, { cookie: ops });
    expect(page.text).toContain("This listing is already live");
    const oc = csrfIn(page.text);
    const bad = new FormData(); bad.append("csrf", oc); bad.append("kind", "Practitioner council registration"); bad.append("file", new File(["not a pdf"], "x.txt"));
    expect((await send("POST", "/ops/venues/p1/documents", bad, { cookie: ops })).text).toContain("Please upload a PDF or a photo");
    const fd = new FormData(); fd.append("csrf", oc); fd.append("kind", "Practitioner council registration"); fd.append("file", new File(["%PDF-1.4 tcmc"], "tcmc.pdf", { type: "application/pdf" }));
    const up = await send("POST", "/ops/venues/p1/documents", fd, { cookie: ops });
    expect(up.status).toBe(303);
    expect(await sql("SELECT kind, filename, uploaded_by FROM provider_documents WHERE provider_id = 'p1'")).toEqual([{ kind: "Practitioner council registration", filename: "tcmc.pdf", uploaded_by: "ops" }]);
    const after = await send("GET", "/ops/venues/p1?done=document", undefined, { cookie: ops });
    expect(after.text).toContain("Document uploaded."); expect(after.text).toContain("tcmc.pdf");
    const noCsrf = new FormData(); noCsrf.append("kind", "Other"); noCsrf.append("file", new File(["%PDF-1.4"], "y.pdf"));
    expect((await send("POST", "/ops/venues/p1/documents", noCsrf, { cookie: ops })).status).toBe(403);
  });

  it("accepts the longer notes that existing listings already have", async () => {
    const [p] = await sql("SELECT name, type, area, address, tagline, about, hours_text FROM providers WHERE id = ?", pid);
    const r = await send("POST", "/clinic/setup/details", { csrf, ...p, phone: "9895077777", amenities: "Fibe healthcare finance enquiries for eligible dental treatment" }, { cookie: clinic });
    expect(r.status).toBe(303);
  });

  it("never lets one clinic change another's listing", async () => {
    const [other] = await sql("SELECT id FROM staff WHERE provider_id = 'p1' LIMIT 1");
    expect((await send("POST", `/clinic/setup/team/${other.id}`, { csrf, name: "Hijack", role: "Therapist", medical: "no", day2: "on", from2: "600", to2: "720" }, { cookie: clinic })).status).toBe(404);
    expect((await send("POST", "/clinic/setup/treatments/v1/remove", { csrf }, { cookie: clinic })).status).toBe(404);
    expect((await sql("SELECT name FROM staff WHERE id = ?", other.id))[0].name).not.toBe("Hijack");
  });
});
