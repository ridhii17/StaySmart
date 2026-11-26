const axios = require("axios");
const mongoose = require("mongoose");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Trip = require("../models/trip");
const razorpay = require("../utils/razorpay");
const { withReservationLock, availabilityFilter, isAvailable } = require("../utils/reservations");
const paymentsController = require("./payments");
const aiRecommendations = require("../utils/ai-recommendations");
const { calculatePrice, getTrustScore, scoreListing } = require("../utils/stay-smart");

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const getListing = (id) => Listing.findById(id).populate("owner").populate("reviews", "rating");
const tripDuration = (trip) => trip.startDate && trip.endDate
  ? Math.max(1, Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000))
  : 1;
function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}
function bookingUrl(listingId, checkIn, checkOut, guests) {
  const params = new URLSearchParams({ checkIn: String(checkIn || ""), checkOut: String(checkOut || ""), guests: String(guests || 1) });
  return `/bookings/new/${listingId}?${params}`;
}

async function getTravelerProfile(user) {
  if (!user) return null;
  const savedIds = (user.savedListings || []).slice(0, 25);
  const [saved, pastBookings] = await Promise.all([
    savedIds.length ? Listing.find({ _id: { $in: savedIds } }).select("category amenities price") : [],
    Booking.find({ guest: user._id, status: "confirmed" }).sort({ createdAt: -1 }).limit(8).populate("listing", "category amenities price"),
  ]);
  const stays = [...saved, ...pastBookings.map((booking) => booking.listing).filter(Boolean)];
  const counts = (field) => {
    const ranking = new Map();
    stays.flatMap((stay) => stay[field] || []).forEach((value) => ranking.set(value, (ranking.get(value) || 0) + 1));
    return [...ranking.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value]) => value);
  };
  const prices = stays.map((stay) => Number(stay.price)).filter((price) => Number.isFinite(price) && price > 0);
  return {
    favoriteCategories: counts("category"),
    favoriteAmenities: counts("amenities"),
    typicalNightlyPrice: prices.length ? Math.round(prices.reduce((total, price) => total + price, 0) / prices.length) : null,
  };
}

module.exports.smartPicks = async (req, res) => {
  const preferences = {
    destination: (typeof req.query.destination === "string" ? req.query.destination : "").trim().slice(0, 80),
    budget: Math.min(100000000, Math.max(0, Number(req.query.budget) || 0)),
    guests: Math.max(1, Math.min(30, Number(req.query.guests) || 1)),
    amenities: (Array.isArray(req.query.amenities) ? req.query.amenities : typeof req.query.amenities === "string" ? [req.query.amenities] : []).filter((item) => typeof item === "string").slice(0, 20),
  };
  const listings = await Listing.find({}).populate("owner", "username email fName image hostVerificationStatus").populate("reviews", "rating");
  const ranked = listings.map((listing) => ({ listing, ...scoreListing(listing, preferences), trustScore: getTrustScore(listing), budgetLimit: preferences.budget }))
    .sort((a, b) => b.score - a.score || a.listing.price - b.listing.price);
  for (const result of ranked) result.listing.isSaved = Boolean(req.user?.savedListings?.some((id) => id.equals(result.listing._id)));
  let aiFailed = false;
  let aiUsed = false;
  let bestOverall = ranked.slice(0, 4);
  if (req.query.useAI === "on" && aiRecommendations.isConfigured() && ranked.length) {
    try {
      const travelerProfile = await getTravelerProfile(req.user);
      const candidates = ranked.slice(0, 30).map(({ listing, score }) => {
        const ratings = (listing.reviews || []).map((review) => Number(review.rating)).filter(Number.isFinite);
        return {
          id: String(listing._id),
          title: listing.title,
          location: [listing.location, listing.country].filter(Boolean).join(", "),
          nightlyPrice: Number(listing.price || 0),
          capacity: Number(listing.capacity || 2),
          propertyType: listing.propertyType || "Home",
          categories: listing.category || [],
          amenities: listing.amenities || [],
          guestRating: ratings.length ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)) : null,
          matchScore: score,
        };
      });
      const recommendations = await aiRecommendations.rankStays({ preferences, travelerProfile, candidates });
      const rankedById = new Map(ranked.map((item) => [String(item.listing._id), item]));
      const aiResults = recommendations.map(({ id, reason }) => ({ ...rankedById.get(id), aiReason: reason })).filter((item) => item.listing);
      if (aiResults.length) {
        bestOverall = aiResults;
        aiUsed = true;
      } else {
        aiFailed = true;
      }
    } catch (error) {
      aiFailed = true;
      console.error("AI stay recommendations unavailable:", error.response?.status || error.code || "request failed");
    }
  }
  const budgetRanked = [...ranked].sort((a, b) => a.listing.price - b.listing.price || b.score - a.score);
  const locationRanked = preferences.destination
    ? [...ranked].sort((a, b) => Number(`${b.listing.location} ${b.listing.country}`.toLowerCase().includes(preferences.destination.toLowerCase())) - Number(`${a.listing.location} ${a.listing.country}`.toLowerCase().includes(preferences.destination.toLowerCase())) || b.score - a.score)
    : ranked;
  res.render("features/smart-picks", {
    preferences,
    bestOverall,
    bestBudget: budgetRanked.slice(0, 4),
    bestLocation: locationRanked.slice(0, 4),
    aiConfigured: aiRecommendations.isConfigured(),
    aiUsed,
    aiFailed,
  });
};

