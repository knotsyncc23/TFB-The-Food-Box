/**
 * Firebase Realtime Database service for live tracking.
 * Writes: active_orders, delivery_boys. Uses route_cache key format for consistency.
 */

import { initializeFirebaseRealtime } from "../config/firebaseRealtime.js";

const FIREBASE_OP_TIMEOUT_MS = 4000;

async function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label || "Firebase operation"} timed out`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getFirebaseDbSafe() {
  try {
    const db = initializeFirebaseRealtime();
    return db || null;
  } catch (err) {
    return null;
  }
}

/**
 * Upsert active_orders/<orderId> with route polyline and initial positions.
 * Call after assigning order to delivery boy.
 */
export async function upsertActiveOrder(payload) {
  try {
    const db = await getFirebaseDbSafe();
    if (!db) return;
    const {
      orderId,
      boy_id,
      boy_lat,
      boy_lng,
      restaurant_lat,
      restaurant_lng,
      customer_lat,
      customer_lng,
      polyline,
      distance,
      duration,
      status = "assigned",
    } = payload;
    const now = Date.now();
    await withTimeout(
      db.ref("active_orders").child(orderId).set({
      boy_id: boy_id || null,
      boy_lat: boy_lat ?? restaurant_lat,
      boy_lng: boy_lng ?? restaurant_lng,
      restaurant_lat,
      restaurant_lng,
      customer_lat,
      customer_lng,
      polyline: polyline || "",
      distance: distance ?? 0,
      duration: duration ?? 0,
      status,
      created_at: now,
      last_updated: now,
      }),
      FIREBASE_OP_TIMEOUT_MS,
      "Firebase upsertActiveOrder",
    );
  } catch (err) {
    console.warn("Firebase upsertActiveOrder failed:", err.message);
  }
}

/**
 * Update only rider position for an active order.
 */
export async function updateActiveOrderLocation(orderId, boy_lat, boy_lng) {
  try {
    const db = await getFirebaseDbSafe();
    if (!db) return;
    await withTimeout(
      db.ref("active_orders").child(orderId).update({
        boy_lat,
        boy_lng,
        last_updated: Date.now(),
      }),
      FIREBASE_OP_TIMEOUT_MS,
      "Firebase updateActiveOrderLocation",
    );
  } catch (err) {
    console.warn("Firebase updateActiveOrderLocation failed:", err.message);
  }
}

/**
 * Set or update delivery_boys/<boyId> (online status and location).
 */
export async function setDeliveryBoyStatus(boyId, { lat, lng, status = "online" }) {
  try {
    const db = await getFirebaseDbSafe();
    if (!db) return;
    const updates = {
      last_updated: Date.now(),
      status: status === false ? "offline" : (status || "online"),
    };
    if (typeof lat === "number" && typeof lng === "number") {
      updates.lat = lat;
      updates.lng = lng;
    }
    await withTimeout(
      db.ref("delivery_boys").child(boyId).update(updates),
      FIREBASE_OP_TIMEOUT_MS,
      "Firebase setDeliveryBoyStatus",
    );
  } catch (err) {
    console.warn("Firebase setDeliveryBoyStatus failed:", err.message);
  }
}

/**
 * Update delivery boy location (and optionally active order rider position).
 */
export async function updateDeliveryBoyLocation(boyId, lat, lng, orderId = null) {
  try {
    const db = await getFirebaseDbSafe();
    if (!db) return;
    const now = Date.now();
    await withTimeout(
      db.ref("delivery_boys").child(boyId).update({
        lat,
        lng,
        status: "online",
        last_updated: now,
      }),
      FIREBASE_OP_TIMEOUT_MS,
      "Firebase updateDeliveryBoyLocation(delivery_boys)",
    );
    if (orderId) {
      await withTimeout(
        db.ref("active_orders").child(orderId).update({
          boy_lat: lat,
          boy_lng: lng,
          last_updated: now,
        }),
        FIREBASE_OP_TIMEOUT_MS,
        "Firebase updateDeliveryBoyLocation(active_orders)",
      );
    }
  } catch (err) {
    console.warn("Firebase updateDeliveryBoyLocation failed:", err.message);
  }
}

/**
 * Update status (and optionally polyline/distance/duration) on an active order.
 */
export async function updateActiveOrderStatus(orderId, fields) {
  try {
    const db = await getFirebaseDbSafe();
    if (!db) return;
    await withTimeout(
      db.ref("active_orders").child(orderId).update({
        ...fields,
        last_updated: Date.now(),
      }),
      FIREBASE_OP_TIMEOUT_MS,
      "Firebase updateActiveOrderStatus",
    );
  } catch (err) {
    console.warn("Firebase updateActiveOrderStatus failed:", err.message);
  }
}

/**
 * Remove order from active_orders when delivered/cancelled.
 */
export async function removeActiveOrder(orderId) {
  try {
    const db = await getFirebaseDbSafe();
    if (!db) return;
    await withTimeout(
      db.ref("active_orders").child(orderId).remove(),
      FIREBASE_OP_TIMEOUT_MS,
      "Firebase removeActiveOrder",
    );
  } catch (err) {
    console.warn("Firebase removeActiveOrder failed:", err.message);
  }
}
