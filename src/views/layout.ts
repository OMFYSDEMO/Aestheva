import { COMPANY } from "../config";
import { esc, ic } from "./ui";

export interface PageOpts {
  title: string;              // full <title>
  description?: string;
  canonical?: string;         // absolute URL
  nav?: "explore" | "practitioners" | "";
  appEnv: string;
  noindex?: boolean;
  scripts?: string[];         // extra script URLs, loaded deferred
  head?: string;
}

const FONTS = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&display=swap";

export function layout(o: PageOpts, body: string): string {
  const ribbon = o.appEnv === "production" ? "" :
    `<div class="ribbon"><span><b>${o.appEnv === "test" ? "Test" : "Development"} build</b> · sample providers from the prototype · payments run in test mode</span></div>`;
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
${o.description ? `<meta name="description" content="${esc(o.description)}">` : ""}
${o.canonical ? `<link rel="canonical" href="${esc(o.canonical)}">` : ""}
${o.noindex || o.appEnv !== "production" ? '<meta name="robots" content="noindex">' : ""}
<meta name="theme-color" content="#713F54">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
${o.head ?? ""}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${ribbon}
<header class="topbar"><div class="topbar-in">
  <a class="logo" href="/" style="text-decoration:none">AESTHEVA<small>${esc(COMPANY.launchCity.toUpperCase())}</small></a>
  <nav class="topnav" aria-label="Main">
    <a href="/search" class="${o.nav === "explore" ? "on" : ""}">${ic("search", 17)} <span class="lbl">Explore</span></a>
    <a href="/for-practitioners" class="${o.nav === "practitioners" ? "on" : ""}">${ic("users", 17)} <span class="lbl">For practitioners</span></a>
  </nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="footer">
  <div class="serif" style="font-size:22px;letter-spacing:.2em;color:var(--mulberry)">AESTHEVA</div>
  <p class="mt8">Verified aesthetic and wellness care in ${esc(COMPANY.launchCity)}. Kochi, Kozhikode and Thrissur next.</p>
  <p class="mt8 small"><a href="/policies/cancellation">Cancellation &amp; refunds</a> · <a href="/policies/terms">Terms</a> · <a href="/policies/privacy">Privacy</a> · <a href="/contact">Contact</a></p>
  <p class="mt8 xs">Verification labels describe what was checked and its scope. They are not a guarantee of results.</p>
  <p class="mt8 xs">© ${new Date().getFullYear()} ${esc(COMPANY.legalName)}</p>
</footer>
<script src="/site.js" defer></script>
${(o.scripts ?? []).map((s) => `<script src="${esc(s)}" defer></script>`).join("\n")}
</body>
</html>`;
}

/** A blank business fact renders as a visible marker so it can't ship unnoticed. */
export const fact = (v: string, label: string) => v ? esc(v) : `<span class="todo">${esc(label)} to be added</span>`;
