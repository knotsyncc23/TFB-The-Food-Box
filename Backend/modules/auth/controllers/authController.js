import User from "../models/User.js";
import otpService from "../services/otpService.js";
import jwtService from "../services/jwtService.js";
import googleAuthService from "../services/googleAuthService.js";
import appleAuthService from "../services/appleAuthService.js";
import firebaseAuthService from "../services/firebaseAuthService.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import {
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions,
} from "../../../config/refreshCookie.js";
import { getEnvVar } from "../../../shared/utils/envService.js";
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
 * Send OTP for phone number or email
 * POST /api/auth/send-otp
 */
export const sendOTP = asyncHandler(async (req, res) => {
  const { phone, email, purpose = "login" } = req.body;

  // Validate that either phone or email is provided
  if (!phone && !email) {
    return errorResponse(res, 400, "Either phone number or email is required");
  }

  // Validate phone number format if provided
  if (phone) {
    const phoneRegex =
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(phone)) {
      return errorResponse(res, 400, "Invalid phone number format");
    }
  }

  // Validate email format if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 400, "Invalid email format");
    }
  }

  try {
    const result = await otpService.generateAndSendOTP(
      phone || null,
      purpose,
      email || null,
    );
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
 * Verify OTP and login/register
 * POST /api/auth/verify-otp
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const {
    phone,
    email,
    otp,
    purpose = "login",
    name,
    role = "user",
    password,
  } = req.body;

  // Validate that either phone or email is provided
  if ((!phone && !email) || !otp) {
    return errorResponse(
      res,
      400,
      "Either phone number or email, and OTP are required",
    );
  }

  // Validate role - admin can be used for admin signup/reset
  const allowedRoles = ["user", "restaurant", "delivery", "admin"];
  const userRole = role || "user";
  if (!allowedRoles.includes(userRole)) {
    return errorResponse(
      res,
      400,
      `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
    );
  }

  // For email-based admin registration, password is mandatory
  if (purpose === "register" && !phone && userRole === "admin" && !password) {
    return errorResponse(
      res,
      400,
      "Password is required for admin email registration",
    );
  }

  try {
    let user;
    const identifier = phone || email;
    const identifierType = phone ? "phone" : "email";

    if (purpose === "register") {
      // Registration flow
      // Check if user already exists with same email/phone AND role
      const findQuery = phone
        ? { phone, role: userRole }
        : { email, role: userRole };
      user = await User.findOne(findQuery);

      if (user) {
        return errorResponse(
          res,
          400,
          `User already exists with this ${identifierType} and role. Please login.`,
        );
      }

      // Name is mandatory for explicit registration
      if (!name) {
        return errorResponse(res, 400, "Name is required for registration");
      }

      // Verify OTP (phone or email) before creating user
      await otpService.verifyOTP(phone || null, otp, purpose, email || null);

      const userData = {
        name,
        role: userRole,
        signupMethod: phone ? "phone" : "email",
      };

      if (phone) {
        userData.phone = phone;
        userData.phoneVerified = true;
      }
      if (email) {
        userData.email = email;
        // Note: We could add emailVerified field if needed
      }

      // If password provided (email/password registration like admin signup), set it
      if (password && !phone) {
        userData.password = password;
      }

      try {
        user = await User.create(userData);
      } catch (createError) {
        // Handle duplicate key error - user might have been created between findOne and create
        if (createError.code === 11000) {
          // Try to find the user again
          const findQuery = phone
            ? { phone, role: userRole }
            : { email, role: userRole };
          user = await User.findOne(findQuery);
          if (!user) {
            throw createError; // Re-throw if still not found
          }
          // User exists, return error that they should login instead
          return errorResponse(
            res,
            400,
            `User already exists with this ${identifierType} and role. Please login.`,
          );
        } else {
          throw createError;
        }
      }

      logger.info(`New user registered: ${user._id}`, {
        [identifierType]: identifier,
        userId: user._id,
        role: userRole,
      });
    } else {
      // Login (with optional auto-registration)
      // Find user by email/phone AND role to ensure correct module access
      const findQuery = phone
        ? { phone, role: userRole }
        : { email, role: userRole };
      user = await User.findOne(findQuery);

      if (!user && !name) {
        // OTP has NOT been verified yet in this flow.
        // Tell the client that we need user's name to proceed with auto-registration.
        // The client should collect name and call this endpoint again with the same OTP and name.
        return successResponse(
          res,
          200,
          "User not found. Please provide name for registration.",
          {
            needsName: true,
            identifierType,
            identifier,
          },
        );
      }

      // Handle reset-password purpose
      if (purpose === "reset-password") {
        if (!user) {
          return errorResponse(
            res,
            404,
            `No ${userRole} account found with this email.`,
          );
        }
        // Verify OTP for password reset
        await otpService.verifyOTP(phone || null, otp, purpose, email || null);
        // Return success - frontend will call reset-password endpoint with OTP
        return successResponse(
          res,
          200,
          "OTP verified. You can now reset your password.",
          {
            verified: true,
            email: user.email,
          },
        );
      }

      // At this point, either:
      // - user exists (normal login), or
      // - user does not exist but name is provided (auto-registration)
      // In both cases we must verify OTP first.
      await otpService.verifyOTP(phone || null, otp, purpose, email || null);

      if (!user) {
        // Auto-register new user after OTP verification
        const userData = {
          name,
          role: userRole,
          signupMethod: phone ? "phone" : "email",
        };

        if (phone) {
          userData.phone = phone;
          userData.phoneVerified = true;
        }
        // Only include email if provided (don't set to null)
        if (email) {
          userData.email = email;
        }

        if (password && !phone) {
          userData.password = password;
        }

        try {
          user = await User.create(userData);
        } catch (createError) {
          // Handle duplicate key error - user might have been created between findOne and create
          if (createError.code === 11000) {
            // Try to find the user again
            const findQuery = phone
              ? { phone, role: userRole }
              : { email, role: userRole };
            user = await User.findOne(findQuery);
            if (!user) {
              throw createError; // Re-throw if still not found
            }
            // User exists, continue with login flow
            logger.info(`User found after duplicate key error: ${user._id}`);
          } else {
            throw createError;
          }
        }

        logger.info(`New user auto-registered: ${user._id}`, {
          [identifierType]: identifier,
          userId: user._id,
          role: userRole,
        });
      } else {
        // Existing user login - update verification status if needed
        if (phone && !user.phoneVerified) {
          user.phoneVerified = true;
          await user.save();
        }
        // Could add email verification status update here if needed
      }
    }

    // Generate tokens
    const tokens = jwtService.generateTokens({
      userId: user._id.toString(),
      role: user.role,
      phone: user.phone,
    });

    // Set refresh token in httpOnly cookie
    res.cookie("refreshToken", tokens.refreshToken, getRefreshTokenCookieOptions());

    // Return access token and user info
    return successResponse(res, 200, "Authentication successful", {
      accessToken: tokens.accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        role: user.role,
        profileImage: user.profileImage,
        signupMethod: user.signupMethod,
      },
    });
  } catch (error) {
    logger.error(`Error verifying OTP: ${error.message}`);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * Register or refresh FCM device token for the currently authenticated user
 * POST /api/auth/fcm-token
 * Body: { platform: 'web' | 'app' | 'ios', fcmToken }
 */
export const registerFcmToken = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  // Support platform from body or query (Flutter may send as number: 0=web, 1=app, 2=android, 3=ios)
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
    return errorResponse(res, 400, "platform and fcmToken are required (body or query params)");
  }

  const validPlatforms = ["web", "app", "android", "ios"];
  if (!validPlatforms.includes(platform)) {
    return errorResponse(
      res,
      400,
      `Invalid platform. Allowed: web, app, android, ios. Received: "${platform}"`,
    );
  }

  const user = await User.findById(userId);
  if (!user) {
    return errorResponse(res, 404, "User not found");
  }

  // Update specific platform token (web, app/android, ios)
  if (platform === "web") {
    user.fcmTokenWeb = fcmToken;
  } else if (platform === "app" || platform === "android") {
    user.fcmTokenAndroid = fcmToken;
  } else if (platform === "ios") {
    user.fcmTokenIos = fcmToken;
  }

  await user.save();
  return successResponse(res, 200, "FCM token registered successfully", {
    fcmTokenWeb: user.fcmTokenWeb,
    fcmTokenAndroid: user.fcmTokenAndroid,
    fcmTokenIos: user.fcmTokenIos,
  });
});

/**
 * Remove FCM token for the current device on logout
 * DELETE /api/auth/fcm-token
 * Body: { platform: 'web' | 'app' | 'ios' }
 */
export const removeFcmToken = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  // Support platform from body or query (Flutter may send as number: 0=web, 1=app, 2=android, 3=ios)
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

  const user = await User.findById(userId);
  if (!user) {
    return errorResponse(res, 404, "User not found");
  }

  if (platform === "web") {
    user.fcmTokenWeb = null;
  } else if (platform === "app" || platform === "android") {
    user.fcmTokenAndroid = null;
  } else if (platform === "ios") {
    user.fcmTokenIos = null;
  }

  await user.save();

  return successResponse(res, 200, "FCM token removed successfully");
});

/**
 * Refresh Access Token
 * POST /api/auth/refresh-token
 */
export const refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return errorResponse(res, 401, "Refresh token not found");
  }

  try {
    // Verify refresh token
    const decoded = jwtService.verifyRefreshToken(refreshToken);

    // Get user
    const user = await User.findById(decoded.userId).select("-password");

    if (!user || !user.isActive) {
      return errorResponse(res, 401, "User not found or inactive");
    }

    // Generate new access token
    const accessToken = jwtService.generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
      phone: user.phone,
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
 * POST /api/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  // Clear refresh token cookie
  res.clearCookie("refreshToken", getClearRefreshTokenCookieOptions());

  return successResponse(res, 200, "Logged out successfully");
});

/**
 * Register with email and password
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role = "user" } = req.body;

  if (!name || !email || !password) {
    return errorResponse(res, 400, "Name, email, and password are required");
  }

  // Validate role - admin can be registered via email OTP
  const allowedRoles = ["user", "restaurant", "delivery", "admin"];
  const userRole = role || "user";
  if (!allowedRoles.includes(userRole)) {
    return errorResponse(
      res,
      400,
      `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
    );
  }

  // Check if user already exists with same email/phone AND role
  // Allow same email/phone for different roles
  const findQuery = {};
  if (email) findQuery.email = email;
  if (phone) findQuery.phone = phone;
  findQuery.role = userRole;

  const existingUser = await User.findOne(findQuery);

  if (existingUser) {
    if (existingUser.email === email) {
      return errorResponse(
        res,
        400,
        `User with this email and role (${userRole}) already exists. Please login.`,
      );
    }
    if (existingUser.phone === phone) {
      return errorResponse(
        res,
        400,
        `User with this phone number and role (${userRole}) already exists. Please login.`,
      );
    }
  }

  // Create new user
  const user = await User.create({
    name,
    email,
    password, // Will be hashed by pre-save hook
    phone: phone || null,
    role: userRole,
    signupMethod: "email", // Email/password registration
  });

  // Generate tokens
  const tokens = jwtService.generateTokens({
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  // Set refresh token in httpOnly cookie
  res.cookie("refreshToken", tokens.refreshToken, getRefreshTokenCookieOptions());

  logger.info(`New user registered via email: ${user._id}`, {
    email,
    userId: user._id,
    role: userRole,
  });

  // Send welcome email
  if (user.email) {
    // Import emailService dynamically to avoid circular dependencies if any
    const emailService = (await import("../services/emailService.js")).default;
    emailService.sendWelcomeEmail(user.email, user.name).catch((err) => {
      logger.error(`Failed to send welcome email: ${err.message}`);
    });
  }

  return successResponse(res, 201, "Registration successful", {
    accessToken: tokens.accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      role: user.role,
      profileImage: user.profileImage,
      signupMethod: user.signupMethod,
    },
  });
});

