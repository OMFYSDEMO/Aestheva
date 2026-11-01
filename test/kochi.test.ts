import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { KOCHI_SKYLINE } from "../src/views/skyline-kochi";
import { SKYLINE } from "../src/views/skyline";
import { req, seed, sql } from "./helpers";

beforeAll(seed);

describe("the Kochi page", () => {
  it("tells Kochi's story, with the Fort Kochi sketch in the footer", async () => {
    const r = await req("GET", "/kochi");
    expect(r.status).toBe(200);
    for (const t of ["Namaskaram, Kochi.", "cheena vala", "Fort Kochi", "Kakkanad", "Join the Kochi list", "Run a salon, studio or clinic in Kochi?", "places left"]) expect(r.text, t).toContain(t);
    expect(r.text).toContain(KOCHI_SKYLINE);
    expect(r.text).not.toContain(SKYLINE);
    expect((await req("GET", "/")).text).toContain(SKYLINE);   // Trivandrum keeps its own
    expect((await req("GET", "/sitemap.xml")).text).toContain("/kochi");
  });

  it("adds people to the Kochi list and brings them back to the page", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("https://aestheva.test/waitlist", { method: "POST", redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" }, body: "city=Kochi&from=kochi&email=Meera%40example.com" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.headers.get("location")).toBe("/kochi?joined=1#join");
    expect(await sql("SELECT city, email FROM waitlist WHERE email = 'meera@example.com'")).toEqual([{ city: "Kochi", email: "meera@example.com" }]);
    expect((await req("GET", "/kochi?joined=1")).text).toContain("You're on the Kochi list.");
  });
});
