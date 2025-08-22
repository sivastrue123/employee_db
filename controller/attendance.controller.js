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
} from "../utils/attendanceUtils.js";

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

    console.log(existingAttendance);
    if (existingAttendance) {
      if (!existingAttendance?.clockOut) {
        console.log("it is going here");
        req.params.attendanceId = existingAttendance._id;
        return next();
      }
      return res
        .status(409)
        .json({ message: "Attendance already recorded for today" });
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

    // Calculate total worked minutes from sessions
    console.log(attendanceObj);
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
    console.log(workedMinutes);
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

const getAllAttendance = async (req, res) => {
  try {
    // Fetch attendance records from the database, including session data and metadata
    const attendanceRecords = await Attendance.find().sort({ date: -1 }).lean();

    if (attendanceRecords.length === 0) {
      return res.status(404).json({ message: "No attendance records found" });
    }

    const result = await Promise.all(
      attendanceRecords.map(async (row) => {
        const {
          _id,
          date,
          clockIn,
          clockOut,
          status,
          sessions,
          employeeId,
          createdBy,
          EditedBy,
          createdAt,
          EditedAt
        } = row;

        // Format the date into IST
        const attendanceDate = formatDateIST(date);

        // --- LATE: Calculate late minutes based on earliest session in ---
        let lateMinutes = 0;
        const earliestIn = earliestInMinutesIST({
          sessions,
          clockIn,
          recordDate: new Date(date),
        });
        if (earliestIn != null && earliestIn > START_MIN) {
          lateMinutes = earliestIn - START_MIN;
        }

        // --- WORKED & OT: Calculate worked minutes and overtime ---
        const workedMinutes = computeWorkedMinutes({
          sessions,
          clockIn: clockIn ? new Date(clockIn) : null,
          clockOut: clockOut ? new Date(clockOut) : null,
          recordDate: new Date(date),
        });
        const otMinutes = workedMinutes > 600 ? workedMinutes - 600 : 0;

        // --- FE status (unchanged business logic) ---
        const hasAnyIn =
          (Array.isArray(sessions) && sessions.some((s) => !!s?.in)) ||
          !!clockIn;
        const feStatus = mapStatusToFront(
          status,
          hasAnyIn ? clockIn ?? true : null
        );

        // --- For display, use the earliest clock-in and last clock-out ---
        let displayClockIn = null;
        let displayClockOut = null;

        if (Array.isArray(sessions) && sessions.length > 0) {
          const sameDaySessions = sessions
            .filter(
              (s) => s?.in && isSameISTDate(new Date(s.in), new Date(date))
            )
            .sort((a, b) => new Date(a.in) - new Date(b.in));

          if (sameDaySessions.length > 0) {
            displayClockIn = sameDaySessions[0].in;
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

        // Fetch employee details for 'createdBy' and 'EditedBy'
        const createdByDetails = await Employee.findOne({
          _id: createdBy,
        }).lean();
        const editedByDetails = await Employee.findOne({
          _id: EditedBy,
        }).lean();
        const employeeDetails = await Employee.findOne({
          employee_id: employeeId,
        }).lean();

        return {
          id: String(_id),
          attendanceDate,
          employeeId,
          employeeName: `${employeeDetails.first_name??employeeDetails.first_name} ${employeeDetails.last_name??employeeDetails.last_name}`,
          employeeDepartment: employeeDetails.department?? employeeDetails.department,
          clockIn: formatTimeIST12(displayClockIn),
          clockOut: formatTimeIST12(displayClockOut),
          worked: humanizeMinutes(workedMinutes), // New surfaced metric
          ot: humanizeMinutes(otMinutes),
          createdAt:formatTimeIST12(createdAt),
          editedAt:formatTimeIST12(EditedAt),
          status: feStatus,
          ...(lateMinutes > 0 ? { late: humanizeMinutes(lateMinutes) } : {}),
          createdBy: {
            name: `${createdByDetails.first_name??createdByDetails.first_name} ${createdByDetails.last_name??createdByDetails.last_name}`,
            role: createdByDetails.role??createdByDetails.role,
          },  
          editedBy: {
            name: `${editedByDetails.first_name??editedByDetails.first_name} ${editedByDetails.last_name??editedByDetails.last_name}`,
            role: editedByDetails.role??editedByDetails.role,
          
          },
        };
      })
    );

    res.status(200).json({
      message: "All attendance records fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// controller
const getAttendanceByEmployee = async (req, res) => {
  const { employeeId } = req.params;
  try {
    const attendanceRecords = await Attendance.find({ employeeId })
      .sort({ date: -1 })
      .lean();

    if (attendanceRecords.length === 0) {
      return res.status(404).json({ message: "No attendance records found" });
    }

    const result = attendanceRecords.map((row) => {
      const { _id, date, clockIn, clockOut, status, sessions } = row;

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
    console.log(
      attendanceId,
      clockIn,
      clockOut,
      status,
      reason,
      LoggedOut,
      userId,
      inAt,
      outAt
    );
    // Guardrails: out must be after in when both supplied
    if (inAt && outAt && outAt < inAt) {
      return res
        .status(400)
        .json({ message: "clockOut cannot be earlier than clockIn" });
    }

    // === 1) Explicit logout flow ===
    if (LoggedOut && outAt) {
      console.log("kjdk");
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
      console.log("dffdfd");
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
      console.log(punched);

      const attendanceObj = punched.toObject();

      // Calculate total worked minutes from sessions
      console.log(attendanceObj);
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
      console.log(workedMinutes);
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
      console.log("jkjkj");

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

export {
  createAttendance,
  getAllAttendance,
  getAttendanceByEmployee,
  editAttendance,
  deleteAttendance,
  getUserAttendanceByDate,
};
