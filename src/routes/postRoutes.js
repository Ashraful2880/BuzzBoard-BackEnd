const express = require("express");
const {
  likePost,
  reactToPost,
  getRelatedPosts,
  getPostJsonLdSchema,
  getPosts,
  createPost,
  updatePost,
  deletePost,
  getPostById,
  getUserPosts,
} = require("../controllers/postController");
const {
  getOrCreatePostSummary,
  askPostAI,
  translatePostOrDraft,
} = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/uploadMiddleware");

const router = express.Router();

// Static / specific routes MUST come before dynamic /:id routes
router.get("/", getPosts);
router.get("/user/my-posts", protect, getUserPosts);
router.post("/", protect, uploadSingle, createPost);

// Nested comments route (/api/v1/posts/:postId/comments)
router.use("/:postId/comments", require("./commentRoutes"));

// Dynamic /:id sub-routes
router.get("/:id/summary", getOrCreatePostSummary);
router.post("/:id/ask", askPostAI);
router.post("/:id/translate", translatePostOrDraft);
router.get("/:id/related", getRelatedPosts);
router.get("/:id/schema", getPostJsonLdSchema);
router.post("/:id/like", protect, likePost);
router.post("/:id/react", protect, reactToPost);

// Single post CRUD
router.get("/:id", getPostById);
router.put("/:id", protect, uploadSingle, updatePost);
router.delete("/:id", protect, deletePost);

module.exports = router;
