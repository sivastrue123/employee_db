import { Router } from "express";
import { insertWorklog, getAllWorklogs } from "../controller/worklog.controller.js";

const router = Router();

// Create (insert)
router.post("/submitDaily", insertWorklog);

// Read (get all, with optional filters)
router.get("/", getAllWorklogs);

export default router;
