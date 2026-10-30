import { COMPANY, INCENTIVES, POLICY } from "../config";
import { fact } from "./layout";
import { catTile, esc, ic } from "./ui";

const DRAFT = `<div class="note n-plain mt16">${ic("info", 16)}<div><b>Draft for legal review.</b> This text describes how Aestheva works today. It must be reviewed by ${esc(COMPANY.legalName)}'s legal adviser before launch.</div></div>`;

export function cancellationPage() {
  return `<div class="page narrow prose">
    <div class="eyebrow">Policies</div><h1 class="mt8" style="font-size:44px">Cancellation &amp; refunds</h1>
    <p>Many services on Aestheva take a deposit when you book. The deposit holds the professional's time, and the rest of the price is paid on the day.</p>
    <h2>If you cancel</h2>
    <ul>
      <li><b>${POLICY.freeCancelHours} hours or more before your appointment:</b> cancel from your booking page and the deposit is refunded in full to the account you paid from.</li>
      <li><b>Less than ${POLICY.freeCancelHours} hours before:</b> the deposit is normally kept by the venue. You can ask for a review when you cancel, and the Aestheva team will decide.</li>
      <li><b>If you don't attend:</b> the deposit is kept.</li>
    </ul>
    <h2>If the venue cancels</h2>
    <p>Your deposit is refunded in full, whatever the timing.</p>
    <h2>Unpaid bookings</h2>
    <p>When you book, we hold the time for ${POLICY.holdMinutes} minutes while you pay the deposit. If the payment doesn't complete, the time is released. If a payment arrives after the time has gone to someone else, it is refunded automatically.</p>
    <h2>How refunds are paid</h2>
    <p>Refunds go back to the original payment method through our payment partner, Razorpay. They usually reach your account within 5 to 7 working days, depending on your bank.</p>
    <h2>Questions</h2>
    <p>Contact us with your booking reference: ${fact(COMPANY.supportEmail, "Support email")}${COMPANY.supportPhone ? ` or ${esc(COMPANY.supportPhone)}` : ""}.</p>
  </div>`;
}

export function termsPage() {
  return `<div class="page narrow prose">
    <div class="eyebrow">Policies</div><h1 class="mt8" style="font-size:44px">Terms of use</h1>${DRAFT}
    <h2>Who we are</h2>
    <p>Aestheva is a marketplace operated by ${esc(COMPANY.legalName)} (registered office: ${fact(COMPANY.registeredAddress, "Registered address")}). It lists independent salons, studios, clinics, wellness centres and professionals, and lets you book and pay a deposit for their services.</p>
    <h2>Who provides the service</h2>
    <p>The business or professional you book provides the service and is responsible for it. Aestheva is not a healthcare provider. For medical services, your practitioner decides at assessment whether any treatment is suitable for you.</p>
    <h2>Verification</h2>
    <p>Each profile lists what Aestheva checked, its scope and when. Verification confirms documents within that scope on that date. It is not a guarantee of results.</p>
    <h2>Payments</h2>
    <p>Deposits are collected by ${esc(COMPANY.legalName)} through Razorpay and passed to the venue, less Aestheva's commission. The balance is paid to the venue directly. Cancellations and refunds follow the <a href="/policies/cancellation">cancellation policy</a>.</p>
    <h2 id="offers">Offers</h2>
    <p><b>Welcome offer.</b> ₹${INCENTIVES.welcomeCreditPaise / 100} off the deposit of your first booking on Aestheva that takes a deposit. It is paid by ${esc(COMPANY.legalName)}, not by the business, and the business still receives the full deposit. One per person, identified by mobile number. It applies automatically when you pay, cannot be exchanged for cash and cannot be combined with other offers. If the booking is cancelled, the offer stays available for your next booking. We may change or end the offer at any time; bookings already paid are not affected.</p>
    <h2>Reviews</h2>
    <p>Reviews must describe your own experience of a booking made on Aestheva.</p>
  </div>`;
}

