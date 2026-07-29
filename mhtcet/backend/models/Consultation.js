const mongoose = require("mongoose");

const consultationSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  percentile: { type: String, required: true },
  subjectGroup: { type: String },
  city: { type: String },
  preferredDate: { type: String },
  preferredTime: { type: String },
  additionalInfo: { type: String },
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Consultation", consultationSchema);
