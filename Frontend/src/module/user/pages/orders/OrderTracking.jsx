import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  ArrowLeft,
  Share2,
  RefreshCw,
  Phone,
  ChevronRight,
  MapPin,
  Home as HomeIcon,
  MessageSquare,
  MessageCircle,
  X,
  Check,
  Shield,
  Receipt,
  CircleSlash,
  Loader2,
  Star
} from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useOrders } from "../../context/OrdersContext"
import { useProfile } from "../../context/ProfileContext"
import { useLocation as useUserLocation } from "../../hooks/useLocation"
import DeliveryTrackingMap from "../../components/DeliveryTrackingMap"
import { orderAPI, restaurantAPI } from "@/lib/api"
import { shareContent } from "@/lib/utils/share"
import circleIcon from "@/assets/circleicon.png"

const getOrderCountdownMinutes = (order) => {
  if (!order) return null

  const normalizedStatus = String(
    order.status || order.originalStatus || order.deliveryState?.status || ""
  ).toLowerCase()

  if (!normalizedStatus || ["delivered", "completed", "cancelled", "canceled"].includes(normalizedStatus)) {
    return null
  }

  const deliveryPhase = String(order.deliveryState?.currentPhase || "").toLowerCase()
  const routeToDeliveryDuration = Number(order.deliveryState?.routeToDelivery?.duration)
  const fullOrderEta =
    Number(order.eta?.max) ||
    Number(order.estimatedDeliveryTime) ||
    Number(order.estimatedTime) ||
    Number(order.estimated_delivery_time) ||
    35

  const phaseAwareEta =
    deliveryPhase === "en_route_to_delivery" || normalizedStatus === "out_for_delivery"
      ? (routeToDeliveryDuration > 0 ? routeToDeliveryDuration : Math.min(fullOrderEta, 20))
      : fullOrderEta

  const baseTimestamp =
    deliveryPhase === "en_route_to_delivery" || normalizedStatus === "out_for_delivery"
      ? (
          order.deliveryState?.orderIdConfirmedAt ||
          order.tracking?.outForDelivery?.timestamp ||
          order.tracking?.out_for_delivery?.timestamp ||
          order.deliveryState?.acceptedAt
        )
      : (order.createdAt || order.orderDate || order.created_at || order.date)

  const baseTime = new Date(baseTimestamp || Date.now())
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - baseTime.getTime()) / 60000))
  return Math.max(0, phaseAwareEta - elapsedMinutes)
}

const deriveOrderItemIsVeg = (item) => {
  const explicitFoodType = item?.foodType || item?.variationFoodType || item?.selectedVariation?.foodType

  if (typeof explicitFoodType === "string") {
    const normalized = explicitFoodType.trim().toLowerCase()

    if (normalized === "veg" || normalized === "vegetarian") return true
    if (
      normalized === "non-veg" ||
      normalized === "non veg" ||
      normalized === "nonveg" ||
      normalized === "egg"
    ) {
      return false
    }
  }

  if (item?.isVeg === true) return true
  if (item?.isVeg === false) return false

  const categoryOrType = [item?.category, item?.type]
    .filter((value) => typeof value === "string")
    .map((value) => value.trim().toLowerCase())

  if (categoryOrType.includes("veg")) return true
  if (categoryOrType.includes("non-veg") || categoryOrType.includes("non veg") || categoryOrType.includes("nonveg")) {
    return false
  }

  return false
}

// Animated checkmark component
const AnimatedCheckmark = ({ delay = 0 }) => (
  <motion.svg
    width="80"
    height="80"
    viewBox="0 0 80 80"
    initial="hidden"
    animate="visible"
    className="mx-auto"
  >
    <motion.circle
      cx="40"
      cy="40"
      r="36"
      fill="none"
      stroke="#671E1F"
      strokeWidth="4"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    />
    <motion.path
      d="M24 40 L35 51 L56 30"
      fill="none"
      stroke="#671E1F"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay: delay + 0.4, ease: "easeOut" }}
    />
  </motion.svg>
)

