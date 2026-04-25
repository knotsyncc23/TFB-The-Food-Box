import { config } from '../../../../config/env.js';

const sanitize = (value) => (value ? String(value).trim().replace(/^['"]|['"]$/g, '') : '');

/**
 * Public environment variables for frontend runtime.
 * IMPORTANT: Only expose non-secret keys safe for clients.
 */
export const getPublicEnvController = async (_req, res, next) => {
    try {
        const googleMapsKey =
            sanitize(process.env.VITE_GOOGLE_MAPS_API_KEY) ||
            sanitize(process.env.GOOGLE_MAPS_API_KEY);
        const firebaseApiKey = sanitize(process.env.VITE_FIREBASE_API_KEY) || sanitize(process.env.FIREBASE_API_KEY);
        const firebaseAuthDomain =
            sanitize(process.env.VITE_FIREBASE_AUTH_DOMAIN) || sanitize(process.env.FIREBASE_AUTH_DOMAIN);
        const firebaseProjectId =
            sanitize(process.env.VITE_FIREBASE_PROJECT_ID) || sanitize(process.env.FIREBASE_PROJECT_ID);
        const firebaseStorageBucket =
            sanitize(process.env.VITE_FIREBASE_STORAGE_BUCKET) || sanitize(process.env.FIREBASE_STORAGE_BUCKET);
        const firebaseMessagingSenderId =
            sanitize(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || sanitize(process.env.FIREBASE_MESSAGING_SENDER_ID);
        const firebaseAppId = sanitize(process.env.VITE_FIREBASE_APP_ID) || sanitize(process.env.FIREBASE_APP_ID);
        const firebaseMeasurementId =
            sanitize(process.env.VITE_FIREBASE_MEASUREMENT_ID) || sanitize(process.env.FIREBASE_MEASUREMENT_ID);
        const firebaseVapidKey = sanitize(process.env.VITE_FIREBASE_VAPID_KEY) || sanitize(process.env.FIREBASE_VAPID_KEY);
        const appleClientId = sanitize(process.env.VITE_APPLE_CLIENT_ID) || sanitize(process.env.APPLE_CLIENT_ID);
        const appleRedirectUri = sanitize(config.appleRedirectUri);
        const appleUserRedirectUri = sanitize(config.appleUserRedirectUri) || appleRedirectUri;

        return res.status(200).json({
            success: true,
            message: 'Public environment variables fetched',
            data: {
                VITE_GOOGLE_MAPS_API_KEY: googleMapsKey || '',
                VITE_FIREBASE_API_KEY: firebaseApiKey,
                VITE_FIREBASE_AUTH_DOMAIN: firebaseAuthDomain,
                VITE_FIREBASE_PROJECT_ID: firebaseProjectId,
                VITE_FIREBASE_STORAGE_BUCKET: firebaseStorageBucket,
                VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseMessagingSenderId,
                VITE_FIREBASE_APP_ID: firebaseAppId,
                VITE_FIREBASE_MEASUREMENT_ID: firebaseMeasurementId,
                VITE_FIREBASE_VAPID_KEY: firebaseVapidKey,
                FIREBASE_API_KEY: firebaseApiKey,
                FIREBASE_AUTH_DOMAIN: firebaseAuthDomain,
                FIREBASE_PROJECT_ID: firebaseProjectId,
                FIREBASE_STORAGE_BUCKET: firebaseStorageBucket,
                FIREBASE_MESSAGING_SENDER_ID: firebaseMessagingSenderId,
                FIREBASE_APP_ID: firebaseAppId,
                FIREBASE_MEASUREMENT_ID: firebaseMeasurementId,
                FIREBASE_VAPID_KEY: firebaseVapidKey,
                VITE_APPLE_CLIENT_ID: appleClientId,
                VITE_APPLE_USER_REDIRECT_URI: appleUserRedirectUri || appleRedirectUri,
                VITE_APPLE_REDIRECT_URI: appleRedirectUri,
                APPLE_CLIENT_ID: appleClientId,
                APPLE_USER_REDIRECT_URI: appleUserRedirectUri || appleRedirectUri,
                APPLE_REDIRECT_URI: appleRedirectUri,
                NODE_ENV: config.nodeEnv || 'development'
            }
        });
    } catch (error) {
        next(error);
    }
};

