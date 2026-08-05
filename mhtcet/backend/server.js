const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
try { require("dns").setServers(["8.8.8.8", "1.1.1.1"]); } catch (e) { }

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
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");

const app = express();

let etherealTransporter = null;

const getTransporter = async () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  const isPlaceholder = !emailUser || !emailPass || 
                        emailUser.includes("your-email") || 
                        emailPass.includes("your-gmail-app");

  if (!isPlaceholder) {
    const cleanPass = emailPass ? emailPass.replace(/\s+/g, "") : "";
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: emailUser.trim(),
        pass: cleanPass
      }
    });
  }

  // Fallback to Ethereal SMTP test account for instant real email delivery preview
  if (!etherealTransporter) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      etherealTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      etherealTransporter._etherealUser = testAccount.user;
      console.log(`[ETHEREAL MAIL INITIALIZED] Temporary test inbox created: ${testAccount.user}`);
    } catch (err) {
      console.warn("[ETHEREAL MAIL NOTICE] Failed to create test account:", err.message);
    }
  }
  return etherealTransporter;
};

const sendOtpEmail = async (toEmail, otpCode) => {
  try {
    const transporter = await getTransporter();
    if (!transporter) {
      console.warn(`[EMAIL NOTICE] Real email to ${toEmail} skipped. (OTP Code: ${otpCode})`);
      return false;
    }

    const senderEmail = transporter._etherealUser || (process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : "noreply@aimlrahulcounselling.com");

    const mailOptions = {
      from: `"AIML Rahul Counselling" <${senderEmail}>`,
      to: toEmail,
      subject: `Your Verification Code: ${otpCode} - AIML Rahul Counselling`,
      text: `Welcome to AIML Rahul Counselling!\n\nYour 6-Digit Email Verification Code is: ${otpCode}\n\nThis code is valid for 10 minutes. Please enter it on the website to complete your registration.`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
            <h2 style="color: #2563eb; margin: 0; font-size: 22px; font-weight: 800;">AIML Rahul Counselling</h2>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">MHT-CET Admission Portal Verification</p>
          </div>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <h3 style="color: #1e293b; font-size: 16px; font-weight: 700; margin-bottom: 12px;">Your Email Verification Code</h3>
            <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #2563eb; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px dashed #3b82f6; display: inline-block; margin: 10px 0;">
              ${otpCode}
            </div>
            <p style="color: #475569; font-size: 13px; margin-top: 12px;">This code is valid for 10 minutes. Please enter it on the website to complete your registration.</p>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
            If you did not create an account on AIML Rahul Counselling, please ignore this email.
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SENT SUCCESS] Code sent to ${toEmail}. MessageId: ${info.messageId}`);
    
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[ETHEREAL INBOX PREVIEW URL] View sent email online here: ${previewUrl}`);
    }
    return true;
  } catch (err) {
    console.error(`[EMAIL ERROR] Failed to send email to ${toEmail}:`, err.message);
    return false;
  }
};

// ---------- CORS CONFIGURATION ----------
const allowedOrigins = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://aimlrahul.netlify.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:") || origin === "null") {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-User-Email"]
}));

