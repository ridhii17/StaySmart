const mongoose = require("mongoose");
const crypto = require("crypto");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const PaymentIntent = require("../models/payment-intent");
const { calculatePrice } = require("../utils/stay-smart");
const { withReservationLock, availabilityFilter } = require("../utils/reservations");
const razorpay = require("../utils/razorpay");

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

function priceInPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

async function refundCapturedPayment(paymentId, total, receipt) {
  const refund = await razorpay.refundPayment(paymentId, priceInPaise(total), receipt);
  if (refund.status === "processed") return "refunded";
  if (refund.status === "pending" || refund.status === "queued") return "refund_pending";
  throw new Error("The payment provider did not accept the refund.");
}

async function makeBookingFromPaidIntent(intent, payment) {
  if (["refund_pending", "refunded"].includes(intent.status)) {
    return { expired: true, paymentStatus: intent.status };
  }
  if (intent.status === "paid") {
    const existing = await Booking.findOne({ paymentOrderId: intent.providerOrderId });
    if (existing) return { booking: existing };
  }

  if (new Date() > intent.expiresAt) {
    const paymentStatus = await refundCapturedPayment(payment.id, intent.total, `expired_${intent._id}`);
    intent.status = paymentStatus;
    intent.paymentId = payment.id;
    await intent.save();
    return { expired: true, paymentStatus };
  }

  const result = await withReservationLock(intent.listing, async () => {
    const duplicate = await Booking.findOne({ paymentOrderId: intent.providerOrderId });
    if (duplicate) return { booking: duplicate };
    const overlap = await Booking.exists(availabilityFilter(intent.listing, intent.checkIn, intent.checkOut));
    if (overlap) return { conflict: true };
    const booking = await Booking.create({
      guest: intent.guest,
      listing: intent.listing,
      checkIn: intent.checkIn,
      checkOut: intent.checkOut,
      guests: intent.guests,
      nightlyRate: intent.nightlyRate,
      nights: intent.nights,
      subtotal: intent.subtotal,
      serviceFee: intent.serviceFee,
      cleaningFee: intent.cleaningFee,
      total: intent.total,
      status: "confirmed",
      paymentProvider: "razorpay",
      paymentStatus: "paid",
      paymentOrderId: intent.providerOrderId,
      paymentId: payment.id,
    });
    return { booking };
  });

  if (result.busy || result.conflict) {
    const paymentStatus = await refundCapturedPayment(payment.id, intent.total, `unavailable_${intent._id}`);
    intent.status = paymentStatus;
    intent.paymentId = payment.id;
    await intent.save();
    return { conflict: true, paymentStatus };
  }

  intent.status = "paid";
  intent.paymentId = payment.id;
  intent.expiresAt = undefined;
  await intent.save();
  return { booking: result.booking };
}

module.exports.createOrder = async (req, res) => {
  if (!razorpay.isConfigured()) return res.status(503).json({ error: "Online payment is not configured. Use demo checkout or add Razorpay test keys." });
  const pending = req.session.pendingBooking;
  if (!pending || !validId(pending.listingId)) return res.status(400).json({ error: "Your checkout expired. Choose dates again." });

  const listing = await Listing.findById(pending.listingId);
  if (!listing) return res.status(404).json({ error: "This stay is no longer available." });
  const checkIn = new Date(pending.checkIn);
  const checkOut = new Date(pending.checkOut);
  const price = calculatePrice(Number(listing.price), checkIn, checkOut);
  if (!price || !Number.isInteger(Number(pending.guests)) || Number(pending.guests) < 1 || Number(pending.guests) > (listing.capacity || 2)) {
    return res.status(400).json({ error: "The reservation details are no longer valid. Please choose your dates again." });
  }

  const availability = await withReservationLock(listing._id, () => Booking.exists(availabilityFilter(listing._id, checkIn, checkOut)));
  if (availability?.busy) return res.status(409).json({ error: "Availability is being updated. Please try again." });
  if (availability) return res.status(409).json({ error: "Those dates have just been booked. Please choose different dates." });

  const intentData = {
    guest: req.user._id,
    listing: listing._id,
    checkIn,
    checkOut,
    guests: Number(pending.guests),
    nightlyRate: Number(listing.price),
    ...price,
    currency: "INR",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  };
  const receipt = `ss_${crypto.randomUUID().replaceAll("-", "").slice(0, 32)}`;
  let order;
  try {
    order = await razorpay.createOrder({
      amount: priceInPaise(price.total),
      receipt,
      notes: { listingId: String(listing._id), guestId: String(req.user._id) },
    });
  } catch (error) {
    console.error("Razorpay order request failed:", error.response?.status || error.code || "request failed");
    return res.status(502).json({ error: "Secure payment could not be started. Please try again in a moment." });
  }
  const intent = await PaymentIntent.create({ ...intentData, providerOrderId: order.id });
  req.session.pendingPaymentIntentId = String(intent._id);
  req.session.pendingBooking = { ...pending, price, nightlyRate: Number(listing.price) };

  res.json({
    keyId: process.env.RAZORPAY_KEY_ID,
    order: { id: order.id, amount: order.amount, currency: order.currency },
    listingTitle: listing.title,
    guestName: `${req.user.fName || ""} ${req.user.lName || ""}`.trim() || req.user.username,
    guestEmail: req.user.email,
  });
};

