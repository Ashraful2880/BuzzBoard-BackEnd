const express = require("express");
const {
  getCreatorAnalytics,
  getMonetizationAnalytics,
} = require("../controllers/analyticsController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/creator", protect, getCreatorAnalytics);
router.get("/monetization", protect, getMonetizationAnalytics);

module.exports = router;
