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
}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);
