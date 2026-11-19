const express = require("express");
const {
  loginUser,
  updateUser,
  registerUser,
  getUserProfile,
  googleAuthRedirect,
  googleAuthCallback,
  githubAuthRedirect,
  githubAuthCallback,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.post("/login", loginUser);
router.post("/register", registerUser);
router.get("/google", googleAuthRedirect);
router.get("/google/callback", googleAuthCallback);
router.get("/github", githubAuthRedirect);
router.get("/github/callback", githubAuthCallback);
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, uploadSingle, updateUser);

module.exports = router;
