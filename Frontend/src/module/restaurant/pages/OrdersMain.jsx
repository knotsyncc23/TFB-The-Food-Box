import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { checkOnboardingStatus } from "../utils/onboardingUtils"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import { Printer, Volume2, VolumeX, ChevronDown, ChevronUp, Minus, Plus, X, AlertCircle, Loader2, Calendar, Clock, Users, MessageSquare, Check, Info } from "lucide-react"
import { toast } from "sonner"
import BottomNavOrders from "../components/BottomNavOrders"
import RestaurantNavbar from "../components/RestaurantNavbar"
import notificationSound from "@/assets/audio/alert.mp3"
import { restaurantAPI, diningAPI } from "@/lib/api"
import { useRestaurantNotifications } from "../hooks/useRestaurantNotifications"
import { getWebNotificationPermission, registerFcmTokenForRestaurant } from "@/lib/notifications/fcmWeb"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

const STORAGE_KEY = "restaurant_online_status"

// Top filter tabs
const filterTabs = [
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "out-for-delivery", label: "Out for delivery" },
  { id: "scheduled", label: "Scheduled" },
  { id: "table-booking", label: "Table Booking" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
]

const getDeliveryPhaseFlags = (order) => {
  const status = (order?.status || "").toLowerCase()
  const phase = (order?.deliveryState?.currentPhase || "").toLowerCase()
  const trackingOut =
    order?.tracking?.out_for_delivery?.status === true ||
    order?.tracking?.outForDelivery?.status === true ||
    order?.tracking?.outForDelivery?.timestamp

  const isDelivered =
    status === "delivered" ||
    status === "completed" ||
    phase === "completed" ||
    phase === "delivered"

  const isOutForDelivery =
    status === "out_for_delivery" ||
    status === "out-for-delivery" ||
    phase === "en_route_to_delivery" ||
    phase === "at_delivery" ||
    phase === "picked_up" ||
    phase === "pickedup" ||
    trackingOut

  return { isDelivered, isOutForDelivery }
}

