import { Router } from "express";
import {
  CreateEmployee,
  editEmployee,
  getAllEmployee,
} from "../controller/employee.controller.js";
const router = Router();

router.post("/addEmployee", CreateEmployee);
router.get("/getAllEmployee", getAllEmployee);
router.patch("/editEmployee/:employee_id", editEmployee);
export default router;
