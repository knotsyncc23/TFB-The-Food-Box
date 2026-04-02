import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import Delivery from "../models/Delivery.js";
import Order from "../../order/models/Order.js";
import Payment from "../../payment/models/Payment.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import DeliveryWallet from "../models/DeliveryWallet.js";
import DeliveryBoyCommission from "../../admin/models/DeliveryBoyCommission.js";
import RestaurantWallet from "../../restaurant/models/RestaurantWallet.js";
import RestaurantCommission from "../../admin/models/RestaurantCommission.js";
import AdminCommission from "../../admin/models/AdminCommission.js";
import { calculateRoute } from "../../order/services/routeCalculationService.js";
import {
  upsertActiveOrder,
  updateDeliveryBoyLocation,
  updateActiveOrderStatus,
  removeActiveOrder,
} from "../../../services/firebaseRealtimeService.js";
import { encodePolyline } from "../../../shared/utils/polylineEncoder.js";
import mongoose from "mongoose";
import winston from "winston";
import { findNearestDeliveryBoy } from "../../order/services/deliveryAssignmentService.js";
import {
  notifyDeliveryBoyNewOrder,
} from "../../order/services/deliveryNotificationService.js";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const normalizeId = (id) => {
  if (!id) return null;
  if (typeof id === "string") return id;
  if (id.toString) return id.toString();
  return String(id);
};

const getRejectedDeliveryIds = (assignmentInfo = {}) =>
  (assignmentInfo.rejectedDeliveryPartnerIds || [])
    .map(normalizeId)
    .filter(Boolean);

/**
 * Get Delivery Partner Orders
 * GET /api/delivery/orders
 * Query params: status, page, limit
 */
export const getOrders = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { status, page = 1, limit = 20, includeDelivered } = req.query;

    const currentDeliveryId = delivery._id;

    // Build query parts separately so multiple $or clauses don't overwrite each other.
    const queryParts = [];

    if (status) {
      queryParts.push({ status });
    } else {
      // By default, exclude delivered and cancelled orders unless explicitly requested
      if (includeDelivered !== "true" && includeDelivered !== true) {
        queryParts.push({ status: { $nin: ["delivered", "cancelled"] } });
        queryParts.push({
          $or: [
            { "deliveryState.currentPhase": { $ne: "completed" } },
            { "deliveryState.currentPhase": { $exists: false } },
          ],
        });
      }
    }

    // Orders visible to this delivery partner:
    // 1) Explicitly assigned (deliveryPartnerId)
    // 2) Or they were notified via assignmentInfo priority/expanded lists
    // 3) Or they are still unassigned and open for pickup (ready/preparing),
    //    which matches the broadcast-to-all delivery flow used by the app.
    const visibilityFilter = {
      $or: [
        { deliveryPartnerId: currentDeliveryId },
        { "assignmentInfo.priorityDeliveryPartnerIds": currentDeliveryId },
        { "assignmentInfo.expandedDeliveryPartnerIds": currentDeliveryId },
        {
          $and: [
            { status: { $in: ["preparing", "ready"] } },
            {
              $or: [
                { deliveryPartnerId: null },
                { deliveryPartnerId: { $exists: false } },
              ],
            },
          ],
        },
      ],
    };

    queryParts.push(visibilityFilter);
    queryParts.push({
      "assignmentInfo.rejectedDeliveryPartnerIds": { $nin: [currentDeliveryId] },
    });

    const query = queryParts.length === 1 ? queryParts[0] : { $and: queryParts };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch orders
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate(
        "restaurantId",
        "name slug profileImage address location phone ownerPhone",
      )
      .populate("userId", "name phone")
      .lean();

    // Get total count
    const total = await Order.countDocuments(query);

    return successResponse(res, 200, "Orders retrieved successfully", {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error(`Error fetching delivery orders: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch orders");
  }
});

/**
 * Get Single Order Details
 * GET /api/delivery/orders/:orderId
 */
export const getOrderDetails = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { orderId } = req.params;

    // Build query to find order by either _id or orderId field
    // Allow access if order is assigned to this delivery partner OR if they were notified about it
    let query = {};

    // Check if orderId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      query._id = orderId;
    } else {
      // If not a valid ObjectId, search by orderId field
      query.orderId = orderId;
    }

    // First, try to find order (without deliveryPartnerId filter)
    let order = await Order.findOne(query)
      .populate(
        "restaurantId",
        "name slug profileImage address phone ownerPhone location",
      )
      .populate("userId", "name phone email")
      .lean();

    if (!order) {
      return errorResponse(res, 404, "Order not found");
    }

    // Check if order is assigned to this delivery partner OR if they were notified
    const orderDeliveryPartnerId = order.deliveryPartnerId?.toString();
    const currentDeliveryId = delivery._id.toString();
    const rejectedDeliveryIds = getRejectedDeliveryIds(order.assignmentInfo);
    if (rejectedDeliveryIds.includes(currentDeliveryId)) {
      return errorResponse(
        res,
        403,
        "Order not found or not available for you",
      );
    }

    // Valid statuses for order acceptance (unassigned orders in these statuses can be viewed by any delivery boy)
    const validAcceptanceStatuses = ["preparing", "ready"];

    // If order is assigned to this delivery partner, allow access
    if (orderDeliveryPartnerId === currentDeliveryId) {
      // Order is assigned, proceed
    } else if (!orderDeliveryPartnerId) {
      // Order not assigned yet - allow access if:
      // 1. Order is in a valid status for acceptance (preparing/ready), OR
      // 2. This delivery boy was notified about it

      const isInValidStatus = validAcceptanceStatuses.includes(order.status);

      // Check if this delivery boy was notified
      const assignmentInfo = order.assignmentInfo || {};
      const priorityIds = assignmentInfo.priorityDeliveryPartnerIds || [];
      const expandedIds = assignmentInfo.expandedDeliveryPartnerIds || [];

      // Normalize all IDs to strings for comparison
      const normalizedCurrentId = normalizeId(currentDeliveryId);
      const normalizedPriorityIds = priorityIds
        .map(normalizeId)
        .filter(Boolean);
      const normalizedExpandedIds = expandedIds
        .map(normalizeId)
        .filter(Boolean);

      const wasNotified =
        normalizedPriorityIds.includes(normalizedCurrentId) ||
        normalizedExpandedIds.includes(normalizedCurrentId);
      // Allow access if order is in valid status OR delivery boy was notified
      if (isInValidStatus || wasNotified) {
        // Allow access to view order details
      } else {
        console.warn(
          `⚠️ Delivery partner ${currentDeliveryId} cannot access order ${order.orderId} - Status: ${order.status}, Notified: ${wasNotified}`,
        );
        return errorResponse(
          res,
          403,
          "Order not found or not available for you",
        );
      }
    } else {
      // Order is assigned to another delivery partner
      console.warn(
        `⚠️ Order ${order.orderId} is assigned to ${orderDeliveryPartnerId}, but current delivery partner is ${currentDeliveryId}`,
      );
      return errorResponse(
        res,
        403,
        "Order not found or not available for you",
      );
    }

    // Resolve payment method for delivery boy (COD vs Online)
    let paymentMethod = order.payment?.method || "razorpay";
    if (paymentMethod !== "cash") {
      try {
        const paymentRecord = await Payment.findOne({ orderId: order._id })
          .select("method")
          .lean();
        if (paymentRecord?.method === "cash") paymentMethod = "cash";
      } catch (e) {
        /* ignore */
      }
    }
    const orderWithPayment = { ...order, paymentMethod };

    return successResponse(res, 200, "Order details retrieved successfully", {
      order: orderWithPayment,
    });
  } catch (error) {
    logger.error(`Error fetching order details: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch order details");
  }
});

/**
 * Accept Order (Delivery Boy accepts the assigned order)
 * PATCH /api/delivery/orders/:orderId/accept
 */