module.exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id: submittedOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
  if (!submittedOrderId || !paymentId || !signature) return res.status(400).json({ error: "Payment confirmation details are incomplete." });
  const intent = await PaymentIntent.findOne({ providerOrderId: submittedOrderId, guest: req.user._id });
  if (!intent) return res.status(400).json({ error: "This payment order does not belong to your session." });
  if (!razorpay.verifyCheckoutSignature(intent.providerOrderId, paymentId, signature)) {
    return res.status(400).json({ error: "Payment verification failed. No reservation was created." });
  }

  let payment;
  let result;
  try {
    payment = await razorpay.fetchPayment(paymentId);
    const expectedAmount = priceInPaise(intent.total);
    if (payment.order_id !== intent.providerOrderId || payment.amount !== expectedAmount || payment.currency !== "INR") {
      return res.status(400).json({ error: "The payment amount or order did not match this reservation." });
    }
    if (payment.status === "authorized") payment = await razorpay.capturePayment(payment.id, expectedAmount);
    if (payment.status !== "captured") return res.status(402).json({ error: "Payment has not been captured. Please try again or contact support." });
    result = await makeBookingFromPaidIntent(intent, payment);
  } catch (error) {
    console.error("Razorpay payment confirmation failed:", error.response?.status || error.code || "request failed");
    return res.status(502).json({ error: "Payment confirmation is delayed. Do not pay again; refresh My Trips shortly or contact support." });
  }
  if (result.expired) return res.status(409).json({ error: result.paymentStatus === "refunded" ? "Checkout expired; the payment was refunded." : "Checkout expired; a refund is being processed." });
  if (result.conflict) return res.status(409).json({ error: result.paymentStatus === "refunded" ? "The dates were booked first, so your payment was refunded." : "The dates were booked first; a refund is being processed." });

  delete req.session.pendingBooking;
  delete req.session.pendingPaymentIntentId;
  req.flash("success", "Payment confirmed and your stay is reserved.");
  res.json({ success: true, redirectUrl: "/my-trips" });
};

module.exports.webhook = async (req, res) => {
  if (!razorpay.isConfigured() || !process.env.RAZORPAY_WEBHOOK_SECRET) return res.status(503).send("Payment webhook is not configured.");
  const signature = req.get("x-razorpay-signature");
  if (!razorpay.verifyWebhookSignature(req.body, signature)) return res.status(400).send("Invalid webhook signature.");

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid webhook payload.");
  }

  if (event.event === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    const intent = payment?.order_id ? await PaymentIntent.findOne({ providerOrderId: payment.order_id }) : null;
    if (intent && payment.amount === priceInPaise(intent.total) && payment.currency === "INR") {
      await makeBookingFromPaidIntent(intent, payment);
    }
  } else if (event.event === "refund.processed") {
    const refund = event.payload?.refund?.entity;
    if (refund?.payment_id) {
      await Booking.updateOne({ paymentId: refund.payment_id }, { $set: { paymentStatus: "refunded" } });
      await PaymentIntent.updateOne({ paymentId: refund.payment_id }, { $set: { status: "refunded" } });
    }
  }

  res.status(200).json({ received: true });
};

module.exports.issueBookingRefund = async (booking) => {
  const refund = await razorpay.refundPayment(
    booking.paymentId,
    priceInPaise(booking.total),
    `cancel_${String(booking._id).slice(-29)}`,
  );
  booking.paymentStatus = refund.status === "processed" ? "refunded" : "refund_pending";
  await booking.save();
  return refund;
};
