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
    <p><b>Welcome offer.</b> ₹${INCENTIVES.welcomeCreditPaise / 100} off the deposit of your first booking on Aestheva that takes a deposit. It is paid by ${esc(COMPANY.legalName)}, not by the business, and the business still receives the full deposit. One per person, identified by mobile number. It applies automatically when you pay and cannot be exchanged for cash. It can be used together with a business's quiet-hour offer, but not with other Aestheva offers. If the booking is cancelled, the offer stays available for your next booking. We may change or end the offer at any time; bookings already paid are not affected.</p>
    <p id="quiet-hours"><b>Quiet-hour offers.</b> Some businesses take an amount off chosen services for appointments that start at quieter times. These times are shown in gold when you book, and the offer applies automatically. Each offer is set and paid for by the business, which receives the discounted price; Aestheva's commission is charged on that discounted price. Offers never apply to medical consultations or treatments. One booking per mobile number per offer, while the business's places for that month last. If you cancel, the offer becomes available to you again. Offers have no cash value. A business may change, pause or end an offer at any time; bookings already made keep their price.</p>
    <h2>Reviews</h2>
    <p>Reviews must describe your own experience of a booking made on Aestheva.</p>
    <h2 id="data">Personal data</h2>
    <p>Aestheva handles the personal data needed to run your booking, as our <a href="/policies/privacy">privacy notice</a> describes. The business you book is separately responsible for how it uses your details once it has them, and for any records it keeps about your care. Businesses agree to our <a href="/policies/data-protection">data protection terms for businesses</a>.</p>
    <h2 id="liability">Our responsibility</h2>
    <p>Aestheva provides the platform for finding, booking and paying a deposit. The business provides the service. To the extent the law allows, Aestheva is not responsible for the service itself, its results, or how a business handles information it holds outside Aestheva. Our liability for any booking is limited to the amount you paid through Aestheva for it. Nothing in these terms limits your rights as a consumer that the law does not allow to be limited.</p>
  </div>`;
}

// ---------- privacy and data protection ----------

const updated = () => `<p class="small muted mt8">Last updated ${esc(COMPANY.privacyUpdated)}</p>`;
const table = (head: string[], rows: string[][]) => `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const grievance = () => `<p><b>Grievance Officer</b><br>${fact(COMPANY.grievanceOfficer, "Name")}, ${esc(COMPANY.legalName)}<br>${fact(COMPANY.registeredAddress, "Registered address")}<br>Email: ${COMPANY.supportEmail ? `<a href="mailto:${esc(COMPANY.supportEmail)}?subject=Data%20protection">${esc(COMPANY.supportEmail)}</a>` : fact("", "Email")} (write “Data protection” in the subject)</p>
  <p>We acknowledge requests within 3 working days and answer within 30 days. If you're not satisfied with our answer, you can complain to the Data Protection Board of India.</p>`;

