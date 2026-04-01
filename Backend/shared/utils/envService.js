import EnvironmentVariable from "../../modules/admin/models/EnvironmentVariable.js";
import { decrypt, isEncrypted } from "./encryption.js";
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

// Cache for environment variables (cache for 5 minutes)
let envCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get environment variable value from database
 * Falls back to process.env if not found in database
 * Automatically decrypts encrypted values
 * @param {string} key - Environment variable key
 * @param {string} defaultValue - Default value if not found
 * @returns {Promise<string>} Environment variable value (decrypted)
 */
export async function getEnvVar(key, defaultValue = "") {
  try {
    const envVars = await getAllEnvVars();
    let value = envVars[key] || process.env[key] || defaultValue;

    // Decrypt if encrypted (for direct access, toEnvObject already decrypts, but this is a safety check)
    if (value && isEncrypted(value)) {
      try {
        value = decrypt(value);
      } catch (error) {
        logger.warn(`Error decrypting ${key}: ${error.message}`);
        return defaultValue;
      }
    }

    return value;
  } catch (error) {
    logger.warn(
      `Error fetching env var ${key} from database, using process.env: ${error.message}`,
    );
    return process.env[key] || defaultValue;
  }
}

/**
 * Get all environment variables from database
 * Uses caching to reduce database queries
 * Also performs "injection": if a variable is in process.env but not in DB, it saves it to DB
 * @returns {Promise<Object>} Object containing all environment variables
 */
export async function getAllEnvVars() {
  try {
    // Check cache
    const now = Date.now();
    if (envCache && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION) {
      return envCache;
    }

    // Fetch from database
    const envVars = await EnvironmentVariable.getOrCreate();
    let envData = envVars.toEnvObject();

    // Injection logic: Check if any fields in the schema are empty in DB but exist in process.env
    let hasNewInjections = false;
    const schemaPaths = Object.keys(EnvironmentVariable.schema.paths);

    for (const key of schemaPaths) {
      // Skip internal mongoose fields
      if (
        [
          "_id",
          "__v",
          "createdAt",
          "updatedAt",
          "lastUpdatedAt",
          "lastUpdatedBy",
        ].includes(key)
      ) {
        continue;
      }

      // If DB value is empty, check process.env
      if (!envData[key] || envData[key] === "") {
        // Check both direct key and VITE_ prefixed key
        const envValue = process.env[key] || process.env[`VITE_${key}`];

        if (envValue && envValue.trim() !== "") {
          envVars[key] = envValue;
          envVars.markModified(key);
          hasNewInjections = true;
          logger.info(`Injected missing DB variable ${key} from process.env`);
        }
      }
    }

    if (hasNewInjections) {
      await envVars.save();
      // Refresh envData after save
      envData = envVars.toEnvObject();
    }

    // Update cache
    envCache = envData;
    cacheTimestamp = now;

    return envData;
  } catch (error) {
    logger.error(
      `Error fetching environment variables from database: ${error.message}`,
    );
    // Return empty object on error, will fallback to process.env in getEnvVar
    return {};
  }
}

/**
 * Clear environment variables cache
 * Call this after updating environment variables
 */
export function clearEnvCache() {
  envCache = null;
  cacheTimestamp = null;
  logger.info("Environment variables cache cleared");
}

/**
 * Get Razorpay credentials
 * @returns {Promise<Object>} { keyId, keySecret }
 */
export async function getRazorpayCredentials() {
  const apiKey = await getEnvVar("RAZORPAY_API_KEY");
  const secretKey = await getEnvVar("RAZORPAY_SECRET_KEY");

  // Fallback to old env var names
  return {
    keyId: apiKey || process.env.RAZORPAY_KEY_ID || "",
    keySecret: secretKey || process.env.RAZORPAY_KEY_SECRET || "",
  };
}

/**
 * Get Cloudinary credentials
 * @returns {Promise<Object>} { cloudName, apiKey, apiSecret }
 */
export async function getCloudinaryCredentials() {
  return {
    cloudName: await getEnvVar("CLOUDINARY_CLOUD_NAME"),
    apiKey: await getEnvVar("CLOUDINARY_API_KEY"),
    apiSecret: await getEnvVar("CLOUDINARY_API_SECRET"),
  };
}

/**
 * Get Firebase credentials
 * @returns {Promise<Object>} Firebase credentials object
 */
export async function getFirebaseCredentials() {
  return {
    apiKey: await getEnvVar("FIREBASE_API_KEY"),
    authDomain: await getEnvVar("FIREBASE_AUTH_DOMAIN"),
    storageBucket: await getEnvVar("FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: await getEnvVar("FIREBASE_MESSAGING_SENDER_ID"),
    appId: await getEnvVar("FIREBASE_APP_ID"),
    measurementId: await getEnvVar("MEASUREMENT_ID"),
    projectId: await getEnvVar("FIREBASE_PROJECT_ID"),
    clientEmail: await getEnvVar("FIREBASE_CLIENT_EMAIL"),
    privateKey: await getEnvVar("FIREBASE_PRIVATE_KEY"),
  };
}

/**
 * Get SMTP credentials
 * @returns {Promise<Object>} { host, port, user, pass }
 */
export async function getSMTPCredentials() {
  return {
    host: await getEnvVar("SMTP_HOST"),
    port: await getEnvVar("SMTP_PORT"),
    user: await getEnvVar("SMTP_USER"),
    pass: await getEnvVar("SMTP_PASS"),
  };
}

/**
 * Get SMS Hub India credentials
 * @returns {Promise<Object>} { apiKey, senderId }
 */
export async function getSMSHubIndiaCredentials() {
  return {
    apiKey: await getEnvVar("SMSINDIAHUB_API_KEY"),
    senderId: await getEnvVar("SMSINDIAHUB_SENDER_ID"),
  };
}

/**
 * Get Google Maps API Key
 * @returns {Promise<string>} Google Maps API Key
 */
export async function getGoogleMapsApiKey() {
  return await getEnvVar("VITE_GOOGLE_MAPS_API_KEY");
}
