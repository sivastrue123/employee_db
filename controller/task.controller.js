// src/controllers/task.controller.js
import { TaskModel } from '../model/task.model.js';
import { validateTaskCreate } from '../utils/validation.utils.js';
import { normalizeTaskCreate } from '../utils/normalize.utils.js';
import { ensureActiveEmployeeOr400 } from '../utils/employee.utils.js';
import { ensureActiveEmployeesOr400 } from '../utils/projectWithTask.js';
import { ensureClientExistsAndNotDeletedOr404 } from '../utils/projectWithTask.js';
import { badRequest } from '../utils/http.utils.js';
import { buildAuditOptions } from '../utils/audit.plugin.js';
import { getPagination } from '../utils/pagination.js';
import mongoose from 'mongoose';
export async function createTask(req, res, next) {
  try {
    const { clientId } = req.params;                // POST /clients/:clientId/tasks
    const { userId: actorId } = req.query;          // creator’s employee_id
    const body = req.body;

    // actor required
    if (!actorId) return badRequest(res, "Actor (query param 'userId' = employee_id) is required");

    // validate client exists & not deleted
    if (!await ensureClientExistsAndNotDeletedOr404(res, clientId)) return;

    // payload validation
    const errors = validateTaskCreate(body);
    if (errors.length) return badRequest(res, errors);

    // actor must be active
    if (!await ensureActiveEmployeeOr400(res, actorId, 'Actor')) return;

    // assignee set must all be active
    if (!(await ensureActiveEmployeesOr400(res, body.assigneeEmployeeIds))) return;

    // normalize & persist
    const doc = normalizeTaskCreate(body, clientId, actorId);
    const task = new TaskModel(doc);

    const saved = await task.save(buildAuditOptions(req, actorId));
    return res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
}





export async function getTasksByClient(req, res, next) {
  try {
    const { clientId } = req.params;
    if (!mongoose.isValidObjectId(clientId)) {
      return res.status(400).json({ error: 'Invalid clientId' });
    }

    const { page, pageSize, skip } = getPagination(req.query);

    // Sorting allowlist
    const sortKey = String(req.query.sortBy || '').toLowerCase();
    const dir = String(req.query.sortDir || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    const SORT_MAP = {
      title: 'title',
      priority: 'priority',
      status: 'status',
      duedate: 'dueDate',
      startdate: 'startDate',
    };
    const sortField = SORT_MAP[sortKey] || 'dueDate';

    // Optional filters (status, priority) — safe defaults
    const status = req.query.status;
    const priority = req.query.priority;

    // Unified search across title/description/checklist + assignee names/emails
    const q = (req.query.q || '').trim();
    const textOr = [];
    if (q) {
      const regex = new RegExp(q, 'i');
      textOr.push(
        { title: regex },
        { description: regex },
        { 'checklist.label': regex },
        { 'assignees.first_name': regex },
        { 'assignees.last_name': regex },
        { 'assignees.email': regex },
      );
    }

    const matchStage = {
      clientId: new mongoose.Types.ObjectId(clientId),
      deletedAt: null,
    };
    if (status) matchStage.status = status;
    if (priority) matchStage.priority = priority;

    const pipeline = [
      { $match: matchStage },

      // Hydrate assignees by employee_id ∈ assigneeEmployeeIds
      {
        $lookup: {
          from: 'employees',
          let: { ids: '$assigneeEmployeeIds' },
          pipeline: [
            { $match: { $expr: { $in: ['$employee_id', '$$ids'] } } },
            { $project: {
                _id: 0,
                employee_id: 1,
                first_name: 1,
                last_name: 1,
                email: 1,
                department: 1,
                position: 1,
                status: 1,
                phone: 1,
                profile_image: 1,
              }
            },
          ],
          as: 'assignees',
        },
      },

      // Search (after lookup so we can hit assignee fields)
      ...(textOr.length ? [{ $match: { $or: textOr } }] : []),

      // Facet for page + total
      {
        $facet: {
          items: [
            { $sort: { [sortField]: dir, _id: 1 } },
            { $skip: skip },
            { $limit: pageSize },
            {
              $project: {
                _id: 1,
                clientId: 1,
                id: 1,
                title: 1,
                description: 1,
                priority: 1,
                status: 1,
                startDate: 1,
                dueDate: 1,
                actualEndDate: 1,
                estimatedHours: 1,
                assigneeEmployeeIds: 1,
                checklist: 1,
                createdBy: 1,
                updatedBy: 1,
                createdAt: 1,
                updatedAt: 1,
                // hydrated assignees
                assignees: 1,
              },
            },
          ],
          meta: [{ $count: 'total' }],
        },
      },
      {
        $project: {
          items: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$meta.total', 0] }, 0] },
        },
      },
    ];

    const [result] = await TaskModel.aggregate(pipeline).collation({ locale: 'en', strength: 2 });
    const items = result?.items ?? [];
    const total = result?.total ?? 0;

    return res.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      sort: { [sortField]: dir },
      filterApplied: { q, status: status || null, priority: priority || null },
    });
  } catch (err) {
    next(err);
  }
}
