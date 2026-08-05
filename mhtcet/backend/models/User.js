const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true
    },
    authProvider: {
      type: [String],
      default: ["local"]
    },
    profilePicture: {
      type: String,
      default: ""
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    otpCode: {
      type: String,
      default: null
    },
    otpExpires: {
      type: Date,
      default: null
    },
    phone: {
      type: String,
      default: "N/A"
    },
    cetRollNumber: {
      type: String,
      default: "N/A"
    },
    category: {
      type: String,
      default: "OPEN"
    },
    percentile: {
      type: Number,
      default: 0
    },
    password: {
      type: String,
      required: false
    },
    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