export function privacyPage() {
  return `<div class="page narrow prose">
    <div class="eyebrow">Policies</div><h1 class="mt8" style="font-size:44px">Privacy and data protection</h1>${updated()}${DRAFT}
    <p class="lede mt16">How ${esc(COMPANY.legalName)} (“Aestheva”, “we”) handles personal data on bookaestheva.com: what we collect, why, who sees it, how long we keep it and how to reach us. Run a business listed on Aestheva? Also read <a href="/policies/data-protection">data protection for businesses</a>.</p>

    <h2>Who is responsible</h2>
    <p><b>Aestheva</b> is responsible for the personal data you give us to find, book, pay for and manage an appointment, and for the data businesses give us to list on Aestheva. In the words of the Digital Personal Data Protection Act, 2023, we are the “data fiduciary” for that data.</p>
    <p><b>The business you book</b> receives your booking details so it can look after you. From then on it is responsible, separately and in its own right, for how it uses them, and for any records it makes about you: consultation notes, treatment records, prescriptions, consent forms and photos. Those records are kept by the business under its own policies and its professional rules. They are not kept on Aestheva and Aestheva does not control them. Ask the business directly about them.</p>

    <h2>What we collect</h2>
    ${table(["When", "What we keep"], [
      ["You book", "Your name, mobile number and email; the service, time, person and business you chose; any note you add; your booking reference."],
      ["You pay a deposit or get a refund", "Razorpay's order and payment references, the amount, the method (for example UPI) and the refund status. Never your card number, UPI PIN or bank login: those go straight to Razorpay."],
      ["You cancel or ask for a refund review", "The reason you give, if any."],
      ["You join a waiting list", "Your email address and the city you're waiting for."],
      ["You apply to list a business", "Your business and contact details, the services you describe and any registration numbers you share. To stop automated spam we keep a scrambled code made from your network address, never the address itself, for up to 7 days."],
      ["A business sets up and uses its portal", "Each login's name and email and a scrambled form of the password; the business's listing, team profiles, photos and hours; verification documents."],
      ["You browse", "No advertising or analytics trackers. See cookies below. Our hosting provider processes standard technical data, such as IP address and browser type, to deliver the site and protect it from attacks."],
    ])}

    <h2>What we don't collect</h2>
    <p>We don't ask for your medical history, diagnoses, photos of your skin, or ID documents such as Aadhaar. Please don't put health details in the booking note: your practitioner will discuss them with you in person and record them in their own records, not on Aestheva.</p>

    <h2>Why we use it</h2>
    <ul>
      <li>To make, confirm, change and cancel your booking, and send you emails about it.</li>
      <li>To take deposits, make refunds and settle disputes.</li>
      <li>To keep Aestheva secure and prevent fraud and misuse.</li>
      <li>To meet our legal duties, such as accounting and tax records, and lawful requests from authorities.</li>
      <li>To improve Aestheva, using counts and totals, not individual profiles.</li>
    </ul>
    <p>We use your data because you give it to us to make a booking (your consent), and for the other uses the law allows, such as meeting legal duties. We don't send marketing unless you ask for it, as with a waiting list, and every such email lets you stop it. <b>We don't sell or rent personal data, and we don't share it with advertisers.</b></p>

    <h2>Who we share it with</h2>
    ${table(["Who", "What and why"], [
      ["The business you book", "Your name, mobile number, email, appointment and note, so it can provide the service and contact you about it."],
      ["Razorpay Software Private Limited", "Payment and refund details, to process deposits and refunds. Razorpay handles payment data under its own privacy policy and the Reserve Bank of India's rules."],
      ["Cloudflare, Inc.", "Hosts the website, database and files and sends our emails, acting only on our instructions."],
      ["Google (fonts)", "Your browser downloads the site's fonts from Google, which receives your IP address with that request. No other data."],
      ["Authorities", "Only when the law requires us to, for example a court order."],
    ])}
    <p>Links you choose to open, such as WhatsApp, Google Maps or Google Calendar, take you to those services under their own terms. If Aestheva is ever sold or merged, personal data would move with it under the same promises.</p>

    <h2>Where it is stored</h2>
    <p>On Cloudflare's network. Our database is currently stored in Cloudflare's Asia-Pacific region, which may be outside India. Indian law allows this, except to countries the Government of India restricts, and we will follow any such restriction. Payment data is held by Razorpay in India.</p>

    <h2>How long we keep it</h2>
    ${table(["Data", "How long"], [
      ["Bookings, payments and refunds, with the name and contact details on them", "8 years after the booking, as accounting and tax law requires"],
      ["Waiting-list emails", "Until we open in that city or you ask us to remove you"],
      ["Applications that don't go ahead", "2 years, then deleted"],
      ["The anti-spam code from an application", "Up to 7 days"],
      ["Portal logins", "While the business is listed; closed within 30 days of it leaving"],
      ["Verification documents", "While the business is listed, then 3 years in case of a dispute, then deleted"],
      ["Private booking and password links", "Stored only in scrambled form. Password links stop working after one use or a short time"],
    ])}
    <p>When a period ends we delete the data or make it anonymous, unless the law requires us to keep it longer.</p>

    <h2>How we protect it</h2>
    <ul>
      <li>The whole site uses encrypted connections (HTTPS).</li>
      <li>Private booking links and password links are stored only as one-way scrambled codes (hashes), so even our database doesn't hold the links themselves.</li>
      <li>Portal passwords are stored with PBKDF2 hashing (100,000 rounds), never as text. Sign-in sessions use signed cookies that page scripts can't read.</li>
      <li>Each business can see only its own bookings and clients.</li>
      <li>Verification documents are stored privately and only the Aestheva team can open them.</li>
      <li>Card, UPI and bank details never reach our servers.</li>
      <li>Changes to bookings, payments and listings are recorded in an audit log.</li>
    </ul>
    <p>No system is perfectly secure. If a breach affects your personal data, we will tell you and the authorities as the law requires.</p>

    <h2>Your rights</h2>
    <p>You can ask us to:</p>
    <ul>
      <li>tell you what personal data we hold about you and who we have shared it with;</li>
      <li>correct or update it;</li>
      <li>erase it, except what the law requires us to keep, such as payment records;</li>
      <li>stop using it where we rely on your consent (we may then be unable to keep a booking);</li>
      <li>let someone you name act for you if you die or can't act yourself.</li>
    </ul>
    <p>Email us from the address you booked with, and include your booking reference if you have one. We may ask you to confirm it's you. For records a business keeps about you, such as treatment notes, ask the business directly. If you'd like, we'll pass your request on.</p>

    <h2>Children</h2>
    <p>Aestheva is for adults. A parent or guardian can book for a child under 18 and is responsible for that booking. We don't knowingly collect personal data directly from children.</p>

    <h2 id="cookies">Cookies</h2>
    ${table(["Name", "What it does", "How long"], [
      ["ae_via", "Remembers the business whose own link you arrived through, so that booking carries no commission for it", "30 days"],
      ["ae_clinic", "Keeps a business user signed in to the portal", "12 hours"],
      ["ae_ops", "Keeps an Aestheva team member signed in", "12 hours"],
      ["ae-join-pop (your browser's storage)", "Remembers when you closed the “List your business” message, so it isn't shown again for 14 days", "Until you clear it"],
    ])}
    <p>No advertising or analytics cookies. When you pay, Razorpay's checkout may set its own cookies.</p>

    <h2>Contact and complaints</h2>
    ${grievance()}

    <h2>Changes</h2>
    <p>We'll update this page and its date when our practices change, and tell listed businesses by email about important changes.</p>
  </div>`;
}

