import { Router } from "express";
import {
  checkEmail,
  createEmployee,
  editEmployee,
  getAllEmployee,
  getDashboardData,
} from "../controller/employee.controller.js";
import { checkSubscription } from "../middleware/checkSubscription.js";
const router = Router();

router.post("/addEmployee", createEmployee);
router.get("/getAllEmployee", getAllEmployee);
router.patch("/editEmployee/:empId", editEmployee);
router.get("/checkEmail", checkSubscription, checkEmail);
router.get("/getDashboardData", getDashboardData);
export default router;
