const express = require("express");
const router = express.Router();
const User = require("../models/user");
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
// const { saveRedirectUrl } = require("../middleware");
// -----ADD-----
// -----ADD-----
const {
  saveRedirectUrl,
  isLoggedIn,
  isProfileOwner,
  validateUser,
  verifyEmail,
  verifyUserEmail,
  rateLimit,
} = require("../middleware");

const userController = require("../controllers/users");
// -----ADD-----
// -----ADD-----
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

// Signup Route
router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(wrapAsync(userController.signup));

router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    saveRedirectUrl,
    rateLimit({ scope: "login", windowMs: 15 * 60 * 1000, max: 10 }),
    passport.authenticate("local", {
      failureRedirect: "/login", // redirect to login page
      failureFlash: true, //when username or password is incorrect
    }),
    userController.login
  );

//Logout Route
router.get("/logout", userController.logout);

// ------ADD-----
// ------ADD-----

router.get("/", (req, res) => {
  //redirect home page---------
  res.redirect("/listings");
});
router.get(
  "/update-form/:id",
  isLoggedIn,
  isProfileOwner,
  wrapAsync(userController.updateFormRender)
); //update  form render------------

router.post(
  "/update-password/:id",
  isLoggedIn,
  isProfileOwner,
  wrapAsync(userController.updatePassword)
); //update password ------------

router.post(
  "/update-account/:id",
  isLoggedIn,
  isProfileOwner,
  verifyUserEmail,
  validateUser,
  wrapAsync(userController.updateAccount)
); //update account------------

router.post(
  "/update-image/:id",
  isLoggedIn,
  isProfileOwner,
  upload.single("image"),
  wrapAsync(userController.updateImage)
); //update image------------

router
  .route("/change-image/:id")
  .get(isLoggedIn, isProfileOwner, userController.renderImageChangeForm)
  .post(
    isLoggedIn,
    isProfileOwner,
    upload.single("image"),
    wrapAsync(userController.updateImage)
  ); //update image------------

router.delete(
  "/delete/:id",
  isLoggedIn,
  isProfileOwner,
  wrapAsync(userController.deleteAccount)
); //delete account------------

module.exports = router;
