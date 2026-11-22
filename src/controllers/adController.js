const asyncHandler = require("express-async-handler");
const { prisma } = require("../config/database");
const { serializeAd } = require("../utils/serializers");

// @desc    Fetch active ads for a placement & category (increments impressions)
// @route   GET /api/v1/ads/active
// @access  Public
const getActiveAds = asyncHandler(async (req, res) => {
  const { placement, category, limit = 3 } = req.query;

  const now = new Date();
  const where = {
    status: "active",
    OR: [{ endDate: null }, { endDate: { gte: now } }],
  };

  if (placement) where.placement = placement;
  if (category) where.targetCategories = { hasSome: [category, "All"] };

  const limitNum = Math.min(10, Math.max(1, parseInt(limit, 10) || 3));

  const ads = (
    await prisma.adCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limitNum,
    })
  ).map((ad) => ({ ...ad }));

  if (ads.length > 0) {
    await prisma.adCampaign.updateMany({
      where: { id: { in: ads.map((ad) => ad.id) } },
      data: { impressions: { increment: 1 } },
    });
  }

  const updatedAds = ads.map((ad) => {
    const newImpr = (ad.impressions || 0) + 1;
    const newCtr =
      newImpr > 0 ? Number(((ad.clicks / newImpr) * 100).toFixed(2)) : 0;
    return serializeAd({
      ...ad,
      impressions: newImpr,
      ctr: newCtr,
    });
  });

  res.status(200).json({
    success: true,
    adSenseConfig: {
      enabled: Boolean(process.env.GOOGLE_ADSENSE_CLIENT_ID),
      clientId: process.env.GOOGLE_ADSENSE_CLIENT_ID || null,
    },
    count: updatedAds.length,
    data: updatedAds,
  });
});

// @desc    Track ad click & return target redirect URL
// @route   POST /api/v1/ads/:id/click
// @access  Public
const recordAdClick = asyncHandler(async (req, res) => {
  const ad = await prisma.adCampaign.findUnique({
    where: { id: req.params.id },
  });

  if (!ad) {
    res.status(404);
    throw new Error("Ad campaign not found");
  }

  const updated = await prisma.adCampaign.update({
    where: { id: ad.id },
    data: {
      clicks: { increment: 1 },
      ...(ad.impressions === 0 ? { impressions: { increment: 1 } } : {}),
    },
  });

  const safeImpr = Math.max(updated.impressions || 1, 1);
  const newCtr = Number(((updated.clicks / safeImpr) * 100).toFixed(2));
  if (updated.ctr !== newCtr) {
    await prisma.adCampaign.update({
      where: { id: updated.id },
      data: { ctr: newCtr },
    });
  }

  res.status(200).json({
    success: true,
    message: "Ad click tracked",
    data: {
      ctr: newCtr,
      adId: updated.id,
      clicks: updated.clicks,
      targetUrl: updated.targetUrl,
      impressions: updated.impressions,
    },
  });
});

// @desc    Create a new Ad Campaign
// @route   POST /api/v1/ads
// @access  Private
const createAdCampaign = asyncHandler(async (req, res) => {
  const {
    title,
    status,
    budget,
    ctaText,
    endDate,
    imageUrl,
    targetUrl,
    placement,
    sponsorName,
    description,
    targetCategories,
  } = req.body;

  if (!title || !sponsorName || !targetUrl) {
    res.status(400);
    throw new Error("title, sponsorName, and targetUrl are required");
  }

  const ad = await prisma.adCampaign.create({
    data: {
      title,
      targetUrl,
      sponsorName,
      imageUrl: imageUrl || "",
      status: status || "active",
      budget: Number(budget) || 0,
      description: description || "",
      ctaText: ctaText || "Learn More",
      placement: placement || "in_article",
      endDate: endDate ? new Date(endDate) : null,
      createdById: req.user.id,
      targetCategories:
        Array.isArray(targetCategories) && targetCategories.length > 0
          ? targetCategories
          : ["All"],
    },
  });

  res.status(201).json({
    success: true,
    data: serializeAd(ad),
    message: "Ad campaign created successfully",
  });
});

// @desc    List all Ad Campaigns
// @route   GET /api/v1/ads
// @access  Private
const getAllAdCampaigns = asyncHandler(async (req, res) => {
  const { status, placement } = req.query;
  const where = {};
  if (status) where.status = status;
  if (placement) where.placement = placement;

  const campaigns = await prisma.adCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    success: true,
    count: campaigns.length,
    data: campaigns.map(serializeAd),
  });
});

// @desc    Update an Ad Campaign
// @route   PUT /api/v1/ads/:id
// @access  Private
const updateAdCampaign = asyncHandler(async (req, res) => {
  const ad = await prisma.adCampaign.findUnique({
    where: { id: req.params.id },
  });
  if (!ad) {
    res.status(404);
    throw new Error("Ad campaign not found");
  }

  const updateData = {};
  [
    "title",
    "status",
    "budget",
    "ctaText",
    "imageUrl",
    "targetUrl",
    "placement",
    "sponsorName",
    "description",
    "targetCategories",
  ].forEach((field) => {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  });
  if (req.body.endDate !== undefined) {
    updateData.endDate = req.body.endDate ? new Date(req.body.endDate) : null;
  }

  const updated = await prisma.adCampaign.update({
    where: { id: ad.id },
    data: updateData,
  });

  res.status(200).json({
    success: true,
    message: "Ad campaign updated successfully",
    data: serializeAd(updated),
  });
});

// @desc    Delete an Ad Campaign
// @route   DELETE /api/v1/ads/:id
// @access  Private
const deleteAdCampaign = asyncHandler(async (req, res) => {
  const ad = await prisma.adCampaign.findUnique({
    where: { id: req.params.id },
  });
  if (!ad) {
    res.status(404);
    throw new Error("Ad campaign not found");
  }

  await prisma.adCampaign.delete({ where: { id: ad.id } });

  res.status(200).json({
    success: true,
    message: "Ad campaign deleted successfully",
    data: {},
  });
});

module.exports = {
  getActiveAds,
  recordAdClick,
  createAdCampaign,
  updateAdCampaign,
  deleteAdCampaign,
  getAllAdCampaigns,
};
