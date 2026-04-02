import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  // Entity Information
  entityType: {
    type: String,
    enum: ['order', 'restaurant', 'delivery', 'user', 'commission', 'settlement', 'refund', 'wallet'],
    required: true,
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Action Information
  action: {
    type: String,
    required: true,
    index: true
  },
  actionType: {
    type: String,
    enum: ['create', 'update', 'delete', 'calculate', 'settle', 'refund', 'credit', 'debit', 'commission_change'],
    required: true,
    index: true
  },
  
  // User/Actor Information
  performedBy: {
    type: {
      type: String,
      enum: ['user', 'restaurant', 'delivery', 'admin', 'system'],
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      sparse: true
    },
    name: String,
    email: String
  },
  
  // Changes/Details
  changes: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    comment: 'Before and after values for updates'
  },
  
  // Transaction Details (for financial transactions)
  transactionDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  
  // Commission Change Details
  commissionChange: {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      sparse: true
    },
    oldValue: Number,
    newValue: Number,
    oldType: String,
    newType: String,
    reason: String
  },
  
  // Metadata
  description: {
    type: String,
    trim: true
  },
  ipAddress: String,
  userAgent: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Status
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success'
  },
  errorMessage: String
}, {
  timestamps: true
});

// Indexes
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actionType: 1, createdAt: -1 });
auditLogSchema.index({ 'performedBy.type': 1, 'performedBy.userId': 1 });
auditLogSchema.index({ 'transactionDetails.orderId': 1 });
auditLogSchema.index({ createdAt: -1 });

// Static method to create audit log
auditLogSchema.statics.createLog = async function(logData) {
  return await this.create({
    ...logData,
    createdAt: new Date()
  });
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
