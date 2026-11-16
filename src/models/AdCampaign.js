const mongoose = require("mongoose");

const adCampaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Campaign title is required"],
      trim: true,
      maxLength: [120, "Title cannot exceed 120 characters"],
    },
    sponsorName: {
      type: String,
      required: [true, "Sponsor name is required"],
      trim: true,
    },
    targetUrl: {
      type: String,
      required: [true, "Target URL is required"],
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      maxLength: [300, "Description cannot exceed 300 characters"],
      default: "",
    },
    ctaText: {
      type: String,
      trim: true,
      default: "Learn More",
    },
    placement: {
      type: String,
      enum: ["header_banner", "sidebar", "in_article", "footer", "sponsored_post"],
      default: "in_article",
      index: true,
    },
    targetCategories: {
      type: [String],
      default: ["All"],
    },
    status: {
      type: String,
      enum: ["active", "paused", "completed", "draft"],
      default: "active",
      index: true,
    },
    impressions: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    ctr: {
      type: Number, // Click-Through Rate percentage
      default: 0,
    },
    budget: {
      type: Number,
      default: 0,
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
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

adCampaignSchema.pre("save", function () {
  if (this.impressions > 0) {
    this.ctr = Number(((this.clicks / this.impressions) * 100).toFixed(2));
  } else {
    this.ctr = 0;
  }
});

module.exports = mongoose.model("AdCampaign", adCampaignSchema);
