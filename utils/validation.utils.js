// src/utils/validation.util.js
import { CLIENT_STATUS } from "./clientGeneralUtils.js";

export function isValidISODate(v) {
  if (!v) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

export function coerceDate(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function validateProgress(progress) {
  if (
    progress === undefined ||
    progress === null ||
    Number.isNaN(Number(progress))
  ) {
    return "Progress is required and must be a number";
  }
  const num = Number(progress);
  if (num < 0 || num > 100) return "Progress must be between 0 and 100";
  return null;
}

export function validateStatus(status) {
  if (!status || !CLIENT_STATUS.includes(status)) {
    return `Status is required and must be one of: ${CLIENT_STATUS.join(", ")}`;
  }
  return null;
}

export function validateTags(tags) {
  if (tags === undefined) return null;
  if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
    return "Tags must be an array of strings if provided";
  }
  return null;
}

export function validateTeam(team) {
  if (team === undefined) return null;
  if (typeof team !== "string") return "Team must be a string if provided";
  return null;
}

/**
 * Validates required fields for CREATE. Returns array of error strings.
 */
export function validateClientCreate({
  name,
  owner,
  progress,
  status,
  dueDate,
  team,
  tags,
}) {
  const errors = [];
  if (!name || !String(name).trim()) errors.push("Client name is required");
  if (!owner || !String(owner).trim())
    errors.push("Owner (employee_id) is required");

  const pErr = validateProgress(progress);
  if (pErr) errors.push(pErr);

  const sErr = validateStatus(status);
  if (sErr) errors.push(sErr);

  if (!isValidISODate(dueDate))
    errors.push("Due date is required and must be a valid ISO date");

  const tErr = validateTeam(team);
  if (tErr) errors.push(tErr);

  const tagsErr = validateTags(tags);
  if (tagsErr) errors.push(tagsErr);

  return errors;
}
