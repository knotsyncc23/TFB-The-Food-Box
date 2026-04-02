import mongoose from 'mongoose';

const contactUsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'Contact Us',
      trim: true
    },
    content: {
      type: String,
      required: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'contact_us_pages'
  }
);

contactUsSchema.index({ isActive: 1 });

export default mongoose.model('ContactUs', contactUsSchema);
