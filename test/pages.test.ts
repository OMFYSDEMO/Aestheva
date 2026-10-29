import { beforeAll, describe, expect, it } from "vitest";
import { day, fakeRazorpay, guest, req, seed, sql } from "./helpers";

beforeAll(seed);

describe("public pages", () => {
  beforeAll(() => fakeRazorpay().install());

  it("renders the home page with categories and featured venues", async () => {
    const r = await req("GET", "/");
    expect(r.status).toBe(200);
    expect(r.text).toContain("Considered care for");
    expect(r.text).toContain('href="/p/lumiere-skin-and-laser-clinic"');
    expect(r.text).toContain("Haswel Care Private Limited");
    expect(r.text).toContain("Now open in Thiruvananthapuram");
    expect(r.text).toContain("Popular:");
  });

  it("searches by text, category, area and service type", async () => {
    const q = await req("GET", "/search?q=shirodhara");
    expect(q.text).toContain("Saanvi Ayur Wellness");
    expect(q.text).not.toContain("Ember &amp; Oud Grooming");
    const med = await req("GET", "/search?kind=medical&area=Pattom");
    expect(med.text).toContain("<b style=\"color:var(--charcoal)\">0</b> venues");
    const cat = await req("GET", "/search?cat=dental");
    expect(cat.text).toContain("Veda Smile Studio");
    expect(cat.text).toContain("1</b> venue ");
  });

  it("shows a provider with services, team, verification and booking links", async () => {
    const r = await req("GET", "/p/lumiere-skin-and-laser-clinic");
    expect(r.status).toBe(200);
    for (const s of ["Dermatology consultation", "Dr. Meera Nair", "Clinical establishment registration checked", "/book/lumiere-skin-and-laser-clinic?service=v1", "Next available",
      "Registered practitioner", "MD Dermatology, Venereology &amp; Leprosy", "TCMC Reg. No. 48XXX (sample)"]) expect(r.text).toContain(s);
  });

  it("says verification is in progress when nothing has been checked yet", async () => {
    await sql("DELETE FROM verifications WHERE provider_id = 'p8'");
    const r = await req("GET", "/p/ember-and-oud-grooming");
    expect(r.text).toContain("Verification in progress");
  });

  it("serves the booking page with its data and the Razorpay script", async () => {
    const r = await req("GET", "/book/saanvi-ayur-wellness?service=v7");
    expect(r.text).toContain('"preselect":"v7"');
    expect(r.text).toContain("https://checkout.razorpay.com/v1/checkout.js");
    expect(r.text).toContain('<meta name="robots" content="noindex">');
  });

  it("shows a booking only to the holder of its link, and cancels it from the page", async () => {
    const b = (await req("POST", "/api/bookings", { serviceId: "v31", staffId: "s16", date: day(3), start: 660, ...guest })).json;
    const path = new URL(b.manageUrl).pathname + new URL(b.manageUrl).search;
    const page = await req("GET", path);
    expect(page.status).toBe(200);
    expect(page.text).toContain("Booking confirmed");
    expect(page.text).toContain("Beard sculpt");
    expect((await req("GET", `/booking/${b.ref}?t=nope`)).status).toBe(404);
    const t = new URL(b.manageUrl).searchParams.get("t")!;
    const done = await req("POST", `/booking/${b.ref}/cancel`, `t=${encodeURIComponent(t)}&reason=`, { "content-type": "application/x-www-form-urlencoded" });
    expect(done.status).toBe(200);
    expect(done.text).toContain("Your booking is cancelled.");
  });

  it("publishes the policy and contact pages Razorpay's website review looks for", async () => {
    for (const p of ["/policies/cancellation", "/policies/terms", "/policies/privacy", "/contact"]) {
      const r = await req("GET", p);
      expect(r.status, p).toBe(200);
      expect(r.text, p).toContain("Haswel Care Private Limited");
    }
    const contact = await req("GET", "/contact");
    expect(contact.text).toContain("hello@bookaestheva.com");
    expect(contact.text).not.toContain("to be added");
    expect(contact.text).toContain("+91 97784 58883");
    expect(contact.text).toContain("Technopark Phase 3 Service Road");
  });

  it("adds an email to a city waitlist once", async () => {
    const form = { "content-type": "application/x-www-form-urlencoded" };
    expect((await req("POST", "/waitlist", "city=Kochi&email=a%40example.com", form)).status).toBe(303);
    expect((await req("POST", "/waitlist", "city=Kochi&email=A%40example.com", form)).status).toBe(303);
    expect(await sql("SELECT city, email FROM waitlist")).toEqual([{ city: "Kochi", email: "a@example.com" }]);
  });

  it("returns friendly 404s", async () => {
    expect((await req("GET", "/p/no-such-venue")).status).toBe(404);
    expect((await req("GET", "/nowhere")).text).toContain("We couldn&#39;t find that page.");
    expect((await req("GET", "/api/nowhere")).json).toEqual({ error: "Not found" });
  });
});
