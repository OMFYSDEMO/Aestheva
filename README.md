# Aestheva

Aestheva is an aesthetic and wellness marketplace: clients find verified clinics, salons, wellness centres and independent practitioners, then book and pay a deposit online. Phase 1 is Thiruvananthapuram.

**Owner:** Haswel Care Private Limited. Aestheva is Haswel Care's marketplace project. Hasta Wellness Clinic is Haswel Care's separate clinic project.

## What is in this repository

| Path | What it is |
|------|------------|
| `prototype/` | The clickable product prototype: consumer site, practitioner workspace and platform admin. Plain HTML, CSS and JavaScript. State is kept in the browser's local storage. All providers, people and figures are fictional. |
| `dashboard/` | The marketplace dashboard for the operations team. `index.html` is one self-contained file with the data embedded. |
| `scripts/` | The sample-data generator and the dashboard build. |

## Run the prototype

Open `prototype/index.html` in a browser, or serve the folder:

```sh
npx serve prototype
```

## The marketplace dashboard

Open `dashboard/index.html` in a browser. It needs an internet connection only to load Chart.js and the fonts.

It shows gross booking value, commission earned, bookings, the cancellation and no-show rate, and confirmed value for the next 14 days. Below that are trend and category charts, a weekday-by-hour demand map, the trust and operations queue, provider performance and expansion demand. Filters cover period, source (marketplace or direct), area and category.

The bookings are **sample data**. `scripts/generate-sample-bookings.mjs` simulates them from the prototype's real catalogue: its providers, services, prices, staff hours and the 10% marketplace commission. The output is deterministic.

```sh
npm run dashboard          # regenerate sample data, then rebuild dashboard/index.html
npm run build:dashboard    # rebuild from dashboard/sample-data.json only
node scripts/build-dashboard.mjs path/to/real-data.json
```

To use real bookings, export a JSON file with the same shape as `dashboard/sample-data.json`:

- `meta`: `asOf` (YYYY-MM-DD), `launch`, `snapshot`, `ahead` (days), `commission` (0.10), `city`, `phase`
- `providers`, `services`, `staff`, `categories`, `areas`: the catalogue, referenced by array index
- `bookings.rows`: one array per booking, `[day, slot30, provider, service, staff, marketplace, status, returning]`. `day` counts days from `meta.launch`. `slot30` is the start time in 30-minute steps from midnight. `status` is 0 completed, 1 confirmed, 2 cancelled, 3 no-show. `marketplace` and `returning` are 0 or 1.
- `queue`: open provider applications and support tickets
- `cities`: expansion waitlist and readiness checks

## Decisions so far

- **Payments:** Stripe or Razorpay, not yet chosen. The prototype takes a deposit at booking and the platform keeps a 10% commission on completed marketplace bookings, so the gateway must split each payment between Aestheva and the provider. Razorpay Route is built for that kind of split settlement in India, with UPI. Confirm Stripe Connect's availability for an Indian company before choosing it.