export const acceptOrder = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { orderId } = req.params;
    const { currentLat, currentLng } = req.body; // Delivery boy's current location

    // Validate orderId
    if (
      !orderId ||
      (typeof orderId !== "string" && typeof orderId !== "object")
    ) {
      console.error(`❌ Invalid orderId provided: ${orderId}`);
      return errorResponse(res, 400, "Invalid order ID");
    }
    // Find order - try both by _id and orderId
    // First check if order exists (without deliveryPartnerId filter)
    const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId);
    const orderLookupOr = [{ orderId: orderId }];
    if (isValidObjectId) {
      orderLookupOr.unshift({ _id: orderId });
    }

    let order = await Order.findOne({
      $or: orderLookupOr,
    })
      .populate("restaurantId", "name location address phone ownerPhone")
      .populate("userId", "name phone")
      .lean();

    if (!order) {
      console.error(`❌ Order ${orderId} not found in database`);
      return errorResponse(res, 404, "Order not found");
    }

    // Check if order is assigned to this delivery partner
    const orderDeliveryPartnerId = order.deliveryPartnerId?.toString();
    const currentDeliveryId = delivery._id.toString();
    const rejectedDeliveryIds = getRejectedDeliveryIds(order.assignmentInfo);
    if (rejectedDeliveryIds.includes(currentDeliveryId)) {
      return errorResponse(
        res,
        403,
        "You have already rejected this order",
      );
    }

    // If order is not assigned, check if this delivery boy was notified (priority-based system)
    // Also allow acceptance if order is in valid status (preparing/ready) - more permissive
    if (!orderDeliveryPartnerId) {
      // Check if this delivery boy was in the priority or expanded notification list
      const assignmentInfo = order.assignmentInfo || {};
      const priorityIds = assignmentInfo.priorityDeliveryPartnerIds || [];
      const expandedIds = assignmentInfo.expandedDeliveryPartnerIds || [];

      // Helper function to normalize ID for comparison
      const normalizeId = (id) => {
        if (!id) return null;
        if (typeof id === "string") return id;
        if (id.toString) return id.toString();
        return String(id);
      };

      // Normalize all IDs to strings for comparison
      const normalizedCurrentId = normalizeId(currentDeliveryId);
      const normalizedPriorityIds = priorityIds
        .map(normalizeId)
        .filter(Boolean);
      const normalizedExpandedIds = expandedIds
        .map(normalizeId)
        .filter(Boolean);
      const wasNotified =
        normalizedPriorityIds.includes(normalizedCurrentId) ||
        normalizedExpandedIds.includes(normalizedCurrentId);

      // Also allow if order is in valid status (preparing/ready) - more permissive for unassigned orders
      const isValidStatus =
        order.status === "preparing" || order.status === "ready";

      if (!wasNotified && !isValidStatus) {
        console.error(
          `❌ Order ${order.orderId} is not assigned, delivery partner ${currentDeliveryId} was not notified, and order status is ${order.status}`,
        );
        console.error(`❌ Full order details:`, {
          orderId: order.orderId,
          orderStatus: order.status,
          deliveryPartnerId: order.deliveryPartnerId,
          assignmentInfo: JSON.stringify(order.assignmentInfo),
          priorityIds: normalizedPriorityIds,
          expandedIds: normalizedExpandedIds,
          currentDeliveryId: normalizedCurrentId,
        });
        return errorResponse(
          res,
          403,
          "This order is not available for you. It may have been assigned to another delivery partner or you were not notified about it.",
        );
      }

      // Allow acceptance if delivery boy was notified OR order is in valid status
      if (wasNotified) {
      } else if (isValidStatus) {
      }

      // Proceed with assignment: atomic update to prevent multiple delivery boys accepting the same order
      const orderMongoIdForAssign = order._id;
      const assignmentUpdate = {
        deliveryPartnerId: delivery._id,
        assignmentInfo: {
          ...(order.assignmentInfo || {}),
          deliveryPartnerId: currentDeliveryId,
          assignedAt: new Date(),
          assignedBy: "delivery_accept",
          acceptedFromNotification: true,
        },
      };

      const assignFilter = {
        _id: orderMongoIdForAssign,
        status: { $in: ["preparing", "ready"] },
        $or: [
          { deliveryPartnerId: null },
          { deliveryPartnerId: { $exists: false } },
        ],
      };

      let orderDoc = await Order.findOneAndUpdate(
        assignFilter,
        { $set: assignmentUpdate },
        { new: true },
      );

      if (!orderDoc) {
        console.error(
          `❌ Order ${order.orderId} was already accepted by another delivery partner (atomic check failed)`,
        );
        return errorResponse(
          res,
          409,
          "Order was accepted by another delivery partner. Please try another order.",
        );
      }
      // Reload order with populated data
      try {
        order = await Order.findOne({
          $or: [{ _id: orderDoc._id }, { orderId: orderId }],
        })
          .populate("restaurantId", "name location address phone ownerPhone")
          .populate("userId", "name phone")
          .lean();

        if (!order) {
          console.error(`❌ Order not found after assignment: ${orderDoc._id}`);
          return errorResponse(
            res,
            500,
            "Order not found after assignment. Please try again.",
          );
        }
      } catch (reloadError) {
        console.error(
          `❌ Error reloading order after assignment: ${reloadError.message}`,
        );
        return errorResponse(
          res,
          500,
          "Error reloading order. Please try again.",
        );
      }
    } else if (orderDeliveryPartnerId !== currentDeliveryId) {
      console.error(
        `❌ Order ${order.orderId} is assigned to ${orderDeliveryPartnerId}, but current delivery partner is ${currentDeliveryId}`,
      );
      return errorResponse(
        res,
        403,
        "Order is assigned to another delivery partner",
      );
    } else {
    }
    // Check if order is in valid state to accept
    const validStatuses = ["preparing", "ready"];
    if (!validStatuses.includes(order.status)) {
      console.warn(
        `⚠️ Order ${order.orderId} cannot be accepted. Current status: ${order.status}, Valid statuses: ${validStatuses.join(", ")}`,
      );
      return errorResponse(
        res,
        400,
        `Order cannot be accepted. Current status: ${order.status}. Order must be in 'preparing' or 'ready' status.`,
      );
    }

    // Get restaurant location
    let restaurantLat, restaurantLng;
    try {
      if (
        order.restaurantId &&
        order.restaurantId.location &&
        order.restaurantId.location.coordinates
      ) {
        [restaurantLng, restaurantLat] =
          order.restaurantId.location.coordinates;
      } else {
        // Try to fetch restaurant from database
        const restaurantId = order.restaurantId?._id || order.restaurantId;
        const restaurant = await Restaurant.findById(restaurantId);
        if (
          restaurant &&
          restaurant.location &&
          restaurant.location.coordinates
        ) {
          [restaurantLng, restaurantLat] = restaurant.location.coordinates;
        } else {
          console.error(
            `❌ Restaurant location not found for restaurant ID: ${restaurantId}`,
          );
          console.error(`❌ Restaurant data:`, {
            restaurantExists: !!restaurant,
            hasLocation: !!restaurant?.location,
            hasCoordinates: !!restaurant?.location?.coordinates,
            locationType: typeof restaurant?.location,
          });
          return errorResponse(res, 400, "Restaurant location not found");
        }
      }

      // Validate coordinates
      if (
        !restaurantLat ||
        !restaurantLng ||
        isNaN(restaurantLat) ||
        isNaN(restaurantLng)
      ) {
        console.error(
          `❌ Invalid restaurant coordinates: lat=${restaurantLat}, lng=${restaurantLng}`,
        );
        return errorResponse(
          res,
          400,
          "Invalid restaurant location coordinates",
        );
      }
    } catch (locationError) {
      console.error(
        `❌ Error getting restaurant location: ${locationError.message}`,
      );
      console.error(`❌ Location error stack: ${locationError.stack}`);
      return errorResponse(
        res,
        500,
        "Error getting restaurant location. Please try again.",
      );
    }

    // Get delivery boy's current location
    let deliveryLat = currentLat;
    let deliveryLng = currentLng;
    if (!deliveryLat || !deliveryLng) {
      // Try to get from delivery partner's current location
      try {
        const deliveryPartner = await Delivery.findById(delivery._id)
          .select("availability.currentLocation")
          .lean();

        if (deliveryPartner?.availability?.currentLocation?.coordinates) {
          [deliveryLng, deliveryLat] =
            deliveryPartner.availability.currentLocation.coordinates;
        } else {
          console.error(`❌ Delivery partner location not found in profile`);
          return errorResponse(
            res,
            400,
            "Delivery partner location not found. Please enable location services.",
          );
        }
      } catch (deliveryLocationError) {
        console.error(
          `❌ Error fetching delivery partner location: ${deliveryLocationError.message}`,
        );
        return errorResponse(
          res,
          500,
          "Error getting delivery partner location. Please try again.",
        );
      }
    }

    // Validate coordinates before calculating route
    if (
      !deliveryLat ||
      !deliveryLng ||
      isNaN(deliveryLat) ||
      isNaN(deliveryLng) ||
      !restaurantLat ||
      !restaurantLng ||
      isNaN(restaurantLat) ||
      isNaN(restaurantLng)
    ) {
      console.error(`❌ Invalid coordinates for route calculation:`, {
        deliveryLat,
        deliveryLng,
        restaurantLat,
        restaurantLng,
        deliveryLatValid: !!(deliveryLat && !isNaN(deliveryLat)),
        deliveryLngValid: !!(deliveryLng && !isNaN(deliveryLng)),
        restaurantLatValid: !!(restaurantLat && !isNaN(restaurantLat)),
        restaurantLngValid: !!(restaurantLng && !isNaN(restaurantLng)),
      });
      return errorResponse(
        res,
        400,
        "Invalid location coordinates. Please ensure location services are enabled.",
      );
    }
    // Calculate route from delivery boy to restaurant
    let routeData;
    const haversineDistance = (lat1, lng1, lat2, lng2) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    try {
      routeData = await calculateRoute(
        deliveryLat,
        deliveryLng,
        restaurantLat,
        restaurantLng,
      );
      // Validate route data - ensure all required fields are present and valid
      if (
        !routeData ||
        !routeData.coordinates ||
        !Array.isArray(routeData.coordinates) ||
        routeData.coordinates.length === 0 ||
        typeof routeData.distance !== "number" ||
        isNaN(routeData.distance) ||
        typeof routeData.duration !== "number" ||
        isNaN(routeData.duration)
      ) {
        console.warn(
          "⚠️ Route calculation returned invalid data, using fallback",
        );
        // Fallback to straight line
        const distance = haversineDistance(
          deliveryLat,
          deliveryLng,
          restaurantLat,
          restaurantLng,
        );
        routeData = {
          coordinates: [
            [deliveryLat, deliveryLng],
            [restaurantLat, restaurantLng],
          ],
          distance: distance,
          duration: (distance / 30) * 60, // Assume 30 km/h average speed
          method: "haversine_fallback",
        };
      } else {
      }
    } catch (routeError) {
      console.error("❌ Error calculating route:", routeError);
      console.error("❌ Route error stack:", routeError.stack);
      // Fallback to straight line
      const distance = haversineDistance(
        deliveryLat,
        deliveryLng,
        restaurantLat,
        restaurantLng,
      );
      routeData = {
        coordinates: [
          [deliveryLat, deliveryLng],
          [restaurantLat, restaurantLng],
        ],
        distance: distance,
        duration: (distance / 30) * 60,
        method: "haversine_fallback",
      };
    }

    // Final validation - ensure routeData is valid before using it
    if (
      !routeData ||
      !routeData.coordinates ||
      !Array.isArray(routeData.coordinates) ||
      routeData.coordinates.length === 0 ||
      typeof routeData.distance !== "number" ||
      isNaN(routeData.distance) ||
      typeof routeData.duration !== "number" ||
      isNaN(routeData.duration)
    ) {
      console.error("❌ Route data validation failed after all fallbacks");
      console.error("❌ Route data:", JSON.stringify(routeData, null, 2));
      return errorResponse(
        res,
        500,
        "Failed to calculate route. Please try again.",
      );
    }
    // Update order status and tracking
    // Use order._id (MongoDB ObjectId) - ensure it exists
    if (!order._id) {
      console.error(`❌ Order ${order.orderId} does not have _id field`);
      return errorResponse(res, 500, "Order data is invalid");
    }

    const orderMongoId = order._id;
    // Prepare route data for storage - ensure coordinates are valid
    const routeToPickup = {
      coordinates: routeData.coordinates,
      distance: Number(routeData.distance),
      duration: Number(routeData.duration),
      calculatedAt: new Date(),
      method: routeData.method || "unknown",
    };
    // Validate route coordinates before saving
    if (
      !Array.isArray(routeToPickup.coordinates) ||
      routeToPickup.coordinates.length === 0
    ) {
      console.error("❌ Invalid route coordinates");
      console.error("❌ Route coordinates:", routeToPickup.coordinates);
      return errorResponse(res, 500, "Invalid route data. Please try again.");
    }

    let updatedOrder;
    try {
      updatedOrder = await Order.findByIdAndUpdate(
        orderMongoId,
        {
          $set: {
            "deliveryState.status": "accepted",
            "deliveryState.acceptedAt": new Date(),
            "deliveryState.currentPhase": "en_route_to_pickup",
            "deliveryState.routeToPickup": routeToPickup,
          },
        },
        { new: true },
      )
        .populate("restaurantId", "name location address phone ownerPhone")
        .populate("userId", "name phone")
        .lean();

      if (!updatedOrder) {
        console.error(
          `❌ Order ${orderMongoId} not found after update attempt`,
        );
        return errorResponse(res, 404, "Order not found");
      }
    } catch (updateError) {
      console.error("❌ Error updating order:", updateError);
      console.error("❌ Update error message:", updateError.message);
      console.error("❌ Update error name:", updateError.name);
      console.error("❌ Update error stack:", updateError.stack);
      if (updateError.errors) {
        console.error("❌ Update validation errors:", updateError.errors);
      }
      return errorResponse(
        res,
        500,
        `Failed to update order: ${updateError.message || "Unknown error"}`,
      );
    }
    // Calculate delivery distance (restaurant to customer) for earnings calculation
    let deliveryDistance = 0;
    if (
      updatedOrder.restaurantId?.location?.coordinates &&
      updatedOrder.address?.location?.coordinates
    ) {
      const [restaurantLng, restaurantLat] =
        updatedOrder.restaurantId.location.coordinates;
      const [customerLng, customerLat] =
        updatedOrder.address.location.coordinates;

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
    }

    // Calculate estimated earnings based on delivery distance
    let estimatedEarnings = null;
    try {
      const DeliveryBoyCommission = (
        await import("../../admin/models/DeliveryBoyCommission.js")
      ).default;
      const commissionResult =
        await DeliveryBoyCommission.calculateCommission(deliveryDistance);

      // Validate commission result
      if (
        !commissionResult ||
        !commissionResult.breakdown ||
        typeof commissionResult.commission !== "number" ||
        isNaN(commissionResult.commission)
      ) {
        throw new Error("Invalid commission result structure");
      }

      const breakdown = commissionResult.breakdown || {};
      const rule = commissionResult.rule || { minDistance: 4 };

      estimatedEarnings = {
        basePayout: Math.round((breakdown.basePayout || 10) * 100) / 100,
        distance: Math.round(deliveryDistance * 100) / 100,
        commissionPerKm:
          Math.round((breakdown.commissionPerKm || 5) * 100) / 100,
        distanceCommission:
          Math.round((breakdown.distanceCommission || 0) * 100) / 100,
        totalEarning: Math.round(commissionResult.commission * 100) / 100,
        breakdown: {
          basePayout: breakdown.basePayout || 10,
          distance: deliveryDistance,
          commissionPerKm: breakdown.commissionPerKm || 5,
          distanceCommission: breakdown.distanceCommission || 0,
          minDistance: rule.minDistance || 4,
        },
      };
    } catch (earningsError) {
      console.error("❌ Error calculating estimated earnings:", earningsError);
      console.error("❌ Earnings error stack:", earningsError.stack);
      // Fallback to default
      estimatedEarnings = {
        basePayout: 10,
        distance: Math.round(deliveryDistance * 100) / 100,
        commissionPerKm: 5,
        distanceCommission:
          deliveryDistance > 4
            ? Math.round(deliveryDistance * 5 * 100) / 100
            : 0,
        totalEarning:
          10 +
          (deliveryDistance > 4
            ? Math.round(deliveryDistance * 5 * 100) / 100
            : 0),
        breakdown: {
          basePayout: 10,
          distance: deliveryDistance,
          commissionPerKm: 5,
          distanceCommission: deliveryDistance > 4 ? deliveryDistance * 5 : 0,
          minDistance: 4,
        },
      };
    }

    const deliveryFeeFromOrder = Number(updatedOrder.pricing?.deliveryFee) || 0;
    if (deliveryFeeFromOrder > 0) {
      estimatedEarnings = {
        basePayout: deliveryFeeFromOrder,
        distance: Math.round(deliveryDistance * 100) / 100,
        commissionPerKm: 0,
        distanceCommission: 0,
        totalEarning: deliveryFeeFromOrder,
        breakdown: {
          basePayout: deliveryFeeFromOrder,
          distance: deliveryDistance,
          commissionPerKm: 0,
          distanceCommission: 0,
          minDistance: 0,
        },
        source: "delivery_fee",
      };
    }

    // Resolve payment method for delivery boy (COD vs Online) - use Payment collection if order.payment is wrong
    let paymentMethod = updatedOrder.payment?.method || "razorpay";
    if (paymentMethod !== "cash") {
      try {
        const paymentRecord = await Payment.findOne({
          orderId: updatedOrder._id,
        })
          .select("method")
          .lean();
        if (paymentRecord?.method === "cash") paymentMethod = "cash";
      } catch (e) {
        /* ignore */
      }
    }
    const orderWithPayment = { ...updatedOrder, paymentMethod };

    // Emit to all delivery boys so accepted order disappears from their available list in real time
    try {
      const serverModule = await import("../../../server.js");
      const getIO = serverModule.getIO;
      const io = getIO ? getIO() : null;
      if (io) {
        const deliveryNamespace = io.of("/delivery");
        deliveryNamespace.emit("order_accepted", {
          orderId: updatedOrder.orderId,
          mongoId: updatedOrder._id?.toString?.() || String(updatedOrder._id),
          acceptedBy: delivery._id?.toString?.() || String(delivery._id),
        });
      }
    } catch (emitErr) {
      console.error("Error emitting order_accepted:", emitErr);
    }

    // Store pickup polyline in Firebase so frontend can render route without Google Directions API
    try {
      const custCoords = updatedOrder.address?.location?.coordinates;
      const [custLng, custLat] = custCoords || [0, 0];
      await upsertActiveOrder({
        orderId: updatedOrder.orderId,
        boy_id: delivery._id.toString(),
        boy_lat: deliveryLat,
        boy_lng: deliveryLng,
        restaurant_lat: restaurantLat,
        restaurant_lng: restaurantLng,
        customer_lat: custLat,
        customer_lng: custLng,
        polyline: encodePolyline(routeData.coordinates),
        distance: routeData.distance,
        duration: routeData.duration,
        status: "accepted",
      });
    } catch (firebaseErr) {
      console.warn("Firebase upsertActiveOrder in acceptOrder failed:", firebaseErr.message);
    }

    return successResponse(res, 200, "Order accepted successfully", {
      order: orderWithPayment,
      route: {
        coordinates: routeData.coordinates,
        distance: routeData.distance,
        duration: routeData.duration,
        method: routeData.method,
      },
      estimatedEarnings: estimatedEarnings,
      deliveryDistance: deliveryDistance,
    });
  } catch (error) {
    logger.error(`Error accepting order: ${error.message}`);
    console.error("❌ Error accepting order - Full error:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      orderId: req.params?.orderId,
      deliveryId: req.delivery?._id,
    });
    return errorResponse(res, 500, error.message || "Failed to accept order");
  }
});

