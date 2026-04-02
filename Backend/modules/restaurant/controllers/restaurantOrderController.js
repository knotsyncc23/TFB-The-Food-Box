import Order from '../../order/models/Order.js';
import Payment from '../../payment/models/Payment.js';
import Restaurant from '../models/Restaurant.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import { notifyRestaurantOrderUpdate } from '../../order/services/restaurantNotificationService.js';
import { assignOrderToDeliveryBoy, findNearestDeliveryBoys, findNearestDeliveryBoy } from '../../order/services/deliveryAssignmentService.js';
import { notifyDeliveryBoyNewOrder, notifyMultipleDeliveryBoys, broadcastNewOrderToAllDeliveryBoys } from '../../order/services/deliveryNotificationService.js';
import mongoose from 'mongoose';
import { removeActiveOrder } from '../../../services/firebaseRealtimeService.js';

/**
 * Get all orders for restaurant
 * GET /api/restaurant/orders
 */
export const getRestaurantOrders = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const { status, page = 1, limit = 50 } = req.query;

    // Get restaurant ID - normalize to string (Order.restaurantId is String type)
    const restaurantIdString = restaurant._id?.toString() ||
      restaurant.restaurantId?.toString() ||
      restaurant.id?.toString();

    if (!restaurantIdString) {
      console.error('❌ No restaurant ID found:', restaurant);
      return errorResponse(res, 500, 'Restaurant ID not found');
    }

    // Query orders by restaurantId (stored as String in Order model)
    // Try multiple restaurantId formats to handle different storage formats
    const restaurantIdVariations = [restaurantIdString];
    
    // Also add ObjectId string format if valid (both directions)
    if (mongoose.Types.ObjectId.isValid(restaurantIdString)) {
      const objectIdString = new mongoose.Types.ObjectId(restaurantIdString).toString();
      if (!restaurantIdVariations.includes(objectIdString)) {
        restaurantIdVariations.push(objectIdString);
      }
      
      // Also try the original ObjectId if restaurantIdString is already a string
      try {
        const objectId = new mongoose.Types.ObjectId(restaurantIdString);
        const objectIdStr = objectId.toString();
        if (!restaurantIdVariations.includes(objectIdStr)) {
          restaurantIdVariations.push(objectIdStr);
        }
      } catch (e) {
        // Ignore if not a valid ObjectId
      }
    }
    
    // Also try direct match without ObjectId conversion
    restaurantIdVariations.push(restaurantIdString);

    // Build query - search for orders with any matching restaurantId variation
    // Use $in for multiple variations and also try direct match as fallback
    const query = {
      $or: [
        { restaurantId: { $in: restaurantIdVariations } },
        // Direct match fallback
        { restaurantId: restaurantIdString }
      ]
    };

    // If status filter is provided, add it to query
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(query)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Order.countDocuments(query);

    // Resolve paymentMethod: order.payment.method or Payment collection (COD fallback)
    const orderIds = orders.map(o => o._id);
    const codOrderIds = new Set();
    try {
      const codPayments = await Payment.find({ orderId: { $in: orderIds }, method: 'cash' }).select('orderId').lean();
      codPayments.forEach(p => codOrderIds.add(p.orderId?.toString()));
    } catch (e) { /* ignore */ }
    const ordersWithPaymentMethod = orders.map(o => {
      let paymentMethod = o.payment?.method ?? 'razorpay';
      if (paymentMethod !== 'cash' && codOrderIds.has(o._id?.toString())) paymentMethod = 'cash';
      return { ...o, paymentMethod };
    });

    // Log detailed order info for debugging
    // If no orders found, log a warning with more details
    if (orders.length === 0 && total === 0) {
      console.warn('⚠️ No orders found for restaurant:', {
        restaurantId: restaurantIdString,
        restaurant_id: restaurant._id?.toString(),
        variationsTried: restaurantIdVariations,
        query: JSON.stringify(query)
      });
      
      // Try to find ANY orders in database for debugging
      const allOrdersCount = await Order.countDocuments({});
      // Check if orders exist with similar restaurantId
      const sampleOrders = await Order.find({}).limit(5).select('orderId restaurantId status').lean();
      if (sampleOrders.length > 0) {
      }
    }

    return successResponse(res, 200, 'Orders retrieved successfully', {
      orders: ordersWithPaymentMethod,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching restaurant orders:', error);
    return errorResponse(res, 500, 'Failed to fetch orders');
  }
});

