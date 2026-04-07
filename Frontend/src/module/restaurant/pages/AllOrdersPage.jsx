import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Search,
  Filter,
  ChevronDown,
  Calendar,
  Copy,
  ChevronRight,
  HelpCircle,
  X,
  MoreVertical,
  Trash2,
} from "lucide-react"
import { DateRangeCalendar } from "@/components/ui/date-range-calendar"
import { restaurantAPI } from "@/lib/api"
import { toast } from "sonner"
import { getHiddenOrderIds, hideOrderId } from "@/lib/utils/orderVisibility"

// Mock order data matching the image (fallback)
const mockOrders = [
  {
    id: "7593519447",
    status: "REJECTED",
    date: "19 Dec",
    time: "06:35 AM",
    restaurant: "Kadhai Chammach Restaurant",
    address: "By Pass Road (South), Indore",
    customer: "Aryan baghel",
    items: [
      { name: "Egg Biryani", quantity: 1, price: 199 }
    ],
    totalPrice: 199,
    reason: "Rejected by Restaurant: items were out of stock"
  },
  {
    id: "7591372071",
    status: "REJECTED",
    date: "18 Dec",
    time: "04:04 AM",
    restaurant: "Kadhai Chammach Restaurant",
    address: "By Pass Road (South), Indore",
    customer: "Mantavya katkoria",
    items: [
      { name: "Egg Biryani", quantity: 1, price: 199 },
      { name: "Chicken Curry", quantity: 1, price: 39 }
    ],
    totalPrice: 238,
    reason: "Rejected by Restaurant: items were out of stock"
  },
  {
    id: "7560307359",
    status: "CANCELLED",
    tags: ["VEG ONLY"],
    date: "12 Dec",
    time: "04:27 AM",
    restaurant: "Kadhai Chammach Restaurant",
    address: "By Pass Road (South), Indore",
    customer: "John Doe",
    items: [
      { name: "Veg Biryani", quantity: 2, price: 150 }
    ],
    totalPrice: 300,
    reason: "Cancelled by customer"
  },
  {
    id: "7593519448",
    status: "DELIVERED",
    tags: ["SELF DELIVERY"],
    date: "19 Dec",
    time: "08:15 AM",
    restaurant: "Kadhai Chammach Restaurant",
    address: "By Pass Road (South), Indore",
    customer: "Priya Sharma",
    items: [
      { name: "Paneer Tikka", quantity: 2, price: 250 },
      { name: "Naan", quantity: 4, price: 80 }
    ],
    totalPrice: 330,
  },
  {
    id: "7593519449",
    status: "PREPARING",
    tags: ["LARGE ORDER"],
    date: "19 Dec",
    time: "09:30 AM",
    restaurant: "Kadhai Chammach Restaurant",
    address: "By Pass Road (South), Indore",
    customer: "Rahul Verma",
    items: [
      { name: "Chicken Biryani", quantity: 5, price: 999 }
    ],
    totalPrice: 999,
  },
  {
    id: "7593519450",
    status: "READY",
    date: "19 Dec",
    time: "10:00 AM",
    restaurant: "Kadhai Chammach Restaurant",
    address: "By Pass Road (South), Indore",
    customer: "Sneha Patel",
    items: [
      { name: "Dal Makhani", quantity: 1, price: 180 }
    ],
    totalPrice: 180,
  },
  {
    id: "7593519451",
    status: "OUT FOR DELIVERY",
    tags: ["FOOD RESCUE"],
    date: "19 Dec",
    time: "10:45 AM",
    restaurant: "Kadhai Chammach Restaurant",
    address: "By Pass Road (South), Indore",
    customer: "Amit Kumar",
    items: [
      { name: "Mix Veg", quantity: 2, price: 160 }
    ],
    totalPrice: 160,
  },
  {
    id: "7593519452",
    status: "DELIVERED",
    tags: ["IRCTC"],
    date: "19 Dec",
    time: "11:20 AM",
    restaurant: "Kadhai Chammach Restaurant",
    address: "By Pass Road (South), Indore",
    customer: "Neha Singh",
    items: [
      { name: "Veg Thali", quantity: 1, price: 220 }
    ],
    totalPrice: 220,
  }
]

// Initialize with current week if needed
const getCurrentWeek = () => {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday
  return { start: startOfWeek, end: endOfWeek }
}

