// src/utils/employee.util.js
import Employee from "../model/employee.model.js";

/**
 * Returns the active employee or null. Does NOT write to res.
 */
export async function findActiveEmployee(employeeId) {
  if (!employeeId) return null;
  return Employee.findOne({
    employee_id: employeeId,
    isDeleted: false,
    status: "active",
  }).lean();
}

/**
 * Validates employee is active; if not, returns a 400 response and `null`.
 * Use when you want controller to short-circuit with a client-facing error.
 */
export async function ensureActiveEmployeeOr400(res, employeeId, label) {
  const emp = await findActiveEmployee(employeeId);
  if (!emp) {
    res.status(400).json({
      error: `${label} with employee_id "${employeeId}" is not a valid active employee`,
    });
    return null;
  }
  return emp;
}
