const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");

const app = express();

// middleware first
app.use(express.json());
app.use(cors());

// optional: stop favicon noise
app.get("/favicon.ico", (req, res) => res.status(204).end());

// connect DB (make sure connectDB logs errors)
connectDB();

// healthcheck
app.get("/", (_req, res) => res.status(200).send("Trellex DB API is running"));

// routes
app.use("/api/auth", require("./routes/api/auth"));
app.use("/api/team", require("./routes/api/team"));
app.use("/api/tasks", require("./routes/api/tasks"));
app.use("/api/notifications", require("./routes/api/notifications"));

// not found
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// error handler (so unhandled errors don’t crash silently)
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
