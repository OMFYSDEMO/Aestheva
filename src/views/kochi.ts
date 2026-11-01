// The Kochi page: Aestheva's next city, told for the people of Kochi, with a waiting list and a way in for businesses.
import { COMPANY, INCENTIVES, POLICY } from "../config";
import { freePeriod } from "../services/incentives";
import { CHEENA_VALA } from "./skyline-kochi";
import { esc, ic } from "./ui";

const AREAS = [
  ["Fort Kochi & Mattancherry", "Fort Kochi, Mattancherry, Jew Town, Thoppumpady"],
  ["Ernakulam city", "MG Road, Marine Drive, Kadavanthra, Panampilly Nagar, Kaloor"],
  ["North & east", "Edappally, Palarivattom, Kakkanad, Infopark, Thrikkakara"],
  ["South & beyond", "Vyttila, Tripunithura, Maradu, Aluva, Vypeen"],
] as const;

export function kochiPage(d: { joined?: boolean; placesLeft: number }) {
  const moments = [
    ["clock", "Between two calls at Infopark", "A threading or a beard trim in Kakkanad at lunch, with a time that's really free, not \"come, we'll see\"."],
    ["sparkle", "Wedding season, sorted early", "Bridal makeup trials and mehendi booked with the artist named and the full price on the page, months before the muhurtham."],
    ["leaf", "A slow Sunday in Fort Kochi", "A walk past the nets at sunset, then an Ayurvedic massage or a facial nearby, booked from your phone on the way."],
    ["tooth", "Care, clearly labelled", "Dental check-ups and skin consultations with registered practitioners, marked as medical and never sold as a deal."],
  ];
  const promises = [
    ["receipt", "Full prices", "Every service shows what it costs and how long it takes. No \"call for rates\"."],
    ["cal", "Real free times", `Only genuinely free times, from an hour ahead to two months out. Free cancellation up to ${POLICY.freeCancelHours} hours before.`],
    ["users", "Named people", "You see who will look after you, with their training, and registration numbers for medical care."],
    ["shield", "Checked by scope", "We say exactly what we verified and when. Medical stays medical."],
  ];
  return `<div class="page story kochi" style="padding-top:0">
  <section class="story-hero">
    <div>
      <div class="eyebrow">Kochi · coming soon</div>
      <h1 class="mt12">Namaskaram, Kochi.</h1>
      <p class="lede mt16">From the cheena vala at Fort Kochi to the glass towers of Kakkanad, this is a city that never stops moving. Aestheva is coming to help you book beauty, wellness and care the way Kochi lives: quickly, at a full price you can see, at a time someone is genuinely free.</p>
      <p class="mt16">We started in ${esc(COMPANY.launchCity)}, where Aestheva is already taking bookings. Kochi is next. Join the list and we'll write to you once, on the day we open near you.</p>
      <div class="story-cta mt24"><a class="btn btn-p" href="#join">Tell me when Kochi opens</a><a class="btn btn-o" href="#business">List your Kochi business</a></div>
    </div>
    <aside class="kochi-hero-art" aria-label="Kochi at a glance">
      ${CHEENA_VALA}
      <div class="story-facts">
        <div><b>Opening</b><span>Kochi, area by area, starting where most people ask</span></div>
        <div><b>For</b><span>Salons, studios, clinics, beauticians, makeup, nail and tattoo artists</span></div>
        <div><b>Live in</b><span>${esc(COMPANY.launchCity)}</span></div>
        <div><b>Run by</b><span>${esc(COMPANY.legalName)}, as its start-up division</span></div>
      </div>
    </aside>
  </section>

  <section class="mt64 story-two">
    <div>
      <div class="eyebrow">The nets at Fort Kochi</div>
      <h2 class="mt8">Patient work, shared, and timed to the tide</h2>
      <p class="mt16">Every evening at Fort Kochi, a team leans on a long teak boom, the stones on the ropes swing, and the cheena vala rises out of the water with the catch. The nets are said to have come with Chinese traders centuries ago, and they still work because everyone pulls at the same moment.</p>
      <p class="mt12">That's the spirit we want for Kochi's beauty and care businesses: one shared, well-balanced way of bringing clients in, so the people who look after you can spend their day doing the work, not answering the phone.</p>
    </div>
    <div>
      <div class="eyebrow">Built for how Kochi books</div>
      <h2 class="mt8">More than two million people, one city on the move</h2>
      <p class="mt16">Greater Kochi runs on ferries, the Metro and the Vyttila hub, on shifts at Infopark and the port, on weddings, festivals and the Biennale. Care has to fit between all of that. On Aestheva you'll see every price in full, who's free and when, and book in about a minute, from a Water Metro seat or the queue at Edappally.</p>
    </div>
  </section>

  <section class="mt64">
    <div class="eyebrow">What it will feel like</div>
    <h2 class="mt8">Four Kochi moments</h2>
    <div class="promise-grid kochi-moments mt24">${moments.map(([i, t, b]) => `<div>${ic(i, 22)}<b>${t}</b><p>${b}</p></div>`).join("")}</div>
  </section>

  <section class="mt64">
    <div class="eyebrow">What you can count on</div>
    <h2 class="mt8">The same promises as in ${esc(COMPANY.launchCity)}</h2>
    <div class="promise-grid kochi-moments mt24">${promises.map(([i, t, b]) => `<div>${ic(i, 22)}<b>${t}</b><p>${b}</p></div>`).join("")}</div>
  </section>

  <section class="mt64">
    <div class="eyebrow">Where we'd like to begin</div>
    <h2 class="mt8">Across the islands and the mainland</h2>
    <p class="muted mt12" style="max-width:680px">We'll open neighbourhood by neighbourhood, starting where the most people join the list and the most businesses apply.</p>
    <div class="area-zones mt24">${AREAS.map(([z, places]) => `<div><b class="small">${z}</b><div class="chips mt8">${places.split(", ").map((p) => `<span class="chip chip-s">${p}</span>`).join("")}</div></div>`).join("")}</div>
  </section>

  <section class="mt64 grid g2" style="align-items:stretch">
    <div class="card" id="join"><div class="eyebrow">For Kochi</div><h3 class="mt8">Tell me when Kochi opens</h3>
      <p class="small muted mt8">One email, on the day we open. No marketing, and you can ask us to remove you at any time.</p>
      ${d.joined ? `<p class="form-ok mt16" role="status">You're on the Kochi list. We'll email you when we open.</p>` : ""}
      <form class="row wrap mt16" method="post" action="/waitlist" style="gap:10px">
        <input type="hidden" name="city" value="Kochi"><input type="hidden" name="from" value="kochi">
        <label class="sr" for="k-email">Email</label><input class="in grow" id="k-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" style="min-width:200px">
        <button class="btn btn-p btn-s" type="submit">Join the Kochi list</button>
      </form>
      <p class="xs muted mt12">How we use your email: <a href="/policies/privacy">privacy notice</a>.</p></div>
    <div class="sage-card" id="business"><div class="eyebrow" style="color:var(--sage-d)">For Kochi businesses</div><h3 class="mt8">Run a salon, studio or clinic in Kochi?</h3>
      <p class="small mt8" style="color:#33463A">Be one of the first on Aestheva in Kochi. Listing is free.${d.placesLeft ? ` The first ${INCENTIVES.foundingPlaces} businesses to go live, in any city, are founding partners: no commission for their first ${freePeriod()}, then ${INCENTIVES.foundingRateBp / 100}% until their first anniversary. <b>${d.placesLeft} places left.</b>` : ""} Bookings through your own Aestheva link never carry commission.</p>
      <div class="row wrap mt16" style="gap:10px"><a class="btn btn-p btn-s" href="/for-practitioners/apply">Apply in about five minutes</a><a class="btn btn-o btn-s" href="/for-practitioners">How it works</a></div>
      <p class="xs mt12" style="color:#33463A">In the application, choose <b>Other</b> as the area and write your Kochi neighbourhood.</p></div>
  </section>

  <p class="small muted mt32" style="text-align:center">In ${esc(COMPANY.launchCity)} today? <a href="/search">Find something near you</a>.</p>
  </div>`;
}
