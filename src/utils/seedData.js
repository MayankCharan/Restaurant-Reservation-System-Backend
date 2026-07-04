const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config({
  path: require("path").join(__dirname, "..", "..", ".env"),
});

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Table = require("../models/Table");
const User = require("../models/User");

const TABLES = [
  { tableNumber: 1, capacity: 2 },
  { tableNumber: 2, capacity: 2 },
  { tableNumber: 3, capacity: 4 },
  { tableNumber: 4, capacity: 4 },
  { tableNumber: 5, capacity: 6 },
  { tableNumber: 6, capacity: 6 },
  { tableNumber: 7, capacity: 8 },
  { tableNumber: 8, capacity: 8 },
  { tableNumber: 9, capacity: 10 },
  { tableNumber: 10, capacity: 10 },
];

const seed = async () => {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected.\n");

    console.log("Seeding tables...");
    let tablesCreated = 0;
    for (const tableData of TABLES) {
      const existing = await Table.findOne({
        tableNumber: tableData.tableNumber,
      });
      if (!existing) {
        await Table.create(tableData);
        tablesCreated++;
        console.log(
          `Created Table #${tableData.tableNumber} (capacity: ${tableData.capacity})`,
        );
      } else {
        console.log(`Table #${tableData.tableNumber} already exists — skipped`);
      }
    }
    console.log(
      `Tables: ${tablesCreated} created, ${TABLES.length - tablesCreated} skipped.\n`,
    );

    console.log("Seeding admin user...");
    const existingAdmin = await User.findOne({
      email: process.env.ADMIN_EMAIL,
    });
    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(
        process.env.ADMIN_PASSWORD,
        salt,
      );
      await User.create({
        name: process.env.ADMIN_NAME,
        email: process.env.ADMIN_EMAIL,
        password: hashedPassword,
        role: "admin",
      });
      console.log(
        `Admin created: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`,
      );
    } else {
      console.log(
        `Admin user (${process.env.ADMIN_EMAIL}) already exists — skipped`,
      );
    }

    console.log("\nSeeding complete.");
  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Database connection closed.");
    process.exit(0);
  }
};

seed();
