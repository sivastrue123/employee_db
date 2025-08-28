// src/services/project.service.js
import { mongoose } from "mongoose";

import { TaskModel } from "../model/task.model.js";
import { ClientModel } from "../model/client.model.js";
import Employee from "../model/employee.model.js";
import { badRequest } from "./http.utils.js";

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

export async function ensureClientExistsAndNotDeletedOr404(res, clientId) {
  const client = await ClientModel.findById(clientId).lean();
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return null;
  }
  if (client.deletedAt) {
    res
      .status(409)
      .json({ error: "Client is deleted; restore before adding tasks" });
    return null;
  }
  return client;
}

// src/utils/employee.bulk.util.js


export async function ensureActiveEmployeesOr400(res, employeeIds = []) {
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) return true;

  const uniq = [...new Set(employeeIds)];
  const found = await Employee.find({
    employee_id: { $in: uniq },
    isDeleted: false,
    status: "active",
  })
    .select("employee_id")
    .lean();

  const foundSet = new Set(found.map((e) => e.employee_id));
  const missing = uniq.filter((id) => !foundSet.has(id));

  if (missing.length) {
    return (
      badRequest(
        res,
        `Assignees not active or not found: ${missing.join(", ")}`
      ),
      false
    );
  }
  return true;
}
