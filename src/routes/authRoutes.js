const express = require("express");

const {
  loginUser,
  updateUser,
  registerUser,
  getUserProfile,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", loginUser);
router.post("/register", registerUser);
router.put("/profile", protect, updateUser);
router.get("/profile", protect, getUserProfile);

module.exports = router;