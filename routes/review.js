const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");
const Review = require("../models/review");
const Listing = require("../models/listing");
const { validateReview, isLoggedIn, isReviewAuthor, rateLimit } = require("../middleware");

const reviewController = require("../controllers/reviews");

//Reviews
//Post Route
router.post(
  "/",
  isLoggedIn,
  rateLimit({ scope: "create-review", windowMs: 60 * 60 * 1000, max: 10 }),
  validateReview,
  wrapAsync(reviewController.createReview)
);

//Delete Reviews Route
router.delete(
  "/:reviewId",
  isLoggedIn,
  isReviewAuthor,
  wrapAsync(reviewController.destroyReview)
);

module.exports = router;