module.exports.wishlist = async (req, res) => {
  const user = await req.user.populate({ path: "savedListings", populate: [{ path: "owner", select: "username email fName image hostVerificationStatus" }, { path: "reviews", select: "rating" }] });
  const listings = (user.savedListings || []).filter(Boolean).map((listing) => ({ listing, trustScore: getTrustScore(listing) }));
  for (const item of listings) item.listing.isSaved = true;
  res.render("features/wishlist", { listings });
};

module.exports.toggleWishlist = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).send("Invalid place id");
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).send("Place not found");
  const saved = (req.user.savedListings || []).some((id) => id.equals(listing._id));
  await req.user.updateOne(saved ? { $pull: { savedListings: listing._id } } : { $addToSet: { savedListings: listing._id } });
  req.flash("success", saved ? "Removed from your saved places." : "Saved to your wishlist.");
  res.redirect(req.get("referer") || "/wishlist");
};

module.exports.compare = async (req, res) => {
  const ids = [...new Set(String(req.query.ids || "").split(",").filter(validId))].slice(0, 4);
  const listings = ids.length ? await Listing.find({ _id: { $in: ids } }).populate("owner", "username email fName image hostVerificationStatus").populate("reviews", "rating") : [];
  const comparison = listings.map((listing) => ({ listing, trustScore: getTrustScore(listing) }));
  res.render("features/compare", { comparisons: comparison });
};

module.exports.students = async (req, res) => {
  const maxPrice = Math.min(100000000, Math.max(0, Number(req.query.maxPrice) || 2500));
  const studentAmenities = ["Wi-Fi", "Kitchen", "Workspace", "Public transport"];
  const selectedAmenities = (Array.isArray(req.query.amenities) ? req.query.amenities : typeof req.query.amenities === "string" ? [req.query.amenities] : []).filter((item) => studentAmenities.includes(item));
  const filter = { price: { $lte: maxPrice } };
  if (selectedAmenities.length) filter.amenities = { $all: selectedAmenities };
  const listings = await Listing.find(filter).populate("owner", "username email fName image hostVerificationStatus").populate("reviews", "rating").sort({ price: 1 }).limit(24);
  const results = listings.map((listing) => ({ listing, trustScore: getTrustScore(listing) }));
  for (const item of results) item.listing.isSaved = Boolean(req.user?.savedListings?.some((id) => id.equals(item.listing._id)));
  res.render("features/students", { listings: results, maxPrice, studentAmenities, selectedAmenities });
};

