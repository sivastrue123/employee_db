import { Router } from "express";
import {
  createAttendance,
  getAllAttendance,
  getAttendanceByEmployee,
  editAttendance,
  deleteAttendance,
} from "../controller/attendance.controller.js";

const router = Router();

router.post("/createAttendance", createAttendance);
router.get("/getAllAttendance", getAllAttendance);
router.get(
  "/getAttendanceByEmployee/employee/:employeeId",
  getAttendanceByEmployee
);
router.put("/editAttendance/:id", editAttendance);
router.delete("/deleteAttendance/:id", deleteAttendance);

export default router;