// Real Delivery Map Component with User Live Location
const DeliveryMap = ({ orderId, order, isVisible }) => {
  const { location: userLocation } = useUserLocation() // Get user's live location

  // Get coordinates from order or use defaults (Indore)
  const getRestaurantCoords = () => {
    console.log('🔍 Getting restaurant coordinates from order:', {
      hasOrder: !!order,
      restaurantLocation: order?.restaurantLocation,
      coordinates: order?.restaurantLocation?.coordinates,
      restaurantId: order?.restaurantId,
      restaurantIdLocation: order?.restaurantId?.location,
      restaurantIdCoordinates: order?.restaurantId?.location?.coordinates
    });

    // Try multiple sources for restaurant coordinates
    let coords = null;

    // Priority 1: restaurantLocation.coordinates (already extracted in transformed order)
    if (order?.restaurantLocation?.coordinates &&
      Array.isArray(order.restaurantLocation.coordinates) &&
      order.restaurantLocation.coordinates.length >= 2) {
      coords = order.restaurantLocation.coordinates;
      console.log('✅ Using restaurantLocation.coordinates:', coords);
    }
    // Priority 2: restaurantId.location.coordinates (if restaurantId is populated)
    else if (order?.restaurantId?.location?.coordinates &&
      Array.isArray(order.restaurantId.location.coordinates) &&
      order.restaurantId.location.coordinates.length >= 2) {
      coords = order.restaurantId.location.coordinates;
      console.log('✅ Using restaurantId.location.coordinates:', coords);
    }
    // Priority 3: restaurantId.location with latitude/longitude
    else if (order?.restaurantId?.location?.latitude && order?.restaurantId?.location?.longitude) {
      coords = [order.restaurantId.location.longitude, order.restaurantId.location.latitude];
      console.log('✅ Using restaurantId.location (lat/lng):', coords);
    }

    if (coords && coords.length >= 2) {
      // GeoJSON format is [longitude, latitude]
      const result = {
        lat: coords[1], // Latitude is second element
        lng: coords[0]  // Longitude is first element
      };
      console.log('✅ Final restaurant coordinates (lat, lng):', result, 'from GeoJSON:', coords);
      return result;
    }

    console.warn('⚠️ Restaurant coordinates not found, using default Indore coordinates');
    // Default Indore coordinates
    return { lat: 22.7196, lng: 75.8577 };
  };

  const getCustomerCoords = () => {
    if (order?.address?.coordinates) {
      return {
        lat: order.address.coordinates[1],
        lng: order.address.coordinates[0]
      };
    }
    // Default Indore coordinates
    return { lat: 22.7196, lng: 75.8577 };
  };

  // Get user's live location coordinates
  const getUserLiveCoords = () => {
    if (userLocation?.latitude && userLocation?.longitude) {
      return {
        lat: userLocation.latitude,
        lng: userLocation.longitude
      };
    }
    return null;
  };

  const restaurantCoords = getRestaurantCoords();
  const customerCoords = getCustomerCoords();
  const userLiveCoords = getUserLiveCoords();

  // Delivery boy data
  const deliveryBoyData = order?.deliveryPartner ? {
    name: order.deliveryPartner.name || 'Delivery Partner',
    avatar: order.deliveryPartner.avatar || null
  } : null;

  if (!isVisible || !orderId || !order) {
    return (
      <motion.div
        className="relative h-64 bg-gradient-to-b from-gray-100 to-gray-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
    );
  }

  return (
    <motion.div
      className="relative h-64 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <DeliveryTrackingMap
        orderId={orderId}
        restaurantCoords={restaurantCoords}
        customerCoords={customerCoords}
        userLiveCoords={userLiveCoords}
        userLocationAccuracy={userLocation?.accuracy}
        deliveryBoyData={deliveryBoyData}
        order={order}
      />
    </motion.div>
  );
}

