import Delivery from "../models/Delivery.js";
import otpService from "../../auth/services/otpService.js";
import jwtService from "../../auth/services/jwtService.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import {
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions,
} from "../../../config/refreshCookie.js";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

/**
 * Send OTP for delivery boy phone number
 * POST /api/delivery/auth/send-otp
 */
export const sendOTP = asyncHandler(async (req, res) => {
  const { phone, purpose = "login" } = req.body;

  // Validate phone number
  if (!phone) {
    return errorResponse(res, 400, "Phone number is required");
  }

  // Validate phone number format
  const phoneRegex =
    /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
  if (!phoneRegex.test(phone)) {
    return errorResponse(res, 400, "Invalid phone number format");
  }

  try {
    // In production we allow a higher OTP limit for delivery logins to reduce support load.
    // Web clients can still be blocked by SMS provider throttling.
    const opts =
      purpose === "login" ? { maxPerHour: 100 } : undefined;
    const result = await otpService.generateAndSendOTP(phone, purpose, null, opts);
    return successResponse(res, 200, result.message, {
      expiresIn: result.expiresIn,
      identifierType: result.identifierType,
    });
  } catch (error) {
    logger.error(`Error sending OTP: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * Verify OTP and login/register delivery boy
 * POST /api/delivery/auth/verify-otp
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp, purpose = "login", name } = req.body;

  // Validate inputs
  if (!phone || !otp) {
    return errorResponse(res, 400, "Phone number and OTP are required");
  }

  // Normalize name - convert null/undefined to empty string for optional field
  const normalizedName = name && typeof name === "string" ? name.trim() : null;

  try {
    let delivery;
    const identifier = phone;

    if (purpose === "register") {
      // Registration flow
      // Check if delivery boy already exists
      delivery = await Delivery.findOne({ phone });

      if (delivery) {
        return errorResponse(
          res,
          400,
          "Delivery boy already exists with this phone number. Please login.",
        );
      }

      // Name is mandatory for explicit registration
      if (!normalizedName) {
        return errorResponse(res, 400, "Name is required for registration");
      }

      // Verify OTP before creating delivery boy
      await otpService.verifyOTP(phone, otp, purpose, null);

      const deliveryData = {
        name: normalizedName,
        phone,
        phoneVerified: true,
        signupMethod: "phone",
        status: "pending", // New delivery boys start as pending approval
        isActive: true, // Allow login to see verification message
      };

      try {
        delivery = await Delivery.create(deliveryData);
        logger.info(`New delivery boy registered: ${delivery._id}`, {
          phone,
          deliveryId: delivery._id,
          deliveryIdField: delivery.deliveryId,
        });
      } catch (createError) {
        // Handle duplicate key error
        if (createError.code === 11000) {
          delivery = await Delivery.findOne({ phone });
          if (!delivery) {
            throw createError;
          }
          return errorResponse(
            res,
            400,
            "Delivery boy already exists with this phone number. Please login.",
          );
        } else {
          throw createError;
        }
      }
    } else {
      // Login (with optional auto-registration)
      delivery = await Delivery.findOne({ phone });

      // Verify OTP first (before creating user)
      await otpService.verifyOTP(phone, otp, purpose, null);

      if (!delivery) {
        // New user - create minimal record for signup flow
        // Use provided name or placeholder
        const deliveryData = {
          name: normalizedName || "Delivery Partner", // Placeholder if not provided
          phone,
          phoneVerified: true,
          signupMethod: "phone",
          status: "pending", // New delivery boys start as pending approval
          isActive: true, // Allow login to see verification message
        };

        try {
          delivery = await Delivery.create(deliveryData);
          logger.info(`New delivery boy created for signup: ${delivery._id}`, {
            phone,
            deliveryId: delivery._id,
            deliveryIdField: delivery.deliveryId,
            hasName: !!normalizedName,
          });
        } catch (createError) {
          if (createError.code === 11000) {
            delivery = await Delivery.findOne({ phone });
            if (!delivery) {
              throw createError;
            }
            logger.info(
              `Delivery boy found after duplicate key error: ${delivery._id}`,
            );
          } else {
            throw createError;
          }
        }
      } else {
        // Existing delivery boy login - update verification status if needed
        if (!delivery.phoneVerified) {
          delivery.phoneVerified = true;
          await delivery.save();
        }
      }

      // Check if signup needs to be completed (missing required fields).
      // Only force signup for non-approved / non-active partners, so that
      // already approved riders aren't pushed back into signup due to
      // legacy missing optional fields.
      const requiresFullProfileStatus =
        !["approved", "active"].includes(delivery.status);

      const hasMissingProfileFields =
        !delivery.location?.city ||
        !delivery.vehicle?.number ||
        !delivery.documents?.pan?.number ||
        !delivery.documents?.aadhar?.number ||
        !delivery.documents?.aadhar?.document ||
        !delivery.documents?.pan?.document ||
        !delivery.documents?.drivingLicense?.document;

      const needsSignup = requiresFullProfileStatus && hasMissingProfileFields;

      if (needsSignup) {
        // Generate tokens for signup flow
        const tokens = jwtService.generateTokens({
          userId: delivery._id.toString(),
          role: "delivery",
          email: delivery.email || delivery.phone || delivery.deliveryId,
        });

        // Store refresh token
        delivery.refreshToken = tokens.refreshToken;
        await delivery.save();

        // Set refresh token in httpOnly cookie
        res.cookie(
          "refreshToken",
          tokens.refreshToken,
          getRefreshTokenCookieOptions(),
        );

        return successResponse(
          res,
          200,
          "OTP verified. Please complete your profile.",
          {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
              id: delivery._id,
              name: delivery.name,
              phone: delivery.phone,
              email: delivery.email,
              deliveryId: delivery.deliveryId,
              status: delivery.status,
              rejectionReason: delivery.rejectionReason || null, // Include rejection reason for blocked accounts
            },
            needsSignup: true, // Signal that signup needs to be completed
          },
        );
      }
    }

    // Check if delivery boy is active (blocked/pending status partners can still login to see rejection reason or verification message)
    if (
      !delivery.isActive &&
      delivery.status !== "blocked" &&
      delivery.status !== "pending"
    ) {
      return errorResponse(
        res,
        403,
        "Your account has been deactivated. Please contact support.",
      );
    }

    // Generate tokens
    const tokens = jwtService.generateTokens({
      userId: delivery._id.toString(),
      role: "delivery",
      email: delivery.email || delivery.phone || delivery.deliveryId,
    });

    // Store refresh token in database
    delivery.refreshToken = tokens.refreshToken;
    await delivery.save();

    // Set refresh token in httpOnly cookie
    res.cookie("refreshToken", tokens.refreshToken, getRefreshTokenCookieOptions());

    // Update last login
    delivery.lastLogin = new Date();
    await delivery.save();

    // Return access token and delivery boy info
    return successResponse(res, 200, "Authentication successful", {
      accessToken: tokens.accessToken,
      user: {
        id: delivery._id,
        deliveryId: delivery.deliveryId,
        name: delivery.name,
        email: delivery.email,
        phone: delivery.phone,
        phoneVerified: delivery.phoneVerified,
        signupMethod: delivery.signupMethod,
        profileImage: delivery.profileImage,
        isActive: delivery.isActive,
        status: delivery.status,
        rejectionReason: delivery.rejectionReason || null, // Include rejection reason for blocked accounts
        metrics: delivery.metrics,
        earnings: delivery.earnings,
      },
    });
  } catch (error) {
    logger.error(`Error verifying OTP: ${error.message}`);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * Refresh Access Token
 * POST /api/delivery/auth/refresh-token
 */
export const refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or header
  const refreshToken =
    req.cookies?.refreshToken || req.headers["x-refresh-token"];

  if (!refreshToken) {
    return errorResponse(res, 401, "Refresh token not found");
  }

  try {
    // Verify refresh token
    const decoded = jwtService.verifyRefreshToken(refreshToken);

    // Ensure it's a delivery token
    if (decoded.role !== "delivery") {
      return errorResponse(res, 401, "Invalid token for delivery");
    }

    // Get delivery boy from database and verify refresh token matches
    const delivery = await Delivery.findById(decoded.userId).select(
      "+refreshToken",
    );

    if (!delivery || !delivery.isActive) {
      return errorResponse(res, 401, "Delivery boy not found or inactive");
    }

    // Verify refresh token matches stored token
    if (delivery.refreshToken !== refreshToken) {
      return errorResponse(res, 401, "Invalid refresh token");
    }

    // Generate new access token
    const accessToken = jwtService.generateAccessToken({
      userId: delivery._id.toString(),
      role: "delivery",
      email: delivery.email || delivery.phone || delivery.deliveryId,
    });

    return successResponse(res, 200, "Token refreshed successfully", {
      accessToken,
    });
  } catch (error) {
    return errorResponse(res, 401, error.message || "Invalid refresh token");
  }
});

/**
 * Logout
 * POST /api/delivery/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  // Get delivery boy from request (set by auth middleware)
  if (req.delivery) {
    // Clear refresh token from database
    req.delivery.refreshToken = null;
    await req.delivery.save();
  }

  // Clear refresh token cookie
  res.clearCookie("refreshToken", getClearRefreshTokenCookieOptions());

  return successResponse(res, 200, "Logged out successfully");
});

/**
 * Get current delivery boy
 * GET /api/delivery/auth/me
 */
export const getCurrentDelivery = asyncHandler(async (req, res) => {
  // Delivery boy is attached by authenticate middleware
  return successResponse(res, 200, "Delivery boy retrieved successfully", {
    user: {
      id: req.delivery._id,
      deliveryId: req.delivery.deliveryId,
      name: req.delivery.name,
      email: req.delivery.email,
      phone: req.delivery.phone,
      phoneVerified: req.delivery.phoneVerified,
      signupMethod: req.delivery.signupMethod,
      profileImage: req.delivery.profileImage,
      isActive: req.delivery.isActive,
      status: req.delivery.status,
      location: req.delivery.location,
      vehicle: req.delivery.vehicle,
      documents: req.delivery.documents,
      availability: req.delivery.availability,
      metrics: req.delivery.metrics,
      earnings: req.delivery.earnings,
      wallet: req.delivery.wallet,
      level: req.delivery.level,
      lastLogin: req.delivery.lastLogin,
    },
  });
});

/**
 * Register or refresh FCM device token for the currently authenticated delivery partner
 * POST /api/delivery/auth/fcm-token
 * Body: { platform: 'web' | 'app' | 'ios', fcmToken }
 */
export const registerFcmToken = asyncHandler(async (req, res) => {
  const deliveryId = req.delivery?._id;
  const PLATFORM_MAP = { 0: 'web', 1: 'app', 2: 'android', 3: 'ios' };
  const platformRaw = req.body?.platform ?? req.query?.platform;
  let platform = typeof platformRaw === 'number' && platformRaw >= 0 && platformRaw <= 3
    ? PLATFORM_MAP[platformRaw]
    : (typeof platformRaw === 'string' ? platformRaw.toLowerCase().trim() : String(platformRaw || '').toLowerCase().trim());
  if (typeof platform === 'string' && /^[0-3]$/.test(platform)) {
    platform = PLATFORM_MAP[Number(platform)];
  }
  const fcmToken = req.body?.fcmToken ?? req.query?.fcmToken;

  if (!platform || !fcmToken) {
    return errorResponse(res, 400, "platform and fcmToken are required");
  }

  const validPlatforms = ["web", "app", "android", "ios"];
  if (!validPlatforms.includes(platform)) {
    return errorResponse(
      res,
      400,
      `Invalid platform. Allowed: web, app, android, ios. Received: "${platform}"`,
    );
  }

  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) {
    return errorResponse(res, 404, "Delivery partner not found");
  }

  // Update specific platform token (web, app/android, ios)
  if (platform === "web") {
    delivery.fcmTokenWeb = fcmToken;
  } else if (platform === "app" || platform === "android") {
    delivery.fcmTokenAndroid = fcmToken;
  } else if (platform === "ios") {
    delivery.fcmTokenIos = fcmToken;
  }

  await delivery.save();
  return successResponse(res, 200, "FCM token registered successfully", {
    fcmTokenWeb: delivery.fcmTokenWeb,
    fcmTokenAndroid: delivery.fcmTokenAndroid,
    fcmTokenIos: delivery.fcmTokenIos,
  });
});

/**
 * Remove FCM token for the current device on logout
 * DELETE /api/delivery/auth/fcm-token
 * Body: { platform: 'web' | 'app' | 'ios' }
 */
export const removeFcmToken = asyncHandler(async (req, res) => {
  const deliveryId = req.delivery?._id;
  const PLATFORM_MAP = { 0: 'web', 1: 'app', 2: 'android', 3: 'ios' };
  const platformRaw = req.body?.platform ?? req.query?.platform;
  let platform = typeof platformRaw === 'number' && platformRaw >= 0 && platformRaw <= 3
    ? PLATFORM_MAP[platformRaw]
    : (typeof platformRaw === 'string' ? platformRaw.toLowerCase().trim() : String(platformRaw || '').toLowerCase().trim());
  if (typeof platform === 'string' && /^[0-3]$/.test(platform)) {
    platform = PLATFORM_MAP[Number(platform)];
  }

  if (!platform) {
    return errorResponse(res, 400, "platform is required (body or ?platform=app)");
  }

  const validPlatforms = ["web", "app", "android", "ios"];
  if (!validPlatforms.includes(platform)) {
    return errorResponse(
      res,
      400,
      `Invalid platform. Allowed: web, app, android, ios. Received: "${platform}"`,
    );
  }

  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) {
    return errorResponse(res, 404, "Delivery partner not found");
  }

  if (platform === "web") {
    delivery.fcmTokenWeb = null;
  } else if (platform === "app" || platform === "android") {
    delivery.fcmTokenAndroid = null;
  } else if (platform === "ios") {
    delivery.fcmTokenIos = null;
  }

  await delivery.save();

  return successResponse(res, 200, "FCM token removed successfully");
});
