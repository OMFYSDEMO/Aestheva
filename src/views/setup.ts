// The clinic's "Set up your listing" pages. Plain HTML forms; photos use public/setup.js to resize in the browser.
import { AREAS, COMPANY, INCENTIVES, POLICY, VENUE_TYPES, VENUE_TYPE_CHOICES } from "../config";
import { fmtTime } from "../domain/time";
import type { ProviderRow, ServiceRow, StaffRow } from "../services/catalog";
import { AMENITY_IDEAS, DAY_NAMES, DAY_ORDER, DOC_KINDS, DURATIONS, LANGS, MAX_PHOTOS, type Errors, type Step } from "../services/onboarding";
import { catIcon, esc, ic, inr, photoImg, photosOf } from "./ui";

type V = Record<string, unknown>;
const val = (v: V, k: string) => esc(Array.isArray(v[k]) ? (v[k] as unknown[])[0] : v[k] ?? "");
const has = (v: V, k: string, x: string) => (Array.isArray(v[k]) ? (v[k] as unknown[]) : [v[k]]).map(String).includes(x);
const errOf = (e: Errors, k: string) => e[k] ? `<span class="f-err" id="err-${k}">${esc(e[k])}</span>` : "";
const inv = (e: Errors, k: string) => e[k] ? ` aria-invalid="true" aria-describedby="err-${k}"` : "";
const summary = (e: Errors) => Object.keys(e).length ? `<div class="form-error mt16" role="alert" tabindex="-1" id="apply-errors"><b>Please check ${Object.keys(e).length === 1 ? "one answer" : `${Object.keys(e).length} answers`}.</b> They're marked below.</div>` : "";
const tips = (title: string, items: string[]) => `<aside class="card tips"><b>${title}</b><ul>${items.map((t) => `<li>${t}</li>`).join("")}</ul></aside>`;
const back = `<a class="btn btn-g btn-s" href="/clinic/setup" style="margin-left:-10px">${ic("chevL", 16)} Your listing</a>`;
const timeOpts = (sel: number, from = 360, to = 1380) => Array.from({ length: (to - from) / 30 + 1 }, (_, i) => from + i * 30).map((m) => `<option value="${m}" ${m === sel ? "selected" : ""}>${fmtTime(m)}</option>`).join("");
const saveBar = (label = "Save and continue") => `<div class="row wrap" style="gap:10px"><button class="btn btn-p" type="submit">${label}</button><a class="btn btn-o" href="/clinic/setup">Back to the checklist</a></div>`;

