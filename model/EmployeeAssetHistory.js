// model/EmployeeAssetHistory.js

import mongoose from "mongoose";

const EmployeeAssetHistorySchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: "AssetInfo", required: true },
    previousData: { type: Object, required: true },
    changedAt: { type: Date, default: Date.now },
    updatedBy: { type: String, default: null }
  },
  {
    timestamps: true,
  }
);

export const EmployeeAssetHistory = mongoose.model(
  "EmployeeAssetHistory",
  EmployeeAssetHistorySchema
);