/**
 * Login with email and password
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return errorResponse(res, 400, "Email and password are required");
  }

  // Find user by email and role (if role provided) to ensure correct module access
  // If role not provided, find by email only (backward compatibility)
  const findQuery = { email };
  if (role) {
    findQuery.role = role;
  }

  const user = await User.findOne(findQuery).select("+password");

  if (!user) {
    return errorResponse(res, 401, "Invalid email or password");
  }

  // If role was provided but doesn't match, return error
  if (role && user.role !== role) {
    return errorResponse(
      res,
      401,
      `No ${role} account found with this email. Please check your credentials.`,
    );
  }

  if (!user.isActive) {
    return errorResponse(
      res,
      401,
      "Account is inactive. Please contact support.",
    );
  }

  // Check if user has a password set
  if (!user.password) {
    return errorResponse(
      res,
      400,
      "Account was created with phone. Please use OTP login.",
    );
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    return errorResponse(res, 401, "Invalid email or password");
  }

  // Generate tokens
  const tokens = jwtService.generateTokens({
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  // Set refresh token in httpOnly cookie
  res.cookie("refreshToken", tokens.refreshToken, getRefreshTokenCookieOptions());

  logger.info(`User logged in via email: ${user._id}`, {
    email,
    userId: user._id,
  });

  return successResponse(res, 200, "Login successful", {
    accessToken: tokens.accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      role: user.role,
      profileImage: user.profileImage,
      signupMethod: user.signupMethod,
    },
  });
});

/**
 * Reset Password with OTP verification
 * POST /api/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword, role } = req.body;

  if (!email || !otp || !newPassword) {
    return errorResponse(res, 400, "Email, OTP, and new password are required");
  }

  if (newPassword.length < 6) {
    return errorResponse(
      res,
      400,
      "Password must be at least 6 characters long",
    );
  }

  // Find user by email and role (if role provided) to ensure correct module access
  const findQuery = { email };
  if (role) {
    findQuery.role = role;
  }

  const user = await User.findOne(findQuery).select("+password");

  if (!user) {
    return errorResponse(
      res,
      404,
      role ? `No ${role} account found with this email.` : "User not found",
    );
  }

  // If role was provided but doesn't match, return error
  if (role && user.role !== role) {
    return errorResponse(res, 404, `No ${role} account found with this email.`);
  }

  // Verify OTP for reset-password purpose
  try {
    await otpService.verifyOTP(null, otp, "reset-password", email);
  } catch (error) {
    logger.error(
      `OTP verification failed for password reset: ${error.message}`,
    );
    return errorResponse(
      res,
      400,
      "Invalid or expired OTP. Please request a new one.",
    );
  }

  // Update password
  user.password = newPassword; // Will be hashed by pre-save hook
  await user.save();

  logger.info(`Password reset successful for user: ${user._id}`, {
    email,
    userId: user._id,
  });

  return successResponse(
    res,
    200,
    "Password reset successfully. Please login with your new password.",
  );
});

/**
 * Get current user
 * GET /api/auth/me
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  // User is attached by authenticate middleware
  return successResponse(res, 200, "User retrieved successfully", {
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      phoneVerified: req.user.phoneVerified,
      role: req.user.role,
      profileImage: req.user.profileImage,
      signupMethod: req.user.signupMethod,
      preferences: req.user.preferences,
      wallet: req.user.wallet,
      // Include additional profile fields
      dateOfBirth: req.user.dateOfBirth,
      anniversary: req.user.anniversary,
      gender: req.user.gender,
    },
  });
});

const FIREBASE_PROVIDER_CONFIG = {
  google: {
    tokenProviderId: "google.com",
    uidField: "googleId",
    emailField: "googleEmail",
    defaultName: "Google User",
    displayName: "Google",
  },
  apple: {
    tokenProviderId: "apple.com",
    uidField: "appleId",
    emailField: null,
    defaultName: "Apple User",
    displayName: "Apple",
  },
};

async function handleFirebaseSocialLogin(
  req,
  res,
  fallbackProvider = "google",
  defaultRole = "user",
) {
  const { idToken, role = defaultRole, provider = fallbackProvider } = req.body;

  if (!idToken) {
    return errorResponse(res, 400, "Firebase ID token is required");
  }

  const allowedRoles = ["user", "restaurant", "delivery"];
  const userRole = role || "user";
  if (!allowedRoles.includes(userRole)) {
    return errorResponse(
      res,
      400,
      `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
    );
  }

  const providerKey = String(provider || fallbackProvider).toLowerCase();
  const providerConfig = FIREBASE_PROVIDER_CONFIG[providerKey];
  if (!providerConfig) {
    return errorResponse(
      res,
      400,
      "Invalid Firebase provider. Allowed providers: google, apple",
    );
  }

  const firebaseReady = await firebaseAuthService.ensureInitialized();
  if (!firebaseReady) {
    return errorResponse(
      res,
      500,
      "Firebase Auth is not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in backend .env",
    );
  }

  try {
    const decoded = await firebaseAuthService.verifyIdToken(idToken);
    const tokenProviderId = decoded?.firebase?.sign_in_provider || "";

    if (tokenProviderId && tokenProviderId !== providerConfig.tokenProviderId) {
      return errorResponse(
        res,
        400,
        `This Firebase token was issued for ${tokenProviderId}, not ${providerConfig.tokenProviderId}.`,
      );
    }

    const firebaseUid = decoded.uid;
    const email = decoded.email ? decoded.email.toLowerCase().trim() : null;
    const name =
      decoded.name?.trim() ||
      decoded.display_name?.trim() ||
      providerConfig.defaultName;
    const picture = decoded.picture || decoded.photo_url || null;

    const lookupConditions = [{ [providerConfig.uidField]: firebaseUid }];
    if (email) {
      lookupConditions.push({ email, role: userRole });
    }

    let user = await User.findOne({ $or: lookupConditions });

    if (user) {
      if (user.role !== userRole) {
        return errorResponse(
          res,
          403,
          `This account is registered as ${user.role}, not ${userRole}`,
        );
      }

      let shouldSave = false;

      if (!user[providerConfig.uidField]) {
        user[providerConfig.uidField] = firebaseUid;
        shouldSave = true;
      }
      if (providerConfig.emailField && email && !user[providerConfig.emailField]) {
        user[providerConfig.emailField] = email;
        shouldSave = true;
      }
      if (email && !user.email) {
        user.email = email;
        shouldSave = true;
      }
      if (!user.name && name) {
        user.name = name;
        shouldSave = true;
      }
      if (!user.profileImage && picture) {
        user.profileImage = picture;
        shouldSave = true;
      }
      if (user.signupMethod !== providerKey) {
        user.signupMethod = providerKey;
        shouldSave = true;
      }
      if (user.authProvider !== providerKey) {
        user.authProvider = providerKey;
        shouldSave = true;
      }

      if (shouldSave) {
        await user.save();
      }
    } else {
      const userData = {
        name,
        role: userRole,
        signupMethod: providerKey,
        authProvider: providerKey,
        profileImage: picture || null,
        isActive: true,
        [providerConfig.uidField]: firebaseUid,
      };

      if (email) {
        userData.email = email;
      }
      if (providerConfig.emailField && email) {
        userData[providerConfig.emailField] = email;
      }

      try {
        user = await User.create(userData);
      } catch (createError) {
        if (createError.code === 11000 && email) {
          user = await User.findOne({ email, role: userRole });
          if (!user) {
            throw createError;
          }

          let shouldSave = false;
          if (!user[providerConfig.uidField]) {
            user[providerConfig.uidField] = firebaseUid;
            shouldSave = true;
          }
          if (providerConfig.emailField && !user[providerConfig.emailField]) {
            user[providerConfig.emailField] = email;
            shouldSave = true;
          }
          if (!user.signupMethod) {
            user.signupMethod = providerKey;
            shouldSave = true;
          }
          if (user.authProvider !== providerKey) {
            user.authProvider = providerKey;
            shouldSave = true;
          }
          if (!user.profileImage && picture) {
            user.profileImage = picture;
            shouldSave = true;
          }
          if (shouldSave) {
            await user.save();
          }
        } else {
          throw createError;
        }
      }
    }

    if (!user.isActive) {
      logger.warn("Inactive user attempted login", { userId: user._id, email });
      return errorResponse(
        res,
        403,
        "Your account has been deactivated. Please contact support.",
      );
    }

    const tokens = jwtService.generateTokens({
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    res.cookie("refreshToken", tokens.refreshToken, getRefreshTokenCookieOptions());

    return successResponse(
      res,
      200,
      `Firebase ${providerConfig.displayName} authentication successful`,
      {
        accessToken: tokens.accessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          phoneVerified: user.phoneVerified,
          role: user.role,
          profileImage: user.profileImage,
          signupMethod: user.signupMethod,
          authProvider: user.authProvider,
        },
      },
    );
  } catch (error) {
    logger.error(`Error in Firebase ${providerConfig.displayName} login: ${error.message}`);
    return errorResponse(
      res,
      400,
      error.message || `Firebase ${providerConfig.displayName} authentication failed`,
    );
  }
}

/**
 * Login / register using Firebase Google ID token
 * POST /api/auth/firebase/google-login
 */
