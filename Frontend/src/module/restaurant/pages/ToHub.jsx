import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { DateRangeCalendar } from "@/components/ui/date-range-calendar"
import { Bell, HelpCircle, Menu, Search, TrendingUp, BarChart3, Users, CalendarRange, Download, ChevronLeft, ChevronRight, Wand2, X, MapPin } from "lucide-react"
import {
  FaPhone,
  FaHistory,
  FaExclamationTriangle,
  FaStar,
  FaCommentDots,
  FaLink,
  FaCog,
  FaThLarge
} from "react-icons/fa"
import {
  AreaChart,
  Area,
  Line,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
} from "recharts"
import { Play } from "lucide-react"
import BottomNavOrders from "../components/BottomNavOrders"
import { restaurantAPI } from "@/lib/api"

export default function ToHub() {
  const navigate = useNavigate()
  const topTabs = [
    { id: "my-feed", label: "My feed" },
    { id: "sales", label: "Sales" },
  ]
  const [activeTopTab, setActiveTopTab] = useState("my-feed")
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(true)

  // Fetch restaurant data on mount
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoadingRestaurant(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          console.error("Error fetching restaurant data:", error)
        }
        // Continue with default values if fetch fails
      } finally {
        setLoadingRestaurant(false)
      }
    }

    fetchRestaurantData()
  }, [])
  const topTabBarRef = useRef(null)
  const contentContainerRef = useRef(null)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)
  const mouseStartX = useRef(0)
  const mouseEndX = useRef(0)
  const isMouseDown = useRef(false)
  
  // Learn more popup states
  const [learnMorePopupOpen, setLearnMorePopupOpen] = useState(false)
  const [selectedCardInfo, setSelectedCardInfo] = useState(null)

  // Card definitions data
  const cardDefinitions = {
    sales: {
      title: "Sales",
      metrics: [
        { name: "Net sales", definition: "Total revenue from delivered orders after deductions" },
        { name: "Orders delivered", definition: "Number of successfully completed customer orders" },
        { name: "Avg. order value", definition: "Average amount spent per order by customers" }
      ]
    },
    customers: {
      title: "Customers",
      metrics: [
        { name: "New customers", definition: "First-time visitors ordering from your restaurant" },
        { name: "Repeat customers", definition: "Returning customers who ordered before" },
        { name: "Lapsed customers", definition: "Previous customers who haven't ordered recently" }
      ]
    },
    "orders-by-mealtime": {
      title: "Orders by mealtime",
      metrics: [
        { name: "Breakfast", definition: "Morning orders between 6 AM to 11 AM" },
        { name: "Lunch", definition: "Afternoon orders between 11 AM to 4 PM" },
        { name: "Snacks", definition: "Evening orders between 4 PM to 7 PM" },
        { name: "Dinner", definition: "Night orders between 7 PM onwards" }
      ]
    },
    offers: {
      title: "Offers",
      metrics: [
        { name: "Discount given", definition: "Total amount discounted on orders" },
        { name: "Orders from offers", definition: "Orders placed using your active offers" },
        { name: "Effective discount %", definition: "Average discount percentage given to customers" },
        { name: "Offer orders %", definition: "Percentage of total orders using offers" }
      ]
    },
    ads: {
      title: "Ads",
      metrics: [
        { name: "Ad impressions", definition: "Times your ad was shown to customers" },
        { name: "Orders from ads", definition: "Orders received through ad campaigns" },
        { name: "Ad spends", definition: "Total amount spent on advertising" },
        { name: "ROI", definition: "Return on investment from ad spending" }
      ]
    },
    "sales-orders": {
      title: "Sales & orders",
      metrics: [
        { name: "Net sales", definition: "Total revenue from delivered orders" },
        { name: "Orders delivered", definition: "Successfully completed customer orders" }
      ]
    },
    "avg-order-value": {
      title: "Average order value",
      metrics: [
        { name: "Avg. order value", definition: "Average amount spent per order" }
      ]
    },
    "find-you": {
      title: "Where customers find you",
      metrics: [
        { name: "Search", definition: "Found through search queries" },
        { name: "Category", definition: "Found through category browsing" },
        { name: "Previously ordered", definition: "Found in past orders section" }
      ]
    },
    impressions: {
      title: "Impressions",
      metrics: [
        { name: "Total impressions", definition: "Total times shown in app" }
      ]
    },
    "impressions-by-customer": {
      title: "Impressions by customer type",
      metrics: [
        { name: "New customers", definition: "Impressions to first-time users" },
        { name: "Repeat customers", definition: "Impressions to returning users" },
        { name: "Lapsed customers", definition: "Impressions to inactive users" }
      ]
    },
    "menu-opens": {
      title: "Menu opens",
      metrics: [
        { name: "Total menu opens", definition: "Times menu was viewed" }
      ]
    },
    "menu-opens-by-customer": {
      title: "Menu opens by customer type",
      metrics: [
        { name: "New customers", definition: "Menu views by first-timers" },
        { name: "Repeat customers", definition: "Menu views by returning users" },
        { name: "Lapsed customers", definition: "Menu views by inactive users" }
      ]
    },
    "orders-placed": {
      title: "Orders placed",
      metrics: [
        { name: "Total orders", definition: "All orders received" }
      ]
    },
    "orders-by-customer": {
      title: "Orders placed by customer type",
      metrics: [
        { name: "New customers", definition: "Orders from first-timers" },
        { name: "Repeat customers", definition: "Orders from returning users" },
        { name: "Lapsed customers", definition: "Orders from inactive users" }
      ]
    }
  }

  const handleLearnMoreClick = (cardId, e) => {
    e.stopPropagation()
    setSelectedCardInfo(cardDefinitions[cardId])
    setLearnMorePopupOpen(true)
  }

  const scrollToTopTab = (index) => {
    if (topTabBarRef.current) {
      const buttons = topTabBarRef.current.querySelectorAll("button")
      if (buttons[index]) {
        const button = buttons[index]
        const container = topTabBarRef.current
        const buttonLeft = button.offsetLeft
        const buttonWidth = button.offsetWidth
        const containerWidth = container.offsetWidth
        const scrollLeft = buttonLeft - containerWidth / 2 + buttonWidth / 2

        container.scrollTo({
          left: scrollLeft,
          behavior: "smooth",
        })
      }
    }
  }

  useEffect(() => {
    const index = topTabs.findIndex((tab) => tab.id === activeTopTab)
    if (index >= 0) {
      requestAnimationFrame(() => scrollToTopTab(index))
    }
  }, [activeTopTab])

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (learnMorePopupOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [learnMorePopupOpen])

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
      const currentIndex = topTabs.findIndex(tab => tab.id === activeTopTab)
      let newIndex = currentIndex
      
      if (swipeDistance > 0 && currentIndex < topTabs.length - 1) {
        // Swipe left - go to next tab (right side)
        newIndex = currentIndex + 1
      } else if (swipeDistance < 0 && currentIndex > 0) {
        // Swipe right - go to previous tab (left side)
        newIndex = currentIndex - 1
      }

      if (newIndex !== currentIndex) {
        setIsTransitioning(true)
        
        // Smooth transition with animation
        setTimeout(() => {
          setActiveTopTab(topTabs[newIndex].id)
          
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

  const quickLinks = [
    { id: "growth-helpline", label: "Growth helpline", icon: FaPhone, route: "tel:+911111111111", isPhone: true },
    { id: "order-history", label: "Order history", icon: FaHistory, route: "/restaurant/orders/all" },
    { id: "complaints", label: "Complaints", icon: FaExclamationTriangle, route: "/restaurant/feedback?tab=complaints" },
    { id: "reviews", label: "Reviews", icon: FaStar, route: "/restaurant/feedback" },
    { id: "feedback", label: "Share your feedback", icon: FaCommentDots, route: "/restaurant/Share-Feedback" },
    { id: "zone-setup", label: "Zone Setup", icon: MapPin, route: "/restaurant/zone-setup" },
    { id: "settings", label: "Settings", icon: FaCog, route: "/restaurant/settings" },
    { id: "show-all", label: "Show all", icon: FaThLarge, route: "/restaurant/explore" },
  ]

  const [chartData, setChartData] = useState([
    { hour: "12am", orders: 0, sales: 0 },
    { hour: "4am", orders: 0, sales: 0 },
    { hour: "8am", orders: 0, sales: 0 },
    { hour: "12pm", orders: 0, sales: 0 },
    { hour: "4pm", orders: 0, sales: 0 },
    { hour: "8pm", orders: 0, sales: 0 },
    { hour: "12am", orders: 0, sales: 0 },
  ])

  const [totalSales, setTotalSales] = useState("₹ 0")
  const [totalOrders, setTotalOrders] = useState("0")
  const [avgOrderValue, setAvgOrderValue] = useState("₹ 0")
  const [lastUpdated, setLastUpdated] = useState(null)
  const [mealtimeMetrics, setMealtimeMetrics] = useState([
    { title: "Breakfast", window: "7:00 am - 11:00 am", value: "0", change: "- 0%", color: "#111827" },
    { title: "Lunch", window: "11:00 am - 4:00 pm", value: "0", change: "- 0%", color: "#ef4444" },
    { title: "Evening snacks", window: "4:00 pm - 7:00 pm", value: "0", change: "- 0%", color: "#2563eb" },
    { title: "Dinner", window: "7:00 pm - 11:00 pm", value: "0", change: "- 0%", color: "#f59e0b" },
    { title: "Late night", window: "11:00 pm - 7:00 am", value: "0", change: "- 0%", color: "#671E1F" },
  ])
  const [customerSegments, setCustomerSegments] = useState({
    newCount: 0,
    repeatCount: 0,
    lapsedCount: 0,
    total: 0,
    lastUpdated: null,
  })
  const [impressionsCustomerView, setImpressionsCustomerView] = useState("affinity")
  const [menuOpensCustomerView, setMenuOpensCustomerView] = useState("affinity")
  const [ordersPlacedCustomerView, setOrdersPlacedCustomerView] = useState("affinity")
  const [complaintsView, setComplaintsView] = useState("all")
  const [rejectionsReasonsView] = useState("all")
  const [complaintsTabView, setComplaintsTabView] = useState("all")
  const [isKptVideoOpen, setIsKptVideoOpen] = useState(false)
  const [offersCustomerView, setOffersCustomerView] = useState("affinity")
  const [adImpressionsCustomerView, setAdImpressionsCustomerView] = useState("affinity")
  const [impressionsData] = useState([
    { hour: "12am", impressions: 1 },
    { hour: "4am", impressions: 11 },
    { hour: "8am", impressions: 0 },
    { hour: "12pm", impressions: 4 },
    { hour: "4pm", impressions: 2 },
    { hour: "8pm", impressions: 5 },
    { hour: "12am", impressions: 1 },
  ])
  const [rejectedOrdersData] = useState([
    { hour: "12am", orders: 0, sales: 0 },
    { hour: "4am", orders: 1, sales: 120 },
    { hour: "8am", orders: 0, sales: 0 },
    { hour: "12pm", orders: 0, sales: 0 },
    { hour: "4pm", orders: 1, sales: 90 },
    { hour: "8pm", orders: 0, sales: 0 },
    { hour: "12am", orders: 0, sales: 0 },
  ])
  const [poorRatedData] = useState([
    { hour: "12am", value: 0 },
    { hour: "4am", value: 0 },
    { hour: "8am", value: 0 },
    { hour: "12pm", value: 0 },
    { hour: "4pm", value: 0 },
    { hour: "8pm", value: 0 },
    { hour: "12am", value: 0 },
  ])
  const [complaintsData] = useState([
    { hour: "12am", value: 0 },
    { hour: "4am", value: 0 },
    { hour: "8am", value: 0 },
    { hour: "12pm", value: 0 },
    { hour: "4pm", value: 0 },
    { hour: "8pm", value: 0 },
    { hour: "12am", value: 0 },
  ])
  const [availabilityData] = useState([
    { hour: "12am", online: 1, offline: 0 },
    { hour: "4am", online: 1, offline: 0 },
    { hour: "8am", online: 1, offline: 0 },
    { hour: "12pm", online: 1, offline: 0 },
    { hour: "4pm", online: 1, offline: 0 },
    { hour: "8pm", online: 1, offline: 0 },
    { hour: "12am", online: 1, offline: 0 },
  ])
  const [offersWeeklyData] = useState([
    { day: "M", totalGross: 0, offersGross: 0, discountGiven: 0, effectiveDiscount: 0, ordersFromOffers: 0, totalOrders: 0 },
    { day: "T", totalGross: 0, offersGross: 0, discountGiven: 0, effectiveDiscount: 0, ordersFromOffers: 0, totalOrders: 0 },
    { day: "W", totalGross: 0, offersGross: 0, discountGiven: 0, effectiveDiscount: 0, ordersFromOffers: 0, totalOrders: 0 },
    { day: "T", totalGross: 0, offersGross: 0, discountGiven: 0, effectiveDiscount: 0, ordersFromOffers: 0, totalOrders: 0 },
    { day: "F", totalGross: 0, offersGross: 0, discountGiven: 0, effectiveDiscount: 0, ordersFromOffers: 0, totalOrders: 0 },
    { day: "S", totalGross: 0, offersGross: 0, discountGiven: 0, effectiveDiscount: 0, ordersFromOffers: 0, totalOrders: 0 },
    { day: "S", totalGross: 0, offersGross: 0, discountGiven: 0, effectiveDiscount: 0, ordersFromOffers: 0, totalOrders: 0 },
  ])
  const [adsSalesWeeklyData] = useState([
    { day: "M", salesFromAds: 0, totalSales: 0 },
    { day: "T", salesFromAds: 0, totalSales: 0 },
    { day: "W", salesFromAds: 0, totalSales: 0 },
    { day: "T", salesFromAds: 0, totalSales: 0 },
    { day: "F", salesFromAds: 0, totalSales: 0 },
    { day: "S", salesFromAds: 0, totalSales: 0 },
    { day: "S", salesFromAds: 0, totalSales: 0 },
  ])
  const [adsSpendsROIWeeklyData] = useState([
    { day: "M", adSpends: 0, roi: 0 },
    { day: "T", adSpends: 0, roi: 0 },
    { day: "W", adSpends: 0, roi: 0 },
    { day: "T", adSpends: 0, roi: 0 },
    { day: "F", adSpends: 0, roi: 0 },
    { day: "S", adSpends: 0, roi: 0 },
    { day: "S", adSpends: 0, roi: 0 },
  ])
  const [percentageOrdersFromAdsWeeklyData] = useState([
    { day: "M", percentageOrdersFromAds: 0 },
    { day: "T", percentageOrdersFromAds: 0 },
    { day: "W", percentageOrdersFromAds: 0 },
    { day: "T", percentageOrdersFromAds: 0 },
    { day: "F", percentageOrdersFromAds: 0 },
    { day: "S", percentageOrdersFromAds: 0 },
    { day: "S", percentageOrdersFromAds: 0 },
  ])
  const [adImpressionsWeeklyData] = useState([
    { day: "M", adImpressions: 0 },
    { day: "T", adImpressions: 0 },
    { day: "W", adImpressions: 0 },
    { day: "T", adImpressions: 0 },
    { day: "F", adImpressions: 0 },
    { day: "S", adImpressions: 0 },
    { day: "S", adImpressions: 0 },
  ])
  const [adCTRM2OWeeklyData] = useState([
    { day: "M", adCTR: 0, adM2O: 0 },
    { day: "T", adCTR: 0, adM2O: 0 },
    { day: "W", adCTR: 0, adM2O: 0 },
    { day: "T", adCTR: 0, adM2O: 0 },
    { day: "F", adCTR: 0, adM2O: 0 },
    { day: "S", adCTR: 0, adM2O: 0 },
    { day: "S", adCTR: 0, adM2O: 0 },
  ])
  const discountTypeBreakup = [
    { title: "Promo discounts", value: "₹0", change: "- 0%", color: "#111827" },
    { title: "Dish discounts", value: "₹0", change: "- 0%", color: "#ef4444" },
    { title: "Buy 1 Get 1, etc.", value: "₹0", change: "- 0%", color: "#2563eb" },
    { title: "Freebie", value: "₹0", change: "- 0%", color: "#f59e0b" },
    { title: "Gold discount", value: "₹0", change: "- 0%", color: "#671E1F" },
    { title: "Winback discount", value: "₹0", change: "- 0%", color: "#d1d5db" },
  ]
  const offersCustomerAffinity = [
    { title: "New customers", sub: "No orders in last 90 days", value: "0", change: "- 0%", color: "#111827" },
    { title: "Repeat customers", sub: "Ordered in last 60 days", value: "0", change: "- 0%", color: "#ef4444" },
    { title: "Lapsed customers", sub: "Last order 60 to 90 days ago", value: "0", change: "- 0%", color: "#2563eb" },
  ]
  const offersCustomerSpending = [
    { title: "Mass market customers", value: "0", change: "- 0%", color: "#111827" },
    { title: "Mid premium customers", value: "0", change: "- 0%", color: "#ef4444" },
    { title: "Premium customers", value: "0", change: "- 0%", color: "#2563eb" },
  ]
  const adsBreakup = [
    { title: "Visit pack", value: "0%", change: "- 0%", color: "#111827" },
    { title: "Video ads", value: "0%", change: "- 0%", color: "#ef4444" },
    { title: "Branding on Search (BoS)", value: "0%", change: "- 0%", color: "#2563eb" },
    { title: "Others", value: "0%", change: "- 0%", color: "#f59e0b" },
  ]
  const adImpressionsCustomerAffinity = [
    { title: "New customers", sub: "No orders in last 365 days", value: "0", change: "- 0%", color: "#111827" },
    { title: "Repeat customers", sub: "Ordered in last 60 days", value: "0", change: "- 0%", color: "#ef4444" },
    { title: "Lapsed customers", sub: "Last order 60 to 365 days ago", value: "0", change: "- 0%", color: "#2563eb" },
  ]
  const adImpressionsCustomerSpending = [
    { title: "Mass market customers", value: "0", change: "- 0%", color: "#111827" },
    { title: "Mid premium customers", value: "0", change: "- 0%", color: "#ef4444" },
    { title: "Premium customers", value: "0", change: "- 0%", color: "#2563eb" },
  ]
  const [menuOpensData] = useState([
    { hour: "12am", opens: 0, i2m: 0 },
    { hour: "4am", opens: 2, i2m: 0.2 },
    { hour: "8am", opens: 0, i2m: 0 },
    { hour: "12pm", opens: 0, i2m: 0 },
    { hour: "4pm", opens: 1, i2m: 0.6 },
    { hour: "8pm", opens: 1, i2m: 1.1 },
    { hour: "12am", opens: 0, i2m: 0.1 },
  ])
  const [isDateSelectorOpen, setIsDateSelectorOpen] = useState(false)
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState("yesterday")
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null })
  const [isDateLoading, setIsDateLoading] = useState(false)
  
  // Helper functions for date ranges
  const getDateRanges = () => {
    const now = new Date()
    const today = new Date(now)
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)

    const thisWeekStart = new Date(now)
    thisWeekStart.setDate(now.getDate() - now.getDay() + 1)
    const thisWeekEnd = new Date(thisWeekStart)
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6)
 
    const lastWeekEnd = new Date(thisWeekStart)
    lastWeekEnd.setDate(thisWeekStart.getDate() - 1)
    const lastWeekStart = new Date(lastWeekEnd)
    lastWeekStart.setDate(lastWeekEnd.getDate() - 6)

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const last5DaysEnd = new Date(now)
    const last5DaysStart = new Date(now)
    last5DaysStart.setDate(now.getDate() - 4)

    return {
      today,
      yesterday,
      thisWeekStart,
      thisWeekEnd,
      lastWeekStart,
      lastWeekEnd,
      thisMonthStart,
      thisMonthEnd,
      lastMonthStart,
      lastMonthEnd,
      last5DaysStart,
      last5DaysEnd,
    }
  }
  
  // Calculate chart data from real orders
  const calculateChartDataFromOrders = (orders, startDate, endDate) => {
    // Initialize hour buckets
    const hourBuckets = {
      "12am": { orders: 0, sales: 0 },
      "4am": { orders: 0, sales: 0 },
      "8am": { orders: 0, sales: 0 },
      "12pm": { orders: 0, sales: 0 },
      "4pm": { orders: 0, sales: 0 },
      "8pm": { orders: 0, sales: 0 },
    }
    
    // Filter orders by date range
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    
    const filteredOrders = orders.filter(order => {
      if (!order.createdAt) return false
      const orderDate = new Date(order.createdAt)
      return orderDate >= start && orderDate <= end
    })
    
    // Calculate total sales and orders
    let totalSalesAmount = 0
    let totalOrdersCount = 0
    
    // Group orders by hour
    filteredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt)
      const hour = orderDate.getHours()
      
      // Determine hour bucket
      let hourLabel
      if (hour >= 0 && hour < 4) hourLabel = "12am"
      else if (hour >= 4 && hour < 8) hourLabel = "4am"
      else if (hour >= 8 && hour < 12) hourLabel = "8am"
      else if (hour >= 12 && hour < 16) hourLabel = "12pm"
      else if (hour >= 16 && hour < 20) hourLabel = "4pm"
      else hourLabel = "8pm" // 20-23
      
      const orderAmount = order.pricing?.total || 0
      
      hourBuckets[hourLabel].orders += 1
      hourBuckets[hourLabel].sales += orderAmount
      totalSalesAmount += orderAmount
      totalOrdersCount += 1
    })
    
    // Convert to chart data format
    const chartData = [
      { hour: "12am", orders: hourBuckets["12am"].orders, sales: Math.round(hourBuckets["12am"].sales) },
      { hour: "4am", orders: hourBuckets["4am"].orders, sales: Math.round(hourBuckets["4am"].sales) },
      { hour: "8am", orders: hourBuckets["8am"].orders, sales: Math.round(hourBuckets["8am"].sales) },
      { hour: "12pm", orders: hourBuckets["12pm"].orders, sales: Math.round(hourBuckets["12pm"].sales) },
      { hour: "4pm", orders: hourBuckets["4pm"].orders, sales: Math.round(hourBuckets["4pm"].sales) },
      { hour: "8pm", orders: hourBuckets["8pm"].orders, sales: Math.round(hourBuckets["8pm"].sales) },
      { hour: "12am", orders: 0, sales: 0 }, // Next day marker
    ]
    
    return {
      chartData,
      totalSales: Math.round(totalSalesAmount),
      totalOrders: totalOrdersCount
    }
  }
  
  // Calculate mealtime data from orders
  const calculateMealtimeData = (orders, startDate, endDate) => {
    // Initialize mealtime buckets
    const mealtimeBuckets = {
      breakfast: { count: 0, color: "#111827" },
      lunch: { count: 0, color: "#ef4444" },
      eveningSnacks: { count: 0, color: "#2563eb" },
      dinner: { count: 0, color: "#f59e0b" },
      lateNight: { count: 0, color: "#671E1F" },
    }
    
    // Filter orders by date range
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    
    const filteredOrders = orders.filter(order => {
      if (!order.createdAt) return false
      const orderDate = new Date(order.createdAt)
      return orderDate >= start && orderDate <= end
    })
    
    // Group orders by mealtime
    filteredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt)
      const hour = orderDate.getHours()
      const minute = orderDate.getMinutes()
      const timeInMinutes = hour * 60 + minute
      
      // Breakfast: 7:00 am - 11:00 am (420 - 660 minutes)
      if (timeInMinutes >= 420 && timeInMinutes < 660) {
        mealtimeBuckets.breakfast.count++
      }
      // Lunch: 11:00 am - 4:00 pm (660 - 960 minutes)
      else if (timeInMinutes >= 660 && timeInMinutes < 960) {
        mealtimeBuckets.lunch.count++
      }
      // Evening snacks: 4:00 pm - 7:00 pm (960 - 1140 minutes)
      else if (timeInMinutes >= 960 && timeInMinutes < 1140) {
        mealtimeBuckets.eveningSnacks.count++
      }
      // Dinner: 7:00 pm - 11:00 pm (1140 - 1380 minutes, or 1140 - 1440)
      else if (timeInMinutes >= 1140 && timeInMinutes < 1380) {
        mealtimeBuckets.dinner.count++
      }
      // Late night: 11:00 pm - 7:00 am (1380 - 1440 and 0 - 420 minutes)
      else if (timeInMinutes >= 1380 || timeInMinutes < 420) {
        mealtimeBuckets.lateNight.count++
      }
    })
    
    const totalOrdersCount = filteredOrders.length
    
    // Calculate percentages and format data
    const calculatePercentage = (count, total) => {
      if (total === 0) return "- 0%"
      const percentage = ((count / total) * 100).toFixed(1)
      return `${percentage}%`
    }
    
    return [
      { 
        title: "Breakfast", 
        window: "7:00 am - 11:00 am", 
        value: mealtimeBuckets.breakfast.count.toString(), 
        change: calculatePercentage(mealtimeBuckets.breakfast.count, totalOrdersCount), 
        color: mealtimeBuckets.breakfast.color 
      },
      { 
        title: "Lunch", 
        window: "11:00 am - 4:00 pm", 
        value: mealtimeBuckets.lunch.count.toString(), 
        change: calculatePercentage(mealtimeBuckets.lunch.count, totalOrdersCount), 
        color: mealtimeBuckets.lunch.color 
      },
      { 
        title: "Evening snacks", 
        window: "4:00 pm - 7:00 pm", 
        value: mealtimeBuckets.eveningSnacks.count.toString(), 
        change: calculatePercentage(mealtimeBuckets.eveningSnacks.count, totalOrdersCount), 
        color: mealtimeBuckets.eveningSnacks.color 
      },
      { 
        title: "Dinner", 
        window: "7:00 pm - 11:00 pm", 
        value: mealtimeBuckets.dinner.count.toString(), 
        change: calculatePercentage(mealtimeBuckets.dinner.count, totalOrdersCount), 
        color: mealtimeBuckets.dinner.color 
      },
      { 
        title: "Late night", 
        window: "11:00 pm - 7:00 am", 
        value: mealtimeBuckets.lateNight.count.toString(), 
        change: calculatePercentage(mealtimeBuckets.lateNight.count, totalOrdersCount), 
        color: mealtimeBuckets.lateNight.color 
      },
    ]
  }

  // Calculate basic customer segments (new / repeat / lapsed) from orders
  const calculateCustomerSegments = (orders) => {
    if (!Array.isArray(orders) || orders.length === 0) {
      return { newCount: 0, repeatCount: 0, lapsedCount: 0, total: 0 }
    }

    const now = new Date()
    const customersMap = new Map()

    orders.forEach((order) => {
      if (!order) return
      const createdAt = order.createdAt ? new Date(order.createdAt) : null
      if (!createdAt || Number.isNaN(createdAt.getTime())) return

      const user = order.userId || order.customer || {}
      const customerKey =
        user._id ||
        user.id ||
        user.phone ||
        user.email ||
        order.userPhone ||
        order.userName ||
        null

      if (!customerKey) return

      const existing = customersMap.get(customerKey) || {
        firstOrder: createdAt,
        lastOrder: createdAt,
        ordersCount: 0,
      }

      if (createdAt < existing.firstOrder) existing.firstOrder = createdAt
      if (createdAt > existing.lastOrder) existing.lastOrder = createdAt
      existing.ordersCount += 1

      customersMap.set(customerKey, existing)
    })

    let newCount = 0
    let repeatCount = 0
    let lapsedCount = 0

    customersMap.forEach((info) => {
      const diffDays =
        (now.getTime() - info.lastOrder.getTime()) / (1000 * 60 * 60 * 24)

      // Ignore customers whose last order was more than a year ago
      if (diffDays > 365) return

      if (diffDays > 60) {
        lapsedCount += 1
      } else if (info.ordersCount === 1) {
        newCount += 1
      } else {
        repeatCount += 1
      }
    })

    const total = newCount + repeatCount + lapsedCount
    return { newCount, repeatCount, lapsedCount, total }
  }
  
  // Fetch orders and update chart data
  const fetchOrdersAndUpdateChart = useCallback(async (rangeId) => {
    try {
      setIsDateLoading(true)
      
      // Get date range
      const ranges = getDateRanges()
      let startDate, endDate
      
      switch (rangeId) {
        case "today":
          startDate = ranges.today
          endDate = ranges.today
          break
        case "yesterday":
          startDate = ranges.yesterday
          endDate = ranges.yesterday
          break
        case "thisWeek":
          startDate = ranges.thisWeekStart
          endDate = ranges.thisWeekEnd
          break
        case "lastWeek":
          startDate = ranges.lastWeekStart
          endDate = ranges.lastWeekEnd
          break
        case "thisMonth":
          startDate = ranges.thisMonthStart
          endDate = ranges.thisMonthEnd
          break
        case "lastMonth":
          startDate = ranges.lastMonthStart
          endDate = ranges.lastMonthEnd
          break
        case "last5days":
          startDate = ranges.last5DaysStart
          endDate = ranges.last5DaysEnd
          break
        case "custom":
          if (customDateRange.start && customDateRange.end) {
            startDate = customDateRange.start
            endDate = customDateRange.end
          } else {
            startDate = ranges.yesterday
            endDate = ranges.yesterday
          }
          break
        default:
          startDate = ranges.yesterday
          endDate = ranges.yesterday
      }
      
      // Format dates for API (ISO format)
      const startDateISO = new Date(startDate)
      startDateISO.setHours(0, 0, 0, 0)
      const endDateISO = new Date(endDate)
      endDateISO.setHours(23, 59, 59, 999)
      
      // Fetch all orders with pagination to get all orders
      let allOrders = []
      let page = 1
      let hasMore = true
      const limit = 1000 // Fetch in batches
      const maxPages = 50 // Safety limit to prevent infinite loops
      
      while (hasMore && page <= maxPages) {
        try {
          const response = await restaurantAPI.getOrders({ 
            page, 
            limit
          })
          
          if (response.data?.success && response.data.data?.orders) {
            const orders = response.data.data.orders
            allOrders = [...allOrders, ...orders]
            
            // Check if there are more pages
            const totalPages = response.data.data.totalPages || response.data.data.pagination?.totalPages || 1
            const totalCount = response.data.data.total || response.data.data.pagination?.total || 0
            
            // Stop if we got fewer orders than the limit (last page) or if we've reached total pages
            if (orders.length < limit || (totalPages > 0 && page >= totalPages)) {
              hasMore = false
            } else {
              page++
            }
          } else {
            hasMore = false
          }
        } catch (pageError) {
          console.error(`Error fetching orders page ${page}:`, pageError)
          hasMore = false
        }
      }
      
      console.log(`📊 Fetched ${allOrders.length} orders for date range:`, {
        startDate: startDateISO.toISOString(),
        endDate: endDateISO.toISOString(),
        rangeId
      })
      
      if (allOrders.length > 0) {
        const { chartData: newChartData, totalSales: newTotalSales, totalOrders: newTotalOrders } = 
          calculateChartDataFromOrders(allOrders, startDate, endDate)
        
        // Calculate mealtime data
        const mealtimeData = calculateMealtimeData(allOrders, startDate, endDate)
        // Calculate customer segments (new / repeat / lapsed) from all available orders
        const segments = calculateCustomerSegments(allOrders)
        
        console.log('📈 Chart data calculated:', {
          totalSales: newTotalSales,
          totalOrders: newTotalOrders,
          chartDataPoints: newChartData.length,
          mealtimeData
        })
        
        setChartData(newChartData)
        setTotalSales(`₹ ${newTotalSales.toLocaleString("en-IN")}`)
        setTotalOrders(newTotalOrders.toString())
        const avg = newTotalOrders > 0 ? newTotalSales / newTotalOrders : 0
        setAvgOrderValue(`₹ ${avg.toFixed(0)}`)
        setMealtimeMetrics(mealtimeData)
        setCustomerSegments({
          ...segments,
          lastUpdated: new Date(),
        })
        setLastUpdated(new Date())
      } else {
        // No orders found
        console.log('⚠️ No orders found for the selected date range')
        setChartData([
          { hour: "12am", orders: 0, sales: 0 },
          { hour: "4am", orders: 0, sales: 0 },
          { hour: "8am", orders: 0, sales: 0 },
          { hour: "12pm", orders: 0, sales: 0 },
          { hour: "4pm", orders: 0, sales: 0 },
          { hour: "8pm", orders: 0, sales: 0 },
          { hour: "12am", orders: 0, sales: 0 },
        ])
        setTotalSales("₹ 0")
        setTotalOrders("0")
        setAvgOrderValue("₹ 0")
        // Reset mealtime metrics to zero
        setMealtimeMetrics([
          { title: "Breakfast", window: "7:00 am - 11:00 am", value: "0", change: "- 0%", color: "#111827" },
          { title: "Lunch", window: "11:00 am - 4:00 pm", value: "0", change: "- 0%", color: "#ef4444" },
          { title: "Evening snacks", window: "4:00 pm - 7:00 pm", value: "0", change: "- 0%", color: "#2563eb" },
          { title: "Dinner", window: "7:00 pm - 11:00 pm", value: "0", change: "- 0%", color: "#f59e0b" },
          { title: "Late night", window: "11:00 pm - 7:00 am", value: "0", change: "- 0%", color: "#671E1F" },
        ])
        setCustomerSegments({
          newCount: 0,
          repeatCount: 0,
          lapsedCount: 0,
          total: 0,
          lastUpdated: new Date(),
        })
      }
    } catch (error) {
      // Suppress 401 errors as they're handled by axios interceptor
      if (error.response?.status !== 401) {
        console.error('Error fetching orders for chart:', error)
      }
      // Keep existing data on error
    } finally {
      setIsDateLoading(false)
    }
  }, [customDateRange])

  const handleDateRangeSelect = (id) => {
    if (id === "custom") {
      setIsCustomDateOpen(true)
      setIsDateSelectorOpen(false)
      return
    }
    setSelectedDateRange(id)
    setIsDateSelectorOpen(false)
    fetchOrdersAndUpdateChart(id)
  }

  const handleCustomDateApply = () => {
    if (customDateRange.start && customDateRange.end) {
      setSelectedDateRange("custom")
      setIsCustomDateOpen(false)
      fetchOrdersAndUpdateChart("custom")
    }
  }
  
  // Fetch orders on mount and when date range changes
  useEffect(() => {
    if (!restaurantData) return // Don't fetch if restaurant data is not loaded yet
    fetchOrdersAndUpdateChart(selectedDateRange)
  }, [restaurantData, selectedDateRange, fetchOrdersAndUpdateChart])

  const formatDateShort = (date) =>
    date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
  const formatDateLong = (date) =>
    date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
  
  const formatTimeAgo = (date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)
    
    if (diffInSeconds < 60) {
      return "few seconds ago"
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days} day${days > 1 ? 's' : ''} ago`
    }
  }

  const selectedRangeLabel = useMemo(() => {
    const r = getDateRanges()
    switch (selectedDateRange) {
      case "today":
        return `Today • ${formatDateLong(r.today)}`
      case "yesterday":
        return `Yesterday • ${formatDateLong(r.yesterday)}`
      case "thisWeek":
        return `This week • ${formatDateShort(r.thisWeekStart)} - ${formatDateShort(r.thisWeekEnd)}`
      case "lastWeek":
        return `Last week • ${formatDateShort(r.lastWeekStart)} - ${formatDateShort(r.lastWeekEnd)}`
      case "thisMonth":
        return `This month • ${formatDateShort(r.thisMonthStart)} - ${formatDateShort(r.thisMonthEnd)}`
      case "lastMonth":
        return `Last month • ${formatDateShort(r.lastMonthStart)} - ${formatDateShort(r.lastMonthEnd)}`
      case "last5days":
        return `Last 5 days • ${formatDateShort(r.last5DaysStart)} - ${formatDateShort(r.last5DaysEnd)}`
      case "custom":
        if (customDateRange.start && customDateRange.end) {
          return `${formatDateShort(customDateRange.start)} - ${formatDateShort(customDateRange.end)}`
        }
        return "Custom range"
      default:
        return "Yesterday"
    }
  }, [selectedDateRange, customDateRange])
  const findSourcesMetrics = [
    { title: "Dish/cuisine search", color: "#111827", impressions: "0", menu: "0", change: "- 0%" },
    { title: "Recommended for you", color: "#ef4444", impressions: "0", menu: "0", change: "- 0%" },
    { title: "Restaurant search", color: "#2563eb", impressions: "0", menu: "0", change: "- 0%" },
    { title: "Home page listing", color: "#f59e0b", impressions: "0", menu: "0", change: "- 0%" },
    { title: "Offers page", color: "#671E1F", impressions: "0", menu: "0", change: "- 0%" },
    { title: "Campaign page", color: "#d1d5db", impressions: "0", menu: "0", change: "- 0%" },
    { title: "Others", color: "#4b5563", impressions: "0", menu: "0", change: "- 0%" },
  ]
  const impressionsCustomerTypes = {
    affinity: [
      { title: "Mass market customers", color: "#111827", value: "0", change: "- 0%" },
      { title: "Mid premium customers", color: "#ef4444", value: "0", change: "- 0%" },
      { title: "Premium customers", color: "#2563eb", value: "0", change: "- 0%" },
    ],
    spending: [
      { title: "Mass market customers", color: "#111827", value: "0", change: "- 0%" },
      { title: "Mid premium customers", color: "#ef4444", value: "0", change: "- 0%" },
      { title: "Premium customers", color: "#2563eb", value: "0", change: "- 0%" },
    ],
  }
  const menuOpensCustomerTypes = {
    affinity: [
      { title: "New customers", sub: "No orders in last 365 days", color: "#111827", value: "0", change: "- 0%" },
      { title: "Repeat customers", sub: "Ordered in last 60 days", color: "#ef4444", value: "0", change: "- 0%" },
      { title: "Lapsed customers", sub: "Last order 60 to 365 days ago", color: "#2563eb", value: "0", change: "- 0%" },
    ],
    spending: [
      { title: "Value seekers", sub: "Orders under ₹300", color: "#111827", value: "2", change: "- 0%" },
      { title: "Mid spenders", sub: "Orders ₹300 - ₹800", color: "#ef4444", value: "1", change: "- 0%" },
      { title: "High spenders", sub: "Orders above ₹800", color: "#2563eb", value: "0", change: "- 0%" },
    ],
  }
  const ordersPlacedCustomerTypes = {
    affinity: [
      { title: "New customers", sub: "No orders in last 365 days", color: "#111827", value: "0", change: "- 0%" },
      { title: "Repeat customers", sub: "Ordered in last 60 days", color: "#ef4444", value: "0", change: "- 0%" },
      { title: "Lapsed customers", sub: "Last order 60 to 365 days ago", color: "#2563eb", value: "0", change: "- 0%" },
    ],
    spending: [
      { title: "Value seekers", sub: "Orders under ₹300", color: "#111827", value: "0", change: "- 0%" },
      { title: "Mid spenders", sub: "Orders ₹300 - ₹800", color: "#ef4444", value: "0", change: "- 0%" },
      { title: "High spenders", sub: "Orders above ₹800", color: "#2563eb", value: "0", change: "- 0%" },
    ],
  }
  const complaintsReasons = {
    all: [
      { title: "Poor packaging & spillage", color: "#111827", value: "0", change: "- 0%" },
      { title: "Poor taste & quality", color: "#ef4444", value: "0", change: "- 0%" },
      { title: "Wrong item delivered", color: "#2563eb", value: "0", change: "- 0%" },
      { title: "Missing items", color: "#f59e0b", value: "0", change: "- 0%" },
    ],
    refunded: [
      { title: "Poor packaging & spillage", color: "#111827", value: "0", change: "- 0%" },
      { title: "Poor taste & quality", color: "#ef4444", value: "0", change: "- 0%" },
      { title: "Wrong item delivered", color: "#2563eb", value: "0", change: "- 0%" },
      { title: "Missing items", color: "#f59e0b", value: "0", change: "- 0%" },
    ],
    resolved: [
      { title: "Poor packaging & spillage", color: "#111827", value: "0", change: "- 0%" },
      { title: "Poor taste & quality", color: "#ef4444", value: "0", change: "- 0%" },
      { title: "Wrong item delivered", color: "#2563eb", value: "0", change: "- 0%" },
      { title: "Missing items", color: "#f59e0b", value: "0", change: "- 0%" },
    ],
    winback: [
      { title: "Poor packaging & spillage", color: "#111827", value: "0", change: "- 0%" },
      { title: "Poor taste & quality", color: "#ef4444", value: "0", change: "- 0%" },
      { title: "Wrong item delivered", color: "#2563eb", value: "0", change: "- 0%" },
      { title: "Missing items", color: "#f59e0b", value: "0", change: "- 0%" },
    ],
  }
  const rejectionsReasons = [
    { title: "Items out of stock", color: "#111827", value: "0", change: "- 0%" },
    { title: "Kitchen is full", color: "#ef4444", value: "0", change: "- 0%" },
    { title: "Outlet closed", color: "#2563eb", value: "0", change: "- 0%" },
    { title: "Others", color: "#f59e0b", value: "0", change: "- 0%" },
  ]
  const offersMetrics = [
    { title: "Offer clicks", value: "0", change: "- 0%", sub: "Clicks on offers" },
    { title: "Offer redemptions", value: "0", change: "- 0%", sub: "Total redeemed" },
    { title: "Conversion rate", value: "0%", change: "- 0%", sub: "Redemptions / clicks" },
    { title: "Cost per redemption", value: "₹0", change: "- 0%", sub: "Est. cost" },
  ]
  const offersCardSummary = {
    grossSales: "₹0",
    grossPct: "0%",
    grossShare: "0% of total gross sales",
    discountGiven: "₹0",
    discountPct: "0%",
    discountPerOrder: "₹0 discount per order",
    ordersFromOffers: "0",
    ordersPct: "0%",
    ordersShare: "0% of total orders",
    effectiveDiscount: "0%",
    effectivePct: "0%",
    effectiveDesc: "Discount given/Gross sales from offers",
  }
  const adsMetrics = [
    { title: "Ad impressions", value: "0", change: "- 0%", sub: "Served impressions" },
    { title: "Ad clicks", value: "0", change: "- 0%", sub: "Total clicks" },
    { title: "CTR", value: "0%", change: "- 0%", sub: "Click-through rate" },
    { title: "Spend", value: "₹0", change: "- 0%", sub: "Total spend" },
  ]
  const customersMetrics = useMemo(() => {
    const total = customerSegments.total || 0
    const formatPercent = (count) => {
      if (!total || !count) return "0% of active"
      const pct = ((count / total) * 100).toFixed(1)
      return `${pct}% of active`
    }

    return [
      {
        title: "New customers",
        sub: "First order in last 365 days",
        value: String(customerSegments.newCount || 0),
        change: formatPercent(customerSegments.newCount || 0),
        color: "#111827",
      },
      {
        title: "Repeat customers",
        sub: "More than one order, last order ≤ 60 days",
        value: String(customerSegments.repeatCount || 0),
        change: formatPercent(customerSegments.repeatCount || 0),
        color: "#ef4444",
      },
      {
        title: "Lapsed customers",
        sub: "Last order 60–365 days ago",
        value: String(customerSegments.lapsedCount || 0),
        change: formatPercent(customerSegments.lapsedCount || 0),
        color: "#2563eb",
      },
    ]
  }, [customerSegments])
  const customerAffinityBreakup = [
    { title: "New customers", sub: "No orders in last 365 days", value: "0", change: "- 0%", color: "#111827" },
    { title: "Repeat customers", sub: "Ordered in last 60 days", value: "0", change: "- 0%", color: "#ef4444" },
    { title: "Lapsed customers", sub: "Last order 60 to 365 days ago", value: "0", change: "- 0%", color: "#2563eb" },
  ]
  const customerSpendingBreakup = [
    { title: "Mass market customers", value: "0", change: "- 0%", color: "#111827" },
    { title: "Mid premium customers", value: "0", change: "- 0%", color: "#ef4444" },
    { title: "Premium customers", value: "0", change: "- 0%", color: "#2563eb" },
  ]
  const customerDistanceBreakup = [
    { title: "Within 4 km", value: "0", change: "- 0%", color: "#111827" },
    { title: "Between 4 and 6 km", value: "0", change: "- 0%", color: "#ef4444" },
    { title: "Between 6 and 10 km", value: "0", change: "- 0%", color: "#2563eb" },
    { title: "Above 10 km", value: "0", change: "- 0%", color: "#f59e0b" },
  ]
  const { headerPrimary, compareLabel } = useMemo(() => {
    const ranges = getDateRanges()
    let primary = selectedRangeLabel
    let baseEnd = ranges.yesterday
    switch (selectedDateRange) {
      case "today":
        baseEnd = ranges.today
        break
      case "thisWeek":
        baseEnd = ranges.thisWeekEnd
        break
      case "lastWeek":
        baseEnd = ranges.lastWeekEnd
        break
      case "thisMonth":
        baseEnd = ranges.thisMonthEnd
        break
      case "lastMonth":
        baseEnd = ranges.lastMonthEnd
        break
      case "last5days":
        baseEnd = ranges.last5DaysEnd
        break
      case "custom":
        baseEnd = customDateRange.end || ranges.yesterday
        break
      default:
        baseEnd = ranges.yesterday
    }
    const compare = new Date(baseEnd)
    compare.setDate(compare.getDate() - 7)
    return {
      headerPrimary: primary,
      compareLabel: formatDateLong(compare),
    }
  }, [selectedRangeLabel, selectedDateRange, customDateRange])

  const MyFeedContent = () => (
    <div className="space-y-4">

      <div className="px-4">
        <div className="bg-white rounded-lg space-y-4">
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-gray-600">Total sales</div>
            <span className="text-xs text-red-700 bg-red-100 px-3 rounded-full">Live</span>
          </div>
          <div className="px-4 flex items-center justify-between text-md font-semibold text-gray-700">
            <span>{totalSales}</span>
            <span>Total orders {totalOrders}</span>
          </div>
          <div className="h-48 chart-shell">
            <style>{`
              .chart-shell *:focus {
                outline: none !important;
                box-shadow: none !important;
              }
              .recharts-wrapper:focus,
              .recharts-surface:focus,
              .recharts-responsive-container:focus {
                outline: none !important;
              }
            `}</style>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#111827" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#671E1F" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#671E1F" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="orders" stroke="#111827" fill="url(#ordersGradient)" />
                <Area type="monotone" dataKey="sales" stroke="#671E1F" fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="px-4">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Quick links</h3>
        <div className="grid grid-cols-4 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <button 
                key={link.id} 
                onClick={() => {
                  if (link.isPhone) {
                    window.location.href = link.route
                  } else {
                    navigate(link.route)
                  }
                }}
                className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                  <Icon className="w-5 h-5 text-black" />
                </div>
                <span className="text-[12px] text-center text-gray-800 leading-tight">
                  {link.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>



      {/* Business insights + filters */}
      <div className="px-4 space-y-3">
        <p className="text-lg font-bold text-gray-900 mb-3">Business insights</p>
      </div>


      {/* Sales card */}
      <div className="px-4">
        <div className="bg-white rounded-lg p-4 space-y-4 relative">
          {isDateLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute inset-0 bg-white/60 rounded-lg" />
              <div className="relative text-sm font-semibold text-gray-700 animate-pulse">Refreshing...</div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-gray-900">Sales</p>
              <p className="text-xs text-gray-500">
                {lastUpdated
                  ? `Last updated: ${formatTimeAgo(lastUpdated)}`
                  : "Last updated: a day ago"}
              </p>
            </div>
          </div>

          {[
            {
              title: "Net sales",
              value: `${totalSales} • 0%`,
              dataKey: "sales",
              color: "#f97316",
            },
            {
              title: "Orders delivered",
              value: `${totalOrders} • 0%`,
              dataKey: "orders",
              color: "#f97316",
            },
            {
              title: "Avg. order value",
              value: `${avgOrderValue} • 0%`,
              dataKey: "sales",
              color: "#f97316",
            },
          ].map((section, idx) => (
            <div key={section.title} className={idx < 2 ? "pb-3 border-b border-dashed border-gray-200 space-y-2" : "space-y-2"}>
              <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                <span>{section.title}</span>
                <span>{section.value}</span>
              </div>
              <div className="h-16 chart-shell-mini">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`mini-${section.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={section.color} stopOpacity={0.5} />
                        <stop offset="95%" stopColor={section.color} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                    <YAxis hide />
                    <Tooltip />
                    <Area type="monotone" dataKey={section.dataKey} stroke={section.color} fill={`url(#mini-${section.dataKey})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}

          <div className="pt-2">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-2"><span className="w-3 h-0.5 bg-gray-900 inline-block"></span>Yesterday</span>
              <span className="flex items-center gap-2"><span className="w-3 h-0.5 bg-gray-400 inline-block"></span>Day before yesterday</span>
            </div>
            <button 
              onClick={() => setActiveTopTab("sales")}
              className="w-full mt-3 bg-black text-white py-3 rounded-md text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              Get deeper insights
            </button>
          </div>
        </div>
      </div>

      {/* Customers card */}
      <div className="px-4">
        <div className="bg-white rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-gray-900">Customers</p>
              <p className="text-xs text-gray-500">
                {customerSegments.lastUpdated
                  ? `Last updated: ${formatTimeAgo(customerSegments.lastUpdated)}`
                  : "Last updated: a day ago"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {customersMetrics.map((metric) => (
              <div key={metric.title} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: metric.color }}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">{metric.title}</span>
                    <span className="text-xs text-gray-600">{metric.sub}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{metric.value}</p>
                  <p className="text-xs text-gray-600">{metric.change}</p>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={() => setActiveTopTab("customers")}
            className="w-full bg-black text-white py-3 rounded-md text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            Get deeper insights
          </button>
        </div>
      </div>

      {/* Orders by mealtime */}
      <div className="px-4">
        <div className="bg-white rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-gray-900">Orders by mealtime</p>
              <p className="text-xs text-gray-500">
                {lastUpdated 
                  ? `Last updated: ${formatTimeAgo(lastUpdated)}`
                  : "Last updated: a day ago"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {mealtimeMetrics.map((slot) => (
              <div key={slot.title} className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1"
                    style={{ backgroundColor: slot.color }}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">{slot.title}</span>
                    <span className="text-xs text-gray-600">{slot.window}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{slot.value}</p>
                  <p className="text-xs text-gray-600">{slot.change}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Offers card */}
      <div className="px-4">
        <div className="bg-white rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-gray-900">Offers</p>
              <p className="text-xs text-gray-500">Last updated: an hour ago</p>
            </div>
          </div>

          <div className="divide-y divide-dashed divide-gray-200">
            <div className="grid grid-cols-2 gap-y-4 py-3">
              {offersMetrics.slice(0, 2).map((metric) => (
                <div key={metric.title} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{metric.title}</span>
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {metric.value} <span className="text-sm font-normal text-gray-600">{metric.change}</span>
                  </div>
                  <div className="text-xs text-gray-600">{metric.sub}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-y-4 py-3">
              {offersMetrics.slice(2).map((metric) => (
                <div key={metric.title} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{metric.title}</span>
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {metric.value} <span className="text-sm font-normal text-gray-600">{metric.change}</span>
                  </div>
                  <div className="text-xs text-gray-600">{metric.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={() => setActiveTopTab("offers")}
            className="w-full bg-black text-white py-3 rounded-md text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            Get deeper insights
          </button>
        </div>
      </div>

    </div>
  )

  const KitchenVideoModal = () => (
    <AnimatePresence>
      {isKptVideoOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[13000] bg-black/80 backdrop-blur-sm flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <button
              onClick={() => setIsKptVideoOpen(false)}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold"
            >
              Back
            </button>
            <span className="text-sm font-semibold">Kitchen prep tips</span>
            <button
              onClick={() => setIsKptVideoOpen(false)}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold"
            >
              Close
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-6">
            <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
              <video
                key={isKptVideoOpen ? "open" : "closed"}
                className="w-full h-full object-cover"
                controls
                autoPlay
                playsInline
              >
                <source src="https://assets.mixkit.co/videos/preview/mixkit-cooking-a-vegetable-stir-fry-in-a-wok-4782-large.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  const SalesTabContent = () => {
    const salesMax = Math.max(...chartData.map((d) => d.sales || 0), 1)
    const ordersMax = Math.max(...chartData.map((d) => d.orders || 0), 1)
    const aovData = useMemo(
      () =>
        chartData.map((d) => ({
          ...d,
          aov: d.orders ? d.sales / d.orders : 0,
        })),
      [chartData]
    )
    const aovMax = Math.max(...aovData.map((d) => d.aov || 0), 1)

    const summaryMetrics = useMemo(() => {
      let totalSalesValue = 0
      let totalOrdersValue = 0
      chartData.forEach((d) => {
        totalSalesValue += d.sales || 0
        totalOrdersValue += d.orders || 0
      })
      const avgOrderValue = totalOrdersValue > 0 ? totalSalesValue / totalOrdersValue : 0

      return {
        totalSalesValue,
        totalOrdersValue,
        avgOrderValue,
      }
    }, [chartData])

    return (
      <div className="space-y-4">
        <div className="px-4">
          <div className="bg-white rounded-lg p-4 space-y-4 relative">
            {isDateLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute inset-0 bg-white/60 rounded-lg" />
                <div className="relative text-sm font-semibold text-gray-700 animate-pulse">Refreshing...</div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-gray-900">Sales</p>
                <p className="text-xs text-gray-500">Last updated: few seconds ago</p>
              </div>
            </div>

            {[
              {
                title: "Net sales",
                value: `₹${summaryMetrics.totalSalesValue.toLocaleString("en-IN")} • 0%`,
                dataKey: "sales",
                color: "#f97316",
              },
              {
                title: "Orders delivered",
                value: `${summaryMetrics.totalOrdersValue} • 0%`,
                dataKey: "orders",
                color: "#f97316",
              },
              {
                title: "Avg. order value",
                value: `₹${summaryMetrics.avgOrderValue.toFixed(0)} • 0%`,
                dataKey: "sales",
                color: "#f97316",
              },
            ].map((section, idx) => (
              <div key={section.title} className={idx < 2 ? "pb-3 border-b border-dashed border-gray-200 space-y-2" : "space-y-2"}>
                <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                  <span>{section.title}</span>
                  <span>{section.value}</span>
                </div>
                <div className="h-16 chart-shell-mini">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`mini-${section.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={section.color} stopOpacity={0.5} />
                          <stop offset="95%" stopColor={section.color} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                      <YAxis hide />
                      <Tooltip />
                      <Area type="monotone" dataKey={section.dataKey} stroke={section.color} fill={`url(#mini-${section.dataKey})`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sales & orders combined card */}
        <div className="px-4">
          <div className="bg-white rounded-lg p-4 space-y-4 relative">
            {isDateLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute inset-0 bg-white/60 rounded-lg" />
                <div className="relative text-sm font-semibold text-gray-700 animate-pulse">Refreshing...</div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-gray-900">Sales & orders</p>
                <p className="text-xs text-gray-500">Last updated: few seconds ago</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-gray-900 text-center items-center">
              <div className="space-y-1 flex flex-col items-center">
                <p className="text-xs text-gray-500">Net sales</p>
                <p className="text-lg font-bold text-gray-900">{totalSales || "₹0"}</p>
                <p className="text-xs text-gray-500">- 0%</p>
              </div>
              <div className="space-y-1 flex flex-col items-center">
                <p className="text-xs text-gray-500">Orders delivered</p>
                <p className="text-lg font-bold text-gray-900">{totalOrders || "0"}</p>
                <p className="text-xs text-gray-500">- 0%</p>
              </div>
            </div>

            <div className="h-64 chart-shell -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickFormatter={(value) => `₹${value.toLocaleString("en-IN")}`}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                    allowDecimals={false}
                    domain={[0, salesMax]}
                    tickCount={5}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={false}
                    axisLine={false}
                    domain={[0, ordersMax]}
                  />
                  <Tooltip contentStyle={{ fontSize: "0.75rem" }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="sales"
                    stroke="#111827"
                    strokeWidth={2}
                    fill="rgba(17,24,39,0.12)"
                    dot={{ r: 3, fill: "#111827" }}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="orders"
                    stroke="#6b7280"
                    strokeWidth={2}
                    dot={{ r: 6, fill: "#9ca3af", stroke: "#6b7280", strokeWidth: 1.5 }}
                    activeDot={{ r: 7 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-gray-600">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-900 inline-block rounded-[2px]" />
                Net sales
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border border-gray-400 bg-gray-200 inline-block" />
                Orders delivered
              </span>
            </div>
          </div>
        </div>

        {/* Average order value card */}
        <div className="px-4">
          <div className="bg-white rounded-lg p-4 space-y-4 relative">
            {isDateLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute inset-0 bg-white/60 rounded-lg" />
                <div className="relative text-sm font-semibold text-gray-700 animate-pulse">Refreshing...</div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-gray-900">Average order value</p>
                <p className="text-xs text-gray-500">Last updated: few seconds ago</p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-500">AOV</p>
              <p className="text-lg font-bold text-gray-900">
                ₹0 <span className="text-xs font-normal text-gray-500">- 0%</span>
              </p>
            </div>

            <div className="h-64 chart-shell -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={aovData}
                  margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickFormatter={(value) => `₹${value.toLocaleString("en-IN")}`}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                    allowDecimals={false}
                    domain={[0, aovMax]}
                    tickCount={5}
                  />
                  <Tooltip contentStyle={{ fontSize: "0.75rem" }} />
                  <Area
                    type="monotone"
                    dataKey="aov"
                    stroke="#111827"
                    strokeWidth={2}
                    fill="rgba(17,24,39,0.08)"
                    dot={{ r: 3, fill: "#111827" }}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Orders by mealtime (sales tab) */}
        <div className="px-4">
          <div className="bg-white rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-gray-900">Orders by mealtime</p>
                <p className="text-xs text-gray-500">
                  {lastUpdated 
                    ? `Last updated: ${formatTimeAgo(lastUpdated)}`
                    : "Last updated: a day ago"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {mealtimeMetrics.map((slot) => (
                <div key={slot.title} className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full mt-1"
                      style={{ backgroundColor: slot.color }}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-900">{slot.title}</span>
                      <span className="text-xs text-gray-600">{slot.window}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{slot.value}</p>
                    <p className="text-xs text-gray-600">{slot.change}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    )
  }

  const EmptyTab = ({ label }) => (
    <div className="flex-1 flex items-center justify-center text-gray-500 text-sm px-4">
      {label} is empty for now.
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <style>{`
        .chart-shell *, .chart-shell, .chart-shell-mini *, .chart-shell-mini,
        .recharts-wrapper:focus, .recharts-surface:focus, .recharts-responsive-container:focus {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
      <div className="">
        {/* Reuse Feedback-like navbar */}
        <div className="sticky bg-white top-0 z-40 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[0.12em] text-gray-500 uppercase">
              Showing data for
            </p>
            <p className="text-md font-semibold text-gray-900 mt-0.5">
              {loadingRestaurant ? "Loading..." : restaurantData?.name || "Restaurant"}
            </p>
          </div>

          <div className="flex items-center">
            <button
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => navigate("/restaurant/notifications")}
            >
              <Bell className="w-5 h-5 text-gray-700" />
            </button>
            <button
              className="p-2 ml-1 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => navigate("/restaurant/help-centre")}
            >
              <HelpCircle className="w-5 h-5 text-gray-700" />
            </button>
            <button
              className="p-2 ml-1 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => navigate("/restaurant/explore")}
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Top tabs (matching Orders tab style) */}
        <div className="sticky top-[50px] z-40 pb-2 bg-gray-100">
          <div
            ref={topTabBarRef}
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
            {topTabs.map((tab) => {
              const isActive = activeTopTab === tab.id
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => {
                    if (!isTransitioning) {
                      setIsTransitioning(true)
                      setActiveTopTab(tab.id)
                      setTimeout(() => setIsTransitioning(false), 300)
                    }
                  }}
                  className={`shrink-0 px-6 py-3.5 rounded-full font-medium text-sm whitespace-nowrap relative overflow-hidden ${isActive ? 'text-white' : 'bg-white text-black'}`}
                  animate={{ scale: isActive ? 1.05 : 1, opacity: isActive ? 1 : 0.7 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="hubTopTabActive"
                      className="absolute inset-0 bg-black rounded-full -z-10"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          ref={contentContainerRef}
          key={activeTopTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={(e) => {
            const target = e.target
            // Don't handle swipe if starting on topbar or chart
            if (topTabBarRef.current?.contains(target)) return
            if (target.closest('.chart-shell, .chart-shell-mini')) return
            
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
              const currentIndex = topTabs.findIndex(t => t.id === activeTopTab)
              
              if (swipeDistance > 50 && currentIndex < topTabs.length - 1) {
                setActiveTopTab(topTabs[currentIndex + 1].id)
              } else if (swipeDistance < -50 && currentIndex > 0) {
                setActiveTopTab(topTabs[currentIndex - 1].id)
              }
              
              isMouseDown.current = false
              isSwiping.current = false
            }
          }}
        >
          {activeTopTab === "my-feed" ? (
            <MyFeedContent />
          ) : activeTopTab === "sales" ? (
            <SalesTabContent />
          ) : (
            <EmptyTab label={topTabs.find(t => t.id === activeTopTab)?.label || "Tab"} />
          )}
        </motion.div>
      </AnimatePresence>

      <BottomNavOrders />
    </div>
  )
}

// Simple icon placeholders
function PhoneIcon(props) { return <Wand2 {...props} /> }
function HistoryIcon(props) { return <BarChart3 {...props} /> }
function AlertIcon(props) { return <TrendingUp {...props} /> }
function StarIcon(props) { return <Users {...props} /> }
function MessageIcon(props) { return <BarChart3 {...props} /> }
function LinkIcon(props) { return <TrendingUp {...props} /> }
function SettingsIcon(props) { return <Wand2 {...props} /> }
function GridIcon(props) { return <Users {...props} /> }
