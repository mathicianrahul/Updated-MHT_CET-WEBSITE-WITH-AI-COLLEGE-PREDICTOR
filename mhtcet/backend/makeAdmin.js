require("dotenv").config();
try { require("dns").setServers(["8.8.8.8", "1.1.1.1"]); } catch (e) {}
const mongoose = require("mongoose");
const User = require("./models/User");

const targetEmail = process.argv[2];

if (!targetEmail) {
  console.log("❌ Please provide an email address.");
  console.log("Usage: node makeAdmin.js <user_email>");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/cet_predictor")
  .then(async () => {
    const user = await User.findOneAndUpdate(
      { email: targetEmail.toLowerCase().trim() },
      { role: "admin" },
      { new: true }
    );

    if (user) {
      console.log(`\n==========================================`);
      console.log(`✅ SUCCESS: User promoted to Admin!`);
      console.log(`Name:  ${user.fullname}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role:  ${user.role}`);
      console.log(`==========================================\n`);
    } else {
      console.log(`\n❌ User with email "${targetEmail}" was not found in database.\n`);
    }
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("Database connection error:", err);
    process.exit(1);
  });
