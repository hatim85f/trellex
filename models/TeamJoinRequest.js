const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TeamJoinSchema = Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    teamCode: {
      type: String,
      required: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = TeamJoin = mongoose.model("teamJoin", TeamJoinSchema);
