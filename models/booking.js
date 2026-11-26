const mongoose = require("mongoose");
const { Schema } = mongoose;

const bookingSchema = new Schema({
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
  status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed", index: true },
  paymentProvider: { type: String, enum: ["demo", "razorpay"], default: "demo" },
  paymentStatus: { type: String, enum: ["demo", "paid", "refund_pending", "refunded"], default: "demo" },
  paymentOrderId: { type: String, unique: true, sparse: true },
  paymentId: String,
}, { timestamps: true });

bookingSchema.index({ listing: 1, status: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ guest: 1, checkIn: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
