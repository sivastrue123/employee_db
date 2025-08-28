// src/routes/client.routes.js
import express from "express";
import {
  createClient,
  getAllClients,
} from "../controller/client.controller.js";
import { createTask, getTasksByClient } from "../controller/task.controller.js";

const router = express.Router();

// POST /clients
router.post("/createClient", createClient);
router.post("/:clientId/createTask", createTask);
router.get("/getAllClient", getAllClients);
router.get("/:clientId/getAllTasks",getTasksByClient)
export default router;
