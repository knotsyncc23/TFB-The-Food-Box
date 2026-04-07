import mongoose from 'mongoose';

const safetyEmergencySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
      required: true,
      trim: true
    },
    userEmail: {
      type: String,
      trim: true
    },
    userPhone: {
      type: String,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['unread', 'read', 'resolved', 'urgent'],
      default: 'unread'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    adminResponse: {
      type: String,
      default: '',
      trim: true
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    respondedAt: {
      type: Date,
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
safetyEmergencySchema.index({ userId: 1 });
safetyEmergencySchema.index({ userEmail: 1 });
safetyEmergencySchema.index({ userPhone: 1 });
safetyEmergencySchema.index({ status: 1 });
safetyEmergencySchema.index({ priority: 1 });
safetyEmergencySchema.index({ createdAt: -1 });

export default mongoose.model('SafetyEmergency', safetyEmergencySchema);

