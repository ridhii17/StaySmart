const Joi = require("joi");
const stayPassport = require("./utils/stay-passport");

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    country: Joi.string().required(),
    location: Joi.string().required(),
    price: Joi.number().required().min(0),
    image: Joi.string().allow("", null),
    category: Joi.allow(""),
    propertyType: Joi.string().max(50).allow(""),
    capacity: Joi.number().integer().min(1).max(30),
    amenities: Joi.array().items(Joi.string().max(50)).max(30).single(),
    travelStyles: Joi.array().items(Joi.string().valid(...stayPassport.styles)).max(stayPassport.styles.length).single(),
    accessibilityFeatures: Joi.array().items(Joi.string().valid(...stayPassport.accessibilityFeatures)).max(stayPassport.accessibilityFeatures.length).single(),
    ecoPractices: Joi.array().items(Joi.string().valid(...stayPassport.ecoPractices)).max(stayPassport.ecoPractices.length).single(),
    gallery: Joi.allow("", null),
  }).required(),
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
  }).required(),
});

module.exports.userSchema = Joi.object({
  fName: Joi.string().required().trim(),
  lName: Joi.string().allow("", null),
  username: Joi.string().required(),
  email: Joi.string().required().email(),
  password: Joi.string().min(8),
});
