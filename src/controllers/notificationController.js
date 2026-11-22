const asyncHandler = require("express-async-handler");
const { prisma } = require("../config/database");
const { serializeNotification } = require("../utils/serializers");

// Helper function to create an in-app notification safely
const createNotification = async ({
  type,
  sender,
  message,
  recipient,
  post = null,
  comment = null,
}) => {
  try {
    if (!recipient || !sender) return null;
    if (String(recipient) === String(sender)) return null;

    return await prisma.notification.create({
      data: {
        type,
        message,
        senderId: String(sender),
        recipientId: String(recipient),
        postId: post ? String(post) : null,
        commentId: comment ? String(comment) : null,
      },
    });
  } catch (err) {
    return null;
  }
};

// @desc    Get logged-in user's notifications & unread count
// @route   GET /api/v1/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;

  const where = { recipientId: req.user.id };
  if (unreadOnly === "true") {
    where.isRead = false;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * limitNum,
      include: {
        sender: { select: { id: true, name: true, profileImg: true } },
        post: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.notification.count({
      where: { recipientId: req.user.id, isRead: false },
    }),
  ]);

  res.status(200).json({
    unreadCount,
    success: true,
    count: notifications.length,
    data: notifications.map(serializeNotification),
  });
});

// @desc    Mark a single notification as read
// @route   PATCH /api/v1/notifications/:id/read
// @access  Private
const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id },
  });

  if (!notification) {
    res.status(404);
    throw new Error("Notification not found");
  }

  if (notification.recipientId !== req.user.id) {
    res.status(403);
    throw new Error("Not authorized to access this notification");
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });

  res.status(200).json({
    success: true,
    data: serializeNotification(updated),
    message: "Notification marked as read",
  });
});

// @desc    Mark all notifications as read for logged-in user
// @route   PATCH /api/v1/notifications/read-all
// @access  Private
const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { recipientId: req.user.id, isRead: false },
    data: { isRead: true },
  });

  res.status(200).json({
    success: true,
    message: "All notifications marked as read",
  });
});

module.exports = {
  getNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
};
