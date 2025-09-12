const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = Schema(
  {
    userName: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    emailConfirmed: {
      type: Boolean,
      default: false,
    },
    fullName: {
      type: String,
      required: true,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    position: {
      type: String,
      default: "",
      enum: ["Manager", "Supervisor", "Employee"],
    },
    title: {
      type: String,
      default: "",
      required: true,
    },
    dob: {
      type: Date,
    },
    password: {
      type: String,
      required: true,
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: "team",
    },
    managerOfTeams: [
      {
        type: Schema.Types.ObjectId,
        ref: "team",
      },
    ],
    supervisorOfTeams: [
      {
        type: Schema.Types.ObjectId,
        ref: "team",
      },
    ],
    tasks: [
      {
        type: Schema.Types.ObjectId,
        ref: "task",
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = User = mongoose.model("user", UserSchema);
