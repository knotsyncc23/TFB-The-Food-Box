import mongoose from 'mongoose';

const adminCategoryManagementSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    image: {
      type: String,
      default: 'https://via.placeholder.com/40',
    },
    type: {
      type: String,
      trim: true,
      enum: ['Starters', 'Main course', 'Desserts', 'Beverages', 'Varieties'],
    },
    foodPreference: {
      type: String,
      enum: ['all', 'veg', 'non-veg'],
      default: 'all',
    },
    priority: {
      type: String,
      enum: ['High', 'Normal', 'Low'],
      default: 'Normal',
    },
    status: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
adminCategoryManagementSchema.index({ name: 1 });
adminCategoryManagementSchema.index({ status: 1 });
adminCategoryManagementSchema.index({ priority: 1 });
adminCategoryManagementSchema.index({ foodPreference: 1 });
adminCategoryManagementSchema.index({ createdAt: -1 });

// Virtual for serial number (for display purposes)
adminCategoryManagementSchema.virtual('sl').get(function() {
  // This will be calculated in the controller based on query results
  return null;
});

const AdminCategoryManagement = mongoose.model('AdminCategoryManagement', adminCategoryManagementSchema);

export default AdminCategoryManagement;

