import mongoose from "mongoose";

// const attendanceSchema = new mongoose.Schema({
//   employeeId: {
//     type: String,
//     // ref: "Employee",
//     required: true,
//   },
//   date: {
//     type: Date,
//     required: true,
//   },
//   clockIn: {
//     type: Date,
//     default: null,
//   },
//   clockOut: {
//     type: Date,
//     default: null,
//   },
//   status: {
//     type: String,
//     enum: ["Present", "Absent", "Late", "Half Day", "On Leave"],
//     required: true,
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true,
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
//   EditedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//   },
//   EditedAt: {
//     type: Date,
//     default: Date.now,
//   },
//   reason: {
//     type: String,
//     default: "",
//   },
// });

// const Attendance = mongoose.model("Attendance", attendanceSchema);
// export default Attendance;

// model/attendance.model.js

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
    employeeId: { type: String, required: true},
    date: { type: Date, required: true},

    // NEW: multi-session support
    sessions: { type: [SessionSchema], default: [] },

    // Legacy single-shot fields (kept for backward compat; optional to deprecate later)
    clockIn: { type: Date, default: null },
    clockOut: { type: Date, default: null },

    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "Half Day", "On Leave"],
      required: true,
    },

    reason: { type: String, default: "" },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
    
      required: true,
    },
    createdAt: { type: Date, default: Date.now },

    EditedBy: { type: mongoose.Schema.Types.ObjectId },
    EditedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