module.exports.beginBooking = async (req, res) => {
  if (!validId(req.params.listingId)) return res.status(404).render("listings/error", { statusCode: 404, message: "This place could not be found." });
  const listing = await getListing(req.params.listingId);
  if (!listing) return res.status(404).render("listings/error", { statusCode: 404, message: "This place is no longer available." });
  const pattern = String(listing.location || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alternatives = await Listing.find({ _id: { $ne: listing._id }, location: { $regex: pattern, $options: "i" }, $or: [{ capacity: { $gte: listing.capacity || 2 } }, { capacity: { $exists: false } }], price: { $lte: Math.ceil((listing.price || 0) * 1.35) } }).populate("reviews", "rating").limit(3).sort({ price: 1 });
  res.render("features/booking", {
    listing,
    price: null,
    values: req.query,
    alternatives,
    paymentEnabled: razorpay.isConfigured(),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  });
};

module.exports.checkAvailability = async (req, res) => {
  if (!validId(req.params.listingId)) return res.status(400).json({ error: "Invalid stay id." });
  const listing = await Listing.findById(req.params.listingId).select("_id");
  if (!listing) return res.status(404).json({ error: "Stay not found." });
  const checkIn = parseDateOnly(req.query.checkIn);
  const checkOut = parseDateOnly(req.query.checkOut);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!checkIn || !checkOut || checkIn < today || checkOut <= checkIn || (checkOut - checkIn) / 86400000 > 365) {
    return res.status(400).json({ error: "Choose a future check-in and a later check-out date." });
  }
  res.set("Cache-Control", "no-store");
  const available = await isAvailable(listing._id, checkIn, checkOut);
  res.json({ available, checkedAt: new Date().toISOString() });
};

module.exports.checkout = async (req, res) => {
  if (!validId(req.params.listingId)) return res.status(404).render("listings/error", { statusCode: 404, message: "This place could not be found." });
  const listing = await getListing(req.params.listingId);
  if (!listing) return res.status(404).render("listings/error", { statusCode: 404, message: "This place is no longer available." });
  const checkIn = parseDateOnly(req.body.checkIn);
  const checkOut = parseDateOnly(req.body.checkOut);
  const guests = Number(req.body.guests);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const price = checkIn && checkOut ? calculatePrice(listing.price, checkIn, checkOut) : null;
  if (!checkIn || !checkOut || checkIn < today || (checkOut - checkIn) / 86400000 > 365 || !price || !Number.isInteger(guests) || guests < 1 || guests > (listing.capacity || 2)) {
    req.flash("error", "Choose valid dates and a guest count this place can host.");
    return res.redirect(bookingUrl(listing._id, req.body.checkIn, req.body.checkOut, req.body.guests));
  }
  const check = await withReservationLock(listing._id, () => Booking.exists(availabilityFilter(listing._id, checkIn, checkOut)));
  if (check.busy) {
    req.flash("error", "Availability is being updated. Please try once more.");
    return res.redirect(bookingUrl(listing._id, req.body.checkIn, req.body.checkOut, req.body.guests));
  }
  if (check) {
    req.flash("error", "Those dates are already booked. Try different dates or view similar stays.");
    return res.redirect(bookingUrl(listing._id, req.body.checkIn, req.body.checkOut, req.body.guests));
  }
  req.session.pendingBooking = { listingId: String(listing._id), checkIn: checkIn.toISOString(), checkOut: checkOut.toISOString(), guests, price };
  res.render("features/checkout", {
    listing,
    booking: req.session.pendingBooking,
    perPerson: Math.ceil(price.total / guests),
    paymentEnabled: razorpay.isConfigured(),
  });
};

