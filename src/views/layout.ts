import { COMPANY } from "../config";
import { SKYLINE } from "./skyline";
import { esc, ic } from "./ui";

export interface PageOpts {
  title: string;              // full <title>
  description?: string;
  canonical?: string;         // absolute URL
  nav?: "explore" | "story" | "practitioners" | "";
  appEnv: string;
  noindex?: boolean;
  scripts?: string[];         // extra script URLs, loaded deferred
  head?: string;
  ogImage?: string;           // absolute URL of a 1200x630 image
  app?: { label: string; right?: string };   // signed-in workspace: slim header and footer, no marketing navigation
  joinPromo?: boolean;        // invite businesses to join with a small, dismissible pop-up
  jsonLd?: object[];          // schema.org structured data for search engines
}

// Body font (Manrope) and the heading and wordmark font (Outfit).
const FONTS = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap";
/** JSON-LD, with "<" escaped so a name can never close the script tag. */
const ld = (o: object) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

export function layout(o: PageOpts, body: string): string {
  const ribbon = o.appEnv === "production" ? "" :
    `<div class="ribbon"><span><b>${o.appEnv === "test" ? "Test" : "Development"} build</b> · not the live site · payments are simulated or in test mode</span></div>`;
  const desc = o.description ?? `Book salons, clinics, studios and independent professionals for beauty, wellness and care in ${COMPANY.launchCity}.`;
  const navLink = (href: string, key: PageOpts["nav"], icon: string, label: string) =>
    `<a href="${href}" class="${o.nav === key ? "on" : ""}"${o.nav === key ? ' aria-current="page"' : ""}>${ic(icon, 17)} <span class="lbl">${label}</span></a>`;
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(desc)}">
${o.canonical ? `<link rel="canonical" href="${esc(o.canonical)}">` : ""}
${o.noindex || o.appEnv !== "production" ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:site_name" content="Aestheva">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(desc)}">
${o.canonical ? `<meta property="og:url" content="${esc(o.canonical)}">` : ""}
<meta property="og:locale" content="en_IN">
<meta property="og:image" content="${esc(o.ogImage ?? (o.canonical ? new URL("/brand/og-default.jpg", o.canonical).href : "/brand/og-default.jpg"))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="theme-color" content="#8A2E5C">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${FONTS}"></noscript>
<link rel="stylesheet" href="/styles.css">
${(o.jsonLd ?? []).map(ld).join("\n")}
${o.head ?? ""}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${ribbon}
<header class="topbar"><div class="topbar-in">
  <a class="logo" href="${o.app ? "/clinic" : "/"}" style="text-decoration:none"><span class="wm">aestheva</span>${o.app ? `<span class="logo-sub">${esc(o.app.label)}</span>` : ""}</a>
  ${o.app ? `<div class="topnav">${o.app.right ?? ""}</div>` : `<nav class="topnav" aria-label="Main">
    ${navLink("/search", "explore", "search", "Explore")}
    ${navLink("/about", "story", "leaf", "Our story")}
    <a href="/for-practitioners" class="nav-cta${o.nav === "practitioners" ? " on" : ""}"${o.nav === "practitioners" ? ' aria-current="page"' : ""}>${ic("users", 17)} <span class="lbl">List your business</span></a>
  </nav>`}
</div></header>
<main id="main">
${body}
</main>
${o.app ? `<footer class="footer app-foot"><p>Aestheva for business · Help: <a href="mailto:${esc(COMPANY.supportEmail)}">${esc(COMPANY.supportEmail)}</a></p></footer>` : `<footer class="footer">${SKYLINE}<div class="footer-in">
  <div class="footer-brand">
    <div class="logo logo-foot"><span class="wm">aestheva</span></div>
    <p class="mt12">Beauty, wellness and care in ${esc(COMPANY.launchCity)}, booked with the price, the person and the time settled before you arrive.</p>
    <p class="mt12 xs">Made in Kazhakkoottam. Kochi, Kozhikode and Thrissur next.</p>
  </div>
  <nav aria-label="Explore"><h2>Explore</h2><a href="/search">All services</a><a href="/trivandrum">Prices &amp; service guides</a><a href="/search?cat=skin">Skin &amp; facials</a><a href="/search?cat=nails">Nails, lashes &amp; brows</a><a href="/search?cat=groom">Makeup &amp; grooming</a><a href="/search?cat=dental">Smile &amp; dental</a></nav>
  <nav aria-label="Company"><h2>Company</h2><a href="/about">Our story</a><a href="/for-practitioners">List your business</a><a href="/for-practitioners/apply">Apply to join</a><a href="/contact">Contact</a></nav>
  <nav aria-label="Policies"><h2>Policies</h2><a href="/policies/cancellation">Cancellation &amp; refunds</a><a href="/policies/terms">Terms of use</a><a href="/policies/privacy">Privacy</a><a href="/policies/data-protection">Data protection for businesses</a></nav>
</div>
<div class="footer-base">
  <p>© ${new Date().getFullYear()} ${esc(COMPANY.legalName)} · <a href="mailto:${esc(COMPANY.supportEmail)}">${esc(COMPANY.supportEmail)}</a></p>
  <p class="mt8">Verification labels describe what was checked and its scope. They are not a guarantee of results.</p>
</div></footer>`}
${o.joinPromo ? `<aside class="join-pop" id="join-pop" aria-label="List your business on Aestheva" hidden>
  <button class="join-pop-x" type="button" data-join-close aria-label="Close">${ic("x", 16)}</button>
  <div class="eyebrow">For beauty &amp; wellness pros</div>
  <h2>Your talent, fully booked.</h2>
  <p>Nails, makeup, tattoos, hair, facials or a whole clinic? Let people across ${esc(COMPANY.launchCity)} find you, see your work and book your free slots.</p>
  <ul><li>${ic("check", 14)} Free to list</li><li>${ic("check", 14)} Set up in about 30 minutes</li><li>${ic("check", 14)} Solo artists welcome</li></ul>
  <div class="row wrap" style="gap:8px"><a class="btn btn-p btn-s" href="/for-practitioners" data-join-go>Join free ${ic("arrowR", 15)}</a><button class="btn btn-g btn-s" type="button" data-join-close>Maybe later</button></div>
</aside>` : ""}
<script src="/site.js" defer></script>
${(o.scripts ?? []).map((s) => `<script src="${esc(s)}" defer></script>`).join("\n")}
</body>
</html>`;
}

/** A blank business fact renders as a visible marker so it can't ship unnoticed. */
export const fact = (v: string, label: string) => v ? esc(v) : `<span class="todo">${esc(label)} to be added</span>`;
