const Listing = require("../models/listing");
const Review = require("../models/review");
const Booking = require("../models/booking");
const Trip = require("../models/trip");
const HostVerification = require("../models/host-verification");

module.exports.profile = async (req, res) => {
  let allListing = await Listing.find({ owner: req.user._id })
    .populate("owner")
    .sort({ _id: -1 });
  let allReview = await Review.find({ author: req.user._id })
    .populate("listing", "title image location country")
    .sort({ createAt: -1 });
  const myBookings = await Booking.find({ guest: req.user._id, status: "confirmed" }).select("_id");
  const hostReservations = allListing.length ? await Booking.countDocuments({ listing: { $in: allListing.map((place) => place._id) }, status: "confirmed" }) : 0;
  const tripCount = await Trip.countDocuments({ owner: req.user._id });
  const hostVerification = await HostVerification.findOne({ user: req.user._id });
  const canReviewVerifications = Boolean(process.env.VERIFICATION_ADMIN_EMAIL)
    && String(req.user.email || "").toLowerCase() === String(process.env.VERIFICATION_ADMIN_EMAIL).trim().toLowerCase();
  res.render("profiles/profile.ejs", { allListing, allReview, bookingCount: myBookings.length, hostReservations, tripCount, savedCount: req.user.savedListings?.length || 0, hostVerification, canReviewVerifications });
};

module.exports.allListingDestroy = async (req, res, next) => {
  let { id } = req.params;
  let deleteListing = await Listing.deleteMany({ owner: id });
  req.flash("success", `${deleteListing.deletedCount} places removed.`);
  res.redirect("/profile");
};
module.exports.profileDestroyListing = async (req, res, next) => {
  let { id } = req.params;
  let deleteListing = await Listing.findByIdAndDelete(id);
  console.log(deleteListing);
  req.flash("success", "Your place has been removed.");
  console.log("delete");
  res.redirect("/profile");
};

module.exports.allReviewDestroy = async (req, res, next) => {
  let { id } = req.params;
  let allReview = await Review.find({ author: id });
  for (const reviewOne of allReview) {
    await Listing.findByIdAndUpdate(reviewOne.listing, {
      $pull: { reviews: reviewOne._id },
    });
    await Review.findByIdAndDelete(reviewOne._id);
  }
  req.flash("success", `${allReview.length} reviews removed.`);
  res.redirect("/profile");
};

module.exports.profileDestroyReview = async (req, res, next) => {
  let { id, reviewId } = req.params;
  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "Your review has been removed.");
  res.redirect("/profile");
};
