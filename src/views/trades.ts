// One page per kind of business (/for-practitioners/<trade>): what Aestheva does for that trade, what we check, its questions.
// Each is aimed at what an owner searches for, and is the landing page for that trade's Google Ads ad group.
import { COMPANY, INCENTIVES, POLICY } from "../config";
import { freePeriod } from "../services/incentives";
import { esc, ic } from "./ui";

type Card = readonly [icon: string, title: string, body: string];
export interface Trade {
  slug: string; short: string; cat: string; medical: boolean;
  title: string; description: string; eyebrow: string; h1: string; lede: string;
  cards: Card[]; checks: string; faqs: [string, string][];
}

const BEAUTY_CHECKS = "A training certificate or a portfolio of your work, and an ID or business proof such as PAN, GST or a trade licence. Only the Aestheva team sees your documents.";
const MEDICAL_CHECKS = "The state council registration for each doctor or dentist, and your clinic or business registration, before you go live. Your page says what we checked and when.";
const PHONE: [string, string] = ["Do I need a computer or new software?", "No. The Aestheva portal works in the browser on your phone or a computer, so there's nothing to install. You see bookings, your calendar and your monthly statement there."];
const OWN: [string, string] = ["Can I keep taking phone and walk-in bookings?", "Yes. Add them to your calendar so the time is taken online too. Bookings you add yourself carry no commission."];
const COST: [string, string] = ["What does it cost?", `Listing is free. We charge ${POLICY.commissionBp / 100}% only on completed bookings that clients make through Aestheva, never on bookings through your own link or ones you add yourself, and nothing when a client cancels or doesn't turn up.`];