// Completed Orders List Component
function CompletedOrders({ onSelectOrder }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let intervalId = null

    const fetchOrders = async () => {
      try {
        const response = await restaurantAPI.getOrders()

        if (!isMounted) return

        if (response.data?.success && response.data.data?.orders) {
          const completedOrders = response.data.data.orders.filter(order => {
            const { isDelivered } = getDeliveryPhaseFlags(order)
            const status = (order.status || "").toLowerCase()
            return isDelivered || status === 'delivered' || status === 'completed'
          })

          const transformedOrders = completedOrders.map(order => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || 'delivered',
            customerName: order.userId?.name || 'Customer',
            type: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Express Delivery',
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            deliveredAt: order.deliveredAt || order.updatedAt || order.createdAt,
            itemsSummary: order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'No items',
            items: order.items || [],
            photoUrl: order.items?.[0]?.image || null,
            photoAlt: order.items?.[0]?.name || 'Order',
            amount: order.pricing?.total || order.total || 0
          }))

          transformedOrders.sort((a, b) => {
            const dateA = new Date(a.deliveredAt)
            const dateB = new Date(b.deliveredAt)
            return dateB - dateA
          })

          if (isMounted) {
            setOrders(transformedOrders)
            setLoading(false)
          }
        } else {
          if (isMounted) {
            setOrders([])
            setLoading(false)
          }
        }
      } catch (error) {
        if (!isMounted) return

        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error('Error fetching completed orders:', error)
        }

        if (isMounted) {
          setOrders([])
          setLoading(false)
        }
      }
    }

    fetchOrders()
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchOrders()
      }
    }, 10000)

    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">Completed orders</h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">
          Completed orders
        </h2>
        <span className="text-xs text-gray-500">{orders.length} total</span>
      </div>
      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No completed orders yet
        </div>
      ) : (
        <div>
          {orders.map((order) => {
            const deliveredDate = order.deliveredAt
              ? new Date(order.deliveredAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
              : 'N/A'

            return (
              <div key={order.orderId || order.mongoId} className="w-full bg-white rounded-2xl p-4 mb-3 border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-all">
                <button
                  type="button"
                  onClick={() =>
                    onSelectOrder?.({
                      orderId: order.orderId,
                      status: 'Delivered',
                      customerName: order.customerName,
                      type: order.type,
                      tableOrToken: order.tableOrToken,
                      timePlaced: deliveredDate,
                      itemsSummary: order.itemsSummary,
                    })
                  }
                  className="w-full text-left flex gap-3 items-start"
                >
                  <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 my-auto">
                    {order.photoUrl ? (
                      <img
                        src={order.photoUrl}
                        alt={order.photoAlt}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-2">
                        <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">
                          {order.photoAlt}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-h-[80px]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-black leading-tight">
                          Order #{order.orderId}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {order.customerName}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border border-red-500 text-red-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          Delivered
                        </span>
                        <span className="text-[11px] text-gray-500 text-right">
                          {deliveredDate}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <p className="text-xs text-gray-600 line-clamp-1">
                        {order.itemsSummary}
                      </p>
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-gray-500">
                          {order.type}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] text-gray-500">Amount</span>
                        <span className="text-xs font-medium text-black">
                          ₹{order.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Cancelled Orders List Component
function CancelledOrders({ onSelectOrder }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let intervalId = null

    const fetchOrders = async () => {
      try {
        const response = await restaurantAPI.getOrders()

        if (!isMounted) return

        if (response.data?.success && response.data.data?.orders) {
          // Filter cancelled orders (both restaurant and user cancelled)
          const cancelledOrders = response.data.data.orders.filter(
            order => order.status === 'cancelled'
          )

          const transformedOrders = cancelledOrders.map(order => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || 'cancelled',
            customerName: order.userId?.name || 'Customer',
            type: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Express Delivery',
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            cancelledAt: order.cancelledAt || order.updatedAt || order.createdAt,
            cancelledBy: order.cancelledBy || 'unknown',
            cancellationReason: order.cancellationReason || 'No reason provided',
            itemsSummary: order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'No items',
            items: order.items || [],
            photoUrl: order.items?.[0]?.image || null,
            photoAlt: order.items?.[0]?.name || 'Order',
            amount: order.pricing?.total || order.total || 0
          }))

          transformedOrders.sort((a, b) => {
            const dateA = new Date(a.cancelledAt)
            const dateB = new Date(b.cancelledAt)
            return dateB - dateA
          })

          if (isMounted) {
            setOrders(transformedOrders)
            setLoading(false)
          }
        } else {
          if (isMounted) {
            setOrders([])
            setLoading(false)
          }
        }
      } catch (error) {
        if (!isMounted) return

        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error('Error fetching cancelled orders:', error)
        }

        if (isMounted) {
          setOrders([])
          setLoading(false)
        }
      }
    }

    fetchOrders()
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchOrders()
      }
    }, 10000)

    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">Cancelled orders</h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">
          Cancelled orders
        </h2>
        <span className="text-xs text-gray-500">{orders.length} total</span>
      </div>
      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No cancelled orders yet
        </div>
      ) : (
        <div>
          {orders.map((order) => {
            const cancelledDate = order.cancelledAt
              ? new Date(order.cancelledAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
              : 'N/A'

            const cancelledByText = order.cancelledBy === 'user'
              ? 'Cancelled by User'
              : order.cancelledBy === 'restaurant'
                ? 'Cancelled by Restaurant'
                : 'Cancelled'

            return (
              <div key={order.orderId || order.mongoId} className="w-full bg-white rounded-2xl p-4 mb-3 border border-gray-200">
                <button
                  type="button"
                  onClick={() =>
                    onSelectOrder?.({
                      orderId: order.orderId,
                      status: 'Cancelled',
                      customerName: order.customerName,
                      type: order.type,
                      tableOrToken: order.tableOrToken,
                      timePlaced: cancelledDate,
                      itemsSummary: order.itemsSummary,
                    })
                  }
                  className="w-full text-left flex gap-3 items-stretch"
                >
                  <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 my-auto">
                    {order.photoUrl ? (
                      <img
                        src={order.photoUrl}
                        alt={order.photoAlt}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-2">
                        <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">
                          {order.photoAlt}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-h-[80px]">
                    <div className="flex flex-col gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-black leading-tight truncate">
                          Order #{order.orderId}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1 truncate">
                          {order.customerName}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${order.cancelledBy === 'user'
                          ? 'border-orange-500 text-orange-600'
                          : 'border-red-500 text-red-600'
                          }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${order.cancelledBy === 'user' ? 'bg-orange-500' : 'bg-red-500'
                            }`} />
                          <span className="truncate max-w-[110px]">{cancelledByText}</span>
                        </span>
                        <span className="text-[10px] text-gray-500 leading-tight whitespace-nowrap">
                          {cancelledDate}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {order.itemsSummary}
                      </p>
                      {order.cancellationReason && (
                        <p className="text-[10px] text-red-600/90 mt-1 line-clamp-2">
                          {order.cancellationReason}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-gray-500">
                          {order.type}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] text-gray-500">Amount</span>
                        <span className="text-xs font-medium text-black">
                          ₹{order.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Table Bookings List Component
function TableBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const fetchBookings = async () => {
      try {
        const res = await restaurantAPI.getCurrentRestaurant()
        const restaurant = res.data?.data?.restaurant || res.data?.restaurant || res.data?.data
        const restaurantId = restaurant?._id || restaurant?.id

        if (restaurantId) {
          const response = await diningAPI.getRestaurantBookings(restaurantId)
          if (isMounted && response.data.success) {
            const sortedBookings = [...response.data.data].sort((a, b) => b._id.localeCompare(a._id))
            setBookings(sortedBookings)
          }
        }
      } catch (error) {
        console.error("Error fetching table bookings:", error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchBookings()
    const interval = setInterval(fetchBookings, 10000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  if (loading) return <div className="text-center py-10 text-gray-400">Loading bookings...</div>

  return (
    <div className="pt-4 pb-6 px-1">
      <div className="flex items-baseline justify-between mb-4 px-1">
        <h2 className="text-base font-semibold text-black">Table Bookings</h2>
        <span className="text-xs text-gray-500">{bookings.length} total</span>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-400 text-sm">No table bookings yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(booking => (
            <div key={booking._id} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm transition-all hover:border-gray-300">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-gray-900">{booking.user?.name}</h3>
                  <p className="text-[11px] text-gray-500">{booking.user?.phone || 'No phone'}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${booking.status === 'confirmed' ? 'bg-red-100 text-red-700' :
                  booking.status === 'checked-in' ? 'bg-orange-100 text-orange-700' :
                    booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                  }`}>
                  {booking.status}
                </span>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>{new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>{booking.timeSlot}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <span>{booking.guests} Guests</span>
                </div>
              </div>

              {booking.specialRequest && (
                <div className="mt-3 p-2 bg-blue-50/50 rounded-lg border border-blue-100/50">
                  <p className="text-[10px] text-blue-700 italic flex items-start gap-1">
                    <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{booking.specialRequest}</span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


export default function OrdersMain() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeFilter, setActiveFilter] = useState("preparing")
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const contentRef = useRef(null)
  const filterBarRef = useRef(null)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)
  const mouseStartX = useRef(0)
  const mouseEndX = useRef(0)
  const isMouseDown = useRef(false)

  // New order popup states
  const [showNewOrderPopup, setShowNewOrderPopup] = useState(false)
  const [popupOrder, setPopupOrder] = useState(null) // Store order for popup (from Socket.IO or API)
  const [isMuted, setIsMuted] = useState(false)
  const [prepTime, setPrepTime] = useState(11)
  const [countdown, setCountdown] = useState(240) // 4 minutes in seconds
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true)
  const [showRejectPopup, setShowRejectPopup] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showCancelPopup, setShowCancelPopup] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [orderToCancel, setOrderToCancel] = useState(null)
  const audioRef = useRef(null)
  const shownOrdersRef = useRef(new Set()) // Track orders already shown in popup
  const [restaurantStatus, setRestaurantStatus] = useState({
    isActive: null,
    rejectionReason: null,
    onboarding: null,
    isLoading: true
  })
  const [isReverifying, setIsReverifying] = useState(false)

  // Zone setup prompt state (shown after registration/onboarding completes)
  const [showZoneSetupPrompt, setShowZoneSetupPrompt] = useState(false)

  // Restaurant notifications hook for real-time orders
  const { newOrder, clearNewOrder, isConnected } = useRestaurantNotifications()
  const [notifPerm, setNotifPerm] = useState(() => getWebNotificationPermission())

  useEffect(() => {
    const t = setInterval(() => setNotifPerm(getWebNotificationPermission()), 1500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onNeed = () => setNotifPerm(getWebNotificationPermission())
    window.addEventListener("restaurantNeedsNotificationPermission", onNeed)
    return () => window.removeEventListener("restaurantNeedsNotificationPermission", onNeed)
  }, [])

  const rejectReasons = [
    "Restaurant is too busy",
    "Item not available",
    "Outside delivery area",
    "Kitchen closing soon",
    "Technical issue",
    "Other reason"
  ]

  // If we ever need to trigger the zone-setup prompt from somewhere else,
  // expose a helper on window (non-critical, best-effort only).
  useEffect(() => {
    try {
      window.__showRestaurantZoneSetupPrompt = () => {
        setShowZoneSetupPrompt(true)
      }
    } catch {
      // ignore
    }
  }, [])

  const handleZoneSetupLater = () => {
    setShowZoneSetupPrompt(false)
  }

  const handleZoneSetupNow = () => {
    setShowZoneSetupPrompt(false)
    navigate("/restaurant/zone-setup")
  }

  // Fetch restaurant verification status
  useEffect(() => {
    const fetchRestaurantStatus = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const restaurant = response?.data?.data?.restaurant || response?.data?.restaurant
        if (restaurant) {
          setRestaurantStatus({
            isActive: restaurant.isActive,
            rejectionReason: restaurant.rejectionReason || null,
            onboarding: restaurant.onboarding || null,
            isLoading: false
          })

          // If onboarding just completed (navigated with ?showZoneSetup=1 or flag)
          // and restaurant has no location/zone configured yet, show zone-setup prompt once.
          try {
            const params = new URLSearchParams(location.search)
            const shouldShowFromQuery = params.get("showZoneSetup") === "1"
            const flag = localStorage.getItem("showRestaurantZoneSetupPrompt")
            const shouldShowFromStorage = flag === "1"

            const hasLocation =
              !!restaurant.location &&
              Array.isArray(restaurant.location.coordinates) &&
              restaurant.location.coordinates.length >= 2

            if (!hasLocation && (shouldShowFromQuery || shouldShowFromStorage)) {
              setShowZoneSetupPrompt(true)
              localStorage.removeItem("showRestaurantZoneSetupPrompt")
            }
          } catch {
            // ignore storage / URL errors
          }

          // Check if onboarding is incomplete and redirect if needed
          const completedSteps = restaurant.onboarding?.completedSteps || 0
          if (completedSteps < 4) {
            // Onboarding is incomplete, redirect to onboarding page
            const incompleteStep = await checkOnboardingStatus()
            if (incompleteStep) {
              navigate(`/restaurant/onboarding?step=${incompleteStep}`, { replace: true })
              return
            }
          }
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          console.error("Error fetching restaurant status:", error)
        }
        // Set loading to false so UI doesn't stay in loading state
        setRestaurantStatus(prev => ({ ...prev, isLoading: false }))
      }
    }

    fetchRestaurantStatus()

    // Listen for restaurant profile updates
    const handleProfileRefresh = () => {
      fetchRestaurantStatus()
    }

    window.addEventListener('restaurantProfileRefresh', handleProfileRefresh)

    return () => {
      window.removeEventListener('restaurantProfileRefresh', handleProfileRefresh)
    }
  }, [navigate])

  // Handle reverify (resubmit for approval)
  const handleReverify = async () => {
    try {
      setIsReverifying(true)
      await restaurantAPI.reverify()

      // Refresh restaurant status
      const response = await restaurantAPI.getCurrentRestaurant()
      const restaurant = response?.data?.data?.restaurant || response?.data?.restaurant
      if (restaurant) {
        setRestaurantStatus({
          isActive: restaurant.isActive,
          rejectionReason: restaurant.rejectionReason || null,
          onboarding: restaurant.onboarding || null,
          isLoading: false
        })
      }

      // Trigger profile refresh event
      window.dispatchEvent(new Event('restaurantProfileRefresh'))

      alert('Restaurant reverified successfully! Verification will be done in 24 hours.')
    } catch (error) {
      // Don't log network/timeout errors (backend might be down)
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
        console.error("Error reverifying restaurant:", error)
      }

      // Handle 401 Unauthorized errors (token expired/invalid)
      if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.message || 'Your session has expired. Please login again.'
        alert(errorMessage)
        // The axios interceptor should handle redirecting to login
        // But if it doesn't, we can manually redirect
        if (!error.response?.data?.message?.includes('inactive')) {
          // Only redirect if it's not an "inactive" error (which we handle differently)
          setTimeout(() => {
            window.location.href = '/restaurant/login'
          }, 1500)
        }
      } else {
        // Other errors (400, 500, etc.)
        const errorMessage = error.response?.data?.message || "Failed to reverify restaurant. Please try again."
        alert(errorMessage)
      }
    } finally {
      setIsReverifying(false)
    }
  }

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  // Show new order popup when real order notification arrives from Socket.IO
  useEffect(() => {
    if (newOrder) {
      console.log('📦 New order received via Socket.IO:', newOrder)
      const orderId = newOrder.orderId || newOrder.orderMongoId
      if (orderId && !shownOrdersRef.current.has(orderId)) {
        shownOrdersRef.current.add(orderId)
        setPopupOrder(newOrder)
        setShowNewOrderPopup(true)
        setCountdown(240) // Reset countdown to 4 minutes
      }
    }
  }, [newOrder])

  // Track popup state with ref to avoid stale closures
  const showNewOrderPopupRef = useRef(showNewOrderPopup)
  const newOrderRef = useRef(newOrder)

  useEffect(() => {
    showNewOrderPopupRef.current = showNewOrderPopup
  }, [showNewOrderPopup])

  useEffect(() => {
    newOrderRef.current = newOrder
  }, [newOrder])

  // Check for confirmed orders that haven't been shown in popup yet (fallback if Socket.IO fails)
  useEffect(() => {
    const checkConfirmedOrders = async () => {
      // Skip if popup is already showing or Socket.IO order exists
      if (showNewOrderPopupRef.current || newOrderRef.current) return

      try {
        const response = await restaurantAPI.getOrders()
        if (response.data?.success && response.data.data?.orders) {
          // Find confirmed orders that haven't been shown yet
          const confirmedOrders = response.data.data.orders.filter(
            order => order.status === 'confirmed' &&
              !shownOrdersRef.current.has(order.orderId || order._id)
          )

          // Show the most recent confirmed order in popup (double-check state)
          if (confirmedOrders.length > 0 && !showNewOrderPopupRef.current && !newOrderRef.current) {
            const latestConfirmedOrder = confirmedOrders[0]
            const orderId = latestConfirmedOrder.orderId || latestConfirmedOrder._id

            // Transform order to match newOrder format (include payment so COD shows correctly)
            const orderForPopup = {
              orderId: latestConfirmedOrder.orderId,
              orderMongoId: latestConfirmedOrder._id,
              restaurantId: latestConfirmedOrder.restaurantId,
              restaurantName: latestConfirmedOrder.restaurantName,
              items: latestConfirmedOrder.items || [],
              total: latestConfirmedOrder.pricing?.total || 0,
              customerAddress: latestConfirmedOrder.address,
              status: latestConfirmedOrder.status,
              createdAt: latestConfirmedOrder.createdAt,
              estimatedDeliveryTime: latestConfirmedOrder.estimatedDeliveryTime || 30,
              note: latestConfirmedOrder.note || '',
              sendCutlery: latestConfirmedOrder.sendCutlery,
              paymentMethod: latestConfirmedOrder.paymentMethod ?? latestConfirmedOrder.payment?.method,
              payment: latestConfirmedOrder.payment
            }

            console.log('📦 Found confirmed order (fallback):', orderForPopup)
            shownOrdersRef.current.add(orderId)
            setPopupOrder(orderForPopup)
            setShowNewOrderPopup(true)
            setCountdown(240)
          }
        }
      } catch (error) {
        // Don't log 401 errors - axios interceptor handles token refresh/redirect
        // Only log other errors (500, network errors, etc.)
        if (error.response?.status !== 401) {
          console.error('Error checking confirmed orders:', error)
        }
      }
    }

    // Check every 5 seconds for new confirmed orders (fallback mechanism)
    const interval = setInterval(checkConfirmedOrders, 5000)

    // Check immediately on mount
    checkConfirmedOrders()

    return () => clearInterval(interval)
  }, []) // Empty dependency array - check runs independently

  // Play audio when popup opens
  useEffect(() => {
    if (showNewOrderPopup && !isMuted) {
      if (audioRef.current) {
        audioRef.current.loop = true
        audioRef.current.play().catch(() => {})
      }
    } else if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [showNewOrderPopup, isMuted])

  // Countdown timer
  useEffect(() => {
    if (showNewOrderPopup && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [showNewOrderPopup, countdown])

  // Format countdown time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Handle accept order
  const handleAcceptOrder = async () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    // Use popupOrder (from Socket.IO or API fallback) or newOrder (from hook)
    const orderToAccept = popupOrder || newOrder

    // Accept order via API if we have a real order
    if (orderToAccept?.orderMongoId || orderToAccept?.orderId) {
      try {
        const orderId = orderToAccept.orderMongoId || orderToAccept.orderId
        const response = await restaurantAPI.acceptOrder(orderId, prepTime)
        console.log('✅ Order accepted:', orderId)
        toast.success('Order accepted successfully')
      } catch (error) {
        console.error('❌ Error accepting order:', error)
        const errorMessage = error.response?.data?.message ||
          error.message ||
          'Failed to accept order. Please try again.'

        // Show specific error message
        if (error.response?.status === 400) {
          toast.error(errorMessage)
        } else if (error.response?.status === 404) {
          toast.error('Order not found. It may have been cancelled or already processed.')
        } else {
          toast.error(errorMessage)
        }
        return
      }
    }

    setShowNewOrderPopup(false)
    setPopupOrder(null)
    clearNewOrder()
    setCountdown(240)
    setPrepTime(11)

    // Note: PreparingOrders component will automatically refresh orders via its own useEffect
    // No need to manually refresh here as the component polls every 10 seconds
  }

  // Handle reject order
  const handleRejectClick = () => {
    setShowRejectPopup(true)
  }

  const handleRejectConfirm = async () => {
    if (!rejectReason) return

    // Use popupOrder (from Socket.IO or API fallback) or newOrder (from hook)
    const orderToReject = popupOrder || newOrder

    // Reject order via API if we have a real order
    if (orderToReject?.orderMongoId || orderToReject?.orderId) {
      try {
        const orderId = orderToReject.orderMongoId || orderToReject.orderId
        await restaurantAPI.rejectOrder(orderId, rejectReason)
        console.log('✅ Order rejected:', orderId)
      } catch (error) {
        console.error('❌ Error rejecting order:', error)
        alert('Failed to reject order. Please try again.')
        return
      }
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setShowRejectPopup(false)
    setShowNewOrderPopup(false)
    setPopupOrder(null)
    clearNewOrder()
    setRejectReason("")
    setCountdown(240)
    setPrepTime(11)
  }

  const handleRejectCancel = () => {
    setShowRejectPopup(false)
    setShowNewOrderPopup(false)
    setPopupOrder(null)
    clearNewOrder()
    setRejectReason("")
    setCountdown(240)
  }

  // Handle cancel order (for preparing orders)
  const handleCancelClick = (order) => {
    setOrderToCancel(order)
    setShowCancelPopup(true)
  }

  const handleCancelConfirm = async () => {
    if (!cancelReason.trim() || !orderToCancel) return

    try {
      const orderId = orderToCancel.mongoId || orderToCancel.orderId
      await restaurantAPI.rejectOrder(orderId, cancelReason.trim())
      toast.success('Order cancelled successfully')
      setShowCancelPopup(false)
      setOrderToCancel(null)
      setCancelReason("")
    } catch (error) {
      console.error('❌ Error cancelling order:', error)
      toast.error(error.response?.data?.message || 'Failed to cancel order')
    }
  }

  const handleCancelPopupClose = () => {
    setShowCancelPopup(false)
    setOrderToCancel(null)
    setCancelReason("")
  }

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (audioRef.current) {
      if (!isMuted) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch(() => {})
      }
    }
  }

  // Handle PDF download
  const handlePrint = async () => {
    if (!newOrder) {
      console.warn('No order data available for PDF generation')
      return
    }

    try {
      // Create new PDF document
      const doc = new jsPDF()

      // Set font
      doc.setFont('helvetica', 'bold')

      // Header
      doc.setFontSize(20)
      doc.text('Order Receipt', 105, 20, { align: 'center' })

      // Restaurant name
      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text(orderToPrint.restaurantName || 'Restaurant', 105, 30, { align: 'center' })

      // Order details
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`Order ID: ${orderToPrint.orderId || 'N/A'}`, 20, 45)
      doc.setFont('helvetica', 'normal')

      const orderDate = orderToPrint.createdAt
        ? new Date(orderToPrint.createdAt).toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        : new Date().toLocaleString('en-GB')

      doc.text(`Date: ${orderDate}`, 20, 52)

      // Customer address
      if (orderToPrint.customerAddress) {
        doc.setFont('helvetica', 'bold')
        doc.text('Delivery Address:', 20, 62)
        doc.setFont('helvetica', 'normal')
        const addressText = [
          orderToPrint.customerAddress.street,
          orderToPrint.customerAddress.city,
          orderToPrint.customerAddress.state
        ].filter(Boolean).join(', ') || 'Address not available'
        const addressLines = doc.splitTextToSize(addressText, 170)
        doc.text(addressLines, 20, 69)
      }

      // Items table
      let yPos = 85
      if (orderToPrint.items && orderToPrint.items.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text('Items:', 20, yPos)
        yPos += 8

        // Prepare table data
        const tableData = orderToPrint.items.map(item => [
          item.name || 'Item',
          item.quantity || 1,
          `₹${(item.price || 0).toFixed(2)}`,
          `₹${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`
        ])

        autoTable(doc, {
          startY: yPos,
          head: [['Item', 'Qty', 'Price', 'Total']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 35, halign: 'right' }
          }
        })

        yPos = doc.lastAutoTable.finalY + 10
      }

      // Total
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(`Total: ₹${(orderToPrint.total || 0).toFixed(2)}`, 20, yPos)

      // Payment status
      yPos += 10
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Payment Status: ${orderToPrint.status === 'confirmed' ? 'Paid' : 'Pending'}`, 20, yPos)

      // Estimated delivery time
      if (orderToPrint.estimatedDeliveryTime) {
        yPos += 8
        doc.text(`Estimated Delivery: ${orderToPrint.estimatedDeliveryTime} minutes`, 20, yPos)
      }

      // Notes
      if (orderToPrint.note) {
        yPos += 10
        doc.setFont('helvetica', 'bold')
        doc.text('Note:', 20, yPos)
        doc.setFont('helvetica', 'normal')
        const noteLines = doc.splitTextToSize(orderToPrint.note, 170)
        doc.text(noteLines, 20, yPos + 7)
      }

      // Send cutlery
      if (orderToPrint.sendCutlery) {
        yPos += 15
        doc.setFont('helvetica', 'normal')
        doc.text('✓ Send cutlery requested', 20, yPos)
      }

      // Footer
      const pageHeight = doc.internal.pageSize.height
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text(
        `Generated on ${new Date().toLocaleString('en-GB')}`,
        105,
        pageHeight - 10,
        { align: 'center' }
      )

      // Download PDF
      const fileName = `Order-${orderToPrint.orderId || 'Receipt'}-${Date.now()}.pdf`
      doc.save(fileName)

      console.log('✅ PDF generated successfully:', fileName)
    } catch (error) {
      console.error('❌ Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  // Handle swipe gestures with smooth animations
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchEndX.current = e.touches[0].clientX
    isSwiping.current = false
  }

  const handleTouchMove = (e) => {
    if (!isSwiping.current) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current)
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)

      // Determine if this is a horizontal swipe
      if (deltaX > deltaY && deltaX > 10) {
        isSwiping.current = true
      }
    }

    if (isSwiping.current) {
      touchEndX.current = e.touches[0].clientX
    }
  }

  const handleTouchEnd = () => {
    if (!isSwiping.current) {
      touchStartX.current = 0
      touchEndX.current = 0
      return
    }

    const swipeDistance = touchStartX.current - touchEndX.current
    const minSwipeDistance = 50
    const swipeVelocity = Math.abs(swipeDistance)

    if (swipeVelocity > minSwipeDistance && !isTransitioning) {
      const currentIndex = filterTabs.findIndex(tab => tab.id === activeFilter)
      let newIndex = currentIndex

      if (swipeDistance > 0 && currentIndex < filterTabs.length - 1) {
        // Swipe left - go to next filter (right side)
        newIndex = currentIndex + 1
      } else if (swipeDistance < 0 && currentIndex > 0) {
        // Swipe right - go to previous filter (left side)
        newIndex = currentIndex - 1
      }

      if (newIndex !== currentIndex) {
        setIsTransitioning(true)

        // Smooth transition with animation
        setTimeout(() => {
          setActiveFilter(filterTabs[newIndex].id)
          scrollToFilter(newIndex)

          // Reset transition state after animation
          setTimeout(() => {
            setIsTransitioning(false)
          }, 300)
        }, 50)
      }
    }

    // Reset touch positions
    touchStartX.current = 0
    touchEndX.current = 0
    touchStartY.current = 0
    isSwiping.current = false
  }

  // Scroll filter bar to show active button with smooth animation
  const scrollToFilter = (index) => {
    if (filterBarRef.current) {
      const buttons = filterBarRef.current.querySelectorAll('button')
      if (buttons[index]) {
        const button = buttons[index]
        const container = filterBarRef.current
        const buttonLeft = button.offsetLeft
        const buttonWidth = button.offsetWidth
        const containerWidth = container.offsetWidth
        const scrollLeft = buttonLeft - (containerWidth / 2) + (buttonWidth / 2)

        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        })
      }
    }
  }

  // Scroll to active filter on change with smooth animation
  useEffect(() => {
    const index = filterTabs.findIndex(tab => tab.id === activeFilter)
    if (index >= 0) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        scrollToFilter(index)
      })
    }
  }, [activeFilter])


  const handleSelectOrder = (order) => {
    setSelectedOrder(order)
    setIsSheetOpen(true)
  }

  const renderContent = () => {
    switch (activeFilter) {
      case "preparing":
        return <PreparingOrders onSelectOrder={handleSelectOrder} onCancel={handleCancelClick} />
      case "ready":
        return <ReadyOrders onSelectOrder={handleSelectOrder} />
      case "out-for-delivery":
        return <OutForDeliveryOrders onSelectOrder={handleSelectOrder} />
      case "scheduled":
        return <EmptyState message="Scheduled orders will appear here" />
      case "completed":
        return <CompletedOrders onSelectOrder={handleSelectOrder} />
      case "table-booking":
        return <TableBookings />
      case "cancelled":
        return <CancelledOrders onSelectOrder={handleSelectOrder} />
      default:
        return <EmptyState />
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Restaurant Navbar - Sticky at top */}
      <div className="sticky top-0 z-50 bg-white">
        <RestaurantNavbar showNotifications={false} />
        {notifPerm === "default" ? (
          <div className="px-3 pb-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">Enable notifications</div>
                <div className="text-xs text-blue-800/80 truncate">
                  To receive admin announcements and updates.
                </div>
              </div>
              <button
                type="button"
                onClick={() => registerFcmTokenForRestaurant({ forcePrompt: true }).catch(() => {})}
                className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Enable
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Zone Setup Prompt - shown once after registration/onboarding when no zone is configured */}
      {showZoneSetupPrompt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl border border-red-100">
            <div className="px-5 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Set up your delivery zone</h2>
              <p className="mt-1 text-sm text-gray-600">
                Finish your zone setup so customers in your area can start seeing your restaurant and placing orders.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm text-gray-700">
              <p className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#671E1F]" />
                Draw your primary delivery area on the map.
              </p>
              <p className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#671E1F]" />
                Ensure your restaurant location is pinned accurately.
              </p>
            </div>
            <div className="px-5 pb-5 pt-2 flex flex-col sm:flex-row sm:justify-end sm:items-center gap-3">
              <button
                type="button"
                onClick={handleZoneSetupLater}
                className="w-full sm:w-auto rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Maybe later
              </button>
              <button
                type="button"
                onClick={handleZoneSetupNow}
                className="w-full sm:w-auto rounded-lg bg-[#671E1F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#238654] shadow-sm"
              >
                Setup zone now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Filter Bar - Sticky below navbar */}
      <div className="sticky top-[50px] z-40 pb-2 bg-gray-100">
        <div
          ref={filterBarRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide bg-transparent rounded-full px-3 py-2 mt-2"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <style>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {filterTabs.map((tab, index) => {
            const isActive = activeFilter === tab.id

            return (
              <motion.button
                key={tab.id}
                onClick={() => {
                  if (!isTransitioning) {
                    setIsTransitioning(true)
                    setActiveFilter(tab.id)
                    scrollToFilter(index)
                    setTimeout(() => setIsTransitioning(false), 300)
                  }
                }}
                className={`shrink-0 px-6 py-3.5 rounded-full font-medium text-sm whitespace-nowrap relative overflow-hidden ${isActive
                  ? 'text-white'
                  : 'bg-white text-black'
                  }`}
                animate={{
                  scale: isActive ? 1.05 : 1,
                  opacity: isActive ? 1 : 0.7,
                }}
                transition={{
                  duration: 0.3,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                whileTap={{ scale: 0.95 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeFilterBackground"
                    className="absolute inset-0 bg-black rounded-full -z-10"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-4 pb-24 content-scroll"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => {
          mouseStartX.current = e.clientX
          mouseEndX.current = e.clientX
          isMouseDown.current = true
          isSwiping.current = false
        }}
        onMouseMove={(e) => {
          if (isMouseDown.current) {
            if (!isSwiping.current) {
              const deltaX = Math.abs(e.clientX - mouseStartX.current)
              if (deltaX > 10) {
                isSwiping.current = true
              }
            }
            if (isSwiping.current) {
              mouseEndX.current = e.clientX
            }
          }
        }}
        onMouseUp={() => {
          if (isMouseDown.current && isSwiping.current) {
            const swipeDistance = mouseStartX.current - mouseEndX.current
            const minSwipeDistance = 50

            if (Math.abs(swipeDistance) > minSwipeDistance && !isTransitioning) {
              const currentIndex = filterTabs.findIndex(tab => tab.id === activeFilter)
              let newIndex = currentIndex

              if (swipeDistance > 0 && currentIndex < filterTabs.length - 1) {
                newIndex = currentIndex + 1
              } else if (swipeDistance < 0 && currentIndex > 0) {
                newIndex = currentIndex - 1
              }

              if (newIndex !== currentIndex) {
                setIsTransitioning(true)
                setTimeout(() => {
                  setActiveFilter(filterTabs[newIndex].id)
                  scrollToFilter(newIndex)
                  setTimeout(() => setIsTransitioning(false), 300)
                }, 50)
              }
            }
          }

          isMouseDown.current = false
          isSwiping.current = false
          mouseStartX.current = 0
          mouseEndX.current = 0
        }}
        onMouseLeave={() => {
          isMouseDown.current = false
          isSwiping.current = false
        }}
      >
        <style>{`
          .content-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .content-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Verification Pending Card - Show if onboarding is complete (all 4 steps) and restaurant is not active */}
        {!restaurantStatus.isLoading &&
          !restaurantStatus.isActive &&
          restaurantStatus.onboarding?.completedSteps === 4 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={`mt-4 mb-4 rounded-2xl shadow-sm px-6 py-4 ${restaurantStatus.rejectionReason
                ? 'bg-white border border-red-200'
                : 'bg-white border border-yellow-200'
                }`}
            >
              {restaurantStatus.rejectionReason ? (
                <>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 rounded-full p-2 bg-red-100">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-red-600 mb-2">Denied Verification</h3>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-red-800 mb-2">Reason for Rejection:</p>
                        <div className="text-xs text-red-700 space-y-1">
                          {restaurantStatus.rejectionReason.split('\n').filter(line => line.trim()).length > 1 ? (
                            <ul className="space-y-1 list-disc list-inside">
                              {restaurantStatus.rejectionReason.split('\n').map((point, index) => (
                                point.trim() && (
                                  <li key={index}>{point.trim()}</li>
                                )
                              ))}
                            </ul>
                          ) : (
                            <p className="text-red-700">{restaurantStatus.rejectionReason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">
                    Please correct the above issues and click "Reverify" to resubmit your request for approval.
                  </p>
                  <button
                    onClick={handleReverify}
                    disabled={isReverifying}
                    className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isReverifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Reverify"
                    )}
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Verification Done in 24 Hours</h3>
                  <p className="text-sm text-gray-600">Your account is under verification. You'll be notified once approved.</p>
                </>
              )}
            </motion.div>
          )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeFilter}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Audio element */}
      <audio ref={audioRef} src={notificationSound} />

      {/* New Order Popup */}
      <AnimatePresence>
        {showNewOrderPopup && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-[95%] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-900">
                      {(popupOrder || newOrder)?.orderId || '#Order'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(popupOrder || newOrder)?.restaurantName || 'Restaurant'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrint}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      aria-label="Print"
                    >
                      <Printer className="w-5 h-5 text-gray-700" />
                    </button>
                    <button
                      onClick={toggleMute}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      aria-label={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-gray-700" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-gray-700" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
                  {/* Customer info */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {(popupOrder || newOrder)?.items?.[0]?.name || 'New Order'}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {(popupOrder || newOrder)?.createdAt
                        ? new Date((popupOrder || newOrder).createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : 'Just now'}
                    </p>
                  </div>

                  {/* Details Accordion */}
                  <div className="mb-4">
                    <button
                      onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                      className="w-full flex items-center justify-between py-2 border-b border-gray-200"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-900">Details</span>
                        <span className="text-xs text-gray-500">
                          {(popupOrder || newOrder)?.items?.length || 0} item{(popupOrder || newOrder)?.items?.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {isDetailsExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                      )}
                    </button>

                    <AnimatePresence>
                      {isDetailsExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="py-3 space-y-3">
                            {(popupOrder || newOrder)?.items?.map((item, index) => (
                              <div key={index} className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.isVeg ? 'bg-red-500' : 'bg-red-500'}`}></div>
                                <div className="flex-1">
                                  <div className="flex items-start justify-between">
                                    <p className="text-sm font-medium text-gray-900">
                                      {item.quantity} x {item.name}
                                    </p>
                                    <p className="text-xs text-gray-600 ml-2">
                                      ₹{item.price * item.quantity}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )) || (
                                <p className="text-sm text-gray-500">No items</p>
                              )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Send cutlery */}
                  {(popupOrder || newOrder)?.sendCutlery && (
                    <div className="mb-4 flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-sm text-gray-700">Send cutlery</span>
                    </div>
                  )}

                  {(popupOrder || newOrder)?.note && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                        Customer note
                      </p>
                      <p className="mt-1 text-sm text-amber-900 break-words">
                        {(popupOrder || newOrder)?.note}
                      </p>
                    </div>
                  )}

                  {/* Total bill */}
                  <div className="mb-4 flex items-center justify-between py-3 border-y border-gray-200">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-900">Total bill</span>
                    </div>
                    <span className="text-base font-bold text-gray-900">
                      ₹{(popupOrder || newOrder)?.total || 0}
                    </span>
                  </div>

                  {/* Payment method: treat cash/cod (any case) as COD */}
                  {(() => {
                    const raw = (popupOrder || newOrder)?.paymentMethod ?? (popupOrder || newOrder)?.payment?.method;
                    const m = raw != null ? String(raw).toLowerCase().trim() : '';
                    const isCod = m === 'cash' || m === 'cod';
                    return (
                      <div className="mb-4 flex items-center justify-between py-2">
                        <span className="text-sm font-medium text-gray-700">Payment</span>
                        <span className={`text-sm font-semibold ${isCod ? 'text-amber-600' : 'text-red-600'}`}>
                          {isCod ? 'Cash on Delivery' : 'Online'}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Preparation time */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Preparation time</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPrepTime(Math.max(1, prepTime - 1))}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <Minus className="w-4 h-4 text-gray-700" />
                        </button>
                        <span className="text-base font-semibold text-gray-900 min-w-[60px] text-center">
                          {prepTime} mins
                        </span>
                        <button
                          onClick={() => setPrepTime(prepTime + 1)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <Plus className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Accept and Reject buttons */}
                  <div className="space-y-3">
                    {/* Accept button with countdown */}
                    <div className="relative">
                      <button
                        onClick={handleAcceptOrder}
                        className="w-full bg-black text-white py-3.5 rounded-lg font-semibold text-sm hover:bg-gray-800 transition-colors relative overflow-hidden"
                      >
                        {/* Loading background */}
                        <motion.div
                          className="absolute inset-0 bg-blue-600"
                          initial={{ width: "100%" }}
                          animate={{ width: `${(countdown / 240) * 100}%` }}
                          transition={{ duration: 1, ease: "linear" }}
                        />
                        <span className="relative z-10">Accept ({formatTime(countdown)})</span>
                      </button>
                    </div>

                    {/* Reject button */}
                    <button
                      onClick={handleRejectClick}
                      className="w-full bg-white border-2 border-red-500 text-red-600 py-3 rounded-lg font-semibold text-sm hover:bg-red-50 transition-colors"
                    >
                      Reject Order
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      navigate("/restaurant/help-centre", {
                        state: {
                          orderId: (popupOrder || newOrder)?.orderId || null,
                          source: "order-popup",
                        },
                      })
                    }}
                    className="relative z-10 pointer-events-auto text-sm text-gray-600 hover:text-gray-900 transition-colors underline mx-auto block"
                  >
                    Need help with this order?
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reject Order Popup */}
      <AnimatePresence>
        {showRejectPopup && (
          <>
            <motion.div
              className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleRejectCancel}
            >
              <motion.div
                className="w-[95%] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-4 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">
                    Reject Order {(popupOrder || newOrder)?.orderId || '#Order'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Please select a reason for rejecting this order</p>
                </div>

                {/* Content */}
                <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    {rejectReasons.map((reason) => (
                      <button
                        key={reason}
                        onClick={() => setRejectReason(reason)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${rejectReason === reason
                          ? "border-black bg-black/5"
                          : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${rejectReason === reason ? "text-black" : "text-gray-900"
                            }`}>
                            {reason}
                          </span>
                          {rejectReason === reason && (
                            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={handleRejectCancel}
                    className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRejectConfirm}
                    disabled={!rejectReason}
                    className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${rejectReason
                      ? "!bg-black !text-white"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                  >
                    Confirm Rejection
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cancel Order Popup */}
      <AnimatePresence>
        {showCancelPopup && orderToCancel && (
          <>
            <motion.div
              className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelPopupClose}
            >
              <motion.div
                className="w-[95%] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-4 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">
                    Cancel Order {orderToCancel.orderId || '#Order'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Please provide a reason for cancelling this order</p>
                </div>

                {/* Content */}
                <div className="px-4 py-4">
                  <div className="space-y-3">
                    {rejectReasons.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setCancelReason(reason)}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${cancelReason === reason
                          ? "border-red-500 bg-red-50"
                          : "border-gray-200 hover:border-gray-300"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${cancelReason === reason
                              ? "border-red-500 bg-red-500"
                              : "border-gray-300"
                              }`}
                          >
                            {cancelReason === reason && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm font-medium ${cancelReason === reason ? "text-red-700" : "text-gray-700"
                            }`}>
                            {reason}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={handleCancelPopupClose}
                    className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCancelConfirm}
                    disabled={!cancelReason}
                    className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${cancelReason
                      ? "!bg-red-600 !text-white hover:bg-red-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                  >
                    Confirm Cancellation
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Sheet for Order Details */}
      <AnimatePresence>
        {isSheetOpen && selectedOrder && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSheetOpen(false)}
          >
            <motion.div
              className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-4 pb-6 shadow-lg"
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center mb-3">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>

              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-black truncate">
                    Order #{selectedOrder.orderId}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {selectedOrder.customerName}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 truncate">
                    {selectedOrder.type}
                    {selectedOrder.tableOrToken
                      ? ` • ${selectedOrder.tableOrToken}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${selectedOrder.status === "Ready"
                      ? "border-red-500 text-red-600"
                      : "border-gray-800 text-gray-900"
                      }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${selectedOrder.status === "Ready"
                        ? "bg-red-500"
                        : "bg-gray-800"
                        }`}
                    />
                    {selectedOrder.status}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {selectedOrder.timePlaced}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 my-3" />

              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700 mb-1">
                  Items
                </p>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-800">
                            {item.quantity}x {item.name}
                          </p>
                          {item.subCategory && (
                            <p className="text-[10px] text-gray-500 italic mt-0.5">
                              ({item.subCategory})
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          ₹{item.price * item.quantity}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 break-words">
                    {selectedOrder.itemsSummary}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-4">
                {/* Hide ETA for ready orders */}
                {selectedOrder.status !== 'ready' && selectedOrder.eta && (
                  <span>ETA: <span className="font-medium text-black">{selectedOrder.eta}</span></span>
                )}
                <span>Payment: <span className="font-medium text-black">Paid online</span></span>
              </div>

              {selectedOrder.deliveryInstructions && (
                <div className="mb-4 p-2.5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl">
                  <p className="text-[10px] font-medium text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1">
                    <Info className="w-3 h-3" /> Delivery Instructions
                  </p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 italic">
                    "{selectedOrder.deliveryInstructions}"
                  </p>
                </div>
              )}

              <button
                className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium"
                onClick={() => setIsSheetOpen(false)}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation - Sticky */}
      <BottomNavOrders />
    </div>
  )
}

// Resend Notification Button Component
function ResendNotificationButton({ orderId, mongoId, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleResend = async (e) => {
    e.stopPropagation(); // Prevent card click
    if (loading) return;

    try {
      setLoading(true);
      const id = mongoId || orderId;
      const response = await restaurantAPI.resendDeliveryNotification(id);

      if (response.data?.success) {
        toast.success(`Notification sent to ${response.data.data?.notifiedCount || 0} delivery partners`);
        // Refresh orders if onSuccess callback is provided
        if (onSuccess) {
          // Trigger a refresh by calling onSuccess with a special flag
          setTimeout(() => {
            window.location.reload(); // Simple refresh for now
          }, 1000);
        }
      } else {
        toast.error(response.data?.message || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error resending notification:', error);
      toast.error(error.response?.data?.message || 'Failed to send notification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title="Resend notification to delivery partners"
    >
      {loading ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Sending...</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3 h-3" />
          <span>Resend</span>
        </>
      )}
    </button>
  );
}

// Mark as Ready Button (restaurant) – makes order visible to delivery partner
function MarkAsReadyButton({ orderId, mongoId, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleMarkReady = async (e) => {
    e.stopPropagation();
    const id = mongoId || orderId;
    if (!id) return;
    setLoading(true);
    try {
      await restaurantAPI.markOrderReady(id);
      toast.success("Order marked as ready. It will now show for delivery partners.");
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to mark order as ready");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleMarkReady}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 border border-red-700 transition-colors"
      title="Mark as ready (shows for delivery partners)"
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Check className="w-3 h-3" />
      )}
      <span>Mark as ready</span>
    </button>
  );
}

// Order Card Component
function OrderCard({
  orderId,
  mongoId,
  status,
  customerName,
  type,
  tableOrToken,
  timePlaced,
  eta,
  itemsSummary,
  photoUrl,
  photoAlt,
  deliveryPartnerId,
  items,
  onSelect,
  onCancel,
  onMarkReadySuccess,
}) {
  const isReady = status === "Ready"
  const showCancel = status === 'preparing' && onCancel
  const orderPayload = {
    orderId,
    mongoId,
    status,
    customerName,
    type,
    tableOrToken,
    timePlaced,
    eta,
    itemsSummary,
    items,
  }

  return (
    <div className="w-full bg-white rounded-2xl p-4 mb-3 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
      {/* Cancel button - only show for preparing orders */}
      <div
        onClick={() =>
          onSelect?.(orderPayload)
        }
        className="w-full text-left flex gap-3 items-start cursor-pointer"
      >
        {/* Photo */}
        <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 my-auto">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={photoAlt}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-2">
              <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">
                {photoAlt}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-between min-h-[80px]">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-black leading-tight truncate">
                Order #{orderId}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 truncate">
                {customerName}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1 min-w-0 shrink-0 max-w-[120px]">
              <span className="text-[11px] text-gray-500 text-right break-words">
                {timePlaced}
              </span>
            </div>
          </div>

          {/* Middle row */}
          <div className="mt-2">
            <p className="text-xs text-gray-600 line-clamp-2">
              {itemsSummary}
            </p>
          </div>

          {/* Bottom row */}
          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] text-gray-500">
                {type}
                {tableOrToken ? ` • ${tableOrToken}` : ""}
              </p>
              {/* Delivery Assignment Status - Only show for preparing orders */}
              {status === 'preparing' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${deliveryPartnerId
                    ? 'bg-red-100 text-red-700 border border-red-300'
                    : 'bg-orange-100 text-orange-700 border border-orange-300'
                    }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${deliveryPartnerId ? 'bg-red-500' : 'bg-orange-500'
                      }`} />
                    {deliveryPartnerId ? 'Assigned' : 'Not Assigned'}
                  </span>
                  {!deliveryPartnerId && (
                    <ResendNotificationButton orderId={orderId} mongoId={mongoId} onSuccess={onSelect} />
                  )}
                  <MarkAsReadyButton orderId={orderId} mongoId={mongoId} onSuccess={onMarkReadySuccess} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {showCancel && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCancel(orderPayload)
                  }}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-100"
                >
                  Cancel Order
                </button>
              )}
              {/* Hide ETA for ready orders */}
              {status !== 'ready' && eta && (
                <div className="flex items-baseline gap-1 shrink-0 pr-2">
                  <span className="text-[11px] text-gray-500 whitespace-nowrap">ETA</span>
                  <span className="text-xs font-medium text-black whitespace-nowrap">
                    {eta}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Preparing Orders List
function PreparingOrders({ onSelectOrder, onCancel }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const isMountedRef = useRef(true)

  const fetchOrders = useCallback(async () => {
    try {
      const response = await restaurantAPI.getOrders()
      if (!isMountedRef.current) return

      if (response.data?.success && response.data.data?.orders) {
        const preparingOrders = response.data.data.orders.filter(order => {
          const { isDelivered, isOutForDelivery } = getDeliveryPhaseFlags(order)
          const status = (order.status || "").toLowerCase()
          return status === 'preparing' && !isOutForDelivery && !isDelivered
        })
        const transformedOrders = preparingOrders.map(order => {
          const initialETA = order.estimatedDeliveryTime || 30
          const preparingTimestamp = order.tracking?.preparing?.timestamp
            ? new Date(order.tracking.preparing.timestamp)
            : new Date(order.createdAt)
          return {
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || 'preparing',
            customerName: order.userId?.name || 'Customer',
            type: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Express Delivery',
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            initialETA,
            preparingTimestamp,
            itemsSummary: order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'No items',
            items: order.items || [],
            deliveryInstructions: order.deliveryInstructions || null,
            photoUrl: order.items?.[0]?.image || null,
            photoAlt: order.items?.[0]?.name || 'Order',
            deliveryPartnerId: order.deliveryPartnerId || null
          }
        })
        if (isMountedRef.current) {
          setOrders(transformedOrders)
          setLoading(false)
        }
      } else {
        if (isMountedRef.current) {
          setOrders([])
          setLoading(false)
        }
      }
    } catch (error) {
      if (!isMountedRef.current) return
      if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404 && error.response?.status !== 401) {
        console.error('Error fetching preparing orders:', error)
      }
      if (isMountedRef.current) {
        setOrders([])
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    fetchOrders()
    const intervalId = setInterval(fetchOrders, 10000)
    const countdownIntervalId = setInterval(() => {
      if (isMountedRef.current) setCurrentTime(new Date())
    }, 1000)
    return () => {
      isMountedRef.current = false
      clearInterval(intervalId)
      clearInterval(countdownIntervalId)
    }
  }, [fetchOrders])

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">Preparing orders</h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">
          Preparing orders
        </h2>
        <span className="text-xs text-gray-500">{orders.length} active</span>
      </div>
      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No orders in preparation
        </div>
      ) : (
        <div>
          {orders.map((order) => {
            // Calculate remaining ETA (countdown)
            const elapsedMs = currentTime - order.preparingTimestamp
            const elapsedMinutes = Math.floor(elapsedMs / 60000)
            const remainingMinutes = Math.max(0, order.initialETA - elapsedMinutes)

            // Format ETA display
            let etaDisplay = ''
            if (remainingMinutes <= 0) {
              const remainingSeconds = Math.max(0, Math.floor((order.initialETA * 60) - (elapsedMs / 1000)))
              if (remainingSeconds > 0) {
                etaDisplay = `${remainingSeconds} secs`
              } else {
                etaDisplay = '0 mins'
              }
            } else {
              etaDisplay = `${remainingMinutes} mins`
            }

            return (
              <OrderCard
                key={order.orderId || order.mongoId}
                orderId={order.orderId}
                mongoId={order.mongoId}
                status={order.status}
                customerName={order.customerName}
                type={order.type}
                tableOrToken={order.tableOrToken}
                timePlaced={order.timePlaced}
                eta={etaDisplay}
                itemsSummary={order.itemsSummary}
                photoUrl={order.photoUrl}
                photoAlt={order.photoAlt}
                deliveryPartnerId={order.deliveryPartnerId}
                onSelect={onSelectOrder}
                onCancel={onCancel}
                onMarkReadySuccess={fetchOrders}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// Ready Orders List
function ReadyOrders({ onSelectOrder }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let intervalId = null

    const fetchOrders = async () => {
      try {
        // Fetch all orders and filter for 'ready' status on frontend
        const response = await restaurantAPI.getOrders()

        if (!isMounted) return

        if (response.data?.success && response.data.data?.orders) {
          // Filter orders with 'ready' status
          const readyOrders = response.data.data.orders.filter(order => {
            const { isDelivered, isOutForDelivery } = getDeliveryPhaseFlags(order)
            const status = (order.status || "").toLowerCase()
            return status === 'ready' && !isOutForDelivery && !isDelivered
          })

          const transformedOrders = readyOrders.map(order => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || 'ready',
            customerName: order.userId?.name || 'Customer',
            type: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Express Delivery',
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            eta: null, // Don't show ETA for ready orders
            itemsSummary: order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'No items',
            items: order.items || [],
            deliveryInstructions: order.deliveryInstructions || null,
            photoUrl: order.items?.[0]?.image || null,
            photoAlt: order.items?.[0]?.name || 'Order'
          }))

          if (isMounted) {
            setOrders(transformedOrders)
            setLoading(false)
          }
        } else {
          if (isMounted) {
            setOrders([])
            setLoading(false)
          }
        }
      } catch (error) {
        if (!isMounted) return

        // Don't log network errors repeatedly - they're expected if backend is down
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error('Error fetching ready orders:', error)
        }

        if (isMounted) {
          setOrders([])
          setLoading(false)
        }
      }
    }

    fetchOrders()

    // Refresh every 10 seconds (reduced frequency to avoid spam if backend is down)
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchOrders()
      }
    }, 10000)

    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, []) // Empty dependency array is correct here - we want this to run once on mount

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">Ready for pickup</h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">
          Ready for pickup
        </h2>
        <span className="text-xs text-gray-500">{orders.length} active</span>
      </div>
      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No orders ready for pickup
        </div>
      ) : (
        <div>
          {orders.map((order) => (
            <OrderCard
              key={order.orderId || order.mongoId}
              {...order}
              onSelect={onSelectOrder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Out for Delivery Orders List
const OutForDeliveryOrders = ({ onSelectOrder }) => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let intervalId = null

    const fetchOrders = async () => {
      try {
        // Fetch all orders and filter for 'out_for_delivery' status on frontend
        const response = await restaurantAPI.getOrders()

        if (!isMounted) return

        if (response.data?.success && response.data.data?.orders) {
          // Filter orders with 'out_for_delivery' status
          const outForDeliveryOrders = response.data.data.orders.filter(order => {
            const { isDelivered, isOutForDelivery } = getDeliveryPhaseFlags(order)
            return !isDelivered && isOutForDelivery
          })

          const transformedOrders = outForDeliveryOrders.map(order => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || 'out_for_delivery',
            customerName: order.userId?.name || 'Customer',
            type: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Express Delivery',
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            eta: null,
            itemsSummary: order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'No items',
            items: order.items || [],
            deliveryInstructions: order.deliveryInstructions || null,
            photoUrl: order.items?.[0]?.image || null,
            photoAlt: order.items?.[0]?.name || 'Order'
          }))

          if (isMounted) {
            setOrders(transformedOrders)
            setLoading(false)
          }
        } else {
          if (isMounted) {
            setOrders([])
            setLoading(false)
          }
        }
      } catch (error) {
        if (!isMounted) return

        // Don't log network errors repeatedly - they're expected if backend is down
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error('Error fetching out for delivery orders:', error)
        }

        if (isMounted) {
          setOrders([])
          setLoading(false)
        }
      }
    }

    fetchOrders()

    // Refresh every 10 seconds
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchOrders()
      }
    }, 10000)

    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, []) // Empty dependency array is correct here - we want this to run once on mount

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">Out for delivery</h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">
          Out for delivery
        </h2>
        <span className="text-xs text-gray-500">{orders.length} active</span>
      </div>
      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No orders out for delivery
        </div>
      ) : (
        <div>
          {orders.map((order) => (
            <OrderCard
              key={order.orderId || order.mongoId}
              {...order}
              onSelect={onSelectOrder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Empty State Component
function EmptyState({ message = "Temporarily closed" }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
      {/* Store Illustration */}
      <div className="mb-6">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className="text-gray-300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Storefront */}
          <rect x="40" y="80" width="120" height="80" stroke="currentColor" strokeWidth="2" fill="white" />
          {/* Awning */}
          <path d="M30 80 L100 50 L170 80" stroke="currentColor" strokeWidth="2" fill="white" />
          {/* Doors */}
          <rect x="60" y="100" width="30" height="60" stroke="currentColor" strokeWidth="2" fill="white" />
          <rect x="110" y="100" width="30" height="60" stroke="currentColor" strokeWidth="2" fill="white" />
          {/* Laptop */}
          <rect x="70" y="140" width="40" height="25" stroke="currentColor" strokeWidth="1.5" fill="white" />
          <text x="85" y="155" fontSize="8" fill="currentColor" textAnchor="middle">CLOSED</text>
          {/* Sign */}
          <rect x="80" y="170" width="40" height="20" stroke="currentColor" strokeWidth="1.5" fill="white" />
        </svg>
      </div>

      {/* Message */}
      <h2 className="text-lg font-semibold text-gray-600 mb-4 text-center">
        {message}
      </h2>

      {/* View Status Button */}
      <button className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors">
        View status
      </button>
    </div>
  )
}
