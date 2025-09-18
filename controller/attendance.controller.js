import Attendance from "../model/attendance.model.js";
import Employee from "../model/employee.model.js";
import {
  formatDateIST,
  earliestInMinutesIST,
  START_MIN,
  computeWorkedMinutes,
  mapStatusToFront,
  isSameISTDate,
  formatTimeIST12,
  humanizeMinutes,
  nowIST,
} from "../utils/attendanceUtils.js";
import { autoCloseYesterdaysOpenAttendancesIST } from "../middleware/autoAttendanceClose.js";

// --- shared utils (keep your existing implementations if already present) ---
const isProvided = (v) =>
  v !== undefined &&
  v !== null &&
  v !== "" &&
  v !== "undefined" &&
  v !== "null";

const parseDate = (val) => {
  if (!isProvided(val)) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const buildDayWindow = (isoLike) => {
  const start = parseDate(isoLike);
  if (!start) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { $gte: start, $lt: end };
};

const buildRangeWindow = (fromIso, toIso) => {
  const start = parseDate(fromIso);
  const end = parseDate(toIso);
  if (!start && !end) return null;
  if (start && end) {
    const endPlus = new Date(end);
    endPlus.setDate(endPlus.getDate() + 1);
    return { $gte: start, $lt: endPlus };
  }
  if (start && !end) return { $gte: start };
  if (!start && end) {
    const endPlus = new Date(end);
    endPlus.setDate(endPlus.getDate() + 1);
    return { $lt: endPlus };
  }
  return null;
};
const getAllAttendance = async (req, res) => {
  try {
    let { employeeIds, today, from, to, page, pageSize, search } = req.query;

    // ---------- pagination inputs ----------
    const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const size = Math.min(
      100,
      Math.max(1, parseInt(pageSize ?? "10", 10) || 10)
    );
    const skip = (pageNum - 1) * size;

    // ---------- base filters ----------
    const match = {};

    // Employees filter
    let employeeIdArray = [];
    if (isProvided(employeeIds)) {
      employeeIdArray = String(employeeIds)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (employeeIdArray.length) match.employeeId = { $in: employeeIdArray };
    }

    // Date window: range first, else single day
    let dateFilter = null;
    if (isProvided(from) || isProvided(to)) {
      dateFilter = buildRangeWindow(from, to);
    } else if (isProvided(today)) {
      dateFilter = buildDayWindow(today);
    }
    if (dateFilter) match.date = dateFilter;

    // ---------- pre-pagination search enrichment ----------
    // Goal: push search "left" into the query so we $match → $sort → $skip/$limit
    // Supports:
    //   - status text (Attendance.status)
    //   - date text (by expanding date window, not string search)
    //   - employee name match (via Employee prefetch → employeeId IN [...])
    // Note: createdBy/editedBy name search is omitted for prefilter simplicity.
    let employeeIdsFromSearch = [];
    if (isProvided(search)) {
      const qRaw = String(search).trim();
      const q = qRaw.toLowerCase();

      // Try: parse as date. If valid and no explicit date filters provided, apply day window.
      const parsedSearchDate = parseDate(qRaw);
      if (!dateFilter && parsedSearchDate) {
        match.date = buildDayWindow(parsedSearchDate.toISOString());
      }

      // Status regex (case-insensitive)
      // If you want exact mapping, consider enumerating allowed statuses.
      match.status = { $regex: q, $options: "i" };

      // Employee name search → fetch matching employee_id list
      const empCandidates = await Employee.find({
        $or: [
          { first_name: { $regex: q, $options: "i" } },
          { last_name: { $regex: q, $options: "i" } },
          { full_name: { $regex: q, $options: "i" } }, // if you maintain a denorm full_name
        ],
      })
        .select({ employee_id: 1 })
        .lean();

      employeeIdsFromSearch = empCandidates
        .map((e) => e?.employee_id)
        .filter(Boolean);

      // If name query produced matches, intersect with any existing employee filter
      if (employeeIdsFromSearch.length) {
        if (match.employeeId?.$in?.length) {
          const set = new Set() < string > match.employeeId.$in;
          match.employeeId = {
            $in: employeeIdsFromSearch.filter((id) => set.has(id)),
          };
        } else {
          match.employeeId = { $in: employeeIdsFromSearch };
        }
      }
    }

    // ---------- deterministic sort (primary + tiebreaker) ----------
    // Stable ordering prevents cross-page jitter. We also cap with _id desc as tie-break.
    const sortStage = { date: -1, _id: -1 };

    // ---------- fetch page with look-ahead ----------
    const raw = await Attendance.find(match)
      .sort(sortStage)
      .skip(skip)
      .limit(size + 1) // look-ahead for hasMore
      .lean();

    const hasMore = raw.length > size;
    const pageDocs = hasMore ? raw.slice(0, size) : raw;

    if (pageNum === 1 && pageDocs.length === 0) {
      return res.status(404).json({
        message: "No attendance records found",
        data: [],
        monthSummary: null,
        page: pageNum,
        pageSize: size,
        hasMore: false,
      });
    }

    // ---------- join employee & metadata (parallelized) ----------
    const employeeDetailsPromises = pageDocs.map(async (row) => {
      const { createdBy, EditedBy, employeeId } = row;
      const createdByDetails = Employee.findOne({ _id: createdBy }).lean();
      const editedByDetails = Employee.findOne({ _id: EditedBy }).lean();
      const employeeDetails = Employee.findOne({
        employee_id: employeeId,
      }).lean();
      return Promise.all([createdByDetails, editedByDetails, employeeDetails]);
    });

    const employeeDetailsList = await Promise.all(employeeDetailsPromises);

    // ---------- map to FE contract ----------
    const result = pageDocs.map((row, index) => {
      const {
        _id,
        date,
        clockIn,
        clockOut,
        status,
        sessions,
        employeeId,
        createdAt,
        EditedAt,
        otStatus,
      } = row;

      const [createdByDetails, editedByDetails, employeeDetails] =
        employeeDetailsList[index] || [];

      const attendanceDate = formatDateIST(date);

      // LATE
      let lateMinutes = 0;
      const earliestIn = earliestInMinutesIST({
        sessions,
        clockIn,
        recordDate: new Date(date),
      });
      if (earliestIn != null && earliestIn > START_MIN) {
        lateMinutes = earliestIn - START_MIN;
      }

      // WORKED & OT
      const workedMinutes = computeWorkedMinutes({
        sessions,
        clockIn: clockIn ? new Date(clockIn) : null,
        clockOut: clockOut ? new Date(clockOut) : null,
        recordDate: new Date(date),
      });
      const otMinutes = workedMinutes > 600 ? workedMinutes - 600 : 0;

      // FE status
      const hasAnyIn =
        (Array.isArray(sessions) && sessions.some((s) => !!s?.in)) || !!clockIn;
      const feStatus = mapStatusToFront(
        status,
        hasAnyIn ? clockIn ?? true : null
      );

      // Display in/out
      let displayClockIn = null;
      let displayClockOut = null;

      if (Array.isArray(sessions) && sessions.length > 0) {
        const sameDaySessions = sessions
          .filter((s) => s?.in && isSameISTDate(new Date(s.in), new Date(date)))
          .sort((a, b) => +new Date(a.in) - +new Date(b.in));
        if (sameDaySessions.length > 0) {
          displayClockIn = sameDaySessions[0].in;
          const outs = sameDaySessions
            .map((s) => (s?.out ? new Date(s.out) : null))
            .filter(Boolean)
            .sort((a, b) => +a - +b);
          displayClockOut = outs.length > 0 ? outs[outs.length - 1] : null;
        }
      } else {
        displayClockIn = clockIn ?? null;
        displayClockOut = clockOut ?? null;
      }

      const empFirst = employeeDetails?.first_name ?? "";
      const empLast = employeeDetails?.last_name ?? "";
      const creatorFirst = createdByDetails?.first_name ?? "";
      const creatorLast = createdByDetails?.last_name ?? "";
      const editorFirst = editedByDetails?.first_name ?? "";
      const editorLast = editedByDetails?.last_name ?? "";

      return {
        id: String(_id),
        attendanceDate, // string from formatDateIST
        employeeId,
        otStatus: otStatus || null,
        employeeName: `${empFirst} ${empLast}`.trim() || null,
        employeeDepartment: employeeDetails?.department ?? "N/A",
        clockIn: formatTimeIST12(displayClockIn),
        clockOut: formatTimeIST12(displayClockOut),
        worked: humanizeMinutes(workedMinutes),
        ot: humanizeMinutes(otMinutes),
        createdAt: formatTimeIST12(createdAt),
        editedAt: formatTimeIST12(EditedAt),
        status: feStatus,
        ...(lateMinutes > 0 ? { late: humanizeMinutes(lateMinutes) } : {}),
        createdBy: {
          name: `${creatorFirst} ${creatorLast}`.trim() || undefined,
          role: createdByDetails?.role ?? "N/A",
        },
        editedBy: {
          name: `${editorFirst} ${editorLast}`.trim() || undefined,
          role: editedByDetails?.role ?? "N/A",
        },
      };
    });

    // ---------- month KPI (unchanged logic) ----------
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setMonth(monthStart.getMonth() + 1);

    const monthQuery = {
      date: { $gte: monthStart, $lt: nextMonthStart },
    };
    if (employeeIdArray.length)
      monthQuery.employeeId = { $in: employeeIdArray };

    const monthDocs = await Attendance.find(monthQuery)
      .select({ status: 1, sessions: 1, clockIn: 1, date: 1 })
      .lean();

    let present = 0;
    let absent = 0;
    for (const doc of monthDocs) {
      const hasAnyIn =
        (Array.isArray(doc.sessions) && doc.sessions.some((s) => !!s?.in)) ||
        !!doc.clockIn;
      const feStatus = mapStatusToFront(
        doc.status,
        hasAnyIn ? doc.clockIn ?? true : null
      );
      if (feStatus === "Present") present += 1;
      else if (feStatus === "Absent") absent += 1;
    }

    const monthSummary = {
      from: monthStart.toISOString(),
      to: nextMonthStart.toISOString(),
      present,
      absent,
    };

    // ---------- response (includes anchor for optional keyset pagination) ----------
    const last = pageDocs[pageDocs.length - 1];
    const pageAnchor = last
      ? {
          lastDate: last.date?.toISOString?.() ?? null,
          lastId: String(last._id),
        }
      : null;

    return res.status(200).json({
      message: "Attendance records fetched successfully",
      data: result,
      page: pageNum,
      pageSize: size,
      hasMore,
      // Optional: expose anchor to migrate FE from offset → keyset to eliminate
      // residual duplication when data mutates between requests.
      anchor: pageAnchor,
      monthSummary,
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

async function getAdminEditorId() {
  // Prefer an active, non-deleted Admin. Deterministic pick for stability.
  const admin = await Employee.findOne(
    { role: "admin", status: "active", isDeleted: false },
    { _id: 1 }
  )
    .sort({ createdAt: 1, _id: 1 }) // stable tie-breaker
    .lean();

  return admin?._id?.toString() || null;
}

const createAttendance = async (req, res, next) => {
  const { employeeId, date, clockIn, clockOut, status, reason, createdBy } =
    req.body;
  try {
    if (!employeeId || !date || !status) {
      return res
        .status(400)
        .json({ message: "Employee, date, and status are required" });
    }

    const existingAttendance = await Attendance.findOne({
      employeeId: employeeId,
      date,
    });

    if (existingAttendance) {
      if (!existingAttendance?.clockOut) {
        req.params.attendanceId = existingAttendance._id;
        return next();
      }
      return res
        .status(409)
        .json({ message: "Attendance already recorded for today" });
    }
    try {
      const adminId = await getAdminEditorId();
      await autoCloseYesterdaysOpenAttendancesIST({
        triggerAt: nowIST(),
        editedBy: adminId,
      });
    } catch (e) {
      console.error("Auto-close routine failed (non-blocking):", e);
    }
    const newAttendance = new Attendance({
      employeeId,
      date,
      clockIn,
      sessions: [{ in: clockIn }],
      status,
      createdBy,
      reason,
    });

    await newAttendance.save();
    res.status(201).json({
      message: "Attendance created successfully",
      data: newAttendance,
    });
  } catch (error) {
    console.error("Error creating attendance:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getUserAttendanceByDate = async (req, res) => {
  const { employeeId, date } = req.query;
  try {
    const attendance = await Attendance.findOne({
      employeeId,
      date: new Date(date),
    });

    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    const attendanceObj = attendance.toObject();

    // Calculate total worked minutes fr
    let workedMinutes;
    // Iterate through sessions and calculate worked time
    if (attendanceObj.sessions && attendanceObj.sessions.length > 0) {
      workedMinutes = computeWorkedMinutes({
        sessions: attendanceObj.sessions,
        clockIn: attendanceObj.clockIn ? new Date(attendanceObj.clockIn) : null,
        clockOut: attendanceObj.clockOut
          ? new Date(attendanceObj.clockOut)
          : null,
        recordDate: new Date(date),
      });
    }

    // --- Calculate the total worked hours and format them ---

    // Add the worked hours and minutes to the attendance object
    attendanceObj.totalWorkedTime = humanizeMinutes(workedMinutes);

    // Business intelligence layer: session activity flagging
    if (attendanceObj.sessions && attendanceObj.sessions.length > 0) {
      const lastSession =
        attendanceObj.sessions[attendanceObj.sessions.length - 1];
      attendanceObj.isActive = lastSession.out === null;
    } else {
      attendanceObj.isActive = false;
    }

    res.status(200).json({
      message: "Attendance record fetched successfully",
      data: attendanceObj,
    });
  } catch (error) {
    console.error("Error fetching attendance record:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getAttendanceByEmployee = async (req, res) => {
  const { employeeId } = req.query;
  try {
    const attendanceRecords = await Attendance.find({ employeeId })
      .sort({ date: -1 })
      .lean();

    if (attendanceRecords.length === 0) {
      return res.status(404).json({ message: "No attendance records found" });
    }

    const result = attendanceRecords.map((row) => {
      const { _id, date, clockIn, clockOut, status, sessions, otStatus } = row;

      const attendanceDate = formatDateIST(date);

      // --- LATE: based on earliest session in ---
      let lateMinutes = 0;
      const earliestIn = earliestInMinutesIST({
        sessions,
        clockIn,
        recordDate: new Date(date),
      });
      if (earliestIn != null && earliestIn > START_MIN) {
        lateMinutes = earliestIn - START_MIN;
      }

      // --- WORKED & OT from sessions-first, legacy fallback ---
      const workedMinutes = computeWorkedMinutes({
        sessions,
        clockIn: clockIn ? new Date(clockIn) : null,
        clockOut: clockOut ? new Date(clockOut) : null,
        recordDate: new Date(date),
      });

      const otMinutes = workedMinutes > 600 ? workedMinutes - 600 : 0;

      // --- FE status (unchanged business logic) ---
      // Treat as present if any valid 'in' exists in sessions OR legacy clockIn
      const hasAnyIn =
        (Array.isArray(sessions) && sessions.some((s) => !!s?.in)) || !!clockIn;
      const feStatus = mapStatusToFront(
        status,
        hasAnyIn ? clockIn ?? true : null
      );

      // For display, use the earliest in and the last out on that date (for parity with old FE)
      let displayClockIn = null;
      let displayClockOut = null;

      if (Array.isArray(sessions) && sessions.length > 0) {
        const sameDaySessions = sessions
          .filter((s) => s?.in && isSameISTDate(new Date(s.in), new Date(date)))
          .sort((a, b) => new Date(a.in) - new Date(b.in));

        if (sameDaySessions.length > 0) {
          displayClockIn = sameDaySessions[0].in;
          // last out among same-day sessions that has out; if none and today, may still be open
          const outs = sameDaySessions
            .map((s) => (s?.out ? new Date(s.out) : null))
            .filter(Boolean)
            .sort((a, b) => a - b);
          displayClockOut = outs.length > 0 ? outs[outs.length - 1] : null;
        }
      } else {
        displayClockIn = clockIn ?? null;
        displayClockOut = clockOut ?? null;
      }

      return {
        id: String(_id),
        attendanceDate,
        clockIn: formatTimeIST12(displayClockIn),
        clockOut: formatTimeIST12(displayClockOut),
        otStatus: otStatus ? otStatus : null,
        worked: humanizeMinutes(workedMinutes), // <-- NEW surfaced metric
        ot: humanizeMinutes(otMinutes),
        status: feStatus,
        ...(lateMinutes > 0 ? { late: humanizeMinutes(lateMinutes) } : {}),
      };
    });

    res.status(200).json({
      message: "Attendance records fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const editAttendance = async (req, res) => {
  const { attendanceId } = req.params;
  const { clockIn, clockOut, status, reason } = req.body;
  const { LoggedOut = false, userId } = req.query;

  try {
    if (!attendanceId) {
      return res.status(400).json({ message: "Attendance ID is required" });
    }
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    // Normalize dates if provided (support strings/numbers)
    const inAt = clockIn ? new Date(clockIn) : null;
    const outAt = clockOut ? new Date(clockOut) : null;
    const now = new Date();

    // Guardrails: out must be after in when both supplied
    if (inAt && outAt && outAt < inAt) {
      return res
        .status(400)
        .json({ message: "clockOut cannot be earlier than clockIn" });
    }

    // === 1) Explicit logout flow ===
    if (LoggedOut && outAt) {
      const updated = await Attendance.findOneAndUpdate(
        { _id: attendanceId },
        {
          $set: {
            // legacy field for backward compat
            clockOut: outAt,

            // update the LAST open session only
            "sessions.$[last].out": outAt,

            status: status ? status : "",
            reason: reason ? reason : "",
            EditedBy: userId || attendance.EditedBy,
            EditedAt: now,
          },
        },
        {
          arrayFilters: [{ "last.out": null }], // IMPORTANT: correct array filter syntax
          new: true,
        }
      );

      if (!updated) {
        return res
          .status(409)
          .json({ message: "No open session to clock out" });
      }
      return res.status(200).json({ message: "Clocked out successfully" });
    }

    // === 2) Start a new session (clockIn only) ===
    if (inAt && !outAt) {
      // Optional: prevent concurrent open sessions
      const hasOpen = attendance.sessions?.some((s) => s && s.out === null);
      if (hasOpen) {
        return res
          .status(409)
          .json({ message: "An active session is already open" });
      }

      const punched = await Attendance.findOneAndUpdate(
        { _id: attendanceId },
        {
          $push: { sessions: { in: inAt } },
          $set: {
            // legacy sync for first punch of the day
            clockIn: attendance.clockIn || inAt,
            status: status ? status : "",
            reason: reason ? reason : "",
            EditedBy: userId || attendance.EditedBy,
            EditedAt: now,
          },
        },
        { new: true }
      );

      const attendanceObj = punched.toObject();

      let workedMinutes;
      // Iterate through sessions and calculate worked time
      if (attendanceObj.sessions && attendanceObj.sessions.length > 0) {
        workedMinutes = computeWorkedMinutes({
          sessions: attendanceObj.sessions,
          clockIn: attendanceObj.clockIn
            ? new Date(attendanceObj.clockIn)
            : null,
          clockOut: attendanceObj.clockOut
            ? new Date(attendanceObj.clockOut)
            : null,
          recordDate: new Date(attendanceObj.date),
        });
      }

      // --- Calculate the total worked hours and format them ---

      // Add the worked hours and minutes to the attendance object
      attendanceObj.totalWorkedTime = humanizeMinutes(workedMinutes);
      if (!punched) {
        return res.status(500).json({ message: "Failed to create session" });
      }
      return res
        .status(200)
        .json({ message: "Clocked in successfully", data: attendanceObj });
    }

    // === 3) Close last open session with provided clockOut (clockIn + clockOut) ===
    // We intentionally ignore the provided clockIn here and just close the last open session
    if (!inAt && outAt) {
      const hasOpen = attendance.sessions?.some((s) => s && s.out === null);
      if (!hasOpen) {
        return res.status(409).json({ message: "No active record found" });
      }
      const updated = await Attendance.findOneAndUpdate(
        { _id: attendanceId },
        {
          $set: {
            "sessions.$[last].out": outAt,
            status: status ? status : "",
            reason: reason ? reason : "",
            EditedBy: userId || attendance.EditedBy,
            EditedAt: now,
          },
        },
        {
          arrayFilters: [{ "last.out": null }],
          new: true,
        }
      );

      if (!updated) {
        return res
          .status(409)
          .json({ message: "No open session to clock out" });
      }
      return res.status(200).json({ message: "Clocked out successfully" });
    }

    // === 4) Fallback: no actionable changes ===
    return res.status(200).json({
      message: "Attendance updated successfully",
      data: attendance,
    });
  } catch (error) {
    // Centralized exception handling
    console.error("Error updating attendance:", error);

    // Handle duplicate key in case upstream creates new docs here in the future
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "Duplicate attendance for employee/date",
        details: error?.keyValue || {},
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: error?.message || String(error),
    });
  }
};
const deleteAttendance = async (req, res) => {
  const { attendanceId } = req.params;
  try {
    if (!attendanceId) {
      return res.status(400).json({ message: "Attendance ID is required" });
    }

    const attendance = await Attendance.findByIdAndDelete(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    res.status(200).json({
      message: "Attendance deleted successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Error deleting attendance:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const createBulkAttendanceAction = async (req, res) => {
  const { employeeIds, reason, status, date, clockIn, clockOut } =
    req.body.payload;
  const { userId } = req.params;
  try {
   
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res
        .status(400)
        .json({ message: "employeeIds must be a non-empty array." });
    }
    if (!userId) {
      return res.status(400).json({ message: "Invalid or missing userId." });
    }
    function toStartOfDay(dateLike) {
      const d = dateLike ? new Date(dateLike) : new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const day = toStartOfDay(date);
    const uniqueIds = Array.from(
      new Set(
        employeeIds
          .filter((x) => typeof x === "string")
          .map((x) => x.trim())
          .filter(Boolean)
      )
    );

    if (uniqueIds.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid employeeIds provided." });
    }

    const docs = uniqueIds.map((empId) => ({
      employeeId: empId,
      date: date,
      status: status,
      reason: (reason || "").trim(),
      createdBy: userId,

      // Legacy compatibility / defaults
      clockIn: clockIn ? clockIn : null,
      clockOut: clockOut ? clockOut : null,

      // New sessions array supported by schema
      sessions: [
        clockIn && clockOut
          ? { in: clockIn, out: clockOut, source: "manual" }
          : null,
      ],
    }));

    const inserted = await Attendance.insertMany(docs, {
      ordered: false, // insert as many as possible
      rawResult: true, // to introspect write errors
    });
    const requested = uniqueIds.length;
    const createdCount = inserted.insertedCount ?? inserted.length ?? 0;

    // If rawResult is present, extract duplicate/conflict telemetry
    const writeErrors =
      inserted?.mongoose?.result?.writeErrors ||
      inserted?.result?.result?.writeErrors ||
      [];
    const conflicts =
      writeErrors
        ?.filter((e) => e.code === 11000)
        .map((e) => {
          // Try several shapes to pull the conflicting employeeId/date back
          const op = e.op || e.err?.op || e.getOperation?.() || {};
          return {
            employeeId: op.employeeId || null,
            date: op.date || day,
            reason: "Duplicate (employeeId, date) violates unique index",
          };
        }) || [];
    return res.status(createdCount > 0 ? 201 : 409).json({
      message:
        createdCount > 0
          ? "Bulk attendance created with partial success."
          : "No documents created; all conflicted with existing records.",
      metrics: {
        requested,
        created: createdCount,
        conflicts: conflicts.length,
      },
      details: {
        // IDs that were requested; useful if the client needs to diff
        requestedEmployeeIds: uniqueIds,
        conflictItems: conflicts,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message:
          "One or more attendance records already exist for the provided (employeeId, date).",
        error: error.message,
      });
    }

    console.error("Error creating attendance (bulk insert):", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
const updateOTStatus = async (req, res) => {
  try {
    const ALLOWED_OT = new Set(["Approved", "Rejected", "Pending"]);
    const { attendanceId } = req.params;
    const { status } = req.body;

    // Prefer auth middleware (req.user), fallback to query userId
    const actionBy = req.user?.id || req.user?._id || req.query.userId || null;

    if (!status || !ALLOWED_OT.has(status)) {
      return res.status(400).json({
        message: "Invalid status. Allowed values: Approved, Rejected, Pending",
      });
    }
    if (!attendanceId) {
      return res.status(400).json({ message: "attendanceId is required" });
    }

    const update = {
      otStatus: status,
      otDecision: actionBy ? { actionBy, actionAt: new Date() } : undefined, // if you want to *require* actionBy, change this to a 400 above.
      EditedAt: new Date(),
      ...(actionBy ? { EditedBy: actionBy } : {}),
    };

    const doc = await Attendance.findByIdAndUpdate(attendanceId, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!doc) {
      return res.status(404).json({ message: "Attendance not found" });
    }

    return res.status(200).json({
      message: "OT status updated",
      data: doc,
    });
  } catch (err) {
    console.error("updateOTStatus error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
export {
  createAttendance,
  getAllAttendance,
  getAttendanceByEmployee,
  editAttendance,
  deleteAttendance,
  getUserAttendanceByDate,
  createBulkAttendanceAction,
  updateOTStatus,
};
