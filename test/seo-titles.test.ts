import { beforeAll, describe, expect, it } from "vitest";
import { venueTitle } from "../src/routes/site";
import { req, seed } from "./helpers";

beforeAll(seed);

describe("search titles", () => {
  it("fits venue titles in what Google shows, dropping the brand before the search words", () => {
    expect(venueTitle("Hasta Wellness", "Kazhakkoottam")).toBe("Hasta Wellness, Kazhakkoottam · Prices & booking · Aestheva");
    expect(venueTitle("Kaya Mudra Physio & Pilates", "Kazhakkoottam")).toBe("Kaya Mudra Physio & Pilates, Kazhakkoottam · Prices & booking");
    for (const n of ["A", "Lumière Skin & Laser Clinic", "The Very Long Name Of A Beauty And Wellness Studio"]) expect(venueTitle(n, "Vellayambalam").length <= 65 || venueTitle(n, "Vellayambalam") === `${n}, Vellayambalam`).toBe(true);
  });

  it("names what a business owner searches for on the sign-up page", async () => {
    const t = (await req("GET", "/for-practitioners")).text;
    expect(t).toContain("<title>List your salon, spa or clinic free in Trivandrum · Aestheva</title>");
    expect(t).toMatch(/<meta name="description" content="Free listing and online booking for salons, beauty parlours/);
  });
});
