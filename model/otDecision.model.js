// models/otDecision.model.js
import mongoose from "mongoose";

/**
 * Audit info for who changed OT and when.
 * Stored separately from the main "otStatus" string so reads remain lightweight.
 */
export const otDecisionSchema = new mongoose.Schema(
  {
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actionAt: { type: Date },
  },
  { _id: false, timestamps: false }
);
