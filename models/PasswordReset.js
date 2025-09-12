const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PasswordResetSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  code: {
    type: String,
    required: true,
    length: 5,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // 5 minutes
  },
});

module.exports = PasswordReset = mongoose.model(
  "passwordreset",
  PasswordResetSchema
);