const getLastWeek = () => {
  const today = new Date()
  const startOfLastWeek = new Date(today)
  startOfLastWeek.setDate(today.getDate() - today.getDay() - 6) // Monday of last week
  const endOfLastWeek = new Date(startOfLastWeek)
  endOfLastWeek.setDate(startOfLastWeek.getDate() + 6) // Sunday of last week
  return { start: startOfLastWeek, end: endOfLastWeek }
}

const getLast2Days = () => {
  const today = new Date()
  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(today.getDate() - 2)
  return { start: twoDaysAgo, end: today }
}

const getLast30Days = () => {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  return { start: thirtyDaysAgo, end: today }
}

const currentWeekDates = getCurrentWeek()
const lastWeekDates = getLastWeek()

const dateRangeOptions = [
  { label: "last 2 days", getDates: getLast2Days },
  { label: "this week", getDates: getCurrentWeek },
  { label: "last week", getDates: getLastWeek },
  { label: "last 30 days", getDates: getLast30Days },
  { label: "custom date range", custom: true }
]

// Filter categories and options
const filterCategories = [
  { id: "Order status", label: "Order status" },
  { id: "Ratings", label: "Ratings" },
  { id: "KPT delay", label: "KPT delay" },
  { id: "Complaints", label: "Complaints" },
  { id: "Order type", label: "Order type" }
]

const filterOptions = {
  "Order status": [
    { id: "preparing", label: "Preparing", key: "orderStatus" },
    { id: "ready", label: "Ready", key: "orderStatus" },
    { id: "out-for-delivery", label: "Out for delivery", key: "orderStatus" },
    { id: "delivered", label: "Delivered", key: "orderStatus" },
    { id: "rejected", label: "Rejected", key: "orderStatus" },
    { id: "cancelled", label: "Cancelled", key: "orderStatus" }
  ],
  "Ratings": [
    { id: "5-star", label: "5★ or less", key: "ratings", value: 5 },
    { id: "4-star", label: "4★ or less", key: "ratings", value: 4 },
    { id: "3-star", label: "3★ or less", key: "ratings", value: 3 },
    { id: "2-star", label: "2★ or less", key: "ratings", value: 2 },
    { id: "1-star", label: "1★", key: "ratings", value: 1 }
  ],
  "KPT delay": [
    { id: "0-10", label: "0-10 mins", key: "kptDelay" },
    { id: "10-20", label: "10-20 mins", key: "kptDelay" },
    { id: "20-30", label: "20-30 mins", key: "kptDelay" },
    { id: "30-plus", label: "30+ mins", key: "kptDelay" }
  ],
  "Complaints": [
    { id: "order-delayed", label: "Order delayed", key: "complaints" },
    { id: "wrong-items", label: "Wrong item(s) delivered", key: "complaints" },
    { id: "missing-items", label: "Item(s) missing or not delivered", key: "complaints" },
    { id: "poor-taste", label: "Poor taste or quality", key: "complaints" },
    { id: "poor-packaging", label: "Poor packaging or spillage", key: "complaints" },
    { id: "out-of-stock", label: "Item(s) out of stock", key: "complaints" },
    { id: "not-delivered", label: "Order not delivered", key: "complaints" }
  ],
  "Order type": [
    { id: "self-delivery", label: "Self delivery", key: "orderType" },
    { id: "food-rescue", label: "Food rescue", key: "orderType" },
    { id: "large-order", label: "Large order", key: "orderType" },
    { id: "veg-only", label: "Veg only", key: "orderType" },
    { id: "irctc", label: "IRCTC", key: "orderType" },
    { id: "replacement", label: "Replacement", key: "orderType" },
    { id: "hospital", label: "Hospital", key: "orderType" }
  ]
}

