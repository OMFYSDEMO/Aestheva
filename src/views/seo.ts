// schema.org structured data, so search engines can show a business's address, prices and rating.
import { COMPANY } from "../config";
import { isMedical, type ProviderDetail, type ProviderRow } from "../services/catalog";
import { photosOf } from "./ui";

const rupees = (paise: number) => Math.round(paise / 100);
const pin = (address: string) => /\b(6\d{5})\b/.exec(address)?.[1];

export function organisation(base: string) {
  return {
    "@context": "https://schema.org", "@type": "Organization", "@id": `${base}/#org`,
    name: COMPANY.brand, legalName: COMPANY.legalName, url: `${base}/`, logo: `${base}/brand/icon-512.png`, email: COMPANY.supportEmail,
    address: { "@type": "PostalAddress", streetAddress: COMPANY.registeredAddress, addressLocality: "Kazhakkoottam", addressRegion: "Kerala", postalCode: pin(COMPANY.registeredAddress), addressCountry: "IN" },
    areaServed: { "@type": "City", name: COMPANY.launchCity },
  };
}

export function website(base: string) {
  return {
    "@context": "https://schema.org", "@type": "WebSite", "@id": `${base}/#site`, name: COMPANY.brand, url: `${base}/`, inLanguage: "en-IN",
    publisher: { "@id": `${base}/#org` },
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${base}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
}

export function breadcrumbs(base: string, trail: [string, string][]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: trail.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${base}${path}` })) };
}

/** The closest schema.org business type for what a listing offers. */
function businessType(services: { cat: string; kind: string }[]) {
  const cats = new Set(services.map((s) => s.cat));
  if (services.some(isMedical)) return cats.size === 1 && cats.has("dental") ? ["Dentist"] : ["MedicalClinic", "HealthAndBeautyBusiness"];
  if (cats.size === 1) return [({ hair: "HairSalon", nails: "NailSalon", tattoo: "TattooParlor", ayur: "DaySpa", body: "DaySpa", skin: "BeautySalon", groom: "BeautySalon" } as Record<string, string>)[[...cats][0]] ?? "HealthAndBeautyBusiness"];
  return ["HealthAndBeautyBusiness"];
}

export function business(base: string, d: ProviderDetail) {
  const p = d.provider, prices = d.services.map((s) => s.price_paise);
  return {
    "@context": "https://schema.org", "@type": businessType(d.services), "@id": `${base}/p/${p.slug}#business`,
    name: p.name, description: p.about || p.tagline, url: `${base}/p/${p.slug}`,
    image: photosOf(p).map((ph) => `${base}${ph.src}-1500.webp`),
    ...(p.phone ? { telephone: p.phone } : {}),
    address: { "@type": "PostalAddress", streetAddress: p.address, addressLocality: p.area, addressRegion: "Kerala", postalCode: pin(p.address), addressCountry: "IN" },
    ...(prices.length ? { priceRange: `₹${rupees(Math.min(...prices)).toLocaleString("en-IN")}–₹${rupees(Math.max(...prices)).toLocaleString("en-IN")}`, currenciesAccepted: "INR" } : {}),
    ...(d.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: d.rating.avg.toFixed(1), reviewCount: d.rating.n, bestRating: 5, worstRating: 1 } } : {}),
    makesOffer: d.services.slice(0, 40).map((s) => ({
      "@type": "Offer", price: rupees(s.price_paise), priceCurrency: "INR", url: `${base}/book/${p.slug}?service=${encodeURIComponent(s.id)}`,
      itemOffered: { "@type": "Service", name: s.name, ...(s.description ? { description: s.description } : {}) },
    })),
  };
}

export function itemList(base: string, providers: ProviderRow[]) {
  return { "@context": "https://schema.org", "@type": "ItemList", itemListElement: providers.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${base}/p/${p.slug}`, name: p.name })) };
}
