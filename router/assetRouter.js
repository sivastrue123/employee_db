// router/assetRouter.js

import express from "express";
import * as assetController from "../controller/asset.controller.js";

const router = express.Router();

// Base path will be /api/asset

router.get("/", assetController.getAssets);
router.get("/search", assetController.getAssetssearch);
router.post("/", assetController.createAsset);
router.put("/:id", assetController.updateAsset);
router.get("/get/:id", assetController.getAssetsUser);


// OPTIONAL - get history for one asset
router.get("/history/:id", assetController.getAssetHistory);

export default router;
