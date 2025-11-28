const express = require("express");
const router = express.Router();
const Session = require("../models/Session");
const crypto = require("crypto");

// Create a secure review session link
router.post("/create", async (req, res) => {
  const { psychicId, customerEmail } = req.body;

  const sessionId = crypto.randomBytes(16).toString("hex");

  const session = await Session.create({
    sessionId,
    psychicId,
    customerEmail,
  });

  res.json({
    success: true,
    reviewLink: `/review.html?session=${sessionId}`,
  });
});

// Verify a review session link
router.get("/verify/:sessionId", async (req, res) => {
  const session = await Session.findOne({ sessionId: req.params.sessionId });

  if (!session || session.used) return res.json({ valid: false });

  res.json({
    valid: true,
    psychicId: session.psychicId,
    customerEmail: session.customerEmail,
  });
});

// Mark session as used
router.post("/use/:sessionId", async (req, res) => {
  await Session.findOneAndUpdate(
    { sessionId: req.params.sessionId },
    { used: true }
  );

  res.json({ success: true });
});
// DEBUG: Get all sessions
router.get("/all", async (req, res) => {
  const sessions = await Session.find({});
  res.json(sessions);
});

module.exports = router;
