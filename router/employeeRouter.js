import { Router } from "express";
import {
  CreateEmployee,
  getAllEmployee,
} from "../controller/employee.controller.js";
const router = Router();

router.post("/addEmployee", CreateEmployee);
router.get("/getAllEmployee", getAllEmployee);

export default router;
