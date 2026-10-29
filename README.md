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

- **Payment gateway: Razorpay.** Chosen for UPI, cards and split settlements to providers in India. Stripe was compared in October 2026 and set aside for three reasons:
  - New Indian businesses can only join Stripe by invitation.
  - Stripe Connect, its marketplace product, needs Stripe's approval before an Indian platform can onboard connected accounts.
  - Stripe's strength is international cards, while Aestheva's clients pay in rupees, mostly by UPI.
  Before integrating, confirm two things with Razorpay: that Route is enabled for a marketplace of clinics, salons and wellness centres, and the current Route transfer fee.
- **Tech stack and hosting:** not decided yet.

## How Razorpay fits the prototype's payment rules

The prototype's payments are simulated. These are the rules it already follows, and the Razorpay feature that would carry each one.

| Prototype rule | Razorpay |
|----------------|----------|
| The client pays a deposit online when booking. The balance is paid at the venue. | Create an Order for the deposit, take payment with Checkout (UPI and card), and confirm it from the `payment.captured` webhook. |
| Each provider is paid its share of deposits. | Onboard every provider as a Route linked account, with their own KYC and bank details. |
| Aestheva keeps 10% of the full price on completed marketplace bookings. Direct bookings carry no commission. | Transfer each deposit to the provider minus the commission, and keep the transfer on hold until the appointment is marked completed. |
| Settlements are paid weekly, on Mondays. | Release held transfers on the settlement run. Linked-account settlements then follow Razorpay's schedule. |
| Free cancellation 24 hours or more before. A provider cancellation refunds in full. Late cancellations go to an operations review. | Refund the payment. If the transfer was already released, reverse it before refunding. |
| An approved refund is taken from the provider's next settlement only when the provider is at fault. | Reverse the provider's transfer when they are at fault. Otherwise Aestheva bears the refund. |

**Open question: commission on bookings without a deposit.** Three sample services take no deposit: threading at ₹250, a haircut at ₹600 and a beard sculpt at ₹400. Commission cannot be deducted from a payment that never passes through Razorpay. The options are a minimum deposit on every marketplace booking, or invoicing those providers for commission each week.