// Section item component
const SectionItem = ({ icon: Icon, title, subtitle, onClick, showArrow = true, rightContent }) => (
  <motion.button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b border-dashed border-gray-200 last:border-0"
    whileTap={{ scale: 0.99 }}
  >
    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-gray-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-gray-900 truncate">{title}</p>
      {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
    </div>
    {rightContent || (showArrow && <ChevronRight className="w-5 h-5 text-gray-400" />)}
  </motion.button>
)

export default function OrderTracking() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const confirmed = searchParams.get("confirmed") === "true"
  const { getOrderById } = useOrders()
  const { profile, getDefaultAddress } = useProfile()

  // State for order data
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showConfirmation, setShowConfirmation] = useState(confirmed)
  const [orderStatus, setOrderStatus] = useState('placed')
  const [estimatedTime, setEstimatedTime] = useState(29)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationReason, setCancellationReason] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)
  const [showDeliveryInstructionsDialog, setShowDeliveryInstructionsDialog] = useState(false)
  const [deliveryInstructionsText, setDeliveryInstructionsText] = useState("")
  const [isSavingInstructions, setIsSavingInstructions] = useState(false)

  // Review states
  const [rating, setRating] = useState(0)
  const [reviewComment, setReviewComment] = useState("")
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const nonCancellableStatuses = new Set([
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
    "completed",
    "cancelled",
  ])

  const normalizeStatusForUi = useCallback((statusValue) => {
    const status = String(statusValue || "").toLowerCase()
    if (!status) return "placed"
    if (status === "cancelled" || status === "canceled" || status === "restaurant_cancelled" || status === "user_cancelled") {
      return "cancelled"
    }
    if (status === "delivered" || status === "completed") return "delivered"
    if (status === "out_for_delivery" || status === "outfordelivery") return "pickup"
    if (status === "ready") return "prepared"
    if (status === "preparing") return "preparing"
    return "placed"
  }, [])

  const applyOrderStatus = useCallback((apiOrder) => {
    if (!apiOrder) return
    const status = apiOrder.status
    const phase = apiOrder.deliveryState?.currentPhase

    if (status === 'cancelled') {
      setOrderStatus('cancelled')
    } else if (status === 'delivered' || status === 'completed' || phase === 'completed') {
      setOrderStatus('delivered')
    } else if (status === 'out_for_delivery') {
      setOrderStatus('pickup')
    } else if (status === 'ready') {
      setOrderStatus('prepared')
    } else if (status === 'preparing') {
      setOrderStatus('preparing')
    }
  }, [])

  const defaultAddress = getDefaultAddress()

  // Poll for order updates (especially when delivery partner accepts)
  // Only poll if delivery partner is not yet assigned to avoid unnecessary updates
  useEffect(() => {
    if (!orderId || !order) return;

    // Skip polling if delivery partner is already assigned and accepted
    const currentDeliveryStatus = order?.deliveryState?.status;
    const currentPhase = order?.deliveryState?.currentPhase;
    const hasDeliveryPartner = currentDeliveryStatus === 'accepted' ||
      currentPhase === 'en_route_to_pickup' ||
      currentPhase === 'at_pickup' ||
      currentPhase === 'en_route_to_delivery';

    // If delivery partner is assigned, reduce polling frequency to 30 seconds
    // If not assigned, poll every 5 seconds to detect assignment
    const pollInterval = hasDeliveryPartner ? 30000 : 5000;

    const interval = setInterval(async () => {
      try {
        const response = await orderAPI.getOrderDetails(orderId);
        if (response.data?.success && response.data.data?.order) {
          const apiOrder = response.data.data.order;

          // Check if delivery state changed (e.g., status became 'accepted')
          const newDeliveryStatus = apiOrder.deliveryState?.status;
          const newPhase = apiOrder.deliveryState?.currentPhase;
          const newOrderStatus = apiOrder.status;
          const currentOrderStatus = order?.status;

          // Check if order was cancelled
          if (newOrderStatus === 'cancelled' && currentOrderStatus !== 'cancelled') {
            setOrderStatus('cancelled');
          }

          // Only update if status actually changed
          if (newDeliveryStatus === 'accepted' ||
            (newDeliveryStatus !== currentDeliveryStatus) ||
            (newPhase !== currentPhase) ||
            (newOrderStatus !== currentOrderStatus)) {
            console.log('🔄 Order status updated:', {
              oldStatus: currentDeliveryStatus,
              newStatus: newDeliveryStatus,
              oldPhase: currentPhase,
              newPhase: newPhase
            });

            // Re-fetch and update order (same logic as initial fetch)
            let restaurantCoords = null;
            if (apiOrder.restaurantId?.location?.coordinates &&
              Array.isArray(apiOrder.restaurantId.location.coordinates) &&
              apiOrder.restaurantId.location.coordinates.length >= 2) {
              restaurantCoords = apiOrder.restaurantId.location.coordinates;
            } else if (typeof apiOrder.restaurantId === 'string') {
              try {
                const restaurantResponse = await restaurantAPI.getRestaurantById(apiOrder.restaurantId);
                if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
                  const restaurant = restaurantResponse.data.data.restaurant;
                  if (restaurant.location?.coordinates && Array.isArray(restaurant.location.coordinates) && restaurant.location.coordinates.length >= 2) {
                    restaurantCoords = restaurant.location.coordinates;
                  }
                }
              } catch (err) {
                console.error('❌ Error fetching restaurant details:', err);
              }
            }

            const transformedOrder = {
              ...apiOrder,
              restaurantLocation: restaurantCoords ? {
                coordinates: restaurantCoords
              } : order.restaurantLocation,
              deliveryPartnerId: apiOrder.deliveryPartnerId?._id || apiOrder.deliveryPartnerId || apiOrder.assignmentInfo?.deliveryPartnerId || null,
              assignmentInfo: apiOrder.assignmentInfo || null,
              deliveryState: apiOrder.deliveryState || null
            };

            setOrder(transformedOrder);
            applyOrderStatus(apiOrder);
          }
        }
      } catch (err) {
        console.error('Error polling order updates:', err);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [orderId, order?.deliveryState?.status, order?.deliveryState?.currentPhase, order?.status, applyOrderStatus]);

  // Fetch order from API if not found in context
  useEffect(() => {
    const fetchOrder = async () => {
      // First try to get from context (localStorage)
      const contextOrder = getOrderById(orderId)
      if (contextOrder) {
        // Ensure restaurant location is available in context order
        if (!contextOrder.restaurantLocation?.coordinates && contextOrder.restaurantId?.location?.coordinates) {
          contextOrder.restaurantLocation = {
            coordinates: contextOrder.restaurantId.location.coordinates
          };
        }
        // Also ensure restaurantId is present
        if (!contextOrder.restaurantId && contextOrder.restaurant) {
          // Try to preserve restaurantId if it exists
          console.log('⚠️ Context order missing restaurantId, will fetch from API');
        }
        setOrder(contextOrder)
        setOrderStatus(normalizeStatusForUi(contextOrder.status || contextOrder.originalStatus))
        setLoading(false)
        return
      }

      // If not in context, fetch from API
      try {
        setLoading(true)
        setError(null)

        const response = await orderAPI.getOrderDetails(orderId)

        if (response.data?.success && response.data.data?.order) {
          const apiOrder = response.data.data.order

          // Log full API response structure for debugging
          console.log('🔍 Full API Order Response:', {
            orderId: apiOrder.orderId || apiOrder._id,
            hasRestaurantId: !!apiOrder.restaurantId,
            restaurantIdType: typeof apiOrder.restaurantId,
            restaurantIdKeys: apiOrder.restaurantId ? Object.keys(apiOrder.restaurantId) : [],
            restaurantIdLocation: apiOrder.restaurantId?.location,
            restaurantIdLocationKeys: apiOrder.restaurantId?.location ? Object.keys(apiOrder.restaurantId.location) : [],
            restaurantIdCoordinates: apiOrder.restaurantId?.location?.coordinates,
            fullRestaurantId: apiOrder.restaurantId
          });

          // Extract restaurant location coordinates with multiple fallbacks
          let restaurantCoords = null;

          // Priority 1: restaurantId.location.coordinates (GeoJSON format: [lng, lat])
          if (apiOrder.restaurantId?.location?.coordinates &&
            Array.isArray(apiOrder.restaurantId.location.coordinates) &&
            apiOrder.restaurantId.location.coordinates.length >= 2) {
            restaurantCoords = apiOrder.restaurantId.location.coordinates;
            console.log('✅ Found coordinates in restaurantId.location.coordinates:', restaurantCoords);
          }
          // Priority 2: restaurantId.location with latitude/longitude properties
          else if (apiOrder.restaurantId?.location?.latitude && apiOrder.restaurantId?.location?.longitude) {
            restaurantCoords = [apiOrder.restaurantId.location.longitude, apiOrder.restaurantId.location.latitude];
            console.log('✅ Found coordinates in restaurantId.location (lat/lng):', restaurantCoords);
          }
          // Priority 3: Check if restaurantId is a string ID and fetch restaurant details
          else if (typeof apiOrder.restaurantId === 'string') {
            console.log('⚠️ restaurantId is a string ID, fetching restaurant details...', apiOrder.restaurantId);
            try {
              const restaurantResponse = await restaurantAPI.getRestaurantById(apiOrder.restaurantId);
              if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
                const restaurant = restaurantResponse.data.data.restaurant;
                if (restaurant.location?.coordinates && Array.isArray(restaurant.location.coordinates) && restaurant.location.coordinates.length >= 2) {
                  restaurantCoords = restaurant.location.coordinates;
                  console.log('✅ Fetched restaurant coordinates from API:', restaurantCoords);
                }
              }
            } catch (err) {
              console.error('❌ Error fetching restaurant details:', err);
            }
          }
          // Priority 4: Check nested restaurant data
          else if (apiOrder.restaurant?.location?.coordinates) {
            restaurantCoords = apiOrder.restaurant.location.coordinates;
            console.log('✅ Found coordinates in restaurant.location.coordinates:', restaurantCoords);
          }

          console.log('📍 Final restaurant coordinates:', restaurantCoords);
          console.log('📍 Customer coordinates:', apiOrder.address?.location?.coordinates);

          // Transform API order to match component structure
          const transformedOrder = {
            id: apiOrder.orderId || apiOrder._id,
            mongoId: apiOrder._id,
            restaurant: apiOrder.restaurantName || 'Restaurant',
            restaurantId: apiOrder.restaurantId || null, // Include restaurantId for location access
            userId: apiOrder.userId || null, // Include user data for phone number
            userName: apiOrder.userName || apiOrder.userId?.name || apiOrder.userId?.fullName || '',
            userPhone: apiOrder.userPhone || apiOrder.userId?.phone || '',
            address: {
              street: apiOrder.address?.street || '',
              city: apiOrder.address?.city || '',
              state: apiOrder.address?.state || '',
              zipCode: apiOrder.address?.zipCode || '',
              additionalDetails: apiOrder.address?.additionalDetails || '',
              formattedAddress: apiOrder.address?.formattedAddress ||
                (apiOrder.address?.street && apiOrder.address?.city
                  ? `${apiOrder.address.street}${apiOrder.address.additionalDetails ? `, ${apiOrder.address.additionalDetails}` : ''}, ${apiOrder.address.city}${apiOrder.address.state ? `, ${apiOrder.address.state}` : ''}${apiOrder.address.zipCode ? ` ${apiOrder.address.zipCode}` : ''}`
                  : apiOrder.address?.city || ''),
              coordinates: apiOrder.address?.location?.coordinates || null
            },
            restaurantLocation: {
              coordinates: restaurantCoords
            },
            items: apiOrder.items?.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              isVeg: deriveOrderItemIsVeg(item),
            })) || [],
            total: apiOrder.pricing?.total || 0,
            status: apiOrder.status || 'pending',
            deliveryPartner: apiOrder.deliveryPartnerId ? {
              name: apiOrder.deliveryPartnerId.name || 'Delivery Partner',
              avatar: null
            } : null,
            deliveryPartnerId: apiOrder.deliveryPartnerId?._id || apiOrder.deliveryPartnerId || apiOrder.assignmentInfo?.deliveryPartnerId || null,
            assignmentInfo: apiOrder.assignmentInfo || null,
            tracking: apiOrder.tracking || {},
            deliveryState: apiOrder.deliveryState || null,
            deliveryInstructions: apiOrder.deliveryInstructions || "",
            deliveryAddress: apiOrder.deliveryAddress || undefined,
            phoneNumber: apiOrder.phoneNumber || undefined
          }

          setOrder(transformedOrder)
          const nextEta = getOrderCountdownMinutes(apiOrder)
          if (nextEta !== null) {
            setEstimatedTime(nextEta)
          }

          // Update orderStatus based on API order status
          // 'ready' = food ready at restaurant, waiting for delivery partner (show "Food is ready")
          // 'out_for_delivery' = delivery partner picked up and on the way (show "Order picked up")
          applyOrderStatus(apiOrder)
        } else {
          throw new Error('Order not found')
        }
      } catch (err) {
        console.error('Error fetching order:', err)
        setError(err.response?.data?.message || err.message || 'Failed to fetch order')
      } finally {
        setLoading(false)
      }
    }

    if (orderId) {
      fetchOrder()
    }
  }, [orderId, getOrderById, applyOrderStatus, normalizeStatusForUi])

  // Simulate order status progression
  useEffect(() => {
    if (confirmed) {
      const timer1 = setTimeout(() => {
        setShowConfirmation(false)
        const latestStatus = String(order?.status || "").toLowerCase()
        if (latestStatus !== "cancelled" && latestStatus !== "restaurant_cancelled" && latestStatus !== "user_cancelled") {
          setOrderStatus('preparing')
        }
      }, 3000)
      return () => clearTimeout(timer1)
    }
  }, [confirmed, order?.status])

  // Countdown timer
  useEffect(() => {
    const syncEstimatedTime = () => {
      const nextEta = getOrderCountdownMinutes(order)
      if (nextEta !== null) {
        setEstimatedTime(nextEta)
      }
    }

    syncEstimatedTime()
    const timer = setInterval(() => {
      syncEstimatedTime()
    }, 60000)
    return () => clearInterval(timer)
  }, [order])

  // Listen for order status updates from socket (e.g., "Delivery partner on the way")
  useEffect(() => {
    const handleOrderStatusNotification = (event) => {
      const { message, title, status, estimatedDeliveryTime } = event.detail;

      console.log('📢 Order status notification received:', { message, status });

      // Update order status in UI
      if (status === 'cancelled') {
        setOrderStatus('cancelled');
      }
      if (status === 'out_for_delivery') {
        setOrderStatus('on_way');
      }

      // Show notification toast
      if (message) {
        toast.success(message, {
          duration: 5000,
          icon: '🏍️',
          position: 'top-center',
          description: estimatedDeliveryTime
            ? `Estimated delivery in ${Math.round(estimatedDeliveryTime / 60)} minutes`
            : undefined
        });

        // Optional: Vibrate device if supported
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      }
    };

    // Listen for custom event from DeliveryTrackingMap
    window.addEventListener('orderStatusNotification', handleOrderStatusNotification);

    return () => {
      window.removeEventListener('orderStatusNotification', handleOrderStatusNotification);
    };
  }, [])

  const handleCancelOrder = () => {
    if (!order) return;

    if (order.status === 'cancelled') {
      toast.error('Order is already cancelled');
      return;
    }

    if (order.status === 'delivered') {
      toast.error('Cannot cancel a delivered order');
      return;
    }

    if (nonCancellableStatuses.has(order.status)) {
      toast.error("This order can no longer be cancelled");
      return;
    }

    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setIsCancelling(true);
    try {
      const response = await orderAPI.cancelOrder(orderId, cancellationReason.trim());
      if (response.data?.success) {
        const paymentMethod = order?.payment?.method || order?.paymentMethod;
        const successMessage = response.data?.message ||
          (paymentMethod === 'cash' || paymentMethod === 'cod'
            ? 'Order cancelled successfully. No refund required as payment was not made.'
            : 'Order cancelled successfully. Refund will be processed after admin approval.');
        toast.success(successMessage);
        setShowCancelDialog(false);
        setCancellationReason("");
        // Refresh order data
        const orderResponse = await orderAPI.getOrderDetails(orderId);
        if (orderResponse.data?.success && orderResponse.data.data?.order) {
          const apiOrder = orderResponse.data.data.order;
          setOrder(apiOrder);
          // Update orderStatus to cancelled
          if (apiOrder.status === 'cancelled') {
            setOrderStatus('cancelled');
          }
        }
      } else {
        toast.error(response.data?.message || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSubmitReview = async () => {
    if (rating === 0) {
      toast.error("Please select a rating")
      return
    }

    try {
      setIsSubmittingReview(true)

      // Prefer MongoDB _id for the review API; fall back to route orderId if needed
      const orderMongoId = order?.mongoId || order?._id || orderId

      const response = await orderAPI.submitOrderReview(String(orderMongoId), {
        rating,
        comment: reviewComment
      })

      if (response.data?.success) {
        toast.success("Review submitted! Thank you for your feedback.")
        setReviewSubmitted(true)
      } else {
        toast.error(response.data?.message || "Failed to submit review")
      }
    } catch (error) {
      console.error("Error submitting review:", error)
      const message = error?.response?.data?.message || "Failed to submit review. Please try again."
      toast.error(message)
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: `Track my order from ${order?.restaurant || 'Tifunbox'}`,
      text: `Hey, I'm tracking my order from ${order?.restaurant || 'the restaurant'} on Tifunbox!`,
      url: window.location.href,
    };

    try {
      const result = await shareContent(shareData);
      if (result.method === "native") {
        toast.success("Shared successfully");
      } else if (result.method === "whatsapp") {
        toast.success("Opening share options");
      } else if (result.method === "clipboard") {
        toast.success("Share link copied");
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Error sharing:", err);
        toast.error("Failed to share");
      }
    }
  };

  const handleCallCustomerPhone = () => {
    const phoneNumber = String(
      order?.userPhone ||
      order?.userId?.phone ||
      profile?.phone ||
      defaultAddress?.phone ||
      "",
    )
      .replace(/[^\d+]/g, "")
      .trim();

    if (!phoneNumber) {
      toast.error("Phone number not available");
      return;
    }

    window.location.href = `tel:${phoneNumber}`;
  };

  const handleCallRestaurant = async () => {
    if (!order) return;
    let restaurantPhone =
      (typeof order.restaurantId === "object" &&
        (order.restaurantId?.primaryContactNumber ||
          order.restaurantId?.phone ||
          order.restaurantId?.contactNumber)) ||
      order.restaurantPhone ||
      "";
    if (!restaurantPhone && order.restaurantId && typeof order.restaurantId === "string") {
      try {
        const res = await restaurantAPI.getRestaurantById(order.restaurantId);
        const r = res?.data?.data?.restaurant;
        restaurantPhone =
          r?.primaryContactNumber || r?.phone || r?.contactNumber || "";
      } catch (e) {
        console.error("Error fetching restaurant for phone:", e);
      }
    }
    restaurantPhone = String(restaurantPhone).replace(/\s/g, "").trim();
    if (!restaurantPhone) {
      toast.error("Restaurant phone number not available");
      return;
    }
    const digits = restaurantPhone.replace(/\D/g, "").slice(-10);
    window.location.href = `tel:${digits}`;
  };

  const handleOpenDeliveryInstructions = () => {
    setDeliveryInstructionsText(order?.deliveryInstructions ?? "");
    setShowDeliveryInstructionsDialog(true);
  };

  const handleOpenDeliveryAddress = () => {
    navigate("/profile/addresses");
  };

  const handleOpenSafety = () => {
    navigate("/profile/report-safety-emergency");
  };

  const handleOpenOrderDetails = () => {
    navigate(`/orders/${orderId}/details`);
  };

  const handleSaveDeliveryInstructions = async () => {
    if (!orderId || !order) return;
    // Prefer snapshot stored at order creation (API returns deliveryAddress, phoneNumber)
    const deliveryAddress =
      order.deliveryAddress?.trim() ||
      order.address?.formattedAddress ||
      [order.address?.street, order.address?.additionalDetails, order.address?.city, order.address?.state, order.address?.zipCode]
        .filter(Boolean)
        .join(", ") ||
      "";
    const phoneNumber =
      (order.phoneNumber && String(order.phoneNumber).trim()) ||
      order.userPhone ||
      order.userId?.phone ||
      profile?.phone ||
      defaultAddress?.phone ||
      "";
    if (!deliveryAddress) {
      toast.error("Delivery address is required to update instructions.");
      return;
    }
    if (!phoneNumber) {
      toast.error("Phone number is required. Please add a phone number in your profile.");
      return;
    }
    setIsSavingInstructions(true);
    try {
      const response = await orderAPI.updateDeliveryDetails(orderId, {
        deliveryAddress: deliveryAddress.trim(),
        phoneNumber: phoneNumber.trim(),
        alternatePhone: order.userId?.alternatePhone || defaultAddress?.alternatePhone || "",
        deliveryInstructions: deliveryInstructionsText.trim(),
      });
      if (response.data?.success) {
        setOrder((prev) => (prev ? { ...prev, deliveryInstructions: deliveryInstructionsText.trim() } : prev));
        setShowDeliveryInstructionsDialog(false);
        toast.success("Delivery instructions updated.");
      } else {
        toast.error(response.data?.message || "Failed to update delivery instructions");
      }
    } catch (err) {
      console.error("Error updating delivery instructions:", err);
      toast.error(err.response?.data?.message || "Failed to update delivery instructions");
    } finally {
      setIsSavingInstructions(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const response = await orderAPI.getOrderDetails(orderId)
      if (response.data?.success && response.data.data?.order) {
        const apiOrder = response.data.data.order

        // Extract restaurant location coordinates with multiple fallbacks
        let restaurantCoords = null;

        // Priority 1: restaurantId.location.coordinates (GeoJSON format: [lng, lat])
        if (apiOrder.restaurantId?.location?.coordinates &&
          Array.isArray(apiOrder.restaurantId.location.coordinates) &&
          apiOrder.restaurantId.location.coordinates.length >= 2) {
          restaurantCoords = apiOrder.restaurantId.location.coordinates;
        }
        // Priority 2: restaurantId.location with latitude/longitude properties
        else if (apiOrder.restaurantId?.location?.latitude && apiOrder.restaurantId?.location?.longitude) {
          restaurantCoords = [apiOrder.restaurantId.location.longitude, apiOrder.restaurantId.location.latitude];
        }
        // Priority 3: Check nested restaurant data
        else if (apiOrder.restaurant?.location?.coordinates) {
          restaurantCoords = apiOrder.restaurant.location.coordinates;
        }
        // Priority 4: Check if restaurantId is a string ID and fetch restaurant details
        else if (typeof apiOrder.restaurantId === 'string') {
          console.log('⚠️ restaurantId is a string ID, fetching restaurant details...', apiOrder.restaurantId);
          try {
            const restaurantResponse = await restaurantAPI.getRestaurantById(apiOrder.restaurantId);
            if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
              const restaurant = restaurantResponse.data.data.restaurant;
              if (restaurant.location?.coordinates && Array.isArray(restaurant.location.coordinates) && restaurant.location.coordinates.length >= 2) {
                restaurantCoords = restaurant.location.coordinates;
                console.log('✅ Fetched restaurant coordinates from API:', restaurantCoords);
              }
            }
          } catch (err) {
            console.error('❌ Error fetching restaurant details:', err);
          }
        }

        const transformedOrder = {
          id: apiOrder.orderId || apiOrder._id,
          mongoId: apiOrder._id,
          restaurant: apiOrder.restaurantName || 'Restaurant',
          restaurantId: apiOrder.restaurantId || null, // Include restaurantId for location access
          userId: apiOrder.userId || null, // Include user data for phone number
          userName: apiOrder.userName || apiOrder.userId?.name || apiOrder.userId?.fullName || '',
          userPhone: apiOrder.userPhone || apiOrder.userId?.phone || '',
          address: {
            street: apiOrder.address?.street || '',
            city: apiOrder.address?.city || '',
            state: apiOrder.address?.state || '',
            zipCode: apiOrder.address?.zipCode || '',
            additionalDetails: apiOrder.address?.additionalDetails || '',
            formattedAddress: apiOrder.address?.formattedAddress ||
              (apiOrder.address?.street && apiOrder.address?.city
                ? `${apiOrder.address.street}${apiOrder.address.additionalDetails ? `, ${apiOrder.address.additionalDetails}` : ''}, ${apiOrder.address.city}${apiOrder.address.state ? `, ${apiOrder.address.state}` : ''}${apiOrder.address.zipCode ? ` ${apiOrder.address.zipCode}` : ''}`
                : apiOrder.address?.city || ''),
            coordinates: apiOrder.address?.location?.coordinates || null
          },
          restaurantLocation: {
            coordinates: restaurantCoords
          },
          items: apiOrder.items?.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            isVeg: deriveOrderItemIsVeg(item),
          })) || [],
          total: apiOrder.pricing?.total || 0,
          status: apiOrder.status || 'pending',
          deliveryPartner: apiOrder.deliveryPartnerId ? {
            name: apiOrder.deliveryPartnerId.name || 'Delivery Partner',
            avatar: null
          } : null,
          tracking: apiOrder.tracking || {},
          deliveryState: apiOrder.deliveryState || null,
          deliveryInstructions: apiOrder.deliveryInstructions || "",
          deliveryAddress: apiOrder.deliveryAddress || undefined,
          phoneNumber: apiOrder.phoneNumber || undefined
        }
        setOrder(transformedOrder)

        // Update order status for UI
        if (apiOrder.status === 'cancelled') {
          setOrderStatus('cancelled');
        } else if (apiOrder.status === 'preparing') {
          setOrderStatus('preparing')
        } else if (apiOrder.status === 'ready') {
          setOrderStatus('prepared')
        } else if (apiOrder.status === 'out_for_delivery') {
          setOrderStatus('pickup')
        } else if (apiOrder.status === 'delivered') {
          setOrderStatus('delivered')
        }
      }
    } catch (err) {
      console.error('Error refreshing order:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </AnimatedPage>
    )
  }

  // Error state
  if (error || !order) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4">Order Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The order you\'re looking for doesn\'t exist.'}</p>
          <Link to="/user/orders">
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </AnimatedPage>
    )
  }

  const statusConfig = {
    placed: {
      title: "Order placed",
      subtitle: "Food preparation will begin shortly",
      color: "bg-red-700"
    },
    preparing: {
      title: "Preparing your order",
      subtitle: `Arriving in ${estimatedTime} mins`,
      color: "bg-red-700"
    },
    prepared: {
      title: "Food is ready",
      subtitle: "Waiting for delivery partner to pick up",
      color: "bg-red-700"
    },
    pickup: {
      title: "Order picked up",
      subtitle: `Arriving in ${estimatedTime} mins`,
      color: "bg-red-700"
    },
    delivered: {
      title: "Order delivered",
      subtitle: "Enjoy your meal!",
      color: "bg-red-600"
    },
    cancelled: {
      title: "Order cancelled",
      subtitle: "This order has been cancelled",
      color: "bg-red-600"
    }
  }

  const currentStatus = statusConfig[orderStatus] || statusConfig.placed

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0a0a0a]">
      {/* Order Confirmed Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white dark:bg-[#1a1a1a] flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-center px-8"
            >
              <AnimatedCheckmark delay={0.3} />
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="text-2xl font-bold text-gray-900 mt-6"
              >
                Order Confirmed!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="text-gray-600 mt-2"
              >
                Your order has been placed successfully
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="mt-8"
              >
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-3">Loading order details...</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Green Header */}
      <motion.div
        className={`${currentStatus.color} text-white sticky top-0 z-40`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/user/orders">
            <motion.button
              className="w-10 h-10 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft className="w-6 h-6" />
            </motion.button>
          </Link>
          <h2 className="font-semibold text-lg">{order.restaurant}</h2>
          <motion.button
            onClick={handleShare}
            className="w-10 h-10 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <Share2 className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Status section */}
        <div className="px-4 pb-4 text-center">
          <motion.h1
            className="text-2xl font-bold mb-3"
            key={currentStatus.title}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {currentStatus.title}
          </motion.h1>

          {/* Status pill */}
          <motion.div
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="text-sm">{currentStatus.subtitle}</span>
            {orderStatus === 'preparing' && (
              <>
                <span className="w-1 h-1 rounded-full bg-white" />
                <span className="text-sm text-red-200">On time</span>
              </>
            )}
            <motion.button
              onClick={handleRefresh}
              className="ml-1"
              animate={{ rotate: isRefreshing ? 360 : 0 }}
              transition={{ duration: 0.5 }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      {/* Map Section */}
      <DeliveryMap
        orderId={orderId}
        order={order}
        isVisible={!showConfirmation && order !== null}
      />

      {/* Scrollable Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 pb-24 md:pb-32">
        {/* Rating Section - Only show when delivered and review not yet submitted */}
        {orderStatus === 'delivered' && !reviewSubmitted && !order?.review?.rating && (
          <motion.div
            className="bg-white rounded-xl p-6 shadow-sm border border-red-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">How was your meal?</h2>
              <p className="text-sm text-gray-500 mt-1">Share your experience with us and {order?.restaurant || 'the restaurant'}</p>
            </div>

            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setRating(star)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`w-10 h-10 ${star <= rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                      }`}
                  />
                </motion.button>
              ))}
            </div>

            <div className="space-y-4">
              <Textarea
                placeholder="Write a review (optional)"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full min-h-[100px] bg-gray-50 border-gray-200 focus:border-red-500 focus:ring-red-500 rounded-xl"
              />

              <Button
                onClick={handleSubmitReview}
                disabled={rating === 0 || isSubmittingReview}
                className="w-full bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-bold transition-all shadow-md active:shadow-sm"
              >
                {isSubmittingReview ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Review Success (if just submitted) */}
        {reviewSubmitted && (
          <motion.div
            className="bg-red-50 border border-red-100 rounded-xl p-6 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-red-900">Feedback Submitted!</h3>
            <p className="text-sm text-red-700 mt-1">Thank you for helping us improve our service.</p>
          </motion.div>
        )}

        {/* Existing review (if already rated and not just submitted) */}
        {order?.review?.rating && !reviewSubmitted && (
          <motion.div
            className="bg-gray-50 border border-gray-100 rounded-xl p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Your Rating</h3>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${star <= order.review.rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                      }`}
                  />
                ))}
              </div>
            </div>
            {order.review.comment && (
              <p className="text-sm text-gray-600 italic">"{order.review.comment}"</p>
            )}
          </motion.div>
        )}

        {/* Food Cooking Status - Show until delivery partner accepts pickup */}
        {(() => {
          // Delivery partner has accepted / picked up only when out_for_delivery or tracking confirms (not when restaurant just marks 'ready')
          const hasAcceptedPickup = order?.tracking?.outForDelivery?.status === true ||
            order?.tracking?.out_for_delivery?.status === true ||
            order?.status === 'out_for_delivery' ||
            order?.deliveryState?.currentPhase === 'en_route_to_delivery' ||
            order?.deliveryState?.currentPhase === 'at_delivery' ||
            order?.deliveryState?.status === 'order_confirmed'

          // Show "Food is Cooking" until delivery partner accepts pickup
          if (!hasAcceptedPickup) {
            return (
              <motion.div
                className="bg-white rounded-xl p-4 shadow-sm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center overflow-hidden">
                    <img
                      src={circleIcon}
                      alt="Food cooking"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="font-semibold text-gray-900">Food is Cooking</p>
                </div>
              </motion.div>
            )
          }

          // Don't show card if delivery partner has accepted pickup
          return null
        })()}

        {/* Delivery Partner Safety */}
        <motion.button
          onClick={handleOpenSafety}
          className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileTap={{ scale: 0.99 }}
        >
          <Shield className="w-6 h-6 text-gray-600" />
          <span className="flex-1 text-left font-medium text-gray-900">
            Learn about delivery partner safety
          </span>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </motion.button>

        {/* Delivery Details Banner */}
        <motion.div
          className="bg-yellow-50 rounded-xl p-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <p className="text-yellow-800 font-medium">
            All your delivery details in one place 👇
          </p>
        </motion.div>

        {/* Contact & Address Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <SectionItem
            icon={Phone}
            title={
              order?.userName ||
              order?.userId?.fullName ||
              order?.userId?.name ||
              profile?.fullName ||
              profile?.name ||
              'Customer'
            }
            subtitle={
              order?.userPhone ||
              order?.userId?.phone ||
              profile?.phone ||
              defaultAddress?.phone ||
              'Phone number not available'
            }
            onClick={handleCallCustomerPhone}
          />
          <SectionItem
            icon={HomeIcon}
            title="Delivery at Location"
            subtitle={(() => {
              // Priority 1: Use order address formattedAddress (live location address)
              if (order?.address?.formattedAddress && order.address.formattedAddress !== "Select location") {
                return order.address.formattedAddress
              }

              // Priority 2: Build full address from order address parts
              if (order?.address) {
                const orderAddressParts = []
                if (order.address.street) orderAddressParts.push(order.address.street)
                if (order.address.additionalDetails) orderAddressParts.push(order.address.additionalDetails)
                if (order.address.city) orderAddressParts.push(order.address.city)
                if (order.address.state) orderAddressParts.push(order.address.state)
                if (order.address.zipCode) orderAddressParts.push(order.address.zipCode)
                if (orderAddressParts.length > 0) {
                  return orderAddressParts.join(', ')
                }
              }

              // Priority 3: Use defaultAddress formattedAddress (live location address)
              if (defaultAddress?.formattedAddress && defaultAddress.formattedAddress !== "Select location") {
                return defaultAddress.formattedAddress
              }

              // Priority 4: Build full address from defaultAddress parts
              if (defaultAddress) {
                const defaultAddressParts = []
                if (defaultAddress.street) defaultAddressParts.push(defaultAddress.street)
                if (defaultAddress.additionalDetails) defaultAddressParts.push(defaultAddress.additionalDetails)
                if (defaultAddress.city) defaultAddressParts.push(defaultAddress.city)
                if (defaultAddress.state) defaultAddressParts.push(defaultAddress.state)
                if (defaultAddress.zipCode) defaultAddressParts.push(defaultAddress.zipCode)
                if (defaultAddressParts.length > 0) {
                  return defaultAddressParts.join(', ')
                }
              }

              return 'Add delivery address'
            })()}
            onClick={handleOpenDeliveryAddress}
          />
          <SectionItem
            icon={MessageSquare}
            title="Add delivery instructions"
            subtitle={order?.deliveryInstructions ? order.deliveryInstructions : ""}
            onClick={handleOpenDeliveryInstructions}
          />
        </motion.div>

        {/* Chat with delivery partner */}
        <motion.button
          onClick={() => navigate(`/orders/${orderId}/chat`)}
          className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 text-left border-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="w-10 h-10 rounded-full bg-[#ff8100]/10 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-[#ff8100]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">Chat with delivery partner</p>
            <p className="text-sm text-gray-500">Message your delivery partner about this order</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </motion.button>

        {/* Restaurant Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <div className="flex items-center gap-3 p-4 border-b border-dashed border-gray-200">
            <div className="w-12 h-12 rounded-full bg-orange-100 overflow-hidden flex items-center justify-center">
              <span className="text-2xl">🍔</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{order.restaurant}</p>
              <p className="text-sm text-gray-500">{order.address?.city || 'Local Area'}</p>
            </div>
            <motion.button
              type="button"
              onClick={handleCallRestaurant}
              className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <Phone className="w-5 h-5 text-red-700" />
            </motion.button>
          </div>

          {/* Order Items */}
          <button
            type="button"
            onClick={handleOpenOrderDetails}
            className="w-full p-4 border-b border-dashed border-gray-200 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <Receipt className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Order #{order?.id || order?.orderId || 'N/A'}</p>
                <div className="mt-2 space-y-1">
                  {order?.items?.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          item.isVeg ? "border-green-600" : "border-red-600"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${item.isVeg ? "bg-green-600" : "bg-red-600"}`}
                        />
                      </span>
                      <span>{item.quantity} x {item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </button>
        </motion.div>

        {/* Help Section */}
        {!nonCancellableStatuses.has(order?.status) && (
          <motion.div
            className="bg-white rounded-xl shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <SectionItem
              icon={CircleSlash}
              title="Cancel order"
              subtitle=""
              onClick={handleCancelOrder}
            />
          </motion.div>
        )}

      </div>

      {/* Delivery Instructions Dialog */}
      <Dialog open={showDeliveryInstructionsDialog} onOpenChange={setShowDeliveryInstructionsDialog}>
        <DialogContent className="sm:max-w-xl w-[95%] max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">
              Add delivery instructions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4 px-2">
            <p className="text-sm text-gray-500">
              Add notes for the delivery partner (e.g. gate code, landmark, leave at door).
            </p>
            <Textarea
              value={deliveryInstructionsText}
              onChange={(e) => setDeliveryInstructionsText(e.target.value)}
              placeholder="e.g. Leave at the security desk, Call when you arrive"
              className="w-full min-h-[100px] resize-none border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-colors disabled:bg-gray-100"
              disabled={isSavingInstructions}
            />
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowDeliveryInstructionsDialog(false)}
                disabled={isSavingInstructions}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveDeliveryInstructions}
                disabled={isSavingInstructions}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isSavingInstructions ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-xl w-[95%] max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">
              Cancel Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-6 px-4">
            <div className="space-y-2 w-full">
              <Textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g., Changed my mind, Wrong address, etc."
                className="w-full min-h-[100px] resize-none border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-200 text-gray-900 dark:text-gray-100"
                disabled={isCancelling}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancellationReason("");
                }}
                disabled={isCancelling}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCancel}
                disabled={isCancelling || !cancellationReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancellation'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
