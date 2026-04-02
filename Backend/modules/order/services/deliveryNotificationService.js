import Order from "../models/Order.js";
import Delivery from "../../delivery/models/Delivery.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import mongoose from "mongoose";

// Dynamic import to avoid circular dependency
let getIO = null;

async function getIOInstance() {
  if (!getIO) {
    const serverModule = await import("../../../server.js");
    getIO = serverModule.getIO;
  }
  return getIO ? getIO() : null;
}

/**
 * Check if delivery partner is connected to socket
 * @param {string} deliveryPartnerId - Delivery partner ID
 * @returns {Promise<{connected: boolean, room: string|null, socketCount: number}>}
 */
async function checkDeliveryPartnerConnection(deliveryPartnerId) {
  try {
    const io = await getIOInstance();
    if (!io) {
      return { connected: false, room: null, socketCount: 0 };
    }

    const deliveryNamespace = io.of("/delivery");
    const normalizedId = deliveryPartnerId?.toString() || deliveryPartnerId;

    const roomVariations = [
      `delivery:${normalizedId}`,
      `delivery:${deliveryPartnerId}`,
      ...(mongoose.Types.ObjectId.isValid(normalizedId)
        ? [`delivery:${new mongoose.Types.ObjectId(normalizedId).toString()}`]
        : []),
    ];

    for (const room of roomVariations) {
      const sockets = await deliveryNamespace.in(room).fetchSockets();
      if (sockets.length > 0) {
        return { connected: true, room, socketCount: sockets.length };
      }
    }

    return { connected: false, room: null, socketCount: 0 };
  } catch (error) {
    console.error("Error checking delivery partner connection:", error);
    return { connected: false, room: null, socketCount: 0 };
  }
}

async function isDeliveryPartnerOnline(deliveryPartnerId) {
  try {
    const partner = await Delivery.findById(deliveryPartnerId)
      .select("availability.isOnline status isActive")
      .lean();

    return Boolean(
      partner &&
        partner.isActive &&
        ["approved", "active"].includes(partner.status) &&
        partner.availability?.isOnline,
    );
  } catch (error) {
    console.error("Error checking delivery partner online status:", error);
    return false;
  }
}

async function filterOnlineDeliveryPartnerIds(deliveryPartnerIds) {
  if (!Array.isArray(deliveryPartnerIds) || deliveryPartnerIds.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(deliveryPartnerIds.map((id) => id?.toString?.() || String(id || "")).filter(Boolean))];
  const partners = await Delivery.find({
    _id: { $in: uniqueIds },
    isActive: true,
    status: { $in: ["approved", "active"] },
    "availability.isOnline": true,
  })
    .select("_id")
    .lean();

  const onlineIdSet = new Set(partners.map((partner) => partner._id.toString()));
  return uniqueIds.filter((id) => onlineIdSet.has(id));
}

/**
 * Redact sensitive PII from order data for broad notifications
 * @param {Object} data - Notification data
 * @returns {Object} Redacted data
 */
function redactPII(data) {
  const redacted = { ...data };

  // Hide exact customer phone
  if (redacted.customerPhone) {
    redacted.customerPhone = redacted.customerPhone.replace(/.(?=.{4})/g, "*");
  }

  // Scramble/Generalized delivery address
  if (redacted.customerLocation?.address) {
    // Keep only the area/city part if possible, or just truncate the specific part
    const parts = redacted.customerLocation.address.split(",");
    if (parts.length > 2) {
      redacted.customerLocation.address = `Near ${parts[parts.length - 2].trim()}, ${parts[parts.length - 1].trim()}`;
    } else {
      redacted.customerLocation.address =
        "Drop location restricted (Accept to view)";
    }
  }

  if (redacted.deliveryAddress) {
    const parts = redacted.deliveryAddress.split(",");
    if (parts.length > 2) {
      redacted.deliveryAddress = `Near ${parts[parts.length - 2].trim()}, ${parts[parts.length - 1].trim()}`;
    } else {
      redacted.deliveryAddress = "Drop location restricted (Accept to view)";
    }
  }

  // Remove full order object if present to prevent leaks
  delete redacted.fullOrder;

  return redacted;
}

/**
 * Notify delivery boy about new order assignment via Socket.IO
 * @param {Object} order - Order document
 * @param {string} deliveryPartnerId - Delivery partner ID
 */
