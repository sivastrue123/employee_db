// controller/asset.controller.js

import { AssetInfo } from "../model/assetinfo.js";
import { EmployeeAssetHistory } from "../model/EmployeeAssetHistory.js";

// =======================================================
// CREATE ASSET
// =======================================================
export const createAsset = async (req, res) => {
    try {
        // 1️⃣ Create the asset
        const newAsset = await AssetInfo.create({
            ...req.body,
            createdBy: req.body.createdBy || null,
            updatedBy: req.body.createdBy || null, // initial updatedBy
        });

        // 2️⃣ Log initial history (for creation)
        await EmployeeAssetHistory.create({
            assetId: newAsset._id,
            previousData: newAsset.toObject(), // store created data as "previousData"
            updatedBy: req.body.createdBy || null,
            action: "create", // optional, to differentiate from updates
        });

        res.status(201).json({
            message: "Asset created successfully",
            data: newAsset,
        });
    } catch (error) {
        console.error("Error creating asset:", error);
        res.status(400).json({
            message: "Failed to create asset.",
            error: error.message,
        });
    }
};

// =======================================================
// UPDATE ASSET + STORE OLD DATA IN HISTORY
// =======================================================
export const updateAsset = async (req, res) => {
    try {
        const assetId = req.params.id;

        // const existingAsset = await AssetInfo.findById(assetId);

        // if (!existingAsset) {
        //     return res.status(404).json({ message: "Asset not found." });
        // }
        const updatedAsset = await AssetInfo.findByIdAndUpdate(
            assetId,
            { ...req.body, updatedBy: req.body.updatedBy || null },
            { new: true }
        );
        // 1️⃣ Log old data before updating
        await EmployeeAssetHistory.create({
            assetId,
            previousData: updatedAsset.toObject(),
            updatedBy: req.body.updatedBy || null,
            action: "update", // optional, for history type
        });

        // 2️⃣ Update asset


        res.status(200).json({
            message: "Asset updated successfully",
            data: updatedAsset,
        });
    } catch (error) {
        console.error("Error updating asset:", error);
        res.status(400).json({
            message: "Failed to update asset.",
            error: error.message,
        });
    }
};

// =======================================================
// GET ASSET LIST
// =======================================================
// GET /api/asset?limit=5&page=1
export const getAssets = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit ) || 5;
        const page = parseInt(req.query.page ) || 1;
        const skip = (page - 1) * limit;

        const list = await AssetInfo.find({ isDeleted: false })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await AssetInfo.countDocuments({ isDeleted: false });

        res.status(200).json({
            data: list,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error("Error fetching assets:", error);
        res.status(500).json({ message: "Failed to fetch assets." });
    }
};
export const getAssetssearch = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search?.trim() || "";
        const skip = (page - 1) * limit;

        // Base filter
        let filter = { isDeleted: false };

        // If search key exists, add OR search condition
        if (search) {
            filter = {
                ...filter,
                $or: [
                    { employeeId: { $regex: search, $options: "i" } },
                    { employeeName: { $regex: search, $options: "i" } },
                    // add more fields if needed:
                    // { computerName: { $regex: search, $options: "i" } },
                ]
            };
        }

        const list = await AssetInfo.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await AssetInfo.countDocuments(filter);

        res.status(200).json({
            data: list,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });

    } catch (error) {
        console.error("Error fetching assets:", error);
        res.status(500).json({ 
            message: "Failed to fetch assets." 
        });
    }
};

export const getAssetsUser = async (req, res) => {
      const id = req.query.id; 
    try {
        const list = await AssetInfo.find({ isDeleted: false, employeeId: id }).sort({ createdAt: -1 });

        res.status(200).json(list);
    } catch (error) {
        console.error("Error fetching assets:", error);
        res.status(500).json({
            message: "Failed to fetch assets.",
        });
    }
};

// =======================================================
// OPTIONAL: GET HISTORY OF ONE ASSET
// =======================================================
export const getAssetHistory = async (req, res) => {
    try {
        const assetId = req.params.id;
        const history = await EmployeeAssetHistory.find({ assetId }).sort({ changedAt: -1 });

        res.status(200).json(history);
    } catch (error) {
        console.error("Error fetching asset history:", error);
        res.status(500).json({
            message: "Failed to fetch history.",
        });
    }
};
