import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import EnvironmentVariable from "../models/EnvironmentVariable.js";
import {
  getAllEnvVars,
  clearEnvCache,
} from "../../../shared/utils/envService.js";
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
 * Get Environment Variables
 * GET /api/admin/env-variables
 */
export const getEnvVariables = asyncHandler(async (req, res) => {
  try {
    const envVars = await EnvironmentVariable.getOrCreate();

    // Return all variables (excluding sensitive data in response, but include in database)
    const envData = envVars.toEnvObject();

    logger.info("Environment variables retrieved successfully");

    return successResponse(
      res,
      200,
      "Environment variables retrieved successfully",
      envData,
    );
  } catch (error) {
    logger.error(`Error fetching environment variables: ${error.message}`, {
      stack: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch environment variables");
  }
});

/**
 * Get Public Environment Variables (for frontend use)
 * GET /api/env/public
 * Returns only non-sensitive public variables like Google Maps API key
 */
export const getPublicEnvVariables = asyncHandler(async (req, res) => {
  try {
    // This now automatically handles injection for all schema fields via getAllEnvVars
    const envData = await getAllEnvVars();

    // Return only public variables that frontend needs
    const publicEnvData = {
      VITE_GOOGLE_MAPS_API_KEY: envData.VITE_GOOGLE_MAPS_API_KEY || "",
      FIREBASE_API_KEY: envData.FIREBASE_API_KEY || "",
      FIREBASE_AUTH_DOMAIN: envData.FIREBASE_AUTH_DOMAIN || "",
      FIREBASE_PROJECT_ID: envData.FIREBASE_PROJECT_ID || "",
      FIREBASE_STORAGE_BUCKET: envData.FIREBASE_STORAGE_BUCKET || "",
      FIREBASE_MESSAGING_SENDER_ID: envData.FIREBASE_MESSAGING_SENDER_ID || "",
      FIREBASE_APP_ID: envData.FIREBASE_APP_ID || "",
      FIREBASE_VAPID_KEY: envData.FIREBASE_VAPID_KEY || "",
      MEASUREMENT_ID: envData.MEASUREMENT_ID || "",
      // Realtime DB URL for live delivery tracking (same default as config/firebaseRealtime.js)
      FIREBASE_DATABASE_URL:
        envData.FIREBASE_DATABASE_URL ||
        process.env.FIREBASE_DATABASE_URL ||
        "https://tifunbox-default-rtdb.asia-southeast1.firebasedatabase.app",
    };

    return successResponse(
      res,
      200,
      "Public environment variables retrieved successfully",
      publicEnvData,
    );
  } catch (error) {
    logger.error(
      `Error fetching public environment variables: ${error.message}`,
      { stack: error.stack },
    );
    return successResponse(
      res,
      200,
      "Public environment variables retrieved successfully",
      {
        VITE_GOOGLE_MAPS_API_KEY: "",
      },
    );
  }
});

/**
 * Save Environment Variables
 * POST /api/admin/env-variables
 */
export const saveEnvVariables = asyncHandler(async (req, res) => {
  // Get admin from req.user (set by adminAuth middleware) or req.admin (fallback)
  const admin = req.user || req.admin; // From adminAuth middleware
  const envData = req.body;

  logger.info("Saving environment variables", {
    adminId: admin?._id,
    fieldsCount: Object.keys(envData || {}).length,
  });

  // Validate request
  if (!admin || !admin._id) {
    logger.error("Admin authentication failed");
    return errorResponse(res, 401, "Admin authentication required");
  }

  if (!envData || typeof envData !== "object") {
    logger.error("Invalid request body");
    return errorResponse(res, 400, "Invalid request body");
  }

  try {
    // Get or create environment variables document
    let envVars;
    try {
      envVars = await EnvironmentVariable.getOrCreate();
      logger.info("Environment variables document retrieved/created");
    } catch (getError) {
      logger.error("Error getting/creating env vars document:", {
        message: getError.message,
        stack: getError.stack,
      });
      return errorResponse(
        res,
        500,
        `Failed to get environment variables document: ${getError.message}`,
      );
    }

    // Sensitive fields should never be accidentally erased by blank payloads.
    // This protects against cases where decryption/key mismatch makes values appear empty in UI.
    const protectedSecretFields = new Set([
      "RAZORPAY_API_KEY",
      "RAZORPAY_SECRET_KEY",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
      "FIREBASE_API_KEY",
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_PRIVATE_KEY",
      "SMTP_USER",
      "SMTP_PASS",
      "SMSINDIAHUB_API_KEY",
      "VITE_GOOGLE_MAPS_API_KEY",
    ]);

    // Update all fields (encryption will happen in pre-save hook)
    const updatedFields = [];
    const skippedProtectedFields = [];
    Object.keys(envData).forEach((key) => {
      if (envVars.schema.paths[key]) {
        // Set the value directly - pre-save hook will encrypt it
        let value = envData[key];

        // Convert to string for all fields (schema expects strings)
        if (value !== null && value !== undefined) {
          value = String(value);
        } else {
          value = "";
        }

        // Prevent accidental secret wipe:
        // If incoming value is blank for protected field and DB already has non-blank value,
        // keep existing DB value unchanged.
        const existingValue = envVars[key];
        const incomingBlank = typeof value === "string" && value.trim() === "";
        const existingNonBlank =
          typeof existingValue === "string" && existingValue.trim() !== "";
        if (protectedSecretFields.has(key) && incomingBlank && existingNonBlank) {
          skippedProtectedFields.push(key);
          return;
        }

        envVars[key] = value;
        // Mark field as modified to trigger encryption
        envVars.markModified(key);
        updatedFields.push(key);
      } else {
        logger.warn(`Unknown field in request: ${key}`);
      }
    });

    logger.info(
      `Updated ${updatedFields.length} fields: ${updatedFields.join(", ")}`,
    );
    if (skippedProtectedFields.length > 0) {
      logger.warn(
        `Skipped blank updates for protected fields: ${skippedProtectedFields.join(", ")}`,
      );
    }

    // Update metadata
    envVars.lastUpdatedBy = admin._id;
    envVars.lastUpdatedAt = new Date();

    // Save with error handling
    try {
      logger.info("Attempting to save environment variables...");
      await envVars.save();
      logger.info("Environment variables saved successfully");
    } catch (saveError) {
      logger.error("Error during save operation:", {
        message: saveError.message,
        stack: saveError.stack,
        name: saveError.name,
        errors: saveError.errors,
      });

      // Log validation errors if any
      if (saveError.errors) {
        Object.keys(saveError.errors).forEach((field) => {
          logger.error(
            `Validation error for field ${field}:`,
            saveError.errors[field],
          );
        });
      }

      throw saveError;
    }

    // Clear cache to force refresh
    try {
      clearEnvCache();
      logger.info("Environment cache cleared");
    } catch (cacheError) {
      logger.warn("Error clearing cache:", cacheError.message);
      // Don't fail the request if cache clear fails
    }

    logger.info(`Environment variables updated by admin: ${admin._id}`);

    return successResponse(
      res,
      200,
      "Environment variables saved successfully",
      {
        message: "Environment variables updated successfully",
        updatedAt: envVars.lastUpdatedAt,
      },
    );
  } catch (error) {
    // Enhanced error logging
    console.error("=== FULL ERROR DETAILS ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    if (error.errors) {
      console.error(
        "Validation errors:",
        JSON.stringify(error.errors, null, 2),
      );
    }
    console.error("Request body keys:", Object.keys(req.body || {}));
    console.error("Admin ID:", req.admin?._id);
    console.error("==========================");

    logger.error(`Error saving environment variables: ${error.message}`, {
      stack: error.stack,
      name: error.name,
      adminId: req.admin?._id,
      errors: error.errors,
    });

    // Return more detailed error message
    let errorMessage = "Failed to save environment variables";
    if (error.message) {
      errorMessage = error.message;
    }
    if (error.errors) {
      const validationErrors = Object.keys(error.errors)
        .map((key) => `${key}: ${error.errors[key].message}`)
        .join(", ");
      errorMessage = `Validation errors: ${validationErrors}`;
    }

    return errorResponse(res, 500, errorMessage);
  }
});
