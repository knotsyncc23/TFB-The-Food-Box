import mongoose from "mongoose";

const pushNotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    sendTo: {
      type: String,
      enum: ["Customer", "Delivery Man", "Restaurant", "All"],
      required: true,
      index: true,
    },
    zone: { type: String, default: "All", trim: true, index: true },
    image: { type: String, default: "", trim: true },

    // Delivery stats (as returned by FCM send)
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    errors: { type: [String], default: [] },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },
  },
  { timestamps: true, collection: "pushnotifications" },
);

pushNotificationSchema.index({ createdAt: -1 });

const PushNotification = mongoose.model(
  "PushNotification",
  pushNotificationSchema,
);

export default PushNotification;

