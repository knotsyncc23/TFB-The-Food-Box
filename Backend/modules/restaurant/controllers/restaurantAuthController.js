import Restaurant from "../models/Restaurant.js";
import otpService from "../../auth/services/otpService.js";
import jwtService from "../../auth/services/jwtService.js";
import firebaseAuthService from "../../auth/services/firebaseAuthService.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import { normalizePhoneNumber } from "../../../shared/utils/phoneUtils.js";
import {
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions,
} from "../../../config/refreshCookie.js";
import winston from "winston";

/**
 * Build phone query that searches in multiple formats (with/without country code)
 * This handles both old data (without country code) and new data (with country code)
 */
const buildPhoneQuery = (normalizedPhone) => {
  if (!normalizedPhone) return null;

  // Check if normalized phone has country code (starts with 91 and is 12 digits)
  if (normalizedPhone.startsWith("91") && normalizedPhone.length === 12) {
    // Search for both: with country code (917610416911) and without (7610416911)
    const phoneWithoutCountryCode = normalizedPhone.substring(2);
    return {
      $or: [
        { phone: normalizedPhone },
        { phone: phoneWithoutCountryCode },
        { phone: `+${normalizedPhone}` },
        { phone: `+91${phoneWithoutCountryCode}` },
      ],
    };
  } else {
    // If it's already without country code, also check with country code
    return {
      $or: [
        { phone: normalizedPhone },
        { phone: `91${normalizedPhone}` },
        { phone: `+91${normalizedPhone}` },
        { phone: `+${normalizedPhone}` },
      ],
    };
  }
};

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
 * Send OTP for restaurant phone number or email
 * POST /api/restaurant/auth/send-otp
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
 * Verify OTP and login/register restaurant
 * POST /api/restaurant/auth/verify-otp
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, email, otp, purpose = "login", name, password } = req.body;

  // Validate that either phone or email is provided
  if ((!phone && !email) || !otp) {
    return errorResponse(
      res,
      400,
      "Either phone number or email, and OTP are required",
    );
  }

  try {
    let restaurant;
    // Normalize phone number if provided
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
    if (phone && !normalizedPhone) {
      return errorResponse(res, 400, "Invalid phone number format");
    }

    const identifier = normalizedPhone || email;
    const identifierType = normalizedPhone ? "phone" : "email";

    if (purpose === "register") {
      // Registration flow
      // Check if restaurant already exists with normalized phone
      // For phone, search in both formats (with and without country code) to handle old data
      const findQuery = normalizedPhone
        ? buildPhoneQuery(normalizedPhone)
        : { email: email?.toLowerCase().trim() };
      restaurant = await Restaurant.findOne(findQuery);

      if (restaurant) {
        return errorResponse(
          res,
          400,
          `Restaurant already exists with this ${identifierType}. Please login.`,
        );
      }

      // Name is mandatory for explicit registration
      if (!name) {
        return errorResponse(
          res,
          400,
          "Restaurant name is required for registration",
        );
      }

      // Verify OTP (phone or email) before creating restaurant
      await otpService.verifyOTP(phone || null, otp, purpose, email || null);

      const restaurantData = {
        name,
        signupMethod: normalizedPhone ? "phone" : "email",
      };

      if (normalizedPhone) {
        restaurantData.phone = normalizedPhone;
        restaurantData.phoneVerified = true;
        restaurantData.ownerPhone = normalizedPhone;
        // For phone signup, set ownerEmail to empty string or phone-based email
        restaurantData.ownerEmail =
          email || `${normalizedPhone}@restaurant.appzeto.com`;
        // CRITICAL: Do NOT set email field for phone signups to avoid null duplicate key error
        // Email field should be completely omitted, not set to null or undefined
      }
      if (email) {
        restaurantData.email = email.toLowerCase().trim();
        restaurantData.ownerEmail = email.toLowerCase().trim();
      }
      // Ensure email is not set to null or undefined
      if (!email && !phone) {
        // This shouldn't happen due to validation, but just in case
        throw new Error("Either phone or email must be provided");
      }

      // If password provided (email/password registration), set it
      if (password && !phone) {
        restaurantData.password = password;
      }

      // Set owner name from restaurant name if not provided separately
      restaurantData.ownerName = name;

      // Set isActive to false - restaurant needs admin approval before becoming active
      restaurantData.isActive = false;

      try {
        // For phone signups, use $unset to ensure email field is not saved
        if (phone && !email) {
          // Use collection.insertOne directly to have full control over the document
          const docToInsert = { ...restaurantData };
          // Explicitly remove email field
          delete docToInsert.email;
          restaurant = await Restaurant.create(docToInsert);
        } else {
          restaurant = await Restaurant.create(restaurantData);
        }
        logger.info(`New restaurant registered: ${restaurant._id}`, {
          [identifierType]: identifier,
          restaurantId: restaurant._id,
        });
      } catch (createError) {
        logger.error(`Error creating restaurant: ${createError.message}`, {
          code: createError.code,
          keyPattern: createError.keyPattern,
          phone,
          email,
          restaurantData: { ...restaurantData, password: "***" },
        });

        // Handle duplicate key error (email, phone, or slug)
        if (createError.code === 11000) {
          // Check if it's an email null duplicate key error (common with phone signups)
          if (
            createError.keyPattern &&
            createError.keyPattern.email &&
            phone &&
            !email
          ) {
            logger.warn(
              `Email null duplicate key error for phone signup: ${phone}`,
              {
                error: createError.message,
                keyPattern: createError.keyPattern,
              },
            );
            // Try to find existing restaurant by phone
            restaurant = await Restaurant.findOne({ phone });
            if (restaurant) {
              return errorResponse(
                res,
                400,
                `Restaurant already exists with this phone number. Please login.`,
              );
            }
            // If not found, this is likely a database index issue - ensure email is completely removed
            // Create a fresh restaurantData object without email field
            const retryRestaurantData = {
              name: restaurantData.name,
              signupMethod: restaurantData.signupMethod,
              phone: restaurantData.phone,
              phoneVerified: restaurantData.phoneVerified,
              ownerPhone: restaurantData.ownerPhone,
              ownerEmail: restaurantData.ownerEmail,
              ownerName: restaurantData.ownerName,
              isActive: restaurantData.isActive,
            };
            // Explicitly do NOT include email field
            if (restaurantData.password) {
              retryRestaurantData.password = restaurantData.password;
            }
            try {
              restaurant = await Restaurant.create(retryRestaurantData);
              logger.info(
                `New restaurant registered (fixed email null issue): ${restaurant._id}`,
                {
                  [identifierType]: identifier,
                  restaurantId: restaurant._id,
                },
              );
            } catch (retryError) {
              logger.error(
                `Failed to create restaurant after email null fix: ${retryError.message}`,
                {
                  code: retryError.code,
                  keyPattern: retryError.keyPattern,
                  error: retryError,
                },
              );
              // Check if it's still a duplicate key error
              if (retryError.code === 11000) {
                // Try to find restaurant again (search in both formats)
                const phoneQuery = buildPhoneQuery(normalizedPhone) || {
                  phone: normalizedPhone,
                };
                restaurant = await Restaurant.findOne(phoneQuery);
                if (restaurant) {
                  return errorResponse(
                    res,
                    400,
                    `Restaurant already exists with this phone number. Please login.`,
                  );
                }
              }
              throw new Error(
                `Failed to create restaurant: ${retryError.message}. Please contact support.`,
              );
            }
          } else if (createError.keyPattern && createError.keyPattern.phone) {
            // Phone duplicate key error - search in both formats
            const phoneQuery = buildPhoneQuery(normalizedPhone) || {
              phone: normalizedPhone,
            };
            restaurant = await Restaurant.findOne(phoneQuery);
            if (restaurant) {
              return errorResponse(
                res,
                400,
                `Restaurant already exists with this phone number. Please login.`,
              );
            }
            throw new Error(
              `Phone number already exists: ${createError.message}`,
            );
          } else if (createError.keyPattern && createError.keyPattern.slug) {
            // Check if it's a slug conflict
            // Retry with unique slug
            const baseSlug = restaurantData.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "");
            let counter = 1;
            let uniqueSlug = `${baseSlug}-${counter}`;
            while (await Restaurant.findOne({ slug: uniqueSlug })) {
              counter++;
              uniqueSlug = `${baseSlug}-${counter}`;
            }
            restaurantData.slug = uniqueSlug;
            try {
              restaurant = await Restaurant.create(restaurantData);
              logger.info(
                `New restaurant registered with unique slug: ${restaurant._id}`,
                {
                  [identifierType]: identifier,
                  restaurantId: restaurant._id,
                  slug: uniqueSlug,
                },
              );
            } catch (retryError) {
              // If still fails, check if restaurant exists
              const findQuery = normalizedPhone
                ? { phone: normalizedPhone }
                : { email: email?.toLowerCase().trim() };
              restaurant = await Restaurant.findOne(findQuery);
              if (!restaurant) {
                throw retryError;
              }
              return errorResponse(
                res,
                400,
                `Restaurant already exists with this ${identifierType}. Please login.`,
              );
            }
          } else {
            // Other duplicate key errors (email, phone)
            const findQuery = normalizedPhone
              ? { phone: normalizedPhone }
              : { email: email?.toLowerCase().trim() };
            restaurant = await Restaurant.findOne(findQuery);
            if (!restaurant) {
              throw createError;
            }
            return errorResponse(
              res,
              400,
              `Restaurant already exists with this ${identifierType}. Please login.`,
            );
          }
        } else {
          throw createError;
        }
      }
    } else {
      // Login (with optional auto-registration)
      // For phone, search in both formats (with and without country code) to handle old data
      let findQuery;
      if (normalizedPhone) {
        // Check if normalized phone has country code (starts with 91 and is 12 digits)
        if (normalizedPhone.startsWith("91") && normalizedPhone.length === 12) {
          // Search for both: with country code (917610416911) and without (7610416911)
          const phoneWithoutCountryCode = normalizedPhone.substring(2);
          findQuery = {
            $or: [
              { phone: normalizedPhone },
              { phone: phoneWithoutCountryCode },
              { phone: `+${normalizedPhone}` },
              { phone: `+91${phoneWithoutCountryCode}` },
            ],
          };
        } else {
          // If it's already without country code, also check with country code
          findQuery = {
            $or: [
              { phone: normalizedPhone },
              { phone: `91${normalizedPhone}` },
              { phone: `+91${normalizedPhone}` },
              { phone: `+${normalizedPhone}` },
            ],
          };
        }
      } else {
        findQuery = { email: email?.toLowerCase().trim() };
      }
      restaurant = await Restaurant.findOne(findQuery);

      if (!restaurant && !name) {
        // Tell the client that we need restaurant name to proceed with auto-registration
        return successResponse(
          res,
          200,
          "Restaurant not found. Please provide restaurant name for registration.",
          {
            needsName: true,
            identifierType,
            identifier,
          },
        );
      }

      // Handle reset-password purpose
      if (purpose === "reset-password") {
        if (!restaurant) {
          return errorResponse(
            res,
            404,
            "No restaurant account found with this email.",
          );
        }
        // Verify OTP for password reset
        await otpService.verifyOTP(phone || null, otp, purpose, email || null);
        return successResponse(
          res,
          200,
          "OTP verified. You can now reset your password.",
          {
            verified: true,
            email: restaurant.email,
          },
        );
      }

      // Verify OTP first
      await otpService.verifyOTP(phone || null, otp, purpose, email || null);

      if (!restaurant) {
        // Auto-register new restaurant after OTP verification
        const restaurantData = {
          name,
          signupMethod: normalizedPhone ? "phone" : "email",
        };

        if (normalizedPhone) {
          restaurantData.phone = normalizedPhone;
          restaurantData.phoneVerified = true;
          restaurantData.ownerPhone = normalizedPhone;
          // For phone signup, set ownerEmail to empty string or phone-based email
          restaurantData.ownerEmail =
            email || `${normalizedPhone}@restaurant.appzeto.com`;
          // Explicitly don't set email field for phone signups to avoid null duplicate key error
        }
        if (email) {
          restaurantData.email = email.toLowerCase().trim();
          restaurantData.ownerEmail = email.toLowerCase().trim();
        }
        // Ensure email is not set to null or undefined
        if (!email && !phone) {
          // This shouldn't happen due to validation, but just in case
          throw new Error("Either phone or email must be provided");
        }

        if (password && !phone) {
          restaurantData.password = password;
        }

        restaurantData.ownerName = name;

        // Set isActive to false - restaurant needs admin approval before becoming active
        // Auto-approve in development
        restaurantData.isActive = process.env.NODE_ENV === "development";

        try {
          // For phone signups, ensure email field is not included
          if (phone && !email) {
            const docToInsert = { ...restaurantData };
            // Explicitly remove email field
            delete docToInsert.email;
            restaurant = await Restaurant.create(docToInsert);
          } else {
            restaurant = await Restaurant.create(restaurantData);
          }
          logger.info(`New restaurant auto-registered: ${restaurant._id}`, {
            [identifierType]: identifier,
            restaurantId: restaurant._id,
          });
        } catch (createError) {
          logger.error(
            `Error creating restaurant (auto-register): ${createError.message}`,
            {
              code: createError.code,
              keyPattern: createError.keyPattern,
              phone,
              email,
              restaurantData: { ...restaurantData, password: "***" },
            },
          );

          if (createError.code === 11000) {
            // Check if it's an email null duplicate key error (common with phone signups)
            if (
              createError.keyPattern &&
              createError.keyPattern.email &&
              phone &&
              !email
            ) {
              logger.warn(
                `Email null duplicate key error for phone signup: ${phone}`,
                {
                  error: createError.message,
                  keyPattern: createError.keyPattern,
                },
              );
              // Try to find existing restaurant by phone (search in both formats)
              const phoneQuery = buildPhoneQuery(normalizedPhone) || { phone };
              restaurant = await Restaurant.findOne(phoneQuery);
              if (restaurant) {
                logger.info(
                  `Restaurant found after email null duplicate key error: ${restaurant._id}`,
                );
                // Continue with login flow
              } else {
                // If not found, this is likely a database index issue - ensure email is completely removed
                // Create a fresh restaurantData object without email field
                const retryRestaurantData = {
                  name: restaurantData.name,
                  signupMethod: restaurantData.signupMethod,
                  phone: restaurantData.phone,
                  phoneVerified: restaurantData.phoneVerified,
                  ownerPhone: restaurantData.ownerPhone,
                  ownerEmail: restaurantData.ownerEmail,
                  ownerName: restaurantData.ownerName,
                  isActive: restaurantData.isActive,
                };
                // Explicitly do NOT include email field
                if (restaurantData.password) {
                  retryRestaurantData.password = restaurantData.password;
                }
                try {
                  restaurant = await Restaurant.create(retryRestaurantData);
                  logger.info(
                    `New restaurant auto-registered (fixed email null issue): ${restaurant._id}`,
                    {
                      [identifierType]: identifier,
                      restaurantId: restaurant._id,
                    },
                  );
                } catch (retryError) {
                  logger.error(
                    `Failed to create restaurant after email null fix: ${retryError.message}`,
                    {
                      code: retryError.code,
                      keyPattern: retryError.keyPattern,
                      error: retryError,
                    },
                  );
                  // Check if it's still a duplicate key error
                  if (retryError.code === 11000) {
                    // Try to find restaurant again (search in both formats)
                    const phoneQuery = buildPhoneQuery(normalizedPhone) || {
                      phone,
                    };
                    restaurant = await Restaurant.findOne(phoneQuery);
                    if (restaurant) {
                      logger.info(
                        `Restaurant found after retry error: ${restaurant._id}`,
                      );
                      // Continue with login flow
                    } else {
                      throw new Error(
                        `Failed to create restaurant: ${retryError.message}. Please contact support.`,
                      );
                    }
                  } else {
                    throw new Error(
                      `Failed to create restaurant: ${retryError.message}. Please contact support.`,
                    );
                  }
                }
              }
            } else if (createError.keyPattern && createError.keyPattern.phone) {
              // Phone duplicate key error
              restaurant = await Restaurant.findOne({ phone });
              if (restaurant) {
                logger.info(
                  `Restaurant found after phone duplicate key error: ${restaurant._id}`,
                );
                // Continue with login flow
              } else {
                throw new Error(
                  `Phone number already exists: ${createError.message}`,
                );
              }
            } else if (createError.keyPattern && createError.keyPattern.slug) {
              // Check if it's a slug conflict
              // Retry with unique slug
              const baseSlug = restaurantData.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
              let counter = 1;
              let uniqueSlug = `${baseSlug}-${counter}`;
              while (await Restaurant.findOne({ slug: uniqueSlug })) {
                counter++;
                uniqueSlug = `${baseSlug}-${counter}`;
              }
              restaurantData.slug = uniqueSlug;
              try {
                restaurant = await Restaurant.create(restaurantData);
                logger.info(
                  `New restaurant auto-registered with unique slug: ${restaurant._id}`,
                  {
                    [identifierType]: identifier,
                    restaurantId: restaurant._id,
                    slug: uniqueSlug,
                  },
                );
              } catch (retryError) {
                // If still fails, check if restaurant exists
                const findQuery = phone ? { phone } : { email };
                restaurant = await Restaurant.findOne(findQuery);
                if (!restaurant) {
                  throw retryError;
                }
                logger.info(
                  `Restaurant found after duplicate key error: ${restaurant._id}`,
                );
              }
            } else {
              // Other duplicate key errors (email, phone)
              const findQuery = phone ? { phone } : { email };
              restaurant = await Restaurant.findOne(findQuery);
              if (!restaurant) {
                throw createError;
              }
              logger.info(
                `Restaurant found after duplicate key error: ${restaurant._id}`,
              );
            }
          } else {
            throw createError;
          }
        }
      } else {
        // Existing restaurant login - update verification status if needed
        if (phone && !restaurant.phoneVerified) {
          restaurant.phoneVerified = true;
          await restaurant.save();
        }
      }
    }

    // Generate tokens (email may be null for phone signups)
    const tokens = jwtService.generateTokens({
      userId: restaurant._id.toString(),
      role: "restaurant",
      email: restaurant.email || restaurant.phone || restaurant.restaurantId,
    });

    // Set refresh token in httpOnly cookie
    res.cookie("refreshToken", tokens.refreshToken, getRefreshTokenCookieOptions());

    // Return access token and restaurant info
    return successResponse(res, 200, "Authentication successful", {
      accessToken: tokens.accessToken,
      restaurant: {
        id: restaurant._id,
        restaurantId: restaurant.restaurantId,
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone,
        phoneVerified: restaurant.phoneVerified,
        signupMethod: restaurant.signupMethod,
        profileImage: restaurant.profileImage,
        isActive: restaurant.isActive,
        onboarding: restaurant.onboarding,
      },
    });
  } catch (error) {
    logger.error(`Error verifying OTP: ${error.message}`);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * Register restaurant with email and password
 * POST /api/restaurant/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, ownerName, ownerEmail, ownerPhone } =
    req.body;

  if (!name || !email || !password) {
    return errorResponse(
      res,
      400,
      "Restaurant name, email, and password are required",
    );
  }

  // Normalize phone number if provided
  const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
  if (phone && !normalizedPhone) {
    return errorResponse(res, 400, "Invalid phone number format");
  }

  // Check if restaurant already exists
  const existingRestaurant = await Restaurant.findOne({
    $or: [
      { email: email.toLowerCase().trim() },
      ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
    ],
  });

  if (existingRestaurant) {
    if (existingRestaurant.email === email.toLowerCase().trim()) {
      return errorResponse(
        res,
        400,
        "Restaurant with this email already exists. Please login.",
      );
    }
    if (normalizedPhone && existingRestaurant.phone === normalizedPhone) {
      return errorResponse(
        res,
        400,
        "Restaurant with this phone number already exists. Please login.",
      );
    }
  }

  // Create new restaurant
  const restaurantData = {
    name,
    email: email.toLowerCase().trim(),
    password, // Will be hashed by pre-save hook
    ownerName: ownerName || name,
    ownerEmail: (ownerEmail || email).toLowerCase().trim(),
    signupMethod: "email",
    // Set isActive to false - restaurant needs admin approval before becoming active
    // Auto-approve in development
    isActive: process.env.NODE_ENV === "development",
  };

  // Only include phone if provided (don't set to null)
  if (normalizedPhone) {
    restaurantData.phone = normalizedPhone;
    restaurantData.ownerPhone = ownerPhone
      ? normalizePhoneNumber(ownerPhone)
      : normalizedPhone;
  }

  const restaurant = await Restaurant.create(restaurantData);

  // Generate tokens (email may be null for phone signups)
  const tokens = jwtService.generateTokens({
    userId: restaurant._id.toString(),
    role: "restaurant",
    email: restaurant.email || restaurant.phone || restaurant.restaurantId,
  });

  // Set refresh token in httpOnly cookie
  res.cookie("refreshToken", tokens.refreshToken, getRefreshTokenCookieOptions());

  logger.info(`New restaurant registered via email: ${restaurant._id}`, {
    email,
    restaurantId: restaurant._id,
  });

  return successResponse(res, 201, "Registration successful", {
    accessToken: tokens.accessToken,
    restaurant: {
      id: restaurant._id,
      restaurantId: restaurant.restaurantId,
      name: restaurant.name,
      email: restaurant.email,
      phone: restaurant.phone,
      phoneVerified: restaurant.phoneVerified,
      signupMethod: restaurant.signupMethod,
      profileImage: restaurant.profileImage,
      isActive: restaurant.isActive,
    },
  });
});

