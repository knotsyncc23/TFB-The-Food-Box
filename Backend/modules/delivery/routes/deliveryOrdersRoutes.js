import express from 'express';
import { 
  getOrders, 
  getOrderDetails,
  getActiveOrder,
  acceptOrder, 
  rejectOrder,
  confirmReachedPickup, 
  confirmOrderId,
  confirmReachedDrop,
  completeDelivery
} from '../controllers/deliveryOrdersController.js';
import { getOrderChatDelivery, sendOrderChatMessageDelivery } from '../../order/controllers/orderChatController.js';
import { getTripHistory } from '../controllers/deliveryTripHistoryController.js';
import { authenticate } from '../middleware/deliveryAuth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Orders routes
router.get('/active-order', getActiveOrder);
router.get('/orders', getOrders);
router.get('/orders/:orderId', getOrderDetails);
router.get('/orders/:orderId/chat', getOrderChatDelivery);
router.post('/orders/:orderId/chat/messages', sendOrderChatMessageDelivery);
router.patch('/orders/:orderId/accept', acceptOrder);
router.patch('/orders/:orderId/reject', rejectOrder);
router.patch('/orders/:orderId/reached-pickup', confirmReachedPickup);
router.patch('/orders/:orderId/confirm-order-id', confirmOrderId);
router.patch('/orders/:orderId/reached-drop', confirmReachedDrop);
router.patch('/orders/:orderId/complete-delivery', completeDelivery);

// Trip History route
router.get('/trip-history', getTripHistory);

export default router;

