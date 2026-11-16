const asyncHandler = require("express-async-handler");
const { prisma } = require("../config/database");

// @desc    Subscribe to BuzzBoard Newsletter
// @route   POST /api/v1/newsletter/subscribe
// @access  Public
const subscribeNewsletter = asyncHandler(async (req, res) => {
  const { email, name, categories } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Email address is required");
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await prisma.newsletter.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    const updated = await prisma.newsletter.update({
      where: { email: normalizedEmail },
      data: {
        isActive: true,
        ...(name ? { name } : {}),
        ...(Array.isArray(categories) && categories.length > 0
          ? { subscribedCategories: categories }
          : {}),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Newsletter subscription updated",
      data: updated,
    });
  }

  const subscriber = await prisma.newsletter.create({
    data: {
      email: normalizedEmail,
      name: name || "",
      subscribedCategories:
        Array.isArray(categories) && categories.length > 0 ? categories : ["All"],
      isActive: true,
    },
  });

  res.status(201).json({
    success: true,
    message: "Successfully subscribed to BuzzBoard newsletter!",
    data: subscriber,
  });
});

// @desc    Unsubscribe from Newsletter
// @route   POST /api/v1/newsletter/unsubscribe
// @access  Public
const unsubscribeNewsletter = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Email address is required");
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const subscriber = await prisma.newsletter.findUnique({
    where: { email: normalizedEmail },
  });

  if (!subscriber) {
    res.status(404);
    throw new Error("Subscriber not found");
  }

  await prisma.newsletter.update({
    where: { email: normalizedEmail },
    data: { isActive: false },
  });

  res.status(200).json({
    success: true,
    message: "Unsubscribed from newsletter successfully",
  });
});

// @desc    Get active newsletter subscribers
// @route   GET /api/v1/newsletter/subscribers
// @access  Private
const getSubscribers = asyncHandler(async (req, res) => {
  const subscribers = await prisma.newsletter.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    success: true,
    count: subscribers.length,
    data: subscribers,
  });
});

module.exports = {
  subscribeNewsletter,
  unsubscribeNewsletter,
  getSubscribers,
};
