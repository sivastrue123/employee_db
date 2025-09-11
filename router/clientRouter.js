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

const router = express.Router();

router.post("/createClient", createClient);
router.post("/note", createNotes);
router.patch("/note/:noteId",updateNote)
router.get("/note", getNotesByClient);
router.patch("/:clientId/updateClient", updateClient);
router.post("/:clientId/createTask", createTask);
router.get("/getAllClient", getAllClients);
router.get("/:clientId/getAllTasks", getTasksByClient);
router.patch("/:clientId/task/:taskId/updateTask", updateTask);
router.delete("/:clientId/task/:taskId/deleteTask", deleteTask);
export default router;