/**
 * Get order by ID
 * GET /api/restaurant/orders/:id
 */
export const getRestaurantOrderById = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const { id } = req.params;

    const restaurantId = restaurant._id?.toString() ||
      restaurant.restaurantId ||
      restaurant.id;

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        restaurantId
      })
        .populate('userId', 'name email phone')
        .lean();
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        restaurantId
      })
        .populate('userId', 'name email phone')
        .lean();
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    return successResponse(res, 200, 'Order retrieved successfully', {
      order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return errorResponse(res, 500, 'Failed to fetch order');
  }
});

/**
 * Accept order
 * PATCH /api/restaurant/orders/:id/accept
 */
export const acceptOrder = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const { id } = req.params;
    const { preparationTime } = req.body;

    const restaurantId = restaurant._id?.toString() ||
      restaurant.restaurantId ||
      restaurant.id;

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        restaurantId
      });
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        restaurantId
      });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Allow accepting orders with status 'pending' or 'confirmed'
    // 'confirmed' status means payment is verified, restaurant can still accept
    if (!['pending', 'confirmed'].includes(order.status)) {
      return errorResponse(res, 400, `Order cannot be accepted. Current status: ${order.status}`);
    }

    // When restaurant accepts order, it means they're starting to prepare it
    // So set status to 'preparing' and mark as confirmed if it was pending
    if (order.status === 'pending') {
      order.tracking.confirmed = { status: true, timestamp: new Date() };
    }

    // Set status to 'preparing' when restaurant accepts
    order.status = 'preparing';
    order.tracking.preparing = { status: true, timestamp: new Date() };

    // Handle preparation time update from restaurant
    if (preparationTime) {
      const restaurantPrepTime = parseInt(preparationTime, 10);
      const initialPrepTime = order.preparationTime || 0;
      
      // Calculate additional time restaurant is adding
      const additionalTime = Math.max(0, restaurantPrepTime - initialPrepTime);
      
      // Update ETA with additional time (add to both min and max)
      if (order.eta) {
        const currentMin = order.eta.min || 0;
        const currentMax = order.eta.max || 0;
        
        order.eta.min = currentMin + additionalTime;
        order.eta.max = currentMax + additionalTime;
        order.eta.additionalTime = (order.eta.additionalTime || 0) + additionalTime;
        order.eta.lastUpdated = new Date();
        
        // Update estimated delivery time to average of new min and max
        order.estimatedDeliveryTime = Math.ceil((order.eta.min + order.eta.max) / 2);
      } else {
        // If ETA doesn't exist, create it
        order.eta = {
          min: (order.estimatedDeliveryTime || 30) + additionalTime,
          max: (order.estimatedDeliveryTime || 30) + additionalTime,
          additionalTime: additionalTime,
          lastUpdated: new Date()
        };
        order.estimatedDeliveryTime = Math.ceil((order.eta.min + order.eta.max) / 2);
      }
    }

    await order.save();

    // Trigger ETA recalculation for restaurant accepted event
    try {
      const etaEventService = (await import('../../order/services/etaEventService.js')).default;
      await etaEventService.handleRestaurantAccepted(order._id.toString(), new Date());
    } catch (etaError) {
      console.error('Error updating ETA after restaurant accept:', etaError);
      // Continue even if ETA update fails
    }

    // Notify about status update
    try {
      await notifyRestaurantOrderUpdate(order._id.toString(), 'preparing');
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }

    // Delivery boys receive the order only when restaurant marks it as "Ready" (PATCH /ready), not on accept.
    return successResponse(res, 200, 'Order accepted successfully', {
      order
    });
  } catch (error) {
    console.error('Error accepting order:', error);
    return errorResponse(res, 500, 'Failed to accept order');
  }
});

/**
 * Reject order
 * PATCH /api/restaurant/orders/:id/reject
 */
