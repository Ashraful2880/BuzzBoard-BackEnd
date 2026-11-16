const asyncHandler = require("express-async-handler");
const { prisma } = require("../config/database");
const { calculateEngagementRate } = require("./postController");
const { serializePost, serializeAd } = require("../utils/serializers");

// @desc    Get Creator Analytics Dashboard Data
// @route   GET /api/v1/analytics/creator
// @access  Private
const getCreatorAnalytics = asyncHandler(async (req, res) => {
  const posts = await prisma.post.findMany({
    where: { authorId: req.user.id },
    orderBy: { createdAt: "desc" },
  });

  const totalPosts = posts.length;
  const publishedPosts = posts.filter((p) => p.status === "published");
  const draftPosts = posts.filter((p) => p.status === "draft");

  const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.likesCount || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
  const adSafePosts = posts.filter((p) => p.isAdSafe !== false).length;

  const avgEngagementRate =
    publishedPosts.length > 0
      ? Number(
          (
            publishedPosts.reduce((sum, p) => sum + calculateEngagementRate(p), 0) /
            publishedPosts.length
          ).toFixed(2)
        )
      : 0;

  const topPerformingPosts = [...publishedPosts]
    .sort(
      (a, b) =>
        (b.views || 0) + (b.likesCount || 0) * 5 - ((a.views || 0) + (a.likesCount || 0) * 5)
    )
    .slice(0, 5)
    .map((p) => ({
      ...serializePost(p),
      engagementRate: calculateEngagementRate(p),
    }));

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalPosts,
        publishedCount: publishedPosts.length,
        draftCount: draftPosts.length,
        totalViews,
        totalLikes,
        totalComments,
        avgEngagementRate,
        adSafePostsCount: adSafePosts,
        adSafeReadyPercentage:
          totalPosts > 0 ? Number(((adSafePosts / totalPosts) * 100).toFixed(1)) : 100,
      },
      topPerformingPosts,
    },
  });
});

// @desc    Get Platform Ad-Tech & Monetization Analytics
// @route   GET /api/v1/analytics/monetization
// @access  Private
const getMonetizationAnalytics = asyncHandler(async (req, res) => {
  const campaigns = await prisma.adCampaign.findMany({
    orderBy: { createdAt: "desc" },
  });

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
  const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
  const averageCtr =
    totalImpressions > 0
      ? Number(((totalClicks / totalImpressions) * 100).toFixed(2))
      : 0;

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalCampaigns,
        activeCampaigns,
        totalImpressions,
        totalClicks,
        averageCtr,
        totalBudget,
      },
      campaigns: campaigns.map(serializeAd),
    },
  });
});

// @desc    Get Dynamic SEO Sitemap Entries
// @route   GET /api/v1/seo/sitemap
// @access  Public
const getSitemap = asyncHandler(async (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || "https://buzzboard.app";
  const posts = await prisma.post.findMany({
    where: { status: "published" },
    select: { id: true, title: true, slug: true, category: true, updatedAt: true, createdAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const urls = posts.map((post) => ({
    url: `${baseUrl}/posts/${post.slug || post.id}`,
    slug: post.slug,
    title: post.title,
    category: post.category,
    lastModified: post.updatedAt || post.createdAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  res.status(200).json({
    success: true,
    count: urls.length,
    baseUrl,
    data: urls,
  });
});

// @desc    Get Trending Posts Ranked by Views & Engagement
// @route   GET /api/v1/seo/trending
// @access  Public
const getTrendingPosts = asyncHandler(async (req, res) => {
  const { limit = 5, category } = req.query;
  const where = { status: "published" };
  if (category) where.category = category;

  const limitNum = Math.min(20, Math.max(1, parseInt(limit, 10) || 5));

  const posts = await prisma.post.findMany({
    where,
    include: {
      author: { select: { id: true, name: true, profileImg: true, bio: true } },
    },
    orderBy: [{ views: "desc" }, { likesCount: "desc" }, { commentsCount: "desc" }],
    take: limitNum,
  });

  res.status(200).json({
    success: true,
    count: posts.length,
    data: posts.map((p) => ({
      ...serializePost(p),
      engagementRate: calculateEngagementRate(p),
    })),
  });
});

// @desc    Get Dynamic RSS 2.0 XML Feed
// @route   GET /api/v1/seo/rss.xml
// @access  Public
const getRssFeed = asyncHandler(async (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || "https://buzzboard.app";
  const posts = await prisma.post.findMany({
    where: { status: "published" },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const itemsXml = posts
    .map((p) => {
      const link = `${baseUrl}/posts/${p.slug || p.id}`;
      const pubDate = new Date(p.createdAt || Date.now()).toUTCString();
      const desc = String(p.excerpt || p.metaDescription || p.title)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const cleanTitle = String(p.title)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `    <item>
      <title>${cleanTitle}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <category>${p.category || "Technology"}</category>
      <description>${desc}</description>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join("\n");

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BuzzBoard — AI-Powered Tech &amp; Creator Publishing Platform</title>
    <link>${baseUrl}</link>
    <description>Latest articles, tutorials, and insights from BuzzBoard creators.</description>
    <language>en-us</language>
${itemsXml}
  </channel>
</rss>`;

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.status(200).send(rssXml);
});

module.exports = {
  getCreatorAnalytics,
  getMonetizationAnalytics,
  getSitemap,
  getTrendingPosts,
  getRssFeed,
};
