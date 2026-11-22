const asyncHandler = require("express-async-handler");
const { prisma } = require("../config/database");
const {
  serializePost,
  serializeSeries,
  generateUniqueSlug,
} = require("../utils/serializers");

// @desc    Create a new Series
// @route   POST /api/v1/series
// @access  Private
const createSeries = asyncHandler(async (req, res) => {
  const { title, description, category, status } = req.body;

  if (!title) {
    res.status(400);
    throw new Error("Series title is required");
  }

  const series = await prisma.series.create({
    data: {
      authorId: req.user.id,
      title: String(title).trim(),
      status: status || "ongoing",
      description: description || "",
      slug: generateUniqueSlug(title),
      category: category || "Technology",
    },
    include: {
      author: { select: { id: true, name: true, profileImg: true, bio: true } },
    },
  });

  res.status(201).json({
    success: true,
    data: serializeSeries(series),
    message: "Series created successfully",
  });
});

// @desc    Get all Series
// @route   GET /api/v1/series
// @access  Public
const getAllSeries = asyncHandler(async (req, res) => {
  const { category, author } = req.query;
  const where = {};
  if (category) where.category = category;
  if (author) where.authorId = author;

  const seriesList = await prisma.series.findMany({
    where,
    include: {
      author: { select: { id: true, name: true, profileImg: true, bio: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    success: true,
    count: seriesList.length,
    data: seriesList.map(serializeSeries),
  });
});

// @desc    Get single Series with all ordered Posts
// @route   GET /api/v1/series/:id
// @access  Public
const getSeriesById = asyncHandler(async (req, res) => {
  const identifier = req.params.id;

  const series = await prisma.series.findFirst({
    where: { OR: [{ id: identifier }, { slug: identifier }] },
    include: {
      author: {
        select: {
          id: true,
          bio: true,
          name: true,
          website: true,
          profileImg: true,
        },
      },
    },
  });

  if (!series) {
    res.status(404);
    throw new Error("Series not found");
  }

  const posts = await prisma.post.findMany({
    where: { seriesId: series.id, status: "published" },
    orderBy: [{ seriesOrder: "asc" }, { createdAt: "asc" }],
  });

  res.status(200).json({
    success: true,
    data: {
      totalParts: posts.length,
      series: serializeSeries(series),
      posts: posts.map(serializePost),
    },
  });
});

// @desc    Update Series
// @route   PUT /api/v1/series/:id
// @access  Private
const updateSeries = asyncHandler(async (req, res) => {
  const series = await prisma.series.findUnique({
    where: { id: req.params.id },
  });

  if (!series) {
    res.status(404);
    throw new Error("Series not found");
  }

  if (series.authorId !== req.user.id && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Not authorized to update this series");
  }

  const updateData = {};
  ["title", "description", "category", "status"].forEach((field) => {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  });

  const updated = await prisma.series.update({
    where: { id: series.id },
    data: updateData,
  });

  res.status(200).json({
    success: true,
    data: serializeSeries(updated),
    message: "Series updated successfully",
  });
});

// @desc    Delete Series
// @route   DELETE /api/v1/series/:id
// @access  Private
const deleteSeries = asyncHandler(async (req, res) => {
  const series = await prisma.series.findUnique({
    where: { id: req.params.id },
  });

  if (!series) {
    res.status(404);
    throw new Error("Series not found");
  }

  if (series.authorId !== req.user.id && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Not authorized to delete this series");
  }

  await prisma.series.delete({ where: { id: series.id } });

  res.status(200).json({
    success: true,
    message: "Series deleted successfully",
    data: {},
  });
});

module.exports = {
  createSeries,
  getAllSeries,
  updateSeries,
  deleteSeries,
  getSeriesById,
};
