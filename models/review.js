const mongoose = require("mongoose");

const RebuttalSchema = new mongoose.Schema({
  text: String,
  date: { type: Date, default: Date.now },
});

const ReviewSchema = new mongoose.Schema({
  psychicId: String,
  customerName: String,
  rating: Number,
  comment: String,
  date: { type: Date, default: Date.now },
  rebuttal: RebuttalSchema,
});

module.exports = mongoose.model("Review", ReviewSchema);