export const rejectOrder = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const { id } = req.params;
    const { reason } = req.body;

    const restaurantId = restaurant._id?.toString() ||
      restaurant.restaurantId ||
      restaurant.id;

    // Log for debugging
    // Prepare restaurantId variations for query (handle both _id and restaurantId formats)
    const restaurantIdVariations = [restaurantId];
    if (mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24) {
      const objectIdString = new mongoose.Types.ObjectId(restaurantId).toString();
      if (!restaurantIdVariations.includes(objectIdString)) {
        restaurantIdVariations.push(objectIdString);
      }
    }
    // Also add restaurant._id if different
    if (restaurant._id) {
      const restaurantMongoId = restaurant._id.toString();
      if (!restaurantIdVariations.includes(restaurantMongoId)) {
        restaurantIdVariations.push(restaurantMongoId);
      }
    }
    // Also add restaurant.restaurantId if different
    if (restaurant.restaurantId && !restaurantIdVariations.includes(restaurant.restaurantId)) {
      restaurantIdVariations.push(restaurant.restaurantId);
    }

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        restaurantId: { $in: restaurantIdVariations }
      });
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        restaurantId: { $in: restaurantIdVariations }
      });
    }

    if (!order) {
      console.error('❌ Order not found for rejection:', {
        orderIdParam: id,
        restaurantId: restaurantId,
        restaurantIdVariations,
        restaurant_id: restaurant._id?.toString(),
        restaurant_restaurantId: restaurant.restaurantId
      });
      return errorResponse(res, 404, 'Order not found');
    }
    // If the order is already cancelled, treat this as a successful no-op.
    // This avoids showing a hard error when the UI is slightly stale or
    // another actor already cancelled the order.
    if (order.status === 'cancelled') {
      return successResponse(res, 200, 'Order already cancelled', {
        order,
      });
    }

    // Allow rejecting/cancelling orders with status 'pending', 'confirmed', or 'preparing'
    if (!['pending', 'confirmed', 'preparing'].includes(order.status)) {
      return errorResponse(res, 400, `Order cannot be cancelled. Current status: ${order.status}`);
    }

    order.status = 'cancelled';
    order.cancellationReason = reason || 'Cancelled by restaurant';
    order.cancelledBy = 'restaurant';
    order.cancelledAt = new Date();
    await order.save();

    // Clean up Firebase active order entry
    try {
      await removeActiveOrder(order.orderId);
    } catch (fbErr) {
      console.warn("Firebase removeActiveOrder on restaurant reject failed:", fbErr.message);
    }

    // Calculate refund amount but don't process automatically
    // Admin will process refund manually via refund button
    try {
      const { calculateCancellationRefund } = await import('../../order/services/cancellationRefundService.js');
      await calculateCancellationRefund(order._id, reason || 'Rejected by restaurant');
    } catch (refundError) {
      console.error(`❌ Error calculating cancellation refund for order ${order.orderId}:`, refundError);
      // Don't fail order cancellation if refund calculation fails
      // But log it for investigation
    }

    // Notify about status update
    try {
      await notifyRestaurantOrderUpdate(order._id.toString(), 'cancelled');
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }

    return successResponse(res, 200, 'Order rejected successfully', {
      order
    });
  } catch (error) {
    console.error('Error rejecting order:', error);
    return errorResponse(res, 500, 'Failed to reject order');
  }
});

/**
 * Update order status to preparing
 * PATCH /api/restaurant/orders/:id/preparing
 */
export const markOrderPreparing = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const { id } = req.params;

    const restaurantId = restaurant._id?.toString() ||
      restaurant.restaurantId ||
      restaurant.id;

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        restaurantId
      });
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        restaurantId
      });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Allow marking as preparing if status is 'confirmed', 'pending', or already 'preparing'.
    // From this point we ONLY update the status to 'preparing'.
    // Delivery partner assignment and rider notifications are now handled when
    // the order is marked as READY, so riders don't receive orders too early.
    const allowedStatuses = ['confirmed', 'pending', 'preparing'];
    if (!allowedStatuses.includes(order.status)) {
      return errorResponse(res, 400, `Order cannot be marked as preparing. Current status: ${order.status}`);
    }

    // Only update status if it's not already preparing
    const wasAlreadyPreparing = order.status === 'preparing';
    if (!wasAlreadyPreparing) {
      order.status = 'preparing';
      order.tracking.preparing = { status: true, timestamp: new Date() };
      await order.save();
    }

    // Notify about status update only if status actually changed
    if (!wasAlreadyPreparing) {
      try {
        await notifyRestaurantOrderUpdate(order._id.toString(), 'preparing');
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }
    }

    // From here we intentionally do NOT assign a delivery partner or send any
    // rider notifications. Assignment + notifications now happen when the
    // restaurant marks the order as READY.

    const latestOrder = await Order.findById(order._id);
    return successResponse(res, 200, 'Order marked as preparing', {
      order: latestOrder || order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return errorResponse(res, 500, 'Failed to update order status');
  }
});

