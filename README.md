# StaySmart

StaySmart is a vacation-stay marketplace built with Express, EJS, and MongoDB. Travelers can discover and compare stays, save favorites, leave reviews, plan group trips, and manage reservations. Hosts can publish stays and manage reservations.

## Requirements

- Node.js 18 or newer
- MongoDB Atlas or a local MongoDB server
- Cloudinary credentials for listing and profile photo uploads
- A Geoapify API key for nearby places and map search features

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root. Keep this file private; it is excluded by `.gitignore`.

   ```dotenv
   ATLAS_URL=mongodb://127.0.0.1:27017/staysmart
   SECRET=replace-with-a-long-random-secret

   CLOUD_NAME=
   CLOUD_API_KEY=
   CLOUD_API_SECRET=
   GEOAPIFY_KEY=

   # Optional: Razorpay checkout (start with test credentials)
   RAZORPAY_KEY_ID=
   RAZORPAY_KEY_SECRET=
   RAZORPAY_WEBHOOK_SECRET=

   # Optional: AI Smart Picks (only called after a traveler opts in)
   OPENAI_API_KEY=
   OPENAI_MODEL=gpt-6-luna

   # Optional: exact signed-in account email allowed to approve hosts
   VERIFICATION_ADMIN_EMAIL=

   # Set to 1 only behind one trusted reverse proxy
   TRUST_PROXY=0
   ```

   For MongoDB Atlas, use your Atlas connection string for `ATLAS_URL` instead. Cloudinary and Geoapify settings are optional for basic browsing; their related upload and nearby-place features require valid credentials. Razorpay and OpenAI are optional integrations described below.

3. Add the sample stays and demo content:

   ```bash
   npm run seed
   ```

   The seed command adds sample users, stays, reviews, reservations, saved places, and group trip plans. It can be run again to refresh the sample records; it does not delete other records. Run it only against a development database.

4. Start the app:

   ```bash
   npm start
   ```

5. Open [http://localhost:8080](http://localhost:8080).

## Demo accounts

The seed creates these accounts when they do not already exist:

| Username | Use |
| --- | --- |
| `demo.host` | Host dashboard, published stays, and reservations |
| `demo.guest` | Saved places, guest reservations, reviews, and group trips |
| `maya.traveler` | Sample reviewer and guest reservation |
| `arjun.traveler` | Sample reviewer and guest reservation |
| `leah.traveler` | Sample reviewer and trip participant |

New demo accounts use `StaySmartDemo2026!` by default. Set `DEMO_SEED_PASSWORD` in `.env` before seeding to choose a different password. Seeding does not reset passwords on accounts that already exist.

## Main features

- Explore stays with destination, date, guest, price, property-type, and amenity filters
- Listing pages with photos, reviews, host details, and nearby-place discovery
- Stay Passport filters for travel style, accessibility details, and host-shared eco practices
- Host listing creation and editing, image uploads, and review management
- Guest reviews and ratings on stays
- Smart stay recommendations and a student-budget search
- Saved-place wishlist and side-by-side stay comparison
- Reservations with availability refresh, itemized pricing, payment status, and cancellation
- Optional Razorpay checkout with server-side payment verification and cancellation refunds
- Optional AI-ranked Smart Picks with explicit traveler opt-in and a preference-based fallback
- Manual host verification requests and verified-host badges
- Group trip plans with selected stays, shared expenses, and suggested settlements
- StaySmart help chatbot for common travel and app questions
- Profile dashboards for guest activity and host listings

## Useful routes

| Page | Route |
| --- | --- |
| Explore stays | `/listings` |
| Smart picks | `/smart-picks` |
| Student search | `/students` |
| Saved places | `/wishlist` |
| Compare stays | `/compare` |
| My reservations | `/my-trips` |
| Group trip planner | `/trips` |
| Host reservations | `/host/bookings` |
| Request host verification | `/host/verification` |
| Review host verification (configured reviewer only) | `/admin/host-verifications` |
| Profile | `/profile` |

## Implemented improvements and provider setup

The code includes these improvements. Payment and AI are optional integrations: provider credentials activate them, and the app continues to work in clearly labelled demo mode without credentials.

### Online payments

- With `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` configured, checkout creates an order on the server, verifies the checkout signature and payment amount, and confirms the reservation after payment capture.
- Cancelling a paid reservation requests a full refund. Payment and refund states are shown in My Trips and reconciled from signed webhooks.
- Without Razorpay keys, checkout is clearly marked as a demo and does not collect money.
- Keep the keys private and start with Razorpay test credentials. Configure a Razorpay webhook to `https://YOUR-DOMAIN/api/payments/razorpay/webhook`, set its secret as `RAZORPAY_WEBHOOK_SECRET`, and subscribe to `payment.captured` and `refund.processed`. Live payments require an activated Razorpay merchant account.

See the [Razorpay web integration guide](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps) and [refund API](https://hdfcbank-collectnow-docs.razorpay.com/api/refunds/create-normal/) for provider setup details.

### AI recommendations

- Add `OPENAI_API_KEY` to enable the opt-in AI option on Smart Picks. `OPENAI_MODEL` is optional; the configured default is `gpt-6-luna`.
- AI is called only when the traveler selects “Use AI recommendations.” The request sends search filters, anonymous stay preferences, and public stay details; it does not send the user's name or email. The app validates returned stay IDs and falls back to its local ranking when the provider is unavailable.
- OpenAI API use may incur charges. Review API access, project limits, and pricing before enabling it. Requests use the [Responses API](https://platform.openai.com/docs/api-reference/responses/create) with structured output and response storage disabled.

### Availability and host verification

- The booking page refreshes availability every 15 seconds while visible, then the server checks again before checkout and reservation creation. This is near-real-time polling; open pages do not receive push updates.
- Hosts can request manual profile verification at `/host/verification`. Set `VERIFICATION_ADMIN_EMAIL` to the exact email of the reviewer account; that signed-in account can review requests at `/admin/host-verifications`. Approval adds a verified badge. This is manual review, not automated identity or government-ID verification.

### Stay Passport

- Hosts can add travel-style tags, accessibility details, and eco practices to each stay. Travelers can filter Explore by these tags and see them on place cards and detail pages.
- Accessibility and eco claims are host-reported and aren’t independently verified. A few sample listings include illustrative tags for the demo; confirm these details with the host before relying on them.

### Security, deployment, and remaining service requirements

- The app sets baseline security headers, uses HTTP-only SameSite cookies (Secure in production), applies shared MongoDB-backed request limits, and defines indexes for common listing, review, booking, and trip queries. Set `TRUST_PROXY=1` only when one trusted reverse proxy sits in front of the app so secure cookies and client IP handling work correctly.
- Use HTTPS in production, a long random `SECRET`, restricted production database credentials, regular database backups, and monitoring. Keep seeded demo accounts and sample records in development databases.
- Image uploads require Cloudinary credentials; nearby-place discovery requires a Geoapify key. Sample image URLs need internet access.
- Before taking real customer bookings, configure provider accounts and webhooks, run payment and refund scenarios with test credentials, review deployment and privacy settings, and arrange operational support. The code provides the integrations; production readiness still depends on provider accounts and deployment configuration.
