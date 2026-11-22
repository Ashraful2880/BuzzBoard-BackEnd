const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      trim: true,
      type: String,
      required: [true, "Name is required"],
      maxLength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      trim: true,
      type: String,
      unique: true,
      lowercase: true,
      required: [true, "Email is required"],
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/,
        "Please fill a valid email address",
      ],
    },
    password: {
      type: String,
      select: false,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    profile_img: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    bio: {
      trim: true,
      default: "",
      type: String,
      maxLength: [300, "Bio cannot exceed 300 characters"],
    },
    website: {
      trim: true,
      default: "",
      type: String,
    },
    socialLinks: {
      github: { type: String, trim: true, default: "" },
      twitter: { type: String, trim: true, default: "" },
      linkedin: { type: String, trim: true, default: "" },
    },
    role: {
      type: String,
      default: "user",
      enum: ["user", "author", "admin"],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    followers: [
      {
        ref: "User",
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
    following: [
      {
        ref: "User",
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
    bookmarks: [
      {
        ref: "Post",
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Encrypt password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare Password Method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
