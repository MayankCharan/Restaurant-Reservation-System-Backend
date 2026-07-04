const Reservation = require("../models/Reservation");
const Table = require("../models/Table");
const {
  createReservationSchema,
  updateReservationSchema,
} = require("../utils/validation");

const hasTimeSlotEnded = (timeSlot) => {
  const now = new Date();

  const istNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );

  const currentTotalMinutes = istNow.getHours() * 60 + istNow.getMinutes();

  const [slotHour, slotMinute] = timeSlot.split(":").map(Number);

  const slotEndTotalMinutes = slotHour * 60 + slotMinute + 60;

  return currentTotalMinutes >= slotEndTotalMinutes;
};

const normalizeDate = (dateStr) => {
  const d = new Date(dateStr);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
};

const getToday = () => {
  const istNow = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    }),
  );

  return new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
};

const findAvailableTable = async (
  date,
  timeSlot,
  numberOfGuests,
  excludeReservationId = null,
) => {
  const suitableTables = await Table.find({
    isActive: true,
    capacity: { $gte: numberOfGuests },
  }).sort({ capacity: 1 });

  if (suitableTables.length === 0) return null;

  const tableIds = suitableTables.map((t) => t._id);
  const conflictQuery = {
    table: { $in: tableIds },
    date: normalizeDate(date),
    timeSlot,
    status: "confirmed",
  };

  if (excludeReservationId) {
    conflictQuery._id = { $ne: excludeReservationId };
  }

  const conflictingReservations =
    await Reservation.find(conflictQuery).select("table");
  const conflictingTableIds = new Set(
    conflictingReservations.map((r) => r.table.toString()),
  );
  return (
    suitableTables.find((t) => !conflictingTableIds.has(t._id.toString())) ||
    null
  );
};

const createReservation = async (req, res, next) => {
  try {
    const { error } = createReservationSchema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.isJoi = true;
      throw err;
    }

    const { date, timeSlot, numberOfGuests, notes } = req.body;
    const normalizedDate = normalizeDate(date);
    const today = getToday();

    if (normalizedDate < today) {
      return res
        .status(400)
        .json({ message: "Cannot make a reservation for a past date" });
    }

    if (
      normalizedDate.getTime() === today.getTime() &&
      hasTimeSlotEnded(timeSlot)
    ) {
      return res.status(400).json({
        message: "Cannot book a time slot that has already ended.",
      });
    }

    const availableTable = await findAvailableTable(
      date,
      timeSlot,
      numberOfGuests,
    );
    if (!availableTable) {
      return res.status(409).json({
        message:
          "No table available for the selected date, time, and party size. Please try a different time or reduce the number of guests.",
      });
    }

    const reservation = await Reservation.create({
      user: req.user._id,
      table: availableTable._id,
      date: normalizedDate,
      timeSlot,
      numberOfGuests,
      notes: notes || "",
    });

    await reservation.populate("user", "name email");
    await reservation.populate("table", "tableNumber capacity");
    res
      .status(201)
      .json({ message: "Reservation created successfully", data: reservation });
  } catch (error) {
    next(error);
  }
};

const getMyReservations = async (req, res, next) => {
  try {
    let reservations = await Reservation.find({ user: req.user._id })
      .populate("table", "tableNumber capacity")
      .sort({ date: 1, timeSlot: 1 });

    const today = getToday();

    const toUpdate = reservations.filter(
      (r) =>
        r.status === "confirmed" &&
        (r.date < today ||
          (r.date.getTime() === today.getTime() &&
            hasTimeSlotEnded(r.timeSlot))),
    );

    if (toUpdate.length > 0) {
      await Reservation.updateMany(
        { _id: { $in: toUpdate.map((r) => r._id) } },
        { $set: { status: "completed" } },
      );

      reservations = await Reservation.find({ user: req.user._id })
        .populate("table", "tableNumber capacity")
        .sort({ date: 1, timeSlot: 1 });
    }

    res.status(200).json({ data: reservations });
  } catch (error) {
    next(error);
  }
};

const cancelMyReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation)
      return res.status(404).json({ message: "Reservation not found" });
    if (reservation.user.toString() !== req.user._id.toString())
      return res
        .status(403)
        .json({ message: "You can only cancel your own reservations" });

    if (reservation.status === "completed") {
      return res
        .status(400)
        .json({ message: "Cannot cancel a completed reservation" });
    }
    if (reservation.status === "cancelled") {
      return res
        .status(400)
        .json({ message: "Reservation is already cancelled" });
    }

    const { reason } = req.body;
    reservation.status = "cancelled";
    if (reason && reason.trim()) {
      reservation.adminNote = `Cancelled by user: ${reason.trim()}`;
    }

    await reservation.save();
    await reservation.populate("table", "tableNumber capacity");
    res.status(200).json({
      message: "Reservation cancelled successfully",
      data: reservation,
    });
  } catch (error) {
    next(error);
  }
};

