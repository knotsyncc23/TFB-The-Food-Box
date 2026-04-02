import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { normalizePhoneNumber } from "../../../shared/utils/phoneUtils.js";

const locationSchema = new mongoose.Schema({
  // Deprecated scalar lat/lng (kept for backward compatibility)
  latitude: Number,
  longitude: Number,
  // GeoJSON Point for geospatial queries: [longitude, latitude]
  type: {
    type: String,
    enum: ["Point"],
    default: "Point",
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    index: "2dsphere",
  },
  // Stored / reverse-geocoded address fields (provider-agnostic)
  formattedAddress: String,
  address: String, // Full address string
  addressLine1: String,
  addressLine2: String,
  area: String,
  city: String,
  state: String,
  landmark: String,
  zipCode: String,
  pincode: String,
  postalCode: String,
  street: String,
});

const deliveryTimingsSchema = new mongoose.Schema({
  openingTime: String,
  closingTime: String,
});

const restaurantSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: String,
      unique: true,
    },
    // Authentication fields
    email: {
      type: String,
      required: function () {
        return !this.phone && !this.googleId && !this.appleId;
      },
      lowercase: true,
      trim: true,
      sparse: true, // Allow multiple null values in unique index
    },
    phone: {
      type: String,
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
    signupMethod: {
      type: String,
      enum: ["google", "apple", "phone", "email"],
      default: null,
    },
    // Owner information (now stored directly in restaurant)
    ownerName: {
      type: String,
      required: true,
    },
    ownerEmail: {
      type: String,
      default: "",
    },
    ownerPhone: {
      type: String,
      required: function () {
        return !!this.phone;
      },
    },
    // Restaurant basic info
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    primaryContactNumber: String,
    location: locationSchema,
    profileImage: {
      url: String,
      publicId: String,
    },
    menuImages: [
      {
        url: String,
        publicId: String,
      },
    ],
    cuisines: [String],
    deliveryTimings: deliveryTimingsSchema,
    openDays: [String],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    isAcceptingOrders: {
      type: Boolean,
      default: true,
    },
    // Additional display data for user module
    estimatedDeliveryTime: {
      type: String,
      default: "25-30 mins",
    },
    distance: {
      type: String,
      default: "1.2 km",
    },
    priceRange: {
      type: String,
      enum: ["$", "$$", "$$$", "$$$$"],
      default: "$$",
    },
    featuredDish: {
      type: String,
      default: "",
    },
    featuredPrice: {
      type: Number,
      default: 249,
    },
    offer: {
      type: String,
      default: "Flat ₹50 OFF above ₹199",
    },
    // FCM tokens for sending push notifications to restaurant dashboard/app
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
    // Onboarding fields (merged from RestaurantOnboarding)
    onboarding: {
      step1: {
        restaurantName: String,
        ownerName: String,
        ownerEmail: String,
        ownerPhone: String,
        primaryContactNumber: String,
        location: locationSchema,
      },
      step2: {
        menuImageUrls: [
          {
            url: String,
            publicId: String,
          },
        ],
        profileImageUrl: {
          url: String,
          publicId: String,
        },
        cuisines: [String],
        deliveryTimings: {
          openingTime: String,
          closingTime: String,
        },
        openDays: [String],
      },
      step3: {
        pan: {
          panNumber: String,
          nameOnPan: String,
          image: {
            url: String,
            publicId: String,
          },
        },
        gst: {
          isRegistered: {
            type: Boolean,
            default: false,
          },
          gstNumber: String,
          legalName: String,
          address: String,
          image: {
            url: String,
            publicId: String,
          },
        },
        fssai: {
          registrationNumber: String,
          expiryDate: Date,
          image: {
            url: String,
            publicId: String,
          },
        },
        bank: {
          accountNumber: String,
          ifscCode: String,
          accountHolderName: String,
          accountType: String,
        },
      },
      step4: {
        estimatedDeliveryTime: String,
        distance: String,
        priceRange: String,
        featuredDish: String,
        featuredPrice: Number,
        offer: String,
      },
      completedSteps: {
        type: Number,
        default: 0,
      },
    },
    // Approval/Rejection fields
    rejectionReason: {
      type: String,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    diningSettings: {
      isEnabled: {
        type: Boolean,
        default: false,
      },
      maxGuests: {
        type: Number,
        default: 6,
      },
      diningType: {
        type: String,
        default: "family-dining", // e.g., 'fine-dining', 'cafe', 'casual-dining'
      },
      // Admin override + request workflow
      requestStatus: {
        type: String,
        enum: ["none", "pending"],
        default: "none",
      },
      lastRequestAt: {
        type: Date,
      },
      lastDecisionAt: {
        type: Date,
      },
      lastDecisionBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
      },
    },
    // Full dining page management config (restaurant editable except seatingCapacity)
    diningConfig: {
      enabled: { type: Boolean, default: false },
      basicDetails: {
        name: String,
        address: String,
        description: String,
        costForTwo: { type: Number, default: null },
        openingTime: { type: String, default: "12:00" },
        closingTime: { type: String, default: "23:59" },
        isOpen: { type: Boolean, default: true },
      },
      coverImage: { url: String, publicId: String },
      gallery: [{ url: String, publicId: String }],
      tableBooking: {
        enabled: { type: Boolean, default: false },
        timeSlots: [{ type: String }],
        minGuestsPerBooking: { type: Number, default: 1 },
        maxGuestsPerBooking: { type: Number, default: 10 },
        approvalMode: {
          type: String,
          enum: ["auto", "manual"],
          default: "manual",
        },
      },
      seatingCapacity: { type: Number, default: null },
      pageControls: {
        reviewsEnabled: { type: Boolean, default: true },
        shareEnabled: { type: Boolean, default: true },
        diningSlug: { type: String, trim: true, lowercase: true },
      },
      categories: [
        { type: mongoose.Schema.Types.ObjectId, ref: "DiningCategory" },
      ],
    },
    businessModel: {
      type: String,
      enum: ["Commission Base", "Subscription Base"],
      default: "Commission Base",
    },
    // Dining: commission % on dining bill payment (admin-only editable)
    diningCommissionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for authentication
restaurantSchema.index({ email: 1 }, { unique: true, sparse: true });
restaurantSchema.index({ phone: 1 }, { unique: true, sparse: true });
restaurantSchema.index({ googleId: 1 }, { unique: true, sparse: true });
restaurantSchema.index({ appleId: 1 }, { unique: true, sparse: true });
// Geospatial index for nearby restaurant search
restaurantSchema.index({ "location.coordinates": "2dsphere" });

// Hash password before saving
restaurantSchema.pre("save", async function (next) {
  // Generate restaurantId FIRST (before any validation)
  if (!this.restaurantId) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    this.restaurantId = `REST-${timestamp}-${random}`;
  }

  // Normalize phone number if it exists and is modified
  if (this.isModified("phone") && this.phone) {
    const normalized = normalizePhoneNumber(this.phone);
    if (normalized) {
      this.phone = normalized;
    }
  }

  // Normalize ownerPhone if it exists and is modified
  if (this.isModified("ownerPhone") && this.ownerPhone) {
    const normalized = normalizePhoneNumber(this.ownerPhone);
    if (normalized) {
      this.ownerPhone = normalized;
    }
  }

  // Normalize primaryContactNumber if it exists and is modified
  if (this.isModified("primaryContactNumber") && this.primaryContactNumber) {
    const normalized = normalizePhoneNumber(this.primaryContactNumber);
    if (normalized) {
      this.primaryContactNumber = normalized;
    }
  }

  // Generate slug from name (always generate if name exists and slug doesn't)
  if (this.name && !this.slug) {
    let baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Ensure slug is not empty
    if (!baseSlug) {
      baseSlug = `restaurant-${this.restaurantId}`;
    }

    this.slug = baseSlug;
  }

  // CRITICAL: For phone signups, ensure email field is completely unset (not null/undefined)
  // This prevents duplicate key errors on sparse unique index
  if (
    this.phone &&
    !this.email &&
    (this.signupMethod === "phone" || !this.signupMethod)
  ) {
    // Explicitly ensure email is undefined (not null) to prevent MongoDB from indexing it
    // Mongoose will omit undefined fields but will include null fields
    if (this.email === null || this.email === undefined) {
      // Remove email from the document to prevent it from being saved
      this.$unset = this.$unset || {};
      this.$unset.email = "";
    }
  }

  // Hash password if it's modified
  if (this.isModified("password") && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Set default ownerEmail if not set and phone exists
  if (!this.ownerEmail && this.phone && !this.email) {
    this.ownerEmail = `${this.phone.replace(/\D/g, "")}@restaurant.appzeto.com`;
  }

  // Set ownerEmail from email if email exists and ownerEmail not set
  if (this.email && !this.ownerEmail) {
    this.ownerEmail = this.email;
  }

  next();
});

// Method to compare password
restaurantSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("Restaurant", restaurantSchema);
