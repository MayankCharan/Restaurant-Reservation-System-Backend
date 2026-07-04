const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: [true, "Table reference is required"],
    },
    date: {
      type: Date,
      required: [true, "Reservation date is required"],
    },
    timeSlot: {
      type: String,
      required: [true, "Time slot is required"],
      enum: {
        values: [
          "09:00",
          "10:00",
          "11:00",
          "12:00",
          "13:00",
          "14:00",
          "15:00",
          "16:00",
          "17:00",
          "18:00",
          "19:00",
          "20:00",
          "21:00",
        ],
        message: "Invalid time slot",
      },
    },
    numberOfGuests: {
      type: Number,
      required: [true, "Number of guests is required"],
      min: [1, "At least 1 guest required"],
      max: [20, "Cannot exceed 20 guests"],
    },
    status: {
      type: String,
      enum: ["confirmed", "cancelled", "completed"],
      default: "confirmed",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [200, "Notes cannot exceed 200 characters"],
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: [300, "Admin note cannot exceed 300 characters"],
    },
    previousTable: {
      type: Number,
    },
    pendingReactivation: {
      type: Boolean,
      default: false,
    },
    reactivationNote: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

reservationSchema.index(
  { table: 1, date: 1, timeSlot: 1, status: 1 },
  {
    partialFilterExpression: {
      status: { $in: ["confirmed", "cancelled", "completed"] },
    },
  },
);

module.exports = mongoose.model("Reservation", reservationSchema);
