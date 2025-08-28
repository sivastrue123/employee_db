// src/controllers/client.controller.js
import { ClientModel } from "../model/client.model.js";
import { ensureActiveEmployeeOr400 } from "../utils/employee.utils.js";
import { validateClientCreate } from "../utils/validation.utils.js";
import { normalizeClientCreate } from "../utils/normalize.utils.js";
import { badRequest } from "../utils/http.utils.js";
import { buildAuditOptions } from "../utils/audit.plugin.js";

export async function createClient(req, res, next) {
  try {
    const { name, owner, team, tags, progress, status, dueDate } = req.body;
    const { userId: actorId } = req.query; // creator’s employee_id

    // actor required at create time
    if (!actorId)
      return badRequest(
        res,
        "Actor (query param 'userId' = employee_id) is required"
      );

    // payload validation
    const errors = validateClientCreate({
      name,
      owner,
      team,
      tags,
      progress,
      status,
      dueDate,
    });
    if (errors.length) return badRequest(res, errors);

    // employee validations (owner + actor must be active)
    if (!(await ensureActiveEmployeeOr400(res, actorId, "Actor"))) return;
    if (!(await ensureActiveEmployeeOr400(res, owner, "Owner"))) return;

    // normalize & persist
    const doc = normalizeClientCreate(
      { name, owner, team, tags, progress, status, dueDate },
      actorId
    );
    const client = new ClientModel(doc);

    const saved = await client.save(buildAuditOptions(req, actorId));
    return res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
}
