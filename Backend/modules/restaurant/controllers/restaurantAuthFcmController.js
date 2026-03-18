import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import { successResponse, errorResponse } from "../../../shared/utils/response.js";
import Restaurant from "../models/Restaurant.js";

/**
 * Register or refresh FCM device token for the currently authenticated restaurant
 * POST /api/restaurant/auth/fcm-token
 * Body: { platform: 'web' | 'app' | 'ios', fcmToken }
 */
export const registerRestaurantFcmToken = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?._id;
  const { platform, fcmToken } = req.body;

  if (!platform || !fcmToken) {
    return errorResponse(res, 400, "platform and fcmToken are required");
  }

  const validPlatforms = ["web", "app", "android", "ios"];
  if (!validPlatforms.includes(platform)) {
    return errorResponse(
      res,
      400,
      "Invalid platform. Allowed values: web, app, android, ios",
    );
  }

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    return errorResponse(res, 404, "Restaurant not found");
  }

  if (platform === "web") {
    restaurant.fcmTokenWeb = fcmToken;
  } else if (platform === "app" || platform === "android") {
    restaurant.fcmTokenAndroid = fcmToken;
  } else if (platform === "ios") {
    restaurant.fcmTokenIos = fcmToken;
  }

  await restaurant.save();
  return successResponse(res, 200, "FCM token registered successfully", {
    fcmTokenWeb: restaurant.fcmTokenWeb,
    fcmTokenAndroid: restaurant.fcmTokenAndroid,
    fcmTokenIos: restaurant.fcmTokenIos,
  });
});

/**
 * Remove FCM token for the current restaurant device on logout
 * DELETE /api/restaurant/auth/fcm-token
 * Body: { platform: 'web' | 'app' | 'ios' }
 */
export const removeRestaurantFcmToken = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?._id;
  const { platform } = req.body;

  if (!platform) {
    return errorResponse(res, 400, "platform is required");
  }

  const validPlatforms = ["web", "app", "android", "ios"];
  if (!validPlatforms.includes(platform)) {
    return errorResponse(
      res,
      400,
      "Invalid platform. Allowed values: web, app, android, ios",
    );
  }

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    return errorResponse(res, 404, "Restaurant not found");
  }

  if (platform === "web") {
    restaurant.fcmTokenWeb = null;
  } else if (platform === "app" || platform === "android") {
    restaurant.fcmTokenAndroid = null;
  } else if (platform === "ios") {
    restaurant.fcmTokenIos = null;
  }

  await restaurant.save();

  return successResponse(res, 200, "FCM token removed successfully");
});

