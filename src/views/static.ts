import { COMPANY, POLICY } from "../config";
import { fact } from "./layout";
import { esc, ic } from "./ui";

const DRAFT = `<div class="note n-plain mt16">${ic("info", 16)}<div><b>Draft for legal review.</b> This text describes how Aestheva works today. It must be reviewed by ${esc(COMPANY.legalName)}'s legal adviser before launch.</div></div>`;

export function cancellationPage() {
  return `<div class="page narrow prose">
    <div class="eyebrow">Policies</div><h1 class="mt8" style="font-size:44px">Cancellation &amp; refunds</h1>
    <p>Many services on Aestheva take a deposit when you book. The deposit holds the practitioner's time, and the rest of the price is paid at the venue.</p>
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
    <p>Aestheva is a marketplace operated by ${esc(COMPANY.legalName)} (registered office: ${fact(COMPANY.registeredAddress, "Registered address")}). It lists independent clinics, salons, wellness centres and practitioners, and lets you book and pay a deposit for their services.</p>
    <h2>Who provides the service</h2>
    <p>The venue or practitioner you book provides the service and is responsible for it. Aestheva is not a healthcare provider. For medical services, your practitioner decides at assessment whether any treatment is suitable for you.</p>
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
    <h2>Your choices</h2>
    <p>To see or delete your data, contact ${fact(COMPANY.supportEmail, "Support email")}.</p>
  </div>`;
}

export function contactPage() {
  const tel = COMPANY.supportPhone.replace(/\s/g, "");
  return `<div class="page narrow prose">
    <div class="eyebrow">Contact</div><h1 class="mt8" style="font-size:44px">Talk to us</h1>
    <p class="lede">A question about a booking, a clinic you'd like to see on Aestheva, or something that didn't feel right? We'd like to hear it.</p>
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
  return `<div class="page narrow prose story">
    <div class="eyebrow">Our story</div>
    <h1 class="mt8">Care should fit the rhythm of your life.</h1>
    <p class="lede mt16">In ${esc(COMPANY.launchCity)}, a lot of good care is still booked the slow way: a phone call squeezed into a busy day, a callback that doesn't come, a price you only learn at the counter, and a name you hear for the first time in the chair.</p>
    <p>Aestheva is our answer to that. It's one place to book skin, hair, dental and wellness care where you can see, before you commit, what a treatment costs, who will treat you and their qualifications, and the times they're genuinely free. Then you hold your appointment in about a minute, from wherever your day has taken you.</p>

    <h2>Who we are</h2>
    <p>Aestheva is run by ${esc(COMPANY.legalName)}, from Kazhakkoottam, beside Technopark Phase 3. Haswel also runs Hasta Wellness, a clinic that is one of the first venues on Aestheva. We'd rather you heard that from us: Hasta's profile says so, and it's listed under the same rules as every other venue.</p>

    <h2>What you can count on</h2>
    <div class="promises">
      <div>${ic("receipt", 20)}<b>Prices in full</b><p>Every treatment shows its full price and how long it takes. No “call for rates”.</p></div>
      <div>${ic("users", 20)}<b>Names, not just brands</b><p>Practitioners are named with their qualifications, and registration numbers for medical care.</p></div>
      <div>${ic("shield", 20)}<b>Medical stays medical</b><p>Medical treatments are labelled as such and begin with your doctor checking they suit you. Beauty and wellness are labelled separately.</p></div>
      <div>${ic("check", 20)}<b>We say what we checked</b><p>Verification lists exactly what we looked at and when. It never promises results.</p></div>
      <div>${ic("cal", 20)}<b>Your time, respected</b><p>A deposit holds your place. Cancel ${POLICY.freeCancelHours} hours or more ahead and it comes back in full.</p></div>
    </div>

    <h2>Why ${esc(COMPANY.launchCity)} first</h2>
    <p>Because it's home. We know the drive from Kazhakkoottam to Kowdiar at six in the evening, and how much a free Saturday afternoon is worth. Starting here lets us get to know the clinics we list and grow carefully, one neighbourhood at a time, before Kochi, Kozhikode and Thrissur.</p>

    <div class="story-cta mt32">
      <a class="btn btn-p" href="/search">Explore treatments</a>
      <a class="btn btn-o" href="/for-practitioners">List your practice</a>
    </div>
  </div>`;
}

export function practitionersPage() {
  return `<div class="page narrow prose">
    <div class="eyebrow" style="color:var(--sage-d)">For clinics &amp; practitioners</div>
    <h1 class="mt8" style="font-size:clamp(36px,5vw,52px)">Fill your diary with people who turn up.</h1>
    <p class="lede mt16">Aestheva brings clients in ${esc(COMPANY.launchCity)} to your door having already seen your prices, your team and a time that suits your rota, with a deposit paid to hold it.</p>
    <div class="promises mt24">
      <div>${ic("wallet", 20)}<b>Deposits at booking</b><p>Clients pay a deposit online to hold the time, so a missed appointment isn't a lost afternoon.</p></div>
      <div>${ic("cal", 20)}<b>Your real availability</b><p>Clients only see the hours each practitioner actually works, and two people can never take the same slot or machine.</p></div>
      <div>${ic("users", 20)}<b>Your team, properly credited</b><p>Each practitioner has their own profile line, with qualifications and registration where they apply.</p></div>
      <div>${ic("shield", 20)}<b>Verified by scope</b><p>We check what applies to you and say exactly what we checked, which is what careful clients look for.</p></div>
    </div>
    <h2>What it costs</h2>
    <p>Aestheva takes a ${POLICY.commissionBp / 100}% commission on completed bookings made through the marketplace. Deposits are settled to your bank account weekly, less the commission.</p>
    <h2>How joining works</h2>
    <ol>
      <li><b>Apply</b> with your business details, services and team.</li>
      <li><b>Verification by scope.</b> We check what applies to you: clinical establishment and council registrations for medical services, certifications for beauty and wellness, and business identity for everyone. Your profile shows exactly what we checked.</li>
      <li><b>Payouts.</b> You complete a short KYC with our payment partner, Razorpay, so deposits can be settled to your account.</li>
      <li><b>Go live.</b> Your profile, services and live availability appear on Aestheva.</li>
    </ol>
    <h2>Apply</h2>
    <p>Online applications open soon. Until then, write to <a href="mailto:${esc(COMPANY.supportEmail)}?subject=${encodeURIComponent("Listing my practice on Aestheva")}">${esc(COMPANY.supportEmail)}</a> with your venue name, area and the services you offer, and we'll be in touch.</p>
  </div>`;
}
