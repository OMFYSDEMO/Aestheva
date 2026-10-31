// Business facts shown on the site. Blank values render as "to be added" and must be filled before launch:
// Razorpay's website review expects contact details and policy pages that name the legal entity.
export const COMPANY = {
  brand: "Aestheva",
  legalName: "Haswel Care Private Limited",
  supportEmail: "hello@bookaestheva.com",
  // Temporary: Hasta Wellness's number, shared until Aestheva has its own line (planned once ~10 practitioners are onboarded).
  supportPhone: "+91 97784 58883",
  registeredAddress: "1st floor, Anjali Arcade, near Nippon Toyota, Technopark Phase 3 Service Road, Kazhakkoottam, Thiruvananthapuram, Kerala 695583",
  launchCity: "Thiruvananthapuram",
  // Data protection: the person named as Grievance Officer in the privacy notice (required by the IT (SPDI) Rules, 2011).
  grievanceOfficer: "",
  privacyUpdated: "31 October 2026",
} as const;

export const POLICY = {
  freeCancelHours: 24,     // full deposit refund when cancelled at least this long before the start
  holdMinutes: 15,         // an unpaid slot is held this long while the client pays
  leadMinutes: 60,         // earliest bookable start is this far from now
  windowDays: 60,          // how far ahead clients can book
  commissionBp: 1000,      // 10% of the price the client pays, on completed marketplace bookings
} as const;

/** Phase 1 incentives. Change the numbers here; the site's wording follows them. */
export const INCENTIVES = {
  foundingPlaces: 50,       // the first 50 businesses to go live are founding partners
  foundingFreeMonths: 3,    // 0% commission for their first 3 months live
  foundingRateBp: 750,      // then 7.5% ...
  foundingMonths: 12,       // ... until their first anniversary, then the standard rate
  ownLinkDays: 30,          // a visit through a business's own link counts for 30 days
  welcomeCreditPaise: 10000, // ₹100 off the deposit of a client's first booking, paid by Aestheva
} as const;

/** Where Aestheva works for now: Thiruvananthapuram and the towns around it. */
export const SERVICE_AREA = { name: "Thiruvananthapuram", short: "Trivandrum", lat: 8.4875, lng: 76.952, radiusKm: 40 } as const;

/** Localities people search from and clinics are listed in, with approximate centre points (straight-line distances are rounded). */
export const LOCALITIES = [
  { name: "Thampanoor", zone: "City centre", lat: 8.4875, lng: 76.952 },
  { name: "East Fort", zone: "City centre", lat: 8.4826, lng: 76.9438 },
  { name: "Palayam", zone: "City centre", lat: 8.504, lng: 76.9505 },
  { name: "Vazhuthacaud", zone: "City centre", lat: 8.4977, lng: 76.9609 },
  { name: "Pettah", zone: "City centre", lat: 8.4936, lng: 76.929 },
  { name: "Chackai", zone: "City centre", lat: 8.49, lng: 76.922 },
  { name: "Karamana", zone: "City centre", lat: 8.4789, lng: 76.9667 },
  { name: "Poojappura", zone: "City centre", lat: 8.4904, lng: 76.9757 },
  { name: "Pattom", zone: "Pattom, Kowdiar & around", lat: 8.5196, lng: 76.9421 },
  { name: "Kowdiar", zone: "Pattom, Kowdiar & around", lat: 8.5216, lng: 76.9617 },
  { name: "Vellayambalam", zone: "Pattom, Kowdiar & around", lat: 8.5096, lng: 76.9606 },
  { name: "Sasthamangalam", zone: "Pattom, Kowdiar & around", lat: 8.5126, lng: 76.9718 },
  { name: "Kesavadasapuram", zone: "Pattom, Kowdiar & around", lat: 8.5293, lng: 76.9396 },
  { name: "Kumarapuram", zone: "Pattom, Kowdiar & around", lat: 8.5154, lng: 76.9312 },
  { name: "Medical College", zone: "Pattom, Kowdiar & around", lat: 8.5233, lng: 76.9278 },
  { name: "Ulloor", zone: "Pattom, Kowdiar & around", lat: 8.5367, lng: 76.9311 },
  { name: "Nalanchira", zone: "Pattom, Kowdiar & around", lat: 8.545, lng: 76.943 },
  { name: "Peroorkada", zone: "Pattom, Kowdiar & around", lat: 8.5446, lng: 76.9702 },
  { name: "Vattiyoorkavu", zone: "Pattom, Kowdiar & around", lat: 8.5244, lng: 76.993 },
  { name: "Mannanthala", zone: "Pattom, Kowdiar & around", lat: 8.556, lng: 76.948 },
  { name: "Sreekaryam", zone: "Technopark side", lat: 8.5466, lng: 76.917 },
  { name: "Kariavattom", zone: "Technopark side", lat: 8.5644, lng: 76.888 },
  { name: "Technopark", zone: "Technopark side", lat: 8.5581, lng: 76.8816 },
  { name: "Kazhakkoottam", zone: "Technopark side", lat: 8.5677, lng: 76.8728 },
  { name: "Kaniyapuram", zone: "Technopark side", lat: 8.5893, lng: 76.8545 },
  { name: "Pothencode", zone: "Technopark side", lat: 8.623, lng: 76.907 },
  { name: "Thiruvallam", zone: "South & the coast", lat: 8.439, lng: 76.96 },
  { name: "Kovalam", zone: "South & the coast", lat: 8.4004, lng: 76.9787 },
  { name: "Vizhinjam", zone: "South & the coast", lat: 8.3796, lng: 76.9969 },
  { name: "Balaramapuram", zone: "South & the coast", lat: 8.4231, lng: 77.0465 },
  { name: "Neyyattinkara", zone: "South & the coast", lat: 8.4, lng: 77.086 },
  { name: "Nedumangad", zone: "Towns nearby", lat: 8.6031, lng: 77.0025 },
  { name: "Kattakada", zone: "Towns nearby", lat: 8.5065, lng: 77.0815 },
  { name: "Attingal", zone: "Towns nearby", lat: 8.6966, lng: 76.8146 },
  { name: "Varkala", zone: "Towns nearby", lat: 8.7379, lng: 76.7163 },
] as const;
export const AREAS: readonly string[] = LOCALITIES.map((l) => l.name);
export const ZONES = [...new Set(LOCALITIES.map((l) => l.zone))];

/** Kinds of business that can list on Aestheva (matches scripts/provider-sql.mjs). The stored values stay fixed; people see the labels. */
export const VENUE_TYPES = ["Clinic", "Salon & studio", "Wellness centre", "Independent practitioner"] as const;
export const VENUE_TYPE_CHOICES: Record<string, string> = {
  "Salon & studio": "Salon or studio: beauty, hair, nails, makeup, tattoo…",
  "Independent practitioner": "Independent professional: beautician, nail, makeup or tattoo artist, therapist…",
  "Clinic": "Clinic: skin, dental, hair, physio…",
  "Wellness centre": "Wellness or Ayurveda centre",
};
/** How a kind of business reads on a public page. */
export const typeLabel = (t: string) => (t === "Independent practitioner" ? "Independent professional" : t);

/** Cities people can ask to hear about. The launch city is offered while it has no live venues. */
export const WAITLIST_CITIES = ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Bengaluru", "Chennai", "Mumbai"] as const;
