/**
 * Firebase Realtime Database (Backend)
 * Used for: active_orders, delivery_boys, route_cache, live tracking.
 * Must be initialized at server startup before any routes or Socket.IO use getDb().
 *
 * Setup:
 * 1. Firebase Console → Project Settings → Service Accounts → Generate new private key
 * 2. Save the JSON as Backend/config/serviceAccountKey.json (or Backend/firebaseconfig.json)
 * 3. Add to .gitignore: serviceAccountKey.json, firebaseconfig.json
 * 4. Set in .env (optional): FIREBASE_DATABASE_URL (default: tastizoo Asia Southeast 1)
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const DEFAULT_DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  "https://ziggybites-79bfc-default-rtdb.asia-southeast1.firebasedatabase.app";

let db = null;
let initialized = false;

/**
 * Load Firebase credentials synchronously from env or service account file.
 * Tries: process.env → config/serviceAccountKey.json → config/...-firebase-adminsdk-*.json → firebaseconfig.json
 */
function getCredentialsSync() {
  let projectId = process.env.FIREBASE_PROJECT_ID;
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey && privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  const cwd = process.cwd();
  const pathsToTry = [
    path.resolve(cwd, "config", "serviceAccountKey.json"),
    path.resolve(cwd, "config", "tastizoo-default-rtdb-firebase-adminsdk.json"),
    path.resolve(
      cwd,
      "config",
      "zomato-607fa-firebase-adminsdk-fbsvc-f5f782c2cc.json",
    ),
    path.resolve(cwd, "firebaseconfig.json"),
  ];

  for (const filePath of pathsToTry) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const json = JSON.parse(raw);
        projectId = projectId || json.project_id;
        clientEmail = clientEmail || json.client_email;
        privateKey = privateKey || json.private_key;
        if (privateKey && privateKey.includes("\\n")) {
          privateKey = privateKey.replace(/\\n/g, "\n");
        }
        if (projectId && clientEmail && privateKey) {
          return { projectId, clientEmail, privateKey };
        }
      }
    } catch (err) {
      // skip
    }
  }

  return null;
}

/**
 * Initialize Firebase Realtime Database.
 * Call this at the VERY TOP of server.js (before Express routes and Socket.IO).
 * Uses same credential as Firebase Auth (service account or env).
 */
export function initializeFirebaseRealtime() {
  if (initialized && db) {
    return db;
  }

  const databaseURL =
    process.env.FIREBASE_DATABASE_URL || DEFAULT_DATABASE_URL;
  const creds = getCredentialsSync();

  if (!creds) {
    console.warn(
      "⚠️ Firebase Realtime Database not initialized: missing credentials. " +
        "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env " +
        "or place serviceAccountKey.json in Backend/config/ (see config/firebaseRealtime.js)."
    );
    return null;
  }

  try {
    // If no app exists yet, initialize with credentials
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: creds.projectId,
          clientEmail: creds.clientEmail,
          privateKey: creds.privateKey,
        }),
        databaseURL,
      });
    }

    // Reuse existing default app (whether created here or elsewhere)
    const app = admin.app();
    db = databaseURL ? app.database(databaseURL) : app.database();
    initialized = true;
    try {
      const urlHost = typeof databaseURL === "string" ? new URL(databaseURL).host : "";
      console.log(
        `✅ Firebase Realtime Database initialized (project: ${creds.projectId}, db: ${urlHost || "default"})`,
      );
    } catch {
      console.log(`✅ Firebase Realtime Database initialized (project: ${creds.projectId})`);
    }
    return db;
  } catch (error) {
    // If an app already exists and we hit duplicate-app style issues, just reuse it
    try {
      const app = admin.app();
      db = databaseURL ? app.database(databaseURL) : app.database();
      initialized = true;
      try {
        const urlHost = typeof databaseURL === "string" ? new URL(databaseURL).host : "";
        console.log(
          `✅ Firebase Realtime Database initialized (reused app, project: ${creds.projectId}, db: ${urlHost || "default"})`,
        );
      } catch {
        console.log(`✅ Firebase Realtime Database initialized (reused app, project: ${creds.projectId})`);
      }
      return db;
    } catch (innerErr) {
      console.error(
        "❌ Firebase Realtime Database init failed:",
        error.message || innerErr.message,
      );
      return null;
    }
  }
}

/**
 * Get the Firebase Realtime Database instance.
 * Throws if initializeFirebaseRealtime() was not called or failed.
 */
export function getDb() {
  if (!db || !initialized) {
    console.warn(
      "⚠️ Firebase Realtime Database not initialized. Call initializeFirebaseRealtime() first."
    );
    throw new Error(
      "Firebase Realtime Database not available. Call initializeFirebaseRealtime() first."
    );
  }
  return db;
}

/**
 * Check if Firebase Realtime Database is available (for optional features).
 */
export function isFirebaseRealtimeAvailable() {
  return initialized && db !== null;
}
