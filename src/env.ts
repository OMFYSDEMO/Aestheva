export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ENV: string;                  // development | test | production
  SITE_URL: string;                 // canonical origin, e.g. https://aestheva.in (blank: use the request's origin)
  RAZORPAY_KEY_ID: string;          // public key id, rzp_test_... or rzp_live_...
  RAZORPAY_KEY_SECRET?: string;     // secret
  RAZORPAY_WEBHOOK_SECRET?: string; // secret
}