/**
 * Update order status to ready
 * PATCH /api/restaurant/orders/:id/ready
 */
export const markOrderReady = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const { id } = req.params;

    const restaurantId = restaurant._id?.toString() ||
      restaurant.restaurantId ||
      restaurant.id;

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        restaurantId
      });
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        restaurantId
      });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    if (order.status !== 'preparing') {
      return errorResponse(res, 400, `Order cannot be marked as ready. Current status: ${order.status}`);
    }

    // Update order status and tracking
    const now = new Date();
    order.status = 'ready';
    if (!order.tracking) {
      order.tracking = {};
    }
    order.tracking.ready = {
      status: true,
      timestamp: now
    };
    await order.save();

    // Populate order for notifications and potential assignment
    let populatedOrder = await Order.findById(order._id)
      .populate('restaurantId', 'name location address phone')
      .populate('userId', 'name phone')
      .populate('deliveryPartnerId', 'name phone')
      .lean();

    try {
      await notifyRestaurantOrderUpdate(order._id.toString(), 'ready');
    } catch (notifError) {
      console.error('Error sending restaurant notification:', notifError);
    }

    // Only when restaurant marks "Ready for Pickup": emit order to all delivery boys (real-time available orders list)
    // Order.restaurantId is String, so populate does not fill it — fetch Restaurant for location and payload
    if (!populatedOrder.deliveryPartnerId) {
      try {
        const restId = order.restaurantId || restaurantId;
        let restaurantDoc = null;
        if (mongoose.Types.ObjectId.isValid(restId) && String(restId).length === 24) {
          restaurantDoc = await Restaurant.findById(restId).select('name address location phone ownerPhone').lean();
        }
        if (!restaurantDoc) {
          restaurantDoc = await Restaurant.findOne({ $or: [{ _id: restId }, { restaurantId: restId }] })
            .select('name address location phone ownerPhone').lean();
        }
        if (restaurantDoc) {
          populatedOrder.restaurantId = restaurantDoc;
        }

        const coords = populatedOrder.restaurantId?.location?.coordinates;
        const hasValidCoords = coords && coords.length >= 2 && !(coords[0] === 0 && coords[1] === 0);
        if (hasValidCoords) {
          const [restaurantLng, restaurantLat] = coords;
          const priorityDeliveryBoys = await findNearestDeliveryBoys(restaurantLat, restaurantLng, restId, 15);

          if (priorityDeliveryBoys && priorityDeliveryBoys.length > 0) {
            const priorityIds = priorityDeliveryBoys.map(db => db.deliveryPartnerId);
            await Order.findByIdAndUpdate(order._id, {
              $set: {
                assignmentInfo: {
                  priorityNotifiedAt: new Date(),
                  priorityDeliveryPartnerIds: priorityIds,
                  notificationPhase: 'priority',
                },
              },
            });
            await notifyMultipleDeliveryBoys(populatedOrder, priorityIds, 'priority');
          }
        } else {
          console.warn(`⚠️ Restaurant location missing or invalid for ${restId}; broadcasting to all delivery boys anyway`);
        }

        // Always broadcast to entire /delivery namespace so every connected delivery boy sees the order
        await broadcastNewOrderToAllDeliveryBoys(populatedOrder, 'priority');
      } catch (assignmentError) {
        console.error(`❌ Error in READY stage delivery notification:`, assignmentError);
      }
    }

    // If a delivery partner WAS already assigned but maybe not notified, notify them specifically too
    if (populatedOrder?.deliveryPartnerId) {
      try {
        const { notifyDeliveryBoyOrderReady } = await import('../../order/services/deliveryNotificationService.js');
        const deliveryPartnerId = populatedOrder.deliveryPartnerId._id || populatedOrder.deliveryPartnerId;

        // First, send full new_order so it appears in the rider's order list
        await notifyDeliveryBoyNewOrder(populatedOrder, deliveryPartnerId);
        // Then, send order_ready to update any UI badges/state
        await notifyDeliveryBoyOrderReady(populatedOrder, deliveryPartnerId);
      } catch (deliveryNotifError) {
        console.error('Error sending specific delivery boy notification at READY stage:', deliveryNotifError);
      }
    }

    return successResponse(res, 200, 'Order marked as ready', {
      order: populatedOrder || order,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return errorResponse(res, 500, 'Failed to update order status');
  }
});

