// models/Notes.ts
import { Schema, model, Document } from "mongoose";
import { Counter } from "./counter.model.js";

const NotesSchema = new Schema(
  {
    noteId: {
      type: String,
      unique: true, // enforce uniqueness
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      //   ref: "Client",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      required: true,
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: "version",
  }
);

NotesSchema.virtual("createdByUser", {
  ref: "Employee",
  localField: "createdBy",
  foreignField: "employee_id",
  justOne: true,
});

// ensure virtuals flow through lean() and toJSON/toObject
NotesSchema.set("toJSON", { virtuals: true });
NotesSchema.set("toObject", { virtuals: true });
// Middleware: Auto-generate noteId before save
NotesSchema.pre("save", async function (next) {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      { _id: "note" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const seqNumber = counter.seq;
    this.noteId = `Note ${seqNumber}`;
  }
  next();
});

export const Notes = model("Notes", NotesSchema);
