import { describe, expect, it } from "vitest";
import { req } from "./helpers";

// Production starts with no venues: the site must still read as a real, finished business.
describe("before the first venue goes live", () => {
  it("tells visitors bookings open soon and invites providers to join", async () => {
    const home = await req("GET", "/");
    expect(home.status).toBe(200);
    expect(home.text).toContain("We're welcoming our first venues");
    expect(home.text).not.toContain("Featured in Trivandrum");
    const search = await req("GET", "/search?q=facial");
    expect(search.text).toContain("Opening soon");
    expect(search.text).not.toContain("No matches yet");
  });

  it("serves the policy pages and the sitemap", async () => {
    expect((await req("GET", "/policies/cancellation")).status).toBe(200);
    const sm = await req("GET", "/sitemap.xml");
    expect(sm.text).toContain("<loc>https://aestheva.test/</loc>");
  });

  it("sends www to the bare domain, keeping the path", async () => {
    const { app } = await import("../src/index");
    const { env } = await import("cloudflare:test");
    const res = await app.fetch(new Request("https://www.aestheva.test/search?cat=skin"), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://aestheva.test/search?cat=skin");
  });
});
