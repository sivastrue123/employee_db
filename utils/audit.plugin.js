import { AuditLogModel } from "../model/auditLog.model.js";
import { computeDiff } from "./diff.js";
// optional: paths to ignore in diffs
const DEFAULT_IGNORE = new Set(["updatedAt", "createdAt", "version", "__v"]);

export function attachAudit(schema, entityName) {
  // PRE-SAVE: fetch the current DB snapshot (true "before")
  schema.pre("save", { document: true, query: false }, async function (next) {
    try {
      if (this.isNew) {
        this.$locals = this.$locals || {};
        this.$locals._before = null;
        return next();
      }
      const before = await this.constructor.findById(this._id).lean();
      this.$locals = this.$locals || {};
      this.$locals._before = before || null;
      return next();
    } catch (err) {
      return next(err);
    }
  });

  // POST-SAVE: build after + diff and persist
  schema.post("save", async function (doc) {
    const before = this.$locals?._before || null;
    const after = doc.toObject({ depopulate: true });
    const action = before ? "UPDATE" : "CREATE";
    const diff = before
      ? computeDiff(before, after, DEFAULT_IGNORE)
      : undefined;
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

  // query paths remain the same (already correct)
  schema.pre(["findOneAndUpdate", "findOneAndDelete"], async function () {
    this._before = await this.model.findOne(this.getFilter()).lean();
  });

  schema.post("findOneAndUpdate", async function (doc) {
    const before = this._before;
    const after = doc ? doc.toObject() : null;
    const diff =
      before && after ? computeDiff(before, after, DEFAULT_IGNORE) : undefined;
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
