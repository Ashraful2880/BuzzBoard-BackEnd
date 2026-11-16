// Helper serializers to ensure consistent API response shapes across PostgreSQL/Prisma & Frontend

const serializeUser = (user) => {
  if (!user) return null;
  const { password, ...rest } = user;
  return {
    ...rest,
    _id: user.id,
    profile_img: user.profileImg || { url: "", public_id: "" },
  };
};

const serializePost = (post) => {
  if (!post) return null;
  return {
    ...post,
    _id: post.id,
    author: post.author ? serializeUser(post.author) : post.authorId,
  };
};

const serializeComment = (comment) => {
  if (!comment) return null;
  return {
    ...comment,
    _id: comment.id,
    post: comment.postId,
    parentComment: comment.parentId || null,
    author: comment.author ? serializeUser(comment.author) : comment.authorId,
    replies: Array.isArray(comment.replies)
      ? comment.replies.map(serializeComment)
      : [],
  };
};

const serializeSeries = (series) => {
  if (!series) return null;
  return {
    ...series,
    _id: series.id,
    author: series.author ? serializeUser(series.author) : series.authorId,
  };
};

const serializeAd = (ad) => {
  if (!ad) return null;
  return {
    ...ad,
    _id: ad.id,
  };
};

const serializeNotification = (notif) => {
  if (!notif) return null;
  return {
    ...notif,
    _id: notif.id,
    recipient: notif.recipientId,
    sender: notif.sender ? serializeUser(notif.sender) : notif.senderId,
    post: notif.post ? { _id: notif.post.id, id: notif.post.id, title: notif.post.title, slug: notif.post.slug } : null,
  };
};

const generateUniqueSlug = (title) => {
  const baseSlug = String(title || "post")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  return `${baseSlug}-${suffix}`;
};

const calculateReadingTime = (content) => {
  const wordCount = String(content || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
};

const buildExcerpt = (content, explicitExcerpt) => {
  if (explicitExcerpt && explicitExcerpt.trim()) return explicitExcerpt.trim();
  const plainText = String(content || "").replace(/[#_*`~>-]/g, "").trim();
  return plainText.length > 160 ? `${plainText.substring(0, 157)}...` : plainText;
};

module.exports = {
  serializeUser,
  serializePost,
  serializeComment,
  serializeSeries,
  serializeAd,
  serializeNotification,
  generateUniqueSlug,
  calculateReadingTime,
  buildExcerpt,
};
