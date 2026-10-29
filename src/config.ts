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
} as const;

export const POLICY = {
  freeCancelHours: 24,     // full deposit refund when cancelled at least this long before the start
  holdMinutes: 15,         // an unpaid slot is held this long while the client pays
  leadMinutes: 60,         // earliest bookable start is this far from now
  windowDays: 60,          // how far ahead clients can book
  commissionBp: 1000,      // 10% of the full price on completed marketplace bookings
} as const;

export const AREAS = ["Kazhakkoottam", "Kowdiar", "Pattom", "Vellayambalam"] as const;

/** Kinds of business that can list on Aestheva (matches scripts/provider-sql.mjs). */
export const VENUE_TYPES = ["Clinic", "Salon & studio", "Wellness centre", "Independent practitioner"] as const;

/** Cities people can ask to hear about. The launch city is offered while it has no live venues. */
export const WAITLIST_CITIES = ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Bengaluru", "Chennai", "Mumbai"] as const;
