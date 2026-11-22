const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    post: {
      ref: "Post",
      index: true,
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Post reference is required"],
    },
    author: {
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Author is required"],
    },
    content: {
      trim: true,
      type: String,
      required: [true, "Comment content is required"],
      maxLength: [2000, "Comment cannot exceed 2000 characters"],
    },
    parentComment: {
      default: null,
      ref: "Comment",
      type: mongoose.Schema.Types.ObjectId,
    },
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
    isEdited: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      default: "active",
      enum: ["active", "flagged", "deleted"],
    },
  },
  {
    timestamps: true,
  },
);

commentSchema.pre("save", function () {
  if (Array.isArray(this.likes)) {
    this.likesCount = this.likes.length;
  }
});

commentSchema.index({ post: 1, parentComment: 1, createdAt: -1 });

module.exports = mongoose.model("Comment", commentSchema);
