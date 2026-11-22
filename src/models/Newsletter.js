const mongoose = require("mongoose");

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      trim: true,
      type: String,
      unique: true,
      lowercase: true,
      required: [true, "Email address is required"],
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/,
        "Please provide a valid email address",
      ],
    },
    name: {
      trim: true,
      default: "",
      type: String,
    },
    subscribedCategories: {
      type: [String],
      default: ["All"],
    },
    isActive: {
      index: true,
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Newsletter", newsletterSchema);