/**
 * Login restaurant with email and password
 * POST /api/restaurant/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 400, "Email and password are required");
  }

  const restaurant = await Restaurant.findOne({ email }).select("+password");

  if (!restaurant) {
    return errorResponse(res, 401, "Invalid email or password");
  }

  // Allow inactive restaurants to login as well.
  // Access to restricted routes is handled by restaurantAuth middleware,
  // while onboarding/reverify/profile remain accessible.

  // Check if restaurant has a password set
  if (!restaurant.password) {
    return errorResponse(
      res,
      400,
      "Account was created with phone. Please use OTP login.",
    );
  }

  // Verify password
  const isPasswordValid = await restaurant.comparePassword(password);

  if (!isPasswordValid) {
    return errorResponse(res, 401, "Invalid email or password");
  }

  // Generate tokens (email may be null for phone signups)
  const tokens = jwtService.generateTokens({
    userId: restaurant._id.toString(),
    role: "restaurant",
    email: restaurant.email || restaurant.phone || restaurant.restaurantId,
  });

  // Set refresh token in httpOnly cookie
  res.cookie("refreshToken", tokens.refreshToken, getRefreshTokenCookieOptions());

  logger.info(`Restaurant logged in via email: ${restaurant._id}`, {
    email,
    restaurantId: restaurant._id,
  });

  return successResponse(res, 200, "Login successful", {
    accessToken: tokens.accessToken,
    restaurant: {
      id: restaurant._id,
      restaurantId: restaurant.restaurantId,
      name: restaurant.name,
      email: restaurant.email,
      phone: restaurant.phone,
      phoneVerified: restaurant.phoneVerified,
      signupMethod: restaurant.signupMethod,
      profileImage: restaurant.profileImage,
      isActive: restaurant.isActive,
      onboarding: restaurant.onboarding,
    },
  });
});

/**
 * Reset Password with OTP verification
 * POST /api/restaurant/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

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

  const restaurant = await Restaurant.findOne({ email }).select("+password");

  if (!restaurant) {
    return errorResponse(
      res,
      404,
      "No restaurant account found with this email.",
    );
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
  restaurant.password = newPassword; // Will be hashed by pre-save hook
  await restaurant.save();

  logger.info(`Password reset successful for restaurant: ${restaurant._id}`, {
    email,
    restaurantId: restaurant._id,
  });

  return successResponse(
    res,
    200,
    "Password reset successfully. Please login with your new password.",
  );
});

/**
 * Refresh Access Token
 * POST /api/restaurant/auth/refresh-token
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

    // Ensure it's a restaurant token
    if (decoded.role !== "restaurant") {
      return errorResponse(res, 401, "Invalid token for restaurant");
    }

    // Get restaurant from database
    const restaurant = await Restaurant.findById(decoded.userId).select(
      "-password",
    );

    if (!restaurant) {
      return errorResponse(res, 401, "Restaurant not found");
    }

    // Allow inactive restaurants to refresh tokens - they need access to complete onboarding
    // The middleware will handle blocking inactive restaurants from accessing restricted routes

    // Generate new access token
    const accessToken = jwtService.generateAccessToken({
      userId: restaurant._id.toString(),
      role: "restaurant",
      email: restaurant.email || restaurant.phone || restaurant.restaurantId,
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
 * POST /api/restaurant/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  // Clear refresh token cookie
  res.clearCookie("refreshToken", getClearRefreshTokenCookieOptions());

  return successResponse(res, 200, "Logged out successfully");
});

/**
 * Get current restaurant
 * GET /api/restaurant/auth/me
 */
