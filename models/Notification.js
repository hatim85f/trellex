const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationSchema = Schema(
  {
    to: [
      {
        type: Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    from: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Notification = mongoose.model(
  "notification",
  NotificationSchema
);
