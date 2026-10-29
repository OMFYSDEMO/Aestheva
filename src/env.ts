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
}
