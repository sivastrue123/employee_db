import Attendance from "../model/attendance.model.js";


const createAttendance = async (req, res) => {

    const { employeeId, date, clockIn, clockOut, status, reason } = req.body;
    try {
        if (!employeeId || !date || !status) {
            return res.status(400).json({ message: "Employee, date, and status are required" });
        }

        const existingAttendance = await Attendance.findOne({ employeeId, date });
        if (existingAttendance) {
            return res.status(409).json({ message: "Attendance for this employee on this date already exists" });
        }

        const newAttendance = new Attendance({
            employeeId,
            date,
            clockIn,
            clockOut,
            status,
            createdBy: req.user._id, 
            reason
        });

        await newAttendance.save();
        res.status(201).json({ message: "Attendance created successfully", data: newAttendance });
    } catch (error) {
        console.error("Error creating attendance:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
}