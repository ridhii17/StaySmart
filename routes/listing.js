const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const Listing = require("../models/listing");
const { isLoggedIn, isOwner, validateListing, rateLimit } = require("../middleware");
const ListingController = require("../controllers/listings");
const multer = require("multer");
const { storage } = require("../cloudConfig");
const upload = multer({ storage });
const listingImages = upload.fields([
  { name: "listing[image]", maxCount: 1 },
  { name: "listing[gallery]", maxCount: 8 },
]);

// -----ADD------
// -----ADD------
router.get("/filter/:id", wrapAsync(ListingController.filter));
router.get("/filterbtn", ListingController.filterbtn);

router.get("/search", wrapAsync(ListingController.search)); 
router
  .route("/")
  .get(wrapAsync(ListingController.index)) // Index Route
  .post(
    //Create Route
    isLoggedIn,
    rateLimit({ scope: "create-listing", windowMs: 24 * 60 * 60 * 1000, max: 20 }),
    listingImages,
    validateListing,
    wrapAsync(ListingController.createListing)
  );

//New Route
router.get("/new", isLoggedIn, ListingController.renderNewForm);

router
  .route("/:id")
  .get(wrapAsync(ListingController.showListing)) //Show Route
  .put(
    //Update Route
    isLoggedIn,
    isOwner,
    listingImages,
    validateListing,
    wrapAsync(ListingController.updateListing)
  )
  .delete(
    //Delete Route
    isLoggedIn,
    isOwner,
    wrapAsync(ListingController.destroyListing)
  );

//Edit Route
router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(ListingController.renderEditForm)
);

router.delete(
  "/:id/gallery/:imageId",
  isLoggedIn,
  isOwner,
  wrapAsync(ListingController.removeGalleryImage)
);

module.exports = router;
