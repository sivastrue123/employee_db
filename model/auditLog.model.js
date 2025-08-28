
import { Schema, model } from 'mongoose';

const AuditLogSchema = new Schema({
  entity: { type: String, required: true, enum: ['Client', 'Task'], index: true },
  entityId: { type: String, required: true, index: true },
  action: { type: String, required: true, enum: ['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'SOFT_DELETE'], index: true },
  changes: {
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    diff: { type: Schema.Types.Mixed },
  },
  actor: { type: String, default: null, index: true },
  requestId: { type: String, default: null, index: true },
  ip: { type: String, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export const AuditLogModel = model('AuditLog', AuditLogSchema);
