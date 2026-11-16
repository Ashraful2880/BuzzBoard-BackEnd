const express = require("express");
const {
  generateSEO,
  writingAssistant,
  getOrCreatePostSummary,
  moderateContent,
  askPostAI,
  translatePostOrDraft,
} = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/generate-seo", protect, generateSEO);
router.post("/assist", protect, writingAssistant);
router.post("/moderate", protect, moderateContent);
router.get("/summarize/:id", getOrCreatePostSummary);
router.post("/summarize/:id", getOrCreatePostSummary);
router.post("/ask/:id", askPostAI);
router.post("/translate", translatePostOrDraft);

module.exports = router;
