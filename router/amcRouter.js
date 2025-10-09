// src/routes/amcRoutes.js

import express from 'express';
import * as amcController from "../controller/amc.controller.js";

const router = express.Router();

// The base route is configured as '/api/amcInfo' in server.js.

// 1. Dropdown Data Endpoints (GET requests for fetching entities)
// These will map to:
// GET /api/amcInfo/dealers
// GET /api/amcInfo/customers
router.get('/dealers', amcController.getDealers);
router.get('/customers', amcController.getCustomers);

// ---------------------------------------------------------------------

// 2. AMC CRUD Endpoints
// These will map to:
// GET /api/amcInfo   (Get all AMC List)
// POST /api/amcInfo  (Create New AMC)
// PUT /api/amcInfo/:id (Update existing AMC)
router.get('/', amcController.getAmcList);
router.post('/', amcController.createAmc);
router.put('/:id', amcController.updateAmc);

// NOTE: We should also add a route for DELETE operations for completeness.
// router.delete('/:id', amcController.deleteAmc); 

export default router;