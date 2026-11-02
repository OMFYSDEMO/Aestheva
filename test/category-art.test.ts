import { beforeAll, describe, expect, it } from "vitest";
import { CAT_ART } from "../src/views/category-art";
import { req, seed } from "./helpers";

beforeAll(seed);

describe("category bands", () => {
  it("shows each category's drawing on its search page, its guides and its business page", async () => {
    expect((await req("GET", "/search?cat=nails")).text).toContain(CAT_ART.nails);
    expect((await req("GET", "/trivandrum/facial")).text).toContain(CAT_ART.skin);
    expect((await req("GET", "/for-practitioners/salons")).text).toContain(CAT_ART.hair);
    expect((await req("GET", "/trivandrum/bridal-makeup")).text).toContain(CAT_ART.groom);
    expect((await req("GET", "/trivandrum/ayurvedic-massage")).text).toContain(CAT_ART.ayur);
    expect((await req("GET", "/for-practitioners/dental-clinics")).text).toContain(CAT_ART.dental);
  });

  it("stays out of the way elsewhere", async () => {
    const home = (await req("GET", "/")).text, search = (await req("GET", "/search?cat=nails&q=gel")).text;
    for (const art of Object.values(CAT_ART)) { expect(home).not.toContain(art); expect(search).not.toContain(art); }
    expect((await req("GET", "/search?cat=tattoo")).text).not.toContain('class="cat-band"');   // not drawn yet
  });
});
