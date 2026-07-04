const express = require("express");
const router = express.Router();
const {
  getAllTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable,
} = require("../controllers/tableController");
const protect = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

router.get("/", protect, roleCheck("admin"), getAllTables);
router.get("/:id", protect, roleCheck("admin"), getTableById);
router.post("/", protect, roleCheck("admin"), createTable);
router.patch("/:id", protect, roleCheck("admin"), updateTable);
router.delete("/:id", protect, roleCheck("admin"), deleteTable);

module.exports = router;
