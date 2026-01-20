const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  // -----ADD----
  // -----ADD----
  fName: {
    type: String,
    default: "",
  },
  lName: {
    type: String,
    default: "",
  },
  image: {
    url: { type: String, default: "" },
    filename: { type: String, default: "" },
  },
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
