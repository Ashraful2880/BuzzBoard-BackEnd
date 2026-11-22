const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      ref: "User",
      index: true,
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Recipient is required"],
    },
    sender: {
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Sender is required"],
    },
    type: {
      type: String,
      required: true,
      enum: ["like", "reaction", "comment", "reply", "follow", "system"],
    },
    post: {
      ref: "Post",
      default: null,
      type: mongoose.Schema.Types.ObjectId,
    },
    comment: {
      default: null,
      ref: "Comment",
      type: mongoose.Schema.Types.ObjectId,
    },
    message: {
      trim: true,
      type: String,
      required: true,
    },
    isRead: {
      index: true,
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
