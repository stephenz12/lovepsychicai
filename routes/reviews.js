const express = require("express");
const router = express.Router();
const Review = require("../models/Review");

// Submit a customer review
router.post("/submit", async (req, res) => {
  try {
    const review = await Review.create(req.body);

    // Mark the session as used
    const sessionId = req.body.sessionId;
    if (sessionId) {
      const Session = require("../models/Session");
      await Session.findOneAndUpdate({ sessionId }, { used: true });
    }

    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Psychic rebuttal to a review
router.post("/rebuttal/:reviewId", async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.reviewId,
      { rebuttal: { text: req.body.text } },
      { new: true }
    );

    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all reviews for one psychic
router.get("/:psychicId", async (req, res) => {
  try {
    const reviews = await Review.find({ psychicId: req.params.psychicId });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
