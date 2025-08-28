// src/models/plugins/audit.plugin.js
import { AuditLogModel } from "../model/auditLog.model.js";
import { computeDiff } from "./diff.js";

export function attachAudit(schema, entityName) {
  schema.pre("save", function (next) {
    this.$locals = this.$locals || {};
    this.$locals._before = this.isNew
      ? null
      : this.toObject({ depopulate: true });
    next();
  });

  schema.post("save", async function (doc) {
    const before = this.$locals?._before || null;
    const after = doc.toObject({ depopulate: true });
    const action = before ? "UPDATE" : "CREATE";
    const diff = before ? computeDiff(before, after) : undefined;
    const opts = this?.$__?.saveOptions || {};
    await AuditLogModel.create({
      entity: entityName,
      entityId: String(doc._id),
      action,
      changes: { before, after, diff },
      actor: opts.actor ?? doc.updatedBy ?? doc.createdBy ?? null,
      requestId: opts.requestId ?? null,
      ip: opts.ip ?? null,
    });
  });

  schema.pre(["findOneAndUpdate", "findOneAndDelete"], async function () {
    this._before = await this.model.findOne(this.getFilter()).lean();
  });

  schema.post("findOneAndUpdate", async function (doc) {
    const before = this._before;
    const after = doc ? doc.toObject() : null;
    const diff = before && after ? computeDiff(before, after) : undefined;
    const opts = this.getOptions() || {};
    await AuditLogModel.create({
      entity: entityName,
      entityId: String(doc?._id ?? before?._id),
      action: "UPDATE",
      changes: { before, after, diff },
      actor: opts.actor ?? after?.updatedBy ?? before?.updatedBy ?? null,
      requestId: opts.requestId ?? null,
      ip: opts.ip ?? null,
    });
  });

  schema.post("findOneAndDelete", async function (doc) {
    const before = this._before;
    const opts = this.getOptions() || {};
    await AuditLogModel.create({
      entity: entityName,
      entityId: String(doc?._id ?? before?._id),
      action: "DELETE",
      changes: { before, after: null, diff: undefined },
      actor: opts.actor ?? before?.updatedBy ?? null,
      requestId: opts.requestId ?? null,
      ip: opts.ip ?? null,
    });
  });
}


// src/utils/audit.util.js
export function buildAuditOptions(req, actorId) {
  return {
    actor: actorId || null,
    requestId: req?.id || null,
    ip: req?.ip || null,
  };
}


// src/utils/async.util.js
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
