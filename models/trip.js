const mongoose = require("mongoose");
const { Schema } = mongoose;

const expenseSchema = new Schema({
  label: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, enum: ["accommodation", "food", "transport", "activities", "other"], default: "other" },
  payer: { type: String, required: true, trim: true, maxlength: 60 },
  amount: { type: Number, required: true, min: 0.01 },
  splitBetween: [{ type: String, trim: true, maxlength: 60 }],
  spentAt: { type: Date, default: Date.now },
}, { timestamps: true });

const tripSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  destination: { type: String, required: true, trim: true, maxlength: 100 },
  startDate: Date,
  endDate: Date,
  travelerCount: { type: Number, min: 1, default: 2 },
  budget: { type: Number, min: 0, default: 0 },
  studentMode: { type: Boolean, default: false },
  participants: [{ type: String, trim: true, maxlength: 60 }],
  selectedListings: [{ type: Schema.Types.ObjectId, ref: "Listing" }],
  expenses: [expenseSchema],
}, { timestamps: true });

module.exports = mongoose.model("Trip", tripSchema);
