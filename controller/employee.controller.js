import Employee from "../model/employee.model.js";
import mongoose from "mongoose";

import { ClientModel } from "../model/client.model.js";
import { TaskModel } from "../model/task.model.js";
import Attendance from "../model/attendance.model.js";

const createEmployee = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      department,
      position,
      hire_date,
      hourly_rate,
      profile_image,
      status,
      employee_id,
      role,
    } = req.body;
    if (
      !first_name ||
      !last_name ||
      !email ||
      !department ||
      !position ||
      !hire_date ||
      !hourly_rate ||
      !employee_id
    ) {
      return res.status(400).json({ message: "All Fields are required" });
    }
    const existingEmployee = await Employee.findOne({
      employee_id,
      isDeleted: false,
    });
    if (existingEmployee) {
      return res.status(409).json({ message: "Employe id  already in use" });
    }
    console.log(existingEmployee, String(employee_id));
    if (existingEmployee?.email === String(email)) {
      return res.status(409).json({ message: "email Id already exists" });
    }
    const newEmployee = new Employee({
      first_name,
      last_name,
      email,
      phone,
      department,
      position,
      hire_date,
      hourly_rate,
      status,
      profile_image,
      employee_id,
      role: role || "employee",
    });

    await newEmployee.save();

    res
      .status(201)
      .json({ message: "Employee Added SuccessFully", data: newEmployee });
  } catch (error) {
    console.error("Error Creating Employee:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// controllers/employeeController.js
 const checkEmail = async (req, res) => {
  try {
    return res.status(200).json({
      exists: true,
      subscribed: req.hasSubscription,
      employee_details: req.employee,
    });
  } catch (error) {
    console.error("Error in checkEmail:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getAllEmployee = async (req, res) => {
  try {
    const allEmployees = await Employee.find({ isDeleted: false }).sort({
      status: 1,
    });

    res.status(200).json(allEmployees);
  } catch (error) {
    console.error("Error fetching Employee:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
const editEmployee = async (req, res) => {
  try {
    const { empId } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone,
      department,
      position,
      hire_date,
      hourly_rate,
      profile_image,
      status,
      employee_id,
      role,
    } = req.body;

    if (!emplId) {
      return res
        .status(400)
        .json({ message: "Employee ID is required for editing." });
    }
    if (
      !first_name ||
      !last_name ||
      !email ||
      !department ||
      !position ||
      !hire_date ||
      !hourly_rate ||
      !employee_id ||
      !role
    ) {
      return res.status(400).json({ message: "All Fields are required" });
    }

    const updatedEmployee = await Employee.findOneAndUpdate(
      { _id: empId },
      {
        $set: {
          first_name,
          last_name,
          email,
          phone,
          department,
          position,
          hire_date,
          hourly_rate,
          profile_image,
          status,
          employee_id,
          role,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.status(200).json({
      message: "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    console.error("Error updating Employee:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { employee_id } = req.params;
    if (!employee_id) {
      return res
        .status(400)
        .json({ message: "Employee ID is required for deletion." });
    }

    const deletedEmployee = await Employee.findOneAndUpdate(
      {
        _id: employee_id,
      },
      {
        $set: { isDeleted: true },
      },
      { new: true }
    );

    if (!deletedEmployee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting Employee:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
const IST_OFFSET_MINUTES = 330;

function toISTWindow(date = new Date()) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const dd = d.getUTCDate();

  // Start of given UTC day -> shift to IST day start
  const utcStart = new Date(Date.UTC(y, m, dd, 0, 0, 0, 0));
  const istStart = new Date(
    utcStart.getTime() -
      (utcStart.getTimezoneOffset() + IST_OFFSET_MINUTES) * 60 * 1000
  );
  const istEnd = new Date(istStart.getTime() + 24 * 60 * 60 * 1000);
  return { start: istStart, end: istEnd };
}

function istMonthRange(date = new Date()) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();

  const firstUTC = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const start = new Date(
    firstUTC.getTime() -
      (firstUTC.getTimezoneOffset() + IST_OFFSET_MINUTES) * 60 * 1000
  );

  const nextFirstUTC = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
  const end = new Date(
    nextFirstUTC.getTime() -
      (nextFirstUTC.getTimezoneOffset() + IST_OFFSET_MINUTES) * 60 * 1000
  );

  return { start, end };
}

function prevIstMonthRange(date = new Date()) {
  const { start } = istMonthRange(date);
  const prevEnd = new Date(start.getTime());
  const prevStartUTC = new Date(
    Date.UTC(prevEnd.getUTCFullYear(), prevEnd.getUTCMonth() - 1, 1, 0, 0, 0, 0)
  );
  const prevStart = new Date(
    prevStartUTC.getTime() -
      (prevStartUTC.getTimezoneOffset() + IST_OFFSET_MINUTES) * 60 * 1000
  );
  return { start: prevStart, end: prevEnd };
}

function pctDiff(current, previous) {
  if (previous === 0) return current === 0 ? "0%" : "100%";
  const diff = ((current - previous) / previous) * 100;
  return `${Number.isFinite(diff) ? diff.toFixed(1) : 0}%`;
}

// Soft-snapshot helpers (best-effort "as-of" counts using createdAt/deletedAt when available)
async function countEmployeesAsOf(endDate, session) {
  // NOTE: Employee has no deletedAt; this approximates by excluding currently deleted/terminated.
  return Employee.countDocuments({
    createdAt: { $lt: endDate },
    isDeleted: { $ne: true },
    status: { $ne: "terminated" },
  }).session(session);
}

async function countActiveProjectsAsOf(endDate, session) {
  return ClientModel.countDocuments({
    createdAt: { $lt: endDate },
    $or: [{ deletedAt: null }, { deletedAt: { $gt: endDate } }],
    status: { $in: ["NOT STARTED", "IN PROGRESS", "BLOCKED"] }, // current status approximation
  }).session(session);
}

async function countActiveTasksAsOf(endDate, session, COMPLETED, ARCHIVED) {
  return TaskModel.countDocuments({
    createdAt: { $lt: endDate },
    $or: [{ deletedAt: null }, { deletedAt: { $gt: endDate } }],
    isDeleted: { $ne: true },
    status: { $nin: [...COMPLETED, ...ARCHIVED] }, // current status approximation
  }).session(session);
}

const COMPLETED_TASK_STATUSES = ["COMPLETED", "DONE", "RESOLVED", "CLOSED"];
const ARCHIVED_TASK_STATUSES = ["ARCHIVED", "CANCELLED", "CANCELED"];
const PRESENT_STATUSES = ["Present", "Late", "Half Day", "Permission"];
const LEAVE_STATUSES = ["On Leave"];

const getDashboardData = async (req, res) => {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    const todayIST = toISTWindow(new Date());
    const thisMonth = istMonthRange(new Date());
    const lastMonth = prevIstMonthRange(new Date());

    // --- Current snapshot metrics ---
    const totalEmployeesNow = await Employee.countDocuments({
      isDeleted: { $ne: true },
      status: { $ne: "terminated" },
    }).session(session);

    const activeProjectsNow = await ClientModel.countDocuments({
      deletedAt: null,
      status: { $in: ["NOT STARTED", "IN PROGRESS", "BLOCKED"] },
    }).session(session);

    const completedTasksNow = await TaskModel.countDocuments({
      isDeleted: { $ne: true },
      status: { $in: COMPLETED_TASK_STATUSES },
    }).session(session);

    const activeTasksNow = await TaskModel.countDocuments({
      isDeleted: { $ne: true },
      status: { $nin: [...COMPLETED_TASK_STATUSES, ...ARCHIVED_TASK_STATUSES] },
    }).session(session);

    // Attendance KPIs
    const [todayPresent, todayOnLeave] = await Promise.all([
      Attendance.countDocuments({
        date: { $gte: todayIST.start, $lt: todayIST.end },
        status: { $in: PRESENT_STATUSES },
      }).session(session),
      Attendance.countDocuments({
        date: { $gte: todayIST.start, $lt: todayIST.end },
        status: { $in: LEAVE_STATUSES },
      }).session(session),
    ]);
    const todayAbsentees = Math.max(
      0,
      totalEmployeesNow - (todayPresent + todayOnLeave)
    );

    // This month attendance (total records)
    const thisMonthAttendance = await Attendance.countDocuments({
      date: { $gte: thisMonth.start, $lt: thisMonth.end },
    }).session(session);

    // --- Last-month comparators (best-effort as-of snapshots / period counts) ---
    const totalEmployeesPrev = await countEmployeesAsOf(lastMonth.end, session);
    const activeProjectsPrev = await countActiveProjectsAsOf(
      lastMonth.end,
      session
    );
    const activeTasksPrev = await countActiveTasksAsOf(
      lastMonth.end,
      session,
      COMPLETED_TASK_STATUSES,
      ARCHIVED_TASK_STATUSES
    );

    // For completedTasks, also provide month-over-month flow comparison (tasks completed in month)
    const completedTasksPrevFlow = await TaskModel.countDocuments({
      isDeleted: { $ne: true },
      status: { $in: COMPLETED_TASK_STATUSES },
      actualEndDate: { $gte: lastMonth.start, $lt: lastMonth.end },
    }).session(session);

    const completedTasksThisFlow = await TaskModel.countDocuments({
      isDeleted: { $ne: true },
      status: { $in: COMPLETED_TASK_STATUSES },
      actualEndDate: { $gte: thisMonth.start, $lt: thisMonth.end },
    }).session(session);

    // Last month attendance (period count)
    const lastMonthAttendance = await Attendance.countDocuments({
      date: { $gte: lastMonth.start, $lt: lastMonth.end },
    }).session(session);

    await session.commitTransaction();
    session.endSession();

    res.json({
      totalEmployees: {
        count: totalEmployeesNow,
        diff: pctDiff(totalEmployeesNow, totalEmployeesPrev),
      },
      activeProjects: {
        count: activeProjectsNow,
        diff: pctDiff(activeProjectsNow, activeProjectsPrev),
      },
      thisMonthAttendance: {
        count: thisMonthAttendance,
        diff: pctDiff(thisMonthAttendance, lastMonthAttendance),
      },
      // Expose both snapshot delta and flow delta for tasks
      completedTasks: {
        count: completedTasksNow, // snapshot (all-time completed)
        diff: pctDiff(completedTasksThisFlow, completedTasksPrevFlow), // MoM flow: completed within month
        meta: {
          thisMonthCompleted: completedTasksThisFlow,
          lastMonthCompleted: completedTasksPrevFlow,
        },
      },
      activeTasks: {
        count: activeTasksNow,
        diff: pctDiff(activeTasksNow, activeTasksPrev),
      },
      attendaneState: {
        todayPresent,
        todayAbsentees,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching dashboard data", error: error.message });
  }
};

export {
  createEmployee,
  getAllEmployee,
  editEmployee,
  deleteEmployee,
  checkEmail,
  getDashboardData,
};