module.exports.confirmBooking = async (req, res) => {
  if (razorpay.isConfigured()) {
    req.flash("error", "Please complete payment through the secure checkout.");
    return res.redirect("/listings");
  }
  const pending = req.session.pendingBooking;
  if (!pending || !validId(pending.listingId)) {
    req.flash("error", "Your checkout expired. Please choose dates again.");
    return res.redirect("/listings");
  }
  const listing = await Listing.findById(pending.listingId);
  if (!listing) return res.status(404).render("listings/error", { statusCode: 404, message: "This place is no longer available." });
  const checkIn = new Date(pending.checkIn); const checkOut = new Date(pending.checkOut);
  const result = await withReservationLock(listing._id, async () => {
    const conflict = await Booking.exists(availabilityFilter(listing._id, checkIn, checkOut));
    if (conflict) return { conflict: true };
    const booking = await Booking.create({ guest: req.user._id, listing: listing._id, checkIn, checkOut, guests: pending.guests, nightlyRate: listing.price, ...pending.price, status: "confirmed", paymentProvider: "demo", paymentStatus: "demo" });
    return { booking };
  });
  if (result.busy) {
    req.flash("error", "Availability is being updated. Please try once more.");
    return res.redirect(bookingUrl(listing._id, pending.checkIn.slice(0, 10), pending.checkOut.slice(0, 10), pending.guests));
  }
  if (result.conflict) {
    delete req.session.pendingBooking;
    req.flash("error", "Those dates were just booked. Choose new dates or compare alternatives.");
    return res.redirect(bookingUrl(listing._id, pending.checkIn.slice(0, 10), pending.checkOut.slice(0, 10), pending.guests));
  }
  const booking = result.booking;
  delete req.session.pendingBooking;
  req.flash("success", "Your demo reservation is confirmed.");
  res.render("features/booking-confirmation", { booking, listing });
};

module.exports.myTrips = async (req, res) => {
  const bookings = await Booking.find({ guest: req.user._id }).populate("listing").sort({ checkIn: -1 });
  res.render("features/my-trips", { bookings });
};

module.exports.cancelBooking = async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).render("listings/error", { statusCode: 404, message: "Reservation not found." });
  const booking = await Booking.findOne({ _id: req.params.id, guest: req.user._id });
  if (!booking) return res.status(404).render("listings/error", { statusCode: 404, message: "Reservation not found." });
  if (booking.status === "cancelled") {
    req.flash("error", "This reservation is already cancelled.");
    return res.redirect("/my-trips");
  }
  if (booking.checkIn <= new Date()) {
    req.flash("error", "A reservation can only be cancelled before check-in.");
  } else {
    try {
      if (booking.paymentProvider === "razorpay" && booking.paymentStatus === "paid") {
        await paymentsController.issueBookingRefund(booking);
      }
      booking.status = "cancelled";
      await booking.save();
      req.flash("success", booking.paymentProvider === "razorpay" ? "Reservation cancelled. Your refund has been requested." : "Reservation cancelled.");
    } catch (error) {
      req.flash("error", "The refund could not be started, so the reservation is still active. Please try again or contact support.");
    }
  }
  res.redirect("/my-trips");
};

module.exports.hostBookings = async (req, res) => {
  const places = await Listing.find({ owner: req.user._id }).select("_id title image");
  const bookings = places.length ? await Booking.find({ listing: { $in: places.map((place) => place._id) } }).populate("listing").populate("guest", "username email fName").sort({ checkIn: 1 }) : [];
  res.render("features/host-bookings", { bookings });
};

module.exports.trips = async (req, res) => {
  const trips = await Trip.find({ owner: req.user._id }).sort({ updatedAt: -1 });
  res.render("features/trips", { trips });
};

module.exports.newTrip = (req, res) => res.render("features/trip-new");

