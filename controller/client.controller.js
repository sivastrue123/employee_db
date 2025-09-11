// src/controllers/client.controller.js
import { ClientModel } from "../model/client.model.js";
import { ensureActiveEmployeeOr400 } from "../utils/employee.utils.js";
import { validateClientCreate } from "../utils/validation.utils.js";
import {
  normalizeClientCreate,
  validateClientUpdate,
  normalizeClientUpdate,
} from "../utils/normalize.utils.js";
import { badRequest } from "../utils/http.utils.js";
import { buildAuditOptions } from "../utils/audit.plugin.js";
import mongoose from "mongoose";
import { getPagination } from "../utils/pagination.js";
import { Notes } from "../model/notes.model.js";
// import { getSort } from "../utils/pagination.js";
// import { buildClientSearchFilter } from "../utils/pagination.js";

export async function createClient(req, res, next) {
  try {
    const { name, owner, team, tags, progress, status, dueDate } = req.body;
    const { userId: actorId } = req.query; // creator’s employee_id

    // actor required at create time
    if (!actorId)
      return badRequest(
        res,
        "Actor (query param 'userId' = employee_id) is required"
      );

    // payload validation
    const errors = validateClientCreate({
      name,
      owner,
      team,
      tags,
      progress,
      status,
      dueDate,
    });
    if (errors.length) return badRequest(res, errors);

    // employee validations (owner + actor must be active)
    if (!(await ensureActiveEmployeeOr400(res, actorId, "Actor"))) return;
    if (!(await ensureActiveEmployeeOr400(res, owner, "Owner"))) return;

    // normalize & persist
    const doc = normalizeClientCreate(
      { name, owner, team, tags, progress, status, dueDate },
      actorId
    );
    const client = new ClientModel(doc);

    const saved = await client.save(buildAuditOptions(req, actorId));
    return res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
}

export async function getAllClients(req, res, next) {
  try {
    const { page, pageSize, skip } = getPagination(req.query);

    // sorting allowlist
    const sortKey = String(req.query.sortBy || "").toLowerCase();
    const dir =
      String(req.query.sortDir || "asc").toLowerCase() === "desc" ? -1 : 1;
    const SORT_MAP = {
      client: "name",
      owner: "ownerName",
      progress: "progress",
      duedate: "dueDate",
    };
    const sortField = SORT_MAP[sortKey] || "dueDate";

    // unified search across client name, owner first/last/email, and tags
    const q = (req.query.q || "").trim();
    const textOr = [];
    if (q) {
      const regex = new RegExp(q, "i");
      textOr.push(
        { name: regex }, // client name
        { "ownerDoc.first_name": regex }, // owner first
        { "ownerDoc.last_name": regex }, // owner last
        { "ownerDoc.email": regex }, // owner email
        { tags: regex } // any tag match
      );
    }

    // compute “now” and 14-day horizon once
    const now = new Date();
    const horizon14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: { deletedAt: null } },

      // join owner by employee_id
      {
        $lookup: {
          from: "employees",
          localField: "owner",
          foreignField: "employee_id",
          as: "ownerDoc",
        },
      },
      { $unwind: { path: "$ownerDoc", preserveNullAndEmptyArrays: true } },

      // computed owner full name (for sort) + KPI booleans
      {
        $addFields: {
          ownerName: {
            $trim: {
              input: {
                $concat: ["$ownerDoc.first_name", " ", "$ownerDoc.last_name"],
              },
            },
          },
          // KPI helpers
          _isCompletedOrArchived: {
            $in: ["$status", ["COMPLETED", "ARCHIVED"]],
          },
          _isDueIn14: {
            $and: [
              { $ne: ["$dueDate", null] },
              { $gte: ["$dueDate", now] },
              { $lte: ["$dueDate", horizon14] },
              { $not: [{ $in: ["$status", ["COMPLETED", "ARCHIVED"]] }] },
            ],
          },
        },
      },

      // apply unified search (if provided)
      ...(textOr.length ? [{ $match: { $or: textOr } }] : []),

      // compute final at-risk flag
      {
        $addFields: {
          _atRisk: {
            $or: [
              { $eq: ["$status", "BLOCKED"] },
              {
                $and: [
                  { $eq: ["$_isDueIn14", true] },
                  { $lt: ["$progress", 50] },
                ],
              }, // tweak threshold as needed
            ],
          },
        },
      },

      // facet: items page + total + KPI counts
      {
        $facet: {
          items: [
            { $sort: { [sortField]: dir, _id: 1 } },
            { $skip: skip },
            { $limit: pageSize },
            {
              $project: {
                _id: 1,
                name: 1,
                owner: 1,
                team: 1,
                tags: 1,
                progress: 1,
                status: 1,
                dueDate: 1,
                createdAt: 1,
                updatedAt: 1,
                ownerDetails: {
                  employee_id: "$ownerDoc.employee_id",
                  first_name: "$ownerDoc.first_name",
                  last_name: "$ownerDoc.last_name",
                  email: "$ownerDoc.email",
                  department: "$ownerDoc.department",
                  position: "$ownerDoc.position",
                  status: "$ownerDoc.status",
                  phone: "$ownerDoc.phone",
                  profile_image: "$ownerDoc.profile_image",
                },
              },
            },
          ],
          meta: [{ $count: "total" }],
          kpis: [
            {
              $group: {
                _id: null,
                totalClients: { $sum: 1 }, // after current filters
                dueIn14Days: { $sum: { $cond: ["$_isDueIn14", 1, 0] } },
                atRiskClients: { $sum: { $cond: ["$_atRisk", 1, 0] } },
              },
            },
          ],
        },
      },

      // final shape
      {
        $project: {
          items: 1,
          total: { $ifNull: [{ $arrayElemAt: ["$meta.total", 0] }, 0] },
          kpis: {
            $ifNull: [
              { $arrayElemAt: ["$kpis", 0] },
              { totalClients: 0, dueIn14Days: 0, atRiskClients: 0 },
            ],
          },
        },
      },
    ];

    const [result] = await ClientModel.aggregate(pipeline).collation({
      locale: "en",
      strength: 2,
    });
    const items = result?.items ?? [];
    const total = result?.total ?? 0;
    const {
      totalClients = 0,
      dueIn14Days = 0,
      atRiskClients = 0,
    } = result?.kpis ?? {};

    return res.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      sort: { [sortField]: dir },
      filterApplied: { q },
      // 🎯 Dashboard KPIs (respect current q filter)
      metrics: {
        totalClients,
        dueIn14Days,
        atRiskClients,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateClient(req, res, next) {
  try {
    const { clientId } = req.params; // Client _id
    const { userId: actorId } = req.query; // actor’s employee_id (required)
    const {
      name,
      owner,
      team,
      tags,
      progress,
      status,
      dueDate,
      version, // optional optimistic concurrency token from client
    } = req.body;

    if (!actorId) {
      return badRequest(
        res,
        "Actor (query param 'userId' = employee_id) is required"
      );
    }

    // Validate payload (partial)
    const errors = validateClientUpdate({
      name,
      owner,
      team,
      tags,
      progress,
      status,
      dueDate,
      version,
    });
    if (errors.length) return badRequest(res, errors);

    // If we’re changing the owner, ensure the new owner is active
    if (owner && !(await ensureActiveEmployeeOr400(res, owner, "Owner")))
      return;

    // Ensure actor is active
    if (!(await ensureActiveEmployeeOr400(res, actorId, "Actor"))) return;

    // Normalize the delta
    const delta = normalizeClientUpdate(
      {
        name,
        owner,
        team,
        tags,
        progress,
        status,
        dueDate,
      },
      actorId
    );

    // Build query to avoid updating soft-deleted docs
    const query = { _id: clientId, deletedAt: null };

    // If client sent a version, use it for optimistic concurrency at query-time
    if (typeof version === "number") {
      query.version = version;
    }

    // Apply update
    const updated = await ClientModel.findOneAndUpdate(
      query,
      { $set: delta },
      {
        new: true,
        runValidators: true, // enforce schema (enum/min/max) on update
        // Note: Schema-level optimisticConcurrency handles doc.save(); for FUA we guard via version in query
      }
    ).setOptions(buildAuditOptions(req, actorId)); // preserve your audit headers / metadata
    console.log(updated);
    if (!updated) {
      // Either not found, soft-deleted, or version mismatch
      return res.status(400).json({ message: "updation failed" });
    }

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function createNotes(req, res, next) {
  try {
    const { clientId, title, text } = req.body;
    const { userId } = req.query;

    // -------- Validation Layer
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: "Invalid or missing clientId" });
    }
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ message: "Notes title is required" });
    }
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ message: "Notes text is required" });
    }
    if (!userId) {
      return res.status(400).json({ message: "Missing userId in query" });
    }

    // -------- Persist Layer
    const note = new Notes({
      clientId,
      title: title,
      notes: text.trim(),
      createdBy: userId,
    });

    await note.save();

    return res.status(201).json({
      message: "Note created successfully",
      data: note,
    });
  } catch (error) {
    console.error("Error creating note:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getNotesByClient(req, res) {
  try {
    const {
      clientId,
      page = "1",
      limit = "20",
      sort = "createdAt:desc",
      includeDeleted = "false",
      q, // optional text search
    } = req.query;

    // ---------- Guardrails
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: "Invalid or missing clientId" });
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100); // cap to avoid abuse
    const skip = (pageNum - 1) * limitNum;

    // sort syntax: field:direction (e.g., createdAt:desc)
    const [sortField = "createdAt", sortDirRaw = "desc"] =
      String(sort).split(":");
    const sortDir = sortDirRaw.toLowerCase() === "asc" ? 1 : -1;

    // ---------- Query Fabric
    const filter = {
      clientId: new mongoose.Types.ObjectId(clientId),
      ...(includeDeleted === "true" ? {} : { isDeleted: { $ne: true } }),
      ...(q
        ? {
            $or: [
              { title: { $regex: q, $options: "i" } }, // title search ✅
              { notes: { $regex: q, $options: "i" } }, // optional: body search
            ],
          }
        : {}),
    };

    // ---------- Data Plane (parallelized for throughput)
    const [items, total] = await Promise.all([
      Notes.find(filter)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .populate({
          path: "createdByUser",
          select: "employee_id first_name last_name      ",
          match: { isDeleted: { $ne: true } }, // don't hydrate deleted employees
        })
        .lean({ virtuals: true }),
      Notes.countDocuments(filter),
    ]);

    // ---------- Response Contract
    return res.status(200).json({
      items,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
        sort: { field: sortField, direction: sortDir === 1 ? "asc" : "desc" },
        includeDeleted: includeDeleted === "true",
        query: q || null,
      },
    });
  } catch (error) {
    console.error("Error fetching notes by client:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateNote(req, res) {
  try {
    const { noteId } = req.params;
    const { userId } = req.query;
    const { title, text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Invalid note id" });
    }
    if (!userId) {
      return res.status(400).json({ message: "Missing userId in query" });
    }
    if (typeof title === "undefined" && typeof text === "undefined") {
      return res.status(400).json({ message: "No fields to update" });
    }

    const $set = { updatedBy: userId };
    if (typeof title !== "undefined") $set.title = String(title);
    if (typeof text !== "undefined") $set.notes = String(text);

    const updated = await Notes.findOneAndUpdate(
      { _id: noteId, isDeleted: { $ne: true } },
      { $set },
      { new: true, runValidators: true }
    )
      .populate({
        path: "createdByUser",
        select:
          "employee_id first_name last_name email department position status phone profile_image",
        match: { isDeleted: { $ne: true } },
      })
      .lean({ virtuals: true });

    if (!updated) {
      return res.status(404).json({ message: "Note not found" });
    }

    // normalize createdBy
    const u = updated.createdByUser;
    const createdBy = u
      ? {
          employee_id: u.employee_id,
          first_name: u.first_name,
          last_name: u.last_name,
          email: u.email,
          department: u.department,
          position: u.position,
          status: u.status,
          phone: u.phone,
          profile_image: u.profile_image,
        }
      : null;
    const { createdByUser, ...rest } = updated;

    return res
      .status(200)
      .json({ message: "Note updated", data: { ...rest, createdBy } });
  } catch (e) {
    console.error("Error updating note:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
}