export function privacyPage() {
  return `<div class="page narrow prose">
    <div class="eyebrow">Policies</div><h1 class="mt8" style="font-size:44px">Privacy</h1>${DRAFT}
    <h2>What we collect</h2>
    <p>When you book: your name, mobile number, email address, the appointment you chose and any note you add. Payments are handled by Razorpay; we receive a payment reference and method, never your card or UPI credentials.</p>
    <h2>What we don't collect</h2>
    <p>We don't ask for your medical history. Please don't put health details in the booking note; your practitioner will discuss them with you in person.</p>
    <h2>Who sees it</h2>
    <p>The venue you book sees your name, contact details, appointment and note, so it can provide the service. Razorpay processes your payment. We don't sell your data.</p>
    <h2>If you apply to list your practice</h2>
    <p>We collect the business and contact details you give us, the services you describe and any registration numbers you share. We use them to review your application, contact you about it and, if you join, set up your profile. We keep a one-way hash of your connection's address for a short time to stop automated spam; we don't store the address itself.</p>
    <h2>Your choices</h2>
    <p>To see or delete your data, contact ${fact(COMPANY.supportEmail, "Support email")}.</p>
  </div>`;
}

export function contactPage() {
  const tel = COMPANY.supportPhone.replace(/\s/g, "");
  return `<div class="page narrow prose">
    <div class="eyebrow">Contact</div><h1 class="mt8" style="font-size:44px">Talk to us</h1>
    <p class="lede">A question about a booking, a salon, studio or clinic you'd like to see on Aestheva, or something that didn't feel right? We'd like to hear it.</p>
    <div class="contact-grid mt24">
      <a class="contact-card" href="mailto:${esc(COMPANY.supportEmail)}">${ic("mail", 22)}<b>Email</b><span>${fact(COMPANY.supportEmail, "Support email")}</span></a>
      ${COMPANY.supportPhone ? `<a class="contact-card" href="tel:${esc(tel)}">${ic("phone", 22)}<b>Phone</b><span>${esc(COMPANY.supportPhone)}</span></a>` : ""}
      <div class="contact-card">${ic("pin", 22)}<b>Office</b><span>${fact(COMPANY.registeredAddress, "Registered address")}</span></div>
    </div>
    <p class="mt24">About a booking? Include your booking reference, which starts with AE-, and we can help faster.</p>
    <p class="small muted">Aestheva is operated by <b>${esc(COMPANY.legalName)}</b>.</p>
  </div>`;
}

export function aboutPage() {
  const promises = [
    ["receipt", "Prices in full", "Every service shows its full price and how long it takes. No “call for rates”."],
    ["users", "Names, not just brands", "The people who look after you are named, with their training, and registration numbers for medical care."],
    ["shield", "Medical stays medical", "Medical treatments are labelled as such and start with a doctor checking they suit you. Everything else is labelled separately."],
    ["check", "We say what we checked", "Every listing shows exactly what we verified and when. We never promise results."],
    ["cal", "Your time, respected", `Only genuinely free times are shown, and you can cancel free up to ${POLICY.freeCancelHours} hours before.`],
    ["heart", "Everyone welcome", "Big salons, one-chair studios, clinics and independent artists, all listed under the same fair rules."],
  ];
  return `<div class="page story" style="padding-top:0">
  <section class="story-hero">
    <div>
      <div class="eyebrow">Our story</div>
      <h1 class="mt12">Care should fit the rhythm of your life.</h1>
      <p class="lede mt16">In ${esc(COMPANY.launchCity)}, a lot of good care is still booked the slow way: a phone call squeezed into a busy day, a callback that doesn't come, a price you only learn at the counter, and a name you hear for the first time in the chair.</p>
      <p class="mt16">Aestheva is our answer to that. One place to book beauty, wellness and care, from a facial or nail art to a tattoo or a dental check-up, where you see the full price, who'll look after you and the times they're genuinely free before you commit. Then you book in about a minute, from wherever your day has taken you.</p>
      <div class="story-cta mt24"><a class="btn btn-p" href="/search">Find something near you</a><a class="btn btn-o" href="/for-practitioners">List your business</a></div>
    </div>
    <aside class="story-facts" aria-label="Aestheva at a glance">
      <div><b>Made in</b><span>Kazhakkoottam, beside Technopark Phase 3</span></div>
      <div><b>Run by</b><span>${esc(COMPANY.legalName)}</span></div>
      <div><b>Covering</b><span>${esc(COMPANY.launchCity)} and the towns around it, from Varkala to Neyyattinkara</span></div>
      <div><b>For</b><span>Salons, studios, clinics and independent professionals</span></div>
      <div><b>Next</b><span>Kochi, Kozhikode and Thrissur</span></div>
    </aside>
  </section>

  <section class="mt64">
    <div class="eyebrow">What you can count on</div>
    <h2 class="mt8">Six promises, on every listing</h2>
    <div class="promise-grid mt24">${promises.map(([i, t, b]) => `<div>${ic(i, 22)}<b>${t}</b><p>${b}</p></div>`).join("")}</div>
  </section>

  <section class="story-two mt64">
    <div>
      <div class="eyebrow">Who we are</div>
      <h2 class="mt8">A local team, open about who we are</h2>
      <p class="mt16">Aestheva is run by ${esc(COMPANY.legalName)}, from Kazhakkoottam, beside Technopark Phase 3. Haswel also runs Hasta Wellness, a clinic that is one of the first places on Aestheva. We'd rather you heard that from us: Hasta's page says so, and it's listed under exactly the same rules as everyone else.</p>
    </div>
    <div>
      <div class="eyebrow">Why ${esc(COMPANY.launchCity)} first</div>
      <h2 class="mt8">Because it's home</h2>
      <p class="mt16">We know the drive from Kazhakkoottam to Kowdiar at six in the evening, and how much a free Saturday afternoon is worth. Starting here lets us get to know everyone we list and grow carefully, one neighbourhood at a time, before Kochi, Kozhikode and Thrissur.</p>
    </div>
  </section>

  <section class="story-band mt64">
    <div class="story-in">
      <h2>Ready when you are.</h2>
      <p class="mt12">Find a free time near you, or bring your business to Aestheva. Listing is free.</p>
      <div class="story-cta mt24"><a class="btn btn-light" href="/search">Find something near you ${ic("arrowR", 16)}</a><a class="btn btn-o" href="/for-practitioners" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.5)">List your business</a></div>
    </div>
  </section>
  </div>`;
}

