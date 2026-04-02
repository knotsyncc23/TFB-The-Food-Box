import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../context/OrdersContext';
import { orderAPI } from '@/lib/api';

export default function OrderTrackingCard() {
  const navigate = useNavigate();
  const { orders: contextOrders } = useOrders();
  const [activeOrder, setActiveOrder] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [apiOrders, setApiOrders] = useState([]);

  // Fetch orders from API (optional - only if endpoint exists)
  // For now, we'll rely primarily on localStorage orders from OrdersContext
  useEffect(() => {
    // Only try API if user is authenticated
    const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken');
    if (!userToken) {
      // No token, skip API call
      return;
    }

    const fetchOrders = async () => {
      try {
        const response = await orderAPI.getOrders({ limit: 10, page: 1 });
        if (response?.data?.success && response?.data?.data?.orders) {
          setApiOrders(response.data.data.orders);
        } else if (response?.data?.orders) {
          setApiOrders(response.data.orders);
        } else if (response?.data?.data && Array.isArray(response.data.data)) {
          setApiOrders(response.data.data);
        }
      } catch (error) {
        // Silently fail - don't show error if API fails, just use context orders
        // Only log if it's not a 404 (endpoint doesn't exist)
        if (error?.response?.status !== 404) {
          console.warn('Could not fetch orders from API for tracking card, using context orders only:', error?.response?.status || error?.message);
        }
        setApiOrders([]);
      }
    };

    // Try once on mount, but don't retry if it fails
    fetchOrders();
  }, []);

  // Get active order (not delivered) - check both context and API orders
  useEffect(() => {
    // Combine context orders and API orders
    const allOrders = [...contextOrders, ...apiOrders];

    // Remove duplicates by ID
    const uniqueOrders = allOrders.filter((order, index, self) =>
      index === self.findIndex((o) => (o.id || o._id) === (order.id || order._id))
    );

    console.log('🔍 OrderTrackingCard - Checking for active orders:', {
      contextOrdersCount: contextOrders.length,
      apiOrdersCount: apiOrders.length,
      uniqueOrdersCount: uniqueOrders.length,
      orders: uniqueOrders.map(o => ({
        id: o.id || o._id,
        status: o.status || o.deliveryState?.status,
        restaurant: o.restaurant || o.restaurantName
      }))
    });

    // Find active order - any order that is NOT delivered, cancelled, or completed
    const active = uniqueOrders.find(order => {
      const status = (order.status || order.deliveryState?.status || '').toLowerCase();
      const isInactive = status === 'delivered' ||
        status === 'cancelled' ||
        status === 'completed' ||
        status === '';

      if (isInactive) {
        return false;
      }

      // If status exists and is not inactive, it's active
      return true;
    });

    console.log('✅ OrderTrackingCard - Active order found:', active ? {
      id: active.id || active._id,
      status: active.status || active.deliveryState?.status,
      restaurant: active.restaurant || active.restaurantName
    } : 'No active order');

    if (active) {
      setActiveOrder(active);
      // Calculate estimated delivery time
      const orderTime = new Date(active.createdAt || active.orderDate || active.created_at || active.date || Date.now());
      const estimatedMinutes =
        active.eta?.max ||
        active.estimatedDeliveryTime ||
        active.estimatedTime ||
        active.estimated_delivery_time ||
        35;
      const deliveryTime = new Date(orderTime.getTime() + estimatedMinutes * 60000);
      const remaining = Math.max(0, Math.floor((deliveryTime - new Date()) / 60000));
      setTimeRemaining(remaining);
      console.log('⏰ OrderTrackingCard - Time remaining:', remaining, 'minutes');
    } else {
      setActiveOrder(null);
      setTimeRemaining(null);
    }
  }, [contextOrders, apiOrders]);

  // Countdown timer
  useEffect(() => {
    if (!activeOrder || timeRemaining === null) return;

    // Update more frequently when time is running out (every second if <= 1 minute, otherwise every minute)
    const updateInterval = timeRemaining <= 1 ? 1000 : 60000;

    const interval = setInterval(() => {
      // Check both context and API orders
      const allOrders = [...contextOrders, ...apiOrders];
      const currentActive = allOrders.find(order => {
        const orderId = order.id || order._id;
        const activeOrderId = activeOrder.id || activeOrder._id;
        return orderId === activeOrderId;
      });

      if (!currentActive) {
        setActiveOrder(null);
        setTimeRemaining(null);
        return;
      }

      const status = (currentActive.status || currentActive.deliveryState?.status || '').toLowerCase();
      if (status === 'delivered' || status === 'cancelled' || status === 'completed') {
        setActiveOrder(null);
        setTimeRemaining(null);
        return;
      }

      const orderTime = new Date(currentActive.createdAt || currentActive.orderDate || currentActive.created_at || Date.now());
      const estimatedMinutes =
        currentActive.eta?.max ||
        currentActive.estimatedDeliveryTime ||
        currentActive.estimatedTime ||
        currentActive.estimated_delivery_time ||
        35;
      const deliveryTime = new Date(orderTime.getTime() + estimatedMinutes * 60000);
      const remaining = Math.max(0, Math.floor((deliveryTime - new Date()) / 60000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setActiveOrder(null);
        setTimeRemaining(null);
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [activeOrder, timeRemaining, contextOrders, apiOrders]);

  // Listen for order updates from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      // When storage changes, the OrdersContext will update automatically
      // No need to fetch from API again - just rely on context orders
      // This prevents unnecessary API calls and errors
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('orderStatusUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('orderStatusUpdated', handleStorageChange);
    };
  }, []);

  // Debug: Log when component renders
  useEffect(() => {
    console.log('🎯 OrderTrackingCard render:', {
      hasActiveOrder: !!activeOrder,
      timeRemaining,
      contextOrdersCount: contextOrders.length,
      apiOrdersCount: apiOrders.length
    });
  }, [activeOrder, timeRemaining, contextOrders.length, apiOrders.length]);

  if (!activeOrder) {
    // console.log('OrderTrackingCard - No active order, not rendering');
    return null;
  }

  // Check if order is delivered or time remaining is 0 - hide card
  const orderStatus = (activeOrder.status || activeOrder.deliveryState?.status || 'preparing').toLowerCase();
  if (orderStatus === 'delivered' || orderStatus === 'completed' || timeRemaining === 0) {
    console.log('❌ OrderTrackingCard - Order delivered or time is 0, hiding card');
    return null;
  }

  const restaurantName = activeOrder.restaurant || activeOrder.restaurantName || activeOrder.restaurantName || 'Restaurant';
  const statusText = orderStatus === 'preparing' || orderStatus === 'confirmed' || orderStatus === 'pending'
    ? 'Preparing your order'
    : orderStatus === 'out_for_delivery' || orderStatus === 'outfordelivery' || orderStatus === 'on_way'
      ? 'On the way'
      : 'Preparing your order';

  console.log('✅ OrderTrackingCard - Rendering card:', {
    restaurantName,
    orderStatus,
    statusText,
    timeRemaining
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-20 left-4 right-4 z-[40] md:hidden"
        onClick={() => navigate(`/user/orders/${activeOrder.id || activeOrder._id}`)}
      >
        <div className="bg-gray-800 rounded-xl p-4 shadow-2xl border border-gray-700">
          <div className="flex items-center gap-3">
            {/* Left Side - Icon and Text */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{restaurantName}</p>
                <div className="flex items-center gap-1">
                  <p className="text-gray-300 text-xs truncate">{statusText}</p>
                  <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            </div>

            {/* Right Side - Time Pill */}
            <div className="bg-red-600 rounded-lg px-3 py-2 flex-shrink-0">
              <p className="text-white text-[10px] font-medium uppercase leading-tight">arriving in</p>
              <p className="text-white text-sm font-bold leading-tight">
                {timeRemaining !== null ? `${timeRemaining} mins` : '-- mins'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

