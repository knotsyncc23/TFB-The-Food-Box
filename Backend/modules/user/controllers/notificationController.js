import PushNotification from "../../admin/models/PushNotification.js";
import { successResponse, errorResponse } from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";

/**
 * Get notifications visible to the logged-in customer.
 * GET /api/user/notifications
 */
export const getUserNotifications = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query || {};
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const query = {
      sendTo: { $in: ["Customer", "All"] },
    };

    const [items, total] = await Promise.all([
      PushNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PushNotification.countDocuments(query),
    ]);

    return successResponse(res, 200, "Notifications retrieved successfully", {
      notifications: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    return errorResponse(res, 500, "Failed to fetch notifications");
  }
});
