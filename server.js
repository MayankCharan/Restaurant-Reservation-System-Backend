const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const dotenv = require("dotenv");
const app = require("./app");
const connectDB = require("./src/config/db");

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startserver() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log("Server is running");
    });
  } catch (error) {
    console.log(error.message);
  }
}

startserver();
