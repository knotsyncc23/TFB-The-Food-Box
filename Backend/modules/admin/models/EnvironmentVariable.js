import mongoose from 'mongoose';
import { decrypt, isEncrypted } from '../../../shared/utils/encryption.js';

const environmentVariableSchema = new mongoose.Schema(
  {
    // Razorpay
    RAZORPAY_API_KEY: {
      type: String,
      default: '',
      trim: true
    },
    RAZORPAY_SECRET_KEY: {
      type: String,
      default: '',
      trim: true
    },
    
    // Cloudinary
    CLOUDINARY_CLOUD_NAME: {
      type: String,
      default: '',
      trim: true
    },
    CLOUDINARY_API_KEY: {
      type: String,
      default: '',
      trim: true
    },
    CLOUDINARY_API_SECRET: {
      type: String,
      default: '',
      trim: true
    },
    
    // Firebase
    FIREBASE_API_KEY: {
      type: String,
      default: '',
      trim: true
    },
    FIREBASE_AUTH_DOMAIN: {
      type: String,
      default: '',
      trim: true
    },
    FIREBASE_STORAGE_BUCKET: {
      type: String,
      default: '',
      trim: true
    },
    FIREBASE_MESSAGING_SENDER_ID: {
      type: String,
      default: '',
      trim: true
    },
    FIREBASE_APP_ID: {
      type: String,
      default: '',
      trim: true
    },
    FIREBASE_VAPID_KEY: {
      type: String,
      default: '',
      trim: true
    },
    MEASUREMENT_ID: {
      type: String,
      default: '',
      trim: true
    },
    FIREBASE_PROJECT_ID: {
      type: String,
      default: '',
      trim: true
    },
    FIREBASE_CLIENT_EMAIL: {
      type: String,
      default: '',
      trim: true
    },
    FIREBASE_PRIVATE_KEY: {
      type: String,
      default: '',
      trim: true
    },

    // Firebase Realtime Database
    FIREBASE_DATABASE_URL: {
      type: String,
      default: 'https://tifunbox-default-rtdb.asia-southeast1.firebasedatabase.app',
      trim: true
    },
    
    // SMTP
    SMTP_HOST: {
      type: String,
      default: '',
      trim: true
    },
    SMTP_PORT: {
      type: String,
      default: '',
      trim: true
    },
    SMTP_USER: {
      type: String,
      default: '',
      trim: true
    },
    SMTP_PASS: {
      type: String,
      default: '',
      trim: true
    },
    
    // SMS Hub India
    SMSINDIAHUB_API_KEY: {
      type: String,
      default: '',
      trim: true
    },
    SMSINDIAHUB_SENDER_ID: {
      type: String,
      default: '',
      trim: true
    },
    
    // Google Maps
    VITE_GOOGLE_MAPS_API_KEY: {
      type: String,
      default: '',
      trim: true
    },
    
    // Apple Sign-In
    APPLE_CLIENT_ID: {
      type: String,
      default: '',
      trim: true
    },
    APPLE_REDIRECT_URI: {
      type: String,
      default: '',
      trim: true
    },
    
    // Metadata
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    collection: 'environmentvariables'
  }
);

// Create a single document instance (singleton pattern)
environmentVariableSchema.statics.getOrCreate = async function() {
  let envVars = await this.findOne();
  if (!envVars) {
    envVars = await this.create({});
  }
  return envVars;
};

// Method to get all variables as plain object (with decryption)
environmentVariableSchema.methods.toEnvObject = function() {
  const obj = this.toObject();
  delete obj._id;
  delete obj.__v;
  delete obj.createdAt;
  delete obj.updatedAt;
  delete obj.lastUpdatedBy;
  delete obj.lastUpdatedAt;
  
  // Decrypt all sensitive fields
  const sensitiveFields = [
    'RAZORPAY_API_KEY',
    'RAZORPAY_SECRET_KEY',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'FIREBASE_API_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'SMTP_USER',
    'SMTP_PASS',
    'SMSINDIAHUB_API_KEY',
    'VITE_GOOGLE_MAPS_API_KEY'
  ];
  
  sensitiveFields.forEach(field => {
    if (obj[field] && isEncrypted(obj[field])) {
      try {
        obj[field] = decrypt(obj[field]);
      } catch {
        obj[field] = ''; // Return empty on decryption error (silent)
      }
    }
  });
  
  return obj;
};

// Pre-save hook to normalize sensitive field values.
// NOTE: Encryption on save is intentionally disabled to avoid runtime
// decrypt-key mismatch issues in production. Existing encrypted values
// are still handled in toEnvObject() above.
environmentVariableSchema.pre('save', function(next) {
  const sensitiveFields = [
    'RAZORPAY_API_KEY',
    'RAZORPAY_SECRET_KEY',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'FIREBASE_API_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'SMTP_USER',
    'SMTP_PASS',
    'SMSINDIAHUB_API_KEY',
    'VITE_GOOGLE_MAPS_API_KEY'
  ];
  
  // Process each field safely
  for (const field of sensitiveFields) {
    try {
      // Check if field exists and is modified
      if (!this.isModified(field)) {
        continue; // Skip if not modified
      }
      
      let fieldValue = this[field];
      
      // Convert to string if it's not already a string
      if (fieldValue !== null && fieldValue !== undefined && typeof fieldValue !== 'string') {
        fieldValue = String(fieldValue);
        this[field] = fieldValue;
      }
      
      // Handle null, undefined, or empty strings
      if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
        // Set to empty string if null/undefined
        this[field] = '';
        continue;
      }

      // Encryption is disabled: persist plain text values directly.
      // If admin submits an already encrypted value, keep it as-is.
      if (typeof fieldValue === 'string' && !isEncrypted(fieldValue)) {
        this[field] = fieldValue.trim();
      }
    } catch (fieldError) {
      console.error(`Error processing field ${field}:`, fieldError.message);
      // Continue processing other fields even if one fails
    }
  }
  
  // Always call next() to allow save to proceed
  // Never pass error to next() - we want save to succeed even if encryption fails
  next();
});

const EnvironmentVariable = mongoose.model('EnvironmentVariable', environmentVariableSchema);

export default EnvironmentVariable;
