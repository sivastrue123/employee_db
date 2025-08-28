// src/models/task.model.js
import { Schema, model } from "mongoose";
import { TaskPriority, TaskStatus } from "../utils/clientGeneralUtils.js";
import { ChecklistItemSchema } from "./checkList.model.js";
import { attachAudit } from "../utils/audit.plugin.js";

const TaskSchema = new Schema(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    priority: {
      type: String,
      enum: Object.values(TaskPriority),
      required: true,
    },
    status: { type: String, enum: Object.values(TaskStatus), required: true },
    startDate: { type: Date },
    dueDate: { type: Date },
    actualEndDate: { type: Date },
    estimatedHours: { type: Number, min: 0 },
    assigneeEmployeeIds: { type: [String], default: [], index: true },
    checklist: { type: [ChecklistItemSchema], default: [] },

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: "version",
  }
);

TaskSchema.index({ projectId: 1, status: 1 });
TaskSchema.index({ projectId: 1, priority: 1, dueDate: 1 });

attachAudit(TaskSchema, "Task");

export const TaskModel = model("Task", TaskSchema);
