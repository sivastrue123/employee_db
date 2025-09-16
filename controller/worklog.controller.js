import { Worklog } from "../model/worklog.model.js";
import Employee from "../model/employee.model.js";
/**
 * POST /api/worklog/submitDaily
 * Inserts a new worklog document.
 * No validation here by request. We compute totalHours for convenience.
 */
export async function insertWorklog(req, res) {
  try {
    const payload = req.body || {};
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];

    const totalHours =
      tasks.reduce((sum, t) => sum + Number(t?.totalHours || 0), 0) || 0;

    const doc = await Worklog.create({
      employeeId: payload.employeeId,
      date: payload.date,
      submittedBy: payload.submittedBy,
      attendanceId: payload.attendanceId,
      tasks,
      totalHours,
      meta: {
        submittedAt: new Date(),
        lastUpdatedAt: new Date(),
        source: "web",
        version: 1,
      },
    });

    return res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    console.error("insertWorklog error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

/**
 * GET /api/worklog
 * Returns all worklogs (optionally filter by employeeId and/or date range).
 * Query params (optional):
 *   employeeId=emp_123
 *   from=2025-09-01
 *   to=2025-09-30
 */
export async function getAllWorklogs(req, res) {
  try {
    const { employeeId, from, to } = req.query;

    // build filter
    const filter = {};
    if (employeeId) filter.employeeId = String(employeeId);
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = String(from);
      if (to) filter.date.$lte = String(to);
    }

    // resolve the real collection name for safety ("employees")
    const employeesCollection = Employee.collection.name;

    const pipeline = [
      { $match: filter },
      { $sort: { createdAt: -1 } },

      // join Employee by employeeId → employee.employee_id
      {
        $lookup: {
          from: employeesCollection,
          localField: "employeeId",
          foreignField: "employee_id",
          as: "emp",
        },
      },

      // derive submittedByName (fallbacks to employeeId if not found)
      {
        $addFields: {
          submittedByName: {
            $let: {
              vars: {
                fn: { $ifNull: [{ $arrayElemAt: ["$emp.first_name", 0] }, ""] },
                ln: { $ifNull: [{ $arrayElemAt: ["$emp.last_name", 0] }, ""] },
              },
              in: {
                $cond: [
                  { $gt: [{ $size: "$emp" }, 0] },
                  { $trim: { input: { $concat: ["$$fn", " ", "$$ln"] } } },
                  "$employeeId",
                ],
              },
            },
          },
        },
      },

      // project a lean, UI-friendly shape (hide _id and attendanceId)
      {
        $project: {
          _id: 0,
          employeeId: 1,
          date: 1,
          submittedByName: 1,
          tasks: 1,
          totalHours: 1,
          createdAt: 1,
          updatedAt: 1,
          // keep submittedBy if you still store it, but you won't show it in UI:
          // submittedBy: 1,
          // attendanceId: 0  // <- explicitly omit
        },
      },
    ];

    const docs = await Worklog.aggregate(pipeline);
    return res.json({ ok: true, data: docs });
  } catch (err) {
    console.error("getAllWorklogs error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}
