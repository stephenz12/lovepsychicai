const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  sessionId: String, // unique review link token
  psychicId: String, // psychic who gave the reading
  customerEmail: String, // paid customer's email
  used: { type: Boolean, default: false }, // prevents multiple reviews
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Session", SessionSchema);
