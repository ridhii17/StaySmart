const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, rateLimit } = require("../middleware");
const features = require("../controllers/features");

router.get("/smart-picks", wrapAsync(features.smartPicks));
router.get("/students", wrapAsync(features.students));
router.get("/compare", wrapAsync(features.compare));
router.get("/wishlist", isLoggedIn, wrapAsync(features.wishlist));
router.post("/wishlist/:id/toggle", isLoggedIn, wrapAsync(features.toggleWishlist));

router.get("/bookings/new/:listingId", isLoggedIn, wrapAsync(features.beginBooking));
router.post("/bookings/checkout/:listingId", isLoggedIn, wrapAsync(features.checkout));
router.post("/bookings/confirm", isLoggedIn, wrapAsync(features.confirmBooking));
router.get("/my-trips", isLoggedIn, wrapAsync(features.myTrips));
router.post("/bookings/:id/cancel", isLoggedIn, wrapAsync(features.cancelBooking));
router.get("/host/bookings", isLoggedIn, wrapAsync(features.hostBookings));

router.get("/trips", isLoggedIn, wrapAsync(features.trips));
router.get("/trips/new", isLoggedIn, features.newTrip);
router.post("/trips", isLoggedIn, wrapAsync(features.createTrip));
router.get("/trips/:id", isLoggedIn, wrapAsync(features.showTrip));
router.post("/trips/:id/stays", isLoggedIn, wrapAsync(features.addTripStay));
router.delete("/trips/:id/stays/:listingId", isLoggedIn, wrapAsync(features.removeTripStay));
router.post("/trips/:id/expenses", isLoggedIn, wrapAsync(features.addExpense));
router.delete("/trips/:id/expenses/:expenseId", isLoggedIn, wrapAsync(features.removeExpense));
router.get("/api/nearby/:id", wrapAsync(features.nearby));
router.get("/api/availability/:listingId", rateLimit({ scope: "availability", windowMs: 60 * 1000, max: 40 }), wrapAsync(features.checkAvailability));

module.exports = router;
