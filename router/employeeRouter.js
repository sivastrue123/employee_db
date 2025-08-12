import { Router } from "express";
import { CreateEmployee } from "../controller/employee.controller.js";
const router = Router();

router.post("/addEmployee", CreateEmployee);


export default router;
