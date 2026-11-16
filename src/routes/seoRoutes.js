const express = require("express");
const {
  getSitemap,
  getTrendingPosts,
  getRssFeed,
} = require("../controllers/analyticsController");

const router = express.Router();

router.get("/sitemap", getSitemap);
router.get("/trending", getTrendingPosts);
router.get("/rss.xml", getRssFeed);

module.exports = router;