export async function notifyDeliveryBoyNewOrder(order, deliveryPartnerId) {
  // CRITICAL: Don't notify if order is cancelled
  if (order.status === "cancelled") {
    return { success: false, reason: "Order is cancelled" };
  }
  try {
    const io = await getIOInstance();

    if (!io) {
      console.warn(
        "Socket.IO not initialized, skipping delivery boy notification",
      );
      return;
    }

    // Populate userId if it's not already populated
    let orderWithUser = order;
    if (order.userId && typeof order.userId === "object" && order.userId._id) {
      // Already populated
      orderWithUser = order;
    } else if (order.userId) {
      // Need to populate
      const OrderModel = await import("../models/Order.js");
      orderWithUser = await OrderModel.default
        .findById(order._id)
        .populate("userId", "name phone")
        .lean();
    }

    // Get delivery partner details
    const deliveryPartner = await Delivery.findById(deliveryPartnerId)
      .select(
        "name phone availability.currentLocation availability.isOnline status isActive",
      )
      .lean();

    if (!deliveryPartner) {
      console.error(`❌ Delivery partner not found: ${deliveryPartnerId}`);
      return;
    }

    // Verify delivery partner is online and active before notifying
    if (
      !deliveryPartner.isActive ||
      !["approved", "active"].includes(deliveryPartner.status) ||
      !deliveryPartner.availability?.isOnline
    ) {
      console.warn(
        `⚠️ Delivery partner ${deliveryPartnerId} (${deliveryPartner.name}) is offline or inactive. Skipping order notification.`,
      );
      return { success: false, reason: "delivery_partner_offline" };
    }

    if (
      !deliveryPartner.availability?.currentLocation?.coordinates ||
      (deliveryPartner.availability.currentLocation.coordinates[0] === 0 &&
        deliveryPartner.availability.currentLocation.coordinates[1] === 0)
    ) {
      console.warn(
        `⚠️ Delivery partner ${deliveryPartnerId} (${deliveryPartner.name}) has no valid location.`,
      );
    }
    // Check if delivery partner is connected to socket BEFORE trying to notify
    const connectionStatus =
      await checkDeliveryPartnerConnection(deliveryPartnerId);
    if (!connectionStatus.connected) {
      console.warn(
        `⚠️ Delivery partner ${deliveryPartnerId} (${deliveryPartner.name}) is NOT connected to socket!`,
      );
      console.warn(
        `⚠️ Notification will be sent but may not be received until they reconnect.`,
      );
    } else {
    }

    // Get restaurant details for pickup location
    let restaurant = null;
    if (mongoose.Types.ObjectId.isValid(order.restaurantId)) {
      restaurant = await Restaurant.findById(order.restaurantId).lean();
    }
    if (!restaurant) {
      restaurant = await Restaurant.findOne({
        $or: [
          { restaurantId: order.restaurantId },
          { _id: order.restaurantId },
        ],
      }).lean();
    }

    // Calculate distances
    let pickupDistance = null;
    let deliveryDistance = null;

    if (
      deliveryPartner.availability?.currentLocation?.coordinates &&
      restaurant?.location?.coordinates
    ) {
      const [deliveryLng, deliveryLat] =
        deliveryPartner.availability.currentLocation.coordinates;
      const [restaurantLng, restaurantLat] = restaurant.location.coordinates;
      const [customerLng, customerLat] = order.address.location.coordinates;

      // Calculate pickup distance (delivery boy to restaurant)
      pickupDistance = calculateDistance(
        deliveryLat,
        deliveryLng,
        restaurantLat,
        restaurantLng,
      );

      // Calculate delivery distance (restaurant to customer)
      deliveryDistance = calculateDistance(
        restaurantLat,
        restaurantLng,
        customerLat,
        customerLng,
      );
    }

    // Calculate estimated earnings; use order's delivery fee as fallback when 0 or distance missing
    const deliveryFeeFromOrder = order.pricing?.deliveryFee ?? 0;
    let estimatedEarnings = await calculateEstimatedEarnings(
      deliveryDistance || 0,
    );
    const earnedValue =
      typeof estimatedEarnings === "object"
        ? (estimatedEarnings.totalEarning ?? 0)
        : Number(estimatedEarnings) || 0;
    estimatedEarnings = normalizeEstimatedEarningsForOrder(
      earnedValue <= 0 ? estimatedEarnings : estimatedEarnings,
      deliveryFeeFromOrder,
    );

    // Prepare order notification data
    const orderNotification = {
      orderId: order.orderId,
      orderMongoId: order._id.toString(),
      restaurantId: order.restaurantId,
      restaurantName: order.restaurantName,
      restaurantAddress:
        restaurant?.address ||
        restaurant?.location?.formattedAddress ||
        restaurant?.location?.address ||
        "Restaurant address",
      restaurantLocation: restaurant?.location
        ? {
            latitude: restaurant.location.coordinates[1],
            longitude: restaurant.location.coordinates[0],
            address:
              restaurant.location.formattedAddress ||
              restaurant.address ||
              "Restaurant address",
          }
        : null,
      restaurantLat: restaurant?.location?.coordinates?.[1],
      restaurantLng: restaurant?.location?.coordinates?.[0],
      customerLocation: {
        latitude: order.address.location.coordinates[1],
        longitude: order.address.location.coordinates[0],
        address:
          order.address.formattedAddress ||
          `${order.address.street}, ${order.address.city}` ||
          "Customer address",
      },
      customerAddress:
        order.address.formattedAddress ||
        `${order.address.street}, ${order.address.city}` ||
        "Customer address",
      customerLat: order.address.location.coordinates?.[1],
      customerLng: order.address.location.coordinates?.[0],
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      total: order.pricing.total,
      deliveryFee: deliveryFeeFromOrder,
      customerName: orderWithUser.userId?.name || "Customer",
      customerPhone: orderWithUser.userId?.phone || "",
      status: order.status,
      createdAt: order.createdAt,
      estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
      note: order.note || "",
      pickupDistance: pickupDistance
        ? `${pickupDistance.toFixed(2)} km`
        : "Distance not available",
      pickupDistanceRaw: pickupDistance || 0,
      deliveryDistance: deliveryDistance
        ? `${deliveryDistance.toFixed(2)} km`
        : "Calculating...",
      deliveryDistanceRaw: deliveryDistance || 0, // Raw distance number for calculations
      estimatedEarnings,
    };

    // Get delivery namespace
    const deliveryNamespace = io.of("/delivery");

    // Normalize deliveryPartnerId to string
    const normalizedDeliveryPartnerId =
      deliveryPartnerId?.toString() || deliveryPartnerId;

    // Try multiple room formats to ensure we find the delivery partner
    const roomVariations = [
      `delivery:${normalizedDeliveryPartnerId}`,
      `delivery:${deliveryPartnerId}`,
      ...(mongoose.Types.ObjectId.isValid(normalizedDeliveryPartnerId)
        ? [
            `delivery:${new mongoose.Types.ObjectId(normalizedDeliveryPartnerId).toString()}`,
          ]
        : []),
    ];

    // Get all connected sockets in the delivery partner room
    let socketsInRoom = [];
    let foundRoom = null;

    // First, get all connected sockets in delivery namespace for debugging
    const allSockets = await deliveryNamespace.fetchSockets();
    // Check each room variation
    for (const room of roomVariations) {
      const sockets = await deliveryNamespace.in(room).fetchSockets();
      if (sockets.length > 0) {
        socketsInRoom = sockets;
        foundRoom = room;
        break;
      }
    }

    const primaryRoom = roomVariations[0];
    // Emit new order notification to specific rooms (Keep PII here as it's targeted)
    let notificationSent = false;
    roomVariations.forEach((room) => {
      deliveryNamespace.to(room).emit("new_order", orderNotification);
      deliveryNamespace.to(room).emit("play_notification_sound", {
        type: "new_order",
        orderId: order.orderId,
        message: `New order assigned: ${order.orderId}`,
      });
      notificationSent = true;
    });

    // Also emit to all sockets in the delivery namespace (FALLBACK MUST BE REDACTED)
    if (socketsInRoom.length === 0) {
      console.warn(
        `⚠️ No sockets connected for partner ${normalizedDeliveryPartnerId}. Broadcasting REDACTED payload.`,
      );

      const redactedNotification = redactPII(orderNotification);

      // Broadcast redacted payload as fallback
      deliveryNamespace.emit("new_order", redactedNotification);
      deliveryNamespace.emit("play_notification_sound", {
        type: "new_order",
        orderId: order.orderId,
        message: `New order assigned: ${order.orderId}`,
      });
      notificationSent = true;
    } else {
    }

    if (notificationSent) {
    } else {
      console.error(`❌ Failed to send notification`);
    }

    return {
      success: true,
      deliveryPartnerId,
      orderId: order.orderId,
    };
  } catch (error) {
    console.error("Error notifying delivery boy:", error);
    throw error;
  }
}

