const asyncHandler = require("express-async-handler");
const { prisma } = require("../config/database");
const {
  assistWriting,
  translateContent,
  askArticleQuestion,
  generateSEOMetadata,
  evaluateBrandSafety,
  generatePostSummary,
} = require("../services/aiService");

// @desc    Generate SEO metadata
// @route   POST /api/v1/ai/generate-seo
// @access  Private
const generateSEO = asyncHandler(async (req, res) => {
  const { title, content, category } = req.body;

  if (!content && !title) {
    res.status(400);
    throw new Error("Please provide content or title to generate SEO metadata");
  }

  const seoData = await generateSEOMetadata({ title, content, category });

  res.status(200).json({
    success: true,
    message: "SEO metadata generated successfully",
    data: seoData,
  });
});

// @desc    AI Writing Co-Pilot
// @route   POST /api/v1/ai/assist
// @access  Private
const writingAssistant = asyncHandler(async (req, res) => {
  const {
    prompt,
    content,
    action = "improve",
    tone = "professional",
  } = req.body;

  if (!prompt && !content) {
    res.status(400);
    throw new Error(
      "Please provide a prompt or draft content for the AI assistant",
    );
  }

  const validActions = ["improve", "expand", "outline", "grammar", "tone"];
  if (!validActions.includes(action)) {
    res.status(400);
    throw new Error(
      `Invalid action. Choose one of: ${validActions.join(", ")}`,
    );
  }

  const result = await assistWriting({ prompt, content, action, tone });

  res.status(200).json({
    success: true,
    message: "AI writing assistance completed",
    data: result,
  });
});

// @desc    Get or Generate 1-Click TL;DR Summary for a Post
// @route   GET /api/v1/posts/:id/summary
// @access  Public
const getOrCreatePostSummary = asyncHandler(async (req, res) => {
  const post = await prisma.post.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  const forceRefresh =
    req.query.refresh === "true" || req.body?.refresh === true;

  if (post.aiSummary && !forceRefresh) {
    return res.status(200).json({
      success: true,
      cached: true,
      data: {
        postId: post.id,
        title: post.title,
        summary: post.aiSummary,
        readingTime: post.readingTime,
      },
    });
  }

  const generated = await generatePostSummary({
    title: post.title,
    content: post.content,
  });

  await prisma.post.update({
    where: { id: post.id },
    data: { aiSummary: generated.summary },
  });

  res.status(200).json({
    success: true,
    cached: false,
    provider: generated.provider,
    data: {
      postId: post.id,
      title: post.title,
      summary: generated.summary,
      readingTime: post.readingTime,
    },
  });
});

// @desc    Check Content Brand Safety & Google AdSense Compliance
// @route   POST /api/v1/ai/moderate
// @access  Private
const moderateContent = asyncHandler(async (req, res) => {
  const { title, content, postId } = req.body;

  if (!content && !title && !postId) {
    res.status(400);
    throw new Error(
      "Please provide content, title, or postId to evaluate brand safety",
    );
  }

  let targetTitle = title || "";
  let targetContent = content || "";
  let post = null;

  if (postId) {
    post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      res.status(404);
      throw new Error("Post not found");
    }
    targetTitle = post.title;
    targetContent = post.content;
  }

  const safetyReport = await evaluateBrandSafety({
    title: targetTitle,
    content: targetContent,
  });

  if (post) {
    await prisma.post.update({
      where: { id: post.id },
      data: {
        isAdSafe: safetyReport.isAdSafe,
        adSafetyReason: safetyReport.reason,
      },
    });
  }

  res.status(200).json({
    success: true,
    message: "Brand safety evaluation completed",
    data: safetyReport,
  });
});

// @desc    "Ask AI About This Post"
// @route   POST /api/v1/posts/:id/ask
// @access  Public
const askPostAI = asyncHandler(async (req, res) => {
  const { question } = req.body;

  if (!question || !String(question).trim()) {
    res.status(400);
    throw new Error("Please provide a question about the post");
  }

  const post = await prisma.post.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  const response = await askArticleQuestion({
    title: post.title,
    content: post.content,
    question: String(question).trim(),
  });

  res.status(200).json({
    success: true,
    data: {
      postId: post.id,
      title: post.title,
      ...response,
    },
  });
});

// @desc    1-Click Translate Post or Draft Content
// @route   POST /api/v1/posts/:id/translate
// @access  Public
const translatePostOrDraft = asyncHandler(async (req, res) => {
  const { targetLang = "bn", title, content } = req.body;
  const postId = req.params.id || req.body.postId;

  let sourceTitle = title || "";
  let sourceContent = content || "";

  if (postId) {
    const post = await prisma.post.findFirst({
      where: { OR: [{ id: postId }, { slug: postId }] },
    });
    if (!post) {
      res.status(404);
      throw new Error("Post not found");
    }
    sourceTitle = post.title;
    sourceContent = post.content;
  }

  if (!sourceContent && !sourceTitle) {
    res.status(400);
    throw new Error("Please provide a postId or content to translate");
  }

  const translated = await translateContent({
    title: sourceTitle,
    content: sourceContent,
    targetLang,
  });

  res.status(200).json({
    success: true,
    message: "Translation completed",
    data: translated,
  });
});

module.exports = {
  askPostAI,
  generateSEO,
  moderateContent,
  writingAssistant,
  translatePostOrDraft,
  getOrCreatePostSummary,
};
