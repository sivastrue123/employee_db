import { Schema, model } from "mongoose";

const TaskSchema = new Schema(
  {
    taskName: { type: String, required: true, trim: true },
    customer: { type: String, required: true, trim: true },
    priority: { type: String, required: true }, // "Low" | "Medium" | "High"
    assignedDate: { type: String, required: true },           // yyyy-mm-dd
    assignedBy: { type: String, required: true, trim: true },
    estimatedCompletion: { type: String, required: true },     // yyyy-mm-dd
    remarks: { type: String, default: "" },
    status: { type: String, required: true }, // "On-going" | "Completed" | "Hold" | "Assigned"
    totalHours: { type: Number, required: true },
  },
  { _id: false }
);

const WorklogSchema = new Schema(
  {
    employeeId: { type: String, index: true, required: true },
    date: { type: String, required: true }, // yyyy-mm-dd
    submittedBy: { type: String, required: true },
    attendanceId: { type: String },
    tasks: { type: [TaskSchema], required: true },
    totalHours: { type: Number, default: 0 },
    meta: {
      submittedAt: { type: Date, default: () => new Date() },
      lastUpdatedAt: { type: Date, default: () => new Date() },
      source: { type: String, default: "web" },
      version: { type: Number, default: 1 },
    },
  },
  { timestamps: true }
);

export const Worklog = model("Worklog", WorklogSchema);
    