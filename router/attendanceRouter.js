import { Router } from "express";
import {
  createAttendance,
  getAllAttendance,
  getAttendanceByEmployee,
  editAttendance,
  deleteAttendance,
  getUserAttendanceByDate,
  createBulkAttendanceAction,
} from "../controller/attendance.controller.js";

const router = Router();

router.post("/createAttendance", createAttendance, editAttendance);
router.get("/getAllAttendance", getAllAttendance);
router.get("/getAttendanceByEmployee", getAttendanceByEmployee);
router.put("/editAttendance/:attendanceId", editAttendance);
router.delete("/deleteAttendance/:attendanceId", deleteAttendance);
router.get("/getUserAttendanceByDate", getUserAttendanceByDate);
router.post("/MoreActions/:userId", createBulkAttendanceAction);
export default router;
