// src/utils/normalize.util.js
import { coerceDate } from "./validation.utils.js";
import mongoose from "mongoose";
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
    title,
    description,
    priority,
    status,
    startDate,
    dueDate,
    actualEndDate,
    estimatedHours,
    assigneeEmployeeIds,
    checklist,
  } = body;

  return {
    clientId,

    title: String(title).trim(),
    description: description ?? "",
    priority,
    status,
    startDate: coerceDate(startDate),
    dueDate: coerceDate(dueDate),
    actualEndDate: coerceDate(actualEndDate),
    estimatedHours:
      estimatedHours === undefined || estimatedHours === null
        ? undefined
        : Number(estimatedHours),
    assigneeEmployeeIds: Array.isArray(assigneeEmployeeIds)
      ? assigneeEmployeeIds
      : [],
    checklist: Array.isArray(checklist)
      ? checklist.map((i) => ({
          // _id: String(i._id),
          text: String(i.text),
          done: Boolean(i.done),
          doneAt: coerceDate(i.doneAt),
        }))
      : [],
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

  if (body.title !== undefined) out.title = String(body.title).trim();
  if (body.description !== undefined) out.description = body.description ?? "";
  if (body.priority !== undefined) out.priority = body.priority;
  if (body.status !== undefined) out.status = body.status;

  if (body.startDate !== undefined)
    out.startDate = coerceDateOrNull(body.startDate);
  if (body.dueDate !== undefined) out.dueDate = coerceDateOrNull(body.dueDate);
  if (body.actualEndDate !== undefined)
    out.actualEndDate = coerceDateOrNull(body.actualEndDate);

  if (body.estimatedHours !== undefined) {
    out.estimatedHours =
      body.estimatedHours === null ? null : Number(body.estimatedHours);
  }
  if (body.actualHours !== undefined) {
    out.actualHours =
      body.actualHours === null ? null : Number(body.actualHours);
  }
  if (body.assigneeEmployeeIds !== undefined) {
    out.assigneeEmployeeIds = Array.isArray(body.assigneeEmployeeIds)
      ? body.assigneeEmployeeIds
      : [];
  }

  if (body.checklist !== undefined) {
    out.checklist = Array.isArray(body.checklist)
      ? body.checklist.map((i) => ({
          _id: i._id ? String(i._id) : new mongoose.Types.ObjectId(),
          text: String(i.text),
          done: Boolean(i.done),
          doneAt: coerceDateOrNull(i.doneAt),
        }))
      : [];
  }

  return out; // used under {$set: out}
}


// src/validators/client.update.validators.js
export function validateClientUpdate(payload) {
  const errors = [];

  const { name, owner, team, tags, progress, status, dueDate, version } = payload;

  if (name !== undefined && typeof name !== 'string') errors.push("name must be a string");
  if (owner !== undefined && typeof owner !== 'string') errors.push("owner must be a string");
  if (team !== undefined && typeof team !== 'string') errors.push("team must be a string");
  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.some(t => typeof t !== 'string')) {
      errors.push("tags must be an array of strings");
    }
  }
  if (progress !== undefined) {
    const n = Number(progress);
    if (!Number.isFinite(n) || n < 0 || n > 100) errors.push("progress must be a number between 0 and 100");
  }
  if (status !== undefined) {
    const allowed = ['NOT STARTED','IN PROGRESS','BLOCKED','COMPLETED','ARCHIVED'];
    if (!allowed.includes(status)) errors.push(`status must be one of ${allowed.join(', ')}`);
  }
  if (dueDate !== undefined) {
    const d = new Date(dueDate);
    if (isNaN(d.getTime())) errors.push("dueDate must be a valid date");
  }
  if (version !== undefined && typeof version !== 'number') {
    errors.push("version must be a number");
  }

  return errors;
}

export function normalizeClientUpdate(payload, actorId) {
  const { name, owner, team, tags, progress, status, dueDate } = payload;

  const delta = {};
  if (name !== undefined) delta.name = name.trim();
  if (owner !== undefined) delta.owner = owner.trim();
  if (team !== undefined) delta.team = team.trim();
  if (tags !== undefined) delta.tags = tags.map(t => t.trim()).filter(Boolean);
  if (progress !== undefined) delta.progress = Number(progress);
  if (status !== undefined) delta.status = status;
  if (dueDate !== undefined) delta.dueDate = new Date(dueDate);

  // audit fields — aligns with your schema
  delta.updatedBy = actorId;

  return delta;
}
