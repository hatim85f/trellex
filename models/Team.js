const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TeamSchema = Schema(
  {
    teamName: {
      type: String,
      required: true,
      unique: true,
    },
    teamCode: {
      type: String,
      required: true,
      unique: true,
    },
    teamLogo: {
      type: String,
      default: "",
    },
    teamSolgan: {
      type: String,
      default: "",
    },
    supervisedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    managedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timeStamps: true,
  }
);

module.exports = Team = mongoose.model("team", TeamSchema);
