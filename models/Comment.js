const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CommentSchema = Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
    },
    content: {
      type: String,
      required: true,
    },

    forTask: {
      type: Schema.Types.ObjectId,
      ref: "Task" || "SubTask",
    },
    backgroundColor: {
      type: String,
      default: "#FFFFFF",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Comment = mongoose.model("Comment", CommentSchema);
