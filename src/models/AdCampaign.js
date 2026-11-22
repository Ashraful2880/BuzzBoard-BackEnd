const mongoose = require("mongoose");

const adCampaignSchema = new mongoose.Schema(
  {
    title: {
      trim: true,
      type: String,
      required: [true, "Campaign title is required"],
      maxLength: [120, "Title cannot exceed 120 characters"],
    },
    sponsorName: {
      trim: true,
      type: String,
      required: [true, "Sponsor name is required"],
    },
    targetUrl: {
      trim: true,
      type: String,
      required: [true, "Target URL is required"],
    },
    imageUrl: {
      trim: true,
      default: "",
      type: String,
    },
    description: {
      trim: true,
      default: "",
      type: String,
      maxLength: [300, "Description cannot exceed 300 characters"],
    },
    ctaText: {
      trim: true,
      type: String,
      default: "Learn More",
    },
    placement: {
      type: String,
      index: true,
      default: "in_article",
      enum: [
        "footer",
        "sidebar",
        "in_article",
        "header_banner",
        "sponsored_post",
      ],
    },
    targetCategories: {
      type: [String],
      default: ["All"],
    },
    status: {
      index: true,
      type: String,
      default: "active",
      enum: ["active", "paused", "completed", "draft"],
    },
    impressions: {
      default: 0,
      type: Number,
    },
    clicks: {
      default: 0,
      type: Number,
    },
    ctr: {
      default: 0,
      type: Number, // Click-Through Rate percentage
    },
    budget: {
      default: 0,
      type: Number,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    createdBy: {
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  },
);

adCampaignSchema.pre("save", function () {
  if (this.impressions > 0) {
    this.ctr = Number(((this.clicks / this.impressions) * 100).toFixed(2));
  } else {
    this.ctr = 0;
  }
});

module.exports = mongoose.model("AdCampaign", adCampaignSchema);
