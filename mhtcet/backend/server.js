require("dotenv").config();


const bcrypt = require("bcrypt");
const User = require("./models/User");
const Consultation = require("./models/Consultation");

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const cors = require("cors");

const app = express();

// ---------- ADMIN MIDDLEWARE ----------
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const user = await User.findById(req.session.userId);

    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    next(); // ✅ allow access
  } catch (err) {
    console.error("ADMIN MIDDLEWARE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};


app.set("trust proxy", 1);
// ---------- MIDDLEWARE ----------
const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://aimlrahulcounselling.netlify.app"
];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (file://, mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all for now during development
  },
  credentials: true
}));

app.use(express.json());

app.use(session({
  name: "cet.sid",
  secret: "cet-secret-key",
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: true,       // ✅ REQUIRED for Netlify + Render
    sameSite: "none",   // ✅ REQUIRED for cross-site
    maxAge: 24 * 60 * 60 * 1000
  }
}));




// ---------- MONGODB CONNECTION ----------
mongoose.connect(process.env.MONGO_URI)

.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

// ---------- SIGNUP / REGISTER API ----------
const handleSignup = async (req, res) => {
  try {
    const { fullname, fullName, email, phone, cetRollNumber, category, password } = req.body;
    const nameToUse = fullname || fullName;

    // Check all fields
    if (!nameToUse || !email || !phone || !cetRollNumber || !category || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email is already registered. Please sign in."
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const newUser = await User.create({
      fullname: nameToUse.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      cetRollNumber: cetRollNumber.trim(),
      category,
      password: hashedPassword
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully! Please sign in.",
      user: {
        fullname: newUser.fullname,
        email: newUser.email
      }
    });

  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error during registration"
    });
  }
};

app.post("/api/signup", handleSignup);
app.post("/api/register", handleSignup);


// ---------- LOGIN API ----------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check fields
    if (!email || !password) {
      return res.json({
        success: false,
        message: "Email and password required"
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: false,
        message: "User not found"
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({
        success: false,
        message: "Invalid password"
      });
    }

    // Save session
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
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.json({
      success: false,
      message: "Server error"
    });
  }
});

// ---------- CHECK LOGIN STATUS ----------
app.get("/api/check-auth", (req, res) => {
  if (req.session.userId) {
    res.json({
      loggedIn: true
    });
  } else {
    res.json({
      loggedIn: false
    });
  }
});

// ---------- GET CURRENT USER ----------
app.get("/api/current-user", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ loggedIn: false });
    }

    const user = await User.findById(req.session.userId).select("fullname email phone cetRollNumber category createdAt");
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
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error("CURRENT USER ERROR:", err);
    res.json({ loggedIn: false });
  }
});

// ---------- LOGOUT ----------
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ---------- ADMIN AUTH CHECK ----------
app.get("/api/admin-check", async (req, res) => {
  try {
    // Not logged in
    if (!req.session.userId) {
      return res.json({ admin: false });
    }

    // Find user
    const user = await User.findById(req.session.userId);

    // Not admin
    if (!user || user.role !== "admin") {
      return res.json({ admin: false });
    }

    // Admin confirmed
    res.json({ admin: true });

  } catch (error) {
    console.error("ADMIN CHECK ERROR:", error);
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
    console.error("ADMIN USERS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// ---------- CONSULTATION REQUEST API ----------
app.post("/api/consultation", async (req, res) => {
  try {
    const { fullName, email, phone, percentile, subjectGroup, city, preferredDate, preferredTime, additionalInfo } = req.body;
    console.log("=== NEW CONSULTATION SUBMISSION RECEIVED ===");
    console.log("Name:", fullName);
    console.log("Email:", email);
    console.log("Phone:", phone);
    console.log("Percentile:", percentile);
    console.log("City:", city);
    console.log("==========================================");

    // Save permanently to MongoDB Database
    if (fullName && email) {
      await Consultation.create({
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: (phone || "").trim(),
        percentile: (percentile || "").toString(),
        subjectGroup: subjectGroup || "",
        city: city || "",
        preferredDate: preferredDate || "",
        preferredTime: preferredTime || "",
        additionalInfo: additionalInfo || ""
      });
      console.log("✅ Saved consultation lead to MongoDB!");
    }

    res.json({
      success: true,
      message: "Consultation request recorded successfully!"
    });
  } catch (error) {
    console.error("CONSULTATION SUBMIT ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------- ADMIN: GET ALL CONSULTATION LEADS ----------
app.get("/api/admin/consultations", requireAdmin, async (req, res) => {
  try {
    const consultations = await Consultation.find().sort({ createdAt: -1 });
    res.json({ success: true, consultations });
  } catch (error) {
    console.error("ADMIN CONSULTATIONS ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

