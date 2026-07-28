require("dotenv").config();


const bcrypt = require("bcrypt");
const User = require("./models/User");

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
app.use(cors({
  origin: [
    "http://localhost:5500",
    "https://aimlrahulcounselling.netlify.app"
  ],
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

// ---------- SIGNUP API ----------
app.post("/api/signup", async (req, res) => {
  try {
    const { fullname, email, phone, cetRollNumber, category, password } = req.body;


    // Check all fields
    if (!fullname || !email || !phone || !cetRollNumber || !category || !password) {
      return res.json({
        success: false,
        message: "All fields are required"
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({
        success: false,
        message: "Email already registered"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    await User.create({
      fullname,
      email,
      phone,
      cetRollNumber,
      category,
      password: hashedPassword
    });

    res.json({
      success: true,
      message: "Account created successfully"
    });

  } catch (error) {
  console.error("SIGNUP ERROR:", error);
  res.json({
    success: false,
    message: error.message
  });
}

});

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
        email: user.email
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

    const user = await User.findById(req.session.userId).select("fullname email");
    if (!user) {
      return res.json({ loggedIn: false });
    }

    res.json({
      loggedIn: true,
      user: {
        fullname: user.fullname,
        email: user.email
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


// ---------- START SERVER ----------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

