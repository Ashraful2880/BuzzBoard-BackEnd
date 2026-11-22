const express = require("express");
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getNotifications);
router.patch("/:id/read", protect, markNotificationRead);
router.patch("/read-all", protect, markAllNotificationsRead);

module.exports = router;