/**
 * Notify multiple delivery boys about new order (without assigning)
 * Used for priority-based notification where nearest delivery boys get first chance
 * @param {Object} order - Order document
 * @param {Array} deliveryPartnerIds - Array of delivery partner IDs to notify
 * @param {string} phase - Notification phase: 'priority' or 'expanded'
 * @returns {Promise<{success: boolean, notified: number}>}
 */
export async function notifyMultipleDeliveryBoys(
  order,
  deliveryPartnerIds,
  phase = "priority",
) {
  try {
    if (!deliveryPartnerIds || deliveryPartnerIds.length === 0) {
      return { success: false, notified: 0 };
    }

    const io = await getIOInstance();
    if (!io) {
      console.warn(
        "Socket.IO not initialized, skipping delivery boy notifications",
      );
      return { success: false, notified: 0 };
    }

    const deliveryNamespace = io.of("/delivery");
    const onlineDeliveryPartnerIds = await filterOnlineDeliveryPartnerIds(
      deliveryPartnerIds,
    );
    if (onlineDeliveryPartnerIds.length === 0) {
      return { success: false, notified: 0 };
    }
    let notifiedCount = 0;

    // Populate userId if needed
    let orderWithUser = order;
    if (order.userId && typeof order.userId === "object" && order.userId._id) {
      orderWithUser = order;
    } else if (order.userId) {
      const OrderModel = await import("../models/Order.js");
      orderWithUser = await OrderModel.default
        .findById(order._id)
        .populate("userId", "name phone")
        .lean();
    }

    // Get restaurant details for complete address
    let restaurantAddress = "Restaurant address";
    let restaurantLocation = null;

    if (orderWithUser.restaurantId) {
      // If restaurantId is populated, use it directly
      if (typeof orderWithUser.restaurantId === "object") {
        restaurantAddress =
          orderWithUser.restaurantId.address ||
          orderWithUser.restaurantId.location?.formattedAddress ||
          orderWithUser.restaurantId.location?.address ||
          "Restaurant address";
        restaurantLocation = orderWithUser.restaurantId.location;
      } else {
        // If restaurantId is just an ID, fetch restaurant details
        try {
          const RestaurantModel =
            await import("../../restaurant/models/Restaurant.js");
          const restaurant = await RestaurantModel.default
            .findById(orderWithUser.restaurantId)
            .select("name address location")
            .lean();
          if (restaurant) {
            restaurantAddress =
              restaurant.address ||
              restaurant.location?.formattedAddress ||
              restaurant.location?.address ||
              "Restaurant address";
            restaurantLocation = restaurant.location;
          }
        } catch (e) {
          console.warn(
            "⚠️ Could not fetch restaurant details for notification:",
            e.message,
          );
        }
      }
    }

    // Calculate delivery distance (restaurant to customer) for earnings calculation
    let deliveryDistance = 0;
    if (
      restaurantLocation?.coordinates &&
      orderWithUser.address?.location?.coordinates
    ) {
      const [restaurantLng, restaurantLat] = restaurantLocation.coordinates;
      const [customerLng, customerLat] =
        orderWithUser.address.location.coordinates;

      // Validate coordinates
      if (
        restaurantLat &&
        restaurantLng &&
        customerLat &&
        customerLng &&
        !isNaN(restaurantLat) &&
        !isNaN(restaurantLng) &&
        !isNaN(customerLat) &&
        !isNaN(customerLng)
      ) {
        // Calculate distance using Haversine formula
        const R = 6371; // Earth radius in km
        const dLat = ((customerLat - restaurantLat) * Math.PI) / 180;
        const dLng = ((customerLng - restaurantLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((restaurantLat * Math.PI) / 180) *
            Math.cos((customerLat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        deliveryDistance = R * c;
      } else {
        console.warn("⚠️ Invalid coordinates for distance calculation");
      }
    } else {
      console.warn("⚠️ Missing coordinates for distance calculation");
    }

    // Calculate estimated earnings based on delivery distance
    let estimatedEarnings = null;
    const deliveryFeeFromOrder = orderWithUser.pricing?.deliveryFee ?? 0;

    try {
      estimatedEarnings = await calculateEstimatedEarnings(deliveryDistance);
      const earnedValue =
        typeof estimatedEarnings === "object"
          ? (estimatedEarnings.totalEarning ?? 0)
          : Number(estimatedEarnings) || 0;
      // Use deliveryFee as fallback if earnings is 0 or invalid
      estimatedEarnings = normalizeEstimatedEarningsForOrder(
        estimatedEarnings,
        deliveryFeeFromOrder,
      );
    } catch (earningsError) {
      console.error(
        "❌ Error calculating estimated earnings in notification:",
        earningsError,
      );
      console.error("❌ Error stack:", earningsError.stack);
      // Fallback to deliveryFee or default
      estimatedEarnings = normalizeEstimatedEarningsForOrder(
        {
          basePayout: 10,
          distance: deliveryDistance,
          commissionPerKm: 5,
          distanceCommission: 0,
          totalEarning: 10,
          breakdown: "Default calculation",
        },
        deliveryFeeFromOrder,
      );
    }

    // Prepare notification payload
    const orderNotificationRaw = {
      orderId: orderWithUser.orderId || orderWithUser._id,
      mongoId: orderWithUser._id?.toString(),
      orderMongoId: orderWithUser._id?.toString(),
      status: orderWithUser.status || "preparing",
      restaurantName:
        orderWithUser.restaurantName || orderWithUser.restaurantId?.name,
      restaurantAddress: restaurantAddress,
      restaurantLocation: restaurantLocation
        ? {
            latitude: restaurantLocation.coordinates?.[1],
            longitude: restaurantLocation.coordinates?.[0],
            address:
              restaurantLocation.formattedAddress ||
              restaurantLocation.address ||
              restaurantAddress,
            formattedAddress:
              restaurantLocation.formattedAddress ||
              restaurantLocation.address ||
              restaurantAddress,
          }
        : null,
      customerName: orderWithUser.userId?.name || "Customer",
      customerPhone: orderWithUser.userId?.phone || "",
      deliveryAddress:
        orderWithUser.address?.address ||
        orderWithUser.address?.location?.address ||
        orderWithUser.address?.formattedAddress,
      customerLocation: orderWithUser.address?.location
        ? {
            latitude: orderWithUser.address.location.coordinates?.[1],
            longitude: orderWithUser.address.location.coordinates?.[0],
            address:
              orderWithUser.address.formattedAddress ||
              orderWithUser.address.address,
          }
        : null,
      totalAmount: orderWithUser.pricing?.total || 0,
      deliveryFee: deliveryFeeFromOrder,
      estimatedEarnings: estimatedEarnings,
      deliveryDistance:
        deliveryDistance > 0
          ? `${deliveryDistance.toFixed(2)} km`
          : "Calculating...",
      paymentMethod: orderWithUser.payment?.method || "cash",
      message: `New order available: ${orderWithUser.orderId || orderWithUser._id}`,
      timestamp: new Date().toISOString(),
      phase: phase,
      restaurantLat:
        restaurantLocation?.coordinates?.[1] ||
        orderWithUser.restaurantId?.location?.coordinates?.[1],
      restaurantLng:
        restaurantLocation?.coordinates?.[0] ||
        orderWithUser.restaurantId?.location?.coordinates?.[0],
      deliveryLat:
        orderWithUser.address?.location?.coordinates?.[1] ||
        orderWithUser.address?.location?.latitude,
      deliveryLng:
        orderWithUser.address?.location?.coordinates?.[0] ||
        orderWithUser.address?.location?.longitude,
    };

    // REDACT PII for broad notifications
    const orderNotification = redactPII(orderNotificationRaw);
    // Notify each delivery partner
    for (const deliveryPartnerId of onlineDeliveryPartnerIds) {
      try {
        const normalizedId = deliveryPartnerId?.toString() || deliveryPartnerId;
        const roomVariations = [
          `delivery:${normalizedId}`,
          `delivery:${deliveryPartnerId}`,
          ...(mongoose.Types.ObjectId.isValid(normalizedId)
            ? [
                `delivery:${new mongoose.Types.ObjectId(normalizedId).toString()}`,
              ]
            : []),
        ];

        let notificationSent = false;
        for (const room of roomVariations) {
          const sockets = await deliveryNamespace.in(room).fetchSockets();
          if (sockets.length > 0) {
            deliveryNamespace
              .to(room)
              .emit("new_order_available", orderNotification);
            deliveryNamespace.to(room).emit("play_notification_sound", {
              type: "new_order_available",
              orderId: order.orderId,
              message: `New order available: ${order.orderId}`,
              phase: phase,
            });
            notificationSent = true;
            notifiedCount++;
            break;
          }
        }

        if (!notificationSent) {
          console.warn(
            `⚠️ Delivery partner ${normalizedId} not connected. Room will receive redacted payload.`,
          );
          roomVariations.forEach((room) => {
            deliveryNamespace
              .to(room)
              .emit("new_order_available", orderNotification);
          });
          notifiedCount++;
        }
      } catch (partnerError) {
        console.error(
          `❌ Error notifying delivery partner ${deliveryPartnerId}:`,
          partnerError,
        );
      }
    }
    return { success: true, notified: notifiedCount };
  } catch (error) {
    console.error("❌ Error notifying multiple delivery boys:", error);
    return { success: false, notified: 0 };
  }
}

/**
 * Broadcast new order to ALL connected delivery boys (entire /delivery namespace).
 * Ensures every active delivery boy sees the order in their available orders list in real time.
 * @param {Object} order - Order document (populated or with ids)
 * @param {string} phase - Optional phase: 'priority', 'expanded', 'immediate'
 */
export async function broadcastNewOrderToAllDeliveryBoys(order, phase = "priority") {
  try {
    if (!order || !order.orderId) {
      console.warn("broadcastNewOrderToAllDeliveryBoys: invalid order");
      return;
    }
    if (order.status === "cancelled") {
      return;
    }

    const io = await getIOInstance();
    if (!io) {
      console.warn("Socket.IO not initialized, skipping broadcast to delivery boys");
      return;
    }

    const deliveryNamespace = io.of("/delivery");
    const onlineDeliveryPartnerIds = await filterOnlineDeliveryPartnerIds(
      await Delivery.find({
        isActive: true,
        status: { $in: ["approved", "active"] },
        "availability.isOnline": true,
      })
        .select("_id")
        .lean()
        .then((docs) => docs.map((doc) => doc._id.toString())),
    );

    if (onlineDeliveryPartnerIds.length === 0) {
      return;
    }

    let orderWithUser = order;
    if (order.userId && typeof order.userId === "object" && order.userId._id) {
      orderWithUser = order;
    } else if (order.userId) {
      const OrderModel = await import("../models/Order.js");
      orderWithUser = await OrderModel.default
        .findById(order._id)
        .populate("userId", "name phone")
        .populate("restaurantId", "name address location phone ownerPhone")
        .lean();
    }

    let restaurantAddress = "Restaurant address";
    let restaurantLocation = null;
    if (orderWithUser.restaurantId && typeof orderWithUser.restaurantId === "object") {
      restaurantAddress =
        orderWithUser.restaurantId.address ||
        orderWithUser.restaurantId.location?.formattedAddress ||
        orderWithUser.restaurantId.location?.address ||
        "Restaurant address";
      restaurantLocation = orderWithUser.restaurantId.location;
    }

    const deliveryFeeFromOrder = orderWithUser.pricing?.deliveryFee ?? 0;
    let deliveryDistance = 0;
    if (
      restaurantLocation?.coordinates &&
      orderWithUser.address?.location?.coordinates
    ) {
      const [restaurantLng, restaurantLat] = restaurantLocation.coordinates;
      const [customerLng, customerLat] = orderWithUser.address.location.coordinates;
      if (
        restaurantLat && restaurantLng && customerLat && customerLng &&
        !isNaN(restaurantLat) && !isNaN(restaurantLng) && !isNaN(customerLat) && !isNaN(customerLng)
      ) {
        const R = 6371;
        const dLat = ((customerLat - restaurantLat) * Math.PI) / 180;
        const dLng = ((customerLng - restaurantLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((restaurantLat * Math.PI) / 180) *
            Math.cos((customerLat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        deliveryDistance = R * c;
      }
    }

    let estimatedEarnings = null;
    try {
      estimatedEarnings = await calculateEstimatedEarnings(deliveryDistance);
      const earnedValue =
        typeof estimatedEarnings === "object"
          ? (estimatedEarnings.totalEarning ?? 0)
          : Number(estimatedEarnings) || 0;
      estimatedEarnings = normalizeEstimatedEarningsForOrder(
        estimatedEarnings,
        deliveryFeeFromOrder,
      );
    } catch (e) {
      estimatedEarnings = normalizeEstimatedEarningsForOrder(
        { totalEarning: 10, breakdown: "Default" },
        deliveryFeeFromOrder,
      );
    }

    const orderNotificationRaw = {
      orderId: orderWithUser.orderId || orderWithUser._id,
      mongoId: orderWithUser._id?.toString(),
      orderMongoId: orderWithUser._id?.toString(),
      status: orderWithUser.status || "preparing",
      restaurantName:
        orderWithUser.restaurantName || orderWithUser.restaurantId?.name,
      restaurantAddress,
      restaurantLocation: restaurantLocation
        ? {
            latitude: restaurantLocation.coordinates?.[1],
            longitude: restaurantLocation.coordinates?.[0],
            address:
              restaurantLocation.formattedAddress ||
              restaurantLocation.address ||
              restaurantAddress,
            formattedAddress:
              restaurantLocation.formattedAddress ||
              restaurantLocation.address ||
              restaurantAddress,
          }
        : null,
      restaurantLat:
        restaurantLocation?.coordinates?.[1] ||
        orderWithUser.restaurantId?.location?.coordinates?.[1],
      restaurantLng:
        restaurantLocation?.coordinates?.[0] ||
        orderWithUser.restaurantId?.location?.coordinates?.[0],
      customerName: orderWithUser.userId?.name || "Customer",
      customerPhone: orderWithUser.userId?.phone || "",
      deliveryAddress:
        orderWithUser.address?.address ||
        orderWithUser.address?.location?.address ||
        orderWithUser.address?.formattedAddress,
      customerLocation: orderWithUser.address?.location
        ? {
            latitude: orderWithUser.address.location.coordinates?.[1],
            longitude: orderWithUser.address.location.coordinates?.[0],
            address:
              orderWithUser.address.formattedAddress ||
              orderWithUser.address.address,
          }
        : null,
      customerAddress:
        orderWithUser.address?.formattedAddress ||
        orderWithUser.address?.address ||
        orderWithUser.address?.location?.address ||
        "Customer address",
      customerLat:
        orderWithUser.address?.location?.coordinates?.[1] ||
        orderWithUser.address?.location?.latitude,
      customerLng:
        orderWithUser.address?.location?.coordinates?.[0] ||
        orderWithUser.address?.location?.longitude,
      totalAmount: orderWithUser.pricing?.total || 0,
      deliveryFee: deliveryFeeFromOrder,
      estimatedEarnings,
      deliveryDistance:
        deliveryDistance > 0
          ? `${deliveryDistance.toFixed(2)} km`
          : "Calculating...",
      deliveryDistanceRaw: deliveryDistance || 0,
      paymentMethod: orderWithUser.payment?.method || "cash",
      message: `New order available: ${orderWithUser.orderId || orderWithUser._id}`,
      timestamp: new Date().toISOString(),
      phase,
      restaurantLat:
        restaurantLocation?.coordinates?.[1] ||
        orderWithUser.restaurantId?.location?.coordinates?.[1],
      restaurantLng:
        restaurantLocation?.coordinates?.[0] ||
        orderWithUser.restaurantId?.location?.coordinates?.[0],
      deliveryLat:
        orderWithUser.address?.location?.coordinates?.[1] ||
        orderWithUser.address?.location?.latitude,
      deliveryLng:
        orderWithUser.address?.location?.coordinates?.[0] ||
        orderWithUser.address?.location?.longitude,
    };

    const orderNotification = redactPII(orderNotificationRaw);

    for (const deliveryPartnerId of onlineDeliveryPartnerIds) {
      const roomVariations = [
        `delivery:${deliveryPartnerId}`,
        ...(mongoose.Types.ObjectId.isValid(deliveryPartnerId)
          ? [`delivery:${new mongoose.Types.ObjectId(deliveryPartnerId).toString()}`]
          : []),
      ];
      for (const room of roomVariations) {
        deliveryNamespace.to(room).emit("new_order_available", orderNotification);
        deliveryNamespace.to(room).emit("play_notification_sound", {
          type: "new_order_available",
          orderId: order.orderId,
          message: `New order available: ${order.orderId}`,
          phase,
        });
      }
    }
  } catch (error) {
    console.error("❌ Error broadcasting to all delivery boys:", error);
  }
}

/**
 * Notify delivery boy that order is ready for pickup
 * @param {Object} order - Order document
 * @param {string} deliveryPartnerId - Delivery partner ID
 */
export async function notifyDeliveryBoyOrderReady(order, deliveryPartnerId) {
  try {
    const io = await getIOInstance();

    if (!io) {
      console.warn(
        "Socket.IO not initialized, skipping delivery boy notification",
      );
      return;
    }

    const deliveryNamespace = io.of("/delivery");
    const normalizedDeliveryPartnerId =
      deliveryPartnerId?.toString() || deliveryPartnerId;

    const isOnline = await isDeliveryPartnerOnline(normalizedDeliveryPartnerId);
    if (!isOnline) {
      console.warn(
        `⚠️ Delivery partner ${normalizedDeliveryPartnerId} is offline or inactive. Skipping order_ready notification.`,
      );
      return {
        success: false,
        reason: "delivery_partner_offline",
        deliveryPartnerId: normalizedDeliveryPartnerId,
        orderId: order.orderId,
      };
    }

    // Prepare order ready notification
    const coords = order.restaurantId?.location?.coordinates;
    const orderReadyNotification = {
      orderId: order.orderId || order._id,
      mongoId: order._id?.toString(),
      status: "ready",
      restaurantName: order.restaurantName || order.restaurantId?.name,
      restaurantAddress:
        order.restaurantId?.address || order.restaurantId?.location?.address,
      message: `Order ${order.orderId} is ready for pickup`,
      timestamp: new Date().toISOString(),
      // Include restaurant coords so delivery app can show Reached Pickup when rider is near (coordinates: [lng, lat])
      restaurantLat: coords?.[1],
      restaurantLng: coords?.[0],
    };

    // Try to find delivery partner's room
    const roomVariations = [
      `delivery:${normalizedDeliveryPartnerId}`,
      `delivery:${deliveryPartnerId}`,
      ...(mongoose.Types.ObjectId.isValid(normalizedDeliveryPartnerId)
        ? [
            `delivery:${new mongoose.Types.ObjectId(normalizedDeliveryPartnerId).toString()}`,
          ]
        : []),
    ];

    let notificationSent = false;
    let foundRoom = null;
    let socketsInRoom = [];

    for (const room of roomVariations) {
      const sockets = await deliveryNamespace.in(room).fetchSockets();
      if (sockets.length > 0) {
        foundRoom = room;
        socketsInRoom = sockets;
        break;
      }
    }

    if (foundRoom && socketsInRoom.length > 0) {
      // Send to specific delivery partner room
      deliveryNamespace
        .to(foundRoom)
        .emit("order_ready", orderReadyNotification);
      notificationSent = true;
    } else {
      // Fallback: broadcast to all delivery sockets
      console.warn(
        `⚠️ Delivery partner ${normalizedDeliveryPartnerId} not found in any room, broadcasting to all`,
      );
      deliveryNamespace.emit("order_ready", orderReadyNotification);
      notificationSent = true;
    }

    return {
      success: notificationSent,
      deliveryPartnerId: normalizedDeliveryPartnerId,
      orderId: order.orderId,
    };
  } catch (error) {
    console.error("Error notifying delivery boy about order ready:", error);
    throw error;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

function normalizeEstimatedEarningsForOrder(estimatedEarnings, deliveryFee = 0) {
  const normalizedDeliveryFee = Number(deliveryFee) || 0;

  if (normalizedDeliveryFee > 0) {
    return {
      basePayout: normalizedDeliveryFee,
      distance:
        typeof estimatedEarnings === "object" && estimatedEarnings?.distance != null
          ? Number(estimatedEarnings.distance) || 0
          : 0,
      commissionPerKm: 0,
      distanceCommission: 0,
      totalEarning: normalizedDeliveryFee,
      breakdown: {
        basePayout: normalizedDeliveryFee,
        distance:
          typeof estimatedEarnings === "object" && estimatedEarnings?.distance != null
            ? Number(estimatedEarnings.distance) || 0
            : 0,
        commissionPerKm: 0,
        distanceCommission: 0,
        minDistance:
          typeof estimatedEarnings === "object" &&
          estimatedEarnings?.minDistance != null
            ? estimatedEarnings.minDistance
            : 0,
      },
      source: "delivery_fee",
    };
  }

  return estimatedEarnings;
}

/**
 * Calculate estimated earnings for delivery boy based on admin commission rules
 * Uses DeliveryBoyCommission model to calculate: Base Payout + (Distance × Per Km) if distance > minDistance
 */
async function calculateEstimatedEarnings(deliveryDistance) {
  try {
    const DeliveryBoyCommission = (
      await import("../../admin/models/DeliveryBoyCommission.js")
    ).default;

    // Always use calculateCommission method which handles all cases including distance = 0
    // It will return base payout even if distance is 0
    const deliveryDistanceForCalc = deliveryDistance || 0;
    const commissionResult = await DeliveryBoyCommission.calculateCommission(
      deliveryDistanceForCalc,
    );

    // If distance is 0 or not provided, still return base payout
    if (!deliveryDistance || deliveryDistance <= 0) {
      return {
        basePayout: commissionResult.breakdown.basePayout,
        distance: 0,
        commissionPerKm: commissionResult.breakdown.commissionPerKm,
        distanceCommission: 0,
        totalEarning: commissionResult.breakdown.basePayout, // Base payout only when distance is 0
        breakdown: `Base payout: ₹${commissionResult.breakdown.basePayout}`,
        minDistance: commissionResult.rule.minDistance,
        maxDistance: commissionResult.rule.maxDistance,
      };
    }

    // Use the already calculated commissionResult for distance > 0

    const basePayout = commissionResult.breakdown.basePayout;
    const distance = deliveryDistance;
    const commissionPerKm = commissionResult.breakdown.commissionPerKm;
    const distanceCommission = commissionResult.breakdown.distanceCommission;
    const totalEarning = commissionResult.commission;

    // Create breakdown text
    let breakdown = `Base payout: ₹${basePayout}`;
    if (distance > commissionResult.rule.minDistance) {
      breakdown += ` + Distance (${distance.toFixed(1)} km × ₹${commissionPerKm}/km) = ₹${distanceCommission.toFixed(0)}`;
    } else {
      breakdown += ` (Distance ${distance.toFixed(1)} km ≤ ${commissionResult.rule.minDistance} km, per km not applicable)`;
    }
    breakdown += ` = ₹${totalEarning.toFixed(0)}`;

    return {
      basePayout: Math.round(basePayout * 100) / 100,
      distance: Math.round(distance * 100) / 100,
      commissionPerKm: Math.round(commissionPerKm * 100) / 100,
      distanceCommission: Math.round(distanceCommission * 100) / 100,
      totalEarning: Math.round(totalEarning * 100) / 100,
      breakdown: breakdown,
      minDistance: commissionResult.rule.minDistance,
      maxDistance: commissionResult.rule.maxDistance,
    };
  } catch (error) {
    console.error("Error calculating estimated earnings:", error);
    // Fallback to default calculation
    return {
      basePayout: 10,
      distance: deliveryDistance || 0,
      commissionPerKm: 5,
      distanceCommission:
        deliveryDistance && deliveryDistance > 4 ? deliveryDistance * 5 : 0,
      totalEarning:
        10 +
        (deliveryDistance && deliveryDistance > 4 ? deliveryDistance * 5 : 0),
      breakdown: "Default calculation",
    };
  }
}
