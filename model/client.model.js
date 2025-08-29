// src/models/client.model.js
import { Schema, model } from 'mongoose';
 import { attachAudit } from '../utils/audit.plugin.js';

const ClientSchema = new Schema({

  name: { type: String, required: true, trim: true },
  owner: { type: String, required: true, trim: true, index: true }, // display name or email
  team: { type: String, default: '' },
  tags: { type: [String], default: [], index: true },
  progress: { type: Number, required: true, min: 0, max: 100 },
  status: { 
    type: String, 
    enum: ['NOT STARTED','IN PROGRESS','BLOCKED','COMPLETED','ARCHIVED'], 
    required: true, 
    index: true 
  },
  dueDate: { type: Date, required: true },

  createdBy: { type: String, default: null },
  updatedBy: { type: String, default: null },
  deletedAt: { type: Date, default: null },
}, {
  timestamps: true,
  versionKey: 'version',
});

ClientSchema.index({ name: 1 });
ClientSchema.index({ dueDate: 1 });

// Attach audit trail plugin
attachAudit(ClientSchema, 'Client');

export const ClientModel = model('Client', ClientSchema);
