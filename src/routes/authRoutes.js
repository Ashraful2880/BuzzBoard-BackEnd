const express = require("express");
const {
  loginUser,
  updateUser,
  registerUser,
  getUserProfile,
  googleAuthRedirect,
  googleAuthCallback,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.post("/login", loginUser);
router.post("/register", registerUser);
router.get("/google", googleAuthRedirect);
router.get("/google/callback", googleAuthCallback);
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, uploadSingle, updateUser);

module.exports = router;