/**
 * Resend delivery notification for unassigned order
 * POST /api/restaurant/orders/:id/resend-delivery-notification
 */
export const resendDeliveryNotification = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const { id } = req.params;

    const restaurantId = restaurant._id?.toString() ||
      restaurant.restaurantId ||
      restaurant.id;

    // Try to find order by MongoDB _id or orderId
    let order = null;

    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        restaurantId
      });
    }

    if (!order) {
      order = await Order.findOne({
        orderId: id,
        restaurantId
      });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Check if order is in valid status (preparing or ready)
    if (!['preparing', 'ready'].includes(order.status)) {
      return errorResponse(res, 400, `Cannot resend notification. Order status must be 'preparing' or 'ready'. Current status: ${order.status}`);
    }

    // Get restaurant location
    const restaurantDoc = await Restaurant.findById(restaurantId)
      .select('location')
      .lean();

    if (!restaurantDoc || !restaurantDoc.location || !restaurantDoc.location.coordinates) {
      return errorResponse(res, 400, 'Restaurant location not found. Please update restaurant location.');
    }

    const [restaurantLng, restaurantLat] = restaurantDoc.location.coordinates;

    // Find nearest delivery boys
    const priorityDeliveryBoys = await findNearestDeliveryBoys(
      restaurantLat,
      restaurantLng,
      restaurantId,
      20, // 20km radius for priority
      10  // Top 10 nearest
    );

    if (!priorityDeliveryBoys || priorityDeliveryBoys.length === 0) {
      // Try with larger radius
      const allDeliveryBoys = await findNearestDeliveryBoys(
        restaurantLat,
        restaurantLng,
        restaurantId,
        50, // 50km radius
        20  // Top 20 nearest
      );

      if (!allDeliveryBoys || allDeliveryBoys.length === 0) {
        return errorResponse(res, 404, 'No delivery partners available in your area');
      }

      // Notify all available delivery boys
      const populatedOrder = await Order.findById(order._id)
        .populate('userId', 'name phone')
        .populate('restaurantId', 'name location address phone ownerPhone')
        .lean();

      if (populatedOrder) {
        const deliveryPartnerIds = allDeliveryBoys.map(db => db.deliveryPartnerId);
        
        // Update assignment info
        await Order.findByIdAndUpdate(order._id, {
          $set: {
            'assignmentInfo.priorityDeliveryPartnerIds': deliveryPartnerIds,
            'assignmentInfo.assignedBy': 'manual_resend',
            'assignmentInfo.assignedAt': new Date()
          }
        });

        await notifyMultipleDeliveryBoys(populatedOrder, deliveryPartnerIds, 'priority');
        return successResponse(res, 200, `Notification sent to ${deliveryPartnerIds.length} delivery partners`, {
          order: populatedOrder,
          notifiedCount: deliveryPartnerIds.length
        });
      }
    } else {
      // Notify priority delivery boys
      const populatedOrder = await Order.findById(order._id)
        .populate('userId', 'name phone')
        .populate('restaurantId', 'name location address phone ownerPhone')
        .lean();

      if (populatedOrder) {
        const priorityIds = priorityDeliveryBoys.map(db => db.deliveryPartnerId);
        
        // Update assignment info
        await Order.findByIdAndUpdate(order._id, {
          $set: {
            'assignmentInfo.priorityDeliveryPartnerIds': priorityIds,
            'assignmentInfo.assignedBy': 'manual_resend',
            'assignmentInfo.assignedAt': new Date()
          }
        });

        await notifyMultipleDeliveryBoys(populatedOrder, priorityIds, 'priority');
        return successResponse(res, 200, `Notification sent to ${priorityIds.length} delivery partners`, {
          order: populatedOrder,
          notifiedCount: priorityIds.length
        });
      }
    }

    return errorResponse(res, 500, 'Failed to send notification');
  } catch (error) {
    console.error('Error resending delivery notification:', error);
    return errorResponse(res, 500, `Failed to resend notification: ${error.message}`);
  }
});