export const getCurrentRestaurant = asyncHandler(async (req, res) => {
  // Restaurant is attached by authenticate middleware
  return successResponse(res, 200, "Restaurant retrieved successfully", {
    restaurant: {
      id: req.restaurant._id,
      restaurantId: req.restaurant.restaurantId,
      name: req.restaurant.name,
      email: req.restaurant.email,
      phone: req.restaurant.phone,
      phoneVerified: req.restaurant.phoneVerified,
      signupMethod: req.restaurant.signupMethod,
      profileImage: req.restaurant.profileImage,
      isActive: req.restaurant.isActive,
      onboarding: req.restaurant.onboarding,
      ownerName: req.restaurant.ownerName,
      ownerEmail: req.restaurant.ownerEmail,
      ownerPhone: req.restaurant.ownerPhone,
      // Include additional restaurant details
      cuisines: req.restaurant.cuisines,
      openDays: req.restaurant.openDays,
      location: req.restaurant.location,
      primaryContactNumber: req.restaurant.primaryContactNumber,
      deliveryTimings: req.restaurant.deliveryTimings,
      menuImages: req.restaurant.menuImages,
      slug: req.restaurant.slug,
      isAcceptingOrders: req.restaurant.isAcceptingOrders,
      // Include verification status
      rejectionReason: req.restaurant.rejectionReason || null,
      approvedAt: req.restaurant.approvedAt || null,
      rejectedAt: req.restaurant.rejectedAt || null,
    },
  });
});

