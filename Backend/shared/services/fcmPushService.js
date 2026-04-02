/**
 * FCM Push Notification Service
 * Sends push notifications via Firebase Cloud Messaging (Firebase Admin SDK)
 */

import admin from "firebase-admin";
import User from "../../modules/auth/models/User.js";
import Delivery from "../../modules/delivery/models/Delivery.js";
import Restaurant from "../../modules/restaurant/models/Restaurant.js";
import Zone from "../../modules/admin/models/Zone.js";
import { ensureFirebaseAdminInitialized } from "../../config/firebaseAdmin.js";

/**
 * Collect FCM tokens from entities based on sendTo and zone
 * @param {string} sendTo - "Customer" | "Delivery Man" | "Restaurant"
 * @param {string} zone - "All" | zone name (e.g. "Asia", "Europe")
 * @returns {Promise<string[]>} Array of valid FCM tokens
 */
async function getFcmTokens(sendTo, zone) {
  const tokens = new Set();

  const addTokens = (entity) => {
    if (entity?.fcmTokenWeb) tokens.add(entity.fcmTokenWeb);
    if (entity?.fcmTokenAndroid) tokens.add(entity.fcmTokenAndroid);
    if (entity?.fcmTokenIos) tokens.add(entity.fcmTokenIos);
  };

  const collectCustomers = async () => {
    const query = { role: "user" };
    const users = await User.find(query)
      .select("fcmTokenWeb fcmTokenAndroid fcmTokenIos")
      .lean();
    users.forEach(addTokens);
  };

  const collectDeliveryMen = async () => {
    let query = { status: "approved" };
    if (zone && zone !== "All") {
      const zoneDoc = await Zone.findOne({ name: zone }).select("_id").lean();
      if (zoneDoc) {
        query["availability.zones"] = zoneDoc._id;
      }
    }
    const deliveries = await Delivery.find(query)
      .select("fcmTokenWeb fcmTokenAndroid fcmTokenIos")
      .lean();
    deliveries.forEach(addTokens);
  };

  const collectRestaurants = async () => {
    const query = { status: "approved" };
    const restaurants = await Restaurant.find(query)
      .select("fcmTokenWeb fcmTokenAndroid fcmTokenIos")
      .lean();
    restaurants.forEach(addTokens);
  };

  if (sendTo === "All") {
    await Promise.all([
      collectCustomers(),
      collectDeliveryMen(),
      collectRestaurants(),
    ]);
  } else if (sendTo === "Customer") {
    await collectCustomers();
  } else if (sendTo === "Delivery Man") {
    await collectDeliveryMen();
  } else if (sendTo === "Restaurant") {
    await collectRestaurants();
  }

  return [...tokens].filter(Boolean);
}

/**
 * Send FCM message to a single token
 * @param {string} token - FCM device token
 * @param {Object} payload - { title, body, image? }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendToToken(token, payload) {
  try {
    const ok = await ensureFirebaseAdminInitialized();
    if (!ok || !admin.apps.length) {
      return { success: false, error: "Firebase Admin not initialized" };
    }

    const { title, body, image } = payload;
    const message = {
      token,
      notification: {
        title: title || "Notification",
        body: body || "",
        ...(image && { image }),
      },
      webpush: {
        fcmOptions: {
          link: "/",
        },
      },
      android: {
        notification: {
          title: title || "Notification",
          body: body || "",
          ...(image && { imageUrl: image }),
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title || "Notification",
              body: body || "",
            },
            sound: "default",
          },
        },
        fcmOptions: {
          imageUrl: image || undefined,
        },
      },
    };

    await admin.messaging().send(message);
    return { success: true };
  } catch (err) {
    const errMsg = err?.message || String(err);
    if (
      errMsg.includes("registration-token-not-registered") ||
      errMsg.includes("invalid-registration-token") ||
      errMsg.includes("unregistered")
    ) {
      return { success: false, error: "invalid_token" };
    }
    return { success: false, error: errMsg };
  }
}

/**
 * Send push notification to a single delivery partner by delivery ID.
 * This is used for targeted events like bonus credits or account updates.
 * @param {string|ObjectId} deliveryPartnerId
 * @param {Object} payload
 * @returns {Promise<{sent: number, failed: number, total: number, errors: string[]}>}
 */
export async function sendPushNotificationToDeliveryPartner(
  deliveryPartnerId,
  { title, description, image },
) {
  const result = { sent: 0, failed: 0, total: 0, errors: [] };

  if (!deliveryPartnerId) {
    result.errors.push("deliveryPartnerId is required");
    return result;
  }

  const ok = await ensureFirebaseAdminInitialized();
  if (!ok || !admin.apps.length) {
    result.errors.push("Firebase Admin not initialized");
    return result;
  }

  const delivery = await Delivery.findById(deliveryPartnerId)
    .select("fcmTokenWeb fcmTokenAndroid fcmTokenIos")
    .lean();

  if (!delivery) {
    result.errors.push("delivery_partner_not_found");
    return result;
  }

  const tokens = [
    delivery.fcmTokenWeb,
    delivery.fcmTokenAndroid,
    delivery.fcmTokenIos,
  ].filter(Boolean);

  const uniqueTokens = [...new Set(tokens)];

  result.total = uniqueTokens.length;
  if (uniqueTokens.length === 0) {
    return result;
  }

  const payload = {
    title: title || "Notification",
    body: description || "",
    image: image || undefined,
  };

  for (const token of uniqueTokens) {
    const res = await sendToToken(token, payload);
    if (res.success) {
      result.sent++;
    } else {
      result.failed++;
      if (res.error && res.error !== "invalid_token") {
        result.errors.push(res.error);
      }
    }
  }

  return result;
}

/**
 * Send push notification to target audience
 * @param {Object} params
 * @param {string} params.title - Notification title
 * @param {string} params.description - Notification body/description
 * @param {string} params.sendTo - "Customer" | "Delivery Man" | "Restaurant"
 * @param {string} params.zone - "All" | zone name
 * @param {string} [params.image] - Optional image URL
 * @returns {Promise<{sent: number, failed: number, total: number, errors: string[]}>}
 */
export async function sendPushNotification({
  title,
  description,
  sendTo,
  zone = "All",
  image,
}) {
  const result = { sent: 0, failed: 0, total: 0, errors: [] };

  const ok = await ensureFirebaseAdminInitialized();
  if (!ok || !admin.apps.length) {
    result.errors.push("Firebase Admin not initialized");
    return result;
  }

  const tokens = await getFcmTokens(sendTo, zone);
  result.total = tokens.length;

  if (tokens.length === 0) {
    return result;
  }

  const payload = {
    title: title || "Notification",
    body: description || "",
    image: image || undefined,
  };

  for (const token of tokens) {
    const res = await sendToToken(token, payload);
    if (res.success) {
      result.sent++;
    } else {
      result.failed++;
      if (res.error && res.error !== "invalid_token") {
        result.errors.push(res.error);
      }
    }
  }

  return result;
}
