// The pages for Aestheva's next cities (Kochi, Thrissur, Kozhikode): each told for the people who live there, with a
// waiting list and a way in for businesses. One layout; each city brings its own words, places and sketches.
import { COMPANY, INCENTIVES, POLICY } from "../config";
import { freePeriod } from "../services/incentives";
import { CHEENA_VALA, KOCHI_SKYLINE } from "./skyline-kochi";
import { KOZHIKODE_ART, KOZHIKODE_SKYLINE, THRISSUR_ART, THRISSUR_SKYLINE } from "./skyline-cities";
import { esc, ic } from "./ui";

export type CitySlug = "kochi" | "thrissur" | "kozhikode";
type Card = readonly [icon: string, title: string, body: string];

export interface City {
  slug: CitySlug;
  name: string;                       // as it goes on the waiting list (one of WAITLIST_CITIES)
  eyebrow: string;
  lede: string;
  art: string;                        // hero sketch
  footer: string;                     // footer sketch
  opening: string;                    // "Opening" fact in the hero
  story: { eyebrow: string; title: string; paras: string[] };
  life: { title: string; body: string };
  moments: Card[];
  areasTitle: string;
  areas: readonly (readonly [zone: string, places: string])[];
  meta: { title: string; description: string };
}

const care: Card = ["tooth", "Care, clearly labelled", "Dental check-ups and skin consultations with registered practitioners, marked as medical and never sold as a deal."];