export const firebaseGoogleLogin = asyncHandler(async (req, res) => {
  return handleFirebaseSocialLogin(req, res, "google", "restaurant");
});

/**
 * Login / register using Firebase social ID token
 * POST /api/auth/firebase/social-login
 */
export const firebaseSocialLogin = asyncHandler(async (req, res) => {
  return handleFirebaseSocialLogin(req, res, "google", "user");
});



/**
 * Initiate Google OAuth flow
 * GET /api/auth/google/:role
 */
export const googleAuth = asyncHandler(async (req, res) => {
  const { role } = req.params;

  // Validate role
  const allowedRoles = ["user", "restaurant", "delivery"];
  const userRole = role || "restaurant";

  if (!allowedRoles.includes(userRole)) {
    return errorResponse(
      res,
      400,
      `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
    );
  }

  // Check if Google OAuth is configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return errorResponse(
      res,
      500,
      "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
    );
  }

  try {
    const { authUrl, state } = googleAuthService.getAuthUrl(userRole);

    // Store state in session/cookie for verification (optional, for extra security)
    res.cookie("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    // Redirect to Google OAuth
    return res.redirect(authUrl);
  } catch (error) {
    logger.error(`Error initiating Google OAuth: ${error.message}`);
    return errorResponse(res, 500, "Failed to initiate Google OAuth");
  }
});

/**
 * Handle Google OAuth callback
 * GET /api/auth/google/:role/callback
 */
export const googleCallback = asyncHandler(async (req, res) => {
  const { role } = req.params;
  const { code, state, error } = req.query;

  // Validate role
  const allowedRoles = ["user", "restaurant", "delivery"];
  const userRole = role || "restaurant";

  if (!allowedRoles.includes(userRole)) {
    return errorResponse(
      res,
      400,
      `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
    );
  }

  // Check for OAuth errors
  if (error) {
    logger.error(`Google OAuth error: ${error}`);
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/restaurant/login?error=oauth_failed`,
    );
  }

  if (!code) {
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/restaurant/login?error=no_code`,
    );
  }

  // Verify state (optional but recommended)
  const storedState = req.cookies?.oauth_state;
  if (storedState && state !== storedState) {
    logger.warn("OAuth state mismatch - possible CSRF attack");
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/restaurant/login?error=invalid_state`,
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await googleAuthService.getTokens(code);

    // Get user info from Google
    const googleUser = await googleAuthService.getUserInfoFromToken(tokens);

    if (!googleUser.email) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/restaurant/login?error=no_email`,
      );
    }

    // Find or create user
    let user = await User.findOne({
      $or: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
    });

    if (user) {
      // Update Google info if not set
      if (!user.googleId) {
        user.googleId = googleUser.googleId;
        user.googleEmail = googleUser.email;
        if (!user.profileImage && googleUser.picture) {
          user.profileImage = googleUser.picture;
        }
        // Update signupMethod if not already set
        if (!user.signupMethod) {
          user.signupMethod = "google";
        }
        await user.save();
      }

      // Ensure role matches (for restaurant login, user should be restaurant)
      if (userRole === "restaurant" && user.role !== "restaurant") {
        return res.redirect(
          `${process.env.FRONTEND_URL || "http://localhost:5173"}/restaurant/login?error=wrong_role`,
        );
      }
    } else {
      // Create new user
      const userData = {
        name: googleUser.name || "Google User",
        email: googleUser.email,
        googleId: googleUser.googleId,
        googleEmail: googleUser.email,
        role: userRole,
        signupMethod: "google",
        profileImage: googleUser.picture || null,
      };

      user = await User.create(userData);
      logger.info(`New user registered via Google: ${user._id}`, {
        email: googleUser.email,
        userId: user._id,
        role: userRole,
      });
    }

    // Generate JWT tokens
    const jwtTokens = jwtService.generateTokens({
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    // Set refresh token in httpOnly cookie
    res.cookie(
      "refreshToken",
      jwtTokens.refreshToken,
      getRefreshTokenCookieOptions(),
    );

    // Clear OAuth state cookie
    res.clearCookie("oauth_state");

    // Redirect to frontend with access token as query param
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const redirectPath =
      userRole === "restaurant"
        ? "/restaurant/auth/google-callback"
        : userRole === "delivery"
          ? "/delivery/auth/google-callback"
          : "/user/auth/google-callback";

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      role: user.role,
      profileImage: user.profileImage,
      signupMethod: user.signupMethod,
    };

    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error(`Error in Google OAuth callback: ${error.message}`);
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/restaurant/login?error=auth_failed`,
    );
  }
});

/**
 * Login / register using Apple identity token
 * POST /api/auth/apple
 */
export const appleLogin = asyncHandler(async (req, res) => {
  const { identityToken, role = "user", name } = req.body;

  if (!identityToken) {
    return errorResponse(res, 400, "Apple identity token is required");
  }

  const allowedRoles = ["user", "restaurant", "delivery"];
  const userRole = role || "user";
  if (!allowedRoles.includes(userRole)) {
    return errorResponse(
      res,
      400,
      `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
    );
  }

  const clientId = (await getEnvVar("APPLE_CLIENT_ID")) || process.env.APPLE_CLIENT_ID;
  if (!clientId) {
    return errorResponse(
      res,
      500,
      "Apple Sign-In is not configured. Please set APPLE_CLIENT_ID in backend .env",
    );
  }

  let applePayload;
  try {
    applePayload = await appleAuthService.verifyIdentityToken(
      identityToken,
      clientId,
    );
  } catch (error) {
    logger.error("Apple login failed during token verification", {
      message: error.message,
    });
    return errorResponse(res, 400, error.message);
  }

  const appleId = applePayload?.sub;
  if (!appleId) {
    return errorResponse(
      res,
      400,
      "Apple user identifier (sub) is missing from the identity token",
    );
  }

  const normalizedEmail = applePayload?.email
    ? applePayload.email.toLowerCase().trim()
    : null;

  const lookupConditions = [{ appleId }];
  if (normalizedEmail) {
    lookupConditions.push({ email: normalizedEmail, role: userRole });
  }

  let user = await User.findOne({ $or: lookupConditions });

  if (user && user.role !== userRole) {
    return errorResponse(
      res,
      403,
      `This account is registered as ${user.role}, not ${userRole}`,
    );
  }

  if (user) {
    let shouldSave = false;
    if (!user.appleId) {
      user.appleId = appleId;
      shouldSave = true;
    }
    if (normalizedEmail && !user.email) {
      user.email = normalizedEmail;
      shouldSave = true;
    }
    if (!user.signupMethod) {
      user.signupMethod = "apple";
      shouldSave = true;
    }
    if (user.authProvider !== "apple") {
      user.authProvider = "apple";
      shouldSave = true;
    }
    if (shouldSave) {
      await user.save();
      logger.info("Linked Apple account to existing user", {
        userId: user._id,
        email: user.email,
      });
    } else {
      logger.info("Existing Apple user logged in", {
        userId: user._id,
        email: user.email,
      });
    }
  } else {
    const trimmedName = name?.trim();
    const fallbackName =
      trimmedName ||
      normalizedEmail?.split("@")[0] ||
      "Apple User";

    const newUserData = {
      name: fallbackName,
      appleId,
      role: userRole,
      signupMethod: "apple",
      authProvider: "apple",
      isActive: true,
    };
    if (normalizedEmail) {
      newUserData.email = normalizedEmail;
    }

    try {
      user = await User.create(newUserData);
      logger.info("New user registered via Apple login", {
        userId: user._id,
        email: user.email,
        role: user.role,
      });
    } catch (createError) {
      if (createError.code === 11000) {
        logger.warn("Duplicate key during Apple registration, retrying lookup", {
          error: createError.message,
          email: normalizedEmail,
        });
        const fallbackQuery = { $or: [{ appleId }] };
        if (normalizedEmail) {
          fallbackQuery.$or.push({ email: normalizedEmail, role: userRole });
        }
        user = await User.findOne(fallbackQuery);
        if (!user) {
          logger.error(
            "Apple user not found after duplicate key error",
            { email: normalizedEmail, role: userRole },
          );
          throw createError;
        }
        let shouldSave = false;
        if (!user.appleId) {
          user.appleId = appleId;
          shouldSave = true;
        }
        if (!user.signupMethod) {
          user.signupMethod = "apple";
          shouldSave = true;
        }
        if (user.authProvider !== "apple") {
          user.authProvider = "apple";
          shouldSave = true;
        }
        if (normalizedEmail && !user.email) {
          user.email = normalizedEmail;
          shouldSave = true;
        }
        if (shouldSave) {
          await user.save();
        }
      } else {
        throw createError;
      }
    }
  }

  if (!user) {
    return errorResponse(res, 500, "Unable to process Apple user");
  }

  if (!user.isActive) {
    logger.warn("Inactive user attempted Apple login", {
      userId: user._id,
    });
    return errorResponse(
      res,
      403,
      "Your account has been deactivated. Please contact support.",
    );
  }

  const tokens = jwtService.generateTokens({
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  res.cookie("refreshToken", tokens.refreshToken, getRefreshTokenCookieOptions());

  return successResponse(
    res,
    200,
    "Apple authentication successful",
    {
      accessToken: tokens.accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        role: user.role,
        profileImage: user.profileImage,
        signupMethod: user.signupMethod,
        authProvider: user.authProvider,
      },
    },
  );
});