export function setupHome(d: { p: ProviderRow; stage: string; steps: Step[]; done: number; percent: number; complete: boolean; csrf: string; userName: string }) {
  const live = d.stage === "live";
  const banner = d.stage === "review" ? `<div class="note n-sage mt16">${ic("clock", 16)}<div><b>Submitted for review.</b> The Aestheva team is checking your listing and documents, usually within two working days. We'll email you when it's live or if anything needs changing. You can still make edits.</div></div>`
    : d.p.review_note ? `<div class="note n-warn mt16">${ic("alert", 16)}<div><b>A note from the Aestheva team:</b><p class="mt8" style="white-space:pre-wrap">${esc(d.p.review_note)}</p><p class="mt8">Make the changes, then submit again.</p></div></div>`
    : live && !d.complete ? `<div class="note n-warn mt16">${ic("alert", 16)}<div><b>Your listing is live, and ${d.steps.length - d.done} step${d.steps.length - d.done === 1 ? "" : "s"} still need${d.steps.length - d.done === 1 ? "s" : ""} finishing.</b> Clients can book you now. Please complete the steps marked below so we have everything on file. Changes you save appear on your public page straight away.</div></div>`
    : live ? `<div class="note n-sage mt16">${ic("check", 16)}<div><b>Your listing is live.</b> Changes you save here appear on your public page straight away.</div></div>`
    : d.stage === "paused" ? `<div class="note n-warn mt16">${ic("alert", 16)}<div><b>Your listing is paused</b> and hidden from clients. Write to ${esc(COMPANY.supportEmail)} to bring it back.</div></div>` : "";
  return `<div class="ws-head"><div><div class="eyebrow">${live ? "Your listing" : "Set up your listing"}</div><h2 class="mt8">${live ? esc(d.p.name) : `Welcome, ${esc(d.userName.split(" ")[0])}`}</h2></div>
      <a class="btn btn-o btn-s" href="/clinic/setup/preview">${ic("search", 15)} Preview your page</a></div>
    ${live ? "" : `<p class="lede" style="max-width:660px">Six short steps and clients can find and book ${esc(d.p.name)}. Most people finish in about 30 minutes. Your work saves as you go, so you can stop and come back.</p>`}
    ${banner}
    ${live ? "" : `<div class="progress mt24" role="progressbar" aria-valuenow="${d.percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Setup progress"><i style="width:${d.percent}%"></i></div><p class="small muted mt8">${d.done} of ${d.steps.length} steps done</p>`}
    <ol class="steps2 mt16">${d.steps.map((s, i) => `<li class="${s.done ? "done" : ""}"><a href="/clinic/setup/${s.key}"><span class="n">${s.done ? ic("check", 16) : i + 1}</span><span class="grow col" style="gap:2px;min-width:0"><b>${esc(s.title)}</b><span class="small muted">${esc(s.summary)}</span></span><span class="go">${s.done ? "Edit" : "Start"} ${ic("chevR", 15)}</span></a></li>`).join("")}</ol>
    ${live || d.stage === "paused" ? "" : d.stage === "review" ? "" : `<div class="card mt24 submit-card"><div><h3 style="font-size:22px">${d.complete ? "Ready when you are" : "Submit for review"}</h3><p class="small muted mt8">${d.complete ? "The Aestheva team will check your listing and documents, then publish it. We'll email you." : "Finish the steps above first. Then the team checks your listing and publishes it."}</p></div>
      <form method="post" action="/clinic/setup/submit"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><button class="btn btn-p" type="submit" ${d.complete ? "" : "disabled"}>Submit for review</button></form></div>`}`;
}

