import { LOCALITIES, SERVICE_AREA } from "../config";

export interface Point { lat: number; lng: number }

/** Straight-line distance in km (haversine). */
export function km(a: Point, b: Point) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export const locality = (name: string): Point | undefined => LOCALITIES.find((l) => l.name === name);

/** "8.55,76.92" from the browser's location, rounded to about a kilometre so we never hold a precise position. */
export function parseNear(v: string | undefined): Point | undefined {
  const m = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(String(v ?? "").trim());
  if (!m) return undefined;
  const lat = Math.round(Number(m[1]) * 100) / 100, lng = Math.round(Number(m[2]) * 100) / 100;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : undefined;
}

export const inServiceArea = (p: Point) => km(p, SERVICE_AREA) <= SERVICE_AREA.radiusKm;

export const kmLabel = (d: number) => (d < 1 ? "under 1 km" : `about ${d < 10 ? Math.round(d * 2) / 2 : Math.round(d)} km`);