module.exports.createTrip = async (req, res) => {
  const destination = String(req.body.destination || "").trim().slice(0, 100);
  const name = String(req.body.name || `${destination} trip`).trim().slice(0, 100);
  let travelerCount = Number(req.body.travelerCount);
  const budget = Number(req.body.budget);
  const startDate = req.body.startDate ? parseDateOnly(req.body.startDate) : null;
  const endDate = req.body.endDate ? parseDateOnly(req.body.endDate) : null;
  const datesValid = (!req.body.startDate && !req.body.endDate) || (startDate && endDate && endDate > startDate && (endDate - startDate) / 86400000 <= 366);
  if (!destination || !Number.isInteger(travelerCount) || travelerCount < 1 || travelerCount > 30 || !Number.isFinite(budget) || budget < 0 || budget > 100000000 || !datesValid) {
    req.flash("error", "Add a destination, group size, and valid budget.");
    return res.redirect("/trips/new");
  }
  const participants = [...new Set(String(req.body.participants || "").split(",").map((name) => name.trim().slice(0, 60)).filter(Boolean))].slice(0, 30);
  if (!participants.length) participants.push(req.user.fName || req.user.username);
  travelerCount = Math.max(travelerCount, participants.length);
  while (participants.length < travelerCount) participants.push(`Traveler ${participants.length + 1}`);
  const trip = await Trip.create({ owner: req.user._id, name, destination, travelerCount, budget, startDate: startDate || undefined, endDate: endDate || undefined, studentMode: req.body.studentMode === "on", participants });
  res.redirect(`/trips/${trip._id}`);
};

module.exports.showTrip = async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).render("listings/error", { statusCode: 404, message: "Trip not found." });
  const trip = await Trip.findOne({ _id: req.params.id, owner: req.user._id }).populate("selectedListings");
  if (!trip) return res.status(404).render("listings/error", { statusCode: 404, message: "Trip not found." });
  const destinationPattern = trip.destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const listings = await Listing.find({ $or: [{ location: { $regex: destinationPattern, $options: "i" } }, { country: { $regex: destinationPattern, $options: "i" } }] }).populate("reviews", "rating").limit(12).sort({ price: 1 });
  const savedStays = trip.selectedListings.filter(Boolean);
  const duration = tripDuration(trip);
  const accommodationOptions = savedStays.map((listing) => ({
    listing,
    ...calculatePrice(Number(listing.price || 0), new Date(0), new Date(duration * 86400000)),
  }));
  const accommodation = accommodationOptions.length ? Math.min(...accommodationOptions.map((option) => option.total)) : 0;
  const spent = trip.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const balances = Object.fromEntries(trip.participants.map((person) => [person, 0]));
  for (const expense of trip.expenses) {
    const shares = expense.splitBetween?.length ? expense.splitBetween : trip.participants;
    if (Object.prototype.hasOwnProperty.call(balances, expense.payer)) balances[expense.payer] += expense.amount;
    shares.forEach((person) => {
      if (Object.prototype.hasOwnProperty.call(balances, person)) balances[person] -= expense.amount / shares.length;
    });
  }
  const debtors = Object.entries(balances).filter(([, balance]) => balance < -0.01).map(([person, balance]) => ({ person, amount: -balance }));
  const creditors = Object.entries(balances).filter(([, balance]) => balance > 0.01).map(([person, balance]) => ({ person, amount: balance }));
  const settlements = [];
  let debtorIndex = 0; let creditorIndex = 0;
  while (debtors[debtorIndex] && creditors[creditorIndex]) {
    const amount = Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount);
    if (amount >= 0.01) settlements.push({ from: debtors[debtorIndex].person, to: creditors[creditorIndex].person, amount: Math.round(amount * 100) / 100 });
    debtors[debtorIndex].amount -= amount;
    creditors[creditorIndex].amount -= amount;
    if (debtors[debtorIndex].amount < 0.01) debtorIndex++;
    if (creditors[creditorIndex].amount < 0.01) creditorIndex++;
  }
  res.render("features/trip-show", { trip, savedStays, accommodationOptions, listings, accommodation, spent, balances, settlements, remaining: trip.budget - accommodation - spent, duration });
};

module.exports.addTripStay = async (req, res) => {
  if (!validId(req.params.id) || !validId(req.body.listingId)) return res.status(404).render("listings/error", { statusCode: 404, message: "Trip or stay not found." });
  const trip = await Trip.findOne({ _id: req.params.id, owner: req.user._id });
  if (!trip) return res.status(404).render("listings/error", { statusCode: 404, message: "Trip or stay not found." });
  const listing = await Listing.findById(req.body.listingId);
  if (!listing) return res.redirect(`/trips/${trip._id}`);
  await Trip.updateOne({ _id: trip._id }, { $addToSet: { selectedListings: listing._id } });
  req.flash("success", "Stay added to your trip comparison.");
  res.redirect(`/trips/${trip._id}`);
};