/**
 * Reject Order and reassign it to another delivery partner
 * PATCH /api/delivery/orders/:orderId/reject
 */
export const rejectOrder = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { orderId } = req.params;
    const { reason = "Rejected by delivery partner" } = req.body || {};

    const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId);
    const orderLookupOr = [{ orderId: orderId }];
    if (isValidObjectId) {
      orderLookupOr.unshift({ _id: orderId });
    }

    let order = await Order.findOne({
      $or: orderLookupOr,
    })
      .populate("restaurantId", "name location address phone ownerPhone")
      .populate("userId", "name phone")
      .lean();

    if (!order) {
      return errorResponse(res, 404, "Order not found");
    }

    const currentDeliveryId = delivery._id.toString();
    const orderDeliveryPartnerId = order.deliveryPartnerId?.toString();
    const rejectedDeliveryIds = getRejectedDeliveryIds(order.assignmentInfo);

    if (rejectedDeliveryIds.includes(currentDeliveryId)) {
      return errorResponse(
        res,
        403,
        "You have already rejected this order",
      );
    }

    if (
      orderDeliveryPartnerId &&
      orderDeliveryPartnerId !== currentDeliveryId
    ) {
      return errorResponse(
        res,
        403,
        "Order is assigned to another delivery partner",
      );
    }

    const validStatuses = ["preparing", "ready"];
    if (!validStatuses.includes(order.status)) {
      return errorResponse(
        res,
        400,
        `Order cannot be rejected. Current status: ${order.status}.`,
      );
    }

    let restaurantLat;
    let restaurantLng;
    try {
      if (
        order.restaurantId &&
        order.restaurantId.location &&
        order.restaurantId.location.coordinates
      ) {
        [restaurantLng, restaurantLat] =
          order.restaurantId.location.coordinates;
      } else {
        const restaurantId = order.restaurantId?._id || order.restaurantId;
        const restaurant = await Restaurant.findById(restaurantId);
        if (
          restaurant &&
          restaurant.location &&
          restaurant.location.coordinates
        ) {
          [restaurantLng, restaurantLat] = restaurant.location.coordinates;
        } else {
          return errorResponse(res, 400, "Restaurant location not found");
        }
      }

      if (
        !restaurantLat ||
        !restaurantLng ||
        isNaN(restaurantLat) ||
        isNaN(restaurantLng)
      ) {
        return errorResponse(
          res,
          400,
          "Invalid restaurant location coordinates",
        );
      }
    } catch (locationError) {
      logger.error(`Error resolving restaurant location: ${locationError.message}`);
      return errorResponse(res, 500, "Error getting restaurant location");
    }

    const updatedRejectedIds = Array.from(
      new Set([...rejectedDeliveryIds, currentDeliveryId]),
    );
    const nextDeliveryBoy = await findNearestDeliveryBoy(
      restaurantLat,
      restaurantLng,
      order.restaurantId?._id || order.restaurantId,
      50,
      updatedRejectedIds,
    );

    const assignmentUpdate = {
      ...(order.assignmentInfo || {}),
      deliveryPartnerId: nextDeliveryBoy?.deliveryPartnerId || null,
      assignedAt: new Date(),
      assignedBy: "nearest_available",
      rejectedDeliveryPartnerIds: updatedRejectedIds,
    };

    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: { $in: validStatuses },
        $or: [
          { deliveryPartnerId: currentDeliveryId },
          { deliveryPartnerId: null },
          { deliveryPartnerId: { $exists: false } },
        ],
      },
      {
        $set: {
          deliveryPartnerId: nextDeliveryBoy?.deliveryPartnerId || null,
          assignmentInfo: assignmentUpdate,
        },
      },
      { new: true },
    )
      .populate("restaurantId", "name location address phone ownerPhone")
      .populate("userId", "name phone")
      .lean();

    if (!updatedOrder) {
      return errorResponse(
        res,
        409,
        "Order could not be rejected right now. Please try again.",
      );
    }

    if (nextDeliveryBoy?.deliveryPartnerId) {
      await notifyDeliveryBoyNewOrder(updatedOrder, nextDeliveryBoy.deliveryPartnerId);
    }

    return successResponse(res, 200, "Order rejected and reassigned successfully", {
      order: updatedOrder,
      reassignedTo: nextDeliveryBoy?.deliveryPartnerId || null,
      reason,
    });
  } catch (error) {
    logger.error(`Error rejecting order: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to reject order");
  }
});

/**
 * Confirm Reached Pickup
 * PATCH /api/delivery/orders/:orderId/reached-pickup
 */
export const confirmReachedPickup = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { orderId } = req.params;
    const deliveryId = delivery._id;
    // Find order by _id or orderId field
    let order = null;

    // Check if orderId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findOne({
        _id: orderId,
        deliveryPartnerId: deliveryId,
      });
    } else {
      // If not a valid ObjectId, search by orderId field
      order = await Order.findOne({
        orderId: orderId,
        deliveryPartnerId: deliveryId,
      });
    }

    if (!order) {
      console.warn(
        `⚠️ Order not found - orderId: ${orderId}, deliveryId: ${deliveryId}`,
      );
      return errorResponse(res, 404, "Order not found or not assigned to you");
    }
    // Initialize deliveryState if it doesn't exist
    if (!order.deliveryState) {
      order.deliveryState = {
        status: "accepted",
        currentPhase: "en_route_to_pickup",
      };
    }

    // Ensure currentPhase exists
    if (!order.deliveryState.currentPhase) {
      order.deliveryState.currentPhase = "en_route_to_pickup";
    }

    // Check if order is already past pickup phase (order ID confirmed or out for delivery)
    // If so, return success with current state (idempotent)
    const isPastPickupPhase =
      order.deliveryState.currentPhase === "en_route_to_delivery" ||
      order.deliveryState.currentPhase === "picked_up" ||
      order.deliveryState.status === "order_confirmed" ||
      order.status === "out_for_delivery";

    if (isPastPickupPhase) {
      return successResponse(res, 200, "Order is already past pickup phase", {
        order,
        message: "Order is already out for delivery",
      });
    }

    // Check if order is in valid state
    // Allow reached pickup if:
    // - currentPhase is 'en_route_to_pickup' OR
    // - currentPhase is 'at_pickup' (already at pickup - idempotent, allow re-confirmation)
    // - status is 'accepted' OR
    // - currentPhase is 'accepted' (alternative phase name)
    // - order status is 'preparing' or 'ready' (restaurant preparing/ready)
    const isValidState =
      order.deliveryState.currentPhase === "en_route_to_pickup" ||
      order.deliveryState.currentPhase === "at_pickup" || // Already at pickup - idempotent
      order.deliveryState.status === "accepted" ||
      order.deliveryState.status === "reached_pickup" || // Already reached - idempotent
      order.deliveryState.currentPhase === "accepted" ||
      order.status === "preparing" || // Order is preparing, can reach pickup
      order.status === "ready"; // Order is ready, can reach pickup

    // If already at pickup, just return success (idempotent operation)
    if (
      order.deliveryState.currentPhase === "at_pickup" ||
      order.deliveryState.status === "reached_pickup"
    ) {
      return successResponse(res, 200, "Reached pickup already confirmed", {
        order,
        message: "Order was already marked as reached pickup",
      });
    }

    if (!isValidState) {
      return errorResponse(
        res,
        400,
        `Order is not in valid state for reached pickup. Current phase: ${order.deliveryState?.currentPhase || "unknown"}, Status: ${order.deliveryState?.status || "unknown"}, Order status: ${order.status || "unknown"}`,
      );
    }

    // Update order state
    order.deliveryState.status = "reached_pickup";
    order.deliveryState.currentPhase = "at_pickup";
    order.deliveryState.reachedPickupAt = new Date();
    await order.save();

    // Sync phase to Firebase
    try {
      await updateActiveOrderStatus(order.orderId, { status: "at_pickup" });
    } catch (fbErr) {
      console.warn("Firebase updateActiveOrderStatus (at_pickup) failed:", fbErr.message);
    }

    // After 10 seconds, trigger order ID confirmation request
    // Use order._id (MongoDB ObjectId) instead of orderId string
    const orderMongoId = order._id;
    setTimeout(async () => {
      try {
        const freshOrder = await Order.findById(orderMongoId);
        if (
          freshOrder &&
          freshOrder.deliveryState?.currentPhase === "at_pickup"
        ) {
          // Emit socket event to request order ID confirmation
          let getIO;
          try {
            const serverModule = await import("../../../server.js");
            getIO = serverModule.getIO;
          } catch (importError) {
            console.error("Error importing server module:", importError);
            return;
          }

          if (getIO) {
            const io = getIO();
            if (io) {
              const deliveryNamespace = io.of("/delivery");
              const deliveryId = delivery._id.toString();
              deliveryNamespace
                .to(`delivery:${deliveryId}`)
                .emit("request_order_id_confirmation", {
                  orderId: freshOrder.orderId,
                  orderMongoId: freshOrder._id.toString(),
                });
            }
          }
        }
      } catch (error) {
        console.error("Error sending order ID confirmation request:", error);
      }
    }, 10000); // 10 seconds delay

    return successResponse(res, 200, "Reached pickup confirmed", {
      order,
      message: "Order ID confirmation will be requested in 10 seconds",
    });
  } catch (error) {
    logger.error(`Error confirming reached pickup: ${error.message}`);
    return errorResponse(res, 500, "Failed to confirm reached pickup");
  }
});

/**
 * Confirm Order ID
 * PATCH /api/delivery/orders/:orderId/confirm-order-id
 */
export const confirmOrderId = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { orderId } = req.params;
    const { confirmedOrderId, billImageUrl } = req.body; // Order ID confirmed by delivery boy, bill image URL
    const { currentLat, currentLng } = req.body; // Current location for route calculation

    // Find order by _id or orderId - try multiple methods for better compatibility
    let order = null;
    const deliveryId = delivery._id;

    // Method 1: Try as MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findOne({
        $and: [{ _id: orderId }, { deliveryPartnerId: deliveryId }],
      })
        .populate("userId", "name phone")
        .populate("restaurantId", "name location address phone ownerPhone")
        .lean();
    }

    // Method 2: Try by orderId field
    if (!order) {
      order = await Order.findOne({
        $and: [{ orderId: orderId }, { deliveryPartnerId: deliveryId }],
      })
        .populate("userId", "name phone")
        .populate("restaurantId", "name location address phone ownerPhone")
        .lean();
    }

    // Method 3: Try with string comparison for deliveryPartnerId
    if (!order) {
      order = await Order.findOne({
        $and: [
          {
            $or: [{ _id: orderId }, { orderId: orderId }],
          },
          {
            deliveryPartnerId: deliveryId.toString(),
          },
        ],
      })
        .populate("userId", "name phone")
        .populate("restaurantId", "name location address phone ownerPhone")
        .lean();
    }

    if (!order) {
      console.error(
        `❌ Order ${orderId} not found or not assigned to delivery ${deliveryId}`,
      );
      return errorResponse(res, 404, "Order not found or not assigned to you");
    }

    // Pre-compute restaurant coordinates (for Firebase + routing)
    let restaurantLat = null;
    let restaurantLng = null;
    if (order.restaurantId?.location?.coordinates?.length >= 2) {
      [restaurantLng, restaurantLat] = order.restaurantId.location.coordinates;
    }

    // Verify order ID matches
    if (confirmedOrderId && confirmedOrderId !== order.orderId) {
      return errorResponse(res, 400, "Order ID does not match");
    }

    // Check if order is in valid state
    // Initialize deliveryState if it doesn't exist
    if (!order.deliveryState) {
      // If deliveryState doesn't exist, initialize it but still allow confirmation
      // This can happen if reached pickup was confirmed but deliveryState wasn't saved properly
      order.deliveryState = {
        status: "reached_pickup",
        currentPhase: "at_pickup",
      };
    }

    // Ensure currentPhase exists
    if (!order.deliveryState.currentPhase) {
      order.deliveryState.currentPhase = "at_pickup";
    }

    // Check if order ID is already confirmed (idempotent check)
    const isAlreadyConfirmed =
      order.deliveryState?.status === "order_confirmed" ||
      order.deliveryState?.currentPhase === "en_route_to_delivery" ||
      order.deliveryState?.currentPhase === "picked_up" ||
      order.status === "out_for_delivery" ||
      order.deliveryState?.orderIdConfirmedAt;

    if (isAlreadyConfirmed) {
      // Order ID is already confirmed - return success with current order data (idempotent)
      // Get customer location for route calculation if not already calculated
      const [customerLng, customerLat] = order.address.location.coordinates;

      // Get delivery boy's current location
      let deliveryLat = currentLat;
      let deliveryLng = currentLng;

      if (!deliveryLat || !deliveryLng) {
        const deliveryPartner = await Delivery.findById(delivery._id)
          .select("availability.currentLocation")
          .lean();

        if (deliveryPartner?.availability?.currentLocation?.coordinates) {
          [deliveryLng, deliveryLat] =
            deliveryPartner.availability.currentLocation.coordinates;
        } else if (order.restaurantId) {
          let restaurant = null;
          if (mongoose.Types.ObjectId.isValid(order.restaurantId)) {
            restaurant = await Restaurant.findById(order.restaurantId)
              .select("location")
              .lean();
          } else {
            restaurant = await Restaurant.findOne({
              restaurantId: order.restaurantId,
            })
              .select("location")
              .lean();
          }
          if (restaurant?.location?.coordinates) {
            [deliveryLng, deliveryLat] = restaurant.location.coordinates;
          }
        }
      }

      // Return existing route if available, otherwise calculate new route
      let routeData = null;
      if (order.deliveryState?.routeToDelivery?.coordinates?.length > 0) {
        // Use existing route
        routeData = {
          coordinates: order.deliveryState.routeToDelivery.coordinates,
          distance: order.deliveryState.routeToDelivery.distance,
          duration: order.deliveryState.routeToDelivery.duration,
          method: order.deliveryState.routeToDelivery.method || "dijkstra",
        };
      } else if (deliveryLat && deliveryLng && customerLat && customerLng) {
        // Calculate new route if not available
        routeData = await calculateRoute(
          deliveryLat,
          deliveryLng,
          customerLat,
          customerLng,
          {
            useDijkstra: true,
          },
        );
      }

      // Sync already-confirmed order to Firebase Realtime Database
      try {
        if (
          routeData &&
          routeData.coordinates &&
          routeData.coordinates.length > 0 &&
          restaurantLat !== null &&
          restaurantLng !== null &&
          customerLat &&
          customerLng &&
          deliveryLat &&
          deliveryLng
        ) {
          const rtdbOrderId =
            order.orderId || (order._id && order._id.toString()) || orderId;
          const polyline = encodePolyline(routeData.coordinates);

          await upsertActiveOrder({
            orderId: rtdbOrderId,
            boy_id: delivery._id.toString(),
            boy_lat: deliveryLat,
            boy_lng: deliveryLng,
            restaurant_lat: restaurantLat,
            restaurant_lng: restaurantLng,
            customer_lat: customerLat,
            customer_lng: customerLng,
            polyline,
            distance: routeData.distance,
            duration: routeData.duration,
            status: "en_route_to_delivery",
          });

          await updateDeliveryBoyLocation(
            delivery._id.toString(),
            deliveryLat,
            deliveryLng,
            rtdbOrderId,
          );
        }
      } catch (firebaseErr) {
        console.warn(
          "Firebase sync (already-confirmed order) failed: " +
            firebaseErr.message,
        );
      }

      return successResponse(res, 200, "Order ID already confirmed", {
        order: order,
        route: routeData,
      });
    }

    // Check if order is in valid state for order ID confirmation
    // Allow confirmation if:
    // - currentPhase is 'at_pickup' (after Reached Pickup) OR
    // - status is 'reached_pickup' OR
    // - order status is 'preparing' or 'ready' (restaurant preparing/ready) OR
    // - currentPhase is 'en_route_to_pickup' or status is 'accepted' (Reached Pickup not yet persisted / edge case)
    const isValidState =
      order.deliveryState.currentPhase === "at_pickup" ||
      order.deliveryState.status === "reached_pickup" ||
      order.status === "preparing" ||
      order.status === "ready" ||
      order.deliveryState.currentPhase === "en_route_to_pickup" ||
      order.deliveryState.status === "accepted";

    if (!isValidState) {
      return errorResponse(
        res,
        400,
        `Order is not at pickup. Current phase: ${order.deliveryState?.currentPhase || "unknown"}, Status: ${order.deliveryState?.status || "unknown"}, Order status: ${order.status || "unknown"}`,
      );
    }

    // Get customer location
    if (
      !order.address?.location?.coordinates ||
      order.address.location.coordinates.length < 2
    ) {
      return errorResponse(res, 400, "Customer location not found");
    }

    const [customerLng, customerLat] = order.address.location.coordinates;

    // Get delivery boy's current location (should be at restaurant)
    let deliveryLat = currentLat;
    let deliveryLng = currentLng;

    if (!deliveryLat || !deliveryLng) {
      // Try to get from delivery partner's current location
      const deliveryPartner = await Delivery.findById(delivery._id)
        .select("availability.currentLocation")
        .lean();

      if (deliveryPartner?.availability?.currentLocation?.coordinates) {
        [deliveryLng, deliveryLat] =
          deliveryPartner.availability.currentLocation.coordinates;
      } else {
        // Use restaurant location as fallback
        // order.restaurantId might be a string or ObjectId
        let restaurant = null;
        if (mongoose.Types.ObjectId.isValid(order.restaurantId)) {
          restaurant = await Restaurant.findById(order.restaurantId)
            .select("location")
            .lean();
        } else {
          // Try to find by restaurantId field if it's a string
          restaurant = await Restaurant.findOne({
            restaurantId: order.restaurantId,
          })
            .select("location")
            .lean();
        }
        if (restaurant?.location?.coordinates) {
          [deliveryLng, deliveryLat] = restaurant.location.coordinates;
        } else {
          return errorResponse(
            res,
            400,
            "Location not found for route calculation",
          );
        }
      }
    }

    // Calculate route from restaurant to customer using Dijkstra algorithm
    const routeData = await calculateRoute(
      deliveryLat,
      deliveryLng,
      customerLat,
      customerLng,
      {
        useDijkstra: true,
      },
    );

    // Update order state - use order._id (MongoDB _id) not orderId string
    // Since we found the order, order._id should exist (from .lean() it's a plain object with _id)
    const orderMongoId = order._id;
    if (!orderMongoId) {
      return errorResponse(res, 500, "Order ID not found in order object");
    }
    const updateData = {
      "deliveryState.status": "order_confirmed",
      "deliveryState.currentPhase": "en_route_to_delivery",
      "deliveryState.orderIdConfirmedAt": new Date(),
      "deliveryState.routeToDelivery": {
        coordinates: routeData.coordinates,
        distance: routeData.distance,
        duration: routeData.duration,
        calculatedAt: new Date(),
        method: routeData.method,
      },
      status: "out_for_delivery",
      "tracking.outForDelivery": {
        status: true,
        timestamp: new Date(),
      },
    };

    // Add bill image URL if provided (with validation)
    if (billImageUrl) {
      // Validate URL format
      try {
        const url = new URL(billImageUrl);
        // Ensure it's a valid HTTP/HTTPS URL
        if (!["http:", "https:"].includes(url.protocol)) {
          return errorResponse(
            res,
            400,
            "Bill image URL must be HTTP or HTTPS",
          );
        }
        // Optional: Validate it's from Cloudinary (security check)
        if (
          !url.hostname.includes("cloudinary.com") &&
          !url.hostname.includes("res.cloudinary.com")
        ) {
          console.warn(
            `⚠️ Bill image URL is not from Cloudinary: ${url.hostname}`,
          );
          // Don't reject, but log warning for monitoring
        }
        updateData.billImageUrl = billImageUrl;
      } catch (urlError) {
        console.error(
          `❌ Invalid bill image URL format: ${billImageUrl}`,
          urlError,
        );
        return errorResponse(res, 400, "Invalid bill image URL format");
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderMongoId,
      { $set: updateData },
      { new: true },
    )
      .populate("userId", "name phone")
      .populate("restaurantId", "name location address")
      .lean();
    // Send response first, then handle socket notification asynchronously
    const responseData = {
      order: updatedOrder,
      route: {
        coordinates: routeData.coordinates,
        distance: routeData.distance,
        duration: routeData.duration,
        method: routeData.method,
      },
    };

    const response = successResponse(
      res,
      200,
      "Order ID confirmed",
      responseData,
    );

    // Emit socket event to customer asynchronously (don't block response)
    (async () => {
      try {
        // Get IO instance dynamically to avoid circular dependencies
        const serverModule = await import("../../../server.js");
        const getIO = serverModule.getIO;
        const io = getIO ? getIO() : null;

        if (io) {
          // Emit to customer tracking this order
          // Format matches server.js: order:${orderId}
          io.to(`order:${updatedOrder._id.toString()}`).emit(
            "order_status_update",
            {
              title: "Order Update",
              message: "Your delivery partner is on the way! 🏍️",
              status: "out_for_delivery",
              orderId: updatedOrder.orderId,
              deliveryStartedAt: new Date(),
              estimatedDeliveryTime: routeData.duration || null,
            },
          );
        } else {
          console.warn(
            "⚠️ Socket.IO not initialized, skipping customer notification",
          );
        }
      } catch (notifError) {
        console.error("Error sending customer notification:", notifError);
        // Don't fail the response if notification fails
      }

      // Also sync active_orders + delivery_boys in Firebase for live tracking
      try {
        if (
          routeData &&
          routeData.coordinates &&
          routeData.coordinates.length > 0 &&
          restaurantLat !== null &&
          restaurantLng !== null &&
          customerLat &&
          customerLng &&
          deliveryLat &&
          deliveryLng
        ) {
          const rtdbOrderId =
            order.orderId ||
            (updatedOrder && updatedOrder._id && updatedOrder._id.toString()) ||
            orderId;
          const polyline = encodePolyline(routeData.coordinates);

          await upsertActiveOrder({
            orderId: rtdbOrderId,
            boy_id: delivery._id.toString(),
            boy_lat: deliveryLat,
            boy_lng: deliveryLng,
            restaurant_lat: restaurantLat,
            restaurant_lng: restaurantLng,
            customer_lat: customerLat,
            customer_lng: customerLng,
            polyline,
            distance: routeData.distance,
            duration: routeData.duration,
            status: "en_route_to_delivery",
          });

          await updateDeliveryBoyLocation(
            delivery._id.toString(),
            deliveryLat,
            deliveryLng,
            rtdbOrderId,
          );
        }
      } catch (firebaseErr) {
        console.warn(
          "Firebase sync (order ID confirmed) failed: " + firebaseErr.message,
        );
      }
    })();

    return response;
  } catch (error) {
    logger.error(`Error confirming order ID: ${error.message}`);
    console.error("Error stack:", error.stack);
    return errorResponse(res, 500, "Failed to confirm order ID");
  }
});

/**
 * Confirm Reached Drop (Delivery Boy reached customer location)
 * PATCH /api/delivery/orders/:orderId/reached-drop
 */
export const confirmReachedDrop = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { orderId } = req.params;

    if (!delivery || !delivery._id) {
      return errorResponse(
        res,
        401,
        "Delivery partner authentication required",
      );
    }

    if (!orderId) {
      return errorResponse(res, 400, "Order ID is required");
    }

    // Find order by _id or orderId, and ensure it's assigned to this delivery partner
    // Try multiple comparison methods for deliveryPartnerId (ObjectId vs string)
    const deliveryId = delivery._id;
    // Try finding order with different deliveryPartnerId comparison methods
    // First try without lean() to get Mongoose document (needed for proper ObjectId comparison)
    let order = await Order.findOne({
      $and: [
        {
          $or: [{ _id: orderId }, { orderId: orderId }],
        },
        {
          deliveryPartnerId: deliveryId, // Try as ObjectId first (most common)
        },
      ],
    });

    // If not found, try with string comparison
    if (!order) {
      order = await Order.findOne({
        $and: [
          {
            $or: [{ _id: orderId }, { orderId: orderId }],
          },
          {
            deliveryPartnerId: deliveryId.toString(), // Try as string
          },
        ],
      });
    }

    if (!order) {
      console.error(
        `❌ Order ${orderId} not found or not assigned to delivery ${deliveryId}`,
      );
      return errorResponse(res, 404, "Order not found or not assigned to you");
    }
    // Initialize deliveryState if it doesn't exist
    if (!order.deliveryState) {
      order.deliveryState = {
        status: "pending",
        currentPhase: "assigned",
      };
    }

    // Ensure deliveryState.currentPhase exists
    if (!order.deliveryState.currentPhase) {
      order.deliveryState.currentPhase = "assigned";
    }

    // Check if order is in valid state
    // Allow reached drop if order is out_for_delivery OR if currentPhase is en_route_to_delivery OR status is order_confirmed
    const isValidState =
      order.status === "out_for_delivery" ||
      order.deliveryState?.currentPhase === "en_route_to_delivery" ||
      order.deliveryState?.status === "order_confirmed" ||
      order.deliveryState?.currentPhase === "at_delivery"; // Allow if already at delivery (idempotent)

    if (!isValidState) {
      return errorResponse(
        res,
        400,
        `Order is not in valid state for reached drop. Current status: ${order.status}, Phase: ${order.deliveryState?.currentPhase || "unknown"}`,
      );
    }

    // Update order state - only if not already at delivery (idempotent)
    let finalOrder = null;

    if (order.deliveryState.currentPhase !== "at_delivery") {
      try {
        // Update the order document directly since we have it
        order.deliveryState.status = "en_route_to_delivery";
        order.deliveryState.currentPhase = "at_delivery";
        order.deliveryState.reachedDropAt = new Date();

        // Save the order
        await order.save();

        // Populate and get the updated order for response
        const updatedOrder = await Order.findById(order._id)
          .populate("restaurantId", "name location address phone ownerPhone")
          .populate("userId", "name phone")
          .lean(); // Use lean() for better performance

        if (!updatedOrder) {
          console.error(`❌ Failed to fetch updated order ${order._id}`);
          return errorResponse(res, 500, "Failed to update order state");
        }

        finalOrder = updatedOrder;
      } catch (updateError) {
        console.error(`❌ Error updating order ${order._id}:`, updateError);
        console.error("Update error stack:", updateError.stack);
        console.error("Update error details:", {
          message: updateError.message,
          name: updateError.name,
          orderId: order._id,
          orderStatus: order.status,
          deliveryPhase: order.deliveryState?.currentPhase,
        });
        throw updateError; // Re-throw to be caught by outer catch
      }
    } else {
      // If already at delivery, populate the order for response
      try {
        const populatedOrder = await Order.findById(order._id)
          .populate("restaurantId", "name location address phone ownerPhone")
          .populate("userId", "name phone")
          .lean(); // Use lean() for better performance

        if (!populatedOrder) {
          console.error(`❌ Failed to fetch order ${order._id} details`);
          return errorResponse(res, 500, "Failed to fetch order details");
        }

        finalOrder = populatedOrder;
      } catch (fetchError) {
        console.error(`❌ Error fetching order ${order._id}:`, fetchError);
        console.error("Fetch error stack:", fetchError.stack);
        throw fetchError; // Re-throw to be caught by outer catch
      }
    }

    if (!finalOrder) {
      return errorResponse(res, 500, "Failed to process order");
    }

    const orderIdForLog =
      finalOrder.orderId || finalOrder._id?.toString() || orderId;
    return successResponse(res, 200, "Reached drop confirmed", {
      order: finalOrder,
      message: "Reached drop location confirmed",
    });
  } catch (error) {
    logger.error(`Error confirming reached drop: ${error.message}`);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      orderId: req.params?.orderId,
      deliveryId: req.delivery?._id,
    });
    return errorResponse(
      res,
      500,
      `Failed to confirm reached drop: ${error.message}`,
    );
  }
});

/**
 * Confirm Delivery Complete
 * PATCH /api/delivery/orders/:orderId/complete-delivery
 */
export const completeDelivery = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { orderId } = req.params;
    const { rating, review } = req.body; // Optional rating and review from delivery boy

    if (!delivery || !delivery._id) {
      return errorResponse(
        res,
        401,
        "Delivery partner authentication required",
      );
    }

    if (!orderId) {
      return errorResponse(res, 400, "Order ID is required");
    }

    // Find order - try both by _id and orderId, and ensure it's assigned to this delivery partner
    const deliveryId = delivery._id;
    let order = null;

    // Check if orderId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findOne({
        _id: orderId,
        deliveryPartnerId: deliveryId,
      })
        .populate("restaurantId", "name location address phone ownerPhone")
        .populate("userId", "name phone")
        .lean();
    } else {
      // If not a valid ObjectId, search by orderId field
      order = await Order.findOne({
        orderId: orderId,
        deliveryPartnerId: deliveryId,
      })
        .populate("restaurantId", "name location address phone ownerPhone")
        .populate("userId", "name phone")
        .lean();
    }

    // If still not found, try with string comparison for deliveryPartnerId
    if (!order) {
      order = await Order.findOne({
        $and: [
          {
            $or: [{ _id: orderId }, { orderId: orderId }],
          },
          {
            deliveryPartnerId: deliveryId.toString(),
          },
        ],
      })
        .populate("restaurantId", "name location address phone ownerPhone")
        .populate("userId", "name phone")
        .lean();
    }

    if (!order) {
      return errorResponse(res, 404, "Order not found or not assigned to you");
    }

    // Check if order is already delivered/completed (idempotent - allow if already completed)
    const isAlreadyDelivered =
      order.status === "delivered" ||
      order.deliveryState?.currentPhase === "completed" ||
      order.deliveryState?.status === "delivered";

    if (isAlreadyDelivered) {
      const orderIdForLog = order.orderId || order._id?.toString() || orderId;
      const orderMongoIdForAlready = order._id;

      let earnings = null;
      try {
        const wallet = await DeliveryWallet.findOrCreateByDeliveryId(
          delivery._id,
        );
        const orderIdStr = orderMongoIdForAlready
          ? orderMongoIdForAlready.toString()
          : String(order._id || "");
        const existingTransaction = (wallet.transactions || []).find(
          (t) =>
            t.orderId &&
            String(t.orderId.toString()) === orderIdStr &&
            t.type === "payment",
        );

        if (existingTransaction && existingTransaction.amount > 0) {
          earnings = {
            amount: existingTransaction.amount,
            transactionId:
              existingTransaction._id?.toString() || existingTransaction.id,
          };
        } else {
          // Remove stale ₹0 transaction if present
          if (existingTransaction && existingTransaction.amount <= 0) {
            wallet.transactions = wallet.transactions.filter(
              (t) =>
                !(
                  t.orderId &&
                  String(t.orderId.toString()) === orderIdStr &&
                  t.type === "payment" &&
                  t.amount <= 0
                ),
            );
            await wallet.save();
          }
          // Earning was never added to wallet — add it now so Pocket and Earnings update
          let deliveryDistance = 0;
          if (order.deliveryState?.routeToDelivery?.distance) {
            deliveryDistance = order.deliveryState.routeToDelivery.distance;
          } else if (order.assignmentInfo?.distance) {
            deliveryDistance = order.assignmentInfo.distance;
          } else if (
            order.restaurantId?.location?.coordinates &&
            order.address?.location?.coordinates
          ) {
            const [restaurantLng, restaurantLat] =
              order.restaurantId.location.coordinates;
            const [customerLng, customerLat] =
              order.address.location.coordinates;
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
          // Final fallback: restaurantId might be a string (populate failed)
          if (
            (!deliveryDistance || deliveryDistance <= 0) &&
            order.address?.location?.coordinates
          ) {
            const restaurantIdVal =
              order.restaurantId?._id || order.restaurantId;
            let restaurantDoc = null;
            if (restaurantIdVal) {
              if (mongoose.Types.ObjectId.isValid(restaurantIdVal)) {
                restaurantDoc = await Restaurant.findById(restaurantIdVal)
                  .select("location")
                  .lean();
              } else {
                restaurantDoc = await Restaurant.findOne({
                  restaurantId: restaurantIdVal,
                })
                  .select("location")
                  .lean();
              }
            }
            if (restaurantDoc?.location?.coordinates) {
              const [restaurantLng, restaurantLat] =
                restaurantDoc.location.coordinates;
              const [customerLng, customerLat] =
                order.address.location.coordinates;
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

          let totalEarning = 0;
          let commissionBreakdown = null;
          try {
            const commissionResult =
              await DeliveryBoyCommission.calculateCommission(deliveryDistance);
            totalEarning = commissionResult.commission;
            commissionBreakdown = commissionResult.breakdown;
          } catch (commissionError) {
            totalEarning = order.pricing?.deliveryFee || 10;
            commissionBreakdown = {
              basePayout: totalEarning,
              distance: deliveryDistance,
              commissionPerKm: 0,
              distanceCommission: 0,
            };
            console.warn(
              `⚠️ Commission rules not configured or failed (${commissionError.message}). Using fallback earning: ₹${totalEarning}`,
            );
          }

          const deliveryFeeAmount = Number(order.pricing?.deliveryFee) || 0;
          if (deliveryFeeAmount > 0) {
            totalEarning = deliveryFeeAmount;
            commissionBreakdown = {
              basePayout: deliveryFeeAmount,
              distance: deliveryDistance,
              commissionPerKm: 0,
              distanceCommission: 0,
              source: "delivery_fee",
            };
          }

          const walletTransaction = wallet.addTransaction({
            amount: totalEarning,
            type: "payment",
            status: "Completed",
            description: `Delivery earnings for Order #${orderIdForLog} (Distance: ${deliveryDistance.toFixed(2)} km)`,
            orderId: orderMongoIdForAlready || order._id,
            paymentCollected: false,
          });
          await wallet.save();
          earnings = {
            amount: totalEarning,
            transactionId:
              walletTransaction._id?.toString() || walletTransaction.id,
            breakdown: commissionBreakdown,
          };
        }
      } catch (earningsError) {
        console.error(
          "⚠️ Error calculating/backfilling earnings for already delivered order:",
          earningsError.message,
        );
      }

      return successResponse(res, 200, "Order already delivered", {
        order: order,
        earnings: earnings,
        message: "Order was already marked as delivered",
      });
    }

    // Check if order is in valid state for completion
    // Allow completion if order is out_for_delivery OR at_delivery phase
    const isValidState =
      order.status === "out_for_delivery" ||
      order.deliveryState?.currentPhase === "at_delivery" ||
      order.deliveryState?.currentPhase === "en_route_to_delivery";

    if (!isValidState) {
      return errorResponse(
        res,
        400,
        `Order cannot be completed. Current status: ${order.status}, Phase: ${order.deliveryState?.currentPhase || "unknown"}`,
      );
    }

    // Ensure we have order._id - from .lean() it's a plain object with _id
    const orderMongoId = order._id;
    if (!orderMongoId) {
      return errorResponse(res, 500, "Order ID not found in order object");
    }

    // Prepare update object
    const updateData = {
      status: "delivered",
      "tracking.delivered": {
        status: true,
        timestamp: new Date(),
      },
      deliveredAt: new Date(),
      "deliveryState.status": "delivered",
      "deliveryState.currentPhase": "completed",
    };

    // Also update embedded payment status for COD orders
    if (order.payment?.method === "cash" || order.payment?.method === "cod") {
      updateData["payment.status"] = "completed";
    }

    // Delivery partners should not overwrite user-submitted ratings/comments.
    // Any rating UI for delivery can be handled via a separate feedback flow.

    // Update order to delivered
    const updatedOrder = await Order.findByIdAndUpdate(
      orderMongoId,
      {
        $set: updateData,
      },
      { new: true, runValidators: true },
    )
      .populate("restaurantId", "name location address phone ownerPhone")
      .populate("userId", "name phone")
      .lean();

    if (!updatedOrder) {
      return errorResponse(res, 500, "Failed to update order status");
    }

    const orderIdForLog =
      updatedOrder.orderId ||
      order.orderId ||
      orderMongoId?.toString() ||
      orderId;
    // Mark COD payment as collected (admin Payment Status → Collected)
    if (order.payment?.method === "cash" || order.payment?.method === "cod") {
      try {
        await Payment.updateOne(
          { orderId: orderMongoId },
          { $set: { status: "completed", completedAt: new Date() } },
        );
      } catch (paymentUpdateError) {
        console.warn(
          "⚠️ Could not update COD payment status:",
          paymentUpdateError.message,
        );
      }
    }

    // Release escrow and distribute funds (this handles all wallet credits)
    try {
      const { releaseEscrow } =
        await import("../../order/services/escrowWalletService.js");
      await releaseEscrow(orderMongoId);
    } catch (escrowError) {
      console.error(
        `❌ Error releasing escrow for order ${orderIdForLog}:`,
        escrowError,
      );
      // Continue with legacy wallet update as fallback
    }

    // Calculate delivery earnings based on admin's commission rules
    // Get delivery distance (in km) from order
    let deliveryDistance = 0;

    // Priority 1: Get distance from routeToDelivery (most accurate)
    if (order.deliveryState?.routeToDelivery?.distance) {
      deliveryDistance = order.deliveryState.routeToDelivery.distance;
    }
    // Priority 2: Get distance from assignmentInfo
    else if (order.assignmentInfo?.distance) {
      deliveryDistance = order.assignmentInfo.distance;
    }
    // Priority 3: Calculate distance from restaurant to customer if coordinates available
    else if (
      order.restaurantId?.location?.coordinates &&
      order.address?.location?.coordinates
    ) {
      const [restaurantLng, restaurantLat] =
        order.restaurantId.location.coordinates;
      const [customerLng, customerLat] = order.address.location.coordinates;

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
    }
    // Final fallback: restaurantId might be a string (populate failed)
    if (
      (!deliveryDistance || deliveryDistance <= 0) &&
      order.address?.location?.coordinates
    ) {
      const restaurantIdVal = order.restaurantId?._id || order.restaurantId;
      let restaurantDoc = null;
      if (restaurantIdVal) {
        if (mongoose.Types.ObjectId.isValid(restaurantIdVal)) {
          restaurantDoc = await Restaurant.findById(restaurantIdVal)
            .select("location")
            .lean();
        } else {
          restaurantDoc = await Restaurant.findOne({
            restaurantId: restaurantIdVal,
          })
            .select("location")
            .lean();
        }
      }
      if (restaurantDoc?.location?.coordinates) {
        const [restaurantLng, restaurantLat] =
          restaurantDoc.location.coordinates;
        const [customerLng, customerLat] = order.address.location.coordinates;
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
    // Calculate earnings using admin's commission rules
    let totalEarning = 0;
    let commissionBreakdown = null;

    try {
      // Use DeliveryBoyCommission model to calculate commission based on distance
      const commissionResult =
        await DeliveryBoyCommission.calculateCommission(deliveryDistance);
      totalEarning = commissionResult.commission;
      commissionBreakdown = commissionResult.breakdown;
    } catch (commissionError) {
      console.error(
        "⚠️ Error calculating commission using rules:",
        commissionError.message,
      );
      // Fallback: Use delivery fee as earnings if commission calculation fails; minimum ₹10
      totalEarning = order.pricing?.deliveryFee || 10;
      commissionBreakdown = {
        basePayout: totalEarning,
        distance: deliveryDistance,
        commissionPerKm: 0,
        distanceCommission: 0,
      };
      console.warn(
        `⚠️ Using fallback earnings (delivery fee): ₹${totalEarning.toFixed(2)}`,
      );
    }

    const deliveryFeeAmount = Number(order.pricing?.deliveryFee) || 0;
    if (deliveryFeeAmount > 0) {
      totalEarning = deliveryFeeAmount;
      commissionBreakdown = {
        basePayout: deliveryFeeAmount,
        distance: deliveryDistance,
        commissionPerKm: 0,
        distanceCommission: 0,
        source: "delivery_fee",
      };
    }

    // Automatically update delivery boy's wallet: add delivery earning and save transaction for earnings history
    let walletTransaction = null;
    try {
      let wallet = await DeliveryWallet.findOrCreateByDeliveryId(delivery._id);

      // Check if transaction already exists for this order (idempotent)
      const orderIdStr =
        (orderMongoId && orderMongoId.toString()) ||
        (order && order._id && order._id.toString()) ||
        "";
      const existingTransaction = (wallet.transactions || []).find(
        (t) =>
          t.orderId &&
          String(t.orderId.toString()) === orderIdStr &&
          t.type === "payment",
      );

      // Remove stale ₹0 transaction if present
      if (
        orderIdStr &&
        existingTransaction &&
        existingTransaction.amount <= 0
      ) {
        wallet.transactions = wallet.transactions.filter(
          (t) =>
            !(
              t.orderId &&
              String(t.orderId.toString()) === orderIdStr &&
              t.type === "payment" &&
              t.amount <= 0
            ),
        );
        await wallet.save();
      }

      if (orderIdStr && existingTransaction && existingTransaction.amount > 0) {
        console.warn(
          `⚠️ Earning already added for order ${orderIdForLog}, skipping wallet update`,
        );
      } else {
        // Add payment transaction (earning) with paymentCollected: false so cashInHand gets COD amount, not commission
        const isCOD =
          order.payment?.method === "cash" || order.payment?.method === "cod";
        walletTransaction = wallet.addTransaction({
          amount: totalEarning,
          type: "payment",
          status: "Completed",
          description: `Delivery earnings for Order #${orderIdForLog} (Distance: ${deliveryDistance.toFixed(2)} km)`,
          orderId: orderMongoId || order._id,
          paymentCollected: false,
        });

        await wallet.save();

        // COD: add cash collected (order total) to cashInHand so Pocket balance shows it
        const codAmount = Number(order.pricing?.total) || 0;
        const paymentMethod = (order.payment?.method || "")
          .toString()
          .toLowerCase();
        const isCashOrder = paymentMethod === "cash" || paymentMethod === "cod";
        if (isCashOrder && codAmount > 0) {
          try {
            const updateResult = await DeliveryWallet.updateOne(
              { deliveryId: delivery._id },
              { $inc: { cashInHand: codAmount } },
            );
            if (updateResult.modifiedCount > 0) {
            } else {
              console.warn(
                `⚠️ Wallet update for cashInHand had no effect (deliveryId: ${delivery._id})`,
              );
            }
          } catch (codErr) {
            console.error(
              `❌ Failed to add COD to cashInHand:`,
              codErr.message,
            );
          }
        }

        const cashCollectedThisOrder = isCOD ? codAmount : 0;
        logger.info(
          `💰 Earning added to wallet for delivery: ${delivery._id}`,
          {
            deliveryId: delivery.deliveryId || delivery._id.toString(),
            orderId: orderIdForLog,
            amount: totalEarning,
            cashCollected: cashCollectedThisOrder,
            distance: deliveryDistance,
            transactionId: walletTransaction?._id || walletTransaction?.id,
            walletBalance: wallet.totalBalance,
            cashInHand: wallet.cashInHand,
          },
        );
      }
    } catch (walletError) {
      logger.error("❌ Error adding earning to wallet:", walletError);
      console.error("❌ Error processing delivery wallet:", walletError);
      // Don't fail the delivery completion if wallet update fails
      // But log it for investigation
    }

    // Check and award earning addon bonuses if delivery boy qualifies
    let earningAddonBonus = null;
    try {
      const { checkAndAwardEarningAddon } =
        await import("../services/earningAddonService.js");
      earningAddonBonus = await checkAndAwardEarningAddon(
        delivery._id,
        orderMongoId || order._id,
        updatedOrder.deliveredAt || new Date(),
      );

      if (earningAddonBonus) {
        logger.info(`Earning addon bonus awarded to delivery ${delivery._id}`, {
          offerId: earningAddonBonus.offerId,
          amount: earningAddonBonus.amount,
          ordersCompleted: earningAddonBonus.ordersCompleted,
        });
      }
    } catch (earningAddonError) {
      logger.error(
        "❌ Error checking earning addon bonuses:",
        earningAddonError,
      );
      console.error(
        "❌ Error processing earning addon bonus:",
        earningAddonError,
      );
      // Don't fail the delivery completion if bonus check fails
    }

    // Calculate restaurant commission and update restaurant wallet
    let restaurantWalletTransaction = null;
    let adminCommissionRecord = null;
    try {
      // Get food price for commission calculation:
      // use subtotal (food amount) minus discount, and do NOT include delivery fee, tax or platform fee
      const subtotal = order.pricing?.subtotal || order.pricing?.total || 0;
      const discount = order.pricing?.discount || 0;
      const foodPrice = Math.max(0, subtotal - discount);

      // Find restaurant by restaurantId (can be string or ObjectId)
      let restaurant = null;
      if (mongoose.Types.ObjectId.isValid(order.restaurantId)) {
        restaurant = await Restaurant.findById(order.restaurantId);
      } else {
        restaurant = await Restaurant.findOne({
          restaurantId: order.restaurantId,
        });
      }

      if (!restaurant) {
        console.warn(
          `⚠️ Restaurant not found for order ${orderIdForLog}, skipping commission calculation`,
        );
      } else {
        // Calculate restaurant commission
        const commissionResult =
          await RestaurantCommission.calculateCommissionForOrder(
            restaurant._id,
            foodPrice,
          );

        const commissionAmount = commissionResult.commission || 0;
        const restaurantEarning = foodPrice - commissionAmount;
        // Update restaurant wallet
        if (restaurant._id) {
          const restaurantWallet =
            await RestaurantWallet.findOrCreateByRestaurantId(restaurant._id);

          // Build a safe orderIdForTransaction for restaurant wallet
          const restaurantOrderIdForTransaction =
            (orderMongoId && orderMongoId.toString()) ||
            (order && order._id && order._id.toString()) ||
            null;

          // Check if transaction already exists for this order (only if we have an ID)
          const existingRestaurantTransaction =
            restaurantOrderIdForTransaction &&
            restaurantWallet.transactions?.find(
              (t) =>
                t.orderId &&
                t.orderId.toString() === restaurantOrderIdForTransaction &&
                t.type === "payment",
            );

          if (existingRestaurantTransaction) {
            console.warn(
              `⚠️ Restaurant earning already added for order ${orderIdForLog}, skipping wallet update`,
            );
          } else {
            // Add payment transaction to restaurant wallet
            restaurantWalletTransaction = restaurantWallet.addTransaction({
              amount: restaurantEarning,
              type: "payment",
              status: "Completed",
              description: `Order #${orderIdForLog} - Food: ₹${foodPrice.toFixed(2)}, Commission: ₹${commissionAmount.toFixed(2)}`,
              orderId: orderMongoId || order._id,
            });

            await restaurantWallet.save();

            logger.info(
              `💰 Earning added to restaurant wallet: ${restaurant._id}`,
              {
                restaurantId:
                  restaurant.restaurantId || restaurant._id.toString(),
                orderId: orderIdForLog,
                orderTotal: orderTotal,
                commissionAmount: commissionAmount,
                restaurantEarning: restaurantEarning,
                walletBalance: restaurantWallet.totalBalance,
              },
            );
          }
        }

        // Track admin commission earned
        try {
          // Check if commission record already exists
          const existingCommission = await AdminCommission.findOne({
            orderId: orderMongoId || order._id,
          });

          if (!existingCommission) {
            adminCommissionRecord = await AdminCommission.create({
              orderId: orderMongoId || order._id,
              orderAmount: orderTotal,
              commissionAmount: commissionAmount,
              commissionPercentage: commissionResult.value,
              restaurantId: restaurant._id,
              restaurantName: restaurant.name || order.restaurantName,
              restaurantEarning: restaurantEarning,
              status: "completed",
              orderDate: order.createdAt || new Date(),
            });

            logger.info(`💰 Admin commission recorded: ${commissionAmount}`, {
              orderId: orderIdForLog,
              commissionAmount: commissionAmount,
              orderTotal: orderTotal,
            });
          } else {
            console.warn(
              `⚠️ Admin commission already recorded for order ${orderIdForLog}`,
            );
          }
        } catch (adminCommissionError) {
          logger.error(
            "❌ Error recording admin commission:",
            adminCommissionError,
          );
          console.error(
            "❌ Error recording admin commission:",
            adminCommissionError,
          );
          // Don't fail the delivery completion if commission tracking fails
        }
      }
    } catch (restaurantWalletError) {
      logger.error(
        "❌ Error processing restaurant wallet:",
        restaurantWalletError,
      );
      console.error(
        "❌ Error processing restaurant wallet:",
        restaurantWalletError,
      );
      // Don't fail the delivery completion if restaurant wallet update fails
      // But log it for investigation
    }

    // Clean up Firebase active order entry
    try {
      const fbOrderId = updatedOrder.orderId || order.orderId || orderId;
      await removeActiveOrder(fbOrderId);
    } catch (fbErr) {
      console.warn("Firebase removeActiveOrder failed:", fbErr.message);
    }

    // Send response first, then handle notifications asynchronously
    // This prevents timeouts if notifications take too long
    const responseData = {
      order: updatedOrder,
      earnings: {
        amount: totalEarning,
        currency: "INR",
        distance: deliveryDistance,
        breakdown: commissionBreakdown || {
          basePayout: 0,
          distance: deliveryDistance,
          commissionPerKm: 0,
          distanceCommission: 0,
        },
      },
      wallet: walletTransaction
        ? {
            transactionId: walletTransaction._id,
            balance: walletTransaction.amount,
          }
        : null,
      earningAddonBonus: earningAddonBonus
        ? {
            offerId: earningAddonBonus.offerId,
            offerTitle: earningAddonBonus.offerTitle,
            amount: earningAddonBonus.amount,
            ordersCompleted: earningAddonBonus.ordersCompleted,
            ordersRequired: earningAddonBonus.ordersRequired,
          }
        : null,
      message: "Delivery completed successfully",
    };

    // Send response immediately
    const response = successResponse(
      res,
      200,
      "Delivery completed successfully",
      responseData,
    );

    // Handle notifications asynchronously (don't block response)
    const orderIdForNotification = orderMongoId?.toString
      ? orderMongoId.toString()
      : orderMongoId;
    Promise.all([
      // Notify restaurant about delivery completion
      (async () => {
        try {
          const { notifyRestaurantOrderUpdate } =
            await import("../../order/services/restaurantNotificationService.js");
          await notifyRestaurantOrderUpdate(
            orderIdForNotification,
            "delivered",
          );
        } catch (notifError) {
          console.error("Error sending restaurant notification:", notifError);
        }
      })(),
      // Notify user about delivery completion
      (async () => {
        try {
          const { notifyUserOrderUpdate } =
            await import("../../order/services/userNotificationService.js");
          if (notifyUserOrderUpdate) {
            await notifyUserOrderUpdate(orderIdForNotification, "delivered");
          }
        } catch (notifError) {
          console.error("Error sending user notification:", notifError);
        }
      })(),
    ]).catch((error) => {
      console.error("Error in notification promises:", error);
    });

    return response;
  } catch (error) {
    logger.error(`Error completing delivery: ${error.message}`);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      orderId: req.params?.orderId,
      deliveryId: req.delivery?._id,
    });
    return errorResponse(
      res,
      500,
      `Failed to complete delivery: ${error.message}`,
    );
  }
});

