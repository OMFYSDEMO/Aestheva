import { beforeAll, describe, expect, it } from "vitest";
import { day, fakeRazorpay, guest, req, seed, sql } from "./helpers";

beforeAll(seed);

describe("public pages", () => {
  beforeAll(() => fakeRazorpay().install());

  it("renders the home page with categories and featured venues", async () => {
    const r = await req("GET", "/");
    expect(r.status).toBe(200);
    expect(r.text).toContain("Book beauty, wellness and care <em>near you</em> in Trivandrum.");
    expect(r.text).toContain('href="/p/lumiere-skin-and-laser-clinic"');
    expect(r.text).toContain("Haswel Care Private Limited");
    expect(r.text).toContain("Thiruvananthapuram (Trivandrum) · Now booking");
    expect(r.text).toContain("Free times near you");
    expect(r.text).toContain("Use my location");
    expect(r.text).toContain('<optgroup label="Technopark side">');
    expect(r.text).toContain('href="/search?area=Attingal"');
    expect(r.text).not.toContain("hero-art");
    expect(r.text).not.toContain(" 0 treatments");
  });

  it("searches by text, category, area and service type", async () => {
    const q = await req("GET", "/search?q=shirodhara");
    expect(q.text).toContain("Saanvi Ayur Wellness");
    expect(q.text).not.toContain("Ember &amp; Oud Grooming");
    const beauty = await req("GET", "/search?q=shirodhara&kind=medical");
    expect(beauty.text).toContain("<b style=\"color:var(--charcoal)\">0</b> venues");
    const cat = await req("GET", "/search?cat=dental");
    expect(cat.text).toContain("Veda Smile Studio");
    expect(cat.text).toContain("1</b> venue ");
  });

  it("only suggests popular searches that a live clinic offers", async () => {
    const r = await req("GET", "/");
    const chips = [...r.text.matchAll(/class="chip" href="\/search\?q=([^"]+)"/g)].map((m) => decodeURIComponent(m[1]));
    expect(chips.length).toBeGreaterThan(0);
    for (const q of chips) expect((await req("GET", `/search?q=${encodeURIComponent(q)}`)).text).not.toContain("No matches yet");
  });

  it("welcomes independent professionals as well as salons and clinics", async () => {
    const join = await req("GET", "/for-practitioners");
    for (const w of ["beauticians, nail artists, makeup and bridal artists, tattoo and piercing artists", "Working on your own is fine", "Listing is free"]) expect(join.text).toContain(w);
    const apply = await req("GET", "/for-practitioners/apply");
    expect(apply.text).toContain('<option value="Independent practitioner" >Independent professional: beautician, nail, makeup or tattoo artist, therapist…</option>');
    expect(apply.text).toContain("Tattoo &amp; piercing");
    expect((await sql("SELECT name FROM categories WHERE id = 'tattoo'"))[0].name).toBe("Tattoo & piercing");
    const home = await req("GET", "/");
    expect(home.text).toContain("List your business");
    expect(home.text).not.toMatch(/For practitioners|Clinics you can book/);
  });

  it("understands everyday words for treatments", async () => {
    const [dental] = await sql("SELECT name FROM services WHERE provider_id = 'p7' AND name LIKE '%Scaling%' LIMIT 1");
    if (dental) expect((await req("GET", "/search?q=teeth+cleaning")).text).toContain("Veda Smile Studio");
    expect((await req("GET", "/search?q=xyzzy")).text).toContain("No matches yet");
  });

  it("ranks clinics by distance from a chosen area, without hiding the others", async () => {
    const r = await req("GET", "/search?area=Kazhakkoottam");
    expect(r.text).toContain("Nearest to Kazhakkoottam first.");
    const order = ["Dr. Kavya Raghunath", "Lumière Skin &amp; Laser Clinic"].map((n) => r.text.indexOf(n));
    expect(order[0]).toBeGreaterThan(0); expect(order[0]).toBeLessThan(order[1]);   // Kazhakkoottam venue before Kowdiar
    expect(r.text).toContain("under 1 km");
    expect(r.text).toMatch(/Kowdiar · <b[^>]*>about [\d.]+ km<\/b>/);
    expect(r.text).toContain("8</b> venues");
    expect((await req("GET", "/search?area=Nowhere")).text).not.toContain("Nearest to");
  });

  it("searches near the visitor's rounded location, and says when they're outside the city", async () => {
    const r = await req("GET", "/search?near=8.5677,76.8728");
    expect(r.text).toContain("Nearest to you first.");
    expect(r.text).toContain('name="near" value="8.57,76.87"');   // rounded to about a kilometre
    expect(r.text).not.toContain("You seem to be outside");
    const far = await req("GET", "/search?near=9.93,76.26");
    expect(far.text).toContain("You seem to be outside Thiruvananthapuram.");
    expect((await req("GET", "/search?near=8.5677,76.8728&area=Pattom")).text).toContain("Nearest to Pattom first.");   // a chosen area wins
    expect((await req("GET", "/search?near=javascript:1")).text).not.toContain("Nearest to");
  });

  it("shows a venue's photo with responsive sizes and a social preview image", async () => {
    await sql("UPDATE providers SET photos_json = ? WHERE slug = ?", JSON.stringify([{ src: "/venues/lumiere/front", alt: "The front of the clinic" }]), "lumiere-skin-and-laser-clinic");
    const r = await req("GET", "/p/lumiere-skin-and-laser-clinic");
    expect(r.text).toContain('srcset="/venues/lumiere/front-400.webp 400w, /venues/lumiere/front-800.webp 800w, /venues/lumiere/front-1500.webp 1500w"');
    expect(r.text).toContain('alt="The front of the clinic"');
    expect(r.text).toMatch(/og:image" content="[^"]+\/venues\/lumiere\/front-og\.jpg"/);
    await sql("UPDATE providers SET photos_json = ? WHERE slug = ?", JSON.stringify([{ src: "javascript:alert(1)", alt: "x" }]), "lumiere-skin-and-laser-clinic");
    expect((await req("GET", "/p/lumiere-skin-and-laser-clinic")).text).not.toContain("javascript:");
    await sql("UPDATE providers SET photos_json = '[]' WHERE slug = ?", "lumiere-skin-and-laser-clinic");
  });

  it("reads correctly for a venue that takes no deposits", async () => {
    const before = await sql("SELECT id, deposit_paise FROM services WHERE provider_id = 'p2'");
    await sql("UPDATE services SET deposit_paise = 0 WHERE provider_id = 'p2'");
    try {
      const venue = await req("GET", "/p/saanvi-ayur-wellness");
      expect(venue.text).toContain("Nothing to pay online");
      expect(venue.text).toContain("Pay on the day, after your appointment");
      expect(venue.text).not.toContain("deposit at booking");
      const book = await req("GET", "/book/saanvi-ayur-wellness");
      expect(book.text).not.toContain("Payments are in test mode");
      expect(book.text).toContain("<i>5</i>Confirm</li>");
      expect(book.text).not.toContain("<i>5</i>Deposit</li>");
    } finally { for (const r of before) await sql("UPDATE services SET deposit_paise = ? WHERE id = ?", r.deposit_paise, r.id); }
  });

  it("shows a provider with services, team, verification and booking links", async () => {
    const r = await req("GET", "/p/lumiere-skin-and-laser-clinic");
    expect(r.status).toBe(200);
    for (const s of ["Dermatology consultation", "Dr. Meera Nair", "Clinical establishment registration checked", "/book/lumiere-skin-and-laser-clinic?service=v1", "Next free time", "Get directions",
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
    for (const p of ["/policies/cancellation", "/policies/terms", "/policies/privacy", "/contact", "/about"]) {
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
