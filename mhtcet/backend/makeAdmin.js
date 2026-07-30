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

const connectDB = async () => {
  const uri = process.env.MONGO_URI || "mongodb+srv://cet_databade:cet12345@cluster0.gj4ddxi.mongodb.net/cetDB?retryWrites=true&w=majority";
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    const directUri = "mongodb://cet_databade:cet12345@ac-qjmcang-shard-00-00.gj4ddxi.mongodb.net:27017,ac-qjmcang-shard-00-01.gj4ddxi.mongodb.net:27017,ac-qjmcang-shard-00-02.gj4ddxi.mongodb.net:27017/cetDB?ssl=true&replicaSet=atlas-3zcgzz-shard-0&authSource=admin&retryWrites=true&w=majority";
    await mongoose.connect(directUri, { serverSelectionTimeoutMS: 8000 });
  }
};

connectDB()
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
    console.error("Database connection error:", err.message);
    process.exit(1);
  });
