const axios = require("axios");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const { getTrustScore, scoreListing } = require("../utils/stay-smart");
const textQuery = (value) => typeof value === "string" ? value.trim().slice(0, 80) : "";
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function decorateListings(listings, user) {
  for (const listing of listings) {
    listing.trustScore = getTrustScore(listing, listing.owner);
    listing.isSaved = Boolean(user?.savedListings?.some((id) => id.equals(listing._id)));
  }
}

module.exports.index = async (req, res) => {
  const { destination: rawDestination = "", checkIn: rawCheckIn = "", checkOut: rawCheckOut = "", guests = "", minPrice: rawMinPrice = "", maxPrice: rawMaxPrice = "", propertyType: rawPropertyType = "", amenities = "", page = "1" } = req.query;
  const destination = textQuery(rawDestination);
  const checkIn = textQuery(rawCheckIn);
  const checkOut = textQuery(rawCheckOut);
  const minPrice = textQuery(rawMinPrice);
  const maxPrice = textQuery(rawMaxPrice);
  const propertyType = textQuery(rawPropertyType);
  const escapedDestination = escapeRegex(destination);
  const query = {};
  const andClauses = [];
  if (destination) andClauses.push({ $or: [
    { title: { $regex: escapedDestination, $options: "i" } },
    { location: { $regex: escapedDestination, $options: "i" } },
    { country: { $regex: escapedDestination, $options: "i" } },
  ] });
  if (propertyType === "Home") andClauses.push({ $or: [{ propertyType: "Home" }, { propertyType: { $exists: false } }] });
  else if (propertyType) query.propertyType = propertyType;
  const guestCount = typeof guests === "string" ? Number(guests) : 0;
  if (Number.isInteger(guestCount) && guestCount > 0) {
    if (guestCount <= 2) andClauses.push({ $or: [{ capacity: { $gte: guestCount } }, { capacity: { $exists: false } }] });
    else query.capacity = { $gte: Math.min(30, guestCount) };
  }
  if (andClauses.length) query.$and = andClauses;
  const price = {};
  if (Number.isFinite(Number(minPrice)) && Number(minPrice) >= 0 && minPrice !== "") price.$gte = Math.min(100000000, Number(minPrice));
  if (Number.isFinite(Number(maxPrice)) && Number(maxPrice) > 0) price.$lte = Math.min(100000000, Number(maxPrice));
  if (Object.keys(price).length) query.price = price;
  const selectedAmenities = (Array.isArray(amenities) ? amenities : typeof amenities === "string" && amenities ? [amenities] : []).filter((item) => typeof item === "string").slice(0, 20);
  if (selectedAmenities.length) query.amenities = { $all: selectedAmenities };
  const parsedPage = Math.max(1, Math.min(1000, parseInt(page, 10) || 1));
  const pageSize = 9;
  const isDateOnly = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const validDates = checkIn && checkOut && isDateOnly(checkIn) && isDateOnly(checkOut);
  const checkInDate = validDates ? new Date(`${checkIn}T00:00:00`) : null;
  const checkOutDate = validDates ? new Date(`${checkOut}T00:00:00`) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if ((checkIn || checkOut) && (!validDates || checkInDate < today || checkOutDate <= checkInDate)) {
    req.flash("error", "Choose a future check-in date and a later check-out date.");
  } else if (validDates) {
    const conflicts = await Booking.find({ status: "confirmed", checkIn: { $lt: checkOutDate }, checkOut: { $gt: checkInDate } }).distinct("listing");
    query._id = { $nin: conflicts };
  }
  const count = await Listing.countDocuments(query);
  const listings = await Listing.find(query).populate("owner", "username email fName image hostVerificationStatus").populate("reviews", "rating")
    .sort({ _id: -1 }).skip((parsedPage - 1) * pageSize).limit(pageSize);
  for (const listing of listings) {
    listing.trustScore = getTrustScore(listing);
    listing.matchScore = scoreListing(listing, { destination, budget: maxPrice, guests: guests || 1, amenities: selectedAmenities }).score;
    listing.isSaved = Boolean(req.user?.savedListings?.some((id) => id.equals(listing._id)));
  }
  res.render("listings/index", { listings, search: { destination, checkIn, checkOut, guests, minPrice, maxPrice, propertyType, amenities: selectedAmenities }, page: parsedPage, pageCount: Math.ceil(count / pageSize), totalCount: count });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  if (!require("mongoose").Types.ObjectId.isValid(id)) {
    req.flash("error", "This place could not be found.");
    return res.redirect("/listings");
  }
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
  if (!listing) {
    req.flash("error", "This place could not be found.");
    return res.redirect("/listings");
  }
  const reviewCount = listing.reviews.length;
  const averageRating = reviewCount
    ? (
        listing.reviews.reduce((total, review) => total + review.rating, 0) /
        reviewCount
      ).toFixed(1)
    : null;
  const trustScore = getTrustScore(listing, listing.owner);
  const escapedLocation = escapeRegex(String(listing.location || "").slice(0, 80));
  const alternatives = await Listing.find({ _id: { $ne: listing._id }, location: { $regex: escapedLocation, $options: "i" }, price: { $lte: Math.ceil((listing.price || 0) * 1.35) }, $or: [{ capacity: { $gte: listing.capacity || 2 } }, { capacity: { $exists: false } }] })
    .populate("reviews", "rating").sort({ price: 1 }).limit(4);
  const listingSaved = Boolean(req.user?.savedListings?.some((savedId) => savedId.equals(listing._id)));
  res.render("listings/show", { listing, reviewCount, averageRating, trustScore, alternatives, listingSaved });
};