/**
 * Reverify Restaurant (Resubmit for approval)
 * POST /api/restaurant/auth/reverify
 */
export const reverifyRestaurant = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant; // Already attached by authenticate middleware

    // Check if restaurant was rejected
    if (!restaurant.rejectionReason) {
      return errorResponse(
        res,
        400,
        "Restaurant is not rejected. Only rejected restaurants can be reverified.",
      );
    }

    // Clear rejection details and mark as pending again
    restaurant.rejectionReason = null;
    restaurant.rejectedAt = undefined;
    restaurant.rejectedBy = undefined;
    restaurant.isActive = false; // Keep inactive until approved

    await restaurant.save();

    logger.info(`Restaurant reverified: ${restaurant._id}`, {
      restaurantName: restaurant.name,
    });

    return successResponse(
      res,
      200,
      "Restaurant reverified successfully. Waiting for admin approval. Verification will be done in 24 hours.",
      {
        restaurant: {
          id: restaurant._id.toString(),
          name: restaurant.name,
          isActive: restaurant.isActive,
          rejectionReason: null,
        },
      },
    );
  } catch (error) {
    logger.error(`Error reverifying restaurant: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to reverify restaurant");
  }
});

const FIREBASE_SOCIAL_PROVIDER_CONFIG = {
  google: {
    displayName: "Google",
    tokenProviderId: "google.com",
    uidField: "googleId",
    emailField: "googleEmail",
    signupMethod: "google",
    defaultName: "Restaurant",
  },
  apple: {
    displayName: "Apple",
    tokenProviderId: "apple.com",
    uidField: "appleId",
    emailField: null,
    signupMethod: "apple",
    defaultName: "Restaurant",
  },
};

const handleFirebaseSocialLogin = async (req, res, provider) => {
  const { idToken } = req.body;
  const providerConfig = FIREBASE_SOCIAL_PROVIDER_CONFIG[provider];

  if (!idToken) {
    return errorResponse(res, 400, "Firebase ID token is required");
  }

  // Ensure Firebase Admin is configured
  const firebaseReady = await firebaseAuthService.ensureInitialized();
  if (!firebaseReady) {
    return errorResponse(
      res,
      500,
      "Firebase Auth is not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in backend .env",
    );
  }

  try {
    // Verify Firebase ID token
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
    const email = decoded.email || null;
    const name = decoded.name || decoded.display_name || providerConfig.defaultName;
    const picture = decoded.picture || decoded.photo_url || null;
    const emailVerified = !!decoded.email_verified;

    // Validate email is present
    if (!email) {
      logger.error(`Firebase ${providerConfig.displayName} login failed: Email not found in token`, {
        uid: firebaseUid,
      });
      return errorResponse(
        res,
        400,
        `Email not found in Firebase user. Please ensure email is available in your ${providerConfig.displayName} account.`,
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logger.error(`Firebase ${providerConfig.displayName} login failed: Invalid email format`, {
        email,
      });
      return errorResponse(
        res,
        400,
        `Invalid email format received from ${providerConfig.displayName}.`,
      );
    }

    // Find existing restaurant by Firebase provider UID or email
    let restaurant = await Restaurant.findOne({
      $or: [{ [providerConfig.uidField]: firebaseUid }, { email }],
    });

    if (restaurant) {
      // If restaurant exists but provider uid not linked yet, link it
      if (!restaurant[providerConfig.uidField]) {
        restaurant[providerConfig.uidField] = firebaseUid;
        if (providerConfig.emailField && email) {
          restaurant[providerConfig.emailField] = email;
        }
        if (!restaurant.profileImage && picture) {
          restaurant.profileImage = { url: picture };
        }
        if (!restaurant.signupMethod) {
          restaurant.signupMethod = providerConfig.signupMethod;
        }
        await restaurant.save();
        logger.info(`Linked ${providerConfig.displayName} account to existing restaurant`, {
          restaurantId: restaurant._id,
          email,
        });
      }

      logger.info(`Existing restaurant logged in via Firebase ${providerConfig.displayName}`, {
        restaurantId: restaurant._id,
        email,
      });
    } else {
      // Auto-register new restaurant based on Firebase data
      const restaurantData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        [providerConfig.uidField]: firebaseUid,
        signupMethod: providerConfig.signupMethod,
        profileImage: picture ? { url: picture } : null,
        ownerName: name.trim(),
        ownerEmail: email.toLowerCase().trim(),
        // Set isActive to false - restaurant needs admin approval before becoming active
        // Auto-approve in development
        isActive: process.env.NODE_ENV === "development",
      };
      if (providerConfig.emailField) {
        restaurantData[providerConfig.emailField] = email.toLowerCase().trim();
      }

      try {
        restaurant = await Restaurant.create(restaurantData);

        logger.info(`New restaurant registered via Firebase ${providerConfig.displayName} login`, {
          firebaseUid,
          email,
          restaurantId: restaurant._id,
          name: restaurant.name,
        });
      } catch (createError) {
        // Handle duplicate key error
        if (createError.code === 11000) {
          logger.warn(
            "Duplicate key error during restaurant creation, retrying find",
            { email },
          );
          restaurant = await Restaurant.findOne({ email });
          if (!restaurant) {
            logger.error("Restaurant not found after duplicate key error", {
              email,
            });
            throw createError;
          }
          // Link provider ID if not already linked
          if (!restaurant[providerConfig.uidField]) {
            restaurant[providerConfig.uidField] = firebaseUid;
            if (providerConfig.emailField && email) {
              restaurant[providerConfig.emailField] = email;
            }
            if (!restaurant.profileImage && picture) {
              restaurant.profileImage = { url: picture };
            }
            if (!restaurant.signupMethod) {
              restaurant.signupMethod = providerConfig.signupMethod;
            }
            await restaurant.save();
          }
        } else {
          logger.error(`Error creating restaurant via Firebase ${providerConfig.displayName} login`, {
            error: createError.message,
            email,
          });
          throw createError;
        }
      }
    }

    // Allow inactive restaurants to login and continue onboarding/reverify.
    // Middleware will block only restricted endpoints.

    // Generate JWT tokens for our app (email may be null for phone signups)
    const tokens = jwtService.generateTokens({
      userId: restaurant._id.toString(),
      role: "restaurant",
      email: restaurant.email || restaurant.phone || restaurant.restaurantId,
    });

    // Set refresh token in httpOnly cookie
    res.cookie("refreshToken", tokens.refreshToken, getRefreshTokenCookieOptions());

    return successResponse(
      res,
      200,
      `Firebase ${providerConfig.displayName} authentication successful`,
      {
        accessToken: tokens.accessToken,
        restaurant: {
          id: restaurant._id,
          restaurantId: restaurant.restaurantId,
          name: restaurant.name,
          email: restaurant.email,
          phone: restaurant.phone,
          phoneVerified: restaurant.phoneVerified,
          signupMethod: restaurant.signupMethod,
          profileImage: restaurant.profileImage,
          isActive: restaurant.isActive,
          onboarding: restaurant.onboarding,
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
 * POST /api/restaurant/auth/firebase/google-login
 */
export const firebaseGoogleLogin = asyncHandler(async (req, res) => {
  return handleFirebaseSocialLogin(req, res, "google");
});

/**
 * Login / register using Firebase Apple ID token
 * POST /api/restaurant/auth/firebase/apple-login
 */
export const firebaseAppleLogin = asyncHandler(async (req, res) => {
  return handleFirebaseSocialLogin(req, res, "apple");
});
