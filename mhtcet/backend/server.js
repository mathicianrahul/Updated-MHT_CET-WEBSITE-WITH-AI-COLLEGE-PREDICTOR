const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
try { require("dns").setServers(["8.8.8.8", "1.1.1.1"]); } catch (e) {}

const bcrypt = require("bcrypt");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const validator = require("validator");
const { MongoStore } = require("connect-mongo");
const User = require("./models/User");
const Consultation = require("./models/Consultation");

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const cors = require("cors");

const app = express();

// ---------- HELMET SECURITY HEADERS ----------
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ---------- REQUEST BODY SIZE LIMITS (10KB) ----------
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ---------- NOSQL INJECTION SANITIZATION ----------
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    mongoSanitize.sanitize(req.body, { replaceWith: "_" });
  }
  if (req.params && typeof req.params === "object") {
    mongoSanitize.sanitize(req.params, { replaceWith: "_" });
  }
  next();
});

// ---------- RATE LIMITERS ----------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { success: false, message: "Too many login attempts from this IP. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: "Too many accounts created from this IP. Please try again after an hour." },
  standardHeaders: true,
  legacyHeaders: false
});

const consultationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { success: false, message: "Too many consultation requests from this IP. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { success: false, message: "Too many requests. Please try again shortly." },
  standardHeaders: true,
  legacyHeaders: false
});

// ---------- SANITIZATION & VALIDATION HELPERS ----------
const cleanString = (val) => {
  if (typeof val !== "string") return "";
  return validator.trim(val);
};

// ---------- ADMIN AUTHENTICATION & AUTHORIZATION MIDDLEWARE ----------
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Valid authentication session required."
      });
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User session invalid or expired."
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Insufficient privileges. Admin role required."
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("ADMIN MIDDLEWARE ERROR:", err.message);
    res.status(500).json({ success: false, message: "Internal server error during authorization check." });
  }
};

app.set("trust proxy", 1);

// ---------- CORS CONFIGURATION ----------
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:8080",
      "https://aimlrahulcounselling.netlify.app"
    ];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (file:// protocol sends null, same-origin, server-to-server)
    if (!origin || origin === "null") return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

// ---------- SESSION SECURITY (MONGOSTORE) ----------
// ---------- GLOBAL PROCESS CRASH PROTECTION ----------
process.on("unhandledRejection", (reason) => {
  console.warn("Handled Background Rejection:", reason?.message || reason);
});
process.on("uncaughtException", (err) => {
  console.warn("Handled Background Exception:", err?.message || err);
});

// ---------- SESSION SECURITY ----------
const isProduction = process.env.NODE_ENV === "production";
let sessionStore;
try {
  sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "sessions",
    ttl: 24 * 60 * 60,
    mongoOptions: { serverSelectionTimeoutMS: 5000 }
  });
} catch(e) {
  console.warn("MongoStore fallback initialized.");
}

app.use(session({
  name: "cet.sid",
  secret: process.env.SESSION_SECRET || "fallback-secret-key-change-in-env",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: sessionStore,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ---------- MOUNT ADMIN PROTECTION MIDDLEWARE ----------
app.use("/api/admin", requireAdmin);

// ---------- MONGODB CONNECTION ----------
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("[+] MongoDB connected successfully");
  } catch (err) {
    console.warn("Primary MongoDB connection attempt notice:", err.message);
    if (process.env.MONGO_URI && process.env.MONGO_URI.startsWith("mongodb+srv://")) {
      console.log("Attempting direct seedlist fallback connection...");
      const directUri = "mongodb://cet_databade:cet12345@ac-qjmcang-shard-00-00.gj4ddxi.mongodb.net:27017,ac-qjmcang-shard-00-01.gj4ddxi.mongodb.net:27017,ac-qjmcang-shard-00-02.gj4ddxi.mongodb.net:27017/cetDB?ssl=true&replicaSet=atlas-3zcgzz-shard-0&authSource=admin&retryWrites=true&w=majority";
      try {
        await mongoose.connect(directUri, { serverSelectionTimeoutMS: 7000 });
        console.log("[+] MongoDB connected successfully via direct seedlist fallback!");
      } catch (fallbackErr) {
        console.error("Direct fallback connection error:", fallbackErr.message);
      }
    }
  }
};
connectDB();

// ---------- SIGNUP / REGISTER API ----------
const handleSignup = async (req, res) => {
  try {
    let { fullname, fullName, email, phone, cetRollNumber, percentile, category, password } = req.body;
    let nameToUse = cleanString(fullname || fullName);
    email = cleanString(email);
    phone = cleanString(phone);
    cetRollNumber = cleanString(cetRollNumber);
    category = cleanString(category);
    password = typeof password === "string" ? password : "";

    // Check all required fields
    if (!nameToUse || !email || !phone || !cetRollNumber || !category || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required and cannot be empty."
      });
    }

    if (nameToUse.length < 2 || nameToUse.length > 100) {
      return res.status(400).json({ success: false, message: "Full name must be between 2 and 100 characters." });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }
    const normalizedEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();

    if (!/^[0-9+\-\s()]{7,15}$/.test(phone)) {
      return res.status(400).json({ success: false, message: "Please provide a valid phone number (7-15 digits)." });
    }

    if (cetRollNumber.length < 3 || cetRollNumber.length > 50) {
      return res.status(400).json({ success: false, message: "Invalid CET Application / Roll Number." });
    }

    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ success: false, message: "Password must be between 6 and 128 characters." });
    }

    let parsedPercentile = null;
    if (percentile !== undefined && percentile !== null && percentile !== "") {
      parsedPercentile = Number(percentile);
      if (isNaN(parsedPercentile) || parsedPercentile < 0 || parsedPercentile > 100) {
        return res.status(400).json({ success: false, message: "Percentile must be a number between 0 and 100." });
      }
    }

    // Check existing user
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email is already registered. Please sign in."
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user - Store validated and trimmed original values (Default role: "student")
    const newUser = await User.create({
      fullname: nameToUse,
      email: normalizedEmail,
      phone: phone,
      cetRollNumber: cetRollNumber,
      category: category || "OPEN",
      percentile: parsedPercentile,
      password: hashedPassword,
      role: "student"
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully! Please sign in.",
      user: {
        fullname: newUser.fullname,
        email: newUser.email,
        phone: newUser.phone,
        cetRollNumber: newUser.cetRollNumber,
        category: newUser.category,
        percentile: newUser.percentile,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    });

  } catch (error) {
    console.error("SIGNUP ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error during registration"
    });
  }
};