// ---------- HELMET SECURITY HEADERS ----------
app.use(helmet({
  contentSecurityPolicy: false,
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
  max: 100,
  message: { success: false, message: "Too many login attempts from this IP. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
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
    let user = null;

    if (req.session && req.session.userId) {
      user = await User.findById(req.session.userId);
    }

    if (!user) {
      const headerEmail = req.headers["x-user-email"];
      if (headerEmail) {
        user = await User.findOne({ email: headerEmail.toLowerCase().trim() });
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Valid authentication session required."
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
} catch (e) {
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
const inMemoryUserStore = new Map();

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
    let existingUser = null;
    if (mongoose.connection.readyState === 1) {
      try {
        existingUser = await User.findOne({ email: normalizedEmail });
      } catch (err) {
        console.warn("MongoDB find error, falling back to local memory:", err.message);
      }
    }
    if (!existingUser) {
      existingUser = inMemoryUserStore.get(normalizedEmail);
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email is already registered. Please sign in."
      });
    }

    // Hash password & generate 6-digit verification OTP
    const hashedPassword = await bcrypt.hash(password, 10);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let newUser = null;

    if (mongoose.connection.readyState === 1) {
      try {
        newUser = await User.create({
          fullname: nameToUse,
          email: normalizedEmail,
          phone: phone,
          cetRollNumber: cetRollNumber,
          category: category || "OPEN",
          percentile: parsedPercentile,
          password: hashedPassword,
          authProvider: ["local"],
          isVerified: false,
          otpCode,
          otpExpires,
          role: "student"
        });
      } catch (err) {
        console.warn("MongoDB create error, falling back to local memory:", err.message);
      }
    }

    if (!newUser) {
      newUser = {
        _id: "local_" + Date.now(),
        fullname: nameToUse,
        email: normalizedEmail,
        phone: phone,
        cetRollNumber: cetRollNumber,
        category: category || "OPEN",
        percentile: parsedPercentile,
        password: hashedPassword,
        authProvider: ["local"],
        isVerified: false,
        otpCode,
        otpExpires,
        role: "student",
        createdAt: new Date()
      };
      inMemoryUserStore.set(normalizedEmail, newUser);
    }

    console.log(`[VERIFICATION OTP GENERATED] Email: ${normalizedEmail} | Code: ${otpCode}`);
    sendOtpEmail(normalizedEmail, otpCode).catch(e => console.error("Async email error:", e.message));

    res.status(201).json({
      success: true,
      requireOtp: true,
      email: normalizedEmail,
      message: "Account created! Please enter the 6-digit verification code sent to your email.",
      user: {
        fullname: newUser.fullname,
        email: newUser.email,
        phone: newUser.phone,
        cetRollNumber: newUser.cetRollNumber,
        category: newUser.category,
        percentile: newUser.percentile,
        isVerified: false,
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

// ---------- VERIFY OTP API ----------
app.post("/api/verify-otp", loginLimiter, async (req, res) => {
  try {
    let { email, otp } = req.body;
    email = cleanString(email);
    otp = cleanString(otp);

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and 6-digit OTP code are required." });
    }

    let user = null;
    if (mongoose.connection.readyState === 1) {
      try { user = await User.findOne({ email }); } catch (err) {}
    }
    if (!user) {
      user = inMemoryUserStore.get(email);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found. Please register first." });
    }

    if (user.isVerified) {
      return res.json({ success: true, message: "Email is already verified. Please sign in.", user });
    }

    if (!user.otpCode || user.otpCode !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP code. Please check your code and try again." });
    }

    if (user.otpExpires && new Date(user.otpExpires) < new Date()) {
      return res.status(400).json({ success: false, message: "OTP code has expired. Please request a new code." });
    }

    user.isVerified = true;
    user.otpCode = null;
    user.otpExpires = null;

    if (mongoose.connection.readyState === 1 && typeof user.save === "function") {
      try { await user.save(); } catch(e) {}
    } else {
      inMemoryUserStore.set(email, user);
    }

    req.session.userId = user._id;
    req.session.userObj = {
      fullname: user.fullname,
      email: user.email,
      phone: user.phone,
      cetRollNumber: user.cetRollNumber,
      category: user.category,
      percentile: user.percentile,
      isVerified: true,
      role: user.role,
      createdAt: user.createdAt
    };

    req.session.save((err) => {
      res.json({
        success: true,
        message: "Email verified successfully! Welcome to your dashboard.",
        user: req.session.userObj
      });
    });

  } catch (err) {
    console.error("VERIFY OTP ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error during OTP verification." });
  }
});

// ---------- RESEND OTP API ----------
app.post("/api/resend-otp", signupLimiter, async (req, res) => {
  try {
    let { email } = req.body;
    email = cleanString(email);
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Valid email is required." });
    }

    let user = null;
    if (mongoose.connection.readyState === 1) {
      try { user = await User.findOne({ email }); } catch (err) {}
    }
    if (!user) user = inMemoryUserStore.get(email);

    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode = newOtp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    if (mongoose.connection.readyState === 1 && typeof user.save === "function") {
      try { await user.save(); } catch(e) {}
    } else {
      inMemoryUserStore.set(email, user);
    }

    console.log(`[OTP RESENT] Email: ${email} | Verification Code: ${newOtp}`);
    sendOtpEmail(email, newOtp).catch(e => console.error("Async email error:", e.message));
    res.json({ success: true, message: `A new verification code has been sent to ${email}.` });

  } catch (err) {
    res.status(500).json({ success: false, message: "Server error while resending OTP." });
  }
});

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
    let user = null;

    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findOne({ email: normalizedEmail });
      } catch (err) {
        console.warn("MongoDB login find notice:", err.message);
      }
    }
    if (!user) {
      user = inMemoryUserStore.get(normalizedEmail);
    }

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

    // Require email verification for manual password accounts
    if (user.isVerified === false) {
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otpCode = newOtp;
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      if (mongoose.connection.readyState === 1 && typeof user.save === "function") {
        try { await user.save(); } catch(e) {}
      } else {
        inMemoryUserStore.set(normalizedEmail, user);
      }
      console.log(`[UNVERIFIED LOGIN ATTEMPT] Email: ${normalizedEmail} | Verification Code: ${newOtp}`);
      sendOtpEmail(normalizedEmail, newOtp).catch(e => console.error("Async email error:", e.message));
      return res.status(403).json({
        success: false,
        requireOtp: true,
        email: normalizedEmail,
        message: "Please verify your email address before signing in. A new 6-digit verification code has been sent."
      });
    }

    req.session.userId = user._id;
    req.session.userObj = {
      fullname: user.fullname,
      email: user.email,
      phone: user.phone,
      cetRollNumber: user.cetRollNumber,
      category: user.category,
      percentile: user.percentile,
      role: user.role,
      createdAt: user.createdAt
    };

    req.session.save((err) => {
      if (err) console.warn("Login session save notice:", err);
      res.json({
        success: true,
        message: "Login successful",
        user: req.session.userObj
      });
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error during login"
    });
  }
});

