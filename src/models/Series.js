const mongoose = require("mongoose");

const seriesSchema = new mongoose.Schema(
  {
    title: {
      trim: true,
      type: String,
      required: [true, "Series title is required"],
      maxLength: [150, "Series title cannot exceed 150 characters"],
    },
    slug: {
      index: true,
      type: String,
      unique: true,
    },
    description: {
      trim: true,
      default: "",
      type: String,
      maxLength: [500, "Description cannot exceed 500 characters"],
    },
    author: {
      ref: "User",
      index: true,
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Author is required"],
    },
    category: {
      type: String,
      default: "Technology",
    },
    coverImage: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    status: {
      type: String,
      default: "ongoing",
      enum: ["ongoing", "completed", "archived"],
    },
  },
  {
    timestamps: true,
  },
);

seriesSchema.pre("save", function () {
  if (this.isModified("title") || !this.slug) {
    const baseSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const suffix = this._id
      ? this._id.toString().slice(-6)
      : Date.now().toString(36);
    this.slug = `${baseSlug}-${suffix}`;
  }
});

module.exports = mongoose.model("Series", seriesSchema);
