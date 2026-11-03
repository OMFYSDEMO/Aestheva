// Pages for Regional Partners: sign-in, their dashboard, statements, toolkit, terms and profile; and the public
// "Become a Regional Partner" page with its application form.
import { COMPANY, INCENTIVES, PARTNERS, POLICY } from "../config";
import type { PartnerBusiness } from "../services/partner-portal";
import { PARTNER_BACKGROUNDS, PARTNER_CITIES, PARTNER_TERMS_VERSION } from "../services/partner-portal";
import type { PartnerRow, PartnerStatementRow, Scorecard } from "../services/partners";
import { monthLabel } from "../services/statements";
import { freePeriod } from "../services/incentives";
import { scorecardCard } from "./partners";
import { esc, ic } from "./ui";

const inr = (p: number) => "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const logo = `<div class="logo"><span class="wm">aestheva</span><span class="logo-sub">partners</span></div>`;
const card = (inner: string) => `<div class="page narrow" style="max-width:480px;padding-top:56px"><div class="card">${logo}${inner}</div></div>`;

// ---------- sign-in ----------
export function partnerLoginPage(error = "", notice = "") {
  return card(`<h1 class="mt8" style="font-size:34px">Sign in</h1><p class="small muted mt8">For Aestheva Regional Partners. Your login comes from the Aestheva team.</p>
    ${notice ? `<div class="form-ok mt12" role="status">${esc(notice)}</div>` : ""}${error ? `<div class="form-error mt12" role="alert">${esc(error)}</div>` : ""}
    <form method="post" action="/partners/login" class="col mt16" style="gap:12px">
      <label class="f" for="pl-email">Email<input class="in" id="pl-email" name="email" type="email" autocomplete="username" required autofocus></label>
      <label class="f" for="pl-pw">Password<input class="in" id="pl-pw" name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn btn-p" type="submit">Sign in</button></form>
    <p class="small mt16"><a href="/partners/forgot">Forgot your password?</a></p>`);
}
export function partnerSetPasswordPage(d: { token: string; email: string; invite: boolean; error?: string }) {
  return card(`<h1 class="mt8" style="font-size:32px">${d.invite ? "Set your password" : "Choose a new password"}</h1>
    <p class="small muted mt8">For <b>${esc(d.email)}</b>. Use at least 10 characters; a short phrase only you would think of is easy to remember and hard to guess.</p>
    ${d.error ? `<div class="form-error mt12" role="alert">${esc(d.error)}</div>` : ""}
    <form method="post" action="/partners/set-password" class="col mt16" style="gap:12px"><input type="hidden" name="t" value="${esc(d.token)}">
      <input type="text" name="username" value="${esc(d.email)}" autocomplete="username" hidden>
      <label class="f" for="sp1">New password<input class="in" id="sp1" name="password" type="password" autocomplete="new-password" minlength="10" required></label>
      <label class="f" for="sp2">Type it again<input class="in" id="sp2" name="confirm" type="password" autocomplete="new-password" minlength="10" required></label>
      <button class="btn btn-p" type="submit">Save password</button></form>`);
}
export const partnerLinkInvalidPage = () => card(`<h1 class="mt8" style="font-size:30px">This link has expired</h1>
  <p class="small muted mt8">Set-password links work once, for a limited time. Ask for a new one below, or ask the Aestheva team to send a fresh invitation.</p>
  <div class="row wrap mt16" style="gap:8px"><a class="btn btn-p btn-s" href="/partners/forgot">Email me a new link</a><a class="btn btn-o btn-s" href="/partners/login">Sign in</a></div>`);