/**
 * GET /api/auth/apple/config
 */
export const getAppleConfig = asyncHandler(async (req, res) => {
  // Prioritize process.env for fundamental OAuth config to prevent DB overrides from breaking auth flow
  let clientId = process.env.APPLE_CLIENT_ID;
  let redirectUri = process.env.APPLE_REDIRECT_URI;

  // Fallback to database if not in env
  if (!clientId) {
    clientId = await getEnvVar("APPLE_CLIENT_ID");
  }
  if (!redirectUri) {
    redirectUri = await getEnvVar("APPLE_REDIRECT_URI");
  }

  // Final cleanup
  clientId = (clientId || "").toString().trim().replace(/^"|"$/g, "");
  redirectUri = (redirectUri || "").toString().trim().replace(/^"|"$/g, "");

  // Robustness check: If redirectUri is missing or empty, try to construct it from current request
  if (!redirectUri) {
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    redirectUri = `${protocol}://${host}/api/auth/apple/callback`;
    logger.info("Apple redirectUri was empty, constructed from request", { redirectUri });
  }

  logger.info("Apple config requested", {
    clientId,
    redirectUri,
    envRedirect: process.env.APPLE_REDIRECT_URI ? "present" : "missing",
    dbRedirect: (await getEnvVar("APPLE_REDIRECT_URI")) ? "present" : "missing"
  });

  return successResponse(res, 200, "Apple config fetched successfully", {
    clientId,
    redirectUri,
  });
});

