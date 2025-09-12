// models/attendance.model.js
import mongoose from "mongoose";
import { otDecisionSchema } from "./otDecision.model.js";

const SessionSchema = new mongoose.Schema(
  {
    in: { type: Date, required: true },
    out: { type: Date, default: null },
    source: {
      type: String,
      enum: ["manual", "web", "mobile"],
      default: "manual",
    },
    note: { type: String, default: "" },
  },
  { _id: false, timestamps: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String, // consider ObjectId+ref if you have an Employee model
      required: true,
    },
    date: { type: Date, required: true },

    // Optional: multi-session support
    sessions: { type: [SessionSchema], default: [] },

    // Legacy single-shot fields (keep for compatibility)
    clockIn: { type: Date, default: null },
    clockOut: { type: Date, default: null },

    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "Half Day", "On Leave", "Permission"],
      required: true,
    },

    reason: { type: String, default: "" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },

    // --- OT fields ---
    // 1) The human-visible status (fast and simple to read in APIs/UI)
    otStatus: {
      type: String,
      enum: ["Approved", "Rejected", "Pending", null],
      default: null, // null means no decision yet; your UI can still default to "Pending" if OT>0
    },
    // 2) Audit about who set the status and when
    otDecision: { type: otDecisionSchema, default: undefined },

    EditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    EditedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
