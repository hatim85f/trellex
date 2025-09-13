const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SubTaskSchema = Schema(
  {
    mainTask: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },
    endDate: {
      type: Date,
      required: true,
    },
    startDate: {
      // the date of the main task
      type: Date,
      required: true,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    feedback: [
      {
        createdBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        feedback: {
          type: String,
          required: true,
        },
      },
    ],
    attachments: [String],
  },
  {
    timestamps: true,
  }
);

module.exports = SubTask = mongoose.model("SubTask", SubTaskSchema);
