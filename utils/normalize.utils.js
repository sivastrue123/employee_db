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
      id: String(i.id),
      label: String(i.label),
      done: Boolean(i.done),
      doneAt: coerceDate(i.doneAt),
    })) : [],
    createdBy: actorId || null,
    updatedBy: null,
    deletedAt: null,
  };
}
