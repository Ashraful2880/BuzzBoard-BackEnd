const assert = require("assert");
const { EventEmitter } = require("events");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET = "buzzboard_prisma_test_secret_2026";
process.env.JWT_EXPIRES_IN = "7d";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/buzzboard_test";

const app = require("../server");
const { prisma } = require("../src/config/database");
const { generateToken, verifyToken } = require("../src/utils/generateToken");
const {
  generateUniqueSlug,
  calculateReadingTime,
  buildExcerpt,
} = require("../src/utils/serializers");

function invokeApp(method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = url;
    req.originalUrl = url;
    const [pathOnly, queryStr] = url.split("?");
    req.path = pathOnly;
    req.query = {};
    if (queryStr) {
      for (const [k, v] of new URLSearchParams(queryStr)) {
        req.query[k] = v;
      }
    }
    req.headers = {
      "content-type": "application/json",
      ...Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
      ),
    };
    req.body = body || {};
    req.socket = { remoteAddress: "127.0.0.1" };
    req.connection = req.socket;
    req.get = (name) => req.headers[name.toLowerCase()];
    req._body = true;

    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    res.setHeader = (k, v) => {
      res.headers[k.toLowerCase()] = v;
    };
    res.getHeader = (k) => res.headers[k.toLowerCase()];
    res.removeHeader = (k) => {
      delete res.headers[k.toLowerCase()];
    };
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
    res.json = function (data) {
      this.setHeader("content-type", "application/json");
      resolve({ status: this.statusCode, body: data, headers: this.headers });
      return this;
    };
    res.send = function (data) {
      resolve({ status: this.statusCode, body: data, headers: this.headers });
      return this;
    };
    res.end = function (data) {
      resolve({ status: this.statusCode, body: data, headers: this.headers });
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
    });
  });
}

