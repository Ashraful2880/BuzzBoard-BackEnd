const asyncHandler = require("express-async-handler");
const { prisma } = require("../config/database");
const { createNotification } = require("./notificationController");
const { serializeUser, serializePost } = require("../utils/serializers");

// @desc    Toggle bookmark on a post (Add / Remove from Reading List)
// @route   POST /api/v1/users/bookmarks/:postId
// @access  Private
const toggleBookmark = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  const existing = await prisma.bookmark.findUnique({
    where: { userId_postId: { userId: req.user.id, postId: post.id } },
  });

  let isBookmarked = false;
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
  } else {
    isBookmarked = true;
    await prisma.bookmark.create({
      data: { userId: req.user.id, postId: post.id },
    });
  }

  const bookmarksCount = await prisma.bookmark.count({
    where: { userId: req.user.id },
  });

  res.json({
    success: true,
    message: isBookmarked ? "Post bookmarked" : "Post removed from bookmarks",
    data: { isBookmarked, bookmarksCount },
  });
});

// @desc    Get logged-in user's bookmarked posts (Reading List)
// @route   GET /api/v1/users/bookmarks
// @access  Private
const getBookmarks = asyncHandler(async (req, res) => {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: req.user.id },
    include: {
      post: {
        include: {
          author: {
            select: { id: true, name: true, email: true, profileImg: true, bio: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const posts = bookmarks.map((b) => serializePost(b.post));

  res.json({
    success: true,
    count: posts.length,
    data: posts,
  });
});

// @desc    Follow / Unfollow an author
// @route   POST /api/v1/users/:id/follow
// @access  Private
const toggleFollow = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;
  const currentUserId = req.user.id;

  if (targetUserId === currentUserId) {
    res.status(400);
    throw new Error("You cannot follow yourself");
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) {
    res.status(404);
    throw new Error("User to follow not found");
  }

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: { followerId: currentUserId, followingId: targetUserId },
    },
  });

  let isFollowing = false;
  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
  } else {
    isFollowing = true;
    await prisma.follow.create({
      data: { followerId: currentUserId, followingId: targetUserId },
    });
    await createNotification({
      recipient: targetUserId,
      sender: currentUserId,
      type: "follow",
      message: `${req.user.name} started following you`,
    });
  }

  const [followersCount, followingCount] = await Promise.all([
    prisma.follow.count({ where: { followingId: targetUserId } }),
    prisma.follow.count({ where: { followerId: currentUserId } }),
  ]);

  res.json({
    success: true,
    message: isFollowing ? `Following ${targetUser.name}` : `Unfollowed ${targetUser.name}`,
    data: { isFollowing, followersCount, followingCount },
  });
});

// @desc    Get public author profile & their published posts
// @route   GET /api/v1/users/:id/profile
// @access  Public
const getPublicAuthorProfile = asyncHandler(async (req, res) => {
  const author = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { followers: true, following: true } },
    },
  });

  if (!author) {
    res.status(404);
    throw new Error("Author not found");
  }

  const posts = await prisma.post.findMany({
    where: { authorId: author.id, status: "published" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const totalViews = posts.reduce((acc, post) => acc + (post.views || 0), 0);
  const totalLikes = posts.reduce((acc, post) => acc + (post.likesCount || 0), 0);

  res.json({
    success: true,
    data: {
      author: {
        ...serializeUser(author),
        followersCount: author._count.followers,
        followingCount: author._count.following,
        joinedAt: author.createdAt,
      },
      stats: {
        publishedPosts: posts.length,
        totalViews,
        totalLikes,
      },
      posts: posts.map(serializePost),
    },
  });
});

module.exports = {
  toggleBookmark,
  getBookmarks,
  toggleFollow,
  getPublicAuthorProfile,
};
