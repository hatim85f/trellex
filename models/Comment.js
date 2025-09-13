const mongoose = require("mongoose");
const Schema = mongoose.Schema;

function getRandomHexColor() {
  return (
    "#" +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")
  );
}

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
    backgroundColor: {
      type: String,
      default: getRandomHexColor,
    },
    forTask: {
      type: Schema.Types.ObjectId,
      ref: "Task" || "SubTask",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Comment = mongoose.model("Comment", CommentSchema);
