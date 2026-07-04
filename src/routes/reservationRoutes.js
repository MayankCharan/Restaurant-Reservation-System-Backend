const express = require("express");
const router = express.Router();
const {
  createReservation,
  getMyReservations,
  cancelMyReservation,
  updateMyReservation,
  revertTable,
  getAllReservations,
  getReservationById,
  updateReservation,
  deleteReservation,
} = require("../controllers/reservationController");
const protect = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

router.post("/", protect, roleCheck("customer"), createReservation);
router.get("/my", protect, roleCheck("customer"), getMyReservations);
router.patch(
  "/my/:id/cancel",
  protect,
  roleCheck("customer"),
  cancelMyReservation,
);
router.patch("/my/:id", protect, roleCheck("customer"), updateMyReservation);
router.patch(
  "/my/:id/revert-table",
  protect,
  roleCheck("customer"),
  revertTable,
);

router.get("/", protect, roleCheck("admin"), getAllReservations);
router.get("/:id", protect, roleCheck("admin"), getReservationById);
router.patch("/:id", protect, roleCheck("admin"), updateReservation);
router.delete("/:id", protect, roleCheck("admin"), deleteReservation);

module.exports = router;
