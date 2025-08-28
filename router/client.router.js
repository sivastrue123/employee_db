// src/routes/client.routes.js
import express from "express";
import {
  createClient,
  getAllClients,
} from "../controller/client.controller.js";
import {
  createTask,
  deleteTask,
  getTasksByClient,
  updateTask,
} from "../controller/task.controller.js";

const router = express.Router();

// POST /clients
router.post("/createClient", createClient);
router.post("/:clientId/createTask", createTask);
router.get("/getAllClient", getAllClients);
router.get("/:clientId/getAllTasks", getTasksByClient);
router.patch("/:clientId/task/:taskId/updateTask", updateTask);
router.delete("/:clientId/task/:taskId/deleteTask", deleteTask);
export default router;