export function dataProtectionPage() {
  const q = (title: string, body: string) => `<details class="card"><summary><b>${title}</b></summary><div class="mt8">${body}</div></details>`;
  return `<div class="page narrow prose">
    <div class="eyebrow">Policies · For businesses</div><h1 class="mt8" style="font-size:44px">Data protection for businesses</h1>${updated()}${DRAFT}
    <p class="lede mt16">What Aestheva does with your data and your clients' data, what your business is responsible for, and plain answers to the questions businesses ask us. These terms form part of your agreement to list on Aestheva, alongside the <a href="/policies/terms">terms of use</a>. How we handle clients' data is set out in our <a href="/policies/privacy">privacy notice</a>.</p>

    <h2>Who is responsible for what</h2>
    ${table(["Data", "Responsible", "Notes"], [
      ["Bookings made on Aestheva: client name, contact details, appointment, note, deposit", "Aestheva <b>and</b> your business, each separately", "Aestheva for running the booking. Your business for how it uses the details once it has them."],
      ["Consultation notes, treatment records, prescriptions, consent forms, clinical photos", "<b>Your business only</b>", "Keep these in your own records, never on Aestheva. Aestheva has no place for them and doesn't receive them."],
      ["Anything you copy outside Aestheva: phone contacts, WhatsApp chats, your own software, paper files", "<b>Your business only</b>", ""],
      ["Your team's names, photos, qualifications and registration numbers on your page", "Your business, which confirms each person has agreed. Aestheva publishes them", "Tell us if someone leaves or withdraws permission and we'll remove them."],
      ["Who has a portal login at your business", "Your business", "Ask us to add or remove logins. One login per person."],
      ["Verification documents you upload", "Aestheva", "Used only to check your listing. Seen only by the Aestheva team, never by clients."],
      ["Deposits and refunds", "Aestheva and Razorpay", "Card, UPI and bank details never reach Aestheva."],
    ])}

    <h2>What Aestheva does</h2>
    <ul>
      <li>Uses your clients' details only to run their bookings with you: confirmations, changes, cancellations, deposits and refunds.</li>
      <li>Never sells them, and never uses them to advertise other businesses to your clients.</li>
      <li>Shows each business only its own bookings and clients. Other businesses can never see yours.</li>
      <li>Protects data as described in our <a href="/policies/privacy">privacy notice</a>: encrypted connections, scrambled links and passwords, private document storage and an audit log.</li>
      <li>Uses only these service providers for your data: Cloudflare (hosting, database, files and email) and Razorpay (payments).</li>
      <li>Tells you without undue delay, and normally within 72 hours of finding out, if a data breach affects your business or your clients. We also tell clients and the authorities as the law requires.</li>
      <li>If you leave Aestheva, on request sends you a copy of your bookings and client list within 30 days, closes your logins and removes your listing. We keep booking and payment records for 8 years, as the law requires. Verification documents are deleted 3 years after you leave, unless they're needed for a dispute.</li>
    </ul>

    <h2>What your business agrees to</h2>
    <ol>
      <li><b>Use client details only for their care.</b> Use what you receive through Aestheva only to provide and manage the client's appointment, keep the records your profession requires and contact them about their care. Don't use it for unrelated marketing unless the client agrees separately.</li>
      <li><b>Follow the law and your professional rules.</b> You are responsible for your own compliance with data protection law, including the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000 and its rules, with the confidentiality rules of your professional council, and with any record-keeping rules for your profession.</li>
      <li><b>Keep health information off Aestheva.</b> Don't put diagnoses, treatment details or other health information in booking notes, block reasons or anything else on the portal.</li>
      <li><b>Photos need written consent.</b> Never upload a photo of a client to Aestheva without their written consent.</li>
      <li><b>Your team agrees to their profile.</b> Get each person's permission before adding their name, photo, qualifications or registration number to your page.</li>
      <li><b>Keep logins secure.</b> One login per person. Never share passwords, and ask us to remove a login as soon as someone leaves.</li>
      <li><b>Tell us quickly.</b> Tell us within 24 hours if you suspect a login has been misused or client data from Aestheva has been exposed.</li>
      <li><b>Answer requests about your own records.</b> Respond to clients' requests about records you hold yourself, and pass on to us any request about their Aestheva data.</li>
    </ol>

    <h2 id="responsibility">Responsibility and liability</h2>
    <ul>
      <li>Your business is solely responsible for personal data once it has received it through Aestheva, for the records it creates and for what its team does with them.</li>
      <li>Aestheva is not responsible for how your business collects, stores, uses or shares personal data outside the Aestheva platform, or for clinical or treatment records in any form.</li>
      <li>Your business will indemnify ${esc(COMPANY.legalName)} against claims, penalties, losses and reasonable costs that arise from its breach of these terms or of data protection law, or from the acts of its team.</li>
      <li>To the extent the law allows, Aestheva's total liability to your business for anything to do with personal data is limited to the commission your business paid Aestheva in the 12 months before the claim. Neither side is liable for indirect or consequential loss. Nothing here limits liability that the law does not allow to be limited, such as for fraud.</li>
    </ul>

    <h2>Questions businesses ask</h2>
    <div class="faq mt16">
      ${q("Who owns the client list?", "<p>Personal data isn't owned like property: clients keep their rights over it. Your business may use the details of clients who booked you to look after them and keep your records. Aestheva uses them to run bookings. Neither of us may sell them.</p>")}
      ${q("Can Aestheva see our patient records or clinical notes?", "<p>No. Aestheva has no place for them and doesn't receive them. A small Aestheva team can see booking details (name, contact details, service, time and note) to support bookings, payments and refunds. Changes are recorded in an audit log, and the team can't sign in as your business.</p>")}
      ${q("Can other businesses on Aestheva see our clients?", "<p>No. Each business sees only its own bookings and clients.</p>")}
      ${q("Will Aestheva contact our clients, or market other businesses to them?", "<p>We send booking emails: confirmations, changes and cancellations. We never send your clients offers from other businesses. If we add optional newsletters, clients will have to choose to receive them.</p>")}
      ${q("Where is the data stored?", "<p>On Cloudflare's network. Our database is currently in Cloudflare's Asia-Pacific region, which may be outside India. Indian law allows this except to countries the Government restricts. Payment data is held by Razorpay in India.</p>")}
      ${q("Is Aestheva compliant with the DPDP Act?", "<p>Most duties under the Digital Personal Data Protection Act, 2023 apply from 13 May 2027, under the DPDP Rules, 2025. Until then, the Information Technology Act, 2000 and its 2011 rules on sensitive personal data apply. Aestheva already follows the main principles: a clear notice, using data only for its purpose, collecting as little as possible, security safeguards, a Grievance Officer and breach notices. We're preparing for the remaining duties by May 2027.</p>")}
      ${q("Is health information treated differently?", "<p>Yes. Medical records and health information are “sensitive personal data” under the 2011 rules. That's why they stay in your own records and off Aestheva.</p>")}
      ${q("What happens if there's a data breach?", "<p>If a breach on Aestheva affects your business or clients, we tell you without undue delay, normally within 72 hours of finding out. We tell clients and the authorities as the law requires, and explain what we're doing about it. If a breach happens in your own systems, it's your business's responsibility, and please tell us within 24 hours if it involves data from Aestheva.</p>")}
      ${q("A client asked us to delete their data. What do we do?", "<p>For records you keep yourself, follow the law and your professional rules: medical records often have to be kept for a set period. For their Aestheva data, forward the request to us and we'll erase what the law lets us.</p>")}
      ${q("Can we get a copy of our bookings and clients?", "<p>Yes. Email us and we'll send a copy within 30 days. A download button in the portal is planned.</p>")}
      ${q("What happens to our data if we leave Aestheva?", "<p>We send you a copy if you ask, close your logins within 30 days and remove your listing. We keep booking and payment records for 8 years, as the law requires, and delete your verification documents 3 years after you leave, unless they're needed for a dispute.</p>")}
      ${q("Do we need our own privacy notice?", "<p>If you keep records about clients, as nearly every business does, yes: your clients should know how you handle the records you keep. Our notice covers only what happens on Aestheva.</p>")}
      ${q("Can we have a signed copy of these terms?", "<p>Yes. Email us and we'll send a copy to sign.</p>")}
    </div>

    <h2>Contact</h2>
    ${grievance()}
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
    ["clock", "Fill your quiet hours", "Set an amount off for the hours that are usually empty. Those times show in gold when clients book; busy times stay at the full price. You choose the services, the hours and the limit."],
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
    <div class="who-grid five mt24">${perks.map(([i, t, b]) => `<div>${ic(i, 22)}<b>${t}</b><p>${b}</p></div>`).join("")}</div></section>

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
