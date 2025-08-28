import { Schema } from "mongoose";

export const ChecklistItemSchema = new Schema(
  {
    // id: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
  },
  { _id: true }
);
