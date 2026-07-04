const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const errorHandler = require("./src/middleware/errorHandler");

const authRoutes = require("./src/routes/authRoutes");
const reservationRoutes = require("./src/routes/reservationRoutes");
const tableRoutes = require("./src/routes/tableRoutes");

const app = express();

app.use(helmet());

app.use(morgan("dev"));

app.use(express.json({ limit: "10kb" }));

app.use(cookieParser());

app.use(mongoSanitize());

app.use(xss());

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
};
app.use(cors(corsOptions));

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/tables", tableRoutes);

app.use((req, res) => {
  res
    .status(404)
    .json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

module.exports = app;
