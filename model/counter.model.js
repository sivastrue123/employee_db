// models/Counter.ts
import { Schema, model } from "mongoose";

const CounterSchema = new Schema({
  _id: { type: String, required: true }, // entity name e.g. "note"
  seq: { type: Number, default: 0 },
});

export const Counter = model("Counter", CounterSchema);
