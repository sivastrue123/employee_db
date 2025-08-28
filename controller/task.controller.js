// src/controllers/task.controller.js
import { TaskModel } from '../model/task.model.js';
import { validateTaskCreate } from '../utils/validation.utils.js';
import { normalizeTaskCreate } from '../utils/normalize.utils.js';
import { ensureActiveEmployeeOr400 } from '../utils/employee.utils.js';
import { ensureActiveEmployeesOr400 } from '../utils/projectWithTask.js';
import { ensureClientExistsAndNotDeletedOr404 } from '../utils/projectWithTask.js';
import { badRequest } from '../utils/http.utils.js';
import { buildAuditOptions } from '../utils/audit.plugin.js';

export async function createTask(req, res, next) {
  try {
    const { clientId } = req.params;                // POST /clients/:clientId/tasks
    const { userId: actorId } = req.query;          // creator’s employee_id
    const body = req.body;

    // actor required
    if (!actorId) return badRequest(res, "Actor (query param 'userId' = employee_id) is required");

    // validate client exists & not deleted
    if (!await ensureClientExistsAndNotDeletedOr404(res, clientId)) return;

    // payload validation
    const errors = validateTaskCreate(body);
    if (errors.length) return badRequest(res, errors);

    // actor must be active
    if (!await ensureActiveEmployeeOr400(res, actorId, 'Actor')) return;

    // assignee set must all be active
    if (!(await ensureActiveEmployeesOr400(res, body.assigneeEmployeeIds))) return;

    // normalize & persist
    const doc = normalizeTaskCreate(body, clientId, actorId);
    const task = new TaskModel(doc);

    const saved = await task.save(buildAuditOptions(req, actorId));
    return res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
}
