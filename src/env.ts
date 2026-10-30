export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ENV: string;                  // development | test | production
  SITE_URL: string;                 // canonical origin, e.g. https://aestheva.in (blank: use the request's origin)
  // Razorpay credentials are Worker secrets, so dashboard values survive every deploy.
  RAZORPAY_KEY_ID?: string;         // rzp_test_... or rzp_live_...
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  PREVIEW_KEY?: string;             // secret: unlocks draft venues at /p/<slug>?preview=<key>
  WELCOME_CREDIT_PAISE?: string;    // optional: overrides the welcome offer (paise); "0" pauses it without a deploy
  OPS_KEY?: string;                 // secret: the team's password for /ops (applications review)
  MEDIA?: R2Bucket;                 // venue photos and verification documents (wrangler.jsonc)
  EMAIL?: SendEmail;                // Cloudflare Email Service binding (wrangler.jsonc); absent in local dev
  NOTIFY_EMAIL?: string;            // secret: the verified inbox that receives team emails (defaults to the support address)
}
