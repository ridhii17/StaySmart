const mongoose = require("mongoose");
require("dotenv").config();

const baseListings = require("./data.js");
const demoListings = require("./demo-listings.js");
const Listing = require("../models/listing");
const User = require("../models/user");
const Review = require("../models/review");
const Booking = require("../models/booking");
const Trip = require("../models/trip");
const { calculatePrice } = require("../utils/stay-smart");

const MONGO_URL = process.env.ATLAS_URL || "mongodb://localhost:27017/StaySphere";
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || "StaySmartDemo2026!";
const seedListings = [...baseListings, ...demoListings];

const demoAccounts = [
  {
    key: "host",
    username: "demo.host",
    email: "host.demo@staysmart.example",
    fName: "Maya",
    lName: "Kapoor",
    role: "host",
    image: { url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80", filename: "demo-host-profile" },
  },
  {
    key: "guest",
    username: "demo.guest",
    email: "guest.demo@staysmart.example",
    fName: "Aarav",
    lName: "Mehta",
    role: "guest",
    image: { url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80", filename: "demo-guest-profile" },
  },
  {
    key: "reviewerMaya",
    username: "maya.traveler",
    email: "maya.traveler@staysmart.example",
    fName: "Maya",
    lName: "Rao",
    role: "guest",
    image: { url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80", filename: "demo-reviewer-maya" },
  },
  {
    key: "reviewerArjun",
    username: "arjun.traveler",
    email: "arjun.traveler@staysmart.example",
    fName: "Arjun",
    lName: "Rao",
    role: "guest",
    image: { url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80", filename: "demo-reviewer-arjun" },
  },
  {
    key: "reviewerLeah",
    username: "leah.traveler",
    email: "leah.traveler@staysmart.example",
    fName: "Leah",
    lName: "Nair",
    role: "guest",
    image: { url: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=80", filename: "demo-reviewer-leah" },
  },
];

const coordinatesByLocation = {
  "malibu": [-118.7798, 34.0259],
  "new york city": [-74.006, 40.7128],
  "aspen": [-106.8175, 39.1911],
  "florence": [11.2558, 43.7696],
  "portland": [-122.6784, 45.5152],
  "cancun": [-86.8515, 21.1619],
  "lake tahoe": [-120.0324, 39.0968],
  "los angeles": [-118.2437, 34.0522],
  "verbier": [7.2286, 46.0961],
  "serengeti national park": [34.6857, -2.3333],
  "amsterdam": [4.9041, 52.3676],
  "fiji": [178.065, -17.7134],
  "cotswolds": [-1.8433, 51.833],
  "boston": [-71.0589, 42.3601],
  "bali": [115.1889, -8.4095],
  "banff": [-115.5708, 51.1784],
  "miami": [-80.1918, 25.7617],
  "phuket": [98.3381, 7.8804],
  "scottish highlands": [-4.2026, 57.4778],
  "dubai": [55.2708, 25.2048],
  "montana": [-111.0429, 46.8797],
  "mykonos": [25.3289, 37.4467],
  "costa rica": [-84.0907, 9.9281],
  "charleston": [-79.9311, 32.7765],
  "tokyo": [139.6917, 35.6895],
  "new hampshire": [-71.5724, 43.1939],
  "maldives": [73.5093, 4.1755],
  "jaipur, rajasthan": [75.7873, 26.9124],
  "alleppey, kerala": [76.3388, 9.4981],
  "munnar, kerala": [77.0595, 10.0889],
  "assagao, goa": [73.8278, 15.2993],
  "rishikesh, uttarakhand": [78.2676, 30.0869],
};

const reviewText = [
  "The place was spotless and the check-in instructions were clear. It made exploring {place} easy.",
  "Thoughtful details, a comfortable bed, and a responsive host. The photos matched the stay.",
  "We had a relaxing visit and appreciated the practical local recommendations around {place}.",
  "A lovely base for our trip: clean rooms, useful amenities, and straightforward check-in.",
  "The stay felt welcoming from the moment we arrived. We would happily book again.",
  "Great value for the location, with everything our group needed for a comfortable visit.",
  "The home was well cared for and the host answered our questions quickly.",
  "A memorable trip with plenty of space to unwind after a full day out.",
];

async function ensureDemoUser(account) {
  const fields = {
    email: account.email,
    fName: account.fName,
    lName: account.lName,
    role: account.role,
    image: account.image,
  };
  let user = await User.findOne({ username: account.username });
  if (user) {
    user.set(fields);
    await user.save();
    return { user, created: false };
  }

  user = await User.register(new User({ username: account.username, ...fields }), DEMO_PASSWORD);
  return { user, created: true };
}

function inferPropertyType(listing, index) {
  if (listing.propertyType) return listing.propertyType;
  const text = `${listing.title} ${listing.description}`.toLowerCase();
  if (/cabin|chalet|treehouse/.test(text)) return "Cabin";
  if (/apartment|loft|penthouse|studio|flat/.test(text)) return "Apartment";
  if (/villa/.test(text)) return "Villa";
  if (/room|student|study/.test(text)) return "Room";
  if (/cottage|lodge|guesthouse|farm/.test(text)) return "Guesthouse";
  return index % 5 === 0 ? "Room" : "Home";
}

function inferCategories(listing) {
  const text = `${listing.title} ${listing.description} ${listing.location}`.toLowerCase();
  const categories = [...(Array.isArray(listing.category) ? listing.category : [])];
  const add = (...values) => categories.push(...values);

  if (/beach|coast|island|bali|cancun|goa|phuket|maldives|mykonos/.test(text)) add("Beachfront", "Tropical");
  if (/cabin|chalet/.test(text)) add("Cabins");
  if (/lake|backwater/.test(text)) add("Lake", "Lakefront", "Amazing Views");
  if (/treehouse/.test(text)) add("Treehouse", "Tiny Homes", "Earth Homes", "Omg");
  if (/cottage|farm|estate|countryside|wayanad|coorg/.test(text)) add("Countryside");
  if (/modern|loft|apartment|studio|brownstone|penthouse|design|city|tokyo|amsterdam|boston|miami|jaipur|pune|bengaluru/.test(text)) add("Design", "Iconic Cities");
  if (/luxury|villa|penthouse|private island|luxe/.test(text)) add("Luxe");
  if (/pool/.test(text)) add("Amazing Pools");
  if (/farm|tea estate|serengeti|coorg/.test(text)) add("Farms");
  if (/mountain|ski|banff|aspen|montana|manali|munnar|rishikesh|snowline/.test(text)) add("Amazing Views", "Top Of The World");
  if (/serengeti|banff|ranthambore|national park/.test(text)) add("National Parks");
  if (/castle/.test(text)) add("Castles", "Luxe");
  if (/camp|tent|glamping/.test(text)) add("Camping", "Earth Homes");
  if (/room|student|study/.test(text) || listing.propertyType === "Room") add("Rooms");
  if (/treehouse|tiny home/.test(text)) add("Omg");

  // Keep every sample stay discoverable in the Trending category as well.
  add("Trending");
  return [...new Set(categories)];
}

function inferAmenities(listing) {
  const text = `${listing.title} ${listing.description} ${listing.location}`.toLowerCase();
  const amenities = Array.isArray(listing.amenities) ? [...listing.amenities] : [];
  const add = (...values) => amenities.push(...values);
  add("Wi-Fi", "Kitchen");
  if (/cabin|chalet|treehouse|cottage|farm|villa|mountain|lake/.test(text)) add("Parking");
  if (/apartment|loft|studio|student|study|room|city|pune|bengaluru|jaipur|tokyo/.test(text)) add("Workspace", "Public transport");
  if (/pool/.test(text)) add("Pool");
  return [...new Set(amenities)];
}

async function prepareListings(host) {
  const operations = seedListings.map((listing) => ({
    updateOne: {
      filter: { title: listing.title },
      update: { $setOnInsert: { ...listing, owner: host._id, reviews: [] } },
      upsert: true,
    },
  }));
  const result = await Listing.bulkWrite(operations, { ordered: false });
  const byTitle = new Map();
  const listings = await Listing.find({ title: { $in: seedListings.map((listing) => listing.title) } });
  listings.forEach((listing) => byTitle.set(listing.title, listing));

  for (const [index, source] of seedListings.entries()) {
    const listing = byTitle.get(source.title);
    if (!listing) continue;
    let changed = false;
    if (!listing.owner) { listing.owner = host._id; changed = true; }
    if (!listing.propertyType) { listing.propertyType = inferPropertyType(source, index); changed = true; }
    if (!listing.capacity || listing.capacity < 1) { listing.capacity = 2 + (index % 5); changed = true; }
    const categories = inferCategories({ ...source, category: listing.category?.length ? listing.category : source.category, propertyType: listing.propertyType });
    if (JSON.stringify(categories) !== JSON.stringify(listing.category || [])) { listing.category = categories; changed = true; }
    const amenities = inferAmenities({ ...source, amenities: listing.amenities?.length ? listing.amenities : source.amenities });
    if (JSON.stringify(amenities) !== JSON.stringify(listing.amenities || [])) { listing.amenities = amenities; changed = true; }
    for (const field of ["travelStyles", "accessibilityFeatures", "ecoPractices"]) {
      if (!listing[field]?.length && source[field]?.length) { listing[field] = source[field]; changed = true; }
    }
    if (!listing.geometry?.coordinates?.length) {
      const coords = source.geometry?.coordinates || coordinatesByLocation[String(listing.location || "").toLowerCase()];
      if (coords) { listing.geometry = { type: "Point", coordinates: coords }; changed = true; }
    }
    if (changed) await listing.save();
  }

  return { listingsByTitle: byTitle, inserted: result.upsertedCount || 0 };
}

async function seedReviews(listingsByTitle, reviewers) {
  let count = 0;
  const reviewersList = [reviewers.guest, reviewers.reviewerMaya, reviewers.reviewerArjun, reviewers.reviewerLeah];
  for (const [index, source] of seedListings.entries()) {
    const listing = listingsByTitle.get(source.title);
    if (!listing) continue;
    const selectedReviewers = [reviewersList[index % reviewersList.length], reviewersList[(index + 1) % reviewersList.length]];
    for (const [offset, author] of selectedReviewers.entries()) {
      const comment = reviewText[(index * 2 + offset) % reviewText.length]
        .replaceAll("{place}", listing.location || listing.country || "the area");
      const review = await Review.findOneAndUpdate(
        { listing: listing._id, author: author._id },
        {
          $set: {
            listing: listing._id,
            author: author._id,
            rating: (index + offset) % 6 === 0 ? 4 : 5,
            comment,
            createAt: new Date(Date.now() - (24 + index * 3 + offset * 41) * 86400000),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      await Listing.updateOne({ _id: listing._id }, { $addToSet: { reviews: review._id } });
      count++;
    }
  }
  return count;
}

async function upsertDemoBooking({ guest, listing, checkIn, checkOut, guests, status }) {
  const dates = calculatePrice(listing.price, checkIn, checkOut);
  const values = {
    guest: guest._id,
    listing: listing._id,
    checkIn,
    checkOut,
    guests,
    nightlyRate: listing.price,
    ...dates,
    status,
  };
  await Booking.findOneAndUpdate(
    { guest: guest._id, listing: listing._id, checkIn },
    { $set: values },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

function utcDate(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function seedBookingsAndTrips(users, listingsByTitle) {
  const host = users.host;
  const guest = users.guest;
  const maya = users.reviewerMaya;
  const arjun = users.reviewerArjun;
  const jaipurRoom = listingsByTitle.get("Jaipur Courtyard Guest Room");
  const jaipurHaveli = listingsByTitle.get("Heritage Haveli in Jaipur");
  const puneStudy = listingsByTitle.get("Study Apartment near Pune University");
  const bengaluruStudio = listingsByTitle.get("Budget Metro Studio in Bengaluru");
  const bengaluruFlat = listingsByTitle.get("Indiranagar Design Flat in Bengaluru");
  const goaVilla = listingsByTitle.get("Old Goa Portuguese Villa with Pool");

  await upsertDemoBooking({ guest, listing: jaipurRoom, checkIn: utcDate("2027-04-14"), checkOut: utcDate("2027-04-17"), guests: 2, status: "confirmed" });
  await upsertDemoBooking({ guest, listing: puneStudy, checkIn: utcDate("2027-06-10"), checkOut: utcDate("2027-06-13"), guests: 2, status: "cancelled" });
  await upsertDemoBooking({ guest: maya, listing: bengaluruStudio, checkIn: utcDate("2027-06-05"), checkOut: utcDate("2027-06-09"), guests: 2, status: "confirmed" });
  await upsertDemoBooking({ guest: arjun, listing: goaVilla, checkIn: utcDate("2027-09-18"), checkOut: utcDate("2027-09-23"), guests: 4, status: "cancelled" });

  await User.updateOne(
    { _id: guest._id },
    { $addToSet: { savedListings: { $each: [jaipurRoom._id, jaipurHaveli._id, goaVilla._id, listingsByTitle.get("Quiet Wayanad Treehouse")._id] } } },
  );

  const trips = [
    {
      owner: guest._id,
      name: "Jaipur Friends Weekend",
      destination: "Jaipur",
      startDate: utcDate("2027-04-14"),
      endDate: utcDate("2027-04-17"),
      travelerCount: 4,
      budget: 58000,
      studentMode: false,
      participants: ["Aarav Mehta", "Maya Rao", "Arjun Rao", "Leah Nair"],
      selectedListings: [jaipurRoom._id, jaipurHaveli._id],
      expenses: [
        { label: "Train tickets", category: "transport", payer: "Maya Rao", amount: 6600, splitBetween: ["Aarav Mehta", "Maya Rao", "Arjun Rao", "Leah Nair"], spentAt: utcDate("2027-03-20") },
        { label: "Welcome dinner", category: "food", payer: "Aarav Mehta", amount: 4800, splitBetween: ["Aarav Mehta", "Maya Rao", "Arjun Rao", "Leah Nair"], spentAt: utcDate("2027-03-22") },
        { label: "City palace tickets", category: "activities", payer: "Arjun Rao", amount: 2400, splitBetween: ["Aarav Mehta", "Maya Rao", "Arjun Rao", "Leah Nair"], spentAt: utcDate("2027-03-23") },
      ],
    },
    {
      owner: guest._id,
      name: "Bengaluru Study Break",
      destination: "Bengaluru",
      startDate: utcDate("2027-08-10"),
      endDate: utcDate("2027-08-13"),
      travelerCount: 2,
      budget: 16000,
      studentMode: true,
      participants: ["Aarav Mehta", "Leah Nair"],
      selectedListings: [bengaluruStudio._id, bengaluruFlat._id],
      expenses: [
        { label: "Metro cards", category: "transport", payer: "Aarav Mehta", amount: 800, splitBetween: ["Aarav Mehta", "Leah Nair"], spentAt: utcDate("2027-08-01") },
        { label: "Shared groceries", category: "food", payer: "Leah Nair", amount: 1450, splitBetween: ["Aarav Mehta", "Leah Nair"], spentAt: utcDate("2027-08-02") },
      ],
    },
  ];

  for (const trip of trips) {
    await Trip.findOneAndUpdate(
      { owner: trip.owner, name: trip.name },
      { $set: trip },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}

async function seed() {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB. Adding StaySmart sample data...");

  const users = {};
  const newlyCreated = [];
  for (const account of demoAccounts) {
    const result = await ensureDemoUser(account);
    users[account.key] = result.user;
    if (result.created) newlyCreated.push(account.username);
  }

  const { listingsByTitle, inserted } = await prepareListings(users.host);
  const reviewCount = await seedReviews(listingsByTitle, users);
  await seedBookingsAndTrips(users, listingsByTitle);

  console.log(`Sample stays available: ${listingsByTitle.size} (${inserted} newly added)`);
  console.log(`Sample guest reviews refreshed: ${reviewCount}`);
  console.log("Sample reservations, saved places, and group trip plans are ready.");
  if (newlyCreated.length) {
    console.log(`New demo accounts: ${newlyCreated.join(", ")}`);
    console.log(`Password for newly created demo accounts: ${DEMO_PASSWORD}`);
  } else {
    console.log("Demo accounts already existed; their passwords were left unchanged.");
  }
}

seed()
  .catch((error) => {
    console.error("Sample data seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  });