export function practitionersPage(cats: { id: string; name: string }[] = [], placesLeft = 0) {
  const who = [
    ["users", "Independent professionals", "Beauticians, nail artists, makeup and bridal artists, tattoo and piercing artists, hair stylists, massage and wellness therapists."],
    ["brush", "Salons and studios", "Beauty parlours, unisex salons, nail bars, tattoo studios, barbers and grooming lounges."],
    ["leaf", "Wellness and Ayurveda", "Ayurveda and wellness centres, spas and physiotherapy studios."],
    ["shield", "Clinics", "Skin, hair, dental and aesthetic care led by registered doctors and dentists."],
  ];
  const perks = [
    ["users", "Your name, your work", "Each person has their own profile line, with their training, experience and the languages they speak."],
    ["cal", "Your real availability", "Clients only see the hours you actually work, and two people can never take the same slot or chair."],
    ["receipt", "Prices in full", "Clients see the full price before they book, so there are no awkward surprises on the day."],
    ["shield", "Checked, fairly", "We check what applies to your kind of work. Medical care is held to medical standards; everyone else, to theirs."],
  ];
  const steps = [
    ["Apply", "Your business details and the services you offer. About five minutes, no documents needed yet."],
    ["Set up your listing", "Six short steps: your details, photos of your space or your work, who takes bookings, services and prices, a few documents, and our terms."],
    ["We check by scope", "Registrations for medical care; a training certificate, portfolio or proof of work for beauty, wellness and body art; an ID or business proof for everyone."],
    ["Go live", "Your profile, services and free times appear on Aestheva, and bookings arrive in your calendar."],
  ];
  return `<div class="page join" style="padding-top:0">
  <section class="story-hero">
    <div>
      <div class="eyebrow" style="color:var(--sage-d)">List your business</div>
      <h1 class="mt12">Whatever you do to help people look and feel good, there's room for you here.</h1>
      <p class="lede mt16">Big salons and one-chair studios, clinics, and independent professionals building their own name. Clients across ${esc(COMPANY.launchCity)} find you, see your prices and your work, and book a time that fits your diary.</p>
      <div class="row wrap mt24" style="gap:10px"><a class="btn btn-p" href="/for-practitioners/apply">Apply online ${ic("arrowR", 16)}</a><span class="small muted">About five minutes. No documents needed yet.</span></div>
    </div>
    <aside class="story-facts" aria-label="Joining at a glance">
      <div><b>Listing</b><span>Free</span></div>
      <div><b>Commission</b><span>${POLICY.commissionBp / 100}% only on completed bookings made through Aestheva. None on bookings through your own link or that you add yourself.</span></div>
      <div><b>Set-up</b><span>About 30 minutes, at your own pace</span></div>
      <div><b>Working solo?</b><span>Welcome. Add just yourself, with your own hours</span></div>
    </aside>
  </section>

  ${placesLeft ? `<section class="founding mt48"><div>
      <div class="eyebrow" style="color:#F4D7E3">Founding partners · ${placesLeft} of ${INCENTIVES.foundingPlaces} places left</div>
      <h2 class="mt8">${INCENTIVES.foundingFreeMonths} months with no commission. Then ${INCENTIVES.foundingRateBp / 100}% for the rest of your first year.</h2>
      <p class="mt12">The first ${INCENTIVES.foundingPlaces} businesses to go live on Aestheva pay no commission for their first ${INCENTIVES.foundingFreeMonths} months, then ${INCENTIVES.foundingRateBp / 100}% instead of ${POLICY.commissionBp / 100}% until their first anniversary, and keep a "Founding partner" badge in their portal.</p>
    </div><a class="btn btn-light" href="/for-practitioners/apply">Claim a founding place ${ic("arrowR", 16)}</a></section>` : ""}
  <section class="mt48 grid g2 own-link-band"><div class="card"><div class="eyebrow">Your link, zero commission</div><h3 class="mt8">Bring your regulars. Keep every rupee.</h3>
      <p class="small muted mt8">You get your own booking link to share on Instagram, WhatsApp and Google Maps. Clients who book you through it pay you directly through Aestheva, and you pay no commission on those bookings, ever. Free online booking, a calendar and deposits for the clients you already have.</p></div>
    <div class="card"><div class="eyebrow">How it adds up</div><h3 class="mt8">A ₹2,000 booking</h3>
      <ul class="ticks mt12"><li>${ic("check", 14)} <span>Through your own link: <b>₹0 commission</b></span></li><li>${ic("check", 14)} <span>From Aestheva search, as a founding partner, first ${INCENTIVES.foundingFreeMonths} months: <b>₹0</b></span></li><li>${ic("check", 14)} <span>Then, to your first anniversary: <b>₹${(2000 * INCENTIVES.foundingRateBp / 10000).toLocaleString("en-IN")}</b></span></li><li>${ic("check", 14)} <span>Phone and walk-in bookings you add: <b>₹0</b></span></li></ul></div></section>
  ${cats.length ? `<section class="mt48"><div class="eyebrow">Get started</div><h2 class="mt8">Select your business to get started</h2>
    <div class="tile-grid mt24">${cats.map((c) => `<a class="tile" href="/for-practitioners/apply?cat=${esc(c.id)}">${catTile(c.id, 22)}<b>${esc(c.name)}</b></a>`).join("")}</div></section>` : ""}

  <section class="mt64"><div class="eyebrow">Who can join</div><h2 class="mt8">Everyone in beauty, wellness and care</h2>
    <div class="who-grid mt24">${who.map(([i, t, b]) => `<div>${ic(i, 22)}<b>${t}</b><p>${b}</p></div>`).join("")}</div></section>

  <section class="band mt64"><div class="eyebrow">What you get</div><h2 class="mt8">Built so the right clients find you</h2>
    <div class="who-grid mt24">${perks.map(([i, t, b]) => `<div>${ic(i, 22)}<b>${t}</b><p>${b}</p></div>`).join("")}</div></section>

  <section class="story-two mt64">
    <div><div class="eyebrow">How joining works</div><h2 class="mt8">Four steps to your first booking</h2>
      <ol class="join-steps mt16">${steps.map(([t, b], n) => `<li><span>${n + 1}</span><div><b>${t}</b><p>${b}</p></div></li>`).join("")}</ol></div>
    <div><div class="eyebrow">What it costs</div><h2 class="mt8">Free to list. Fair when you're busy.</h2>
      <p class="mt16">Listing on Aestheva is free. We take a ${POLICY.commissionBp / 100}% commission only on completed bookings that clients make through the marketplace.</p>
      <p class="mt12">Bookings you add yourself, for your regulars, phone calls or walk-ins, carry no commission. If a client cancels or doesn't turn up, you pay nothing.</p>
      <p class="mt12 small muted">Questions first? Email <a href="mailto:${esc(COMPANY.supportEmail)}">${esc(COMPANY.supportEmail)}</a>.</p></div>
  </section>

  <section class="story-band mt64">
    <div class="story-in">
      <h2>Your talent, fully booked.</h2>
      <p class="mt12">Tell us about yourself or your business and what you offer. We'll be in touch, usually by phone, to help you get set up.</p>
      <div class="story-cta mt24"><a class="btn btn-light" href="/for-practitioners/apply">Apply online ${ic("arrowR", 16)}</a></div>
    </div>
  </section>
  </div>`;
}
