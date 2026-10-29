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
  return `<div class="page narrow prose">
    <div class="eyebrow">Contact</div><h1 class="mt8" style="font-size:44px">Talk to us</h1>
    <p>Aestheva is operated by <b>${esc(COMPANY.legalName)}</b>.</p>
    <div class="card mt24 col" style="gap:10px">
      <div class="row" style="gap:10px">${ic("inbox", 18)} <span>${fact(COMPANY.supportEmail, "Support email")}</span></div>
      <div class="row" style="gap:10px">${ic("clock", 18)} <span>${fact(COMPANY.supportPhone, "Support phone")}</span></div>
      <div class="row" style="gap:10px;align-items:flex-start">${ic("pin", 18)} <span>${fact(COMPANY.registeredAddress, "Registered address")}</span></div>
    </div>
    <p class="mt16">About a booking? Include your booking reference, which starts with AE-.</p>
  </div>`;
}

export function practitionersPage() {
  return `<div class="page narrow prose">
    <div class="eyebrow" style="color:var(--sage-d)">For practitioners &amp; clinics</div>
    <h1 class="mt8" style="font-size:clamp(36px,5vw,52px)">Bring your practice to Aestheva</h1>
    <p style="font-size:17px">Clients in ${esc(COMPANY.launchCity)} find you, book a time that suits your rota and pay a deposit up front. You receive deposits, less Aestheva's ${POLICY.commissionBp / 100}% commission on completed marketplace bookings, by weekly settlement to your bank account.</p>
    <h2>How joining works</h2>
    <ol>
      <li><b>Apply</b> with your business details, services and team.</li>
      <li><b>Verification by scope.</b> We check what applies to you: clinical establishment and council registrations for medical services, certifications for beauty and wellness, and business identity for everyone. Your profile shows exactly what we checked.</li>
      <li><b>Payouts.</b> You complete a short KYC with our payment partner, Razorpay, so deposits can be settled to your account.</li>
      <li><b>Go live.</b> Your profile, services and live availability appear on Aestheva.</li>
    </ol>
    <h2>Apply</h2>
    <p>Online applications open soon. Until then, write to ${fact(COMPANY.supportEmail, "Support email")} with your venue name, area and the services you offer.</p>
  </div>`;
}