/**
 * Handle Apple OAuth callback (POST from Apple)
 * POST /api/auth/apple/callback
 */
export const appleCallback = asyncHandler(async (req, res) => {
  // 1. Robustly extract data from both body and query
  const body = req.body || {};
  const query = req.query || {};

  const code = body.code || query.code;
  const id_token = body.id_token || query.id_token;
  const state = body.state || query.state; // Role is usually passed in state
  const appleUserJson = body.user || query.user;
  const error = body.error || query.error;
  const passedClientId = body.clientId || query.clientId;

  // 2. Logging for production debugging
  logger.info("Apple OAuth callback received", {
    method: req.method,
    url: req.originalUrl,
    hasCode: !!code,
    hasIdToken: !!id_token,
    hasAppleUser: !!appleUserJson,
    state,
    error,
    body: JSON.stringify(body),
    query: JSON.stringify(query)
  });

  console.log("🍎 Apple Callback Debug:", {
    method: req.method,
    code: code ? (code.substring(0, 5) + "...") : null,
    error
  });

  // Determine redirection target (Frontend App)
  const frontendUrl = getEnvVar("FRONTEND_URL") || "https://app.tifunbox.com";
  const loginUrl = `${frontendUrl}/user/auth/sign-in`;
  // Use /auth/callback as defined in UserRouter.jsx
  const callbackPageUrl = `${frontendUrl}/auth/callback`;

  // Helper for safe error responses (supports both popup and redirect)
  const sendErrorResponse = (errCode, message) => {
    logger.error(`Apple Login Error: ${errCode}`, { message });

    // If it's a native app or specific JSON request
    const isNative = req.headers["user-agent"]?.includes("Dart") || req.headers["user-agent"]?.includes("Flutter");
    if (isNative || req.headers["accept"]?.includes("application/json")) {
      return errorResponse(res, 400, message || errCode);
    }

    // Add CSP header to allow the inline script we're about to send
    res.setHeader("Content-Security-Policy", "script-src 'self' 'unsafe-inline';");

    // Try popup message first, then fallback to redirect
    return res.status(200).send(`
      <script>
        (function() {
          var errorData = { 
            type: 'APPLE_LOGIN_ERROR', 
            error: '${errCode}', 
            message: '${(message || "").replace(/'/g, "\\'")}' 
          };
          console.log("Apple Login Error:", errorData);
          if (window.opener) {
            window.opener.postMessage(errorData, '*');
            setTimeout(function() { window.close(); }, 500);
          } else {
            window.location.href = "${loginUrl}?error=${errCode}";
          }
        })();
      </script>
    `);
  };

  if (error) {
    return sendErrorResponse(error, "Apple authentication error");
  }

  if (!code) {
    return sendErrorResponse("apple_no_code", "Authorization code is missing");
  }

  try {
    // 3. Exchange code for tokens
    logger.info("[AppleAuth] Logic reached. Starting code exchange...");

    let tokens;
    try {
      tokens = await appleAuthService.exchangeCode(code, null, passedClientId);
      logger.info("[AppleAuth] Step 1: Code exchange successful");
    } catch (exchangeError) {
      const isMismatch = exchangeError.message.includes("client_id mismatch") || exchangeError.message.includes("invalid_client");
      if (isMismatch) {
        logger.info("[AppleAuth] Step 1 Fallback: Retrying with app.tifunbox.com...");
        tokens = await appleAuthService.exchangeCode(code, null, "app.tifunbox.com");
      } else {
        throw exchangeError;
      }
    }

    const identityToken = tokens.id_token || id_token;

    // 4. Verify token
    logger.info("[AppleAuth] Step 2: Verifying identity token...");
    const applePayload = await appleAuthService.verifyIdentityToken(identityToken);
    logger.info("[AppleAuth] Step 2 Success: Token verified", { sub: applePayload.sub });

    const appleId = applePayload.sub;
    const email = applePayload.email?.toLowerCase().trim();

    // Parse user object if provided (Apple only sends this on first-time login)
    let firstName = "";
    let lastName = "";
    if (appleUserJson) {
      try {
        const parsed = typeof appleUserJson === 'string' ? JSON.parse(appleUserJson) : appleUserJson;
        firstName = parsed.name?.firstName || "";
        lastName = parsed.name?.lastName || "";
      } catch (e) {
        logger.warn("Failed to parse Apple user JSON", { appleUserJson });
      }
    }

    const fullName = [firstName, lastName].filter(Boolean).join(" ") || email?.split("@")[0] || "Apple User";
    const userRole = state || "user";

    // 5. Find or create user
    const lookupConditions = [{ appleId }];
    if (email) {
      lookupConditions.push({ email, role: userRole });
    }

    let user = await User.findOne({ $or: lookupConditions });

    if (user && user.role !== userRole) {
      return sendErrorResponse("wrong_role", `This account is registered as ${user.role}, not ${userRole}`);
    }

    if (user) {
      // Update existing user
      let shouldSave = false;
      if (!user.appleId) { user.appleId = appleId; shouldSave = true; }
      if (user.signupMethod !== "apple") { user.signupMethod = "apple"; shouldSave = true; }
      if (user.authProvider !== "apple") { user.authProvider = "apple"; shouldSave = true; }
      if (shouldSave) await user.save();
    } else {
      // Create new user
      user = await User.create({
        name: fullName,
        email,
        appleId,
        role: userRole,
        signupMethod: "apple",
        authProvider: "apple",
        isActive: true,
      });
    }

    if (!user.isActive) {
      return sendErrorResponse("account_deactivated", "Account is inactive. Please contact support.");
    }

    // 6. Generate session tokens
    const jwtTokens = jwtService.generateTokens({
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    // Set refresh token cookie
    res.cookie("refreshToken", jwtTokens.refreshToken, getRefreshTokenCookieOptions());

    // 7. Success Response (supports Popup postMessage and Redirect)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      signupMethod: user.signupMethod,
    };

    const successData = {
      type: 'APPLE_LOGIN_SUCCESS',
      token: jwtTokens.accessToken,
      user: userData,
      provider: 'apple'
    };

    // Support JSON response for native apps (Mobile)
    const isNative = req.headers["user-agent"]?.includes("Dart") || req.headers["user-agent"]?.includes("Flutter");
    if (isNative || req.headers["accept"]?.includes("application/json")) {
      return successResponse(res, 200, "Apple auth successful", {
        accessToken: jwtTokens.accessToken,
        user: userData,
        provider: 'apple'
      });
    }

    // Add CSP header to allow the inline script we're about to send
    res.setHeader("Content-Security-Policy", "script-src 'self' 'unsafe-inline';");

    // Robust delivery mechanism for Web
    return res.status(200).send(`
      <script>
        (function() {
          var data = ${JSON.stringify(successData)};
          
          if (window.opener) {
            // Popup flow
            window.opener.postMessage(data, '*');
            setTimeout(function() { window.close(); }, 500);
          } else {
            // Full-page redirect flow
            var token = data.token;
            var userParam = encodeURIComponent(JSON.stringify(data.user));
            window.location.href = "${callbackPageUrl}?token=" + token + "&user=" + userParam + "&provider=apple";
          }
        })();
      </script>
    `);

  } catch (err) {
    logger.error("Apple callback processing failed", { message: err.message, stack: err.stack });
    return sendErrorResponse("processing_failed", err.message);
  }
});
