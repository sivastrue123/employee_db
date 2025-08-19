import Attendance from "../model/attendance.model.js";

const IST_TZ = "Asia/Kolkata";

const dtfDate = new Intl.DateTimeFormat("en-CA", {
  // en-CA => YYYY-MM-DD
  timeZone: IST_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dtfTime = new Intl.DateTimeFormat("en-GB", {
  // 24h HH:mm
  timeZone: IST_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function getISTParts(d) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const Y = Number(lookup.year);
  const M = Number(lookup.month);
  const D = Number(lookup.day);
  const h = Number(lookup.hour);
  const m = Number(lookup.minute);
  return { Y, M, D, h, m };
}

// Helper: IST "minutes since midnight"
function minutesSinceMidnightIST(d) {
  const { h, m } = getISTParts(d);
  return h * 60 + m;
}

// Helper: format "H.MM" where minutes are two digits (e.g., 30 => ".30")
function formatHMdotMM(totalMinutes) {
  if (totalMinutes <= 0 || !Number.isFinite(totalMinutes)) return "0.00";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}.${m.toString().padStart(2, "0")}`;
}

function formatDateIST(d) {
  // en-CA with IST yields YYYY-MM-DD
  return dtfDate.format(d);
}

function formatTimeIST(d) {
  if (!d) return "";
  return dtfTime.format(d); // "HH:mm"
}

// Business rules
const START_MIN = 9 * 60 + 30; // 09:30 IST
const END_MIN = 19 * 60 + 30; // 19:30 IST

// Map backend status -> frontend status
function mapStatusToFront(status, clockIn) {
  // Treat Absent/On Leave as Absent, everything else as Present
  if (status === "Absent" || status === "On Leave") return "Absent";
  // Fallback: if no clockIn and status unknown, consider Absent
  if (!clockIn) return "Absent";
  return "Present";
}
const createAttendance = async (req, res) => {
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
      return res.status(409).json({
        message: "Attendance for this employee on this date already exists",
      });
    }

    const newAttendance = new Attendance({
      employeeId,
      date,
      clockIn,
      clockOut,
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

    res.status(200).json({
      message: "Attendance record fetched successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Error fetching attendance record:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getAllAttendance = async (req, res) => {
  try {
    const allAttendance = await Attendance.find()
      .populate("createdBy", "first_name last_name")
      .sort({ date: -1 });

    res.status(200).json({
      message: "All attendance records fetched successfully",
      data: allAttendance,
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

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
      const { _id, date, clockIn, clockOut, status } = row;

      const attendanceDate = formatDateIST(date);

      let lateMinutes = 0;
      if (clockIn) {
        const minIn = minutesSinceMidnightIST(clockIn);
        if (minIn > START_MIN) lateMinutes = minIn - START_MIN; // late
      }

      let otMinutes = 0;
      if (clockOut) {
        const minOut = minutesSinceMidnightIST(clockOut);
        if (minOut > END_MIN) otMinutes = minOut - END_MIN; // overtime
      }

      const feStatus = mapStatusToFront(status, clockIn ?? null);

      return {
        id: String(_id),
        attendanceDate,
        clockIn: formatTimeIST(clockIn ?? null), // "" if null
        clockOut: formatTimeIST(clockOut ?? null), // "" if null
        ot: formatHMdotMM(otMinutes),
        status: feStatus,
        ...(lateMinutes > 0 ? { late: formatHMdotMM(lateMinutes) } : {}),
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

  try {
    if (!attendanceId) {
      return res.status(400).json({ message: "Attendance ID is required" });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    attendance.clockIn = clockIn || attendance.clockIn;
    attendance.clockOut = clockOut || attendance.clockOut;
    attendance.status = status || attendance.status;
    attendance.reason = reason || attendance.reason;
    attendance.EditedBy = req.query._id;
    attendance.EditedAt = Date.now();

    await attendance.save();
    res.status(200).json({
      message: "Attendance updated successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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
