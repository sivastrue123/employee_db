import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    // ref: "Employee",
    required: true,
  },
  date: {
    type: Date,
    required: true,
    unique: true,
  },
  clockIn: {
    type: Date,
    default: null,
  },
  clockOut: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ["Present", "Absent", "Late", "Half Day", "On Leave"],
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  EditedBy: {
    type: mongoose.Schema.Types.ObjectId,
  },
  EditedAt: {
    type: Date,
    default: Date.now,
  },
  reason: {
    type: String,
    default: "",
  },
});

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
