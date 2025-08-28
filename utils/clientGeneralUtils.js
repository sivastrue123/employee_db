// src/models/enums.ts

export const ProjectStatus = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
});

// src/utils/status.enum.js
export const CLIENT_STATUS = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "ARCHIVED",
];

export const TaskStatus = ["NEW", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELED"];

export const TaskPriority = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
