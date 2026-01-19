const mongoose = require("mongoose");
const Schema = mongoose.Schema; // bar bar na likhna pve mongoose.schema
const Review = require("./review");

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


const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
