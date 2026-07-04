const Table = require("../models/Table");
const Reservation = require("../models/Reservation");
const { createTableSchema, updateTableSchema } = require("../utils/validation");

const normalizeDate = (dateStr) => {
  const d = new Date(dateStr);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
};

const getToday = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

const getAllTables = async (req, res, next) => {
  try {
    const { active } = req.query;
    const query = {};
    if (active === "true") query.isActive = true;
    if (active === "false") query.isActive = false;
    const tables = await Table.find(query).sort({ tableNumber: 1 });
    res.status(200).json({ data: tables });
  } catch (error) {
    next(error);
  }
};

const getTableById = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: "Table not found" });
    res.status(200).json({ data: table });
  } catch (error) {
    next(error);
  }
};

const createTable = async (req, res, next) => {
  try {
    const { error } = createTableSchema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.isJoi = true;
      throw err;
    }
    const { tableNumber, capacity } = req.body;
    const existingTable = await Table.findOne({ tableNumber });
    if (existingTable)
      return res
        .status(409)
        .json({ message: `Table #${tableNumber} already exists` });
    const table = await Table.create({ tableNumber, capacity });
    res.status(201).json({ message: "Table created", data: table });
  } catch (error) {
    next(error);
  }
};

const updateTable = async (req, res, next) => {
  try {
    const { error } = updateTableSchema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.isJoi = true;
      throw err;
    }

    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: "Table not found" });

    const { tableNumber, capacity, isActive } = req.body;

    if (tableNumber && tableNumber !== table.tableNumber) {
      const duplicate = await Table.findOne({ tableNumber });
      if (duplicate)
        return res
          .status(409)
          .json({ message: `Table #${tableNumber} already exists` });
      table.tableNumber = tableNumber;
    }

    if (capacity !== undefined && capacity < table.capacity) {
      const today = getToday();
      const conflictingReservations = await Reservation.find({
        table: table._id,
        status: "confirmed",
        date: { $gte: today },
        numberOfGuests: { $gt: capacity },
      }).populate("user", "name");
      if (conflictingReservations.length > 0) {
        const details = conflictingReservations
          .map(
            (r) =>
              `- ${r.user?.name || "Unknown"}: ${r.numberOfGuests} guests on ${r.date.toISOString().split("T")[0]} at ${r.timeSlot}`,
          )
          .join("\n");
        return res.status(409).json({
          message: `Cannot reduce capacity to ${capacity}.\n${details}`,
        });
      }
      table.capacity = capacity;
    } else if (capacity !== undefined) {
      table.capacity = capacity;
    }

    if (isActive === false && table.isActive === true) {
      const today = getToday();
      const affectedReservations = await Reservation.find({
        table: table._id,
        status: "confirmed",
        date: { $gte: today },
      }).populate("table", "tableNumber");
      let relocatedCount = 0,
        cancelledCount = 0;

      for (const res of affectedReservations) {
        const oldTableNumber = res.table.tableNumber;
        const candidateTables = await Table.find({
          _id: { $ne: table._id },
          isActive: true,
          capacity: { $gte: res.numberOfGuests },
        }).sort({ capacity: 1 });
        let relocated = false;

        for (const candidate of candidateTables) {
          const conflict = await Reservation.findOne({
            _id: { $ne: res._id },
            table: candidate._id,
            date: res.date,
            timeSlot: res.timeSlot,
            status: "confirmed",
          });
          if (!conflict) {
            res.table = candidate._id;
            res.previousTable = oldTableNumber;
            res.adminNote = `Table #${oldTableNumber} was deactivated by the restaurant. Your reservation has been moved to Table #${candidate.tableNumber}.`;
            await res.save();
            relocatedCount++;
            relocated = true;
            break;
          }
        }
        if (!relocated) {
          res.status = "cancelled";
          res.adminNote = `Table #${oldTableNumber} was deactivated by the restaurant and no alternative table was available for your party size and time.`;
          await res.save();
          cancelledCount++;
        }
      }
      table.isActive = false;
      await table.save();
      let msg = "Table deactivated.";
      if (relocatedCount > 0 || cancelledCount > 0)
        msg = `Table deactivated. ${relocatedCount} relocated. ${cancelledCount} cancelled (no alternative).`;
      return res.status(200).json({ message: msg, data: table });
    }

    if (isActive === true && table.isActive === false) {
      const affectedReservations = await Reservation.find({
        previousTable: table.tableNumber,
        status: "confirmed",
      }).populate("table", "tableNumber");
      let notifiedCount = 0;

      for (const res of affectedReservations) {
        const conflict = await Reservation.findOne({
          _id: { $ne: res._id },
          table: table._id,
          date: res.date,
          timeSlot: res.timeSlot,
          status: "confirmed",
        });
        if (!conflict) {
          res.pendingReactivation = true;
          res.reactivationNote = `Your original Table #${table.tableNumber} is now available again for your time slot! You can revert back to it if you'd like.`;
        } else {
          res.pendingReactivation = false;
          res.reactivationNote = `Table #${table.tableNumber} is active again, but it is already booked for your time slot. You will remain on Table #${res.table.tableNumber}.`;
        }
        await res.save();
        notifiedCount++;
      }
      table.isActive = true;
      await table.save();
      let msg = "Table activated.";
      if (notifiedCount > 0)
        msg = `Table activated. ${notifiedCount} relocated customer(s) notified about their original table.`;
      return res.status(200).json({ message: msg, data: table });
    }

    if (isActive !== undefined) table.isActive = isActive;
    await table.save();
    res.status(200).json({ message: "Table updated", data: table });
  } catch (error) {
    next(error);
  }
};

const deleteTable = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: "Table not found" });
    const activeReservations = await Reservation.countDocuments({
      table: table._id,
      status: "confirmed",
      date: { $gte: new Date() },
    });
    if (activeReservations > 0)
      return res.status(409).json({
        message: `Cannot delete table #${table.tableNumber}: it has ${activeReservations} active reservation(s).`,
      });
    await table.deleteOne();
    res.status(200).json({ message: "Table deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable,
};