export default function AllOrdersPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [showCalendar, setShowCalendar] = useState(false)
  const [showDateRangePopup, setShowDateRangePopup] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState(dateRangeOptions[1]) // Default to "this week"
  const [startDate, setStartDate] = useState(currentWeekDates.start)
  const [endDate, setEndDate] = useState(currentWeekDates.end)
  const calendarRef = useRef(null)
  
  // Filter states
  const [showFilterPopup, setShowFilterPopup] = useState(false)
  const [activeFilterCategory, setActiveFilterCategory] = useState("Order status")
  const [filterSearch, setFilterSearch] = useState("")
  const [isApplyingFilters, setIsApplyingFilters] = useState(false)
  const [filters, setFilters] = useState({
    orderStatus: [],
    ratings: [],
    kptDelay: [],
    complaints: [],
    orderType: []
  })
  
  // Toast state
  const [showToast, setShowToast] = useState(false)
  
  // Real data states
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [restaurantData, setRestaurantData] = useState(null)
  const [activeMenuOrderId, setActiveMenuOrderId] = useState(null)
  const [hiddenOrderIds, setHiddenOrderIds] = useState(() => new Set(getHiddenOrderIds("restaurant")))

  // Fetch restaurant data
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
        }
      } catch (err) {
        // Suppress 401 errors as they're handled by axios interceptor
        if (err.response?.status !== 401) {
          console.error('Error fetching restaurant data:', err)
        }
      }
    }
    fetchRestaurantData()
  }, [])

  // Transform API order to component format
  const transformOrder = useCallback((order) => {
    const createdAt = new Date(order.createdAt)
    const date = createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const time = createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    
    // Format address
    const address = order.address?.formattedAddress || 
                    order.address?.address || 
                    (order.address?.street ? `${order.address.street}, ${order.address.city || ''}`.trim() : '') ||
                    'Address not available'
    
    // Get restaurant name
    const restaurantName = restaurantData?.name || order.restaurantId?.name || 'Restaurant'
    
    // Get customer name
    const customerName = order.userId?.name || order.customerName || 'Customer'
    
    // Format items
    const items = (order.items || []).map(item => ({
      name: item.name || 'Item',
      quantity: item.quantity || 1,
      price: item.price || 0
    }))
    
    // Determine status
    let status = order.status?.toUpperCase() || 'PENDING'
    if (status === 'CANCELLED') status = 'CANCELLED'
    else if (status === 'REJECTED') status = 'REJECTED'
    else if (status === 'DELIVERED') status = 'DELIVERED'
    else if (status === 'PREPARING') status = 'PREPARING'
    else if (status === 'READY') status = 'READY'
    else if (status === 'OUT_FOR_DELIVERY' || status === 'OUT FOR DELIVERY') status = 'OUT FOR DELIVERY'
    
    // Get rejection/cancellation reason
    let reason = null
    if (status === 'REJECTED' && order.rejectionReason) {
      reason = `Rejected by Restaurant: ${order.rejectionReason}`
    } else if (status === 'CANCELLED' && order.cancellationReason) {
      reason = `Cancelled by ${order.cancelledBy === 'customer' ? 'customer' : 'restaurant'}: ${order.cancellationReason}`
    } else if (status === 'REJECTED') {
      reason = 'Rejected by Restaurant'
    } else if (status === 'CANCELLED') {
      reason = 'Cancelled by customer'
    }
    
    // Determine tags based on order properties
    const tags = []
    if (order.sendCutlery) tags.push('CUTLERY')
    if (order.deliveryFleet === 'express') tags.push('EXPRESS DELIVERY')
    if (order.deliveryFleet === 'self') tags.push('SELF DELIVERY')
    // Check if all items are veg
    const allVeg = items.every(item => item.isVeg !== false)
    if (allVeg && items.length > 0) tags.push('VEG ONLY')
    
    return {
      id: order.orderId || order._id?.toString() || '',
      status,
      date,
      time,
      restaurant: restaurantName,
      address,
      customer: customerName,
      items,
      totalPrice: order.pricing?.total || 0,
      reason,
      tags: tags.length > 0 ? tags : undefined,
      createdAt: order.createdAt,
      mongoId: order._id?.toString()
    }
  }, [restaurantData])

  // Fetch orders from backend
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Build query params
        const params = {
          page: 1,
          limit: 1000 // Get all orders, we'll filter by date on frontend
        }
        
        // Fetch all orders (we'll filter by date range on frontend)
        const response = await restaurantAPI.getOrders(params)
        
        if (response.data?.success && response.data.data?.orders) {
          // Transform orders
          const transformedOrders = response.data.data.orders.map(transformOrder)
          
          // Filter by date range
          const filteredByDate = transformedOrders.filter(order => {
            if (!order.createdAt) return false
            const orderDate = new Date(order.createdAt)
            const start = new Date(startDate)
            start.setHours(0, 0, 0, 0)
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            return orderDate >= start && orderDate <= end
          })
          
          setOrders(filteredByDate)
        } else {
          setOrders([])
        }
      } catch (err) {
        // Suppress 401 errors as they're handled by axios interceptor
        if (err.response?.status !== 401) {
          console.error('Error fetching orders:', err)
          setError(err.message || 'Failed to fetch orders')
        }
        setOrders([])
      } finally {
        setLoading(false)
      }
    }
    
    if (!restaurantData) return // Don't fetch if restaurant data is not loaded yet
    
    fetchOrders()
  }, [startDate, endDate, restaurantData, transformOrder])

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (showDateRangePopup || showCalendar || showFilterPopup) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showDateRangePopup, showCalendar, showFilterPopup])

  const handleDateRangeChange = (start, end) => {
    setStartDate(start)
    setEndDate(end)
    setSelectedDateRange({ label: "custom date range", start, end, custom: true })
    setShowCalendar(false)
  }

  const handleDateRangeSelect = (option) => {
    if (option.custom) {
      setShowDateRangePopup(false)
      setShowCalendar(true)
    } else {
      const dates = option.getDates()
      setSelectedDateRange(option)
      setStartDate(dates.start)
      setEndDate(dates.end)
      setShowDateRangePopup(false)
    }
  }

  const formatDateRange = () => {
    if (!startDate || !endDate) return "Select date range"
    const startDay = startDate.getDate()
    const endDay = endDate.getDate()
    const month = startDate.toLocaleString('en-US', { month: 'short' })
    const year = startDate.getFullYear().toString().slice(-2)
    return `${startDay} - ${endDay} ${month}'${year}`
  }

  const handleCopyOrderId = (orderId, e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(orderId)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }

  const handleDeleteOrder = (order, e) => {
    e.stopPropagation()

    const orderId = String(order.id || order.orderId || "")
    if (!orderId) return

    const confirmed = window.confirm(`Do you want to delete order #${orderId}?`)
    if (!confirmed) return

    const nextHiddenOrderIds = hideOrderId("restaurant", orderId)
    setHiddenOrderIds(new Set(nextHiddenOrderIds))
    setActiveMenuOrderId(null)
    toast.success("Order deleted from your list")
  }

  const handleFilterToggle = (option) => {
    const key = option.key
    const value = option.id
    
    // For ratings, only allow one selection (radio button behavior)
    if (key === "ratings") {
      setFilters(prev => ({
        ...prev,
        [key]: prev[key].includes(value) ? [] : [value]
      }))
    } else {
      // For other filters, allow multiple selections (checkbox behavior)
      setFilters(prev => ({
        ...prev,
        [key]: prev[key].includes(value)
          ? prev[key].filter(v => v !== value)
          : [...prev[key], value]
      }))
    }
  }

  const handleClearFilters = () => {
    setFilters({
      orderStatus: [],
      ratings: [],
      kptDelay: [],
      complaints: [],
      orderType: []
    })
    setFilterSearch("")
  }

  const handleApplyFilters = async () => {
    setIsApplyingFilters(true)
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800))
    setIsApplyingFilters(false)
    setShowFilterPopup(false)
  }

  const isFilterChecked = (option) => {
    return filters[option.key]?.includes(option.id) || false
  }

  const hasActiveFilters = () => {
    return Object.values(filters).some(arr => arr.length > 0)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "REJECTED":
      case "CANCELLED":
        return "bg-red-700 text-white"
      case "DELIVERED":
        return "bg-red-600 text-white"
      case "PREPARING":
        return "bg-yellow-600 text-white"
      case "READY":
        return "bg-blue-600 text-white"
      case "OUT FOR DELIVERY":
        return "bg-purple-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const filteredOrders = orders.filter(order => {
    const orderId = String(order.id || order.orderId || "")
    if (hiddenOrderIds.has(orderId)) return false

    // Search filter - search in order ID (both full ID and numeric part)
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase().trim().replace(/\s/g, "")
      if (searchLower) {
        const orderIdStr = String(order.id ?? order.orderId ?? "").toLowerCase()
        const numericPart = orderIdStr.replace(/\D/g, "")
        if (!orderIdStr.includes(searchLower) && !numericPart.includes(searchLower)) return false
      }
    }

    // Order status filter
    if (filters.orderStatus.length > 0) {
      const statusMap = {
        'preparing': 'PREPARING',
        'ready': 'READY',
        'out-for-delivery': 'OUT FOR DELIVERY',
        'delivered': 'DELIVERED',
        'rejected': 'REJECTED',
        'cancelled': 'CANCELLED'
      }
      const matchesStatus = filters.orderStatus.some(
        statusId => statusMap[statusId] === order.status
      )
      if (!matchesStatus) return false
    }

    // Order type filter
    if (filters.orderType.length > 0) {
      const hasMatchingTag = order.tags?.some(tag => {
        const tagLower = tag.toLowerCase().replace(/\s+/g, '-')
        return filters.orderType.includes(tagLower)
      })
      if (!hasMatchingTag) return false
    }

    return true
  })

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1">
            <p className="text-sm text-gray-600">Showing order history for</p>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900">
                {restaurantData?.name || 'Restaurant'}
              </h1>
              <ChevronDown className="w-4 h-4 text-gray-600" />
            </div>
          </div>
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="w-5 h-5 text-gray-900" />
          </button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="px-4 py-4 space-y-3">
        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.replace(/\s/g, ""))}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilterPopup(true)}
            className={`p-2.5 border rounded-lg transition-colors relative ${
              hasActiveFilters() 
                ? 'bg-blue-50 border-blue-500 hover:bg-blue-100' 
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
            aria-label="Filter"
          >
            <Filter className={`w-5 h-5 ${hasActiveFilters() ? 'text-blue-600' : 'text-gray-900'}`} />
            {hasActiveFilters() && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full text-white text-xs flex items-center justify-center font-bold">
                {Object.values(filters).flat().length}
              </span>
            )}
          </button>
        </div>

        {/* Date Range Selector */}
        <button
          onClick={() => setShowDateRangePopup(true)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900 capitalize">{selectedDateRange.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatDateRange()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </button>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters() && (
        <div className="px-4 pb-2">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-900">
                <span className="font-semibold">{Object.values(filters).flat().length}</span> filter{Object.values(filters).flat().length !== 1 ? 's' : ''} applied
              </span>
            </div>
            <button
              onClick={handleClearFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
            >
              Clear all
            </button>
          </motion.div>
        </div>
      )}

      {/* Orders List */}
      <div className="px-4 pb-24 space-y-3">
        {loading && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 text-sm">Loading orders...</p>
            </div>
          </div>
        )}
        
        {!loading && error && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="flex flex-col items-center gap-3">
              <p className="text-red-600 font-medium text-sm">Error loading orders</p>
              <p className="text-gray-500 text-xs">{error}</p>
            </div>
          </div>
        )}
        
        {!loading && !error && (
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order, index) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ 
                duration: 0.3, 
                delay: Math.min(index * 0.05, 0.3),
                layout: { duration: 0.3 }
              }}
              onClick={() => navigate(`/restaurant/orders/${order.id}`)}
              className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
            {/* Status and Order ID Row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded text-xs font-bold ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
                {order.tags && order.tags.map((tag, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded text-xs font-bold bg-red-600 text-white">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{order.date}, {order.time}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveMenuOrderId(current => current === order.id ? null : order.id)
                  }}
                  className="rounded-full p-1 hover:bg-gray-100 transition-colors"
                  aria-label="Order actions"
                >
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {activeMenuOrderId === order.id && (
              <>
                <button
                  type="button"
                  aria-label="Close order actions"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveMenuOrderId(null)
                  }}
                  className="fixed inset-0 z-30 bg-black/30"
                />
                <div
                  className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl bg-white px-4 pb-6 pt-3 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{order.restaurant}</p>
                      <p className="text-xs text-gray-500">Order #{order.id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuOrderId(null)
                      }}
                      className="rounded-full p-2 hover:bg-gray-100"
                    >
                      <X className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteOrder(order, e)}
                    className="flex w-full items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-100"
                  >
                    Delete order
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {/* Order ID */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base font-bold text-gray-900">ID: {order.id}</span>
              <button
                onClick={(e) => handleCopyOrderId(order.id, e)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Copy order ID"
              >
                <Copy className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Restaurant Info */}
            <p className="text-sm text-gray-900 mb-1">
              {order.restaurant}, {order.address}
            </p>

            {/* Customer Info */}
            <p className="text-sm text-gray-600 mb-3">
              Ordered by {order.customer}
            </p>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-300 my-3"></div>

            {/* Order Items */}
            <div className="space-y-2">
              {order.items.slice(0, 1).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">
                    {item.quantity} x {item.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900">₹{item.price}</span>
                </div>
              ))}
              {order.items.length > 1 && (
                <p className="text-sm text-gray-500">+{order.items.length - 1} more items</p>
              )}
            </div>

            {/* Reason/Status Message */}
            {order.reason && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-red-600">{order.reason}</p>
              </div>
            )}
          </motion.div>
        ))}
          </AnimatePresence>
        )}

        {!loading && !error && filteredOrders.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 bg-white rounded-lg border border-gray-200"
          >
            <div className="flex flex-col items-center gap-3">
              <Filter className="w-12 h-12 text-gray-300" />
              <div>
                <p className="text-gray-900 font-medium text-sm mb-1">No orders found</p>
                <p className="text-gray-500 text-xs">Try adjusting your filters</p>
              </div>
              {hasActiveFilters() && (
                <button
                  onClick={handleClearFilters}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Date Range Selection Popup */}
      <AnimatePresence>
        {showDateRangePopup && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowDateRangePopup(false)}
            />
            
            {/* Popup Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ 
                type: "spring",
                damping: 30,
                stiffness: 300
              }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold text-gray-900">Select date range</h2>
                <button
                  onClick={() => setShowDateRangePopup(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-900" />
                </button>
              </div>

              {/* Options */}
              <div className="px-6 py-4">
                {dateRangeOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleDateRangeSelect(option)}
                    className="w-full text-left py-4 px-4 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <span className="text-base text-gray-900 capitalize">{option.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Calendar Popup */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowCalendar(false)}>
          <div ref={calendarRef} onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg shadow-lg">
            <DateRangeCalendar
              startDate={startDate}
              endDate={endDate}
              onDateRangeChange={handleDateRangeChange}
              onClose={() => setShowCalendar(false)}
            />
          </div>
        </div>
      )}

      {/* Filter Popup */}
      <AnimatePresence>
        {showFilterPopup && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowFilterPopup(false)}
            />
            
            {/* Filter Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ 
                type: "spring",
                damping: 30,
                stiffness: 300
              }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 flex flex-col"
              style={{ height: '65vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                <button
                  onClick={() => setShowFilterPopup(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-900" />
                </button>
              </div>

              {/* Main Content */}
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Categories */}
                <div className="w-28 bg-gray-50 border-r border-gray-200 overflow-y-auto">
                  {filterCategories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setActiveFilterCategory(category.id)
                        setFilterSearch("")
                      }}
                      className={`w-full px-2 py-3 text-left text-xs transition-colors border-b border-gray-200 ${
                        activeFilterCategory === category.id
                          ? 'bg-white text-gray-900 font-semibold border-2 border-l-black'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>

                {/* Filter Options */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Search Bar */}
                  <div className="p-3 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="flex-1 overflow-y-auto px-3 py-2">
                    {filterOptions[activeFilterCategory]
                      ?.filter(option => 
                        option.label.toLowerCase().includes(filterSearch.toLowerCase())
                      )
                      .map((option) => {
                        const isChecked = isFilterChecked(option)
                        const isRadio = activeFilterCategory === "Ratings"
                        
                        return (
                          <label
                            key={option.id}
                            className="flex items-center py-2.5 cursor-pointer hover:bg-gray-50 rounded-lg px-2 transition-colors"
                          >
                            <div className="relative flex items-center justify-center">
                              {isRadio ? (
                                <div
                                  onClick={() => handleFilterToggle(option)}
                                  className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-all ${
                                    isChecked 
                                      ? 'border-blue-600 bg-white' 
                                      : 'border-gray-300 bg-white'
                                  }`}
                                >
                                  {isChecked && (
                                    <div className="w-full h-full rounded-full flex items-center justify-center">
                                      <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleFilterToggle(option)}
                                  className="w-5 h-5 border-2 border-gray-300 rounded cursor-pointer transition-all appearance-none checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 relative"
                                  style={{
                                    backgroundImage: isChecked ? `url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")` : 'none',
                                    backgroundSize: '100% 100%',
                                    backgroundPosition: '50%',
                                    backgroundRepeat: 'no-repeat'
                                  }}
                                />
                              )}
                            </div>
                            <span className="ml-3 text-sm text-gray-900">{option.label}</span>
                          </label>
                        )
                      })}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-200 bg-white">
                <button
                  onClick={handleClearFilters}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Clear all
                </button>
                <button
                  onClick={handleApplyFilters}
                  disabled={isApplyingFilters}
                  className="flex-1 px-4 py-2.5 bg-black rounded-lg text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isApplyingFilters ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Applying...
                    </>
                  ) : (
                    'Apply'
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isApplyingFilters && !showFilterPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-sm font-medium text-gray-900">Applying filters...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">Order ID copied to clipboard</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
