const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxLength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      maxLength: [50000, "Content cannot exceed 50000 characters"],
    },
    excerpt: {
      type: String,
      trim: true,
      maxLength: [300, "Excerpt cannot exceed 300 characters"],
      default: "",
    },
    featuredImage: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author is required"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "Technology",
        "Health",
        "Lifestyle",
        "Education",
        "Entertainment",
        "Business",
        "Travel",
        "Food",
        "Sports",
        "Other",
      ],
      default: "Technology",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "archived"],
      default: "draft",
    },
    scheduledAt: {
      type: Date,
      default: null,
    },

    // Series / Multi-Part Tutorial Support
    series: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Series",
      default: null,
    },
    seriesOrder: {
      type: Number,
      default: 0,
    },

    // AI Features
    aiGenerated: {
      type: Boolean,
      default: false,
    },
    aiAssisted: {
      type: Boolean,
      default: false,
    },
    aiSummary: {
      type: String,
      default: "",
    },
    readingTime: {
      type: Number, // in minutes
      default: 1,
    },

    // Ad & Monetization Readiness
    isAdSafe: {
      type: Boolean,
      default: true,
    },
    adSafetyReason: {
      type: String,
      default: "",
    },
    isSponsored: {
      type: Boolean,
      default: false,
    },
    sponsorName: {
      type: String,
      trim: true,
      default: "",
    },
    sponsorUrl: {
      type: String,
      trim: true,
      default: "",
    },

    // Engagement Metrics
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
    reactions: {
      love: { type: Number, default: 0 },
      fire: { type: Number, default: 0 },
      insightful: { type: Number, default: 0 },
      clap: { type: Number, default: 0 },
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },

    // SEO Fields
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    metaDescription: {
      type: String,
      trim: true,
      maxLength: [160, "Meta description cannot exceed 160 characters"],
      default: "",
    },
    canonicalUrl: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Generate Slug, Excerpt, Reading Time & Like Count Before Save
postSchema.pre("save", function () {
  if (this.isModified("title") || !this.slug) {
    const baseSlug = this.title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const uniqueSuffix = this._id
      ? this._id.toString().slice(-6)
      : Date.now().toString(36);
    this.slug = `${baseSlug}-${uniqueSuffix}`;
  }

  // Auto-generate excerpt if empty
  if (this.isModified("content") && !this.excerpt) {
    const plainText = this.content.replace(/[#_*`~>-]/g, "").trim();
    this.excerpt =
      plainText.length > 160 ? `${plainText.substring(0, 157)}...` : plainText;
  }

  // Auto-generate metaDescription if empty
  if (this.isModified("content") && !this.metaDescription) {
    this.metaDescription = (this.excerpt || this.title).substring(0, 160);
  }

  // Calculate reading time
  if (this.isModified("content")) {
    const wordCount = this.content.trim().split(/\s+/).filter(Boolean).length;
    this.readingTime = Math.max(1, Math.ceil(wordCount / 200));
  }

  // Update Like Count
  if (Array.isArray(this.likes)) {
    this.likesCount = this.likes.length;
  }
});

// Text search Index
postSchema.index({
  title: "text",
  content: "text",
  excerpt: "text",
  tags: "text",
});

// Compound Indexes
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ status: 1, createdAt: -1 });
postSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