/**
 * Get Active Order for Delivery Partner
 * GET /api/delivery/active-order
 * Returns the current active order (not delivered/cancelled) with full details
 */
export const getActiveOrder = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;

    // Find active order (not delivered, not cancelled, assigned to this delivery partner)
    const order = await Order.findOne({
      deliveryPartnerId: delivery._id,
      status: { $nin: ["delivered", "cancelled"] },
      "deliveryState.currentPhase": { $ne: "completed" },
    })
      .populate(
        "restaurantId",
        "name slug profileImage address phone ownerPhone location",
      )
      .populate("userId", "name phone email")
      .sort({ createdAt: -1 }) // Get most recent active order
      .lean();

    if (!order) {
      return successResponse(res, 200, "No active order found", {
        order: null,
        hasActiveOrder: false,
      });
    }

    // Resolve payment method
    let paymentMethod = order.payment?.method || "razorpay";
    if (paymentMethod !== "cash") {
      try {
        const paymentRecord = await Payment.findOne({ orderId: order._id })
          .select("method")
          .lean();
        if (paymentRecord?.method === "cash") paymentMethod = "cash";
      } catch (e) {
        /* ignore */
      }
    }
    const orderWithPayment = { ...order, paymentMethod };

    // Determine current state/phase from backend
    const deliveryState = order.deliveryState || {};
    const currentPhase = deliveryState.currentPhase || "";
    const stateStatus = deliveryState.status || "";
    const orderStatus = order.status || "";

    // Map backend state to frontend state
    let state = "ASSIGNED"; // Default
    if (currentPhase === "en_route_to_pickup" || orderStatus === "preparing") {
      state = "ASSIGNED";
    } else if (currentPhase === "at_pickup" || orderStatus === "ready") {
      state = "ARRIVED_AT_RESTAURANT";
    } else if (
      stateStatus === "order_confirmed" ||
      currentPhase === "picked_up" ||
      orderStatus === "out_for_delivery"
    ) {
      state = "PICKED_UP";
    } else if (
      currentPhase === "en_route_to_drop" ||
      currentPhase === "en_route_to_delivery"
    ) {
      state = "PICKED_UP";
    } else if (currentPhase === "at_drop" || stateStatus === "reached_drop") {
      state = "ARRIVED_AT_LOCATION";
    } else if (orderStatus === "delivered" || currentPhase === "completed") {
      state = "DELIVERED";
    }

    return successResponse(res, 200, "Active order retrieved successfully", {
      order: orderWithPayment,
      hasActiveOrder: true,
      state, // Backend-determined state
      currentPhase,
      stateStatus,
      orderStatus,
    });
  } catch (error) {
    logger.error(`Error fetching active order: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch active order");
  }
});
