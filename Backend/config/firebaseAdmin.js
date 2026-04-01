/**
 * Firebase Admin initialization (shared for FCM/Auth/RTDB).
 *
 * This module ensures `firebase-admin` is initialized even when Realtime DB
 * is not enabled/used. It relies on the same credentials you already manage
 * via Admin ENV Setup / .env / serviceAccountKey.json.
 */

import admin from "firebase-admin";
import { getFirebaseCredentials } from "../shared/utils/envService.js";

let initPromise = null;

export async function ensureFirebaseAdminInitialized() {
  if (admin.apps && admin.apps.length > 0) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const creds = await getFirebaseCredentials();
      let projectId = creds.projectId || process.env.FIREBASE_PROJECT_ID;
      let clientEmail = creds.clientEmail || process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = creds.privateKey || process.env.FIREBASE_PRIVATE_KEY;

      if (privateKey && privateKey.includes("\\n")) {
        privateKey = privateKey.replace(/\\n/g, "\n");
      }

      if (!projectId || !clientEmail || !privateKey) {
        return false;
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }
      return true;
    } catch {
      return false;
    } finally {
      // allow retry if failed
      initPromise = null;
    }
  })();

  return initPromise;
}

