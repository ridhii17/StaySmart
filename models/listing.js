const mongoose = require("mongoose");
const Schema = mongoose.Schema; // bar bar na likhna pve mongoose.schema
const Review = require("./review");
const stayPassport = require("../utils/stay-passport");

const listingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: {
    type: String,
    required: true,
  },
  image: {
    url: String,
    filename: String,
  },
  images: [{ url: String, filename: String }],
  price: Number,
  location: String,
  country: String,
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  geometry: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      default: undefined,
    },
  },

  category: {
    type: [String],
  },
  propertyType: { type: String, default: "Home" },
  capacity: { type: Number, min: 1, default: 2 },
  amenities: { type: [String], default: [] },
  travelStyles: { type: [{ type: String, enum: stayPassport.styles }], default: [] },
  accessibilityFeatures: { type: [{ type: String, enum: stayPassport.accessibilityFeatures }], default: [] },
  ecoPractices: { type: [{ type: String, enum: stayPassport.ecoPractices }], default: [] },
  reservationLockToken: { type: String, select: false },
  reservationLockUntil: { type: Date, select: false },
});

listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

// -------ADD-------
// -------ADD-------
listingSchema.pre(
  "deleteMany",
  { document: false, query: true },
  async function () {
    const listings = await this.model.find(this.getFilter()); // Get listings being deleted
    const reviewIds = listings.flatMap((listing) => listing.reviews); // Extract review IDs
    await Review.deleteMany({ _id: { $in: reviewIds } }); // Delete associated reviews
  }
);


listingSchema.index({ owner: 1, _id: -1 });
listingSchema.index({ category: 1 });
listingSchema.index({ amenities: 1, price: 1 });
listingSchema.index({ propertyType: 1, price: 1 });
listingSchema.index({ travelStyles: 1 });
listingSchema.index({ accessibilityFeatures: 1 });
listingSchema.index({ ecoPractices: 1 });

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
