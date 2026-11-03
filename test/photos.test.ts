import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { imageSize, measurePhotos } from "../src/services/onboarding";
import { photosOf } from "../src/views/ui";
import { venueGallery } from "../src/views/pages";
import { seed, sql } from "./helpers";

beforeAll(seed);

async function send(method: string, path: string, form?: Record<string, string>, cookie?: string, headers: Record<string, string> = {}) {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, redirect: "manual", body: form ? new URLSearchParams(form).toString() : undefined,
    headers: { ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(cookie ? { cookie } : {}), ...headers },
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  return { status: res.status, text: await res.text(), headers: res.headers };
}
const ascii = (t: string) => [...t].map((c) => c.charCodeAt(0));
/** A lossy WebP header for a w × h picture: enough for the size reader. */
const vp8 = (w: number, h: number) => new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBPVP8 "), 0, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, w & 255, w >> 8, h & 255, h >> 8, 0, 0]);
const vp8x = (w: number, h: number) => new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBPVP8X"), 10, 0, 0, 0, 0, 0, 0, 0, (w - 1) & 255, ((w - 1) >> 8) & 255, 0, (h - 1) & 255, ((h - 1) >> 8) & 255, 0]);
const jpg = (w: number, h: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0]);

describe("venue photos", () => {
  it("reads a photo's size from the start of the file", () => {
    expect(imageSize(vp8(1200, 1600))).toEqual({ w: 1200, h: 1600 });
    expect(imageSize(vp8x(1500, 844))).toEqual({ w: 1500, h: 844 });
    expect(imageSize(jpg(1500, 2000))).toEqual({ w: 1500, h: 2000 });
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("keeps a photo's shape and framing, and shows descriptions typed in capitals in sentence case", () => {
    const [a, b] = photosOf({ photos_json: JSON.stringify([
      { src: "/media/sjs/one", alt: "RECEPTION WITH WAITING AREA", w: 1500, h: 2000, pos: "40% 25%" },
      { src: "/media/sjs/two", alt: "Spa room, ground floor", pos: "150% 2%" },
    ]) });
    expect(a).toEqual({ src: "/media/sjs/one", alt: "Reception with waiting area", w: 1500, h: 2000, pos: "40% 25%" });
    expect(b).toEqual({ src: "/media/sjs/two", alt: "Spa room, ground floor" });   // a framing point off the photo is ignored
  });

  it("lays out photos by count and shape, with every photo uncropped in the gallery", () => {
    const ph = (i: number, portrait = false, pos?: string) => ({ src: `/media/v/p${i}`, alt: `Photo ${i}`, w: portrait ? 1125 : 1500, h: portrait ? 1500 : 1000, ...(pos ? { pos } : {}) });
    const two = venueGallery([ph(1), ph(2)], "SJS Dental Clinic");
    expect(two).toContain('class="v-photos mt12 two"');
    expect(two.match(/<figure id="gal-/g)).toHaveLength(2);
    const five = venueGallery([ph(1, true), ph(2), ph(3), ph(4), ph(5, false, "20% 70%")], "Chippy’s");
    expect(five).toContain('class="v-photos mt12 many tall"');
    expect(five.match(/class="extra"/g)).toHaveLength(2);
    expect(five).toContain("+2");
    expect(five).toContain("See all 5 photos");
    expect(five).toContain("object-position:50% 30%");   // a portrait is framed on its upper third
    expect(five).toContain("object-position:20% 70%");   // a chosen point wins
    expect(venueGallery([ph(1)], "One")).toContain('class="v-photos mt12 one"');
    // Mostly portraits, like Chippy's: three equal columns.
    expect(venueGallery([ph(1, true), ph(2, true), ph(3, true), ph(4), ph(5, true)], "Chippy’s")).toContain('class="v-photos mt12 many trio"');
  });

  it("lets the team choose the part of a photo to keep in view", async () => {
    const [v] = await sql("SELECT id, slug FROM providers WHERE status = 'live' ORDER BY id LIMIT 1");
    await sql("UPDATE providers SET photos_json = ? WHERE id = ?", JSON.stringify([{ src: `/media/${v.id}/abc123`, alt: "Treatment room", w: 1125, h: 1500 }]), v.id);
    const cookie = (await send("POST", "/ops/login", { key: "test-ops-key" })).headers.get("set-cookie")!.split(";")[0];
    const page = await send("GET", `/ops/venues/${v.id}`, undefined, cookie);
    expect(page.text).toContain("Tap the part that matters most");
    expect(page.text).toContain("1125×1500, portrait");
    const csrf = /name="csrf" value="([0-9a-f]{64})"/.exec(page.text)![1];
    const r = await send("POST", `/ops/venues/${v.id}/photos/focus`, { csrf, src: `/media/${v.id}/abc123`, pos: "35% 22%" }, cookie, { "x-requested-with": "fetch" });
    expect(r.status).toBe(200);
    expect(JSON.parse((await sql("SELECT photos_json FROM providers WHERE id = ?", v.id))[0].photos_json)[0].pos).toBe("35% 22%");
    expect((await send("GET", `/p/${v.slug}`)).text).toContain("object-position:35% 22%");
    const bad = await send("POST", `/ops/venues/${v.id}/photos/focus`, { csrf, src: `/media/${v.id}/abc123`, pos: "left" }, cookie, { "x-requested-with": "fetch" });
    expect(bad.status).toBe(400);
    // Edit the description.
    const alt = await send("POST", `/ops/venues/${v.id}/photos/alt`, { csrf, src: `/media/${v.id}/abc123`, alt: "Treatment room with two beds by the window" }, cookie);
    expect(alt.status).toBe(303);
    const stored = JSON.parse((await sql("SELECT photos_json FROM providers WHERE id = ?", v.id))[0].photos_json)[0];
    expect(stored).toMatchObject({ alt: "Treatment room with two beds by the window", pos: "35% 22%", w: 1125 });
    expect((await send("GET", `/p/${v.slug}`)).text).toContain('alt="Treatment room with two beds by the window"');
    const tooShort = await send("POST", `/ops/venues/${v.id}/photos/alt`, { csrf, src: `/media/${v.id}/abc123`, alt: "Room" }, cookie);
    expect(tooShort.status).toBe(400);
    expect(tooShort.text).toContain("describe the photo in a short sentence");
  });

  it("measures photos uploaded before shapes were saved", async () => {
    await env.MEDIA!.put("media/measure-me/old1-400.webp", vp8(400, 533));
    await sql("UPDATE providers SET photos_json = ? WHERE id = (SELECT id FROM providers ORDER BY id DESC LIMIT 1)",
      JSON.stringify([{ src: "/media/measure-me/old1", alt: "A portrait photo" }]));
    expect(await measurePhotos(env)).toBe(1);
    const [p] = await sql("SELECT photos_json FROM providers WHERE photos_json LIKE '%measure-me%'");
    expect(JSON.parse(p.photos_json)[0]).toMatchObject({ w: 400, h: 533 });
    expect(await measurePhotos(env)).toBe(0);
  });
});
