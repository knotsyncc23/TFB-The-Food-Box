import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Search, MoreVertical, ChevronRight, Star, RotateCcw, AlertCircle, Loader2, Clock } from "lucide-react"
import { orderAPI, api, API_ENDPOINTS } from "@/lib/api"
import { toast } from "sonner"
import { getCompanyNameAsync } from "@/lib/utils/businessSettings"
import { shareContent } from "@/lib/utils/share"

export default function Orders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [ratingModal, setRatingModal] = useState({ open: false, order: null })
  const [activeMenuOrderId, setActiveMenuOrderId] = useState(null)
  const [selectedRating, setSelectedRating] = useState(null)
  const [feedbackText, setFeedbackText] = useState("")
  const [submittingRating, setSubmittingRating] = useState(false)
  const [countdowns, setCountdowns] = useState({})
  // Track orders that have shown rating popup - persist in localStorage
  const [shownRatingForOrders, setShownRatingForOrders] = useState(() => {
    try {
      const stored = localStorage.getItem('shownRatingForOrders')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })
  
  // Save to localStorage whenever shownRatingForOrders changes
  useEffect(() => {
    try {
      localStorage.setItem('shownRatingForOrders', JSON.stringify(Array.from(shownRatingForOrders)))
    } catch (error) {
      console.error('Error saving shownRatingForOrders to localStorage:', error)
    }
  }, [shownRatingForOrders])

  // Calculate countdown for an order
  const calculateCountdown = (order) => {
    if (!order || order.status === 'delivered' || order.status === 'cancelled' || order.status === 'restaurant_cancelled') {
      return null
    }

    const createdAt = new Date(order.createdAt)
    const now = new Date()
    const elapsedMinutes = Math.floor((now - createdAt) / (1000 * 60))
    
    // Get max ETA (use eta.max if available, otherwise estimatedDeliveryTime)
    const maxETA = order.eta?.max || order.estimatedDeliveryTime || 30
    const remainingMinutes = Math.max(0, maxETA - elapsedMinutes)
    
    return remainingMinutes > 0 ? remainingMinutes : null
  }

  // Update countdowns for all active orders
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns = {}
      orders.forEach(order => {
        const remaining = calculateCountdown(order)
        if (remaining !== null) {
          newCountdowns[order.id] = remaining
        }
      })
      setCountdowns(newCountdowns)
    }

    updateCountdowns()
    const interval = setInterval(updateCountdowns, 10000) // Update every 10 seconds for better UX

    return () => clearInterval(interval)
  }, [orders])

  // Get order status text
  const getOrderStatus = (order) => {
    const status = order.status
    if (status === 'delivered' || status === 'completed') return 'delivered'
    if (status === 'out_for_delivery' || status === 'outForDelivery') return 'outForDelivery'
    if (status === 'ready') return 'preparing'
    if (status === 'preparing') return 'preparing'
    if (status === 'confirmed') return 'confirmed'
    return status || 'confirmed'
  }

  // Auto-show rating popup when order is delivered (only once per order)
  useEffect(() => {
    if (orders.length === 0 || ratingModal.open) {
      return
    }

    console.log('🔍 Checking for delivered orders to show rating popup...', {
      totalOrders: orders.length,
      shownRatingForOrders: Array.from(shownRatingForOrders)
    })

    // Find delivered (non-cancelled) orders that haven't been rated and haven't shown popup yet
    const deliveredOrders = orders.filter(order => {
      // Check originalStatus first (from backend), then fallback to transformed status
      const originalStatus = order.originalStatus || order.status || ''
      const transformedStatus = order.status || ''
      
      // Normalize statuses
      const lowerOriginal = originalStatus.toLowerCase()
      const lowerTransformed = transformedStatus.toLowerCase()

      // Treat any cancelled status as NOT reviewable
      const isCancelledStatus =
        lowerOriginal === "cancelled" ||
        lowerOriginal === "canceled" ||
        lowerOriginal === "restaurant_cancelled" ||
        lowerOriginal === "user_cancelled" ||
        lowerTransformed === "cancelled" ||
        lowerTransformed === "canceled" ||
        lowerTransformed === "restaurant_cancelled" ||
        lowerTransformed === "user_cancelled"

      // Check if order is delivered - check both original and transformed status
      const isDelivered = 
        originalStatus === 'delivered' || 
        originalStatus === 'completed' ||
        lowerOriginal === 'delivered' ||
        lowerOriginal === 'completed' ||
        transformedStatus === 'delivered' ||
        transformedStatus === 'completed' ||
        lowerTransformed === 'delivered' ||
        lowerTransformed === 'completed'
      
      // Check if order has rating - check multiple places where rating might be stored
      const hasRating = 
        (order.rating !== null && order.rating !== undefined && order.rating !== '') ||
        (order.review?.rating !== null && order.review?.rating !== undefined) ||
        (order.review !== null && order.review !== undefined)
      
      const orderId = order.id || order._id || order.mongoId
      const hasShownPopup = shownRatingForOrders.has(orderId)
      
      // Also check if order has deliveredAt timestamp (indicates it was delivered)
      const hasDeliveredAt = order.deliveredAt !== null && order.deliveredAt !== undefined
      
      // Never show rating prompt for cancelled orders
      const shouldShow = !isCancelledStatus && (isDelivered || hasDeliveredAt) && !hasRating && !hasShownPopup
      
      console.log(`📦 Order ${orderId}:`, {
        originalStatus,
        transformedStatus,
        isDelivered,
        hasDeliveredAt,
        isCancelledStatus,
        hasRating,
        rating: order.rating,
        review: order.review,
        hasShownPopup,
        shouldShow
      })
      
      return shouldShow
    })

    console.log('✅ Found delivered orders needing rating:', deliveredOrders.length)

    // Show popup for the first delivered order that needs rating
    if (deliveredOrders.length > 0) {
      const orderToRate = deliveredOrders[0]
      const orderId = orderToRate.id || orderToRate._id || orderToRate.mongoId
      
      console.log('🎯 Showing rating popup for order:', {
        orderId,
        restaurant: orderToRate.restaurant,
        status: orderToRate.status
      })
      
      // Mark as shown to prevent multiple popups (before showing to prevent race conditions)
      setShownRatingForOrders(prev => new Set([...prev, orderId]))
      
      // Small delay to ensure smooth UX
      setTimeout(() => {
        console.log('✨ Opening rating modal for order:', {
          orderId: orderId,
          restaurant: orderToRate.restaurant,
          status: orderToRate.status,
          originalStatus: orderToRate.originalStatus
        })
        setRatingModal({ open: true, order: orderToRate })
        setSelectedRating(null)
        setFeedbackText("")
      }, 800) // Show after 0.8 seconds
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, shownRatingForOrders, ratingModal.open])

  // Fetch orders from backend API
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        
        const response = await orderAPI.getOrders({
          limit: 100, // Get all orders
          page: 1
        })
        
        // Check multiple possible response structures
        let ordersData = []
        
        if (response?.data?.success && response?.data?.data?.orders) {
          ordersData = response.data.data.orders || []
        } else if (response?.data?.orders) {
          ordersData = response.data.orders || []
        } else if (response?.data?.data && Array.isArray(response.data.data)) {
          ordersData = response.data.data || []
        } else {
          setOrders([])
          return
        }
        
        if (ordersData.length > 0) {
          console.log('📦 Raw orders from API:', ordersData.slice(0, 3).map(o => ({
            id: o.orderId || o._id,
            status: o.status,
            rating: o.rating || o.review?.rating,
            deliveredAt: o.deliveredAt,
            restaurant: o.restaurantId?.name || o.restaurantName
          })))
          
          // Transform API orders to match UI structure
          const transformedOrders = ordersData.map(order => {
            const createdAt = order.createdAt ? new Date(order.createdAt) : new Date()
            
            // Check if cancelled by restaurant or user
            const isCancelled = order.status === 'cancelled'
            const cancellationReason = order.cancellationReason || ''
            // Check cancelledBy field first, then fallback to cancellation reason pattern
            const isRestaurantCancelled = isCancelled && (
              order.cancelledBy === 'restaurant' ||
              /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue|order not accepted within time limit|restaurant did not respond/i.test(cancellationReason)
            )
            const isUserCancelled = isCancelled && order.cancelledBy === 'user'

            // Get original status from backend before transformation
            const originalStatus = order.status
            
            return {
              id: order.orderId || order._id?.toString() || `ORD-${order._id}`,
              mongoId: order._id,
              orderId: order.orderId || order._id?.toString(), // Keep orderId for display
              status: isRestaurantCancelled ? 'restaurant_cancelled' : getOrderStatus(order),
              originalStatus: originalStatus, // Keep original status for reference
              createdAt: createdAt.toISOString(),
              address: order.address || {},
              items: (order.items || []).map(item => {
                const foodType = item.foodType || item.variationFoodType
                const isVeg =
                  typeof foodType === "string"
                    ? foodType.toLowerCase() === "veg"
                    : item.isVeg !== undefined
                      ? item.isVeg
                      : (item.category === "veg" || item.type === "veg")

                return {
                  itemId: item.itemId || item._id || item.id,
                  name: item.name || item.foodName || "Item",
                  quantity: item.quantity || 1,
                  price: item.price || 0,
                  image: item.image || null,
                  description: item.description || null,
                  isVeg,
                  _id: item._id || item.id,
                  id: item.id || item._id,
                  foodType: foodType || null,
                }
              }),
              total: order.pricing?.total || order.total || 0,
              subtotal: order.pricing?.subtotal || 0,
              deliveryFee: order.pricing?.deliveryFee || 0,
              tax: order.pricing?.tax || 0,
              pricing: order.pricing || {}, // Keep full pricing object for discounts, coupons
              payment: order.payment || {},
              paymentMethod: order.payment?.method || order.paymentMethod,
              restaurant: order.restaurantId?.name || order.restaurantName || 'Restaurant',
              restaurantId: order.restaurantId?._id || order.restaurantId,
              restaurantImage: order.restaurantId?.profileImage?.url || order.restaurantId?.profileImage || null,
              restaurantLocation: order.restaurantId?.location?.area || order.restaurantId?.location?.city || order.address?.city || '',
              rating: order.rating || order.review?.rating || null, // Check both rating and review.rating
              review: order.review || null,
              tracking: order.tracking || {},
              cancellationReason: cancellationReason,
              isRestaurantCancelled: isRestaurantCancelled,
              isUserCancelled: isUserCancelled,
              cancelledBy: order.cancelledBy,
              eta: order.eta || { min: order.estimatedDeliveryTime || 30, max: order.estimatedDeliveryTime || 30 },
              estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
              preparationTime: order.preparationTime || 0,
              deliveredAt: order.deliveredAt || null,
              deliveryPartnerName: order.deliveryPartnerId?.name || order.deliveryPartnerName || null,
              deliveryPartnerPhone: order.deliveryPartnerId?.phone || order.deliveryPartnerPhone || null,
              note: order.note || null
            }
          })
          
          // Sort by date (newest first)
          transformedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          
          console.log('✅ Orders fetched and transformed:', {
            total: transformedOrders.length,
            delivered: transformedOrders.filter(o => o.status === 'delivered' || o.originalStatus === 'delivered').length,
            withRating: transformedOrders.filter(o => o.rating).length,
            sample: transformedOrders.slice(0, 2).map(o => ({
              id: o.id,
              status: o.status,
              originalStatus: o.originalStatus,
              rating: o.rating,
              deliveredAt: o.deliveredAt
            }))
          })
          
          setOrders(transformedOrders)
        } else {
          console.log('⚠️ No orders data in response')
          setOrders([])
        }
      } catch (error) {
        console.error('Error fetching user orders:', error)
        let errorMessage = 'Failed to load orders'
        if (error?.response?.status === 401) {
          errorMessage = 'Please login to view your orders'
        } else if (error?.response?.data?.message) {
          errorMessage = error.response.data.message
        }
        toast.error(errorMessage)
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
    
    // Poll for order updates every 20 seconds to detect delivered orders
    // This ensures rating popup shows quickly when order is delivered
    const pollInterval = setInterval(() => {
      fetchOrders()
    }, 20000) // Poll every 20 seconds

    return () => clearInterval(pollInterval)
  }, [])

  // Format date helper
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    
    return `${day} ${month}, ${displayHours}:${minutes}${ampm}`
  }

  // Filter orders based on search query
  const filteredOrders = orders.filter(order => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase()
    const restaurantMatch = order.restaurant?.toLowerCase().includes(query)
    const itemsMatch = order.items.some(item => 
      (item.name || item.foodName || '').toLowerCase().includes(query)
    )
    
    return restaurantMatch || itemsMatch
  })

  // Handle reorder - open View Details page of order
  const handleReorder = (order) => {
    navigate(`/user/orders/${order.id}/details`)
  }

  // Three-dots menu handlers
  const toggleMenuForOrder = (orderId) => {
    setActiveMenuOrderId((current) => (current === orderId ? null : orderId))
  }

  const handleShareRestaurant = async (order) => {
    const companyName = await getCompanyNameAsync()
    const location =
      order.restaurantLocation ||
      `${order.address?.city || ""}, ${order.address?.state || ""}`.trim()

    const shareText = `Check out ${order.restaurant} on ${companyName}.
Location: ${location || "Location not available"}
Order again from this restaurant in the ${companyName} app.`

    try {
      const result = await shareContent({
        title: order.restaurant,
        text: shareText,
      })
      if (result.method === "whatsapp") {
        toast.success("Opening share options")
      } else if (result.method === "clipboard") {
        toast.success("Restaurant details copied to clipboard")
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Error sharing restaurant:", error)
        toast.error("Failed to share restaurant")
      }
    } finally {
      setActiveMenuOrderId(null)
    }
  }

  const handleViewOrderDetails = (order) => {
    setActiveMenuOrderId(null)
    navigate(`/user/orders/${order.id}/details`)
  }

  // Open rating modal for an order
  const handleOpenRating = (order) => {
    setRatingModal({ open: true, order })
    setSelectedRating(order.rating || null)
    setFeedbackText("")
  }

  const handleCloseRating = () => {
    setRatingModal({ open: false, order: null })
    setSelectedRating(null)
    setFeedbackText("")
  }

  // Submit rating & feedback to backend
  const handleSubmitRating = async () => {
    if (!ratingModal.order || selectedRating === null) {
      toast.error("Please select a rating first")
      return
    }

    try {
      setSubmittingRating(true)

      const order = ratingModal.order
      const orderMongoId = order.mongoId || order._id

      // Submit to order review API so the restaurant sees the correct rating and comment
      if (orderMongoId) {
        try {
          await orderAPI.submitOrderReview(String(orderMongoId), {
            rating: selectedRating,
            comment: feedbackText?.trim() || "",
          })
        } catch (reviewErr) {
          const reviewMsg = reviewErr?.response?.data?.message || ""
          if (reviewErr?.response?.status === 400 && reviewMsg.toLowerCase().includes("already")) {
            // Already reviewed – treat as success, don't block
          } else {
            throw reviewErr
          }
        }
      }

      await api.post(API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE_CREATE, {
        rating: selectedRating,
        module: "user",
        restaurantId: order.restaurantId || null,
        metadata: {
          orderId: order.id,
          orderMongoId: order.mongoId,
          orderTotal: order.total,
          restaurantName: order.restaurant,
          comment: feedbackText || undefined,
        },
      })

      // Update local state so UI shows "You rated"
      setOrders(prev =>
        prev.map(o =>
          o.id === order.id ? { 
            ...o, 
            rating: selectedRating,
            review: { rating: selectedRating, comment: feedbackText || undefined }
          } : o
        )
      )

      toast.success("Thanks for rating your order! 🎉")
      
      // Mark this order as rated so popup doesn't show again (before closing modal)
      const orderId = order.id || order._id || order.mongoId
      setShownRatingForOrders(prev => new Set([...prev, orderId]))
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(`orderRated_${orderId}`, "true")
        }
      } catch {}
      
      handleCloseRating()
    } catch (error) {
      console.error("Error submitting order rating:", error)

      const message = error?.response?.data?.message

      // If backend says already rated, treat as success and prevent re‑rating
      if (error?.response?.status === 400 && message === "You have already rated this order") {
        const order = ratingModal.order
        const orderId = order.id || order._id || order.mongoId
        setShownRatingForOrders(prev => new Set([...prev, orderId]))
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(`orderRated_${orderId}`, "true")
          }
        } catch {}
        toast.info("You have already rated this order.")
        handleCloseRating()
        return
      }

      toast.error(
        message || "Failed to submit rating. Please try again."
      )
    } finally {
      setSubmittingRating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-10">
        <div className="bg-white p-4 flex items-center shadow-sm sticky top-0 z-10">
          <Link to="/user">
            <ArrowLeft className="w-6 h-6 text-gray-700 cursor-pointer" />
          </Link>
          <h1 className="ml-4 text-xl font-semibold text-gray-800">Your Orders</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-10">
        <div className="bg-white p-4 flex items-center shadow-sm sticky top-0 z-10">
          <Link to="/user">
            <ArrowLeft className="w-6 h-6 text-gray-700 cursor-pointer" />
          </Link>
          <h1 className="ml-4 text-xl font-semibold text-gray-800">Your Orders</h1>
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-gray-600">You haven't placed any orders yet</p>
          <Link to="/user">
            <button className="mt-4 text-red-500 font-medium">Start Ordering</button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10 font-sans">
      {/* Header */}
      <div className="bg-white p-4 flex items-center shadow-sm sticky top-0 z-10">
        <Link to="/user">
          <ArrowLeft className="w-6 h-6 text-gray-700 cursor-pointer" />
        </Link>
        <h1 className="ml-4 text-xl font-semibold text-gray-800">Your Orders</h1>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white mt-1">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
          <Search className="w-5 h-5 text-red-500" />
          <input 
            type="text" 
            placeholder="Search by restaurant or dish" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 ml-3 outline-none text-gray-600 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 py-2 space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-600">No orders found matching your search</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            // Check payment method - COD/wallet orders have 'pending' status which is normal
            const isCodOrWallet = order.payment?.method === 'cash' || 
                                 order.payment?.method === 'cod' || 
                                 order.payment?.method === 'wallet' ||
                                 order.paymentMethod === 'cash' ||
                                 order.paymentMethod === 'cod' ||
                                 order.paymentMethod === 'wallet'
            
            // Payment failed only for online payments (razorpay) that actually failed
            // Don't show payment failed for COD/wallet or cancelled orders
            const isCancelled = order.status === 'cancelled' || order.status === 'restaurant_cancelled'
            const paymentFailed = !isCodOrWallet && 
                                 !isCancelled && 
                                 (order.payment?.status === 'failed')
            
            const isDelivered = order.status === 'delivered'
            const isRestaurantCancelled = order.isRestaurantCancelled || order.status === 'restaurant_cancelled'
            const isUserCancelled = order.isUserCancelled || (isCancelled && order.cancelledBy === 'user')
            // Prefer food image from first item; fallback to restaurant image, then generic food photo
            const firstItemImage = order.items?.[0]?.image
            const restaurantImage = firstItemImage 
              || order.restaurantImage 
              || "https://images.unsplash.com/photo-1604908176997-125188eb3c52?auto=format&fit=crop&w=200&q=80"
            const location = order.restaurantLocation || `${order.address?.city || ''}, ${order.address?.state || ''}`.trim() || 'Location not available'

            return (
              <div key={order.id} className="relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card Header: Restaurant Info */}
                <div className="flex items-start justify-between p-4 pb-2">
                  <div className="flex gap-3">
                    {/* Restaurant Image */}
                    <div className="w-14 h-14 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                      <img 
                        src={restaurantImage} 
                        alt={order.restaurant} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=100&q=80"
                        }}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 text-lg leading-tight">{order.restaurant}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{location}</p>
                      {order.orderId && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">#{order.orderId}</p>
                      )}
                      {order.deliveryPartnerName && (
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-medium">Delivery:</span> {order.deliveryPartnerName}
                          {order.deliveryPartnerPhone && ` • ${order.deliveryPartnerPhone}`}
                        </p>
                      )}
                      {order.restaurantId && (
                        <Link to={`/user/restaurants/${order.restaurantId}`}>
                          <button className="text-xs text-red-500 font-medium flex items-center mt-1 hover:text-red-600">
                            View menu <span className="ml-0.5">▸</span>
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => toggleMenuForOrder(order.id)}
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Three-dots dropdown menu */}
                {activeMenuOrderId === order.id && (
                  <div className="absolute right-3 top-10 z-20 w-40 rounded-xl bg-white shadow-lg border border-gray-100 py-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleShareRestaurant(order)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-800"
                    >
                      Share restaurant
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewOrderDetails(order)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-800"
                    >
                      Order details
                    </button>
                  </div>
                )}

                {/* Separator */}
                <div className="border-t border-dashed border-gray-200 mx-4 my-1"></div>

                {/* Items List */}
                <div className="px-4 py-2 space-y-2">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => {
                      const isVeg = item.isVeg !== undefined ? item.isVeg : (item.category === 'veg' || item.type === 'veg')
                      const itemName = item.name || item.foodName || 'Item'
                      const itemQuantity = item.quantity || 1
                      const itemPrice = item.price || 0
                      const itemTotal = itemQuantity * itemPrice
                      const itemImage = item.image || null
                      
                      return (
                        <div key={item._id || item.id || item.itemId || idx} className="flex items-start gap-3">
                          {/* Item Image */}
                          {itemImage && (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                              <img 
                                src={itemImage} 
                                alt={itemName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              {/* Veg/Non-Veg Icon */}
                              {/* Veg/Non-Veg indicator (Veg = green, Non-Veg = red) */}
                              <div
                                className={`w-4 h-4 border ${
                                  isVeg ? "border-green-600" : "border-red-600"
                                } flex items-center justify-center p-[2px] flex-shrink-0 mt-0.5`}
                              >
                                <div
                                  className={`w-full h-full rounded-full ${
                                    isVeg ? "bg-green-600" : "bg-red-600"
                                  }`}
                                ></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-800 font-medium block">
                                  {itemQuantity} x {itemName}
                                </span>
                                {item.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="text-sm font-semibold text-gray-800">₹{itemTotal.toFixed(2)}</span>
                                {itemQuantity > 1 && (
                                  <p className="text-xs text-gray-500">₹{itemPrice.toFixed(2)} each</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-gray-500">No items found</p>
                  )}
                </div>

                {/* Order Summary */}
                <div className="px-4 py-3 bg-gray-50 rounded-lg mx-4 mb-2">
                  <div className="space-y-1.5">
                    {order.subtotal > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="text-gray-800 font-medium">₹{order.subtotal.toFixed(2)}</span>
                      </div>
                    )}
                    {order.deliveryFee > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Delivery Fee</span>
                        <span className="text-gray-800 font-medium">₹{order.deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    {order.tax > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Tax</span>
                        <span className="text-gray-800 font-medium">₹{order.tax.toFixed(2)}</span>
                      </div>
                    )}
                    {order.pricing?.discount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-red-600">Discount</span>
                        <span className="text-red-600 font-medium">-₹{order.pricing.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {order.pricing?.couponCode && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Coupon Applied</span>
                        <span className="text-gray-800 font-medium">{order.pricing.couponCode}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-1.5 mt-1.5">
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold text-gray-800">Total</span>
                        <span className="text-base font-bold text-gray-900">₹{order.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Date and Payment Info */}
                <div className="px-4 py-2 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400">Order placed on {formatDate(order.createdAt)}</p>
                    {order.deliveredAt && (
                      <p className="text-xs text-gray-400 mt-0.5">Delivered on {formatDate(order.deliveredAt)}</p>
                    )}
                    {order.payment && (
                      <p className="text-xs text-gray-500 mt-1">
                        Payment: <span className="font-medium capitalize">
                          {order.payment.method === 'cash' || order.payment.method === 'cod' ? 'Cash on Delivery' :
                           order.payment.method === 'wallet' ? 'Wallet' :
                           order.payment.method === 'razorpay' ? 'Online' :
                           order.payment.method || 'N/A'}
                        </span>
                        {order.payment.status && (
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            order.payment.status === 'completed' ? 'bg-red-100 text-red-700' :
                            order.payment.status === 'failed' ? 'bg-red-100 text-red-700' :
                            order.payment.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {order.payment.status}
                          </span>
                        )}
                      </p>
                    )}
                    {isDelivered && !paymentFailed && (
                      <p className="text-xs font-medium text-red-600 mt-1">✓ Delivered</p>
                    )}
                    {isRestaurantCancelled && (
                      <p className="text-xs font-medium text-red-500 mt-1">✗ Restaurant Cancelled</p>
                    )}
                    {isUserCancelled && (
                      <p className="text-xs font-medium text-gray-500 mt-1">✗ Cancelled by you</p>
                    )}
                    {isCancelled && !isRestaurantCancelled && !isUserCancelled && (
                      <p className="text-xs font-medium text-gray-500 mt-1">✗ Cancelled</p>
                    )}
                  </div>
                  <div className="flex items-center ml-4">
                    <Link to={`/user/orders/${order.id}/details`}>
                      <button className="text-xs text-red-500 font-medium hover:text-red-600 flex items-center gap-1">
                        View Details
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>
                </div>

                {/* Separator */}
                <div className="border-t border-gray-100 mx-4"></div>

                {/* Card Footer: Actions */}
                <div className="px-4 py-3 flex items-center justify-between">
                  {/* Left Side: Rating or Error */}
                  {isRestaurantCancelled ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="bg-red-100 p-1 rounded-full">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <span className="text-xs font-semibold text-red-500">Restaurant Cancelled</span>
                      </div>
                      <p className="text-xs text-gray-600 ml-7">Refund will be processed in 24-48 hours</p>
                    </div>
                  ) : paymentFailed ? (
                    <div className="flex items-center gap-2">
                      <div className="bg-red-100 p-1 rounded-full">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      </div>
                      <span className="text-xs font-semibold text-red-500">Payment failed</span>
                    </div>
                  ) : isDelivered && (order.rating || (() => {
                    try {
                      if (typeof window === "undefined" || !window.localStorage) return false
                      const orderId = order.id || order._id || order.mongoId
                      if (!orderId) return false
                      return window.localStorage.getItem(`orderRated_${orderId}`) === "true"
                    } catch {
                      return false
                    }
                  })()) ? (
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-gray-800">You rated</span>
                        <div className="flex bg-yellow-400 text-white px-1 rounded text-[10px] items-center gap-0.5 h-4">
                          {(order.rating || 5)}<Star className="w-2 h-2 fill-current" />
                        </div>
                      </div>
                    </div>
                  ) : isDelivered ? (
                    <div>
                      <p className="text-xs text-gray-500">Order delivered</p>
                      <button
                        type="button"
                        onClick={() => handleOpenRating(order)}
                        className="text-xs text-red-500 font-medium mt-0.5 flex items-center"
                      >
                        Rate order <span className="ml-0.5">▸</span>
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-500">{order.status === 'preparing' ? 'Preparing' : order.status === 'outForDelivery' ? 'Out for delivery' : order.status === 'confirmed' ? 'Order confirmed' : ''}</p>
                      {/* Countdown Timer */}
                      {countdowns[order.id] && countdowns[order.id] > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-orange-600 font-medium">
                          <Clock size={12} />
                          <span>{countdowns[order.id]} min{countdowns[order.id] !== 1 ? 's' : ''} remaining</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Right Side: Reorder Button */}
                  {isDelivered && !paymentFailed && (
                    <button 
                      onClick={() => handleReorder(order)}
                      className="bg-[#E23744] hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reorder
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Branding */}
      <div className="flex justify-center mt-8 mb-4">
        <h1 className="text-4xl font-black text-gray-200 tracking-tighter italic">appzeto</h1>
      </div>

      {/* Rating & Feedback Modal */}
      {ratingModal.open && ratingModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-[#E23744] to-red-600 px-6 py-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Star className="w-5 h-5 fill-white" />
                  Rate Your Order
                </h2>
                <button
                  type="button"
                  onClick={handleCloseRating}
                  className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>
              <p className="text-sm text-white/90">
                {ratingModal.order.restaurant} • Order #{ratingModal.order.id}
              </p>
            </div>

            <div className="px-6 py-6">
              {/* Star rating (1–5) */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-900 mb-4 text-center">
                  How was your overall experience?
                </p>
                <div className="flex items-center justify-center gap-2 mb-3">
                  {Array.from({ length: 5 }, (_, i) => i + 1).map((num) => {
                    const isActive = (selectedRating || 0) >= num
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSelectedRating(num)}
                        className="p-2 transition-transform hover:scale-125 active:scale-95"
                      >
                        <Star
                          className={`w-10 h-10 transition-all ${
                            isActive
                              ? "text-yellow-400 fill-yellow-400 drop-shadow-lg"
                              : "text-gray-300 hover:text-yellow-200"
                          }`}
                        />
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between mt-2 px-2">
                  <span className="text-xs text-red-500 font-medium">Poor</span>
                  <span className="text-xs text-gray-400">Average</span>
                  <span className="text-xs text-red-600 font-medium">Excellent</span>
                </div>
                {selectedRating && (
                  <p className="text-center mt-3 text-sm font-medium text-gray-700">
                    {selectedRating === 5 && "⭐⭐⭐⭐⭐ Excellent!"}
                    {selectedRating === 4 && "⭐⭐⭐⭐ Great!"}
                    {selectedRating === 3 && "⭐⭐⭐ Good"}
                    {selectedRating === 2 && "⭐⭐ Fair"}
                    {selectedRating === 1 && "⭐ Poor"}
                  </p>
                )}
              </div>

              {/* Feedback textarea */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Share your feedback <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E23744] focus:border-[#E23744] resize-none transition-all"
                  placeholder="What did you like or dislike about this order? Share your experience..."
                />
                <p className="text-xs text-gray-400 mt-1">Your feedback helps us improve our service</p>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                disabled={submittingRating || selectedRating === null}
                onClick={handleSubmitRating}
                className="w-full rounded-xl bg-gradient-to-r from-[#E23744] to-red-600 text-white text-base font-bold py-3.5 hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
              >
                {submittingRating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Star className="w-5 h-5 fill-white" />
                    Submit Rating
                  </>
                )}
              </button>
              
              {selectedRating === null && (
                <p className="text-xs text-center text-red-500 mt-2">Please select a rating to continue</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
