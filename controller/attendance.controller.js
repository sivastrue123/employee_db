import Attendance from "../model/attendance.model.js";
// helpers (IST)
// helpers (same as before)
const IST_TZ = "Asia/Kolkata";

const dtfDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dtfTime12 = new Intl.DateTimeFormat("en-US", {
  timeZone: IST_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatDateIST(d) {
  return dtfDate.format(new Date(d));
}
function formatTimeIST12(d) {
  if (!d) return "";
  return dtfTime12.format(new Date(d)).replace("AM", "am").replace("PM", "pm");
}
function getISTParts(d) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(d));
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { h: Number(obj.hour), m: Number(obj.minute) };
}
function minutesSinceMidnightIST(d) {
  const { h, m } = getISTParts(d);
  return h * 60 + m;
}
function humanizeMinutes(mins) {
  if (!mins || mins <= 0) return "0 hrs";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} ${h === 1 ? "hr" : "hrs"}`;
  if (h === 0) return `${m} mins`;
  return `${h} ${h === 1 ? "hr" : "hrs"} ${m} mins`;
}
function mapStatusToFront(status, clockIn) {
  if (status === "Absent" || status === "On Leave") return "Absent";
  if (!clockIn) return "Absent";
  return "Present";
}

// 9:30 AM cutoff for late
const START_MIN = 9 * 60 + 30;

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
      const { _id, date, clockIn, clockOut, status } = row;

      const attendanceDate = formatDateIST(date);

      // Late (after 09:30 IST)
      let lateMinutes = 0;
      if (clockIn) {
        const minIn = minutesSinceMidnightIST(clockIn);
        if (minIn > START_MIN) lateMinutes = minIn - START_MIN;
      }

      // Total working time (only if both exist)
      let otMinutes = 0;
      if (clockIn && clockOut) {
        const minIn = minutesSinceMidnightIST(clockIn);
        const minOut = minutesSinceMidnightIST(clockOut);

        let worked = minOut - minIn;
        if (worked > 600) {
          // more than 10 hours
          otMinutes = worked - 600;
        }
      }

      const feStatus = mapStatusToFront(status, clockIn ?? null);

      return {
        id: String(_id),
        attendanceDate,
        clockIn: formatTimeIST12(clockIn ?? null),
        clockOut: formatTimeIST12(clockOut ?? null),
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
