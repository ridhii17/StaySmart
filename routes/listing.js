const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const Listing = require("../models/listing");
const { isLoggedIn, isOwner, validateListing } = require("../middleware");
const ListingController = require("../controllers/listings");
const multer = require("multer");
const { storage } = require("../cloudConfig");
const upload = multer({ storage });

router
  .route("/")
  .get(wrapAsync(ListingController.index)) // Index Route
  .post(
    //Create Route
    isLoggedIn,
    upload.single("listing[image]"),
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
    upload.single("listing[image]"),
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

module.exports = router;