export const CITIES: Record<CitySlug, City> = {
  kochi: {
    slug: "kochi", name: "Kochi", eyebrow: "Kochi · coming soon", art: CHEENA_VALA, footer: KOCHI_SKYLINE,
    lede: "From the cheena vala at Fort Kochi to the glass towers of Kakkanad, this is a city that never stops moving. Aestheva is coming to help you book beauty, wellness and care the way Kochi lives: quickly, at a full price you can see, at a time someone is genuinely free.",
    opening: "Kochi, area by area, starting where most people ask",
    story: {
      eyebrow: "The nets at Fort Kochi", title: "Patient work, shared, and timed to the tide",
      paras: [
        "Every evening at Fort Kochi, a team leans on a long teak boom, the stones on the ropes swing, and the cheena vala rises out of the water with the catch. The nets are said to have come with Chinese traders centuries ago, and they still work because everyone pulls at the same moment.",
        "That's the spirit we want for Kochi's beauty and care businesses: one shared, well-balanced way of bringing clients in, so the people who look after you can spend their day doing the work, not answering the phone.",
      ],
    },
    life: {
      title: "More than two million people, one city on the move",
      body: "Greater Kochi runs on ferries, the Metro and the Vyttila hub, on shifts at Infopark and the port, on weddings, festivals and the Biennale. Care has to fit between all of that. On Aestheva you'll see every price in full, who's free and when, and book in about a minute, from a Water Metro seat or the queue at Edappally.",
    },
    moments: [
      ["clock", "Between two calls at Infopark", "A threading or a beard trim in Kakkanad at lunch, with a time that's really free, not \"come, we'll see\"."],
      ["sparkle", "Wedding season, sorted early", "Bridal makeup trials and mehendi booked with the artist named and the full price on the page, months before the muhurtham."],
      ["leaf", "A slow Sunday in Fort Kochi", "A walk past the nets at sunset, then an Ayurvedic massage or a facial nearby, booked from your phone on the way."],
      care,
    ],
    areasTitle: "Across the islands and the mainland",
    areas: [
      ["Fort Kochi & Mattancherry", "Fort Kochi, Mattancherry, Jew Town, Thoppumpady"],
      ["Ernakulam city", "MG Road, Marine Drive, Kadavanthra, Panampilly Nagar, Kaloor"],
      ["North & east", "Edappally, Palarivattom, Kakkanad, Infopark, Thrikkakara"],
      ["South & beyond", "Vyttila, Tripunithura, Maradu, Aluva, Vypeen"],
    ],
    meta: {
      title: "Kochi: book beauty, wellness and care, coming soon · Aestheva",
      description: "Aestheva is coming to Kochi: salons, studios, clinics and independent professionals across Fort Kochi, Ernakulam, Kakkanad and beyond, with full prices and real free times. Join the list.",
    },
  },

  thrissur: {
    slug: "thrissur", name: "Thrissur", eyebrow: "Thrissur · coming soon", art: THRISSUR_ART, footer: THRISSUR_SKYLINE,
    lede: "From the gopurams of Vadakkunnathan to the gold and silk shops along Swaraj Round, Thrissur knows how to celebrate. Aestheva is coming to help you book beauty, wellness and care the way Thrissur does things: properly, at a full price you can see, at a time someone is genuinely free.",
    opening: "Thrissur, starting around the Round and out towards Guruvayur",
    story: {
      eyebrow: "Pooram at Thekkinkadu", title: "Hundreds of people, keeping perfect time",
      paras: [
        "Every year in the month of Medam, the elephants of Thiruvambady and Paramekkavu face each other across the Thekkinkadu ground beside Vadakkunnathan temple. At kudamattam the muthukuda parasols rise and change, side by side, so quickly and so exactly that the whole Round holds its breath, and the night ends in fireworks over the city.",
        "Pooram works because everyone, from the drummers of the Elanjithara melam to the men on the elephants, keeps the same time. That's what we want for Thrissur's salons, studios and clinics: bookings that keep time, so the people who look after you can get on with the work.",
      ],
    },
    life: {
      title: "The cultural capital, and a city of celebrations",
      body: "Thrissur is home to Kerala's Sahitya, Sangeetha Nataka and Lalithakala Akademis, to Pulikali at Onam and to the Round that every road comes back to. It's where families shop for gold and silk before a wedding and gather at Guruvayur for the muhurtham. Care has to fit around all of that. On Aestheva you'll see every price in full, who's free and when, and book in about a minute, from a bus on the Round or a seat at the Sakthan stand.",
    },
    moments: [
      ["sparkle", "A dawn muhurtham at Guruvayur", "Bridal makeup and saree draping for an early-morning wedding, booked months ahead with the artist named and the full price on the page."],
      ["clock", "An errand on the Round", "A haircut or a threading between the bank and the jeweller, at a time that's really free, not \"come, we'll see\"."],
      ["leaf", "The day after Pooram", "Feet and shoulders that stood on the Round all night: an Ayurvedic massage the next afternoon, booked from home."],
      care,
    ],
    areasTitle: "From the Round outwards",
    areas: [
      ["Round & centre", "Swaraj Round, MG Road, Patturaikkal, East Fort, Shornur Road"],
      ["West & north", "Punkunnam, Poothole, Ayyanthole, Kanattukara, Viyyur"],
      ["South & east", "Ollur, Kuriachira, Mannuthy, Nadathara, Ollukkara"],
      ["Across the district", "Guruvayur, Kunnamkulam, Chalakudy, Irinjalakuda, Kodungallur"],
    ],
    meta: {
      title: "Thrissur: book beauty, wellness and care, coming soon · Aestheva",
      description: "Aestheva is coming to Thrissur: salons, bridal makeup artists, studios and clinics around Swaraj Round, Punkunnam, Ayyanthole and out to Guruvayur, with full prices and real free times. Join the list.",
    },
  },

  kozhikode: {
    slug: "kozhikode", name: "Kozhikode", eyebrow: "Kozhikode (Calicut) · coming soon", art: KOZHIKODE_ART, footer: KOZHIKODE_SKYLINE,
    lede: "From the halwa shops of SM Street to the old piers on the beach, Kozhikode is generous, unhurried and proud of its food. Aestheva is coming to help you book beauty, wellness and care the Kozhikode way: honestly, at a full price you can see, at a time someone is genuinely free.",
    opening: "Kozhikode, starting in town and along the beach",
    story: {
      eyebrow: "The city of truth", title: "A port that kept its word",
      paras: [
        "For centuries, ships came to Kozhikode for pepper and for a town known for fair dealing; under the Zamorins it was called the city of truth. At Beypore, builders still shape the great wooden uru by hand, plank by plank, the way it has been done for generations.",
        "Fair, honest and made with care is how we want booking beauty and wellness in Kozhikode to feel: every price in full, the person who looks after you named, and nothing new to pay at the counter.",
      ],
    },
    life: {
      title: "India's first UNESCO City of Literature, and a city that eats well",
      body: "In 2023 Kozhikode became India's first UNESCO City of Literature. It's also the city of SM Street halwa, of biriyani worth crossing town for, of sulaimani on the beach at sunset and football on every open ground. Care has to fit between all of that. On Aestheva you'll see every price in full, who's free and when, and book in about a minute, from a bus on Mavoor Road or the queue for halwa.",
    },
    moments: [
      ["sparkle", "Wedding season, sorted early", "Bridal makeup, mehendi and styling for the big day, booked months ahead with the artist named and the full price on the page."],
      ["clock", "In town for SM Street", "A threading or a beard trim near Mananchira while you're in town, at a time that's really free, not \"come, we'll see\"."],
      ["leaf", "An evening by the old piers", "Sunset on the beach, a sulaimani, then a massage or a facial nearby, booked from your phone on the way."],
      care,
    ],
    areasTitle: "From the beach to the hills",
    areas: [
      ["Town & beach", "Mananchira, SM Street, Palayam, Kuttichira, Beach Road, Kallai"],
      ["North", "Nadakkavu, West Hill, Eranhipalam, Chevayur, Vellimadukunnu"],
      ["East", "Medical College, Mavoor Road, Thondayad, Kunnamangalam, Cyberpark"],
      ["South & beyond", "Meenchanda, Beypore, Feroke, Ramanattukara"],
    ],
    meta: {
      title: "Kozhikode (Calicut): book beauty, wellness and care, coming soon · Aestheva",
      description: "Aestheva is coming to Kozhikode: salons, studios, clinics and independent professionals around Mananchira, Nadakkavu, Medical College and the beach, with full prices and real free times. Join the list.",
    },
  },
};

