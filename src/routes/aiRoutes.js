const express = require("express");
const {
  askPostAI,
  generateSEO,
  moderateContent,
  writingAssistant,
  translatePostOrDraft,
  getOrCreatePostSummary,
} = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/ask/:id", askPostAI);
router.post("/translate", translatePostOrDraft);
router.post("/assist", protect, writingAssistant);
router.post("/generate-seo", protect, generateSEO);
router.post("/moderate", protect, moderateContent);
router.get("/summarize/:id", getOrCreatePostSummary);
router.post("/summarize/:id", getOrCreatePostSummary);

module.exports = router;
