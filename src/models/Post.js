const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: {
      trim: true,
      type: String,
      required: [true, "Title is required"],
      maxLength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      maxLength: [50000, "Content cannot exceed 50000 characters"],
    },
    excerpt: {
      trim: true,
      default: "",
      type: String,
      maxLength: [300, "Excerpt cannot exceed 300 characters"],
    },
    featuredImage: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    author: {
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Author is required"],
    },
    category: {
      type: String,
      default: "Technology",
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
    },
    tags: [
      {
        trim: true,
        type: String,
      },
    ],
    status: {
      type: String,
      default: "draft",
      enum: ["draft", "scheduled", "published", "archived"],
    },
    scheduledAt: {
      type: Date,
      default: null,
    },

    // Series / Multi-Part Tutorial Support
    series: {
      ref: "Series",
      default: null,
      type: mongoose.Schema.Types.ObjectId,
    },
    seriesOrder: {
      default: 0,
      type: Number,
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
      default: 1,
      type: Number, // in minutes
    },

    // Ad & Monetization Readiness
    isAdSafe: {
      type: Boolean,
      default: true,
    },
    adSafetyReason: {
      default: "",
      type: String,
    },
    isSponsored: {
      type: Boolean,
      default: false,
    },
    sponsorName: {
      trim: true,
      default: "",
      type: String,
    },
    sponsorUrl: {
      trim: true,
      default: "",
      type: String,
    },

    // Engagement Metrics
    likes: [
      {
        ref: "User",
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
    likesCount: {
      default: 0,
      type: Number,
    },
    reactions: {
      love: { type: Number, default: 0 },
      fire: { type: Number, default: 0 },
      clap: { type: Number, default: 0 },
      insightful: { type: Number, default: 0 },
    },
    commentsCount: {
      default: 0,
      type: Number,
    },
    views: {
      default: 0,
      type: Number,
    },

    // SEO Fields
    slug: {
      index: true,
      type: String,
      unique: true,
    },
    metaDescription: {
      trim: true,
      default: "",
      type: String,
      maxLength: [160, "Meta description cannot exceed 160 characters"],
    },
    canonicalUrl: {
      trim: true,
      default: "",
      type: String,
    },
  },
  {
    timestamps: true,
  },
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
  tags: "text",
  title: "text",
  content: "text",
  excerpt: "text",
});

// Compound Indexes
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ status: 1, createdAt: -1 });
postSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