async function runTestSuite() {
  console.log("====================================================================");
  console.log("  BuzzBoard-Server (PostgreSQL + Prisma ORM) Test Suite (v2.0.0)");
  console.log("====================================================================");

  // 1. Health, Docs & Security Headers
  const healthRes = await invokeApp("GET", "/api/v1/health");
  assert.strictEqual(healthRes.status, 200);
  assert.strictEqual(healthRes.headers["x-content-type-options"], "nosniff");
  assert.strictEqual(healthRes.headers["x-frame-options"], "DENY");

  const docsRes = await invokeApp("GET", "/api/v1/docs");
  assert.strictEqual(docsRes.status, 200);
  assert.ok(docsRes.body.modules.ai.length >= 4);
  console.log("[PASS] Module 0: Health, API Docs & Security Headers");

  // 2. Serializers & Domain Helpers
  const slug = generateUniqueSlug("PostgreSQL + Prisma SaaS Architecture!");
  assert.ok(slug.startsWith("postgresql-prisma-saas-architecture-"));
  assert.strictEqual(calculateReadingTime("word ".repeat(350)), 2);
  assert.ok(buildExcerpt("Hello world").length > 0);
  console.log("[PASS] Module 1: Prisma Serializers, Slug & Reading Time Helpers");

  // Setup In-Memory Relational Mock Store for Prisma Client
  const hashedPw = await bcrypt.hash("password123", 10);
  const authorUser = {
    id: "user_author_001",
    name: "Md Ashraful Islam",
    email: "contact.ashraful1@gmail.com",
    password: hashedPw,
    role: "admin",
    bio: "Senior Full-Stack Engineer",
    website: "https://ashrafulislam.netlify.app",
    profileImg: { url: "", public_id: "" },
    socialLinks: { twitter: "", linkedin: "", github: "" },
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const readerUser = {
    id: "user_reader_002",
    name: "Sarah Tech",
    email: "sarah@example.com",
    password: hashedPw,
    role: "user",
    bio: "Reader",
    website: "",
    profileImg: { url: "", public_id: "" },
    socialLinks: {},
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const usersStore = [authorUser, readerUser];
  const postsStore = [
    {
      id: "post_001",
      title: "Production-Ready Node.js & PostgreSQL Architecture",
      slug: "production-ready-node-js-postgresql-architecture-abc123",
      content:
        "Designing a high-performance SaaS platform with PostgreSQL and Prisma ORM ensures strict relational integrity and sub-50ms indexed queries. ".repeat(
          8
        ),
      excerpt: "High-performance SaaS platform with PostgreSQL and Prisma ORM.",
      featuredImage: { url: "", public_id: "" },
      category: "Technology",
      tags: ["postgresql", "prisma", "nodejs"],
      status: "published",
      scheduledAt: null,
      seriesId: null,
      seriesOrder: 0,
      aiGenerated: false,
      aiAssisted: true,
      aiSummary: "",
      readingTime: 2,
      isAdSafe: true,
      adSafetyReason: "",
      isSponsored: false,
      sponsorName: "",
      sponsorUrl: "",
      likesCount: 10,
      reactions: { love: 1, fire: 2, insightful: 3, clap: 5 },
      commentsCount: 0,
      views: 320,
      metaDescription: "PostgreSQL + Prisma SaaS Architecture",
      canonicalUrl: "",
      authorId: authorUser.id,
      author: authorUser,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const commentsStore = [];
  const bookmarksStore = [];
  const followsStore = [];
  const notificationsStore = [];
  const seriesStore = [];
  const adsStore = [];
  const newsletterStore = [];

  // Mock Prisma Methods cleanly
  prisma.user.findUnique = async ({ where }) =>
    usersStore.find((u) => u.id === where.id || u.email === where.email) || null;

  prisma.post.updateMany = async () => ({ count: 0 });
  prisma.post.findMany = async () => postsStore;
  prisma.post.count = async () => postsStore.length;
  prisma.post.findUnique = async ({ where }) =>
    postsStore.find((p) => p.id === where.id || p.slug === where.slug) || null;
  prisma.post.findFirst = async ({ where }) => {
    const ids = where?.OR?.map((c) => c.id || c.slug).filter(Boolean) || [];
    return postsStore.find((p) => ids.includes(p.id) || ids.includes(p.slug)) || postsStore[0];
  };
  prisma.post.update = async ({ where, data }) => {
    const post = postsStore.find((p) => p.id === where.id);
    if (!post) return null;
    if (data.views?.increment) post.views += data.views.increment;
    if (data.commentsCount?.increment) post.commentsCount += data.commentsCount.increment;
    if (data.likesCount?.increment) post.likesCount += data.likesCount.increment;
    if (data.aiSummary !== undefined) post.aiSummary = data.aiSummary;
    if (data.reactions !== undefined) post.reactions = data.reactions;
    if (data.isAdSafe !== undefined) post.isAdSafe = data.isAdSafe;
    return post;
  };

  prisma.comment.create = async ({ data }) => {
    const c = {
      id: `comment_${commentsStore.length + 1}`,
      ...data,
      likesCount: 0,
      isEdited: false,
      status: "active",
      author: usersStore.find((u) => u.id === data.authorId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    commentsStore.push(c);
    return c;
  };

  prisma.bookmark.findUnique = async ({ where }) =>
    bookmarksStore.find(
      (b) =>
        b.userId === where.userId_postId.userId &&
        b.postId === where.userId_postId.postId
    ) || null;
  prisma.bookmark.create = async ({ data }) => {
    const b = { id: `bm_${bookmarksStore.length + 1}`, ...data };
    bookmarksStore.push(b);
    return b;
  };
  prisma.bookmark.count = async ({ where }) =>
    bookmarksStore.filter((b) => b.userId === where.userId).length;

  prisma.follow.findUnique = async ({ where }) =>
    followsStore.find(
      (f) =>
        f.followerId === where.followerId_followingId.followerId &&
        f.followingId === where.followerId_followingId.followingId
    ) || null;
  prisma.follow.create = async ({ data }) => {
    const f = { id: `fl_${followsStore.length + 1}`, ...data };
    followsStore.push(f);
    return f;
  };
  prisma.follow.count = async ({ where }) =>
    followsStore.filter(
      (f) =>
        (where.followingId && f.followingId === where.followingId) ||
        (where.followerId && f.followerId === where.followerId)
    ).length;

  prisma.notification.create = async ({ data }) => {
    const n = {
      id: `notif_${notificationsStore.length + 1}`,
      ...data,
      isRead: false,
      sender: usersStore.find((u) => u.id === data.senderId),
      post: postsStore.find((p) => p.id === data.postId) || null,
      createdAt: new Date(),
    };
    notificationsStore.push(n);
    return n;
  };
  prisma.notification.findMany = async ({ where }) =>
    notificationsStore.filter((n) => n.recipientId === where.recipientId);
  prisma.notification.count = async ({ where }) =>
    notificationsStore.filter((n) => n.recipientId === where.recipientId && !n.isRead).length;

  prisma.series.create = async ({ data }) => {
    const s = {
      id: `series_${seriesStore.length + 1}`,
      ...data,
      author: usersStore.find((u) => u.id === data.authorId),
      createdAt: new Date(),
    };
    seriesStore.push(s);
    return s;
  };

  prisma.adCampaign.create = async ({ data }) => {
    const a = {
      id: `ad_${adsStore.length + 1}`,
      ...data,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      createdAt: new Date(),
    };
    adsStore.push(a);
    return a;
  };
  prisma.adCampaign.findMany = async () => adsStore;
  prisma.adCampaign.findUnique = async ({ where }) =>
    adsStore.find((a) => a.id === where.id) || null;
  prisma.adCampaign.update = async ({ where, data }) => {
    const a = adsStore.find((ad) => ad.id === where.id);
    if (!a) return null;
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === "object" && "increment" in val) {
        a[key] = (a[key] || 0) + val.increment;
      } else {
        a[key] = val;
      }
    }
    return a;
  };
  prisma.adCampaign.updateMany = async ({ where, data }) => {
    const ids = where?.id?.in || [];
    let count = 0;
    for (const a of adsStore) {
      if (ids.length === 0 || ids.includes(a.id)) {
        for (const [key, val] of Object.entries(data)) {
          if (val && typeof val === "object" && "increment" in val) {
            a[key] = (a[key] || 0) + val.increment;
          } else {
            a[key] = val;
          }
        }
        count++;
      }
    }
    return { count };
  };

  prisma.newsletter.findUnique = async ({ where }) =>
    newsletterStore.find((n) => n.email === where.email) || null;
  prisma.newsletter.create = async ({ data }) => {
    const n = { id: `nl_${newsletterStore.length + 1}`, ...data, createdAt: new Date() };
    newsletterStore.push(n);
    return n;
  };

  const authorToken = generateToken(authorUser.id);
  const readerToken = generateToken(readerUser.id);
  assert.strictEqual(verifyToken(authorToken).id, authorUser.id);

  // 3. Test Community & Engagement
  const commentRes = await invokeApp(
    "POST",
    `/api/v1/posts/${postsStore[0].id}/comments`,
    { content: "Clean PostgreSQL + Prisma relational design!" },
    { Authorization: `Bearer ${readerToken}` }
  );
  assert.strictEqual(commentRes.status, 201);
  assert.strictEqual(postsStore[0].commentsCount, 1);

  const bookmarkRes = await invokeApp(
    "POST",
    `/api/v1/users/bookmarks/${postsStore[0].id}`,
    {},
    { Authorization: `Bearer ${readerToken}` }
  );
  assert.strictEqual(bookmarkRes.status, 200);
  assert.strictEqual(bookmarkRes.body.data.isBookmarked, true);

  const followRes = await invokeApp(
    "POST",
    `/api/v1/users/${authorUser.id}/follow`,
    {},
    { Authorization: `Bearer ${readerToken}` }
  );
  assert.strictEqual(followRes.status, 200);
  assert.strictEqual(followRes.body.data.isFollowing, true);
  console.log("[PASS] Module 2: Community Engagement (Comments, Bookmarks, Follow)");

  // 4. Test AI Engine
  const seoRes = await invokeApp(
    "POST",
    "/api/v1/ai/generate-seo",
    { title: postsStore[0].title, content: postsStore[0].content, category: "Technology" },
    { Authorization: `Bearer ${authorToken}` }
  );
  assert.strictEqual(seoRes.status, 200);
  assert.ok(seoRes.body.data.metaDescription.length <= 160);

  const summaryRes = await invokeApp("GET", `/api/v1/posts/${postsStore[0].id}/summary`);
  assert.strictEqual(summaryRes.status, 200);
  assert.ok(summaryRes.body.data.summary.includes("TL;DR"));

  const askRes = await invokeApp("POST", `/api/v1/posts/${postsStore[0].id}/ask`, {
    question: "Why use PostgreSQL and Prisma ORM?",
  });
  assert.strictEqual(askRes.status, 200);
  assert.ok(askRes.body.data.answer.length > 10);

  const translateRes = await invokeApp("POST", `/api/v1/posts/${postsStore[0].id}/translate`, {
    targetLang: "bn",
  });
  assert.strictEqual(translateRes.status, 200);
  assert.strictEqual(translateRes.body.data.targetLang, "bn");
  console.log("[PASS] Module 3: AI Engine (Auto-SEO, TL;DR, Ask AI, Bangla Translate)");

  // 5. Test Ad-Tech, Analytics, Sitemap & RSS
  const adRes = await invokeApp(
    "POST",
    "/api/v1/ads",
    {
      title: "ByShelp Cloud ERP",
      sponsorName: "Madmind Digitals",
      targetUrl: "https://byshelp.com",
      placement: "in_article",
    },
    { Authorization: `Bearer ${authorToken}` }
  );
  assert.strictEqual(adRes.status, 201);
  const adId = adRes.body.data.id;

  const activeAdRes = await invokeApp("GET", "/api/v1/ads/active?placement=in_article");
  assert.strictEqual(activeAdRes.status, 200);
  assert.strictEqual(activeAdRes.body.data[0].impressions, 1);

  const clickAdRes = await invokeApp("POST", `/api/v1/ads/${adId}/click`);
  assert.strictEqual(clickAdRes.status, 200);
  assert.strictEqual(clickAdRes.body.data.ctr, 100);

  const analyticsRes = await invokeApp(
    "GET",
    "/api/v1/analytics/creator",
    null,
    { Authorization: `Bearer ${authorToken}` }
  );
  assert.strictEqual(analyticsRes.status, 200);
  assert.strictEqual(analyticsRes.body.data.overview.totalViews, 320);

  const rssRes = await invokeApp("GET", "/api/v1/seo/rss.xml");
  assert.strictEqual(rssRes.status, 200);
  assert.ok(String(rssRes.body).includes("<rss version=\"2.0\">"));
  console.log("[PASS] Module 4: Ad-Tech Monetization, Analytics, Sitemap & RSS 2.0");

  // 6. Test Notifications, Reactions, Series, Newsletter & Unique Views
  const reactRes = await invokeApp(
    "POST",
    `/api/v1/posts/${postsStore[0].id}/react`,
    { type: "fire", count: 2 },
    { Authorization: `Bearer ${readerToken}` }
  );
  assert.strictEqual(reactRes.status, 200);
  assert.strictEqual(reactRes.body.data.reactions.fire, 4);

  const notifRes = await invokeApp(
    "GET",
    "/api/v1/notifications",
    null,
    { Authorization: `Bearer ${authorToken}` }
  );
  assert.strictEqual(notifRes.status, 200);
  assert.ok(notifRes.body.unreadCount >= 3);

  const viewsBefore = postsStore[0].views;
  await invokeApp("GET", `/api/v1/posts/${postsStore[0].id}`, null, { "x-viewer-id": "v1" });
  const v2 = await invokeApp("GET", `/api/v1/posts/${postsStore[0].id}`, null, { "x-viewer-id": "v1" });
  assert.strictEqual(postsStore[0].views, viewsBefore + 1);
  assert.ok(v2.body.data.liveReaders >= 1);

  const seriesRes = await invokeApp(
    "POST",
    "/api/v1/series",
    { title: "PostgreSQL & Prisma Masterclass", category: "Technology" },
    { Authorization: `Bearer ${authorToken}` }
  );
  assert.strictEqual(seriesRes.status, 201);

  const nlRes = await invokeApp("POST", "/api/v1/newsletter/subscribe", {
    email: "engineer@example.com",
  });
  assert.strictEqual(nlRes.status, 201);
  console.log("[PASS] Module 5: Notifications, Reactions, Series, Newsletter & Unique Views");

  console.log("====================================================================");
  console.log("  ALL 6 POSTGRESQL + PRISMA TEST MODULES PASSED (100% SUCCESS)");
  console.log("====================================================================");
}

runTestSuite().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
