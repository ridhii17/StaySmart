const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentIntentSchema = new Schema({
  guest: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  guests: { type: Number, min: 1, required: true },
  nightlyRate: { type: Number, required: true },
  nights: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  serviceFee: { type: Number, required: true },
  cleaningFee: { type: Number, required: true },
  total: { type: Number, required: true },
  currency: { type: String, default: "INR", required: true },
  providerOrderId: { type: String, unique: true, sparse: true },
  paymentId: String,
  status: { type: String, enum: ["pending", "paid", "failed", "refund_pending", "refunded"], default: "pending", index: true },
  // This is a checkout deadline, not a retention deadline. Keep expired
  // intents available for payment reconciliation and refund support.
  expiresAt: Date,
}, { timestamps: true });

module.exports = mongoose.model("PaymentIntent", paymentIntentSchema);
