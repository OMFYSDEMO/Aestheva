import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { KOCHI_SKYLINE } from "../src/views/skyline-kochi";
import { KOZHIKODE_SKYLINE, THRISSUR_SKYLINE } from "../src/views/skyline-cities";
import { SKYLINE } from "../src/views/skyline";
import { req, seed, sql } from "./helpers";

beforeAll(seed);

const join = async (body: string) => {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request("https://aestheva.test/waitlist", { method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" }, body }), env, ctx);
  await waitOnExecutionContext(ctx);
  return res.headers.get("location");
};

describe("the city pages", () => {
  it("tells Kochi's story, with the Fort Kochi sketch in the footer", async () => {
    const r = await req("GET", "/kochi");
    expect(r.status).toBe(200);
    for (const t of ["Namaskaram, Kochi.", "cheena vala", "Fort Kochi", "Kakkanad", "Join the Kochi list", "Run a salon, studio or clinic in Kochi?", "places left"]) expect(r.text, t).toContain(t);
    expect(r.text).toContain(KOCHI_SKYLINE);
    expect(r.text).not.toContain(SKYLINE);
    expect((await req("GET", "/")).text).toContain(SKYLINE);   // Trivandrum keeps its own
  });

  it("tells Thrissur's story, with the Pooram sketch in the footer", async () => {
    const r = await req("GET", "/thrissur");
    expect(r.status).toBe(200);
    for (const t of ["Namaskaram, Thrissur.", "kudamattam", "Vadakkunnathan", "Swaraj Round", "Guruvayur", "Join the Thrissur list", "Run a salon, studio or clinic in Thrissur?"]) expect(r.text, t).toContain(t);
    expect(r.text).toContain(THRISSUR_SKYLINE);
    expect(r.text).not.toContain(SKYLINE);
    expect(r.text).not.toContain(KOCHI_SKYLINE);
  });

  it("tells Kozhikode's story, with the beach and biriyani sketch, and sends Calicut there", async () => {
    const r = await req("GET", "/kozhikode");
    expect(r.status).toBe(200);
    for (const t of ["Namaskaram, Kozhikode.", "Calicut", "City of Literature", "SM Street", "Beypore", "Mananchira", "Join the Kozhikode list"]) expect(r.text, t).toContain(t);
    expect(r.text).toContain(KOZHIKODE_SKYLINE);
    expect(r.text).not.toContain(SKYLINE);
    const old = await app.fetch(new Request("https://aestheva.test/calicut", { redirect: "manual" }), env, createExecutionContext());
    expect(old.status).toBe(301);
    expect(old.headers.get("location")).toBe("/kozhikode");
  });

  it("links every city from the footer and lists them in the sitemap", async () => {
    const home = (await req("GET", "/")).text, map = (await req("GET", "/sitemap.xml")).text;
    for (const s of ["kochi", "kozhikode", "thrissur"]) {
      expect(home).toContain(`href="/${s}"`);
      expect(map).toContain(`/${s}</loc>`);
    }
  });

  it("adds people to each city's list and brings them back to that page", async () => {
    expect(await join("city=Kochi&from=kochi&email=Meera%40example.com")).toBe("/kochi?joined=1#join");
    expect(await join("city=Thrissur&from=thrissur&email=anu%40example.com")).toBe("/thrissur?joined=1#join");
    expect(await join("city=Kozhikode&from=kozhikode&email=faiz%40example.com")).toBe("/kozhikode?joined=1#join");
    expect(await join("city=Thrissur&from=thrissur&email=not-an-email")).toBe("/thrissur#join");
    expect(await join("city=Kozhikode&from=kochi&email=x%40example.com")).toBe("/?joined=Kozhikode#waitlist");   // a mismatched page goes home
    expect(await sql("SELECT city, email FROM waitlist WHERE email IN ('meera@example.com','anu@example.com','faiz@example.com') ORDER BY email"))
      .toEqual([{ city: "Thrissur", email: "anu@example.com" }, { city: "Kozhikode", email: "faiz@example.com" }, { city: "Kochi", email: "meera@example.com" }]);
    expect((await req("GET", "/kochi?joined=1")).text).toContain("You're on the Kochi list.");
    expect((await req("GET", "/thrissur?joined=1")).text).toContain("You're on the Thrissur list.");
  });
});