app.post("/api/signup", signupLimiter, handleSignup);
app.post("/api/register", signupLimiter, handleSignup);

// ---------- LOGIN API ----------
app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    let { email, password } = req.body;
    email = cleanString(email);
    password = typeof password === "string" ? password : "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const normalizedEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Anti-user enumeration response
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    req.session.userId = user._id;

    res.json({
      success: true,
      message: "Login successful",
      user: {
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        cetRollNumber: user.cetRollNumber,
        category: user.category,
        percentile: user.percentile,
        role: user.role,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error during authentication"
    });
  }
});

// ---------- CHECK LOGIN STATUS ----------
app.get("/api/check-auth", (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      loggedIn: true
    });
  } else {
    res.json({
      loggedIn: false
    });
  }
});

// ---------- GET CURRENT USER / PROFILE ----------
app.get("/api/current-user", profileLimiter, async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({ loggedIn: false });
    }

    const user = await User.findById(req.session.userId).select("fullname email phone cetRollNumber category percentile role createdAt");
    if (!user) {
      return res.json({ loggedIn: false });
    }

    res.json({
      loggedIn: true,
      user: {
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        cetRollNumber: user.cetRollNumber,
        category: user.category,
        percentile: user.percentile,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error("CURRENT USER ERROR:", err.message);
    res.json({ loggedIn: false });
  }
});

// ---------- LOGOUT ----------
app.post("/api/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      res.clearCookie("cet.sid");
      res.json({ success: true });
    });
  } else {
    res.json({ success: true });
  }
});

// ---------- ADMIN AUTH CHECK ----------
app.get("/api/admin-check", profileLimiter, async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({ admin: false });
    }

    const user = await User.findById(req.session.userId);

    if (!user || user.role !== "admin") {
      return res.json({ admin: false });
    }

    res.json({ admin: true });
  } catch (error) {
    console.error("ADMIN CHECK ERROR:", error.message);
    res.json({ admin: false });
  }
});

// ---------- ADMIN: GET ALL USERS ----------
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error("ADMIN USERS ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ---------- CONSULTATION REQUEST API ----------
app.post("/api/consultation", consultationLimiter, async (req, res) => {
  try {
    let { fullName, email, phone, percentile, subjectGroup, city, preferredDate, preferredTime, additionalInfo } = req.body;

    fullName = cleanString(fullName);
    email = cleanString(email);
    phone = cleanString(phone);

    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: "Full Name and Email are required."
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    const normalizedEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();

    await Consultation.create({
      fullName: fullName,
      email: normalizedEmail,
      phone: phone,
      percentile: cleanString(percentile),
      subjectGroup: cleanString(subjectGroup),
      city: cleanString(city),
      preferredDate: cleanString(preferredDate),
      preferredTime: cleanString(preferredTime),
      additionalInfo: cleanString(additionalInfo)
    });

    console.log("Consultation lead recorded successfully.");

    res.json({
      success: true,
      message: "Consultation request recorded successfully!"
    });
  } catch (error) {
    console.error("CONSULTATION SUBMIT ERROR:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------- ADMIN: GET ALL CONSULTATION LEADS ----------
app.get("/api/admin/consultations", requireAdmin, async (req, res) => {
  try {
    const consultations = await Consultation.find().sort({ createdAt: -1 });
    res.json({ success: true, consultations });
  } catch (error) {
    console.error("ADMIN CONSULTATIONS ERROR:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// ---------- SERVE FRONTEND STATIC FILES ----------
// Serve frontend from the same origin to avoid CORS/cookie issues with file:// protocol
const frontendDir = path.join(__dirname, "..", "..", "frontend");
const publicDir = path.join(__dirname, "..", "public");

// Prefer the main frontend/ directory, fall back to mhtcet/public/
if (require("fs").existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  console.log("[+] Serving frontend from:", frontendDir);
} else if (require("fs").existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log("[+] Serving frontend from:", publicDir);
}

// ---------- START SERVER ----------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend available at: http://localhost:${PORT}`);
});
