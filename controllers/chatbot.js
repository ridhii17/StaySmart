const Listing = require("../models/listing");
const razorpay = require("../utils/razorpay");
const { scoreListing, getTrustScore } = require("../utils/stay-smart");

function generalReply(text) {
  if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text)) return "Hi! Tell me a destination, group size, preferred amenities, or nightly budget and I’ll look at actual StaySmart places.";
  if (/review|rating|feedback/.test(text)) return "Open any place page, choose a rating, and add a short comment. You need to be signed in to post a review, and you can remove your own reviews later from Profile.";
  if (/host|publish|add my place|share my place|create a place|list my place/.test(text)) return "Choose “Become a host” to add your place. Add a cover photo, gallery images, guest capacity, amenities, location and nightly price. You can manage reservations from Host bookings.";
  if (/edit|update|change.*photo|replace.*photo/.test(text)) return "Open Profile, choose a place you manage, then Edit place. You can update the details, amenities, capacity and photos.";
  if (/photo|image|picture|upload/.test(text)) return "Place pages support a cover photo and a gallery. Use a clear cover shot, then add extra views in the gallery field when you create or edit a place.";
  if (/book|booking|reservation|reserve|payment|checkout|cancel/.test(text)) return razorpay.isConfigured()
    ? "Open a place and choose dates to see availability and an itemized total. Checkout uses Razorpay and confirms a reservation only after the server verifies the payment. Upcoming reservations can be cancelled from My Trips; eligible cancellations request a refund."
    : "Open a place and choose dates to see availability and an itemized total. This environment is in demo checkout mode and does not collect a payment. Add Razorpay test keys to enable secure payment checkout. Upcoming demo reservations can be cancelled from My Trips.";
  if (/trip|group|split|expense|budget/.test(text)) return "Use Group planner to set your destination, traveler count and total budget. Add stays to compare nightly and per-person estimates, then record shared expenses to see each member’s balance.";
  if (/price|cost|rate|nightly|₹|rupee/.test(text)) return "Tell me a destination or a maximum nightly budget and I can find matching places. The reservation checkout shows nightly cost, service fee, cleaning fee, total and per-person share.";
  if (/compare|wishlist|favourite|favorite|save/.test(text)) return "Save places with the heart button. On Explore, select up to four places and choose Compare to see price, rating, amenities, guest capacity and trust score side by side.";
  if (/nearby|restaurant|hospital|rail|station|college|transport|attraction/.test(text)) return "Open a place page and scroll to Explore around this stay. It shows nearby restaurants, hospitals, transit and attractions with approximate distances when location data is available.";
  if (/student|students|affordable|cheap/.test(text)) return "Student Mode prioritizes lower nightly rates. Open Students and set your maximum price; place pages show Wi-Fi, kitchen and public transport amenities when the host has provided them.";
  if (/trust|safe|score/.test(text)) return "Each place’s trust score combines guest ratings and review history with host profile completeness and listing details. Open the score explanation on a place page to see what contributes.";
  if (/search|find|destination|filter|category/.test(text)) return "Use Explore filters for destination, dates, guests, price range and property type. Smart picks ranks real places with an explanation for each match.";
  if (/login|log in|sign in|account|profile|password/.test(text)) return "Use Log in or Sign up in the top menu. Profile gives you access to your places, reviews and account settings.";
  return "I can search actual places by destination and budget, compare costs, explain trust scores, help plan a group trip, or show how to book. What are you looking for?";
}

module.exports.reply = async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "Type a message first." });
  if (message.length > 500) return res.status(400).json({ error: "Please keep your message under 500 characters." });

  const text = message.toLowerCase();
  const amountMatch = text.match(/(?:₹|rs\.?\s*|under\s+|below\s+)?([\d,]{3,})/i);
  const budget = amountMatch ? Number(amountMatch[1].replaceAll(",", "")) : 0;
  const guestMatch = text.match(/(\d{1,2})\s*(?:people|guests|persons|travelers|travellers)/i);
  const guests = guestMatch ? Math.max(1, Math.min(30, Number(guestMatch[1]))) : 1;
  const query = {};
  if (budget) query.price = { $lte: budget };
  const hasSearchIntent = /recommend|find|show me|looking for|suggest|need a|under\s+₹?|below\s+|within\s+my\s+budget|cheap|affordable|(?:stay|place|room|home|apartment|cabin)s?\s+(?:in|near|around)|(?:in|near|around)\s+[a-z]|what.*(?:stay|place)/.test(text);
  if (!hasSearchIntent) return res.json({ reply: generalReply(text) });

  const listings = await Listing.find(query).populate("reviews", "rating").populate("owner", "username email fName image hostVerificationStatus").limit(200);
  if (!listings.length) {
    return res.json({ reply: budget ? `I couldn’t find a current place at or below ₹${budget.toLocaleString("en-IN")} per night. Try a higher budget or explore another destination.` : "There aren’t any published places to match that request yet. Try Explore or check back after a host adds a place." });
  }
  const destination = text.match(/(?:in|near|around|to)\s+([a-z][a-z\s-]{1,35}?)(?=\s+(?:under|below|for|with|at|max|up to)\b|[?.!,]|$)/i)?.[1]?.trim() || "";
  const amenities = ["wifi", "wi-fi", "kitchen", "parking", "pool", "workspace", "washer", "heating"].filter((word) => text.includes(word)).map((word) => word === "wifi" ? "wi-fi" : word);
  const preferences = { destination, budget, guests, amenities };
  const ranked = listings.map((listing) => ({ listing, ...scoreListing(listing, preferences), trust: getTrustScore(listing) }))
    .sort((a, b) => b.score - a.score || Number(a.listing.price || 0) - Number(b.listing.price || 0)).slice(0, 3);
  const intro = budget ? `Here are real places within ₹${budget.toLocaleString("en-IN")}/night` : "Here are a few current places that may fit";
  const suggestions = ranked.map(({ listing, reasons, trust }) => `${listing.title} — ₹${Number(listing.price || 0).toLocaleString("en-IN")}/night in ${[listing.location, listing.country].filter(Boolean).join(", ")}; trust ${trust}/100. Good fit because it ${reasons.join(", ")}.`).join("\n");
  res.json({ reply: `${intro}:\n${suggestions}\n\nAsk me for dates and group size to refine your choices.` });
};