const updateMyReservation = async (req, res, next) => {
  try {
    const { error } = updateReservationSchema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.isJoi = true;
      throw err;
    }

    const reservation = await Reservation.findById(req.params.id);
    if (!reservation)
      return res.status(404).json({ message: "Reservation not found" });
    if (reservation.user.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized" });

    if (reservation.status === "completed") {
      return res
        .status(400)
        .json({ message: "Cannot edit a completed reservation" });
    }
    if (reservation.status === "cancelled") {
      return res
        .status(400)
        .json({ message: "Cannot edit a cancelled reservation" });
    }

    const { date, timeSlot, numberOfGuests, notes } = req.body;
    const dateChanged =
      date && new Date(date).getTime() !== reservation.date.getTime();
    const slotChanged = timeSlot && timeSlot !== reservation.timeSlot;
    const guestsChanged =
      numberOfGuests && numberOfGuests !== reservation.numberOfGuests;

    if (!dateChanged && !slotChanged && !guestsChanged) {
      if (notes !== undefined) reservation.notes = notes;
      await reservation.save();
      await reservation.populate("table", "tableNumber capacity");
      return res
        .status(200)
        .json({ message: "Reservation updated", data: reservation });
    }

    const finalDate = date ? normalizeDate(date) : reservation.date;
    const finalSlot = timeSlot || reservation.timeSlot;
    const finalGuests = numberOfGuests || reservation.numberOfGuests;

    const today = getToday();
    if (
      finalDate.getTime() === today.getTime() &&
      hasTimeSlotEnded(finalSlot)
    ) {
      return res.status(400).json({
        message: "Cannot change to a time slot that has already ended.",
      });
    }

    const availableTable = await findAvailableTable(
      finalDate,
      finalSlot,
      finalGuests,
      reservation._id,
    );
    if (!availableTable) {
      return res.status(409).json({
        message:
          "No table available for the updated date, time, and party size.",
      });
    }

    if (availableTable._id.toString() !== reservation.table.toString()) {
      const oldTable = await Table.findById(reservation.table);
      if (!reservation.previousTable) {
        reservation.previousTable = oldTable.tableNumber;
      }
      reservation.adminNote = `Updated by user: Schedule changed, table reassigned from #${oldTable.tableNumber} to #${availableTable.tableNumber}.`;
    }

    if (dateChanged) reservation.date = finalDate;
    if (slotChanged) reservation.timeSlot = finalSlot;
    if (guestsChanged) reservation.numberOfGuests = finalGuests;
    if (notes !== undefined) reservation.notes = notes;
    reservation.table = availableTable._id;
    reservation.pendingReactivation = false;
    reservation.reactivationNote = undefined;

    await reservation.save();
    await reservation.populate("table", "tableNumber capacity");
    res.status(200).json({ message: "Reservation updated", data: reservation });
  } catch (error) {
    next(error);
  }
};

const revertTable = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate(
      "table",
      "tableNumber capacity",
    );
    if (!reservation)
      return res.status(404).json({ message: "Reservation not found" });
    if (reservation.user.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized" });
    if (reservation.status === "cancelled")
      return res
        .status(400)
        .json({ message: "Cannot modify a cancelled reservation" });
    if (reservation.status === "completed")
      return res
        .status(400)
        .json({ message: "Cannot modify a completed reservation" });
    if (!reservation.previousTable)
      return res
        .status(400)
        .json({ message: "No previous table to revert to" });

    const originalTable = await Table.findOne({
      tableNumber: reservation.previousTable,
      isActive: true,
    });
    if (!originalTable)
      return res
        .status(400)
        .json({ message: "Original table is no longer available or active." });
    if (originalTable.capacity < reservation.numberOfGuests)
      return res.status(400).json({
        message: `Original table capacity (${originalTable.capacity}) is insufficient for ${reservation.numberOfGuests} guests.`,
      });

    const conflict = await Reservation.findOne({
      _id: { $ne: reservation._id },
      table: originalTable._id,
      date: reservation.date,
      timeSlot: reservation.timeSlot,
      status: "confirmed",
    });
    if (conflict)
      return res.status(409).json({
        message: "Your original table is already booked for your time slot.",
      });

    const oldTableNumber = reservation.table.tableNumber;
    reservation.table = originalTable._id;
    reservation.previousTable = undefined;
    reservation.pendingReactivation = false;
    reservation.reactivationNote = undefined;
    reservation.adminNote = `Reverted to original Table #${originalTable.tableNumber} by user (from Table #${oldTableNumber}).`;

    await reservation.save();
    await reservation.populate("table", "tableNumber capacity");
    res.status(200).json({
      message: "Successfully reverted to original table.",
      data: reservation,
    });
  } catch (error) {
    next(error);
  }
};

