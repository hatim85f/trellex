const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationSchema = Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      required: true,
    },
    subTitle: {
      type: String,
      default: "",
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