export function partnerForgotPage(sent = false) {
  return card(`<h1 class="mt8" style="font-size:30px">Forgot your password?</h1>
    ${sent ? `<div class="form-ok mt12" role="status">If that email has a partner login, we've sent it a link to choose a new password. It works for 1 hour.</div><p class="small mt16"><a href="/partners/login">Back to sign in</a></p>`
    : `<p class="small muted mt8">Enter your login email and we'll send you a link to choose a new password.</p>
      <form method="post" action="/partners/forgot" class="col mt16" style="gap:12px"><label class="f" for="pf">Email<input class="in" id="pf" name="email" type="email" autocomplete="username" required></label><button class="btn btn-p" type="submit">Send the link</button></form>
      <p class="small mt16"><a href="/partners/login">Back to sign in</a></p>`}`);
}

// ---------- the portal ----------
export type PartnerSection = "home" | "statements" | "toolkit" | "terms" | "profile";
const NAV: [PartnerSection, string, string][] = [["home", "/partners", "Dashboard"], ["statements", "/partners/statements", "Statements"], ["toolkit", "/partners/toolkit", "Toolkit"], ["terms", "/partners/terms", "Partner terms"], ["profile", "/partners/profile", "Your details"]];
export function partnerShell(d: { partner: PartnerRow; section: PartnerSection; csrf: string }, body: string) {
  return `<div class="page">
    <div class="row wrap between" style="gap:12px"><div><div class="eyebrow">Aestheva Regional Partner · ${esc(d.partner.region)}</div><div class="small muted">${esc(d.partner.name)} · code <b>${esc(d.partner.code)}</b></div></div>
      <form method="post" action="/partners/logout"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><button class="btn btn-g btn-s" type="submit">${ic("out", 15)} Sign out</button></form></div>
    <nav class="chips mt16 scroll-x" style="flex-wrap:nowrap" aria-label="Partner portal">${NAV.map(([k, href, label]) => `<a class="chip ${d.section === k ? "on" : ""}" href="${href}"${d.section === k ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
    <div class="mt24">${body}</div></div>`;
}

const STAGE_LABEL: Record<string, string> = { setup: "Setting up", review: "Being checked by Aestheva", live: "Live", paused: "Paused" };

export function partnerHomePage(d: {
  partner: PartnerRow; link: string; sc: Scorecard; month: string; businesses: PartnerBusiness[]; termsOk: boolean;
  earnedYear: number; paidYear: number; toPay: number; latest?: PartnerStatementRow;
}) {
  const first = d.partner.name.split(" ")[0];
  return `${d.termsOk ? "" : `<div class="note n-warn">${ic("alert", 16)}<div><b>Please read and accept the partner terms.</b> It takes a few minutes. <a href="/partners/terms">Open the terms</a></div></div>`}
    <h1 class="${d.termsOk ? "" : "mt16 "}" style="font-size:clamp(30px,4vw,40px)">Hello, ${esc(first)}</h1>
    <div class="grid g2 mt16" style="align-items:stretch">
      <div class="card"><div class="eyebrow">Your link</div><p class="mt8"><code style="word-break:break-all;font-size:15px">${esc(d.link)}</code></p>
        <p class="small muted mt8">Share it with salons, studios and clinics. It opens Aestheva's business pages with your code, which is filled in when they apply. They can also type your code: <b>${esc(d.partner.code)}</b>.</p>
        <a class="btn btn-o btn-s mt12" href="/partners/toolkit">Messages to send with it</a></div>
      <div class="card"><div class="eyebrow">Your earnings this financial year</div>
        <dl class="kv mt12"><dt>Earned</dt><dd><b>${inr(d.earnedYear)}</b></dd><dt>Paid to you</dt><dd>${inr(d.paidYear)}</dd><dt>Being paid</dt><dd>${d.toPay ? `<b>${inr(d.toPay)}</b>` : "Nothing waiting"}</dd></dl>
        <p class="xs muted mt8">${PARTNERS.shareBp / 100}% of the commission Aestheva receives from your businesses, plus ${inr(PARTNERS.bonusPaise)} when a new business has ${PARTNERS.bonusBookings} online bookings in its first ${PARTNERS.bonusDays} days. Statements arrive on the ${PARTNERS.issueDay}th.${d.latest ? ` Latest: <a href="/partners/statements/${esc(d.latest.id)}">${esc(d.latest.number)}</a>.` : ""}</p></div>
    </div>
    <div class="mt16">${scorecardCard(d.sc, d.month)}</div>
    <div class="card mt16"><h2 style="font-size:22px">Your businesses</h2>
      ${d.businesses.length ? `<div class="tbl-wrap mt12"><table class="tbl"><thead><tr><th>Business</th><th>Where they are</th><th>Still to do</th><th>Online bookings in ${esc(monthLabel(d.month))}</th></tr></thead><tbody>
        ${d.businesses.map((b) => `<tr><td><b>${esc(b.name)}</b><div class="xs muted">${esc(b.area)}</div></td>
          <td class="small">${esc(STAGE_LABEL[b.stage] ?? b.stage)}${b.liveSince ? `<div class="xs muted">since ${esc(b.liveSince)}</div>` : ""}<div class="xs muted">${b.done} of ${b.total} setup steps</div></td>
          <td class="small">${b.todo.length ? b.todo.map((t) => esc(t)).join("<br>") : '<span class="muted">Nothing</span>'}</td>
          <td>${b.bookingsMonth}${b.valueMonth ? `<div class="xs muted">${inr(b.valueMonth)}</div>` : ""}</td></tr>`).join("")}
      </tbody></table></div><p class="xs muted mt8">Help with anything under "Still to do": photos, services and prices, team hours, documents. Aestheva checks registrations and documents and decides when a listing goes live.</p>`
      : `<p class="small muted mt8">None yet. When a business applies with your link or code and Aestheva approves it, it appears here with its setup progress.</p>`}</div>`;
}

export function partnerStatementsPage(d: { statements: PartnerStatementRow[] }) {
  return `<h1 style="font-size:clamp(28px,4vw,36px)">Statements</h1>
    <p class="small muted mt8">One statement a month, made on the ${PARTNERS.issueDay}th for the month before and emailed to you. Payment goes to your bank account.</p>
    ${d.statements.length ? `<div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>Statement</th><th>Month</th><th>Earned</th><th>TDS</th><th>Paid to you</th><th>Status</th></tr></thead><tbody>
      ${d.statements.map((s) => `<tr><td><a href="/partners/statements/${esc(s.id)}"><b>${esc(s.number)}</b></a></td><td class="small">${esc(monthLabel(s.month))}</td><td>${inr(s.gross_paise)}</td><td>${s.tds_paise ? inr(s.tds_paise) : "—"}</td><td><b>${inr(s.net_paise)}</b></td><td><span class="badge ${s.status === "paid" ? "b-ok" : "b-blush"}">${s.status === "paid" ? `Paid ${esc(s.paid_on ?? "")}` : "Being paid"}</span></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="card mt16" style="text-align:center;padding:36px"><p class="muted">No statements yet. The first arrives on the ${PARTNERS.issueDay}th of the month after Aestheva receives commission from one of your businesses.</p></div>`}`;
}

export function partnerToolkitPage(d: { partner: PartnerRow; link: string; placesLeft: number }) {
  const p = d.partner, first = p.name.split(" ")[0];
  const founding = d.placesLeft ? ` As one of the first ${INCENTIVES.foundingPlaces} businesses you'd pay no commission for your first ${freePeriod()}, then ${INCENTIVES.foundingRateBp / 100}% until your first anniversary (${d.placesLeft} places left).` : "";
  const wa = `Hi, I'm ${first}, Aestheva's Regional Partner in ${p.region}. Aestheva (bookaestheva.com) lets clients find you, see your full prices and real free times, and book in about a minute. Listing is free, and bookings through your own Aestheva link never carry commission.${founding} Applying takes about five minutes, and I can help you set up: ${d.link}`;
  const ig = `Salons, studios and clinics in ${p.region}: get booked online with Aestheva. Full prices, real free times, your team by name. Free to list, and your own booking link is commission-free. Apply with my link: ${d.link}`;
  const box = (title: string, text: string) => `<div class="card"><b>${title}</b><textarea class="in mt8" rows="6" readonly onclick="this.select()">${esc(text)}</textarea><p class="xs muted mt8">Tap the text to select it, then copy.</p></div>`;
  const faqs: [string, string][] = [
    ["What does it cost?", `Listing is free. Aestheva charges ${POLICY.commissionBp / 100}% only on completed bookings clients make through Aestheva. Bookings through the business's own link, or ones it adds itself, carry none, and there's nothing to pay on cancellations or no-shows.${d.placesLeft ? ` Founding partners pay nothing for their first ${freePeriod()}, then ${INCENTIVES.foundingRateBp / 100}% to their first anniversary.` : ""}`],
    ["How do they get paid?", "Clients pay the business at the venue, as today. Aestheva sends one monthly statement with a GST invoice for its commission and a payment link."],
    ["Do they need a computer?", "No. The portal works in the browser on a phone: bookings, calendar, clients, payments and offers."],
    ["What about clinics and doctors?", "Medical care is listed factually: each doctor's or dentist's registration is checked and shown, and medical treatments are never sold as offers or discounts."],
    ["What does Aestheva check?", "For beauty and wellness: a training certificate or portfolio, and an ID or business proof. For medical care: council registration for each doctor or dentist and the clinic's registration. The Aestheva team does all checks."],
    ["Can they keep their phone and walk-in clients?", "Yes. They add those bookings to their calendar so the time is taken online too, with no commission."],
  ];
  const steps = ["Apply with your link (about five minutes).", "Once approved, they get an email to set a password and sign in at bookaestheva.com/clinic.",
    "Your business: address, phone, opening hours, a short introduction and their PAN.", "Photos: at least three, in good light, wide (hold the phone sideways). Only photos they have permission to share.",
    "Their team: each person with their own working hours.", "Services: every service with its price and how long it takes, and who does it.",
    "Documents: as listed above. They upload them in the portal; never collect or keep copies yourself.", "Read and accept the terms, then submit. Aestheva checks the listing within two working days.",
    "After going live: put their own Aestheva link on Instagram, WhatsApp and their Google Business Profile, and set quiet-hour offers for non-medical services."];
  return `<h1 style="font-size:clamp(28px,4vw,36px)">Toolkit</h1><p class="small muted mt8">Ready-to-send messages with your link, the short pitch, answers to the questions owners ask, and the steps to help a business go live.</p>
    <div class="grid g2 mt16" style="align-items:stretch">${box("WhatsApp message to a business owner", wa)}${box("Instagram post or story", ig)}</div>
    <div class="card mt16"><h2 style="font-size:22px">The pitch in 30 seconds</h2><ul class="ticks mt12">
      <li>${ic("check", 14)} <span>Clients in ${esc(p.region)} find them, see full prices and real free times, and book in a minute: fewer calls, fewer no-shows from vague arrangements.</span></li>
      <li>${ic("check", 14)} <span>Free to list. Commission only on completed Aestheva bookings; their own link is always commission-free.</span></li>
      <li>${ic("check", 14)} <span>Each person on their team by name, with their own hours, so nobody is double-booked.</span></li>
      <li>${ic("check", 14)} <span>A local partner (you) to help them set up and get the first bookings.</span></li></ul></div>
    <div class="card mt16"><h2 style="font-size:22px">What owners ask</h2><div class="faq mt12">${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div></div>
    <div class="card mt16"><h2 style="font-size:22px">Helping a business go live</h2><ol class="mt12" style="padding-left:20px;line-height:1.7">${steps.map((s) => `<li class="small">${esc(s)}</li>`).join("")}</ol></div>
    <div class="note n-plain mt16">${ic("shield", 16)}<div>Never collect money, passwords or documents, never promise bookings or rankings, and never offer discounts on medical care. See the <a href="/partners/terms">partner terms</a>.</div></div>`;
}

export function partnerTermsBody(p: Pick<PartnerRow, "region">) {
  const h = (t: string) => `<h2 class="mt24" style="font-size:20px">${t}</h2>`;
  return `<p class="small muted">Version ${PARTNER_TERMS_VERSION}. This summary is part of your signed Regional Partner agreement with ${esc(COMPANY.legalName)}; if the two differ, the signed agreement applies.</p>
    ${h("1. Your role")}<p>You introduce beauty, wellness and care businesses in ${esc(p.region)} to Aestheva, help them set up and get their first bookings, and stay in touch with them. You are an independent partner, not an employee or an agent of ${esc(COMPANY.legalName)}, and you can't sign, promise or agree anything on its behalf.</p>
    ${h("2. What you earn")}<ul class="mt8" style="padding-left:20px;line-height:1.7">
      <li>${PARTNERS.shareBp / 100}% of the commission Aestheva actually receives (excluding GST, after refunds) from each business credited to you, for ${PARTNERS.months} months from that business's go-live date.</li>
      <li>A one-off ${inr(PARTNERS.bonusPaise)} bonus for each new business that has ${PARTNERS.bonusBookings} completed online bookings within ${PARTNERS.bonusDays} days of going live.</li>
      <li>Nothing on bookings through a business's own link or bookings it adds itself (they carry no commission), on unpaid commission, or on a business you own, work for or are related to.</li>
      <li>A business is credited to you when it applies with your link or code and Aestheva approves it. Aestheva's team decides any dispute.</li></ul>
    ${h("3. Statements, payment and tax")}<p>A statement is made on the ${PARTNERS.issueDay}th of each month for the month before and paid to your bank account. Income-tax TDS on commission (2%, or 20% without a valid PAN) is deducted once your payments pass ₹20,000 in a financial year, by ${esc(COMPANY.legalName)} under TAN ${esc(COMPANY.tan)}, and appears in your Form 26AS. If you are GST-registered, GST is added and you invoice Aestheva for it.</p>
    ${h("4. Code of conduct")}<ol class="mt8" style="padding-left:20px;line-height:1.7">
      <li>Represent Aestheva honestly. No promises of bookings, rankings, results or exclusivity that Aestheva hasn't made in writing.</li>
      <li>No discounts, offers or promotions for medical consultations or treatments, and no before-and-after claims.</li>
      <li>Never collect money from businesses or clients, and never ask for passwords.</li>
      <li>Never copy or keep client data or businesses' documents. Uploads go straight into the business portal.</li>
      <li>Declare any interest in a business you bring.</li>
      <li>Use Aestheva's name, logo and wording only as provided.</li>
      <li>Follow Aestheva's privacy notice and data protection terms.</li></ol>
    ${h("5. Territory, targets and term")}<p>Your region is ${esc(p.region)}. It stays exclusive to you for the next 6 months if you have 10 businesses live with ${PARTNERS.bonusBookings} bookings each by day 90 and 25 by day 180; otherwise it can be shared. The agreement runs for 12 months and can be renewed; either side can end it with 30 days' notice. After an ordinary ending, your share continues for ${PARTNERS.tailMonths} months on businesses already credited to you. A breach of the code of conduct ends the agreement and your share on the business involved, and further shares stop.</p>
    ${h("6. Your information")}<p>Aestheva keeps your name, contact details, PAN, GSTIN and bank details to pay you and to meet tax law, sees them only within its team, and keeps payment records for 8 years as accounting law requires.</p>`;
}

export function partnerTermsPage(d: { partner: PartnerRow; accepted: boolean; acceptedAt?: string | null; csrf: string }) {
  return `<h1 style="font-size:clamp(28px,4vw,36px)">Partner terms</h1>
    <div class="card mt16" style="max-width:820px">${partnerTermsBody(d.partner)}</div>
    ${d.accepted ? `<div class="form-ok mt16" role="status">You accepted these terms on ${esc((d.acceptedAt ?? "").slice(0, 10))}.</div>`
    : `<form class="card mt16" method="post" action="/partners/terms" style="max-width:820px"><input type="hidden" name="csrf" value="${esc(d.csrf)}">
      <label class="row" style="gap:10px;align-items:flex-start"><input type="checkbox" name="agree" value="yes" required style="margin-top:4px"><span class="small">I have read these terms and accept them as part of my Regional Partner agreement.</span></label>
      <button class="btn btn-p btn-s mt12" type="submit">Accept the terms</button></form>`}`;
}

export function partnerProfilePage(d: { partner: PartnerRow }) {
  const p = d.partner;
  return `<h1 style="font-size:clamp(28px,4vw,36px)">Your details</h1>
    <div class="card mt16" style="max-width:640px"><dl class="kv"><dt>Name</dt><dd>${esc(p.name)}</dd><dt>Region</dt><dd>${esc(p.region)}</dd><dt>Code</dt><dd>${esc(p.code)}</dd>
      <dt>Email</dt><dd>${esc(p.email)}</dd><dt>Mobile</dt><dd>${esc(p.phone || "—")}</dd><dt>PAN</dt><dd>${p.pan ? esc(p.pan) : '<span class="f-err">Not given: 20% TDS applies until you add it</span>'}</dd>
      <dt>GSTIN</dt><dd>${p.gstin ? esc(p.gstin) : "Not registered"}</dd><dt>Bank account</dt><dd>${p.bank_account ? `${esc(p.bank_name)} · •••• ${esc(p.bank_account.slice(-4))} · ${esc(p.bank_ifsc)}` : '<span class="f-err">Not given yet</span>'}</dd>
      <dt>Agreement</dt><dd>${p.agreement_date ? `Signed ${esc(p.agreement_date)}` : "—"}</dd></dl>
      <p class="small muted mt16">To change any of these, email <a href="mailto:${esc(COMPANY.supportEmail)}?subject=${encodeURIComponent(`Partner details: ${p.code}`)}">${esc(COMPANY.supportEmail)}</a> from your login email. For your safety, bank details are changed only by the Aestheva team, after a check with you by phone.</p></div>`;
}

// ---------- public: become a partner ----------
type Form = Record<string, string | string[]>;
const val = (v: Form, k: string) => esc(String(Array.isArray(v[k]) ? v[k][0] : v[k] ?? ""));

export function becomePartnerPage(d: { values: Form; errors: Record<string, string>; started: number }) {
  const e = d.errors, v = d.values;
  const err = (k: string) => (e[k] ? `<span class="f-err" id="err-${k}">${esc(e[k])}</span>` : "");
  const inv = (k: string) => (e[k] ? ` aria-invalid="true" aria-describedby="err-${k}"` : "");
  const input = (k: string, label: string, attrs = "", hint = "") => `<label class="f" for="bp-${k}">${label}${hint ? ` <span class="hint">${hint}</span>` : ""}<input class="in" id="bp-${k}" name="${k}" value="${val(v, k)}" ${attrs}${inv(k)}>${err(k)}</label>`;
  const select = (k: string, label: string, opts: readonly string[]) => `<label class="f" for="bp-${k}">${label}<select class="in" id="bp-${k}" name="${k}" required${inv(k)}><option value="">Choose one</option>${opts.map((o) => `<option ${val(v, k) === esc(o) ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>${err(k)}</label>`;
  const n = Object.keys(e).length;
  return `<div class="page story" style="padding-top:0">
  <section class="story-hero">
    <div><div class="eyebrow">Regional Partners · Kochi, Thrissur and Kozhikode</div>
      <h1 class="mt12">Know the best salons and clinics in your city? Bring them to Aestheva.</h1>
      <p class="lede mt16">Aestheva's Regional Partners introduce beauty, wellness and care businesses in their city, help them get set up and get their first bookings, and earn from every business they bring.</p>
      <div class="story-cta mt24"><a class="btn btn-p" href="#apply">Apply to be a partner</a></div></div>
    <aside class="story-facts" aria-label="The partnership at a glance">
      <div><b>You earn</b><span>${PARTNERS.shareBp / 100}% of the commission Aestheva receives from each business you bring, for ${PARTNERS.months} months</span></div>
      <div><b>Bonus</b><span>${inr(PARTNERS.bonusPaise)} for each new business with ${PARTNERS.bonusBookings} online bookings in its first ${PARTNERS.bonusDays} days</span></div>
      <div><b>Paid</b><span>Monthly, to your bank account, with a statement</span></div>
      <div><b>Run by</b><span>${esc(COMPANY.legalName)}</span></div></aside>
  </section>
  <section class="mt64 story-two">
    <div><div class="eyebrow">What partners do</div><h2 class="mt8">Local relationships, real bookings</h2>
      <ul class="ticks mt16"><li>${ic("check", 14)} <span>Introduce salons, studios, clinics and independent professionals in your city.</span></li>
        <li>${ic("check", 14)} <span>Help them through setup: photos, services and prices, team hours.</span></li>
        <li>${ic("check", 14)} <span>Get them to their first bookings, and stay their friendly local contact.</span></li>
        <li>${ic("check", 14)} <span>Aestheva's team does every check, handles all money and decides when a listing goes live.</span></li></ul></div>
    <div><div class="eyebrow">Who we're looking for</div><h2 class="mt8">People the trade already trusts</h2>
      <p class="mt16">Former salon or spa managers, beauty academy trainers, makeup artists and wedding planners with wide networks, and cosmetics or pharma sales people who already visit salons and clinics. Malayalam and English, comfortable on a phone.</p>
      <p class="mt12">You get your own link and code, a portal showing your businesses, earnings and statements, a toolkit of messages, and a day's training.</p></div>
  </section>
  <section class="mt64" id="apply"><div class="card" style="max-width:760px">
    <div class="eyebrow">Apply</div><h2 class="mt8">Tell us about yourself</h2><p class="small muted mt8">About five minutes. We'll call you to talk it through.</p>
    ${n ? `<div class="form-error mt12" role="alert" id="apply-errors" tabindex="-1">Please check ${n} answer${n === 1 ? "" : "s"} below.</div>` : ""}
    <form class="col mt16" style="gap:14px" method="post" action="/become-a-partner#apply" novalidate>
      <input type="hidden" name="t" value="${d.started}"><div class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="grid g2">${input("name", "Full name", 'required maxlength="80" autocomplete="name"')}${input("phone", "Mobile number", 'required type="tel" inputmode="tel" autocomplete="tel" placeholder="98765 43210"')}</div>
      <div class="grid g2">${input("email", "Email", 'required type="email" autocomplete="email" maxlength="120"')}${select("city", "Your city", PARTNER_CITIES)}</div>
      ${input("city_other", "If you chose Other, which city?", 'maxlength="60"')}
      ${select("background", "What describes you best?", PARTNER_BACKGROUNDS)}
      <label class="f" for="bp-network">Who do you know? <span class="hint">The salons, studios and clinics you know and how, in a few sentences</span><textarea class="in" id="bp-network" name="network" rows="4" maxlength="1500" required${inv("network")}>${val(v, "network")}</textarea>${err("network")}</label>
      <div class="grid g2">${input("businesses_90", "How many could you bring live in 90 days?", 'required type="number" min="0" max="500" inputmode="numeric" style="max-width:160px"')}${input("online", "LinkedIn or Instagram", 'maxlength="200"', "Optional")}</div>
      <label class="row" style="gap:10px;align-items:flex-start"><input type="checkbox" name="consent" value="yes" ${val(v, "consent") === "yes" ? "checked" : ""} style="margin-top:4px"><span class="small">Aestheva may contact me about this application. How we use your details: <a href="/policies/privacy">privacy notice</a>.</span></label>${err("consent")}
      <div><button class="btn btn-p" type="submit">Send application</button></div></form></div></section>
  </div>`;
}

export function becomePartnerThanks(ref: string, name: string) {
  return `<div class="page narrow" style="max-width:620px;padding-top:56px"><div class="card"><div class="eyebrow">Application received · ${esc(ref)}</div>
    <h1 class="mt8" style="font-size:34px">Thank you${name ? `, ${esc(name.split(" ")[0])}` : ""}</h1>
    <p class="mt12">We'll call you within a few working days to talk about your city and how the partnership works. Keep your reference, ${esc(ref)}, in case you need to write to us.</p>
    <p class="small muted mt12">Questions meanwhile: <a href="mailto:${esc(COMPANY.supportEmail)}">${esc(COMPANY.supportEmail)}</a>.</p></div></div>`;
}
