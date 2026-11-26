const SERVICE_FEE_RATE = 0.08;
const CLEANING_FEE_RATE = 0.05;

function calculatePrice(nightlyRate, checkIn, checkOut) {
  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  if (!Number.isInteger(nights) || nights < 1) return null;
  const subtotal = nightlyRate * nights;
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
  const cleaningFee = Math.round(nightlyRate * CLEANING_FEE_RATE);
  return { nights, subtotal, serviceFee, cleaningFee, total: subtotal + serviceFee + cleaningFee };
}

function getTrustScore(listing, owner = listing.owner) {
  const reviews = listing.reviews || [];
  const rated = reviews.filter((review) => Number.isFinite(Number(review.rating)));
  const average = rated.length ? rated.reduce((sum, review) => sum + Number(review.rating), 0) / rated.length : 0;
  const ratingScore = rated.length ? (average / 5) * 30 : 15;
  const reviewScore = Math.min(rated.length / 10, 1) * 20;
  const hostScore = ((owner?.username ? 1 : 0) + (owner?.email ? 1 : 0) + (owner?.fName ? 1 : 0) + (owner?.image?.url ? 1 : 0)) * 5;
  const infoScore = ((listing.title ? 1 : 0) + (listing.description?.length >= 40 ? 1 : 0) + (listing.image?.url ? 1 : 0) + (listing.location ? 1 : 0) + (listing.country ? 1 : 0) + (listing.amenities?.length ? 1 : 0)) * 5;
  return Math.max(0, Math.min(100, Math.round(ratingScore + reviewScore + hostScore + infoScore)));
}

function scoreListing(listing, preferences = {}) {
  const destination = (preferences.destination || "").toLowerCase();
  const amenities = (preferences.amenities || []).map((item) => item.toLowerCase());
  const budget = Number(preferences.budget) || 0;
  const guests = Number(preferences.guests) || 1;
  const reviewRatings = (listing.reviews || []).map((review) => Number(review.rating)).filter(Number.isFinite);
  const rating = reviewRatings.length ? reviewRatings.reduce((a, b) => a + b, 0) / reviewRatings.length : 3;
  const destinationMatch = destination && `${listing.location} ${listing.country}`.toLowerCase().includes(destination) ? 1 : 0;
  const budgetMatch = !budget ? 0.5 : Math.max(0, Math.min(1, budget / Math.max(Number(listing.price) || 1, budget)));
  const capacityMatch = Math.min(1, (Number(listing.capacity) || 2) / guests);
  const matchedAmenities = amenities.filter((item) => (listing.amenities || []).some((amenity) => amenity.toLowerCase().includes(item))).length;
  const amenityMatch = amenities.length ? matchedAmenities / amenities.length : 0.5;
  const ratingMatch = rating / 5;
  const score = Math.round(destinationMatch * 30 + budgetMatch * 20 + capacityMatch * 15 + amenityMatch * 15 + ratingMatch * 20);
  const reasons = [];
  if (destinationMatch) reasons.push(`in ${listing.location}`);
  if (budget && Number(listing.price) <= budget) reasons.push("within your nightly budget");
  if ((Number(listing.capacity) || 2) >= guests) reasons.push(`fits ${guests} ${guests === 1 ? "guest" : "guests"}`);
  if (matchedAmenities) reasons.push(`matches ${matchedAmenities} preferred ${matchedAmenities === 1 ? "amenity" : "amenities"}`);
  if (reviewRatings.length) reasons.push(`${rating.toFixed(1)} guest rating`);
  return { score, reasons: reasons.length ? reasons : ["a strong value based on price and guest feedback"] };
}

module.exports = { calculatePrice, getTrustScore, scoreListing };
