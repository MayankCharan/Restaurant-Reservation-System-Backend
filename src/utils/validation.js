const Joi = require("joi");

const registerSchema = Joi.object({
  name: Joi.string().trim().max(50).required().messages({
    "string.empty": "Name is required",
    "string.max": "Name cannot exceed 50 characters",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email",
    "string.empty": "Email is required",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters",
    "string.empty": "Password is required",
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email",
    "string.empty": "Email is required",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
  }),
});

const createReservationSchema = Joi.object({
  date: Joi.date().required().messages({
    "date.base": "Please provide a valid date",
    "any.required": "Reservation date is required",
  }),
  timeSlot: Joi.string()
    .valid(
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
    )
    .required()
    .messages({
      "any.only": "Invalid time slot selected",
      "any.required": "Time slot is required",
    }),
  numberOfGuests: Joi.number().integer().min(1).max(20).required().messages({
    "number.min": "At least 1 guest is required",
    "number.max": "Cannot exceed 20 guests",
    "number.base": "Number of guests must be a number",
    "any.required": "Number of guests is required",
  }),
  notes: Joi.string().trim().max(200).optional().allow(""),
});

const updateReservationSchema = Joi.object({
  date: Joi.date().greater("now").optional().messages({
    "date.greater": "Reservation date must be in the future",
    "date.base": "Please provide a valid date",
  }),
  timeSlot: Joi.string()
    .valid(
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
    )
    .optional()
    .messages({
      "any.only": "Invalid time slot selected",
    }),
  numberOfGuests: Joi.number().integer().min(1).max(20).optional().messages({
    "number.min": "At least 1 guest is required",
    "number.max": "Cannot exceed 20 guests",
    "number.base": "Number of guests must be a number",
  }),
  table: Joi.string().hex().length(24).optional().messages({
    "string.hex": "Invalid table ID format",
    "string.length": "Invalid table ID format",
  }),
  notes: Joi.string().trim().max(200).optional().allow(""),
  status: Joi.string()
    .valid("confirmed", "cancelled", "completed")
    .optional()
    .messages({
      "any.only": "Status must be confirmed, cancelled, or completed",
    }),
  adminNote: Joi.string().trim().max(300).optional().allow(""),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const createTableSchema = Joi.object({
  tableNumber: Joi.number().integer().min(1).required().messages({
    "number.min": "Table number must be at least 1",
    "number.base": "Table number must be a number",
    "any.required": "Table number is required",
  }),
  capacity: Joi.number().integer().min(1).max(20).required().messages({
    "number.min": "Capacity must be at least 1",
    "number.max": "Capacity cannot exceed 20",
    "number.base": "Capacity must be a number",
    "any.required": "Table capacity is required",
  }),
});

const updateTableSchema = Joi.object({
  tableNumber: Joi.number().integer().min(1).optional().messages({
    "number.min": "Table number must be at least 1",
    "number.base": "Table number must be a number",
  }),
  capacity: Joi.number().integer().min(1).max(20).optional().messages({
    "number.min": "Capacity must be at least 1",
    "number.max": "Capacity cannot exceed 20",
    "number.base": "Capacity must be a number",
  }),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

module.exports = {
  registerSchema,
  loginSchema,
  createReservationSchema,
  updateReservationSchema,
  createTableSchema,
  updateTableSchema,
};
