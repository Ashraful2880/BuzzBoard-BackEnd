const asyncHandler = require("express-async-handler");
const { prisma } = require("../config/database");
const cloudinary = require("../config/cloudinary");
const { isCloudinaryConfigured } = require("../middleware/uploadMiddleware");
const { evaluateBrandSafety } = require("../services/aiService");
const { createNotification } = require("./notificationController");
const {
  buildExcerpt,
  serializePost,
  generateUniqueSlug,
  calculateReadingTime,
} = require("../utils/serializers");

// In-Memory Zero-Cost View Deduplication & Live Readers Tracker
const uniqueViewCache = new Map();
const activeReadersMap = new Map();
const VIEW_COOLDOWN_MS = 30 * 60 * 1000;
const LIVE_READER_WINDOW_MS = 5 * 60 * 1000;

const recordUniqueViewAndLiveReader = (postId, viewerKey) => {
  const now = Date.now();
  const postKey = String(postId);

  if (!activeReadersMap.has(postKey)) {
    activeReadersMap.set(postKey, new Map());
  }
  const readers = activeReadersMap.get(postKey);
  readers.set(viewerKey, now);
  for (const [k, ts] of readers.entries()) {
    if (now - ts > LIVE_READER_WINDOW_MS) readers.delete(k);
  }

  const viewKey = `${viewerKey}:${postKey}`;
  const lastViewedAt = uniqueViewCache.get(viewKey);
  if (lastViewedAt && now - lastViewedAt < VIEW_COOLDOWN_MS) {
    return { isNewUniqueView: false, liveReaders: readers.size };
  }

  uniqueViewCache.set(viewKey, now);
  if (uniqueViewCache.size > 5000) {
    for (const [k, ts] of uniqueViewCache.entries()) {
      if (now - ts > VIEW_COOLDOWN_MS) uniqueViewCache.delete(k);
    }
  }

  return { isNewUniqueView: true, liveReaders: readers.size };
};

let lastScheduledPublishCheck = 0;
const SCHEDULED_CHECK_INTERVAL_MS = 60 * 1000;

const publishDueScheduledPosts = async () => {
  const now = Date.now();
  if (now - lastScheduledPublishCheck < SCHEDULED_CHECK_INTERVAL_MS) {
    return;
  }
  lastScheduledPublishCheck = now;

  try {
    await prisma.post.updateMany({
      where: {
        status: "scheduled",
        scheduledAt: { lte: new Date() },
      },
      data: { status: "published" },
    });
  } catch (err) {
    // Safe fallback
  }
};

const calculateEngagementRate = (post) => {
  const likesCount = post.likesCount || 0;
  const commentsCount = post.commentsCount || 0;
  const reactions = post.reactions || {};
  const reactionsTotal =
    (reactions.love || 0) +
    (reactions.fire || 0) +
    (reactions.insightful || 0) +
    (reactions.clap || 0);
  const totalInteractions = likesCount + commentsCount + reactionsTotal;
  const engagementRate = (totalInteractions / Math.max(post.views || 1, 1)) * 100;
  return Number(Math.min(engagementRate, 100).toFixed(2));
};

