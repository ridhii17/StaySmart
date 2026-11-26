const Listing = require("./models/listing");
const Review = require("./models/review");
const User = require("./models/user");
const RequestCounter = require("./models/request-counter");
const { createHash } = require("crypto");
const ExpressError = require("./utils/ExpressError");
const { listingSchema, reviewSchema , userSchema} = require("./schema");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "Sign in to share a place with travelers.");
    return res.redirect("/login");
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

module.exports.isOwner = async (req, res, next) => {
  let { id } = req.params;
  let listing = await Listing.findById(id);
  if (!listing || !listing.owner) {
    req.flash("error", "This place could not be found.");
    return res.redirect("/listings");
  }
  if (!listing.owner._id.equals(res.locals.currentUser._id)) {
    req.flash("error", "Permission Denied!");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

// -----ADD------
// -----ADD------
module.exports.isOwnerAll = async (req, res, next) => {
  try {
    let { id } = req.params;
    console.log(id);
    let listing = await Listing.findOne({ owner: id });
    console.log(listing);
    if (!listing) {
      req.flash("error", "You don't have any places yet.");
      return res.redirect(`/profile`);
    }
    if (!listing.owner.equals(res.locals.currentUser._id)) {
      req.flash("error", "You don't manage this place.");
      return res.redirect(`/listings`);
    }
    next();
  } catch (err) {
    next(new ExpressError(400, "This place page is not available."));
  }
};

//Vadilate Schema Middleware
module.exports.validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);
  if (error) {
    throw new ExpressError(400, error.details[0].message);
  } else {
    next();
  }
};

//Validate Review Middleware
module.exports.validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    throw new ExpressError(400, error.details[0].message);
  } else {
    next();
  }
};

module.exports.isReviewAuthor = async (req, res, next) => {
  let { id, reviewId } = req.params;
  let review = await Review.findById(reviewId);
  if (!review.author._id.equals(res.locals.currentUser._id)) {
    req.flash("error", "Permission Denied!");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

// -----ADD------
// -----ADD------
module.exports.isReviewAuthorProfile = async (req, res, next) => {
  try {
    let { id, reviewId } = req.params;
    
    let review = await Review.findById(reviewId);
    if (!review.author.equals(res.locals.currentUser._id)) {
      req.flash("error", "You are not the author of this review");
      return res.redirect(`/listings`);
    }
    next();
  } catch {
    next(new ExpressError(400, "This Review Page is not valid..."));
  }
};

module.exports.isReviewAll = async (req, res, next) => {
  try {
    let { id } = req.params;
    let review = await Review.findOne({ author: id });
    if (!review) {
      req.flash("error", "You don't have any reviews...");
      return res.redirect(`/profile`);
    }
    if (!review.author.equals(res.locals.currentUser._id)) {
      req.flash("error", "You are not the author of this review...");
      return res.redirect(`/listings`);
    }
    next();
  } catch {
    next(new ExpressError(400, "This Review Page is not valid..."));
  }
};

module.exports.isProfileOwner = async (req, res, next) => {
  try {
    let { id } = req.params;
    let user = await User.findById(id);
    if (!user._id.equals(res.locals.currentUser._id)) {
      req.flash("error", "You are not the profile owner.");
      return res.redirect(`/listings/${id}`);
    }
    next();
  } catch (err) {
    next(new ExpressError(400, "This Profile Page is not valid..."));
  }
};

module.exports.verifyEmail = async (req, res, next) => {
  let existingUser = await User.find({ email: `${req.body.email}` });
  if (existingUser.length == 0) {
    return next();
  }
  req.flash("error", "Account with that email address already exists.");
  if (!req.user) {
    return res.redirect("/signup");
  } else {
    return res.redirect(`/update-form/${req.user._id}`);
  }
};
module.exports.verifyUserEmail = async (req, res, next) => {
  let existingUser = await User.find({ email: `${req.body.email}` });
  if (existingUser.length == 0) {
    return next();
  }
  if (existingUser.length <= 1) {
    if (existingUser[0].email == req.user.email) {
      return next();
    }
  }
  req.flash("error", "Account with that email address already exists.");
  if (!req.user) {
    return res.redirect("/signup");
  } else {
    return res.redirect(`/update-form/${req.user._id}`);
  }
};

module.exports.validateUser = (req, res, next) => {
  let { error } = userSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    console.log(error);
    console.log(errMsg);
    req.flash("error", `${errMsg}`);
    if (!req.user) {
      return res.redirect("/signup");
    } else {
      return res.redirect(`/update-form/${req.user._id}`);
    }
  } else {
    next();
  }
};

module.exports.rateLimit = ({ scope, windowMs, max, skip = () => false }) => async (req, res, next) => {
  if (skip(req)) return next();
  const now = Date.now();
  const windowNumber = Math.floor(now / windowMs);
  const ipHash = createHash("sha256").update(String(req.ip || "unknown")).digest("hex");
  const key = `${scope}:${ipHash}:${windowNumber}`;
  const expiresAt = new Date((windowNumber + 1) * windowMs + 60000);

  try {
    let counter;
    try {
      counter = await RequestCounter.findOneAndUpdate(
        { key },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      counter = await RequestCounter.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
    }

    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - counter.count)));
    if (counter.count <= max) return next();

    const retryAfter = Math.max(1, Math.ceil(((windowNumber + 1) * windowMs - now) / 1000));
    res.set("Retry-After", String(retryAfter));
    if (req.path.startsWith("/api/")) return res.status(429).json({ error: "Too many requests. Please wait and try again." });
    return res.status(429).render("listings/error", { statusCode: 429, message: "Too many requests. Please wait a moment and try again." });
  } catch (error) {
    next(error);
  }
};

