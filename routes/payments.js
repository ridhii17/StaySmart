const express = require("express");
const router = express.Router();
const payments = require("../controllers/payments");
const { isLoggedIn, rateLimit } = require("../middleware");

const paymentLimit = rateLimit({ scope: "payment", windowMs: 10 * 60 * 1000, max: 8 });

router.post("/bookings/payment/order", isLoggedIn, paymentLimit, payments.createOrder);
router.post("/bookings/payment/verify", isLoggedIn, paymentLimit, payments.verifyPayment);

module.exports = router;
