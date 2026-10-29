import { Hono } from "hono";
import type { Env } from "./env";
import { HttpError } from "./db";
import api from "./routes/api";
import hooks from "./routes/hooks";
import site from "./routes/site";
import { expireHolds } from "./services/bookings";
import { paymentMode } from "./services/gateway";
import { layout } from "./views/layout";
import { notFoundPage } from "./views/pages";

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500) console.error("unhandled", err);
  const message = err instanceof HttpError ? err.message : "Something went wrong. Please try again.";
  if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/hooks/")) return c.json({ error: message }, status as 500);
  const body = `<div class="page narrow" style="padding-top:64px"><div class="card"><h1 style="font-size:32px">${status === 404 ? "Not found" : "Something went wrong"}</h1><p class="muted mt12">${message.replace(/[<>&]/g, "")}</p><a class="btn btn-p mt16" href="/">Back to Aestheva</a></div></div>`;
  return c.html(layout({ title: "Aestheva", appEnv: c.env.APP_ENV, noindex: true }, body), status as 500);
});

// One canonical address: www.<site> and http:// redirect to SITE_URL.
app.use("*", async (c, next) => {
  if (c.env.SITE_URL) {
    const site = new URL(c.env.SITE_URL), url = new URL(c.req.url);
    if (url.hostname === "www." + site.hostname) return c.redirect(site.origin + url.pathname + url.search, 301);
  }
  await next();
  if (c.env.APP_ENV === "production") c.header("strict-transport-security", "max-age=31536000; includeSubDomains");
  c.header("x-content-type-options", "nosniff");
  c.header("referrer-policy", "strict-origin-when-cross-origin");
  c.header("x-frame-options", "DENY");
});

app.get("/api/health", async (c) => {
  const db = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM providers WHERE status = 'live'").first<{ n: number }>().then((r) => ({ ok: true, live: r?.n ?? 0 }), (e) => ({ ok: false, error: String(e) }));
  const payments = { mode: paymentMode(c.env), webhook: !!c.env.RAZORPAY_WEBHOOK_SECRET };
  return c.json({ ok: db.ok, env: c.env.APP_ENV, db, payments }, db.ok ? 200 : 503);
});
app.route("/api", api);
app.route("/hooks", hooks);
app.route("/", site);
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));
app.notFound((c) => c.html(layout({ title: "Not found · Aestheva", appEnv: c.env.APP_ENV, noindex: true }, notFoundPage()), 404));

export default {
  fetch: app.fetch,
  async scheduled(_evt: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(expireHolds(env).then((n) => { if (n) console.log(`released ${n} unpaid holds`); }));
  },
} satisfies ExportedHandler<Env>;

export { app };
