// src/services/project.service.js
import { mongoose } from "mongoose";
import { ClientModel } from "../models/project.model.js";
import { TaskModel } from "../models/task.model.js";

export async function getProjectWithTasks(projectId) {
  const _id = new mongoose.Types.ObjectId(projectId);
  const project = await ClientModel.findById(_id).lean();
  if (!project) return null;
  const tasks = await TaskModel.find({
    projectId: _id,
    deletedAt: null,
  }).lean();
  return { ...project, tasks };
}
