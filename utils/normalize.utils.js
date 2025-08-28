// src/utils/normalize.util.js
import { coerceDate } from "./validation.utils.js";


export function normalizeClientCreate(
  { name, owner, team, tags, progress, status, dueDate },
  actorId
) {
  return {
    name: String(name).trim(),
    owner,
    team: team ?? "",
    tags: Array.isArray(tags) ? tags : [],
    progress: Number(progress),
    status,
    dueDate: coerceDate(dueDate),
    createdBy: actorId || null,
    updatedBy: null,
    deletedAt: null,
  };
}



export function normalizeTaskCreate(body, clientId, actorId) {
  const {
    id, title, description,
    priority, status,
    startDate, dueDate, actualEndDate,
    estimatedHours, assigneeEmployeeIds, checklist,
  } = body;

  return {
    clientId,
    id: id ?? undefined,
    title: String(title).trim(),
    description: description ?? '',
    priority,
    status,
    startDate: coerceDate(startDate),
    dueDate: coerceDate(dueDate),
    actualEndDate: coerceDate(actualEndDate),
    estimatedHours: (estimatedHours === undefined || estimatedHours === null) ? undefined : Number(estimatedHours),
    assigneeEmployeeIds: Array.isArray(assigneeEmployeeIds) ? assigneeEmployeeIds : [],
    checklist: Array.isArray(checklist) ? checklist.map(i => ({
      _id: String(i._id),
      label: String(i.label),
      done: Boolean(i.done),
      doneAt: coerceDate(i.doneAt),
    })) : [],
    createdBy: actorId || null,
    updatedBy: null,
    deletedAt: null,
  };
}


// src/utils/normalize.utils.js
const coerceDateOrNull = (v) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function normalizeTaskUpdate(body = {}, actorId) {
  const out = { updatedBy: actorId };

  if (body.title !== undefined)        out.title = String(body.title).trim();
  if (body.description !== undefined)  out.description = body.description ?? '';
  if (body.priority !== undefined)     out.priority = body.priority;
  if (body.status !== undefined)       out.status = body.status;

  if (body.startDate !== undefined)    out.startDate = coerceDateOrNull(body.startDate);
  if (body.dueDate !== undefined)      out.dueDate = coerceDateOrNull(body.dueDate);
  if (body.actualEndDate !== undefined)out.actualEndDate = coerceDateOrNull(body.actualEndDate);

  if (body.estimatedHours !== undefined) {
    out.estimatedHours = (body.estimatedHours === null ? null : Number(body.estimatedHours));
  }

  if (body.assigneeEmployeeIds !== undefined) {
    out.assigneeEmployeeIds = Array.isArray(body.assigneeEmployeeIds) ? body.assigneeEmployeeIds : [];
  }

  if (body.checklist !== undefined) {
    out.checklist = Array.isArray(body.checklist)
      ? body.checklist.map(i => ({
          _id: String(i._id),
          label: String(i.label),
          done: Boolean(i.done),
          doneAt: coerceDateOrNull(i.doneAt),
        }))
      : [];
  }

  return out; // used under {$set: out}
}