module.exports.createListing = async (req, res, next) => {
  try {
    const geoKey = process.env.GEOAPIFY_KEY;
    //Create listing first
    const listingDetails = { ...req.body.listing };
    listingDetails.amenities = Array.isArray(listingDetails.amenities) ? listingDetails.amenities : listingDetails.amenities ? [listingDetails.amenities] : [];
    const newListing = new Listing(listingDetails);
    //Get uploaded image
    const coverPhoto = req.files?.["listing[image]"]?.[0];
    if (coverPhoto) {
      newListing.image = {
        url: coverPhoto.path,
        filename: coverPhoto.filename,
      };
    }
    newListing.images = (req.files?.["listing[gallery]"] || []).map((file) => ({ url: file.path, filename: file.filename }));
    //Owner
    newListing.owner = req.user._id;
    if (req.user.role !== "host") await req.user.updateOne({ role: "host" });
    // Geoapify geocode
    const locationText = `${req.body.listing.location}, ${req.body.listing.country}`;
    const geoRes = await axios.get(
      "https://api.geoapify.com/v1/geocode/search",
      {
        params: {
          text: locationText,
          apiKey: geoKey,
          format: "json",
          limit: 1,
        },
      },
    );

    const result = geoRes.data.results[0];
    if (!result) {
      req.flash("error", "We couldn't find that location. Try adding a nearby city.");
      return res.redirect("/listings/new");
    }
    //Now add geometry
    newListing.geometry = {
      type: "Point",
      coordinates: [result.lon, result.lat],
    };

    // Save
    await newListing.save();

    req.flash("success", "Your place is now live.");
    res.redirect("/listings");
  } catch (err) {
    next(err);
  }
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "This place could not be found.");
    return res.redirect("/listings");
  }
  let originalImageUrl = listing.image?.url || "/Icon/listing-img-pre.png";
  if (listing.image?.url) originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
  res.render("listings/edit", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  const updates = { ...req.body.listing };
  updates.amenities = Array.isArray(updates.amenities) ? updates.amenities : updates.amenities ? [updates.amenities] : [];
  let listing = await Listing.findByIdAndUpdate(id, { ...updates }, { new: true, runValidators: true });
  if (!listing) return res.status(404).render("listings/error", { statusCode: 404, message: "This place could not be found." });

  const coverPhoto = req.files?.["listing[image]"]?.[0];
  if (coverPhoto) {
    let url = coverPhoto.path;
    let filename = coverPhoto.filename;
    listing.image = { url, filename };
  }
  const galleryPhotos = req.files?.["listing[gallery]"] || [];
  if (galleryPhotos.length) listing.images.push(...galleryPhotos.map((file) => ({ url: file.path, filename: file.filename })));
  await listing.save();

  req.flash("success", "Your changes have been saved.");
  res.redirect(`/listings/${id}`); // redirect to show page
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Your place has been removed.");
  res.redirect("/listings");
};

module.exports.removeGalleryImage = async (req, res) => {
  if (!require("mongoose").Types.ObjectId.isValid(req.params.imageId)) {
    req.flash("error", "That gallery photo could not be found.");
    return res.redirect(`/listings/${req.params.id}/edit`);
  }
  const listing = await Listing.findById(req.params.id);
  const photo = listing?.images?.id(req.params.imageId);
  if (!listing || !photo) {
    req.flash("error", "That gallery photo could not be found.");
  } else {
    photo.deleteOne();
    await listing.save();
    req.flash("success", "Gallery photo removed.");
  }
  res.redirect(`/listings/${req.params.id}/edit`);
};