export const TRADES: Trade[] = [
  {
    slug: "salons", short: "Salons", cat: "hair", medical: false,
    title: "List your salon free · Online booking in Trivandrum · Aestheva",
    description: "Free listing for salons in Thiruvananthapuram. Clients book a named stylist at a free time, with the full price shown. No commission on bookings from your own link.",
    eyebrow: "For salons", h1: "New clients for your salon, booked into the chairs that are free.",
    lede: `Aestheva shows clients across ${COMPANY.launchCity} each stylist, every price and the times your team is genuinely free, so they book instead of calling. You stay in charge of the hours, the prices and who does what.`,
    cards: [
      ["users", "Each stylist, by name", "Clients choose the person they want. Every stylist has their own working hours, so nobody is booked twice."],
      ["cal", "Fewer calls at the counter", "Bookings arrive in your portal with the client's name, mobile number and service. Phone and walk-in bookings you add carry no commission."],
      ["clock", "Fill the slow afternoons", "Set an amount off for the hours that are usually empty, on the services you choose. Busy times stay at the full price."],
      ["receipt", "Prices that sell", "Haircuts, colour, smoothening and hair spa listed with full prices and how long each takes, so clients arrive knowing what they'll pay."],
    ],
    checks: BEAUTY_CHECKS,
    faqs: [COST, PHONE, OWN, ["Do you list unisex and men's salons?", "Yes. Unisex salons, barbers and grooming lounges all list the same way, with each person's services and hours."]],
  },
  {
    slug: "beauty-parlours", short: "Beauty parlours", cat: "skin", medical: false,
    title: "List your beauty parlour free in Trivandrum · Aestheva",
    description: "Free listing for beauty parlours in Thiruvananthapuram. Threading, facials, waxing and bridal booked online at full prices, and no commission on your own link.",
    eyebrow: "For beauty parlours", h1: "Your beauty parlour, booked online, without the phone ringing all day.",
    lede: `From threading and facials to bridal packages, clients across ${COMPANY.launchCity} see your services, your prices and when you're free, and book in about a minute. One chair or six, it fits the way you work.`,
    cards: [
      ["clock", "Every service, its own time", "Threading, waxing, clean-ups and facials listed with how long each takes, so clients book times that fit your day."],
      ["sparkle", "Bridal, planned ahead", `Brides book trials and bridal sessions up to ${POLICY.windowDays / 30} months ahead, with your package and price written down.`],
      ["users", "Your regulars, your link", "Share your own booking link on WhatsApp and Instagram. Bookings through it never carry commission."],
      ["shield", "A listing clients trust", "We check your training or portfolio and your ID or business proof, and your page says what we checked."],
    ],
    checks: BEAUTY_CHECKS,
    faqs: [COST, ["I don't have a GST number. Can I still join?", "Yes. GST is optional. During set-up we ask for your PAN, because Aestheva must deduct a small income-tax TDS on bookings made through it, and that is credited against your PAN so you can claim it back."], PHONE, OWN],
  },
  {
    slug: "bridal-makeup-artists", short: "Bridal makeup artists", cat: "groom", medical: false,
    title: "Bridal makeup artists: get booked on Aestheva, Trivandrum",
    description: "Free listing for bridal and party makeup artists in Thiruvananthapuram. Show your portfolio and packages, take trials online, and pay no commission on your own link.",
    eyebrow: "For makeup artists", h1: "Brides who've seen your work, booking your dates.",
    lede: `Show your portfolio, your bridal and party packages and what each costs. Brides and their families in ${COMPANY.launchCity} book a trial or a session at a time you're free, and your own clients book you through your link with no commission.`,
    cards: [
      ["sparkle", "Your work, front and centre", "Photos of your looks on your profile, with your training and the languages you speak."],
      ["receipt", "Packages with prices", "Bridal, engagement, reception and party makeup listed with full prices, so every enquiry starts from the same page."],
      ["cal", "Trials and sessions in one calendar", "Bookings arrive with the client's name and number. Add the dates you take by phone, so nobody books over them."],
      ["users", "Independent? Welcome", "List just yourself, with your own hours. You don't need a salon."],
    ],
    checks: BEAUTY_CHECKS,
    faqs: [
      COST,
      ["Do I need a studio?", "Aestheva lists the place clients come to you, such as your studio or a salon you work from. If you only work at clients' homes or venues, say so in your application and we'll talk it through with you."],
      ["Can I show photos of brides I've done?", "Only with their permission. Every photo you upload must be yours to share, and we remove the location and camera details from photos before they're shown."],
      PHONE,
    ],
  },
  {
    slug: "dental-clinics", short: "Dental clinics", cat: "dental", medical: true,
    title: "List your dental clinic in Trivandrum · Aestheva",
    description: "A factual listing for dental clinics in Thiruvananthapuram: your dentists, their registration, treatments with prices and free times. Free to list.",
    eyebrow: "For dental clinics", h1: "Patients book your free appointment times and see your dentists as they are.",
    lede: "Aestheva lists dental clinics factually: each dentist's name, qualifications and council registration, your treatments with what they cost and how long they take, and the times you're free. No deals, and no \"best dentist\" claims.",
    cards: [
      ["tooth", "Labelled as medical care", "Dental treatment is marked as medical and is never sold as an offer or a discount."],
      ["shield", "Registration, checked", "We check each dentist's state dental council registration and your clinic's registration, and say so on your page."],
      ["cal", "Check-ups booked online", "Patients book a consultation or a cleaning at a time when the dentist and the chair are both free."],
      ["receipt", "Costs up front", "Show what scaling, fillings, whitening and other treatments cost, so patients know before they come."],
    ],
    checks: MEDICAL_CHECKS,
    faqs: [
      ["Is a listing like this suitable for dentists?", "Aestheva shows factual information only: names, qualifications, registration, treatments, prices and hours. We never run discounts or offers on medical care, and never rank one dentist as better than another. You know your council's rules best; if you're unsure, check with them before you list."],
      ["Do patients' health details pass through Aestheva?", "No. We don't ask patients for medical history, and ask them not to put health details in the booking note. You discuss and record those in your own clinical records."],
      ["Can each dentist have their own hours?", "Yes. Each dentist has their own working hours and treatments, and online booking only offers those times."],
      COST,
    ],
  },
  {
    slug: "skin-clinics", short: "Skin and aesthetic clinics", cat: "medaes", medical: true,
    title: "List your skin or aesthetic clinic in Trivandrum · Aestheva",
    description: "A free, factual listing for dermatology and aesthetic clinics in Thiruvananthapuram: doctors' registration, treatments with full prices and real free times.",
    eyebrow: "For skin and aesthetic clinics", h1: "Consultations booked with the right doctor, at the full price, before patients arrive.",
    lede: `Patients in ${COMPANY.launchCity} compare skin clinics by who treats them and what it costs. Aestheva shows your doctors and their registration, your consultations and treatments with prices, and the times you're free.`,
    cards: [
      ["shield", "Doctors, registered and named", "We check each doctor's state medical council registration and show it on your page."],
      ["tooth", "Medical stays medical", "Treatments done by doctors are labelled medical and never sold as deals. Services done by trained therapists are listed as beauty."],
      ["cal", "Machines and rooms counted", "If a treatment needs a laser or a room, two bookings can never use it at the same time."],
      ["receipt", "Full prices", "Consultation fees and treatment prices shown in full, so the first conversation is about care, not cost."],
    ],
    checks: MEDICAL_CHECKS,
    faqs: [
      ["Can we list peels and laser hair reduction?", "Yes. Who performs a treatment decides how it's labelled: by a doctor, it's medical care and can't carry offers; by a trained therapist, it's a beauty service and can."],
      ["Do patients' health details pass through Aestheva?", "No. We don't ask patients for medical history or photos of their skin. You discuss and record those in your own clinical records."],
      COST, PHONE,
    ],
  },
  {
    slug: "ayurveda-spas", short: "Ayurveda centres and spas", cat: "ayur", medical: false,
    title: "List your Ayurveda centre or spa in Trivandrum · Aestheva",
    description: "Free listing for Ayurveda centres, spas and massage therapists in Thiruvananthapuram: therapies with full prices, named therapists and real free times.",
    eyebrow: "For Ayurveda centres and spas", h1: "Therapies booked for the hours you're free, with the therapist named.",
    lede: `Abhyangam, Shirodhara, Kizhi and spa treatments, listed with how long each takes and the full price. People across ${COMPANY.launchCity} book a time that fits your therapists and your rooms.`,
    cards: [
      ["leaf", "Your therapies, explained", "Each therapy with how long it takes, what's included and the price."],
      ["users", "Therapists by name", "Clients choose a therapist and can see their training and the languages they speak."],
      ["cal", "Rooms never double-booked", "If a therapy needs a room or a droni, two bookings can't overlap."],
      ["clock", "Fill the quiet hours", "Set an amount off chosen therapies for the hours that are usually empty. Busy times stay at the full price."],
    ],
    checks: `${BEAUTY_CHECKS} If a registered Ayurveda doctor leads treatments such as Panchakarma, we check their registration and those treatments are labelled medical.`,
    faqs: [
      ["Are Ayurveda treatments listed as medical?", "Massages and wellness therapies are listed as wellness. Treatments prescribed or led by a registered Ayurveda doctor are labelled medical and are never sold as offers."],
      COST, PHONE, OWN,
    ],
  },
];

