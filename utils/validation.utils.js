// src/utils/validation.util.js
import { CLIENT_STATUS } from "./clientGeneralUtils.js";
import { TaskPriority,TaskStatus } from "./clientGeneralUtils.js";


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


// src/utils/task.validation.js



export function validateTaskCreate(body) {
  const {
    title, priority, status,
    startDate, dueDate, actualEndDate,
    estimatedHours, assigneeEmployeeIds, checklist,
  } = body;

  const errors = [];

  if (!title || !String(title).trim()) errors.push('Task title is required');

  if (!priority || !TaskPriority.includes(priority)) {
    errors.push(`Priority must be one of: ${TaskPriority.join(', ')}`);
  }

  if (!status || !TaskStatus.includes(status)) {
    errors.push(`Status must be one of: ${TaskStatus.join(', ')}`);
  }

  if (startDate && !isValidISODate(startDate)) errors.push('startDate must be a valid ISO date');
  if (dueDate && !isValidISODate(dueDate)) errors.push('dueDate must be a valid ISO date');
  if (actualEndDate && !isValidISODate(actualEndDate)) errors.push('actualEndDate must be a valid ISO date');

  // chronological guards
  if (startDate && dueDate) {
    if (new Date(dueDate) < new Date(startDate)) {
      errors.push('dueDate cannot be earlier than startDate');
    }
  }
  if (actualEndDate && startDate) {
    if (new Date(actualEndDate) < new Date(startDate)) {
      errors.push('actualEndDate cannot be earlier than startDate');
    }
  }

  // hours
  if (estimatedHours !== undefined && estimatedHours !== null) {
    const num = Number(estimatedHours);
    if (Number.isNaN(num) || num < 0) errors.push('estimatedHours must be a non-negative number');
  }

  // assignees
  if (assigneeEmployeeIds !== undefined) {
    const ok = Array.isArray(assigneeEmployeeIds) && assigneeEmployeeIds.every(a => typeof a === 'string');
    if (!ok) errors.push('assigneeEmployeeIds must be an array of strings (employee_id values)');
  }

  // checklist
  if (checklist !== undefined) {
    const ok = Array.isArray(checklist) && checklist.every(i =>
      i && typeof i.text === 'string' && typeof i.done === 'boolean'
    );
    if (!ok) errors.push('checklist must be an array of { id:string, text:string, done:boolean, doneAt?:ISO }');
  }

  return errors;
}




export function validateTaskUpdate(body = {}) {
  const {
    title, description,
    priority, status,
    startDate, dueDate, actualEndDate,
    estimatedHours, assigneeEmployeeIds, checklist,
  } = body;

  const errors = [];

  if (title !== undefined && !String(title).trim()) {
    errors.push('Task title cannot be empty');
  }

  if (priority !== undefined && !TaskPriority.includes(priority)) {
    errors.push(`Priority must be one of: ${TaskPriority.join(', ')}`);
  }

  if (status !== undefined && !TaskStatus.includes(status)) {
    errors.push(`Status must be one of: ${TaskStatus.join(', ')}`);
  }

  const isValidISO = (v) => {
    if (v === null) return true; // allow nulling dates
    if (v === undefined) return true;
    const d = new Date(v);
    return !Number.isNaN(d.getTime());
  };

  if (!isValidISO(startDate)) errors.push('startDate must be a valid ISO date or null');
  if (!isValidISO(dueDate)) errors.push('dueDate must be a valid ISO date or null');
  if (!isValidISO(actualEndDate)) errors.push('actualEndDate must be a valid ISO date or null');

  if (estimatedHours !== undefined && estimatedHours !== null) {
    const num = Number(estimatedHours);
    if (Number.isNaN(num) || num < 0) errors.push('estimatedHours must be a non-negative number');
  }

  if (assigneeEmployeeIds !== undefined) {
    const ok = Array.isArray(assigneeEmployeeIds) && assigneeEmployeeIds.every(a => typeof a === 'string');
    if (!ok) errors.push('assigneeEmployeeIds must be an array of strings');
  }

  if (checklist !== undefined) {
    const ok = Array.isArray(checklist) && checklist.every(i =>
      i && typeof i._id === 'string' && typeof i.text === 'string' && typeof i.done === 'boolean'
    );
    if (!ok) errors.push('checklist must be an array of { id:string, text:string, done:boolean, doneAt?:ISO|null }');
  }

  return errors;
}
