// models/Counter.js
import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 100000 }, // starting point (6 digits)
});

export default mongoose.model("Counter", counterSchema);