export const CITY_ORDER: CitySlug[] = ["kochi", "kozhikode", "thrissur"];
export const citySlugFor = (name: string) => CITY_ORDER.find((s) => CITIES[s].name === name);

export function cityPage(c: City, d: { joined?: boolean; placesLeft: number }) {
  const promises: Card[] = [
    ["receipt", "Full prices", "Every service shows what it costs and how long it takes. No \"call for rates\"."],
    ["cal", "Real free times", `Only genuinely free times, from an hour ahead to two months out. Free cancellation up to ${POLICY.freeCancelHours} hours before.`],
    ["users", "Named people", "You see who will look after you, with their training, and registration numbers for medical care."],
    ["shield", "Checked by scope", "We say exactly what we verified and when. Medical stays medical."],
  ];
  const grid = (cards: Card[]) => `<div class="promise-grid city-moments mt24">${cards.map(([i, t, b]) => `<div>${ic(i, 22)}<b>${t}</b><p>${b}</p></div>`).join("")}</div>`;
  const n = c.name, id = c.slug[0];
  return `<div class="page story city-page ${c.slug}" style="padding-top:0">
  <section class="story-hero">
    <div>
      <div class="eyebrow">${c.eyebrow}</div>
      <h1 class="mt12">Namaskaram, ${n}.</h1>
      <p class="lede mt16">${c.lede}</p>
      <p class="mt16">We started in ${esc(COMPANY.launchCity)}, where Aestheva is already taking bookings. ${n} is coming. Join the list and we'll write to you once, on the day we open near you.</p>
      <div class="story-cta mt24"><a class="btn btn-p" href="#join">Tell me when ${n} opens</a><a class="btn btn-o" href="#business">List your ${n} business</a></div>
    </div>
    <aside class="city-hero-art" aria-label="${n} at a glance">
      ${c.art}
      <div class="story-facts">
        <div><b>Opening</b><span>${c.opening}</span></div>
        <div><b>For</b><span>Salons, studios, clinics, beauticians, makeup, nail and tattoo artists</span></div>
        <div><b>Live in</b><span>${esc(COMPANY.launchCity)}</span></div>
        <div><b>Run by</b><span>${esc(COMPANY.legalName)}, as its start-up division</span></div>
      </div>
    </aside>
  </section>

  <section class="mt64 story-two">
    <div>
      <div class="eyebrow">${c.story.eyebrow}</div>
      <h2 class="mt8">${c.story.title}</h2>
      ${c.story.paras.map((p, i) => `<p class="${i ? "mt12" : "mt16"}">${p}</p>`).join("\n      ")}
    </div>
    <div>
      <div class="eyebrow">Built for how ${n} books</div>
      <h2 class="mt8">${c.life.title}</h2>
      <p class="mt16">${c.life.body}</p>
    </div>
  </section>

  <section class="mt64">
    <div class="eyebrow">What it will feel like</div>
    <h2 class="mt8">Four ${n} moments</h2>
    ${grid(c.moments)}
  </section>

  <section class="mt64">
    <div class="eyebrow">What you can count on</div>
    <h2 class="mt8">The same promises as in ${esc(COMPANY.launchCity)}</h2>
    ${grid(promises)}
  </section>

  <section class="mt64">
    <div class="eyebrow">Where we'd like to begin</div>
    <h2 class="mt8">${c.areasTitle}</h2>
    <p class="muted mt12" style="max-width:680px">We'll open neighbourhood by neighbourhood, starting where the most people join the list and the most businesses apply.</p>
    <div class="area-zones mt24">${c.areas.map(([z, places]) => `<div><b class="small">${z}</b><div class="chips mt8">${places.split(", ").map((p) => `<span class="chip chip-s">${p}</span>`).join("")}</div></div>`).join("")}</div>
  </section>

  <section class="mt64 grid g2" style="align-items:stretch">
    <div class="card" id="join"><div class="eyebrow">For ${n}</div><h3 class="mt8">Tell me when ${n} opens</h3>
      <p class="small muted mt8">One email, on the day we open. No marketing, and you can ask us to remove you at any time.</p>
      ${d.joined ? `<p class="form-ok mt16" role="status">You're on the ${n} list. We'll email you when we open.</p>` : ""}
      <form class="row wrap mt16" method="post" action="/waitlist" style="gap:10px">
        <input type="hidden" name="city" value="${n}"><input type="hidden" name="from" value="${c.slug}">
        <label class="sr" for="${id}-email">Email</label><input class="in grow" id="${id}-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" style="min-width:200px">
        <button class="btn btn-p btn-s" type="submit">Join the ${n} list</button>
      </form>
      <p class="xs muted mt12">How we use your email: <a href="/policies/privacy">privacy notice</a>.</p></div>
    <div class="sage-card" id="business"><div class="eyebrow" style="color:var(--sage-d)">For ${n} businesses</div><h3 class="mt8">Run a salon, studio or clinic in ${n}?</h3>
      <p class="small mt8" style="color:#33463A">Be one of the first on Aestheva in ${n}. Listing is free.${d.placesLeft ? ` The first ${INCENTIVES.foundingPlaces} businesses to go live, in any city, are founding partners: no commission for their first ${freePeriod()}, then ${INCENTIVES.foundingRateBp / 100}% until their first anniversary. <b>${d.placesLeft} places left.</b>` : ""} Bookings through your own Aestheva link never carry commission.</p>
      <div class="row wrap mt16" style="gap:10px"><a class="btn btn-p btn-s" href="/for-practitioners/apply">Apply in about five minutes</a><a class="btn btn-o btn-s" href="/for-practitioners">How it works</a></div>
      <p class="xs mt12" style="color:#33463A">In the application, choose <b>Other</b> as the area and write your ${n} neighbourhood.</p></div>
  </section>

  <p class="small muted mt32" style="text-align:center">Also coming: ${CITY_ORDER.filter((s) => s !== c.slug).map((s) => `<a href="/${s}">${CITIES[s].name}</a>`).join(" and ")}. In ${esc(COMPANY.launchCity)} today? <a href="/search">Find something near you</a>.</p>
  </div>`;
}
