const mongoose = require("mongoose");
const { Schema } = mongoose;

const hostVerificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  businessName: { type: String, required: true, trim: true, maxlength: 120 },
  evidenceUrl: { type: String, trim: true, maxlength: 500 },
  verificationDetails: { type: String, required: true, trim: true, maxlength: 1200 },
  status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending", index: true },
  reviewer: { type: Schema.Types.ObjectId, ref: "User" },
  reviewerNote: { type: String, trim: true, maxlength: 500 },
  reviewedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model("HostVerification", hostVerificationSchema);
