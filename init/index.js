const mongoose = require("mongoose");
require("dotenv").config();
const initData = require("./data.js");
const Listing = require("../models/listing");

const MONGO_URL = process.env.ATLAS_URL || "mongodb://localhost:27017/StaySphere";

console.log("Seeding script started...");

async function main() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("Connected to MongoDB");

    const result = await Listing.bulkWrite(
      initData.map((listing) => ({
        updateOne: {
          filter: { title: listing.title },
          update: { $setOnInsert: listing },
          upsert: true,
        },
      })),
    );

    console.log(`Sample listings added: ${result.upsertedCount}`);
  } catch (err) {
    console.log("Error:", err);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
}

main();
