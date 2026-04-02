import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      // Phone is required only if email and social provider IDs are not provided
      required: function () {
        return !this.email && !this.googleId && !this.appleId;
      },
      trim: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      select: false, // Don't return password by default
    },
    googleId: {
      type: String,
    },
    googleEmail: {
      type: String,
      sparse: true,
    },
    appleId: {
      type: String,
    },
    role: {
      type: String,
      enum: ["user", "restaurant", "delivery", "admin"],
      default: "user",
    },
    signupMethod: {
      type: String,
      enum: ["google", "phone", "email", "apple"],
      default: null,
    },
    authProvider: {
      type: String,
      enum: ["email", "phone", "google", "apple"],
      default: "email",
    },
    profileImage: {
      type: String,
    },
    dateOfBirth: {
      type: Date,
    },
    anniversary: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer-not-to-say"],
    },
    addresses: [
      {
        label: {
          type: String,
          enum: ["Home", "Office", "Other"],
        },
        street: String,
        additionalDetails: String,
        city: String,
        state: String,
        zipCode: String,
        location: {
          type: {
            type: String,
            enum: ["Point"],
            default: "Point",
          },
          coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0],
          },
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
    paymentMethods: [
      {
        type: {
          type: String,
          enum: ["card", "upi", "netbanking", "wallet"],
        },
        details: mongoose.Schema.Types.Mixed, // Encrypted
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
    preferences: {
      vegMode: {
        type: Boolean,
        default: false,
      },
      language: {
        type: String,
        default: "en",
      },
      notifications: {
        orders: {
          type: Boolean,
          default: true,
        },
        offers: {
          type: Boolean,
          default: true,
        },
        updates: {
          type: Boolean,
          default: true,
        },
      },
    },
    favorites: [
      {
        restaurantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Restaurant",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    wallet: {
      balance: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: "INR",
      },
    },
    // FCM tokens for different platforms
    fcmTokenWeb: {
      type: String,
      default: null,
    },
    fcmTokenIos: {
      type: String,
      default: null,
    },
    fcmTokenAndroid: {
      type: String,
      default: null,
    },
    goldMembership: {
      isActive: {
        type: Boolean,
        default: false,
      },
      startDate: Date,
      endDate: Date,
    },
    currentLocation: {
      latitude: {
        type: Number,
      },
      longitude: {
        type: Number,
      },
      address: {
        type: String,
      },
      city: {
        type: String,
      },
      state: {
        type: String,
      },
      area: {
        type: String,
      },
      formattedAddress: {
        type: String,
      },
      accuracy: {
        type: Number, // GPS accuracy in meters
      },
      postalCode: {
        type: String, // Pincode
      },
      street: {
        type: String,
      },
      streetNumber: {
        type: String,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
      location: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number], // [longitude, latitude] for GeoJSON
          default: [0, 0],
        },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
// Compound unique indexes to allow same email/phone for different roles
// But prevent duplicate email+role or phone+role combinations
// Use partial index to only index non-null emails to avoid duplicate key errors with null emails
userSchema.index(
  { email: 1, role: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true, $type: "string" } },
  },
);
userSchema.index(
  { phone: 1, role: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $exists: true, $type: "string" } },
  },
);
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ appleId: 1 }, { unique: true, sparse: true });
userSchema.index({ "addresses.location": "2dsphere" });
userSchema.index({ "currentLocation.location": "2dsphere" }); // GeoJSON index for current location queries
// Note: Single-field indexes on email/phone removed - compound indexes {email:1,role:1} and {phone:1,role:1} can serve as prefixes
userSchema.index({ role: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
