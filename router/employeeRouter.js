import { Router } from "express";
import {
  checkEmail,
  createEmployee,
  editEmployee,
  getAllEmployee,
  getDashboardData
} from "../controller/employee.controller.js";
const router = Router();

router.post("/addEmployee", createEmployee);
router.get("/getAllEmployee", getAllEmployee);
router.patch("/editEmployee/:empId", editEmployee);
router.get("/checkEmail", checkEmail);
router.get("/getDashboardData",getDashboardData)
export default router;
