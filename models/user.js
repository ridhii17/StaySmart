const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  // -----ADD---
  // -----ADD---
  fName: {
    type: String,
    required: true,
  },
  lName: {
    type: String,
    // required: true
  },
  image: {
    url: String,
    filename: String,
  },
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
