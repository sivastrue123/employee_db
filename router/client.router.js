// src/routes/client.routes.js
import express from 'express';
import { createClient } from '../controller/client.controller.js';

const router = express.Router();

// POST /clients
router.post('/createClient', createClient);

export default router;
