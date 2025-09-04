// src/routes/client.routes.js
import express from "express";
import {
  createClient,
  getAllClients,
  updateClient,
} from "../controller/client.controller.js";
import {
  createTask,
  deleteTask,
  getTasksByClient,
  updateTask,
} from "../controller/task.controller.js";

const router = express.Router();

router.post("/createClient", createClient);
router.patch("/:clientId/updateClient",updateClient)
router.post("/:clientId/createTask", createTask);
router.get("/getAllClient", getAllClients);
router.get("/:clientId/getAllTasks", getTasksByClient);
router.patch("/:clientId/task/:taskId/updateTask", updateTask);
router.delete("/:clientId/task/:taskId/deleteTask", deleteTask);
export default router;
