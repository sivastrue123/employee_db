// src/middleware/taskPushNotifications.js
import mongoose from "mongoose";
import webpush from "web-push";
import PushSubscription from "../model/pushNotification.model.js";
import { TaskModel } from "../model/task.model.js";
import Employee from "../model/employee.model.js";

/* ---------------------------- helpers ---------------------------- */

// try to detect “done” boolean for a checklist item
const isDone = (item = {}) =>
  item.done === true || item.completed === true || item.isCompleted === true;

// compare prev vs next checklist arrays by id/title to find newly completed
function getNewlyCompleted(prev = [], next = []) {
  const byKey = (i) => String(i._id || i.id || i.title || JSON.stringify(i));
  const prevMap = new Map(prev.map((i) => [byKey(i), isDone(i)]));
  const results = [];
  for (const n of next) {
    const key = byKey(n);
    const wasDone = prevMap.get(key) === true;
    if (!wasDone && isDone(n)) results.push(n.title || "Checklist item");
  }
  return results;
}

const taskIsCompleted = (doc = {}) => {
  // consider “Completed” status or actualEndDate being set
  const status = (doc.status || "").toLowerCase();
  return status === "completed" || Boolean(doc.actualEndDate);
};

const isObjectIdString = (s) =>
  typeof s === "string" && /^[a-f\d]{24}$/i.test(s);

// Convert an array of assignee identifiers into **Employee _id strings**
async function resolveUserIds(assigneeIds = []) {
  if (!assigneeIds.length) return [];
  // If they already look like Mongo ObjectIds, use as-is
  const allLookLikeObjectIds = assigneeIds.every(isObjectIdString);
  if (allLookLikeObjectIds) return assigneeIds.map(String);

  // Else, assume they are employee_id; map to _id
  const emps = await Employee.find({
    employee_id: { $in: assigneeIds.map(String) },
    isDeleted: false,
    status: "active",
  })
    .select("_id employee_id")
    .lean();

  return emps.map((e) => String(e.employee_id));
}

async function lookupEmployeeName(id) {
  if (!id) return "A teammate";
  const query = isObjectIdString(id) ? { _id: id } : { employee_id: id };
  const emp = await Employee.findOne(query)
    .select("name first_name last_name email")
    .lean();
  if (!emp) return "A teammate";
  return (
    emp.name ||
    `${emp.first_name || ""} ${emp.last_name || ""}`.trim() ||
    emp.email ||
    "A teammate"
  );
}

// Fan-out to many users (excluding actor), with pruning of dead endpoints
async function sendPushToUsers(userIds = [], actorId, payload, options) {
  console.log(userIds, actorId, payload, options);
  const targetIds = userIds
    .map(String)
    .filter((id) => String(id) !== String(actorId));

  if (!targetIds.length) return { sent: 0 };

  const subs = await PushSubscription.find({
    userId: { $in: targetIds },
  }).lean();
  console.log(subs);
  console.log(targetIds);

  let sent = 0;
  const body = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        body,
        options
      );
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await PushSubscription.deleteOne({ endpoint: sub.endpoint });
      } else {
        console.error("push error:", e.statusCode, e.body || e.message);
      }
    }
  }
  return { sent };
}

/* ----------------------- middleware: CREATED ---------------------- */
/**
 * For POST /:clientId/createTask
 * - Intercepts res.json to capture the created task payload
 * - On 'finish', notifies all assignees (excl. actor)
 */
export function notifyOnTaskCreated() {
  return function (req, res, next) {
    const { userId: actorId } = req.query;
    console.log(actorId);
    // tap res.json to capture payload
    const _json = res.json.bind(res);
    res.json = (body) => {
      try {
        res.locals.__taskCreated = body; // capture raw payload
      } catch {}
      return _json(body);
    };

    res.on("finish", async () => {
      try {
        const task = res.locals.__taskCreated;
        if (!task || res.statusCode !== 201) return;
        console.log(task);
        const assignees = await resolveUserIds(task.assigneeEmployeeIds || []);
        const actorName = await lookupEmployeeName(actorId);

        const url = `/Projects`; // 🔗 TODO: deep-link if you have a task route
        const options = {
          TTL: 3600,
          urgency: "high",
          topic: `taskcreated`,
        };
        const payload = {
          title: "New Task Assigned",
          body: `${actorName} created “${task.title || "a task"}”.`,
          url,
        };

        await sendPushToUsers(assignees, actorId, payload, options);
      } catch (e) {
        console.error("notifyOnTaskCreated failed:", e);
      }
    });

    next();
  };
}

/* ----------------------- middleware: UPDATED ---------------------- */
/**
 * For PATCH /:clientId/task/:taskId/updateTask
 * - Loads prev snapshot
 * - After controller finishes, loads next snapshot
 * - If any checklist item flipped to done → notify assignees
 * - If task transitioned to completed → notify assignees
 */
export function notifyOnTaskUpdated() {
  return async function (req, res, next) {
    const { taskId } = req.params;

    let prev = null;
    if (mongoose.isValidObjectId(taskId)) {
      try {
        prev = await TaskModel.findById(taskId).lean();
      } catch (e) {
        console.warn("notifyOnTaskUpdated: prev load failed", e?.message);
      }
    }

    res.on("finish", async () => {
      try {
        // Only run when controller succeeded
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        if (!mongoose.isValidObjectId(taskId)) return;

        const nextDoc = await TaskModel.findById(taskId).lean();
        if (!nextDoc) return;

        const assignees = await resolveUserIds(
          nextDoc.assigneeEmployeeIds || []
        );
        const actorId = req.query?.userId;
        const actorName = await lookupEmployeeName(actorId);
        const url = `/Projects`; // 🔗 customize if you have a per-task route

        const notifications = [];

        // 5) Any checklist item completed?
        if (Array.isArray(nextDoc.checklist)) {
          const newlyDone = getNewlyCompleted(
            prev?.checklist || [],
            nextDoc.checklist
          );
          for (const title of newlyDone) {
            notifications.push({
              title: "Checklist updated",
              body: `${actorName} completed “${title}” in “${
                nextDoc.title || "a task"
              }”.`,
              topic: `taskchecklist`,
              urgency: "high",
              TTL: 900,
            });
          }
        }

        // 6) Task completed?
        const wasCompleted = taskIsCompleted(prev);
        const nowCompleted = taskIsCompleted(nextDoc);
        if (!wasCompleted && nowCompleted) {
          notifications.push({
            title: "Task completed",
            body: `${actorName} completed “${nextDoc.title || "a task"}”.`,
            topic: `taskcompleted`,
            urgency: "high",
            TTL: 1800,
          });
        }

        // Ship the signals
        for (const n of notifications) {
          await sendPushToUsers(
            assignees,
            actorId,
            { title: n.title, body: n.body, url },
            { TTL: n.TTL, urgency: n.urgency, topic: n.topic }
          );
        }
      } catch (e) {
        console.error("notifyOnTaskUpdated failed:", e);
      }
    });

    next();
  };
}
