const express = require("express");
const {
  toggleBookmark,
  getBookmarks,
  toggleFollow,
  getPublicAuthorProfile,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Bookmarks (Reading List)
router.get("/bookmarks", protect, getBookmarks);
router.post("/bookmarks/:postId", protect, toggleBookmark);

// Public Author Profile & Follow System
router.get("/:id/profile", getPublicAuthorProfile);
router.post("/:id/follow", protect, toggleFollow);

module.exports = router;