const getAllReservations = async (req, res, next) => {
  try {
    const { date, status } = req.query;
    const query = {};

    if (date) query.date = normalizeDate(date);

    if (status) {
      if (!["confirmed", "cancelled", "completed"].includes(status)) {
        return res.status(400).json({
          message: 'Status must be "confirmed", "cancelled", or "completed"',
        });
      }

      query.status = status;
    }

    let reservations = await Reservation.find(query)
      .populate("user", "name email")
      .populate("table", "tableNumber capacity")
      .sort({ date: -1, timeSlot: 1 });

    const today = getToday();

    const toUpdate = reservations.filter(
      (r) =>
        r.status === "confirmed" &&
        (r.date < today ||
          (r.date.getTime() === today.getTime() &&
            hasTimeSlotEnded(r.timeSlot))),
    );

    if (toUpdate.length > 0) {
      await Reservation.updateMany(
        { _id: { $in: toUpdate.map((r) => r._id) } },
        { $set: { status: "completed" } },
      );

      reservations = await Reservation.find(query)
        .populate("user", "name email")
        .populate("table", "tableNumber capacity")
        .sort({ date: -1, timeSlot: 1 });
    }

    res.status(200).json({ data: reservations });
  } catch (error) {
    next(error);
  }
};

const getReservationById = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate("user", "name email")
      .populate("table", "tableNumber capacity");
    if (!reservation)
      return res.status(404).json({ message: "Reservation not found" });
    res.status(200).json({ data: reservation });
  } catch (error) {
    next(error);
  }
};

const updateReservation = async (req, res, next) => {
  try {
    const { error } = updateReservationSchema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.isJoi = true;
      throw err;
    }

    const reservation = await Reservation.findById(req.params.id);
    if (!reservation)
      return res.status(404).json({ message: "Reservation not found" });
    const { date, timeSlot, numberOfGuests, table, notes, status, adminNote } =
      req.body;

    if (reservation.status === "completed") {
      return res
        .status(400)
        .json({ message: "Cannot modify a completed reservation." });
    }

    if (reservation.status === "cancelled" && status) {
      return res.status(400).json({
        message: "Cannot change the status of a cancelled reservation.",
      });
    }

    if (status === "cancelled" && reservation.status === "confirmed") {
      reservation.status = "cancelled";
      reservation.adminNote =
        adminNote && adminNote.trim()
          ? `Cancelled by admin: ${adminNote.trim()}`
          : "Cancelled by admin";
      await reservation.save();
      await reservation.populate("user", "name email");
      await reservation.populate("table", "tableNumber capacity");
      return res
        .status(200)
        .json({ message: "Reservation cancelled", data: reservation });
    }

    const dateChanged =
      date && new Date(date).getTime() !== reservation.date.getTime();
    const slotChanged = timeSlot && timeSlot !== reservation.timeSlot;
    const guestsChanged =
      numberOfGuests && numberOfGuests !== reservation.numberOfGuests;
    const tableChanged = table && table !== reservation.table.toString();

    if (!dateChanged && !slotChanged && !guestsChanged) {
      if (notes !== undefined) reservation.notes = notes;
      await reservation.save();
      await reservation.populate("user", "name email");
      await reservation.populate("table", "tableNumber capacity");
      return res
        .status(200)
        .json({ message: "Reservation updated", data: reservation });
    }

    const finalDate = date ? normalizeDate(date) : reservation.date;
    const finalSlot = timeSlot || reservation.timeSlot;
    const finalGuests = numberOfGuests || reservation.numberOfGuests;
    const targetTableId = table || reservation.table;

    if (table) {
      const targetTable = await Table.findById(table);
      if (!targetTable)
        return res.status(404).json({ message: "Specified table not found" });
      if (targetTable.capacity < finalGuests)
        return res.status(400).json({
          message: `Table ${targetTable.tableNumber} capacity insufficient.`,
        });
      const conflict = await Reservation.findOne({
        _id: { $ne: reservation._id },
        table: targetTableId,
        date: finalDate,
        timeSlot: finalSlot,
        status: { $in: ["confirmed", "completed"] },
      });
      if (conflict)
        return res.status(409).json({
          message: `Table ${targetTable.tableNumber} is already booked.`,
        });
      reservation.table = targetTableId;
    } else {
      const availableTable = await findAvailableTable(
        finalDate,
        finalSlot,
        finalGuests,
        reservation._id,
      );
      if (!availableTable)
        return res
          .status(409)
          .json({ message: "No table available for the updated schedule." });
      reservation.table = availableTable._id;
    }

    if (dateChanged) reservation.date = finalDate;
    if (slotChanged) reservation.timeSlot = finalSlot;
    if (guestsChanged) reservation.numberOfGuests = finalGuests;
    if (notes !== undefined) reservation.notes = notes;

    reservation.adminNote =
      adminNote && adminNote.trim()
        ? `Updated by admin: ${adminNote.trim()}`
        : "Updated by admin";
    reservation.previousTable = undefined;
    reservation.pendingReactivation = false;
    reservation.reactivationNote = undefined;

    await reservation.save();
    await reservation.populate("user", "name email");
    await reservation.populate("table", "tableNumber capacity");
    res.status(200).json({ message: "Reservation updated", data: reservation });
  } catch (error) {
    next(error);
  }
};

const deleteReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation)
      return res.status(404).json({ message: "Reservation not found" });
    await reservation.deleteOne();
    res.status(200).json({ message: "Reservation deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReservation,
  getMyReservations,
  cancelMyReservation,
  updateMyReservation,
  revertTable,
  getAllReservations,
  getReservationById,
  updateReservation,
  deleteReservation,
};
