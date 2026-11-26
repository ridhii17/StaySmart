# StaySmart

StaySmart is a vacation-stay marketplace built with Express, EJS, and MongoDB. Travelers can discover and compare stays, save favorites, leave reviews, plan group trips, and manage reservations. Hosts can publish stays and view reservations.

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
   ```

   For MongoDB Atlas, use your Atlas connection string for `ATLAS_URL` instead. Cloudinary and Geoapify settings are optional for basic browsing, but their related upload and nearby-place features need valid credentials.

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
- Host listing creation and editing, image uploads, and review management
- Guest reviews and ratings on stays
- Smart stay recommendations and a student-budget search
- Saved-place wishlist and side-by-side stay comparison
- Demo reservations with availability checks, cost breakdowns, and cancellation
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
| Profile | `/profile` |

## Limitations and future improvements

StaySmart is currently a demonstration project and is not ready to operate as a commercial booking platform.

### Current limitations

- Reservations demonstrate booking, pricing, and conflict checks, but do not process real online payments.
- Availability is checked when a reservation is made; changes are not broadcast to users in real time.
- Personalized stay recommendations use preference scoring and do not use an AI model yet.
- Image uploads depend on Cloudinary, and nearby-place discovery depends on Geoapify. These features need valid service credentials.
- The app includes sample stays, reviews, accounts, reservations, and trips. Keep seeded demo data in a development database.
- Sample stay and profile photos use remote image URLs and need an internet connection to load.

### Planned improvements

- Integrate a secure payment gateway and add payment confirmation and refund handling.
- Improve personalized recommendations with an AI-powered ranking service.
- Expand availability handling with real-time updates across search, booking, and host dashboards.
- Add a host verification process and clearly display verified profiles.
- Strengthen security, privacy controls, monitoring, and deployment configuration before a public launch.
- Improve scalability and continue refining the experience across desktop and mobile screens.
