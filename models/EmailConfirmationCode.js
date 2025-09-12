const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const EmailConfirmationSchema = Schema({
  userId: {
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

module.exports = EmailConfirmation = mongoose.model(
  "emailConfirmation",
  EmailConfirmationSchema
);
