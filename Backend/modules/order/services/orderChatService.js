import Order from '../models/Order.js';
import OrderChat from '../models/OrderChat.js';
import mongoose from 'mongoose';

const CHAT_DISABLE_AFTER_DELIVERED_MINUTES = 30;
const CHAT_ALLOWED_STATUSES = [
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'accepted',
];

/**
 * Resolve order by id (MongoDB _id or orderId string)
 * @param {string} orderIdParam - _id or orderId
 * @returns {Promise<Object|null>} Order document or null
 */
export async function resolveOrder(orderIdParam) {
  if (!orderIdParam) return null;
  let order = null;
  if (mongoose.Types.ObjectId.isValid(orderIdParam) && orderIdParam.length === 24) {
    order = await Order.findById(orderIdParam)
      .populate('deliveryPartnerId', 'name email phone profileImage')
      .lean();
  }
  if (!order) {
    order = await Order.findOne({ orderId: orderIdParam })
      .populate('deliveryPartnerId', 'name email phone profileImage')
      .lean();
  }
  return order;
}

/**
 * Check if chat is allowed for this order (status + not past 30 min after delivered)
 */
export function isChatAllowedForOrder(order) {
  if (!order) return false;
  const status = String(order.status || '').toLowerCase();
  const deliveryStateStatus = String(order.deliveryState?.status || '').toLowerCase();
  const deliveryPhase = String(order.deliveryState?.currentPhase || '').toLowerCase();

  const hasAllowedTopLevelStatus = CHAT_ALLOWED_STATUSES.includes(status);
  const hasAllowedDeliveryState =
    ['accepted', 'order_confirmed', 'en_route_to_delivery'].includes(deliveryStateStatus) ||
    ['assigned', 'accepted', 'en_route_to_pickup', 'picked_up', 'en_route_to_delivery'].includes(deliveryPhase);

  if (!hasAllowedTopLevelStatus && !hasAllowedDeliveryState) return false;
  if (status === 'delivered' && order.deliveredAt) {
    const closedAt = new Date(order.deliveredAt);
    closedAt.setMinutes(closedAt.getMinutes() + CHAT_DISABLE_AFTER_DELIVERED_MINUTES);
    if (new Date() > closedAt) return false;
  }
  return true;
}

/**
 * Find or create OrderChat for an order. Uses order._id as orderId in OrderChat.
 */
export async function findOrCreateChat(orderMongoId, userId, deliveryPartnerId) {
  let chat = await OrderChat.findOne({ orderId: orderMongoId });
  if (chat) return chat;
  chat = await OrderChat.create({
    orderId: orderMongoId,
    userId,
    deliveryPartnerId: deliveryPartnerId || null,
    messages: [],
    isActive: true
  });
  return chat;
}

/**
 * Get chat for order (user side). Resolves order by param, checks userId.
 */
export async function getChatForUser(orderIdParam, userId) {
  const order = await resolveOrder(orderIdParam);
  if (!order) return { order: null, chat: null, allowed: false };
  if (order.userId?.toString() !== userId?.toString() && order.userId?.toString() !== userId) {
    return { order: null, chat: null, allowed: false };
  }
  const allowed = isChatAllowedForOrder(order);
  const orderMongoId = order._id;
  const chat = await findOrCreateChat(
    orderMongoId,
    order.userId,
    order.deliveryPartnerId ? order.deliveryPartnerId._id : null
  );
  return {
    order: {
      _id: order._id,
      orderId: order.orderId,
      status: order.status,
      deliveredAt: order.deliveredAt,
      deliveryPartnerId: order.deliveryPartnerId
    },
    chat: {
      _id: chat._id,
      orderId: chat.orderId,
      messages: chat.messages,
      isActive: allowed ? chat.isActive : false,
      closedAt: chat.closedAt
    },
    allowed
  };
}

/**
 * Get chat for delivery partner. Resolves order by param, checks deliveryPartnerId.
 */
export async function getChatForDelivery(orderIdParam, deliveryPartnerId) {
  const order = await resolveOrder(orderIdParam);
  if (!order) return { order: null, chat: null, allowed: false };
  const dpId = order.deliveryPartnerId?._id?.toString() || order.deliveryPartnerId?.toString();
  const myId = deliveryPartnerId?.toString();
  if (dpId !== myId) {
    return { order: null, chat: null, allowed: false };
  }
  const allowed = isChatAllowedForOrder(order);
  const orderMongoId = order._id;
  const chat = await findOrCreateChat(
    orderMongoId,
    order.userId,
    order.deliveryPartnerId?._id || order.deliveryPartnerId
  );
  return {
    order: {
      _id: order._id,
      orderId: order.orderId,
      status: order.status,
      deliveredAt: order.deliveredAt,
      userId: order.userId
    },
    chat: {
      _id: chat._id,
      orderId: chat.orderId,
      messages: chat.messages,
      isActive: allowed ? chat.isActive : false,
      closedAt: chat.closedAt
    },
    allowed
  };
}

/**
 * Add a message and optionally emit via Socket.IO
 */
export async function addMessage(orderIdParam, sender, message, actorId, getIO) {
  const order = await resolveOrder(orderIdParam);
  if (!order) return null;
  const orderMongoId = order._id;
  if (sender === 'user') {
    if (order.userId?.toString() !== actorId?.toString() && order.userId?.toString() !== actorId) {
      return null;
    }
  } else if (sender === 'delivery') {
    const dpId = order.deliveryPartnerId?._id?.toString() || order.deliveryPartnerId?.toString();
    if (dpId !== actorId?.toString()) return null;
  } else {
    return null;
  }
  if (!isChatAllowedForOrder(order)) return null;

  let chat = await OrderChat.findOne({ orderId: orderMongoId });
  if (!chat) {
    chat = await findOrCreateChat(
      orderMongoId,
      order.userId,
      order.deliveryPartnerId?._id || order.deliveryPartnerId
    );
  }

  const msg = {
    sender,
    message: (message || '').trim(),
    timestamp: new Date()
  };
  chat.messages.push(msg);
  await chat.save();

  const payload = {
    _id: msg._id || chat.messages[chat.messages.length - 1]._id,
    sender: msg.sender,
    message: msg.message,
    timestamp: msg.timestamp,
    orderId: order.orderId,
    orderMongoId: orderMongoId.toString()
  };

  if (getIO) {
    try {
      const io = await Promise.resolve(getIO());
      if (io) {
        io.to(`order-chat:${orderMongoId}`).emit('chat_message', payload);
        io.to(`order-chat:${order.orderId}`).emit('chat_message', payload);
      }
    } catch (e) {
      console.warn('Socket emit chat_message failed:', e.message);
    }
  }

  return payload;
}
