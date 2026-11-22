const express = require("express");
const {
  getSitemap,
  getRssFeed,
  getTrendingPosts,
} = require("../controllers/analyticsController");

const router = express.Router();

router.get("/sitemap", getSitemap);
router.get("/rss.xml", getRssFeed);
router.get("/trending", getTrendingPosts);

module.exports = router;
