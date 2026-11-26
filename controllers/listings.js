const axios = require("axios");
const Listing = require("../models/listing");

module.exports.index = async (req, res) => {
  const listings = await Listing.find({});
  res.render("listings/index", { listings });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
  if (!listing) {
    req.flash("error", "This place could not be found.");
    res.redirect("/listings");
  }
  res.render("listings/show", { listing });
};

module.exports.createListing = async (req, res, next) => {
  try {
    const geoKey = process.env.GEOAPIFY_KEY;
    //Create listing first
    const newListing = new Listing(req.body.listing);
    //Get uploaded image
    if (req.file) {
      newListing.image = {
        url: req.file.path,
        filename: req.file.filename,
      };
    }
    //Owner
    newListing.owner = req.user._id;
    // Geoapify geocode
    const locationText = `${req.body.listing.location}, ${req.body.listing.country}`;
    const geoRes = await axios.get(
      "https://api.geoapify.com/v1/geocode/search",
      {
        params: {
          text: locationText,
          apiKey: geoKey,
          format: "json",
          limit: 1,
        },
      },
    );

    const result = geoRes.data.results[0];
    if (!result) {
      req.flash("error", "We couldn't find that location. Try adding a nearby city.");
      return res.redirect("/listings/new");
    }
    //Now add geometry
    newListing.geometry = {
      type: "Point",
      coordinates: [result.lon, result.lat],
    };

    // Save
    await newListing.save();

    req.flash("success", "Your place is now live.");
    res.redirect("/listings");
  } catch (err) {
    next(err);
  }
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "This place could not be found.");
    res.redirect("/listings");
    // return res.redirect("/listings");
  }
  let originalImageUrl = listing.image.url;
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
  res.render("listings/edit", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

  if (typeof req.file !== "undefined" && req.file) {
    let url = req.file.path;
    let filename = req.file.filename;
    listing.image = { url, filename };
    await listing.save();
  }

  req.flash("success", "Your changes have been saved.");
  res.redirect(`/listings/${id}`); // redirect to show page
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Your place has been removed.");
  res.redirect("/listings");
};

//-------ADD-------
//-------ADD-------
module.exports.filter = async (req, res, next) => {
  let { id } = req.params;
  let listings = await Listing.find({ category: { $all: [id] } });
  console.log(listings);
  if (listings.length != 0) {
    res.locals.success = `Showing stays in ${id}`;
    res.render("listings/index.ejs", { listings });
  } else {
    req.flash("error", "No stays match this category yet.");
    res.redirect("/listings");
  }
};

module.exports.filterbtn = (req, res, next) => {
  res.render("listings/filterbtn.ejs");
};

module.exports.search = async (req, res) => {
  console.log(req.query.q);
  let input = req.query.q.trim().replace(/\s+/g, " "); // remove start and end space and middle space remove and middle add one space------
  console.log(input);
  if (input == "" || input == " ") {
    //search value empty
    req.flash("error", "Enter a destination or property name to search.");
    return res.redirect("/listings");
  }

  // convert every word 1st latter capital and other small---------------
  let data = input.split("");
  let element = "";
  let flag = false;
  for (let index = 0; index < data.length; index++) {
    if (index == 0 || flag) {
      element = element + data[index].toUpperCase();
    } else {
      element = element + data[index].toLowerCase();
    }
    flag = data[index] == " ";
  }
  console.log(element);

  let listings = await Listing.find({
    title: { $regex: element, $options: "i" },
  });
  if (listings.length != 0) {
    res.locals.success = `Showing stays matching “${element}”`;
    res.render("listings/index.ejs", { listings });
    return;
  }
  if (listings.length == 0) {
    listings = await Listing.find({
      category: { $regex: element, $options: "i" },
    }).sort({ _id: -1 });
    if (listings.length != 0) {
      res.locals.success = `Showing stays matching “${element}”`;
      res.render("listings/index.ejs", { listings });
      return;
    }
  }
  if (listings.length == 0) {
    listings = await Listing.find({
      country: { $regex: element, $options: "i" },
    }).sort({ _id: -1 });
    if (listings.length != 0) {
      res.locals.success = `Showing stays matching “${element}”`;
      res.render("listings/index.ejs", { listings });
      return;
    }
  }
  if (listings.length == 0) {
    let listings = await Listing.find({
      location: { $regex: element, $options: "i" },
    }).sort({ _id: -1 });
    if (listings.length != 0) {
      res.locals.success = `Showing stays matching “${element}”`;
      res.render("listings/index.ejs", { listings });
      return;
    }
  }
  const intValue = parseInt(element, 10); // 10 for decimal return - int ya NaN
  const intDec = Number.isInteger(intValue); // check intValue is Number & Not Number return - true ya false

  if (listings.length == 0 && intDec) {
    listings = await Listing.find({ price: { $lte: element } }).sort({
      price: 1,
    });
    if (listings.length != 0) {
      res.locals.success = `Showing stays under ₹${element}`;
      res.render("listings/index.ejs", { listings: listings });
      return;
    }
  }
  if (listings.length == 0) {
    req.flash("error", "No stays match your search. Try another destination.");
    res.redirect("/listings");
  }
};

// module.exports.createListing = async (req, res, next) => {
//   // let response = await geocodingClient
//   //   .forwardGeocode({
//   //     query: req.body.listing.location,
//   //     limit: 1,
//   //   })
//   //   .send();

//   let url = req.file.path;
//   let filename = req.file.filename;

//   const newListing = new Listing(req.body.listing);
//   newListing.owner = req.user._id; // add owner
//   newListing.image = { url, filename };

//   // newListing.geometry = response.body.features[0].geometry;

//   let savedListing = await newListing.save();

//   req.flash("success", "Successfully created a new listing!");
//   res.redirect("/listings");
// };
