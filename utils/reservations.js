const { randomUUID } = require("crypto");
const Listing = require("../models/listing");
const Booking = require("../models/booking");

async function withReservationLock(listingId, action) {
  const token = randomUUID();
  const now = new Date();
  const lock = await Listing.findOneAndUpdate(
    { _id: listingId, $or: [{ reservationLockUntil: { $lte: now } }, { reservationLockUntil: { $exists: false } }] },
    { $set: { reservationLockToken: token, reservationLockUntil: new Date(now.getTime() + 30000) } },
    { new: true },
  );
  if (!lock) return { busy: true };
  try {
    return await action();
  } finally {
    await Listing.updateOne({ _id: listingId, reservationLockToken: token }, { $unset: { reservationLockToken: 1, reservationLockUntil: 1 } });
  }
}

function availabilityFilter(listingId, checkIn, checkOut) {
  return {
    listing: listingId,
    status: "confirmed",
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };
}

async function isAvailable(listingId, checkIn, checkOut) {
  return !(await Booking.exists(availabilityFilter(listingId, checkIn, checkOut)));
}

module.exports = { withReservationLock, availabilityFilter, isAvailable };