// @desc    Create a new post
// @route   POST /api/v1/posts
// @access  Private
const createPost = asyncHandler(async (req, res) => {
  const {
    title,
    content,
    excerpt,
    category,
    tags,
    status,
    scheduledAt,
    series,
    seriesOrder,
    metaDescription,
    canonicalUrl,
    isSponsored,
    sponsorName,
    sponsorUrl,
    aiGenerated,
    aiAssisted,
  } = req.body;

  if (!title || !content) {
    res.status(400);
    throw new Error("Title and Content are required");
  }

  const parsedTags = Array.isArray(tags)
    ? tags.map((tag) => String(tag).trim()).filter(Boolean)
    : typeof tags === "string" && tags.trim()
      ? tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];

  const safetyReport = await evaluateBrandSafety({ title, content });

  const resolvedStatus =
    scheduledAt && new Date(scheduledAt) > new Date()
      ? "scheduled"
      : status || "draft";

  const finalExcerpt = buildExcerpt(content, excerpt);
  const finalMeta = (metaDescription || finalExcerpt || title).substring(0, 160);

  const post = await prisma.post.create({
    data: {
      title: String(title).trim(),
      slug: generateUniqueSlug(title),
      content,
      excerpt: finalExcerpt,
      category: category || "Technology",
      tags: parsedTags,
      status: resolvedStatus,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      seriesId: series || null,
      seriesOrder: Number(seriesOrder) || 0,
      metaDescription: finalMeta,
      canonicalUrl: canonicalUrl || "",
      isSponsored: Boolean(isSponsored),
      sponsorName: sponsorName || "",
      sponsorUrl: sponsorUrl || "",
      aiGenerated: Boolean(aiGenerated),
      aiAssisted: Boolean(aiAssisted),
      readingTime: calculateReadingTime(content),
      isAdSafe: safetyReport.isAdSafe,
      adSafetyReason: safetyReport.reason,
      authorId: req.user.id,
      featuredImage: req.file
        ? { url: req.file.path, public_id: req.file.filename }
        : { url: "", public_id: "" },
    },
    include: {
      author: {
        select: { id: true, name: true, email: true, profileImg: true, bio: true, website: true },
      },
    },
  });

  res.status(201).json({
    success: true,
    message: "Post created successfully",
    data: serializePost(post),
  });
});

// @desc    Get all posts
// @route   GET /api/v1/posts
// @access  Public
const getPosts = asyncHandler(async (req, res) => {
  await publishDueScheduledPosts();

  const {
    page = 1,
    limit = 10,
    search,
    category,
    tag,
    author,
    series,
    status = "published",
    adSafeOnly,
  } = req.query;

  const where = {};
  if (status !== "all") where.status = status;
  if (category) where.category = category;
  if (tag) where.tags = { has: tag };
  if (author) where.authorId = author;
  if (series) where.seriesId = series;
  if (adSafeOnly === "true") where.isAdSafe = true;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
      { excerpt: { contains: search, mode: "insensitive" } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, email: true, profileImg: true, bio: true, website: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.post.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limitNum);

  res.json({
    success: true,
    data: posts.map((p) => ({
      ...serializePost(p),
      engagementRate: calculateEngagementRate(p),
    })),
    pagination: {
      current: pageNum,
      total,
      page: pageNum,
      totalPages,
    },
    filters: { search, category, tag, status },
  });
});

// @desc    Get a single post by ID or Slug
// @route   GET /api/v1/posts/:id
// @access  Public
const getPostById = asyncHandler(async (req, res) => {
  await publishDueScheduledPosts();
  const identifier = req.params.id;

  let post = await prisma.post.findFirst({
    where: { OR: [{ id: identifier }, { slug: identifier }] },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          profileImg: true,
          bio: true,
          website: true,
          socialLinks: true,
        },
      },
    },
  });

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  const viewerKey =
    req.headers["x-forwarded-for"] ||
    req.headers["x-viewer-id"] ||
    req.socket?.remoteAddress ||
    "127.0.0.1";

  const { isNewUniqueView, liveReaders } = recordUniqueViewAndLiveReader(
    post.id,
    viewerKey
  );

  if (post.status === "published" && isNewUniqueView) {
    post = await prisma.post.update({
      where: { id: post.id },
      data: { views: { increment: 1 } },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImg: true,
            bio: true,
            website: true,
            socialLinks: true,
          },
        },
      },
    });
  }

  res.json({
    success: true,
    data: {
      ...serializePost(post),
      liveReaders,
      engagementRate: calculateEngagementRate(post),
    },
  });
});

