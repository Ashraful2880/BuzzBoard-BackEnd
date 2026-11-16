const mongoose = require("mongoose");

const seriesSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Series title is required"],
      trim: true,
      maxLength: [150, "Series title cannot exceed 150 characters"],
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxLength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author is required"],
      index: true,
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
      enum: ["ongoing", "completed", "archived"],
      default: "ongoing",
    },
  },
  {
    timestamps: true,
  }
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