module.exports.removeTripStay = async (req, res) => {
  if (!validId(req.params.id) || !validId(req.params.listingId)) return res.status(404).render("listings/error", { statusCode: 404, message: "Trip or stay not found." });
  const trip = await Trip.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, { $pull: { selectedListings: req.params.listingId } });
  if (!trip) return res.status(404).render("listings/error", { statusCode: 404, message: "Trip not found." });
  res.redirect(`/trips/${trip._id}`);
};

module.exports.addExpense = async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).render("listings/error", { statusCode: 404, message: "Trip not found." });
  const trip = await Trip.findOne({ _id: req.params.id, owner: req.user._id });
  const amount = Number(req.body.amount);
  const payer = String(req.body.payer || "").trim().slice(0, 60);
  const label = String(req.body.label || "").trim().slice(0, 100);
  if (!trip) return res.status(404).render("listings/error", { statusCode: 404, message: "Trip not found." });
  if (!label || !payer || !Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    req.flash("error", "Enter an expense name, payer, and positive amount.");
    return res.redirect(`/trips/${trip._id}`);
  }
  const validCategories = ["accommodation", "food", "transport", "activities", "other"];
  if (!trip.participants.includes(payer)) {
    req.flash("error", "Choose a payer from the trip members.");
    return res.redirect(`/trips/${trip._id}`);
  }
  const submittedSplit = Array.isArray(req.body.splitBetween) ? req.body.splitBetween : [req.body.splitBetween].filter(Boolean);
  const splitBetween = [...new Set(submittedSplit.filter((person) => trip.participants.includes(person)))];
  trip.expenses.push({ label, payer, amount, category: validCategories.includes(req.body.category) ? req.body.category : "other", splitBetween: splitBetween.length ? splitBetween : trip.participants });
  await trip.save();
  res.redirect(`/trips/${trip._id}`);
};

module.exports.removeExpense = async (req, res) => {
  if (!validId(req.params.id) || !validId(req.params.expenseId)) return res.status(404).render("listings/error", { statusCode: 404, message: "Trip or expense not found." });
  const trip = await Trip.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, { $pull: { expenses: { _id: req.params.expenseId } } });
  if (!trip) return res.status(404).render("listings/error", { statusCode: 404, message: "Trip not found." });
  res.redirect(`/trips/${trip._id}`);
};

module.exports.nearby = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid place id" });
  const listing = await Listing.findById(req.params.id).select("geometry location country");
  if (!listing) return res.status(404).json({ error: "Place not found" });
  const [lon, lat] = listing.geometry?.coordinates || [];
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return res.json({ places: [], message: "Map coordinates are not available for this place yet." });
  const apiKey = process.env.GEOAPIFY_KEY;
  if (!apiKey) return res.status(503).json({ error: "Nearby places are not configured." });
  const categories = "catering.restaurant,healthcare.hospital,public_transport,railway,entertainment.tourism,education.college,education.university";
  let data;
  try {
    ({ data } = await axios.get("https://api.geoapify.com/v2/places", { params: { categories, filter: `circle:${lon},${lat},5000`, bias: `proximity:${lon},${lat}`, limit: 30, apiKey }, timeout: 8000 }));
  } catch {
    return res.status(503).json({ error: "Nearby places are temporarily unavailable." });
  }
  const places = (data.features || []).map((feature) => ({ name: feature.properties.name || feature.properties.address_line1 || feature.properties.categories?.[0]?.split(".").pop() || "Nearby place", category: feature.properties.categories?.[0]?.split(".").pop()?.replaceAll("_", " ") || "place", distance: feature.properties.distance ?? null, coordinates: feature.geometry?.coordinates || [] })).filter((place) => place.coordinates.length === 2).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  res.json({ places });
};
