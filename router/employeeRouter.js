import { Router } from "express";
import {
  createEmployee,
  editEmployee,
  getAllEmployee,
} from "../controller/employee.controller.js";
const router = Router();

router.post("/addEmployee", createEmployee);
router.get("/getAllEmployee", getAllEmployee);
router.patch("/editEmployee/:employee_id", editEmployee);
export default router;
