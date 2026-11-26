if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError");

const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");

const listingRouter = require("./routes/listing");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user");
const profileRouter = require("./routes/profile.js");
const chatbotRouter = require("./routes/chatbot.js");
const featuresRouter = require("./routes/features.js");
const paymentsRouter = require("./routes/payments.js");
const verificationRouter = require("./routes/verification.js");
const paymentController = require("./controllers/payments");
const wrapAsync = require("./utils/wrapAsync");
const { rateLimit } = require("./middleware");

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

//MongoDB
const dbURL = process.env.ATLAS_URL;

main()
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Unable to connect to MongoDB:", err.message);
    process.exit(1);
  });

async function main() {
  await mongoose.connect(dbURL);
  const port = Number(process.env.PORT) || 8080;
  app.listen(port, () => {
    console.log(`StaySmart is running on port ${port}`);
  });
}
//view engine
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// The webhook needs its original bytes so the Razorpay signature can be verified.
app.post(
  "/api/payments/razorpay/webhook",
  rateLimit({ scope: "payment-webhook", windowMs: 60 * 1000, max: 300 }),
  express.raw({ type: "application/json", limit: "64kb" }),
  wrapAsync(paymentController.webhook),
);

//middleware
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  res.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(express.urlencoded({ extended: true, limit: "32kb" }));
app.use(express.json({ limit: "8kb" }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public"))); // serve static files css work

const store = MongoStore.create({
  mongoUrl: dbURL,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", (e) => {
  console.log("SESSION STORE ERROR", e);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
};

// app.get("/", (req, res) => {
//   res.send("Hello World!");
// });

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// for error messages
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentUser = req.user;
  res.locals.search = { destination: "", checkIn: "", checkOut: "", guests: "", minPrice: "", maxPrice: "", propertyType: "", amenities: [] };
  res.locals.totalCount = 0;
  res.locals.page = 1;
  res.locals.pageCount = 1;
  // res.locals.redirectUrl = req.session.redirectUrl;
  next();
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", paymentsRouter);
app.use("/", verificationRouter);
app.use("/", featuresRouter);
app.use("/", userRouter);
app.use("/profile", profileRouter);
app.use("/api/chat", chatbotRouter);

// for wrong route
app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong" } = err;
  if (req.path.startsWith("/api/") || req.accepts("json")) return res.status(statusCode).json({ error: message });
  // res.status(statusCode).send(message);
  res.render("listings/error", { statusCode, message });
});