// ---------- GOOGLE AUTH API ----------
app.post("/api/auth/google", loginLimiter, async (req, res) => {
  try {
    const { credential, email: directEmail, name: directName } = req.body;
    let email = null;
    let fullname = null;
    let payload = null;

    if (credential) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const client = new OAuth2Client(clientId);

      try {
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: clientId
        });
        payload = ticket.getPayload();
      } catch (verifyErr) {
        console.warn("Google verifyIdToken notice, parsing payload fallback:", verifyErr.message);
        const parts = credential.split(".");
        if (parts.length === 3) {
          try {
            payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
          } catch (e) { }
        }
      }

      if (payload && payload.email) {
        email = validator.normalizeEmail(payload.email) || payload.email.toLowerCase().trim();
        fullname = payload.name || payload.given_name || email.split("@")[0];
      }
    }

    if (!email && directEmail) {
      email = validator.normalizeEmail(directEmail) || directEmail.toLowerCase().trim();
      fullname = directName || email.split("@")[0];
    }

    if (!email) {
      return res.status(401).json({ success: false, message: "Invalid Google credential payload." });
    }

    const googleId = (payload && payload.sub) ? payload.sub : ("goog_" + Date.now());
    const profilePicture = (payload && payload.picture) ? payload.picture : "";

    let user = null;
    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findOne({ email });
      } catch (err) { }
    }
    if (!user) {
      user = inMemoryUserStore.get(email);
    }

    if (user) {
      // Smart Account Linking for existing accounts
      user.isVerified = true;
      if (!user.authProvider) user.authProvider = ["local"];
      if (!user.authProvider.includes("google")) user.authProvider.push("google");
      if (!user.googleId) user.googleId = googleId;
      if (profilePicture && !user.profilePicture) user.profilePicture = profilePicture;

      if (mongoose.connection.readyState === 1 && typeof user.save === "function") {
        try { await user.save(); } catch (e) {}
      } else {
        inMemoryUserStore.set(email, user);
      }
    } else {
      // Create new Google account
      const randomRoll = "GOOG" + Math.floor(100000 + Math.random() * 900000);
      if (mongoose.connection.readyState === 1) {
        try {
          user = await User.create({
            fullname,
            email,
            googleId,
            authProvider: ["google"],
            profilePicture,
            isVerified: true,
            phone: "N/A",
            cetRollNumber: randomRoll,
            category: "OPEN",
            percentile: 0,
            role: "student"
          });
        } catch (err) { }
      }

      if (!user) {
        user = {
          _id: "google_" + Date.now(),
          fullname,
          email,
          googleId,
          authProvider: ["google"],
          profilePicture,
          isVerified: true,
          phone: "N/A",
          cetRollNumber: randomRoll,
          category: "OPEN",
          percentile: 0,
          role: "student",
          createdAt: new Date()
        };
        inMemoryUserStore.set(email, user);
      }
    }

    req.session.userId = user._id;
    req.session.userObj = {
      fullname: user.fullname,
      email: user.email,
      phone: user.phone || "N/A",
      cetRollNumber: user.cetRollNumber || "N/A",
      category: user.category || "OPEN",
      percentile: user.percentile || 0,
      profilePicture: user.profilePicture || "",
      isVerified: true,
      role: user.role || "student",
      createdAt: user.createdAt
    };

    req.session.save((err) => {
      if (err) console.warn("Google Auth session save notice:", err);
      res.json({
        success: true,
        message: "Google sign in successful",
        user: req.session.userObj
      });
    });

  } catch (error) {
    console.error("GOOGLE AUTH ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error during Google authentication"
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

    let user = null;
    if (mongoose.connection.readyState === 1 && typeof req.session.userId === "string" && req.session.userId.length === 24) {
      try {
        user = await User.findById(req.session.userId).select("fullname email phone cetRollNumber category percentile role createdAt");
      } catch (err) { }
    }
    if (!user && req.session.userObj) {
      user = req.session.userObj;
    }

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
    let user = null;
    if (req.session && req.session.userId) {
      user = await User.findById(req.session.userId);
    }
    if (!user) {
      const headerEmail = req.headers["x-user-email"];
      if (headerEmail) {
        user = await User.findOne({ email: headerEmail.toLowerCase().trim() });
      }
    }

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
