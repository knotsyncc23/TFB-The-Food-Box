import admin from "firebase-admin";
import winston from "winston";
import fs from "fs";
import path from "path";
import { getFirebaseCredentials } from "../../../shared/utils/envService.js";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

class FirebaseAuthService {
  constructor() {
    this.initialized = false;
    // Initialize asynchronously, but keep a shared promise so callers can await it.
    // This prevents "race" failures on the first auth request after server startup.
    this.initPromise = this.init().catch((err) => {
      logger.error(`Error initializing Firebase: ${err.message}`);
      return false;
    });
  }

  async init() {
    if (this.initialized) return;

    try {
      // If an admin app is already initialized elsewhere (e.g. firebaseRealtime),
      // just reuse it and mark this service as initialized.
      if (admin.apps && admin.apps.length > 0) {
        this.initialized = true;
        logger.info("Firebase Admin already initialized, reusing existing instance (auth service)");
        return;
      }

      const dbCredentials = await getFirebaseCredentials();
      let projectId =
        dbCredentials.projectId || process.env.FIREBASE_PROJECT_ID;
      let clientEmail =
        dbCredentials.clientEmail || process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey =
        dbCredentials.privateKey || process.env.FIREBASE_PRIVATE_KEY;

      // Fallback: read from firebaseconfig.json in backend root or config folder if env vars are not set
      if (!projectId || !clientEmail || !privateKey) {
        try {
          // Try common service-account file names
          const serviceAccountPaths = [
            path.resolve(process.cwd(), "config", "serviceAccountKey.json"),
            path.resolve(process.cwd(), "config", "firebaseconfig.json"),
            path.resolve(process.cwd(), "firebaseconfig.json"),
            // Legacy/hard-coded filename (keep for backward compatibility)
            path.resolve(
              process.cwd(),
              "config",
              "zomato-607fa-firebase-adminsdk-fbsvc-f5f782c2cc.json",
            ),
          ];

          const serviceAccountPath = serviceAccountPaths.find((p) =>
            fs.existsSync(p),
          );

          if (serviceAccountPath) {
            const raw = fs.readFileSync(serviceAccountPath, "utf-8");
            const json = JSON.parse(raw);
            projectId = projectId || json.project_id;
            clientEmail = clientEmail || json.client_email;
            privateKey = privateKey || json.private_key;
          }
        } catch (err) {
          logger.warn(`Failed to read firebaseconfig.json: ${err.message}`);
        }
      }

      if (!projectId || !clientEmail || !privateKey) {
        logger.warn(
          "Firebase Admin not fully configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in ENV Setup or .env or provide firebaseconfig.json in backend root to enable Firebase auth.",
        );
        return;
      }

      // Handle escaped newlines in private key
      if (privateKey.includes("\\n")) {
        privateKey = privateKey.replace(/\\n/g, "\n");
      }

      try {
        // Initialize only if no apps exist (guarded above); otherwise this path won't run.
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
        }

        this.initialized = true;
        logger.info("Firebase Admin initialized for auth verification");
      } catch (error) {
        // If already initialized by another module, treat as success and reuse.
        try {
          if (admin.apps && admin.apps.length > 0) {
            this.initialized = true;
            logger.warn(
              "Firebase Admin already initialized, reusing existing instance (auth service catch)",
            );
            return;
          }
        } catch (_) {
          // fall through to error log
        }

        logger.error(`Failed to initialize Firebase Admin: ${error.message}`);
      }
    } catch (error) {
      logger.error(`Error in Firebase init: ${error.message}`);
    }
  }

  /**
   * Wait for Firebase Admin initialization to finish (success or failure).
   * @returns {Promise<boolean>} true if initialized successfully
   */
  async ensureInitialized() {
    if (this.initialized) return true;
    try {
      await this.initPromise;
    } catch (_) {
      // initPromise already logs internally; swallow to return false below.
    }
    return this.initialized;
  }

  isEnabled() {
    return this.initialized;
  }

  /**
   * Verify a Firebase ID token and return decoded claims
   * @param {string} idToken
   * @returns {Promise<admin.auth.DecodedIdToken>}
   */
  async verifyIdToken(idToken) {
    if (!this.initialized) {
      throw new Error(
        "Firebase Admin is not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env",
      );
    }

    if (!idToken) {
      throw new Error("ID token is required");
    }

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      logger.info("Firebase ID token verified", {
        uid: decoded.uid,
        email: decoded.email,
      });
      return decoded;
    } catch (error) {
      logger.error(`Error verifying Firebase ID token: ${error.message}`, {
        code: error.code,
        message: error.message,
      });
      if (error.code === "auth/argument-error") {
        logger.warn(
          "Firebase project mismatch? Ensure backend FIREBASE_PROJECT_ID (service account) matches frontend Firebase app project.",
        );
      }
      throw new Error("Invalid or expired Firebase ID token");
    }
  }
}

export default new FirebaseAuthService();
