const express = require("express");
const router = express.Router();
const { isLoggedIn, rateLimit } = require("../middleware");
const verification = require("../controllers/host-verification");
const wrapAsync = require("../utils/wrapAsync");

router.get("/host/verification", isLoggedIn, wrapAsync(verification.renderForm));
router.post(
  "/host/verification",
  isLoggedIn,
  rateLimit({ scope: "host-verification", windowMs: 24 * 60 * 60 * 1000, max: 3 }),
  wrapAsync(verification.submitRequest),
);
router.get("/admin/host-verifications", isLoggedIn, wrapAsync(verification.adminQueue));
router.post(
  "/admin/host-verifications/:id",
  isLoggedIn,
  rateLimit({ scope: "host-verification-review", windowMs: 60 * 60 * 1000, max: 30 }),
  wrapAsync(verification.decideRequest),
);

module.exports = router;
