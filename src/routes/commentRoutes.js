const express = require("express");
const {
  getPostComments,
  createComment,
  updateComment,
  deleteComment,
  likeComment,
} = require("../controllers/commentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router({ mergeParams: true });

// Supports both /api/v1/posts/:postId/comments and /api/v1/comments/post/:postId
router.get("/", getPostComments);
router.post("/", protect, createComment);
router.get("/post/:postId", getPostComments);
router.post("/post/:postId", protect, createComment);

// Single comment operations
router.put("/:id", protect, updateComment);
router.delete("/:id", protect, deleteComment);
router.post("/:id/like", protect, likeComment);

module.exports = router;
