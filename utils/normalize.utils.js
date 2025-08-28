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
