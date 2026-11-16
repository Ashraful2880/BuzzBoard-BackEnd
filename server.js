const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const { connectDB } = require("./src/config/database");
const errorHandler = require("./src/middleware/errorMiddleware");
const {
  securityHeadersAndSanitizer,
  createRateLimiter,
} = require("./src/middleware/securityMiddleware");

const app = express();

// Core & Security Middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(securityHeadersAndSanitizer);
app.use("/api", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 200 }));

// Static folder for local uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health, Welcome & Interactive API Documentation Routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to BuzzBoard API — AI-Powered Publishing & Monetization Platform",
    version: "1.0.0",
    docs: "/api/v1/docs",
    health: "/api/v1/health",
  });
});

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/v1/docs", (req, res) => {
  res.status(200).json({
    success: true,
    name: "BuzzBoard REST API v1",
    version: "1.0.0",
    modules: {
      auth: [
        "POST /api/v1/auth/register",
        "POST /api/v1/auth/login",
        "GET  /api/v1/auth/profile",
        "PUT  /api/v1/auth/profile",
      ],
      posts: [
        "GET    /api/v1/posts",
        "POST   /api/v1/posts",
        "GET    /api/v1/posts/user/my-posts",
        "GET    /api/v1/posts/:id",
        "PUT    /api/v1/posts/:id",
        "DELETE /api/v1/posts/:id",
        "POST   /api/v1/posts/:id/like",
        "GET    /api/v1/posts/:id/summary",
      ],
      engagement: [
        "GET    /api/v1/posts/:postId/comments",
        "POST   /api/v1/posts/:postId/comments",
        "PUT    /api/v1/comments/:id",
        "DELETE /api/v1/comments/:id",
        "POST   /api/v1/comments/:id/like",
        "GET    /api/v1/users/bookmarks",
        "POST   /api/v1/users/bookmarks/:postId",
        "GET    /api/v1/users/:id/profile",
        "POST   /api/v1/users/:id/follow",
      ],
      ai: [
        "POST /api/v1/ai/generate-seo",
        "POST /api/v1/ai/assist",
        "POST /api/v1/ai/moderate",
        "GET  /api/v1/ai/summarize/:id",
      ],
      adsAndAnalytics: [
        "GET    /api/v1/ads/active",
        "POST   /api/v1/ads/:id/click",
        "GET    /api/v1/ads",
        "POST   /api/v1/ads",
        "PUT    /api/v1/ads/:id",
        "DELETE /api/v1/ads/:id",
        "GET    /api/v1/analytics/creator",
        "GET    /api/v1/analytics/monetization",
        "GET    /api/v1/seo/sitemap",
        "GET    /api/v1/seo/trending",
        "GET    /api/v1/seo/rss.xml",
      ],
      zeroCostRetentionAndGrowth: [
        "GET    /api/v1/notifications",
        "PATCH  /api/v1/notifications/read-all",
        "PATCH  /api/v1/notifications/:id/read",
        "GET    /api/v1/series",
        "POST   /api/v1/series",
        "GET    /api/v1/series/:id",
        "POST   /api/v1/newsletter/subscribe",
        "POST   /api/v1/newsletter/unsubscribe",
        "POST   /api/v1/posts/:id/react",
        "POST   /api/v1/posts/:id/ask",
        "POST   /api/v1/posts/:id/translate",
        "GET    /api/v1/posts/:id/related",
        "GET    /api/v1/posts/:id/schema",
      ],
    },
  });
});

// Auth routes
app.use("/api/v1", require("./src/routes/authRoutes"));
app.use("/api/v1/auth", require("./src/routes/authRoutes"));

// Post routes
app.use("/api/v1/posts", require("./src/routes/postRoutes"));

// Comment routes
app.use("/api/v1/comments", require("./src/routes/commentRoutes"));

// User community routes (Bookmarks, Follow, Public Author Profile)
app.use("/api/v1/users", require("./src/routes/userRoutes"));

// AI routes (Auto-SEO, Writing Co-Pilot, TL;DR Summary, Brand Safety)
app.use("/api/v1/ai", require("./src/routes/aiRoutes"));

// Ad-Tech & Monetization routes
app.use("/api/v1/ads", require("./src/routes/adRoutes"));

// Analytics & SEO Sitemap routes
app.use("/api/v1/analytics", require("./src/routes/analyticsRoutes"));
app.use("/api/v1/seo", require("./src/routes/seoRoutes"));

// Notifications, Series (Multi-Part Tutorials) & Newsletter routes
app.use("/api/v1/notifications", require("./src/routes/notificationRoutes"));
app.use("/api/v1/series", require("./src/routes/seriesRoutes"));
app.use("/api/v1/newsletter", require("./src/routes/newsletterRoutes"));

// Handle Undefined Routes (MUST be before errorHandler)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot find ${req.originalUrl} on this server`,
  });
});

// Global Error Handling Middleware
app.use(errorHandler);

// Start server when run directly
if (require.main === module) {
  connectDB()
    .then(() => {
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log(`BuzzBoard is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Failed to connect to database:", err);
      process.exit(1);
    });
}

module.exports = app;
