const express = require("express");
const {
  getActiveAds,
  recordAdClick,
  createAdCampaign,
  updateAdCampaign,
  deleteAdCampaign,
  getAllAdCampaigns,
} = require("../controllers/adController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public ad serving & click tracking
router.get("/active", getActiveAds);
router.post("/:id/click", recordAdClick);

// Protected campaign management
router.get("/", protect, getAllAdCampaigns);
router.post("/", protect, createAdCampaign);
router.put("/:id", protect, updateAdCampaign);
router.delete("/:id", protect, deleteAdCampaign);

module.exports = router;
