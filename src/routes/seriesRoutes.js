const express = require("express");
const {
  createSeries,
  getAllSeries,
  updateSeries,
  deleteSeries,
  getSeriesById,
} = require("../controllers/seriesController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getAllSeries);
router.get("/:id", getSeriesById);
router.post("/", protect, createSeries);
router.put("/:id", protect, updateSeries);
router.delete("/:id", protect, deleteSeries);

module.exports = router;
