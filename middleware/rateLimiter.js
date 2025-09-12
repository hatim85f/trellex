const rateLimit = require("express-rate-limit");

// Rate limiter: 5 requests per 5 minutes per IP for sensitive endpoints
const sensitiveLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: { message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { sensitiveLimiter };
