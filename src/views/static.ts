import { COMPANY, POLICY } from "../config";
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

export function practitionersPage(cats: { id: string; name: string }[] = []) {
  return `<div class="page narrow prose">
    <div class="eyebrow" style="color:var(--sage-d)">List your business</div>
    <h1 class="mt8" style="font-size:clamp(36px,5vw,52px)">Whatever you do to help people look and feel good, there's room for you here.</h1>
    <p class="lede mt16">Aestheva is for everyone in beauty, wellness and care in ${esc(COMPANY.launchCity)}: big salons and one-chair studios, clinics, and independent professionals building their own name. Clients find you, see your prices and your work, and book a time that fits your diary.</p>
    <div class="row wrap mt24" style="gap:10px"><a class="btn btn-ok" href="/for-practitioners/apply">Apply online ${ic("arrowR", 16)}</a><span class="small muted">About five minutes. No documents needed yet.</span></div>
    ${cats.length ? `<div class="join-tiles mt32"><h2 style="margin:0">Select your business to get started</h2><div class="tile-grid mt16">${cats.map((c) => `<a class="tile" href="/for-practitioners/apply?cat=${esc(c.id)}">${catTile(c.id, 22)}<b>${esc(c.name)}</b></a>`).join("")}</div></div>` : ""}
    <h2>Who can join</h2>
    <ul class="ticks">
      <li>${ic("check", 15)} <span><b>Independent professionals</b>: beauticians, nail artists, makeup and bridal artists, tattoo and piercing artists, hair stylists, massage and wellness therapists.</span></li>
      <li>${ic("check", 15)} <span><b>Salons and studios</b>: beauty parlours, unisex salons, nail bars, tattoo studios, barbers and grooming lounges.</span></li>
      <li>${ic("check", 15)} <span><b>Wellness and Ayurveda centres</b>, spas and physiotherapy studios.</span></li>
      <li>${ic("check", 15)} <span><b>Clinics</b>: skin, hair, dental and aesthetic care led by registered doctors and dentists.</span></li>
    </ul>
    <p class="small muted">Working on your own is fine. You'll be the only person on your profile, with your own hours, and you can add others later.</p>
    <div class="promises mt24">
      <div>${ic("users", 20)}<b>Your name, your work</b><p>Each person has their own profile line, with their training, experience and the languages they speak, so clients know who they're booking.</p></div>
      <div>${ic("cal", 20)}<b>Your real availability</b><p>Clients only see the hours you actually work, and two people can never take the same slot or chair.</p></div>
      <div>${ic("receipt", 20)}<b>Prices in full</b><p>Clients see the full price before they book, so there are no awkward surprises on the day.</p></div>
      <div>${ic("shield", 20)}<b>Checked, fairly</b><p>We check what applies to your kind of work and say exactly what we checked. Medical care is held to medical standards; everyone else, to theirs.</p></div>
    </div>
    <h2>What it costs</h2>
    <p>Listing is free. Aestheva takes a ${POLICY.commissionBp / 100}% commission only on completed bookings that clients make through the marketplace. Bookings you add yourself, for your regulars, phone calls or walk-ins, carry no commission.</p>
    <h2>How joining works</h2>
    <ol>
      <li><b>Apply</b> with your business details and the services you offer. Five minutes.</li>
      <li><b>Set up your listing</b> in six short steps: your details, photos of your space or your work, who takes bookings, services and prices, a few documents, and our terms.</li>
      <li><b>We check by scope.</b> Council and clinical registrations for medical care; training certificates, a portfolio or proof of work for beauty, wellness and body art; and an ID or business proof for everyone. Your page shows exactly what we checked.</li>
      <li><b>Go live.</b> Your profile, services and free times appear on Aestheva, and bookings arrive in your calendar.</li>
    </ol>
    <h2>Apply</h2>
    <p>Tell us about yourself or your business and what you offer, and we'll be in touch, usually by phone, to help you get set up.</p>
    <p class="mt16"><a class="btn btn-ok" href="/for-practitioners/apply">Apply online ${ic("arrowR", 16)}</a></p>
    <p class="small muted mt16">Questions first? Email <a href="mailto:${esc(COMPANY.supportEmail)}">${esc(COMPANY.supportEmail)}</a>.</p>
  </div>`;
}
