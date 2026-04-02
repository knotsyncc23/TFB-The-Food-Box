/**
 * Admin Push Notification Controller
 * POST /api/admin/push-notification
 */

import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import { sendPushNotification } from "../../../shared/services/fcmPushService.js";
import PushNotification from "../models/PushNotification.js";

/**
 * Send push notification to Customers, Delivery Man, Restaurant, or All
 * POST /api/admin/push-notification
 * Body: { title, description, sendTo, zone?, image? }
 */
export const sendPushNotificationAdmin = asyncHandler(async (req, res) => {
  const { title, description, sendTo, zone = "All", image } = req.body;

  if (!title || !description) {
    return errorResponse(res, 400, "title and description are required");
  }

  const validSendTo = ["Customer", "Delivery Man", "Restaurant", "All"];
  if (!sendTo || !validSendTo.includes(sendTo)) {
    return errorResponse(
      res,
      400,
      "sendTo must be one of: Customer, Delivery Man, Restaurant, All"
    );
  }

  const result = await sendPushNotification({
    title,
    description,
    sendTo,
    zone: zone || "All",
    image,
  });

  const admin = req.user || req.admin || null;
  const doc = await PushNotification.create({
    title,
    description,
    sendTo,
    zone: zone || "All",
    image: image || "",
    sent: result.sent,
    failed: result.failed,
    total: result.total,
    errors: result.errors || [],
    createdBy: admin?._id || null,
  });

  return successResponse(res, 200, "Push notification sent", {
    sent: result.sent,
    failed: result.failed,
    total: result.total,
    errors: result.errors,
    notification: doc,
  });
});

/**
 * List sent push notifications (admin history)
 * GET /api/admin/push-notification
 * Query: ?sendTo=&zone=&limit=&page=
 */
export const listPushNotificationsAdmin = asyncHandler(async (req, res) => {
  const {
    sendTo = null,
    zone = null,
    limit: rawLimit = "20",
    page: rawPage = "1",
  } = req.query || {};

  const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 100);
  const page = Math.max(parseInt(rawPage, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const filter = {};
  if (sendTo) filter.sendTo = sendTo;
  if (zone) filter.zone = zone;

  const [items, total] = await Promise.all([
    PushNotification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PushNotification.countDocuments(filter),
  ]);

  return successResponse(res, 200, "Push notifications retrieved", {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});
