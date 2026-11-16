const asyncHandler = require("express-async-handler");
const { prisma } = require("../config/database");
const { createNotification } = require("./notificationController");
const { serializeComment } = require("../utils/serializers");

// @desc    Get comments for a post (including nested replies)
// @route   GET /api/v1/posts/:postId/comments
// @access  Public
const getPostComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

  const rootWhere = {
    postId,
    parentId: null,
    status: "active",
  };

  const [rootComments, totalRootComments] = await Promise.all([
    prisma.comment.findMany({
      where: rootWhere,
      include: {
        author: { select: { id: true, name: true, profileImg: true, role: true, bio: true } },
        replies: {
          where: { status: "active" },
          include: {
            author: { select: { id: true, name: true, profileImg: true, role: true, bio: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.comment.count({ where: rootWhere }),
  ]);

  res.json({
    success: true,
    data: rootComments.map(serializeComment),
    pagination: {
      current: pageNum,
      total: totalRootComments,
      totalPages: Math.ceil(totalRootComments / limitNum),
    },
  });
});

// @desc    Create a comment or nested reply on a post
// @route   POST /api/v1/posts/:postId/comments
// @access  Private
const createComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content, parentComment } = req.body;

  if (!content || !String(content).trim()) {
    res.status(400);
    throw new Error("Comment content is required");
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  if (parentComment) {
    const parent = await prisma.comment.findUnique({ where: { id: parentComment } });
    if (!parent || parent.postId !== postId) {
      res.status(400);
      throw new Error("Invalid parent comment for this post");
    }
  }

  const comment = await prisma.comment.create({
    data: {
      postId,
      authorId: req.user.id,
      content: String(content).trim(),
      parentId: parentComment || null,
    },
    include: {
      author: { select: { id: true, name: true, profileImg: true, role: true, bio: true } },
    },
  });

  await prisma.post.update({
    where: { id: post.id },
    data: { commentsCount: { increment: 1 } },
  });

  await createNotification({
    recipient: post.authorId,
    sender: req.user.id,
    type: parentComment ? "reply" : "comment",
    post: post.id,
    comment: comment.id,
    message: `${req.user.name} commented on your post "${post.title}"`,
  });

  res.status(201).json({
    success: true,
    message: "Comment added successfully",
    data: serializeComment(comment),
  });
});

// @desc    Update a comment
// @route   PUT /api/v1/comments/:id
// @access  Private
const updateComment = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content || !String(content).trim()) {
    res.status(400);
    throw new Error("Comment content is required");
  }

  const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!comment) {
    res.status(404);
    throw new Error("Comment not found");
  }

  if (comment.authorId !== req.user.id && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Not authorized to update this comment");
  }

  const updated = await prisma.comment.update({
    where: { id: comment.id },
    data: { content: String(content).trim(), isEdited: true },
    include: {
      author: { select: { id: true, name: true, profileImg: true, role: true, bio: true } },
    },
  });

  res.json({
    success: true,
    message: "Comment updated successfully",
    data: serializeComment(updated),
  });
});

// @desc    Delete a comment (and its nested replies via Cascade)
// @route   DELETE /api/v1/comments/:id
// @access  Private
const deleteComment = asyncHandler(async (req, res) => {
  const comment = await prisma.comment.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { replies: true } } },
  });

  if (!comment) {
    res.status(404);
    throw new Error("Comment not found");
  }

  if (comment.authorId !== req.user.id && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Not authorized to delete this comment");
  }

  const deletedCount = 1 + (comment._count?.replies || 0);
  await prisma.comment.delete({ where: { id: comment.id } });

  const post = await prisma.post.findUnique({ where: { id: comment.postId } });
  if (post) {
    await prisma.post.update({
      where: { id: post.id },
      data: { commentsCount: Math.max(0, post.commentsCount - deletedCount) },
    });
  }

  res.json({
    success: true,
    message: "Comment deleted successfully",
    data: { deletedCount },
  });
});

// @desc    Toggle like/unlike on a comment
// @route   POST /api/v1/comments/:id/like
// @access  Private
const likeComment = asyncHandler(async (req, res) => {
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!comment) {
    res.status(404);
    throw new Error("Comment not found");
  }

  const existing = await prisma.commentLike.findUnique({
    where: { userId_commentId: { userId: req.user.id, commentId: comment.id } },
  });

  let hasLiked = false;
  let updated;

  if (existing) {
    await prisma.commentLike.delete({ where: { id: existing.id } });
    updated = await prisma.comment.update({
      where: { id: comment.id },
      data: { likesCount: Math.max(0, comment.likesCount - 1) },
    });
  } else {
    hasLiked = true;
    await prisma.commentLike.create({
      data: { userId: req.user.id, commentId: comment.id },
    });
    updated = await prisma.comment.update({
      where: { id: comment.id },
      data: { likesCount: { increment: 1 } },
    });
  }

  res.json({
    success: true,
    message: hasLiked ? "Comment liked" : "Comment unliked",
    data: {
      likesCount: updated.likesCount,
      hasLiked,
    },
  });
});

module.exports = {
  getPostComments,
  createComment,
  updateComment,
  deleteComment,
  likeComment,
};