// @desc    Update a post
// @route   PUT /api/v1/posts/:id
// @access  Private
const updatePost = asyncHandler(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  if (post.authorId !== req.user.id && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Not authorized to update this post");
  }

  const updateData = {};
  if (req.body.title !== undefined) {
    updateData.title = req.body.title;
    updateData.slug = generateUniqueSlug(req.body.title);
  }
  if (req.body.content !== undefined) {
    updateData.content = req.body.content;
    updateData.readingTime = calculateReadingTime(req.body.content);
  }
  if (req.body.excerpt !== undefined) updateData.excerpt = req.body.excerpt;
  if (req.body.category !== undefined) updateData.category = req.body.category;
  if (req.body.status !== undefined) updateData.status = req.body.status;
  if (req.body.scheduledAt !== undefined) {
    updateData.scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : null;
  }
  if (req.body.series !== undefined) updateData.seriesId = req.body.series || null;
  if (req.body.seriesOrder !== undefined) updateData.seriesOrder = Number(req.body.seriesOrder) || 0;
  if (req.body.metaDescription !== undefined) updateData.metaDescription = req.body.metaDescription;
  if (req.body.canonicalUrl !== undefined) updateData.canonicalUrl = req.body.canonicalUrl;
  if (req.body.isSponsored !== undefined) updateData.isSponsored = Boolean(req.body.isSponsored);
  if (req.body.sponsorName !== undefined) updateData.sponsorName = req.body.sponsorName;
  if (req.body.sponsorUrl !== undefined) updateData.sponsorUrl = req.body.sponsorUrl;

  if (req.body.tags !== undefined) {
    updateData.tags = Array.isArray(req.body.tags)
      ? req.body.tags.map((t) => String(t).trim()).filter(Boolean)
      : typeof req.body.tags === "string"
        ? req.body.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
  }

  if (req.file) {
    updateData.featuredImage = { url: req.file.path, public_id: req.file.filename };
  }

  const updatedPost = await prisma.post.update({
    where: { id: post.id },
    data: updateData,
    include: {
      author: {
        select: { id: true, name: true, email: true, profileImg: true, bio: true, website: true },
      },
    },
  });

  res.json({
    success: true,
    message: "Post updated successfully",
    data: serializePost(updatedPost),
  });
});

// @desc    Delete a post
// @route   DELETE /api/v1/posts/:id
// @access  Private
const deletePost = asyncHandler(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  if (post.authorId !== req.user.id && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Not authorized to delete this post");
  }

  if (post.featuredImage?.public_id && isCloudinaryConfigured()) {
    try {
      await cloudinary.uploader.destroy(post.featuredImage.public_id);
    } catch (err) {
      // Ignore Cloudinary error
    }
  }

  await prisma.post.delete({ where: { id: post.id } });

  res.json({
    success: true,
    message: "Post deleted successfully",
    data: {},
  });
});

// @desc    Toggle like/unlike on a post
// @route   POST /api/v1/posts/:id/like
// @access  Private
const likePost = asyncHandler(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  const existingLike = await prisma.postLike.findUnique({
    where: { userId_postId: { userId: req.user.id, postId: post.id } },
  });

  let hasLiked = false;
  let updatedPost;

  if (existingLike) {
    await prisma.postLike.delete({ where: { id: existingLike.id } });
    updatedPost = await prisma.post.update({
      where: { id: post.id },
      data: { likesCount: Math.max(0, post.likesCount - 1) },
    });
  } else {
    hasLiked = true;
    await prisma.postLike.create({
      data: { userId: req.user.id, postId: post.id },
    });
    updatedPost = await prisma.post.update({
      where: { id: post.id },
      data: { likesCount: { increment: 1 } },
    });
    await createNotification({
      recipient: post.authorId,
      sender: req.user.id,
      type: "like",
      post: post.id,
      message: `${req.user.name} liked your post "${post.title}"`,
    });
  }

  res.json({
    success: true,
    message: hasLiked ? "Post liked" : "Post unliked",
    data: {
      likesCount: updatedPost.likesCount,
      hasLiked,
    },
  });
});

