import { beforeAll, describe, expect, it } from "vitest";
import { req, seed, sql } from "./helpers";

beforeAll(seed);

describe("venue pages in search", () => {
  it("lists only services that are the thing a price guide is about", async () => {
    // A salon whose tagline mentions bridal makeup, but which only lists a haircut and a facial.
    const [v] = await sql("SELECT id, slug FROM providers WHERE status = 'live' AND id IN (SELECT provider_id FROM services WHERE cat = 'hair') ORDER BY id LIMIT 1");
    await sql("UPDATE providers SET tagline = 'Beauty and aesthetic saloon, bridal makeup studio.' WHERE id = ?", v.id);
    const names = (await sql("SELECT name FROM services WHERE provider_id = ? AND active = 1", v.id)).map((r: { name: string }) => r.name);
    const guide = (await req("GET", "/trivandrum/bridal-makeup")).text;
    for (const n of names.filter((n: string) => !/bridal|makeup/i.test(n))) expect(guide, n).not.toContain(`>${n}<`);
  });

  it("writes a clean search snippet from a tagline typed in capitals", async () => {
    const [v] = await sql("SELECT id, slug FROM providers WHERE status = 'live' ORDER BY id DESC LIMIT 1");
    await sql("UPDATE providers SET tagline = 'DENTAL NEAR ME.' WHERE id = ?", v.id);
    const t = (await req("GET", `/p/${v.slug}`)).text;
    expect(t).toMatch(/<meta name="description" content="Dental near me\. [A-Z]/);
    expect(t).not.toContain("..");
    expect(t).toContain('<p class="lede">Dental near me.</p>');
  });
});
