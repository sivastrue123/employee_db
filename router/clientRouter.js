// src/routes/client.routes.js
import express from "express";
import {
  createClient,
  createNotes,
  getAllClients,
  getNotesByClient,
  updateClient,
  updateNote,
} from "../controller/client.controller.js";
import {
  createTask,
  deleteTask,
  getTasksByClient,
  updateTask,
} from "../controller/task.controller.js";

import { notifyOnTaskCreated,notifyOnTaskUpdated } from "../middleware/taskPushNotifications.js";
const router = express.Router();

router.post("/createClient", createClient);
router.post("/note", createNotes);
router.patch("/note/:noteId",updateNote)
router.get("/note", getNotesByClient);
router.patch("/:clientId/updateClient", updateClient);
router.post("/:clientId/createTask", notifyOnTaskCreated(),createTask);
router.get("/getAllClient", getAllClients);
router.get("/:clientId/getAllTasks", getTasksByClient);
router.patch("/:clientId/task/:taskId/updateTask", notifyOnTaskUpdated(),updateTask);
router.delete("/:clientId/task/:taskId/deleteTask", deleteTask);
export default router;
