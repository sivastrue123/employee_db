import { Router } from "express";
import {
  createAttendance,
  getAllAttendance,
  getAttendanceByEmployee,
  editAttendance,
  deleteAttendance,
  getUserAttendanceByDate,
  createBulkAttendanceAction,
  updateOTStatus,
} from "../controller/attendance.controller.js";
import { OnLeaveNotification } from "./webPush.js";
const router = Router();

router.post("/createAttendance", createAttendance, editAttendance);
router.get("/getAllAttendance", getAllAttendance);
router.get("/getAttendanceByEmployee", getAttendanceByEmployee);
router.put("/editAttendance/:attendanceId", editAttendance);
router.patch("/editAttendance/:attendanceId/ot-status", updateOTStatus);
router.delete("/deleteAttendance/:attendanceId", deleteAttendance);
router.get("/getUserAttendanceByDate", getUserAttendanceByDate);
router.post("/MoreActions/:userId", createBulkAttendanceAction,OnLeaveNotification);
export default router;