// @desc    Add a Multi-Reaction / Clap to a post
// @route   POST /api/v1/posts/:id/react
// @access  Private
const reactToPost = asyncHandler(async (req, res) => {
  const { type = "clap", count = 1 } = req.body;
  const validTypes = ["love", "fire", "insightful", "clap"];

  if (!validTypes.includes(type)) {
    res.status(400);
    throw new Error(`Invalid reaction type. Choose one of: ${validTypes.join(", ")}`);
  }

  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  const currentReactions =
    post.reactions && typeof post.reactions === "object"
      ? { love: 0, fire: 0, insightful: 0, clap: 0, ...post.reactions }
      : { love: 0, fire: 0, insightful: 0, clap: 0 };

  const increment = Math.min(10, Math.max(1, parseInt(count, 10) || 1));
  currentReactions[type] = (currentReactions[type] || 0) + increment;

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: { reactions: currentReactions },
  });

  await createNotification({
    recipient: post.authorId,
    sender: req.user.id,
    type: "reaction",
    post: post.id,
    message: `${req.user.name} reacted (${type}) to your post "${post.title}"`,
  });

  res.status(200).json({
    success: true,
    message: `Added ${type} reaction`,
    data: {
      postId: updated.id,
      reactions: updated.reactions,
    },
  });
});

// @desc    Get AI / Tag-Based Related Posts
// @route   GET /api/v1/posts/:id/related
// @access  Public
const getRelatedPosts = asyncHandler(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  const related = await prisma.post.findMany({
    where: {
      id: { not: post.id },
      status: "published",
      OR: [
        { category: post.category },
        ...(post.tags?.length ? [{ tags: { hasSome: post.tags } }] : []),
      ],
    },
    include: {
      author: { select: { id: true, name: true, profileImg: true } },
    },
    orderBy: [{ views: "desc" }, { likesCount: "desc" }],
    take: 4,
  });

  res.status(200).json({
    success: true,
    count: related.length,
    data: related.map(serializePost),
  });
});

// @desc    Get Google Rich Snippet JSON-LD Article Schema for SEO
// @route   GET /api/v1/posts/:id/schema
// @access  Public
const getPostJsonLdSchema = asyncHandler(async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: { author: { select: { id: true, name: true, website: true } } },
  });

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  const baseUrl = process.env.FRONTEND_URL || "https://buzzboard.app";
  const postUrl = post.canonicalUrl || `${baseUrl}/posts/${post.slug || post.id}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription || post.excerpt || post.title,
    image: post.featuredImage?.url ? [post.featuredImage.url] : [],
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    author: [
      {
        "@type": "Person",
        name: post.author?.name || "BuzzBoard Author",
        url: post.author?.website || baseUrl,
      },
    ],
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    keywords: Array.isArray(post.tags) ? post.tags.join(", ") : "",
    articleSection: post.category,
    timeRequired: `PT${post.readingTime || 1}M`,
  };

  res.status(200).json({
    success: true,
    data: jsonLd,
  });
});

// @desc    Get logged-in user's posts
// @route   GET /api/v1/posts/user/my-posts
// @access  Private
const getUserPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const where = { authorId: req.user.id };
  if (status) where.status = status;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true, profileImg: true, bio: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.post.count({ where }),
  ]);

  res.json({
    success: true,
    data: posts.map(serializePost),
    pagination: {
      current: pageNum,
      total: Math.ceil(total / limitNum),
      count: posts.length,
    },
  });
});

module.exports = {
  likePost,
  reactToPost,
  getRelatedPosts,
  getPostJsonLdSchema,
  getPosts,
  createPost,
  updatePost,
  deletePost,
  getPostById,
  getUserPosts,
  calculateEngagementRate,
};