export function detailsPage(d: { v: V; e: Errors; csrf: string }) {
  const { v, e } = d;
  const input = (k: string, label: string, attrs = "", hint = "") => `<label class="f" for="f-${k}">${label}${hint ? ` <span class="hint">${hint}</span>` : ""}<input class="in" id="f-${k}" name="${k}" value="${val(v, k)}"${inv(e, k)} ${attrs}>${errOf(e, k)}</label>`;
  const select = (k: string, label: string, opts: readonly string[], ph: string) => `<label class="f" for="f-${k}">${label}<select class="in" id="f-${k}" name="${k}"${inv(e, k)} required><option value="">${ph}</option>${opts.map((o) => `<option ${val(v, k) === esc(o) ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>${errOf(e, k)}</label>`;
  return `${back}<div class="ws-head mt8"><div><div class="eyebrow">Step 1 of 6</div><h2 class="mt8">Your business</h2></div></div>${summary(e)}
    <div class="setup-grid mt16"><form method="post" action="/clinic/setup/details" class="card col" style="gap:16px" novalidate><input type="hidden" name="csrf" value="${esc(d.csrf)}">
      ${input("name", "Business name", 'required maxlength="120"', "As clients know it. Working on your own? Your own name is fine.")}
      <div class="grid g2"><label class="f" for="f-type">Kind of business<select class="in" id="f-type" name="type"${inv(e, "type")} required><option value="">Choose one</option>${VENUE_TYPES.map((o) => `<option value="${esc(o)}" ${val(v, "type") === esc(o) ? "selected" : ""}>${esc(VENUE_TYPE_CHOICES[o] ?? o)}</option>`).join("")}</select>${errOf(e, "type")}</label>${select("area", "Area", AREAS, "Choose your area")}</div>
      <label class="f" for="f-address">Full address <span class="hint">With landmark and PIN code</span><textarea class="in" id="f-address" name="address" rows="2" maxlength="300"${inv(e, "address")}>${val(v, "address")}</textarea>${errOf(e, "address")}</label>
      ${input("phone", "Phone for clients", 'type="tel" inputmode="tel" placeholder="98765 43210"', "Shown on your page with a call button")}
      ${input("tagline", "One-line introduction", 'maxlength="90" placeholder="Skin, hair and dental care near Technopark Phase 3"', "Shown under your name")}
      <label class="f" for="f-about">About you or your business <span class="hint">Two or three sentences: who you are, what you're known for, how you look after clients. Plain words; no promises of results.</span><textarea class="in" id="f-about" name="about" rows="4" maxlength="700"${inv(e, "about")}>${val(v, "about")}</textarea>${errOf(e, "about")}</label>
      ${input("hours_text", "Opening hours", 'maxlength="120" placeholder="Mon–Sat · 10:00–19:00 · Sunday closed"', "As you'd write them on your door")}
      <label class="f" for="f-amenities">What clients should know <span class="hint">Optional, one per line, up to 6. For example: ${AMENITY_IDEAS.slice(0, 3).join(", ")}</span><textarea class="in" id="f-amenities" name="amenities" rows="3">${val(v, "amenities")}</textarea>${errOf(e, "amenities")}</label>
      ${saveBar()}</form>
      ${tips("What makes a good introduction", ["Say what you do and for whom, in the words your clients use.", "Mention a nearby landmark people know, like “near Technopark Phase 3”.", "Avoid words like “best” or “guaranteed”. Clients trust specifics: who looks after them and how.", "Opening hours are for the whole business. Each person's bookable hours come in the Team step."])}</div>`;
}

export function photosPage(d: { p: ProviderRow; csrf: string; error?: string }) {
  const photos = photosOf(d.p);
  return `${back}<div class="ws-head mt8"><div><div class="eyebrow">Step 2 of 6</div><h2 class="mt8">Photos</h2></div></div>
    ${d.error ? `<div class="form-error" role="alert">${esc(d.error)}</div>` : ""}
    <div class="setup-grid mt16"><div class="col" style="gap:16px">
      ${photos.length ? `<div class="photo-grid">${photos.map((ph, i) => `<figure class="card photo-card">${photoImg(ph, "260px")}<figcaption class="small">${i === 0 ? '<span class="badge b-ok">Cover photo</span> ' : ""}${esc(ph.alt)}</figcaption>
          <div class="row wrap" style="gap:6px">${i ? `<form method="post" action="/clinic/setup/photos/change"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><input type="hidden" name="src" value="${esc(ph.src)}"><input type="hidden" name="action" value="cover"><button class="btn btn-o btn-x" type="submit">Make cover</button></form>` : ""}
          <form method="post" action="/clinic/setup/photos/change"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><input type="hidden" name="src" value="${esc(ph.src)}"><input type="hidden" name="action" value="remove"><button class="btn btn-g btn-x" type="submit">Remove</button></form></div></figure>`).join("")}</div>` : ""}
      ${photos.length < MAX_PHOTOS ? `<form class="card col" style="gap:14px" id="photo-form" method="post" action="/clinic/setup/photos" enctype="multipart/form-data"><input type="hidden" name="csrf" value="${esc(d.csrf)}">
        <b>${photos.length ? "Add another photo" : "Add your first photo"}</b>
        <label class="f">Photo<input class="in" type="file" name="photo" accept="image/*" required><span class="hint">JPEG or PNG from your phone is fine. We resize it for you; nothing to do on your side.</span></label>
        <div id="photo-preview" class="hide"></div>
        <label class="f">Describe it in a few words<input class="in" name="alt" maxlength="140" required placeholder="Reception with the waiting area, or gel nail art in pastel shades"><span class="hint">Read aloud to clients who use screen readers, so say what's in the picture.</span></label>
        <div><button class="btn btn-p" type="submit">Upload photo</button></div>
        <p class="xs muted" id="photo-status" aria-live="polite"></p>
        <noscript><p class="form-error">Uploading photos needs JavaScript in your browser.</p></noscript></form>` : `<p class="small muted">That's the maximum of ${MAX_PHOTOS}. Remove one to add another.</p>`}
      <div>${photos.length ? `<a class="btn btn-p" href="/clinic/setup">Continue</a>` : `<a class="btn btn-o" href="/clinic/setup">Back to the checklist</a>`}</div></div>
      ${tips("Photos that help clients choose you", ["Your space (reception, chair or treatment room) or close-ups of your own work, like nails, makeup or tattoos, in good light.", "Landscape (wide) photos work best. Hold the phone sideways.", "Show a client only with their written permission, and never for medical treatments. Staff only with their permission.", "Up to 6 photos. The first one is your cover on Aestheva."])}</div>`;
}

const staffLine = (t: StaffRow, hrs: { dow: number; start_min: number; end_min: number }[]) => {
  const h = DAY_ORDER.map((d) => hrs.find((x) => x.dow === d)).map((x, i) => x ? `${DAY_NAMES[DAY_ORDER[i]].slice(0, 3)} ${fmtTime(x.start_min)}–${fmtTime(x.end_min)}` : "").filter(Boolean);
  return h.length ? h.join(" · ") : '<span class="f-err">No online hours yet</span>';
};
export function teamPage(d: { staff: StaffRow[]; hours: { staff_id: string; dow: number; start_min: number; end_min: number }[]; csrf: string; error?: string }) {
  return `${back}<div class="ws-head mt8"><div><div class="eyebrow">Step 3 of 6</div><h2 class="mt8">You and your team</h2></div><a class="btn btn-p btn-s" href="/clinic/setup/team/new">${ic("plus", 15)} Add a person</a></div>
    ${d.error ? `<div class="form-error" role="alert">${esc(d.error)}</div>` : ""}
    <p class="small muted" style="max-width:680px">Add everyone clients can book. Working on your own? Just add yourself. Names, training and, for medical care, registrations appear on your page, which is what careful clients look for.</p>
    ${d.staff.length ? `<div class="col mt16" style="gap:12px">${d.staff.map((t) => `<div class="card row wrap between" style="gap:12px"><div class="col" style="gap:2px;min-width:0"><b>${esc(t.name)}</b><span class="small">${esc(t.role)} · ${t.medical ? "Registered practitioner" : "Professional (non-medical)"}</span><span class="xs muted">${staffLine(t, d.hours.filter((h) => h.staff_id === t.id))}</span></div>
        <div class="row" style="gap:6px"><a class="btn btn-o btn-x" href="/clinic/setup/team/${esc(t.id)}">Edit</a><form method="post" action="/clinic/setup/team/${esc(t.id)}/remove"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><button class="btn btn-g btn-x" type="submit">Remove</button></form></div></div>`).join("")}</div>
      <div class="mt24"><a class="btn btn-p" href="/clinic/setup">Continue</a></div>`
    : `<div class="card mt16" style="text-align:center;padding:36px"><p class="muted">No one added yet.</p><a class="btn btn-p mt16" href="/clinic/setup/team/new">Add yourself or your first team member</a></div>`}`;
}

export function staffForm(d: { id?: string; v: V; hours: { dow: number; start_min: number; end_min: number }[]; e: Errors; csrf: string }) {
  const { v, e } = d;
  const posted = Object.keys(v).some((k) => k.startsWith("day"));
  const row = (dow: number) => {
    const h = d.hours.find((x) => x.dow === dow);
    const on = posted ? has(v, `day${dow}`, "on") : !!h;
    const a = posted ? Number(val(v, `from${dow}`)) || 600 : h?.start_min ?? 600, b = posted ? Number(val(v, `to${dow}`)) || 1140 : h?.end_min ?? 1140;
    return `<tr${e[`day${dow}`] ? ' class="row-err"' : ""}><td><label class="check" style="margin:0"><input type="checkbox" name="day${dow}" ${on ? "checked" : ""}> ${DAY_NAMES[dow]}</label></td>
      <td><label class="sr" for="from${dow}">From</label><select class="in" id="from${dow}" name="from${dow}">${timeOpts(a)}</select></td><td><label class="sr" for="to${dow}">To</label><select class="in" id="to${dow}" name="to${dow}">${timeOpts(b)}</select></td></tr>`;
  };
  return `<a class="btn btn-g btn-s" href="/clinic/setup/team" style="margin-left:-10px">${ic("chevL", 16)} You and your team</a>
    <div class="ws-head mt8"><div><div class="eyebrow">You and your team</div><h2 class="mt8">${d.id ? `Edit ${val(v, "name")}` : "Add a person"}</h2></div></div>${summary(e)}
    <div class="setup-grid mt16"><form method="post" action="/clinic/setup/team/${d.id ? esc(d.id) : "new"}" class="card col" style="gap:16px" novalidate><input type="hidden" name="csrf" value="${esc(d.csrf)}">
      <div class="grid g2"><label class="f" for="f-name">Name <span class="hint">As clients should see it</span><input class="in" id="f-name" name="name" value="${val(v, "name")}" maxlength="80" placeholder="Your name, or theirs"${inv(e, "name")}>${errOf(e, "name")}</label>
        <label class="f" for="f-role">Role<input class="in" id="f-role" name="role" value="${val(v, "role")}" maxlength="60" placeholder="Dermatologist, Dentist, Senior beautician…"${inv(e, "role")}>${errOf(e, "role")}</label></div>
      <fieldset class="f" style="border:0;padding:0;margin:0" id="medical"><legend style="margin-bottom:6px">Is this person a doctor, dentist or other registered medical practitioner?</legend>
        <div class="row wrap" style="gap:10px"><label class="pick-item"><input type="radio" name="medical" value="yes" ${val(v, "medical") === "yes" ? "checked" : ""}> Yes, registered practitioner</label><label class="pick-item"><input type="radio" name="medical" value="no" ${val(v, "medical") === "no" ? "checked" : ""}> No, beauty or wellness professional</label></div>${errOf(e, "medical")}</fieldset>
      <label class="f" for="f-registration">Council registration <span class="hint">Required for doctors and dentists, for example “Kerala State Dental Council, Reg. No. 12345” or “TCMC Reg. No. 54321”</span><input class="in" id="f-registration" name="registration" value="${val(v, "registration")}" maxlength="120"${inv(e, "registration")}>${errOf(e, "registration")}</label>
      <label class="f" for="f-quals">Qualifications or certificates <span class="hint">One per line, for example “BDS”, “MD Dermatology”, “CIDESCO Diploma”</span><textarea class="in" id="f-quals" name="quals" rows="3"${inv(e, "quals")}>${val(v, "quals")}</textarea>${errOf(e, "quals")}</label>
      <div class="f"><span>Languages they speak</span><div class="pick mt8">${LANGS.map((l) => `<label class="pick-item"><input type="checkbox" name="langs" value="${l}" ${has(v, "langs", l) ? "checked" : ""}> ${l}</label>`).join("")}</div>
        <input class="in mt8" name="langs_other" value="${val(v, "langs_other")}" placeholder="Others, separated by commas" maxlength="80"></div>
      <div class="f" id="hours"><span>When clients can book them online <span class="hint">Tick each day and choose the hours. You can still add phone and walk-in bookings at other times.</span></span>
        <table class="hours-tbl mt8"><tbody>${DAY_ORDER.map(row).join("")}</tbody></table>
        ${errOf(e, "hours")}${DAY_ORDER.map((x) => errOf(e, `day${x}`)).join("")}</div>
      <label class="f" for="f-bio">Short introduction <span class="hint">Optional, up to 400 characters</span><textarea class="in" id="f-bio" name="bio" rows="2" maxlength="400">${val(v, "bio")}</textarea></label>
      ${saveBar("Save")}</form>
      ${tips("Good to know", ["Doctors and dentists are labelled “Registered practitioner”; everyone else is labelled “Professional (non-medical)”, with the training and experience you add.", "Only registered practitioners can be booked for medical consultations and treatments.", "Online hours can differ from opening hours, for example someone who only takes clients in the evening.", "If someone leaves, remove them. Their past bookings stay in your records."])}</div>`;
}

const KIND_HELP: [string, string, string][] = [
  ["consult", "Medical consultation", "A doctor or dentist assesses and advises, for example a dermatology or dental consultation."],
  ["treatment", "Medical treatment", "A procedure done by a doctor or dentist, for example a peel, laser, scaling or mesotherapy. Clients are told the doctor first checks it suits them."],
  ["beauty", "Beauty, wellness or body art", "Anything non-medical, for example facials, hair, nails, makeup, massage, tattoos or piercing."],
];
export function treatmentsPage(d: { services: (ServiceRow & { staff: string[] })[]; staff: StaffRow[]; catName: (id: string) => string; csrf: string }) {
  const name = (id: string) => d.staff.find((t) => t.id === id)?.name ?? "";
  return `${back}<div class="ws-head mt8"><div><div class="eyebrow">Step 4 of 6</div><h2 class="mt8">Services &amp; prices</h2></div>${d.staff.length ? `<a class="btn btn-p btn-s" href="/clinic/setup/treatments/new">${ic("plus", 15)} Add a service</a>` : ""}</div>
    ${!d.staff.length ? `<div class="note n-warn">${ic("info", 16)}<div>Add yourself or your team first, so you can choose who does each service. <a href="/clinic/setup/team/new">Add a person</a></div></div>` : ""}
    <p class="small muted" style="max-width:680px">List what clients can book, with the full price and how long it takes. Clients like knowing the price before they come.</p>
    ${d.services.length ? `<div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>Service</th><th>Time</th><th>Price</th><th>Who</th><th></th></tr></thead><tbody>
      ${d.services.map((s) => `<tr><td><b>${esc(s.name)}</b><div class="xs muted">${catIcon(s.cat, 12)} ${esc(d.catName(s.cat))} · ${s.kind === "beauty" ? "Non-medical" : s.kind === "consult" ? "Medical consultation" : "Medical treatment"}</div></td><td class="small">${s.dur_min} min</td><td>${inr(s.price_paise)}</td>
        <td class="small">${s.staff.length ? s.staff.map(name).map(esc).join(", ") : '<span class="f-err">No one assigned</span>'}</td>
        <td style="text-align:right;white-space:nowrap"><a class="btn btn-o btn-x" href="/clinic/setup/treatments/${esc(s.id)}">Edit</a><form method="post" action="/clinic/setup/treatments/${esc(s.id)}/remove" style="display:inline"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><button class="btn btn-g btn-x" type="submit">Remove</button></form></td></tr>`).join("")}
    </tbody></table></div><div class="mt24"><a class="btn btn-p" href="/clinic/setup">Continue</a></div>`
    : d.staff.length ? `<div class="card mt16" style="text-align:center;padding:36px"><p class="muted">No treatments yet.</p><a class="btn btn-p mt16" href="/clinic/setup/treatments/new">Add your first treatment</a></div>` : ""}`;
}

export function serviceForm(d: { id?: string; v: V; e: Errors; csrf: string; staff: StaffRow[]; categories: { id: string; name: string }[] }) {
  const { v, e } = d;
  return `<a class="btn btn-g btn-s" href="/clinic/setup/treatments" style="margin-left:-10px">${ic("chevL", 16)} Treatments</a>
    <div class="ws-head mt8"><div><div class="eyebrow">Services &amp; prices</div><h2 class="mt8">${d.id ? `Edit ${val(v, "name")}` : "Add a service"}</h2></div></div>${summary(e)}
    <div class="setup-grid mt16"><form method="post" action="/clinic/setup/treatments/${d.id ? esc(d.id) : "new"}" class="card col" style="gap:16px" novalidate><input type="hidden" name="csrf" value="${esc(d.csrf)}">
      <label class="f" for="f-name">Name <span class="hint">As clients would search for it</span><input class="in" id="f-name" name="name" value="${val(v, "name")}" maxlength="90" placeholder="Hydrating facial, gel nail art, small tattoo…"${inv(e, "name")}>${errOf(e, "name")}</label>
      <label class="f" for="f-cat">Category<select class="in" id="f-cat" name="cat"${inv(e, "cat")}><option value="">Choose one</option>${d.categories.map((c) => `<option value="${c.id}" ${val(v, "cat") === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>${errOf(e, "cat")}</label>
      <fieldset class="f" style="border:0;padding:0;margin:0" id="kind"><legend style="margin-bottom:6px">What kind of service is it?</legend>
        <div class="col" style="gap:8px">${KIND_HELP.map(([k, l, h]) => `<label class="opt-radio"><input type="radio" name="kind" value="${k}" ${val(v, "kind") === k ? "checked" : ""}><span><b>${l}</b><span class="xs muted">${h}</span></span></label>`).join("")}</div>${errOf(e, "kind")}</fieldset>
      <div class="grid g2"><label class="f" for="f-dur">How long it takes<select class="in" id="f-dur" name="dur"${inv(e, "dur")}><option value="">Choose</option>${DURATIONS.map((m) => `<option value="${m}" ${val(v, "dur") === String(m) ? "selected" : ""}>${m} minutes</option>`).join("")}</select>${errOf(e, "dur")}</label>
        <label class="f" for="f-price">Full price (₹)<input class="in" id="f-price" name="price" inputmode="numeric" value="${val(v, "price")}" placeholder="1500"${inv(e, "price")}>${errOf(e, "price")}</label></div>
      <label class="f" for="f-description">What happens <span class="hint">One or two plain sentences. Describe the service; don't promise results.</span><textarea class="in" id="f-description" name="description" rows="3" maxlength="500" placeholder="A deep cleanse, gentle exfoliation and a hydrating mask, finished with a short facial massage."${inv(e, "description")}>${val(v, "description")}</textarea>${errOf(e, "description")}</label>
      <div class="f" id="staff"><span>Who can do it</span><div class="pick mt8">${d.staff.map((t) => `<label class="pick-item"><input type="checkbox" name="staff" value="${esc(t.id)}" ${has(v, "staff", t.id) ? "checked" : ""}> ${esc(t.name)}${t.medical ? "" : ' <span class="xs soft">(non-medical)</span>'}</label>`).join("")}</div>${errOf(e, "staff")}</div>
      ${saveBar("Save")}</form>
      ${tips("Clear prices build trust", ["Use the full price the client pays. If it varies, use the usual starting price and say what changes it in the description.", "Courses (for example 6 sessions of laser) work best as one session per service; mention the course in the description. For custom work like tattoos, use a starting price and say what changes it.", "Words like “guaranteed” or “permanent” aren't allowed for medical treatments. Describe what happens instead.", "Nothing is paid online yet: clients pay you at the clinic."])}</div>`;
}

export function documentsPage(d: { docs: { id: string; kind: string; filename: string; size_bytes: number; created_at: string }[]; medical: boolean; csrf: string; error?: string; locked: boolean }) {
  const need = d.medical
    ? ["Council registration certificate for each doctor or dentist", "Clinical establishment registration, if your clinic is registered", "Business identity: GST certificate, trade licence or Udyam"]
    : ["A training or course certificate, if you have one (for example CIDESCO, VLCC, Lakmé Academy, or a tattoo or makeup course)", "No certificate? A portfolio or proof of your work is fine: a PDF or a few photos of work you've done", "An ID or business proof: PAN, masked Aadhaar, GST certificate, trade licence or Udyam"];
  return `${back}<div class="ws-head mt8"><div><div class="eyebrow">Step 5 of 6</div><h2 class="mt8">Verification documents</h2></div></div>
    ${d.error ? `<div class="form-error" role="alert">${esc(d.error)}</div>` : ""}
    <div class="setup-grid mt16"><div class="col" style="gap:16px">
      <div class="card"><b>What we need from you</b><ul class="ticks mt12">${need.map((n) => `<li>${ic("doc", 15)} ${n}</li>`).join("")}</ul>
        <p class="xs muted mt12">These are seen only by the Aestheva team, to check your listing. Clients see a summary of what we checked and when, never the documents.</p></div>
      ${d.docs.length ? `<div class="card"><b>Uploaded</b><div class="mt8">${d.docs.map((x) => `<div class="row between" style="padding:10px 0;border-top:1px solid var(--line);gap:10px"><div class="col" style="gap:0;min-width:0"><span class="small"><b>${esc(x.kind)}</b></span><span class="xs muted">${esc(x.filename)} · ${Math.max(1, Math.round(x.size_bytes / 1024))} KB</span></div>
        ${d.locked ? "" : `<form method="post" action="/clinic/setup/documents/${esc(x.id)}/remove"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><button class="btn btn-g btn-x" type="submit">Remove</button></form>`}</div>`).join("")}</div></div>` : ""}
      <form class="card col" style="gap:14px" method="post" action="/clinic/setup/documents" enctype="multipart/form-data"><input type="hidden" name="csrf" value="${esc(d.csrf)}">
        <b>Upload a document</b>
        <label class="f">What is it?<select class="in" name="kind" required><option value="">Choose one</option>${DOC_KINDS.map((k) => `<option>${esc(k)}</option>`).join("")}</select></label>
        <label class="f">File<input class="in" type="file" name="file" accept="application/pdf,image/jpeg,image/png" required><span class="hint">PDF, or a clear photo of the certificate. Up to 8 MB.</span></label>
        <div><button class="btn btn-p" type="submit">Upload</button></div></form>
      <div>${d.docs.length ? `<a class="btn btn-p" href="/clinic/setup">Continue</a>` : `<a class="btn btn-o" href="/clinic/setup">Back to the checklist</a>`}</div></div>
      ${tips("Why we ask", ["Clients want to know who they're booking. For medical care we check registrations; for everyone else, training or a portfolio. We say what we checked on your page.", "We only list what we've actually checked, and when.", "Photos of certificates are fine if every word is readable.", "Questions about a document? Email " + esc(COMPANY.supportEmail) + "."])}</div>`;
}

export function termsPage(d: { p: ProviderRow; csrf: string; error?: string; acceptedBy?: string }) {
  const accepted = !!d.p.terms_accepted_at;
  return `${back}<div class="ws-head mt8"><div><div class="eyebrow">Step 6 of 6</div><h2 class="mt8">Terms</h2></div></div>
    <div class="card prose mt16" style="max-width:760px">
      <p>The essentials of listing ${esc(d.p.name)} on Aestheva, operated by ${esc(COMPANY.legalName)}. The full <a href="/policies/terms" target="_blank" rel="noopener">terms of use</a> and <a href="/policies/cancellation" target="_blank" rel="noopener">cancellation policy</a> apply.</p>
      <ul>
        <li><b>Commission:</b> ${POLICY.commissionBp / 100}% of the price the client pays (after any quiet-hour offer you set), only on completed bookings that clients make through Aestheva. Bookings from clients who arrive through your own Aestheva link, and bookings your team adds in the portal (phone, walk-in), carry no commission. Founding partners (the first ${INCENTIVES.foundingPlaces} businesses to go live) pay no commission for their first ${INCENTIVES.foundingFreeMonths} months, then ${INCENTIVES.foundingRateBp / 100}% until their first anniversary.</li>
        <li><b>Payments:</b> for now clients pay you on the day. When online deposits start, they're settled to your bank account weekly, less commission, after a short KYC with Razorpay.</li>
        <li><b>Cancellations:</b> clients can cancel free up to ${POLICY.freeCancelHours} hours before. If you cancel, any deposit is refunded to the client in full.</li>
        <li><b>Your care, your responsibility:</b> you provide the service and are responsible for it. For medical treatments, your practitioner decides whether a treatment suits each client.</li>
        <li><b>Accurate information:</b> prices, team, qualifications and registrations on your page must be true and up to date. Tell us if a registration lapses.</li>
        <li><b>Respectful marketing:</b> no promises of results, and no before-and-after claims, for medical treatments.</li>
        <li><b>Client data:</b> use clients' details only to look after their bookings, keep treatment records and other health information off Aestheva, and follow data protection law and your professional rules. Your business is responsible for the data once it has it. Our <a href="/policies/data-protection" target="_blank" rel="noopener">data protection terms for businesses</a> are part of this agreement.</li>
      </ul>
    </div>
    ${accepted ? `<div class="form-ok mt16" role="status">Accepted${d.acceptedBy ? ` by ${esc(d.acceptedBy)}` : ""} on ${new Date(d.p.terms_accepted_at!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}.</div><div class="mt16"><a class="btn btn-p" href="/clinic/setup">Continue</a></div>`
    : `<form method="post" action="/clinic/setup/terms" class="card col mt16" style="gap:12px;max-width:760px"><input type="hidden" name="csrf" value="${esc(d.csrf)}">
      <label class="check consent"><input type="checkbox" name="agree" value="yes"> <span>I agree to these terms on behalf of ${esc(d.p.name)}, and I'm authorised to do so.</span></label>
      ${d.error ? `<div class="form-error" role="alert">${esc(d.error)}</div>` : ""}
      <div><button class="btn btn-p" type="submit">Agree and continue</button></div></form>`}`;
}
