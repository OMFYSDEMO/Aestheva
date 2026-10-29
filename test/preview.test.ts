import { beforeAll, describe, expect, it } from "vitest";
import { day, fakeRazorpay, guest, req, seed, sql } from "./helpers";

beforeAll(seed);

// Draft venues stay hidden from everyone without the preview key, and are fully bookable with it.
describe("previewing a draft venue", () => {
  beforeAll(async () => { fakeRazorpay().install(); await sql("UPDATE providers SET status = 'draft' WHERE id = 'p8'"); });
  const KEY = "test-preview-key";

  it("hides the venue without the key", async () => {
    expect((await req("GET", "/p/ember-and-oud-grooming")).status).toBe(404);
    const wrong = await req("GET", "/p/ember-and-oud-grooming?preview=wrong");
    expect(wrong.status).toBe(404);
    expect(wrong.text).toContain("This preview link isn&#39;t valid");
    expect((await req("GET", `/p/ember-and-oud-grooming?preview=%20test-preview-key%20`)).status).toBe(200);
    expect((await req("GET", "/search")).text).not.toContain("Ember &amp; Oud Grooming");
    expect((await req("GET", "/sitemap.xml")).text).not.toContain("ember-and-oud-grooming");
    expect((await req("GET", `/api/slots?service=v31&from=${day(2)}&days=1`)).status).toBe(404);
    expect((await req("POST", "/api/bookings", { serviceId: "v31", staffId: "s16", date: day(2), start: 660, ...guest })).status).toBe(404);
  });

  it("shows it, marked as a preview, and books it with the key", async () => {
    const page = await req("GET", `/p/ember-and-oud-grooming?preview=${KEY}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain("This venue isn't public yet");
    expect(page.text).toContain(`/book/ember-and-oud-grooming?service=v31&amp;preview=${KEY}`);
    expect(page.text).toContain('<meta name="robots" content="noindex">');
    const book = await req("GET", `/book/ember-and-oud-grooming?service=v31&preview=${KEY}`);
    expect(book.text).toContain(`"preview":"${KEY}"`);
    expect((await req("GET", `/api/slots?service=v31&from=${day(2)}&days=1&preview=${KEY}`)).status).toBe(200);
    const r = await req("POST", "/api/bookings", { serviceId: "v31", staffId: "s16", date: day(2), start: 660, ...guest, preview: KEY });
    expect(r.status).toBe(201);
  });
});

describe("payment mode", () => {
  it("reports Razorpay test mode and the webhook on the health check", async () => {
    const r = await req("GET", "/api/health");
    expect(r.json.payments).toEqual({ mode: "test", webhook: true, secrets: {
      RAZORPAY_KEY_ID: "set (test key)", RAZORPAY_KEY_SECRET: "set", RAZORPAY_WEBHOOK_SECRET: "set", PREVIEW_KEY: "set", OPS_KEY: "set" } });
    expect(r.text).not.toContain("test_key_secret");
    expect(r.text).not.toContain("test-ops-key");
  });

  it("tells clients when payments are in test mode", async () => {
    await sql("UPDATE providers SET status = 'live' WHERE id = 'p2'");
    const r = await req("GET", "/book/saanvi-ayur-wellness?service=v7");
    expect(r.text).toContain("Payments are in test mode");
  });
});
