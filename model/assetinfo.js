// model/assetinfo.js

import mongoose from "mongoose";

const AssetInfoSchema = new mongoose.Schema(
    {
        employeeId: { type: String, required: true },
        employeeName: { type: String, required: true },

        computerName: { type: String, default: "" },
        ram: { type: String, default: "" },
        deviceId: { type: String, default: "" },
        graphicsCard: { type: String, default: "" },
        processor: { type: String, default: "" },
        os: { type: String, default: "" },
        osVersion: { type: String, default: "" },
        storageDrives: { type: String, default: "" },
        ssd: { type: String, default: "" },
        ssdStorage: { type: String, default: "" },
        fromDate: { type: Date },
        remarks: { type: String, default: "" },
        computerUsername: { type: String, default: "" },
        computerPassword: { type: String, default: "" },
        lockerKey: { type: String, default: "" },
        createdBy: { type: String, default: null },
        updatedBy: { type: String, default: null },
        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date, default: null },
        sim: { type: Boolean, default: false },
        mouse: { type: Boolean, default: false },
        bag: { type: Boolean, default: false }, simNumber: { type: String, default: "" },
    },
    {
        timestamps: true,
    }
);

export const AssetInfo = mongoose.model("AssetInfo", AssetInfoSchema);