export const tradeBySlug = (slug: string) => TRADES.find((t) => t.slug === slug);

export function tradePage(t: Trade, placesLeft: number) {
  const apply = `/for-practitioners/apply?cat=${t.cat}`;
  const steps = [
    ["Apply", "Your business details and the services you offer. About five minutes, no documents needed yet."],
    ["Set up your listing", "Your details, photos, who takes bookings, services and prices, a few documents, and our terms."],
    ["We check by scope", t.checks],
    ["Go live", "Your profile, services and free times appear on Aestheva, and bookings arrive in your calendar."],
  ];
  return `<div class="page join trade" style="padding-top:0">
  <section class="story-hero">
    <div>
      <div class="eyebrow" style="color:var(--sage-d)">${t.eyebrow} · ${esc(COMPANY.launchCity)}</div>
      <h1 class="mt12">${t.h1}</h1>
      <p class="lede mt16">${t.lede}</p>
      <div class="row wrap mt24" style="gap:10px"><a class="btn btn-p" href="${apply}">Apply free ${ic("arrowR", 16)}</a><span class="small muted">About five minutes. No documents needed yet.</span></div>
    </div>
    <aside class="story-facts" aria-label="Joining at a glance">
      <div><b>Listing</b><span>Free</span></div>
      <div><b>Commission</b><span>${POLICY.commissionBp / 100}% only on completed bookings made through Aestheva. None on your own link or bookings you add.</span></div>
      ${placesLeft ? `<div><b>Founding offer</b><span>No commission for your first ${freePeriod()}, then ${INCENTIVES.foundingRateBp / 100}% to your first anniversary. ${placesLeft} places left.</span></div>` : ""}
      <div><b>Set-up</b><span>About 30 minutes, at your own pace</span></div>
    </aside>
  </section>

  <section class="mt64"><div class="eyebrow">What changes for you</div><h2 class="mt8">Built for ${t.short.toLowerCase()}</h2>
    <div class="promise-grid city-moments mt24">${t.cards.map(([i, h, b]) => `<div>${ic(i, 22)}<b>${h}</b><p>${b}</p></div>`).join("")}</div></section>

  ${placesLeft ? `<section class="founding mt64"><div>
      <div class="eyebrow" style="color:#F4D7E3">Founding partners · ${placesLeft} of ${INCENTIVES.foundingPlaces} places left</div>
      <h2 class="mt8">${INCENTIVES.foundingFreeMonths === 1 ? "Your first month" : `${INCENTIVES.foundingFreeMonths} months`} with no commission. Then ${INCENTIVES.foundingRateBp / 100}% for the rest of your first year.</h2>
      <p class="mt12">The first ${INCENTIVES.foundingPlaces} businesses to go live on Aestheva pay no commission for their first ${freePeriod()}, then ${INCENTIVES.foundingRateBp / 100}% instead of ${POLICY.commissionBp / 100}% until their first anniversary.</p>
    </div><a class="btn btn-light" href="${apply}">Claim a founding place ${ic("arrowR", 16)}</a></section>` : ""}

  <section class="story-two mt64">
    <div><div class="eyebrow">How joining works</div><h2 class="mt8">Four steps to your first booking</h2>
      <ol class="join-steps mt16">${steps.map(([h, b], n) => `<li><span>${n + 1}</span><div><b>${h}</b><p>${b}</p></div></li>`).join("")}</ol></div>
    <div><div class="eyebrow">Questions</div><h2 class="mt8">What ${t.short.toLowerCase()} ask us</h2>
      <div class="faq mt16">${t.faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
      <p class="small muted mt16">Something else? Email <a href="mailto:${esc(COMPANY.supportEmail)}">${esc(COMPANY.supportEmail)}</a> or call ${esc(COMPANY.supportPhone)}.</p></div>
  </section>

  <section class="mt64"><div class="eyebrow">Also on Aestheva</div>
    <div class="chips mt12">${TRADES.filter((x) => x !== t).map((x) => `<a class="chip" href="/for-practitioners/${x.slug}">${x.short}</a>`).join("")}<a class="chip" href="/for-practitioners">Everyone in beauty, wellness and care</a></div></section>

  <section class="story-band mt64">
    <div class="story-in">
      <h2>Your talent, fully booked.</h2>
      <p class="mt12">Tell us about your business and what you offer. We'll be in touch, usually by phone, to help you get set up.</p>
      <div class="story-cta mt24"><a class="btn btn-light" href="${apply}">Apply free ${ic("arrowR", 16)}</a></div>
    </div>
  </section>
  </div>`;
}
