import { AREAS, COMPANY, VENUE_TYPES, VENUE_TYPE_CHOICES } from "../config";
import { ROLES, type ApplicationForm } from "../services/applications";
import { catTile, esc, ic } from "./ui";

const val = (v: ApplicationForm, k: string) => esc(Array.isArray(v[k]) ? v[k][0] : v[k] ?? "");
const has = (v: ApplicationForm, k: string, x: string) => (Array.isArray(v[k]) ? v[k] : [v[k]]).includes(x);

/** The application form. Works without JavaScript; answers are kept when something needs fixing. */
export function applyPage(d: { values: ApplicationForm; errors: Record<string, string>; categories: { id: string; name: string }[]; started: number }) {
  const { values: v, errors: e } = d;
  const err = (k: string) => e[k] ? `<span class="f-err" id="err-${k}">${esc(e[k])}</span>` : "";
  const inv = (k: string) => e[k] ? ` aria-invalid="true" aria-describedby="err-${k}"` : "";
  const input = (k: string, label: string, attrs = "", hint = "") =>
    `<label class="f" for="f-${k}">${label}${hint ? ` <span class="hint">${hint}</span>` : ""}<input class="in" id="f-${k}" name="${k}" value="${val(v, k)}"${inv(k)} ${attrs}>${err(k)}</label>`;
  const select = (k: string, label: string, opts: readonly string[], placeholder: string) =>
    `<label class="f" for="f-${k}">${label}<select class="in" id="f-${k}" name="${k}"${inv(k)} required><option value="">${placeholder}</option>${opts.map((o) => `<option ${val(v, k) === esc(o) ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>${err(k)}</label>`;
  const labels: Record<string, string> = { business_name: "Business name", business_type: "Kind of business", area: "Area", area_other: "Area", address: "Address", website: "Website", contact_name: "Your name", contact_role: "Your role", phone: "Mobile number", email: "Email", categories: "Services", medical: "Medical services", team_size: "People taking bookings", services_text: "Main services", establishment_reg: "Establishment registration", practitioner_reg: "Practitioner registration", gstin: "GSTIN", heard_from: "How you heard", consent: "Confirmation" };
  const summary = Object.keys(e).length ? `<div class="form-error" role="alert" tabindex="-1" id="apply-errors"><b>Please check ${Object.keys(e).length === 1 ? "one answer" : `${Object.keys(e).length} answers`}:</b><ul>${Object.keys(e).map((k) => `<li><a href="#${k === "categories" || k === "medical" || k === "consent" ? k : "f-" + k}">${labels[k] ?? k}</a>: ${esc(e[k])}</li>`).join("")}</ul></div>` : "";
  return `<div class="page">
    <a class="btn btn-g btn-s" href="/for-practitioners" style="margin-left:-10px">${ic("chevL", 16)} List your business</a>
    <div class="apply-layout mt16">
      <div>
        <div class="eyebrow" style="color:var(--sage-d)">Apply to join</div>
        <h1 class="mt8" style="font-size:clamp(34px,4.6vw,48px)">Tell us about you and your work</h1>
        <p class="lede mt12">Salon, studio, clinic or independent professional, you're welcome. It takes about five minutes. We'll review it and get in touch, usually by phone, to talk through the next steps. You don't need any documents yet.</p>
        ${summary ? `<div class="mt24">${summary}</div>` : ""}
        <form class="apply-form mt24" method="post" action="/for-practitioners/apply" novalidate>
          <input type="hidden" name="t" value="${d.started}">
          <div class="hp" aria-hidden="true"><label>Leave this empty<input name="company_website" tabindex="-1" autocomplete="off"></label></div>

          <fieldset class="apply-sec"><legend><span>1</span> Your business</legend>
            ${input("business_name", "Business name", 'required maxlength="120" autocomplete="organization"', "As clients know it. Working on your own? Your own name is fine.")}
            <div class="grid g2"><label class="f" for="f-business_type">Kind of business<select class="in" id="f-business_type" name="business_type"${inv("business_type")} required><option value="">Choose one</option>${VENUE_TYPES.map((o) => `<option value="${esc(o)}" ${val(v, "business_type") === esc(o) ? "selected" : ""}>${esc(VENUE_TYPE_CHOICES[o] ?? o)}</option>`).join("")}</select>${err("business_type")}</label>${select("area", "Area", [...AREAS, "Other"], "Choose an area")}</div>
            ${input("area_other", "If you chose Other, which area?", 'maxlength="60"')}
            <label class="f" for="f-address">Full address <span class="hint">Where clients come to you, with the PIN code</span><textarea class="in" id="f-address" name="address" rows="2" maxlength="300" required${inv("address")}>${val(v, "address")}</textarea>${err("address")}</label>
            ${input("website", "Website or Instagram", 'maxlength="200" inputmode="url"', "Optional")}
          </fieldset>

          <fieldset class="apply-sec"><legend><span>2</span> What you offer</legend>
            <div class="f" id="categories"><span>Kinds of service <span class="hint">Choose all that apply</span></span>
              <div class="pick mt8">${d.categories.map((c) => `<label class="pick-item"><input type="checkbox" name="categories" value="${esc(c.id)}" ${has(v, "categories", c.id) ? "checked" : ""}> ${catTile(c.id, 14)} ${esc(c.name)}</label>`).join("")}</div>${err("categories")}</div>
            <div class="f" id="medical"><span>Do you offer medical treatments? <span class="hint">Only treatments given by a doctor or dentist, for example dental work, medical lasers, medical peels or injectables. Beauty, nails, makeup, tattoos and massage are not medical.</span></span>
              <div class="row wrap mt8" style="gap:10px"><label class="pick-item"><input type="radio" name="medical" value="yes" ${val(v, "medical") === "yes" ? "checked" : ""}> Yes</label><label class="pick-item"><input type="radio" name="medical" value="no" ${val(v, "medical") === "no" ? "checked" : ""}> No, beauty, wellness or body art</label></div>${err("medical")}</div>
            ${input("team_size", "How many people would take bookings, including you?", 'type="number" min="1" max="500" inputmode="numeric" required style="max-width:160px"')}
            <label class="f" for="f-services_text">Your main services, with prices <span class="hint">One per line is fine, for example "Gel nail art, 60 min, ₹1,200" or "Scaling, 20 min, ₹2,000"</span><textarea class="in" id="f-services_text" name="services_text" rows="5" maxlength="2000" required${inv("services_text")}>${val(v, "services_text")}</textarea>${err("services_text")}</label>
          </fieldset>

          <fieldset class="apply-sec"><legend><span>3</span> Registrations, if you have them</legend>
            <p class="small muted">Optional now, and only what applies to you. Most beauty, wellness and body-art professionals can leave this blank.</p>
            ${input("establishment_reg", "Clinical establishment registration number", 'maxlength="80"', "Only for clinics offering medical services")}
            ${input("practitioner_reg", "Doctor's or dentist's council registration", 'maxlength="120"', 'For example "Kerala State Dental Council, Reg. No. 12345"')}
            ${input("gstin", "GSTIN", 'maxlength="15" autocapitalize="characters" style="max-width:260px"', "If registered")}
          </fieldset>

          <fieldset class="apply-sec"><legend><span>4</span> About you</legend>
            <div class="grid g2">${input("contact_name", "Your name", 'required maxlength="80" autocomplete="name"')}${select("contact_role", "Your role", ROLES, "Choose one")}</div>
            <div class="grid g2">${input("phone", "Mobile number", 'required type="tel" inputmode="tel" autocomplete="tel" placeholder="98765 43210"')}${input("email", "Email", 'required type="email" autocomplete="email"')}</div>
            ${input("heard_from", "How did you hear about Aestheva?", 'maxlength="120"', "Optional")}
          </fieldset>

          <div class="apply-sec" id="consent">
            <label class="check consent"><input type="checkbox" name="consent" value="yes" ${val(v, "consent") === "yes" ? "checked" : ""}> <span>I'm authorised to apply for this business, and Aestheva may contact me about this application. The details are handled as described in the <a href="/policies/privacy" target="_blank" rel="noopener">privacy policy</a>.</span></label>${err("consent")}
            <button class="btn btn-p mt16" type="submit" style="padding:14px 28px">Send application</button>
          </div>
        </form>
      </div>
      <aside class="sticky col" style="gap:16px">
        <div class="card"><div class="eyebrow">What happens next</div>
          <ol class="next-steps mt12"><li><b>We read it</b><span>and call you to talk it through.</span></li><li><b>Verification</b><span>We check what applies to you: registrations for medical care, certificates for beauty and wellness, and business identity.</span></li><li><b>Payouts</b><span>A short KYC with Razorpay so deposits reach your bank.</span></li><li><b>Go live</b><span>Your profile, prices and real availability appear on Aestheva.</span></li></ol></div>
        <div class="card"><b>Questions first?</b><p class="small muted mt8">Email <a href="mailto:${esc(COMPANY.supportEmail)}">${esc(COMPANY.supportEmail)}</a>${COMPANY.supportPhone ? ` or call <a href="tel:${esc(COMPANY.supportPhone.replace(/\s/g, ""))}">${esc(COMPANY.supportPhone)}</a>` : ""}.</p></div>
      </aside>
    </div>
  </div>`;
}

export function applyThanksPage(ref: string, name: string) {
  return `<div class="page narrow" style="text-align:center;padding-top:56px">
    <div class="seal">${ic("check", 40)}</div>
    <div class="eyebrow">Application received · ${esc(ref)}</div>
    <h1 class="mt12" style="font-size:clamp(34px,5vw,48px)">Thank you${name ? `, ${esc(name.split(/\s+/)[0])}` : ""}.</h1>
    <p class="lede mt12" style="margin-left:auto;margin-right:auto">We'll read your application and get in touch to talk through the next steps. Keep your reference, <b>${esc(ref)}</b>, in case you need to contact us about it.</p>
    <div class="row wrap mt24" style="justify-content:center"><a class="btn btn-o" href="/about">Read our story</a><a class="btn btn-p" href="/">Back to Aestheva</a></div>
  </div>`;
}
