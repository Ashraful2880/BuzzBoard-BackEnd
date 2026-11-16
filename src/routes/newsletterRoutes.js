const express = require("express");
const {
  subscribeNewsletter,
  unsubscribeNewsletter,
  getSubscribers,
} = require("../controllers/newsletterController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/subscribe", subscribeNewsletter);
router.post("/unsubscribe", unsubscribeNewsletter);
router.get("/subscribers", protect, getSubscribers);

module.exports = router;