//-------ADD-------
//-------ADD-------
module.exports.filter = async (req, res, next) => {
  let { id } = req.params;
  let listings = await Listing.find({ category: { $all: [id] } }).populate("reviews", "rating").populate("owner", "username email fName image hostVerificationStatus");
  if (listings.length != 0) {
    decorateListings(listings, req.user);
    res.locals.totalCount = listings.length;
    res.locals.success = `Showing stays in ${id}`;
    res.render("listings/index.ejs", { listings });
  } else {
    req.flash("error", "No stays match this category yet.");
    res.redirect("/listings");
  }
};

module.exports.filterbtn = (req, res, next) => {
  res.render("listings/filterbtn.ejs");
};

module.exports.search = async (req, res) => {
  let input = textQuery(req.query.q).replace(/\s+/g, " ");
  if (input == "" || input == " ") {
    //search value empty
    req.flash("error", "Enter a destination or property name to search.");
    return res.redirect("/listings");
  }

  // convert every word 1st latter capital and other small---------------
  let data = input.split("");
  let element = "";
  let flag = false;
  for (let index = 0; index < data.length; index++) {
    if (index == 0 || flag) {
      element = element + data[index].toUpperCase();
    } else {
      element = element + data[index].toLowerCase();
    }
    flag = data[index] == " ";
  }
  const searchPattern = escapeRegex(element);
  let listings = await Listing.find({
    title: { $regex: searchPattern, $options: "i" },
  }).populate("reviews", "rating").populate("owner", "username email fName image hostVerificationStatus");
  if (listings.length != 0) {
    decorateListings(listings, req.user);
    res.locals.totalCount = listings.length;
    res.locals.success = `Showing stays matching “${element}”`;
    res.render("listings/index.ejs", { listings });
    return;
  }
  if (listings.length == 0) {
    listings = await Listing.find({
      category: { $regex: searchPattern, $options: "i" },
    })
      .sort({ _id: -1 })
      .populate("reviews", "rating").populate("owner", "username email fName image hostVerificationStatus");
    if (listings.length != 0) {
      decorateListings(listings, req.user);
      res.locals.totalCount = listings.length;
      res.locals.success = `Showing stays matching “${element}”`;
      res.render("listings/index.ejs", { listings });
      return;
    }
  }
  if (listings.length == 0) {
    listings = await Listing.find({
      country: { $regex: searchPattern, $options: "i" },
    })
      .sort({ _id: -1 })
      .populate("reviews", "rating").populate("owner", "username email fName image hostVerificationStatus");
    if (listings.length != 0) {
      decorateListings(listings, req.user);
      res.locals.totalCount = listings.length;
      res.locals.success = `Showing stays matching “${element}”`;
      res.render("listings/index.ejs", { listings });
      return;
    }
  }
  if (listings.length == 0) {
    listings = await Listing.find({
      location: { $regex: searchPattern, $options: "i" },
    })
      .sort({ _id: -1 })
      .populate("reviews", "rating").populate("owner", "username email fName image hostVerificationStatus");
    if (listings.length != 0) {
      decorateListings(listings, req.user);
      res.locals.totalCount = listings.length;
      res.locals.success = `Showing stays matching “${element}”`;
      res.render("listings/index.ejs", { listings });
      return;
    }
  }
  const intValue = parseInt(element, 10); // 10 for decimal return - int ya NaN
  const intDec = Number.isInteger(intValue); // check intValue is Number & Not Number return - true ya false

  if (listings.length == 0 && intDec) {
    listings = await Listing.find({ price: { $lte: element } })
      .sort({ price: 1 })
      .populate("reviews", "rating").populate("owner", "username email fName image hostVerificationStatus");
    if (listings.length != 0) {
      decorateListings(listings, req.user);
      res.locals.totalCount = listings.length;
      res.locals.success = `Showing stays under ₹${element}`;
      res.render("listings/index.ejs", { listings: listings });
      return;
    }
  }
  if (listings.length == 0) {
    req.flash("error", "No stays match your search. Try another destination.");
    res.redirect("/listings");
  }
};

// module.exports.createListing = async (req, res, next) => {
//   // let response = await geocodingClient
//   //   .forwardGeocode({
//   //     query: req.body.listing.location,
//   //     limit: 1,
//   //   })
//   //   .send();

//   let url = req.file.path;
//   let filename = req.file.filename;

//   const newListing = new Listing(req.body.listing);
//   newListing.owner = req.user._id; // add owner
//   newListing.image = { url, filename };

//   // newListing.geometry = response.body.features[0].geometry;

//   let savedListing = await newListing.save();

//   req.flash("success", "Successfully created a new listing!");
//   res.redirect("/listings");
// };
