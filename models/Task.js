const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TaskSchema = Schema(
  {
    title: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    attachments: [String],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    tags: [String],
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [
      {
        type: Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    attachments: [String],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    tags: [String],
    summary: [
      {
        type: String,
        default: "",
      },
    ],
    feedback: [
      {
        feedback: { type: String, required: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      },
    ],
    subtasks: [
      {
        type: Schema.Types.ObjectId,
        ref: "SubTask",
      },
    ],
    conclusion: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Task = mongoose.model("Task", TaskSchema);
