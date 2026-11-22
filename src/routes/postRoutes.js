const express = require("express");
const {
  likePost,
  getPosts,
  createPost,
  updatePost,
  deletePost,
  reactToPost,
  getPostById,
  getUserPosts,
  getLatestPosts,
  getRelatedPosts,
  getPostJsonLdSchema,
} = require("../controllers/postController");
const {
  askPostAI,
  translatePostOrDraft,
  getOrCreatePostSummary,
} = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/uploadMiddleware");

const router = express.Router();

// Static / specific routes MUST come before dynamic /:id routes
router.get("/", getPosts);
router.get("/latest", getLatestPosts);
router.get("/user/my-posts", protect, getUserPosts);
router.post("/", protect, uploadSingle, createPost);

// Nested comments route (/api/v1/posts/:postId/comments)
router.use("/:postId/comments", require("./commentRoutes"));

// Dynamic /:id sub-routes
router.post("/:id/ask", askPostAI);
router.get("/:id/related", getRelatedPosts);
router.post("/:id/like", protect, likePost);
router.get("/:id/schema", getPostJsonLdSchema);
router.post("/:id/react", protect, reactToPost);
router.get("/:id/summary", getOrCreatePostSummary);
router.post("/:id/translate", translatePostOrDraft);

// Single post CRUD
router.get("/:id", getPostById);
router.delete("/:id", protect, deletePost);
router.put("/:id", protect, uploadSingle, updatePost);

module.exports = router;
