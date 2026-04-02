import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, HelpCircle, Menu, Search, SlidersHorizontal, Calendar, Reply, ChevronLeft, Send, X, Loader2, ChevronRight } from "lucide-react"
import { DateRangeCalendar } from "@/components/ui/date-range-calendar"
import BottomNavOrders from "../components/BottomNavOrders"
import { restaurantAPI } from "@/lib/api"

const REVIEWS_STORAGE_KEY = "restaurant_reviews_data"

const tabs = [
  { id: "complaints", label: "Complaints" },
  { id: "reviews", label: "Reviews" },
  { id: "rejected-dish", label: "Rejected Dish" },
]

// Dummy review data
const dummyReviews = [
  {
    id: 1,
    orderNumber: "0",
    outlet: "Kadhai Chammach Restaur.. By Pass Road (South)",
    userName: "Pradeep Rajput",
    userImage: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=80",
    ordersCount: 0,
    rating: 5,
    date: "30 Dec, 2023 2:05 PM",
    reviewText: "very good nice food"
  },
  {
    id: 2,
    orderNumber: "1234",
    outlet: "Kadhai Chammach Restaur.. By Pass Road (North)",
    userName: "Rahul Sharma",
    userImage: "https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=80",
    ordersCount: 3,
    rating: 4,
    date: "29 Dec, 2023 8:30 AM",
    reviewText: "Great food quality and fast delivery. Will order again!"
  },
  {
    id: 3,
    orderNumber: "1235",
    outlet: "Kadhai Chammach Restaur.. By Pass Road (South)",
    userName: "Priya Patel",
    userImage: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=80",
    ordersCount: 1,
    rating: 5,
    date: "28 Dec, 2023 6:15 PM",
    reviewText: "Amazing taste! The biryani was perfect."
  },
  {
    id: 4,
    orderNumber: "1236",
    outlet: "Kadhai Chammach Restaur.. By Pass Road (Central)",
    userName: "Amit Kumar",
    userImage: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=80",
    ordersCount: 5,
    rating: 3,
    date: "27 Dec, 2023 1:20 PM",
    reviewText: "Food was okay, but delivery took longer than expected."
  },
  {
    id: 5,
    orderNumber: "1237",
    outlet: "Kadhai Chammach Restaur.. By Pass Road (South)",
    userName: "Sneha Reddy",
    userImage: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=80",
    ordersCount: 2,
    rating: 5,
    date: "26 Dec, 2023 9:45 AM",
    reviewText: "Excellent service and delicious food. Highly recommended!"
  },
  {
    id: 6,
    orderNumber: "1238",
    outlet: "Kadhai Chammach Restaur.. By Pass Road (North)",
    userName: "Vikram Singh",
    userImage: "https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=80",
    ordersCount: 7,
    rating: 4,
    date: "25 Dec, 2023 4:10 PM",
    reviewText: "Good quality food. Packaging was neat and clean."
  }
]

export default function Feedback() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState(tabFromUrl === "complaints" ? "complaints" : "reviews")
  const navigate = useNavigate()
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  // Update active tab when URL param changes
  useEffect(() => {
    if (tabFromUrl === "complaints") {
      setActiveTab("complaints")
    } else if (tabFromUrl === "rejected-dish") {
      setActiveTab("rejected-dish")
    } else {
      setActiveTab("reviews")
    }
  }, [tabFromUrl])
  
  // Swipe gesture refs
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)
  
  const feedbackTabs = ["complaints", "reviews", "rejected-dish"]
  const [reviews, setReviews] = useState([])
  // Rejected dishes (menu items/addons rejected by admin)
  const [rejectedDishes, setRejectedDishes] = useState([])
  const [selectedRejectedDish, setSelectedRejectedDish] = useState(null)
  const [isRejectedDishModalOpen, setIsRejectedDishModalOpen] = useState(false)
  const [isLoadingRejectedDish, setIsLoadingRejectedDish] = useState(false)
  const [selectedReview, setSelectedReview] = useState(null)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedFilterCategory, setSelectedFilterCategory] = useState("duration")
  const [filterValues, setFilterValues] = useState({
    duration: null,
    sortBy: null,
    reviewType: []
  })
  const [isFilterLoading, setIsFilterLoading] = useState(false)
  const [displayedReviews, setDisplayedReviews] = useState([])
  
  // Complaints filter state
  const [isComplaintsFilterOpen, setIsComplaintsFilterOpen] = useState(false)
  const [selectedComplaintsFilterCategory, setSelectedComplaintsFilterCategory] = useState("issueType")
  const [complaintsFilterValues, setComplaintsFilterValues] = useState({
    issueType: [],
    reasons: []
  })
  const [complaintsSearchQuery, setComplaintsSearchQuery] = useState("")
  
  // Date selector state
  const [isDateSelectorOpen, setIsDateSelectorOpen] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState("last5days") // "today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "last5days", "custom"
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null })
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false)
  const [isComplaintsLoading, setIsComplaintsLoading] = useState(false)
  const [complaints, setComplaints] = useState([])

  // Restaurant data state
  const [restaurantData, setRestaurantData] = useState(null)
  const [isLoadingRestaurant, setIsLoadingRestaurant] = useState(true)
  const [isLoadingReviews, setIsLoadingReviews] = useState(true)
  const [ratingSummary, setRatingSummary] = useState({
    averageRating: 0,
    totalRatings: 0,
    totalReviews: 0
  })

  // Fetch restaurant data
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setIsLoadingRestaurant(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        if (response.data?.success && response.data.data?.restaurant) {
          setRestaurantData(response.data.data.restaurant)
        }
      } catch (error) {
        console.error("Error fetching restaurant data:", error)
      } finally {
        setIsLoadingRestaurant(false)
      }
    }
    fetchRestaurantData()
  }, [])

  // Fetch rejected dishes (menu items & addons with approvalStatus === 'rejected')
  useEffect(() => {
    const fetchRejectedDishes = async () => {
      if (activeTab !== 'rejected-dish') return
      try {
        setIsLoadingRejectedDish(true)
        const list = []
        const [menuRes, addonsRes] = await Promise.all([
          restaurantAPI.getMenu(),
          restaurantAPI.getAddons().catch(() => ({ data: { data: { addons: [] } } }))
        ])
        const sections = menuRes?.data?.data?.menu?.sections || []
        for (const section of sections) {
          const sectionName = section.name || 'Section'
          if (section.items && Array.isArray(section.items)) {
            section.items.forEach(item => {
              if (item.approvalStatus === 'rejected') {
                list.push({
                  id: item.id,
                  name: item.name || 'Unnamed item',
                  type: 'item',
                  sectionName,
                  rejectionReason: item.rejectionReason || 'No reason provided',
                  rejectedAt: item.rejectedAt || null,
                })
              }
            })
          }
          if (section.subsections && Array.isArray(section.subsections)) {
            section.subsections.forEach(sub => {
              const subName = sub.name || 'Subsection'
              if (sub.items && Array.isArray(sub.items)) {
                sub.items.forEach(item => {
                  if (item.approvalStatus === 'rejected') {
                    list.push({
                      id: item.id,
                      name: item.name || 'Unnamed item',
                      type: 'item',
                      sectionName: `${sectionName} › ${subName}`,
                      rejectionReason: item.rejectionReason || 'No reason provided',
                      rejectedAt: item.rejectedAt || null,
                    })
                  }
                })
              }
            })
          }
        }
        const addons = addonsRes?.data?.data?.addons || addonsRes?.data?.addons || []
        addons.forEach(addon => {
          if (addon.approvalStatus === 'rejected') {
            list.push({
              id: addon.id,
              name: addon.name || 'Unnamed add-on',
              type: 'addon',
              sectionName: 'Add-ons',
              rejectionReason: addon.rejectionReason || 'No reason provided',
              rejectedAt: addon.rejectedAt || null,
            })
          }
        })
        setRejectedDishes(list)
      } catch (error) {
        console.error('Error fetching rejected dishes:', error)
        setRejectedDishes([])
      } finally {
        setIsLoadingRejectedDish(false)
      }
    }
    fetchRejectedDishes()
  }, [activeTab])

  // Fetch complaints
  useEffect(() => {
    const fetchComplaints = async () => {
      if (activeTab !== 'complaints') return
      
      try {
        setIsComplaintsLoading(true)
        const dateRanges = getDateRanges()
        let fromDate = null
        let toDate = null

        // Helper to get end of day for a date
        const endOfDay = (date) => {
          const d = new Date(date)
          d.setHours(23, 59, 59, 999)
          return d
        }

        switch (selectedDateRange) {
          case 'today':
            fromDate = dateRanges.today
            toDate = endOfDay(new Date())
            break
          case 'yesterday':
            fromDate = dateRanges.yesterday
            toDate = endOfDay(dateRanges.yesterday)
            break
          case 'thisWeek':
            fromDate = dateRanges.thisWeekStart
            toDate = endOfDay(new Date())
            break
          case 'lastWeek':
            fromDate = dateRanges.lastWeekStart
            toDate = endOfDay(dateRanges.lastWeekEnd)
            break
          case 'thisMonth':
            fromDate = dateRanges.thisMonthStart
            toDate = endOfDay(new Date())
            break
          case 'lastMonth':
            fromDate = dateRanges.lastMonthStart
            toDate = endOfDay(dateRanges.lastMonthEnd)
            break
          case 'last5days':
            fromDate = dateRanges.last5DaysStart
            toDate = endOfDay(new Date())
            break
          case 'custom':
            if (customDateRange.start && customDateRange.end) {
              fromDate = customDateRange.start
              toDate = endOfDay(customDateRange.end)
            }
            break
        }

        const params = {}
        if (fromDate) params.fromDate = fromDate.toISOString()
        if (toDate) params.toDate = toDate.toISOString()
        if (complaintsFilterValues.issueType?.length > 0) {
          params.complaintType = complaintsFilterValues.issueType[0]
        }
        if (complaintsSearchQuery) params.search = complaintsSearchQuery

        const response = await restaurantAPI.getComplaints(params)
        if (response?.data?.success && response.data.data?.complaints) {
          setComplaints(response.data.data.complaints)
        } else {
          setComplaints([])
        }
      } catch (error) {
        console.error('Error fetching complaints:', error)
        setComplaints([])
      } finally {
        setIsComplaintsLoading(false)
      }
    }

    fetchComplaints()
  }, [activeTab, selectedDateRange, customDateRange, complaintsFilterValues, complaintsSearchQuery])

  // Fetch reviews from orders
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setIsLoadingReviews(true)
        // Fetch all delivered orders
        let allOrders = []
        let page = 1
        let hasMore = true
        const limit = 1000
        const maxPages = 50

        while (hasMore && page <= maxPages) {
          try {
            const response = await restaurantAPI.getOrders({ 
              page, 
              limit,
              status: 'delivered'
            })
            
            if (response.data?.success && response.data.data?.orders) {
              const orders = response.data.data.orders
              allOrders = [...allOrders, ...orders]
              
              const totalPages = response.data.data.pagination?.totalPages || response.data.data.totalPages || 1
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

        // Transform orders to reviews format
        // Note: If orders have review/rating fields, use them. Otherwise, we'll show delivered orders as reviews
        const transformedReviews = allOrders
          .filter(order => order.status === 'delivered')
          .map((order, index) => {
            const orderDate = new Date(order.createdAt || order.deliveredAt || Date.now())
            // Format date as "30 Dec, 2023 2:05 PM"
            const day = orderDate.getDate()
            const month = orderDate.toLocaleDateString('en-GB', { month: 'short' })
            const year = orderDate.getFullYear()
            const hours = orderDate.getHours()
            const minutes = orderDate.getMinutes()
            const ampm = hours >= 12 ? 'PM' : 'AM'
            const displayHours = hours % 12 || 12
            const displayMinutes = minutes.toString().padStart(2, '0')
            const formattedDate = `${day} ${month}, ${year} ${displayHours}:${displayMinutes} ${ampm}`

            // Extract user info
            const userName = order.userId?.name || 
                            (typeof order.userId === 'object' && order.userId?.name) ||
                            'Customer'
            const userImage = order.userId?.profileImage || 
                             (typeof order.userId === 'object' && order.userId?.profileImage) ||
                             `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`

            // Get outlet/restaurant name
            const outlet = order.restaurantName || 
                          (restaurantData?.name) ||
                          'Restaurant'

            // Get rating and comment from order.review (source of truth for restaurant)
            const rating = order.review?.rating ? Number(order.review.rating) : (order.rating != null ? Number(order.rating) : order.feedback?.rating != null ? Number(order.feedback.rating) : null)
            const reviewText = order.review?.comment?.trim() ||
                             order.review?.text?.trim() ||
                             order.feedback?.comment?.trim() ||
                             order.feedback?.text?.trim() ||
                             (rating != null ? `${rating}★ rating` : '')

            // Count user's orders with this restaurant
            const userOrdersCount = allOrders.filter(o =>
              (o.userId?._id || o.userId) === (order.userId?._id || order.userId)
            ).length

            return {
              id: order._id || order.orderId || `review-${index}`,
              orderNumber: order.orderId || order.orderNumber || String(index),
              outlet: outlet,
              userName: userName,
              userImage: userImage,
              ordersCount: userOrdersCount,
              rating: rating,
              date: formattedDate,
              reviewText: reviewText || 'No review text',
              reply: order.review?.reply || order.feedback?.reply || null,
              orderData: order
            }
          })
          .filter(review => {
            // Only include orders that have an actual review (rating or comment from order.review)
            return review.rating != null || (review.reviewText && review.reviewText !== 'No review text')
          })

        // Calculate rating summary
        const ratings = transformedReviews.map(r => r.rating).filter(r => r !== null)
        const averageRating = ratings.length > 0 
          ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
          : 0
        const totalRatings = ratings.length
        const totalReviews = transformedReviews.length

        setRatingSummary({
          averageRating: parseFloat(averageRating),
          totalRatings,
          totalReviews
        })

        setReviews(transformedReviews)
        
        // Save to localStorage for offline access
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(transformedReviews))
          }
    } catch (error) {
      console.error("Error saving reviews to storage:", error)
    }
      } catch (error) {
        console.error("Error fetching reviews:", error)
        // Keep existing reviews on error
      } finally {
        setIsLoadingReviews(false)
      }
    }

    if (!isLoadingRestaurant) {
      fetchReviews()
    }
  }, [isLoadingRestaurant, restaurantData])

  // Persist reviews to localStorage whenever they change (removed - now done in fetchReviews)

  // Update displayed reviews when reviews or filter values change
  useEffect(() => {
    let filtered = [...reviews]

    // Filter by duration (if selected)
    if (filterValues.duration) {
      const now = new Date()
      const daysAgo = filterValues.duration === "7days" ? 7 : filterValues.duration === "30days" ? 30 : 90
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
      
      filtered = filtered.filter(review => {
        // Parse date from review.date string (format: "30 Dec, 2023 2:05 PM")
        const reviewDate = new Date(review.date)
        return reviewDate >= cutoffDate
      })
    }

    // Filter by review type (if selected)
    if (filterValues.reviewType && filterValues.reviewType.length > 0) {
      // For now, we'll keep all reviews as we don't have review type in the data
      // This can be extended when review type is added to the review data structure
    }

    // Sort reviews
    if (filterValues.sortBy) {
      filtered.sort((a, b) => {
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        
        switch (filterValues.sortBy) {
          case "newest":
            return dateB - dateA
          case "oldest":
            return dateA - dateB
          case "bestRated":
            return b.rating - a.rating
          case "worstRated":
            return a.rating - b.rating
          default:
            return 0
        }
      })
    }

    setDisplayedReviews(filtered)
  }, [reviews, filterValues])

  // Handle review card click
  const handleReviewClick = (review) => {
    setSelectedReview(review)
    setReplyText(review.reply || "")
    setIsReviewModalOpen(true)
  }

  // Handle reply send
  const handleSendReply = async () => {
    if (!selectedReview || !replyText.trim()) return

    try {
      // TODO: Implement API call to save reply to backend
      // For now, update local state
    setReviews(prev =>
      prev.map(review =>
        review.id === selectedReview.id
          ? { ...review, reply: replyText.trim() }
          : review
      )
    )

    setSelectedReview(prev => prev ? { ...prev, reply: replyText.trim() } : null)
    setReplyText("")
    setIsReviewModalOpen(false)
      
      // Save to localStorage
      try {
        if (typeof window !== "undefined") {
          const updatedReviews = reviews.map(review =>
            review.id === selectedReview.id
              ? { ...review, reply: replyText.trim() }
              : review
          )
          localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(updatedReviews))
        }
      } catch (error) {
        console.error("Error saving reply to storage:", error)
      }
    } catch (error) {
      console.error("Error sending reply:", error)
    }
  }

  // Handle modal close
  const handleCloseModal = () => {
    setIsReviewModalOpen(false)
    setSelectedReview(null)
    setReplyText("")
  }

  // Handle filter reset
  const handleFilterReset = () => {
    setFilterValues({
      duration: null,
      sortBy: null,
      reviewType: []
    })
    setIsFilterLoading(true)
    setTimeout(() => {
      setIsFilterLoading(false)
    }, 200)
  }

  // Handle filter apply
  const handleFilterApply = () => {
    setIsFilterLoading(true)
    setIsFilterOpen(false)
    
    // Show loading animation for 200ms
    setTimeout(() => {
      setIsFilterLoading(false)
    }, 200)
  }

  // Date helper functions
  const formatDate = (date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const day = days[date.getDay()]
    const dayNum = date.getDate()
    const month = months[date.getMonth()]
    const year = date.getFullYear()
    return `${day}, ${dayNum} ${month} ${year}`
  }

  const formatDateShort = (date) => {
    const day = date.getDate()
    const month = date.toLocaleString('en-US', { month: 'short' })
    return `${day} ${month}`
  }

  const getDateRanges = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    // This week so far (Monday to today)
    const thisWeekStart = new Date(today)
    const dayOfWeek = today.getDay()
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Monday is 0
    thisWeekStart.setDate(today.getDate() - diff)
    
    // Last week (Monday to Sunday)
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekEnd = new Date(thisWeekStart)
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)
    
    // This month so far
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    
    // Last month
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    
    // Last 5 days
    const last5DaysStart = new Date(today)
    last5DaysStart.setDate(last5DaysStart.getDate() - 4) // Including today
    
    return {
      today,
      yesterday,
      thisWeekStart,
      thisWeekEnd: today,
      lastWeekStart,
      lastWeekEnd,
      thisMonthStart,
      thisMonthEnd: today,
      lastMonthStart,
      lastMonthEnd,
      last5DaysStart,
      last5DaysEnd: today
    }
  }

  // Handle complaints filter apply
  const handleComplaintsFilterApply = () => {
    setIsComplaintsLoading(true)
    setIsComplaintsFilterOpen(false)
    
    setTimeout(() => {
      setIsComplaintsLoading(false)
    }, 200)
  }

  // Handle complaints filter reset
  const handleComplaintsFilterReset = () => {
    setComplaintsFilterValues({
      issueType: [],
      reasons: []
    })
    setComplaintsSearchQuery("")
    setIsComplaintsLoading(true)
    setTimeout(() => {
      setIsComplaintsLoading(false)
    }, 200)
  }

  // Handle date range selection
  const handleDateRangeSelect = (range) => {
    setSelectedDateRange(range)
    if (range === "custom") {
      setIsCustomDateOpen(true)
    } else {
      setIsDateSelectorOpen(false)
      setIsComplaintsLoading(true)
      setTimeout(() => {
        setIsComplaintsLoading(false)
      }, 200)
    }
  }

  // Handle custom date range apply
  const handleCustomDateApply = () => {
    setIsCustomDateOpen(false)
    setIsDateSelectorOpen(false)
    setIsComplaintsLoading(true)
    setTimeout(() => {
      setIsComplaintsLoading(false)
    }, 200)
  }

  // Handle swipe gestures
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
      const currentIndex = feedbackTabs.findIndex(tab => tab === activeTab)
      let newIndex = currentIndex
      
      if (swipeDistance > 0 && currentIndex < feedbackTabs.length - 1) {
        // Swipe left - go to next tab
        newIndex = currentIndex + 1
      } else if (swipeDistance < 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        newIndex = currentIndex - 1
      }

      if (newIndex !== currentIndex) {
        setIsTransitioning(true)
        
        // Smooth transition with animation
        setTimeout(() => {
          setActiveTab(feedbackTabs[newIndex])
          
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="">
        {/* Top row - restaurant label + icons */}
        <div className="sticky bg-white top-0 z-40 px-4 py-3 border-b border-gray-200 flex items-center justify-between mb-2">
          <div>
            <p className="text-md font-semibold text-gray-900 mt-0.5">
              {isLoadingRestaurant ? "Loading..." : (restaurantData?.name || "Restaurant")}
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

        {/* Tabs row */}
        <div className="flex gap-2 px-4 py-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <motion.button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id)
                  setSearchParams(tab.id === 'reviews' ? {} : { tab: tab.id })
                }}
                className={`px-6 py-3.5 rounded-full text-sm font-medium whitespace-nowrap relative overflow-hidden ${
                  isActive ? "text-white" : "bg-white text-gray-800 border border-gray-200"
                }`}
                animate={{
                  scale: isActive ? 1.02 : 1,
                }}
                transition={{ duration: 0.2 }}
                whileTap={{ scale: 0.97 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="feedbackTabActive"
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

        {/* Date range row only for Complaints tab */}
        {activeTab === "complaints" && (
          <div className="flex items-center gap-2 px-4">
            <button 
              className="flex-1 bg-white flex items-center justify-between rounded-md px-3 py-2.5 border border-gray-200 hover:bg-gray-50 transition-colors"
              onClick={() => setIsDateSelectorOpen(true)}
            >
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium text-gray-900">
                  {selectedDateRange === "last5days" ? "Last 5 days" : 
                   selectedDateRange === "today" ? "Today so far" :
                   selectedDateRange === "yesterday" ? "Yesterday" :
                   selectedDateRange === "thisWeek" ? "This week so far" :
                   selectedDateRange === "lastWeek" ? "Last week" :
                   selectedDateRange === "thisMonth" ? "This month so far" :
                   selectedDateRange === "lastMonth" ? "Last month" :
                   selectedDateRange === "custom" && customDateRange.start && customDateRange.end ?
                   `${formatDateShort(customDateRange.start)} - ${formatDateShort(customDateRange.end)}` :
                   "Last 5 days"}
                </span>
                <span className="text-[11px] text-gray-500">
                  Select your own date range
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-800" />
              </div>
            </button>
            <button 
              className="w-14 self-stretch rounded-md bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
              onClick={() => setIsComplaintsFilterOpen(true)}
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-800" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div 
        className="flex-1 px-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "complaints" ? (
              <div className="relative">
                {isComplaintsLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg"
                  >
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  </motion.div>
                )}
                {complaints.length === 0 ? (
                  <div className="text-center text-sm text-gray-600 mt-12">
                    No complaints for the selected period.
                  </div>
                ) : (
                  <div className="space-y-3 pb-6">
                    {complaints.map((complaint) => (
                      <div key={complaint._id} className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-gray-900">{complaint.customerName}</p>
                            <p className="text-xs text-gray-500">Order #{complaint.orderNumber}</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-gray-800 mb-1">{complaint.subject}</p>
                        <p className="text-sm text-gray-600 mb-3">{complaint.description}</p>
                        {complaint.restaurantResponse && (
                          <div className="bg-gray-50 rounded p-3 mt-3">
                            <p className="text-xs font-semibold text-gray-700 mb-1">Your Response:</p>
                            <p className="text-sm text-gray-700">{complaint.restaurantResponse}</p>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === "rejected-dish" ? (
              <div className="relative space-y-2 pb-6">
                {isLoadingRejectedDish && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg"
                  >
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  </motion.div>
                )}
                <div className="space-y-1 mt-2">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Rejected dishes ({rejectedDishes.length})
                  </h2>
                  <p className="text-[11px] text-gray-500">
                    Dishes or add-ons rejected by admin. Tap an item to see the rejection reason.
                  </p>
                </div>
                {!isLoadingRejectedDish && rejectedDishes.length === 0 ? (
                  <div className="text-center text-sm text-gray-600 py-8">
                    No rejected dishes.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rejectedDishes.map((dish) => (
                      <div
                        key={`${dish.type}-${dish.id}`}
                        onClick={() => {
                          setSelectedRejectedDish(dish)
                          setIsRejectedDishModalOpen(true)
                        }}
                        className="rounded-2xl bg-white p-4 border border-gray-200 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{dish.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{dish.sectionName}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 pb-6">
                {/* Search + filter */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white rounded-md border border-gray-200 p-3 flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search reviews"
                      className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
                    />
                  </div>
                  <button 
                    className="w-14 self-stretch rounded-md bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                    onClick={() => setIsFilterOpen(true)}
                  >
                    <SlidersHorizontal className="w-4 h-4 text-gray-800" />
                  </button>
                </div>

                {/* Reviews heading + info */}
                <div className="space-y-1 mt-8">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Reviews ({displayedReviews.length})
                  </h2>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <span>ⓘ</span>
                    <span>Delivery reviews are only visible to you</span>
                  </div>
                </div>

                {/* Review cards */}
                <div className="space-y-2 relative">
                  {(isFilterLoading || isLoadingReviews) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg"
                    >
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </motion.div>
                  )}
                  {isLoadingReviews && displayedReviews.length === 0 ? (
                    <div className="text-center text-sm text-gray-600 py-8">
                      Loading reviews...
                    </div>
                  ) : displayedReviews.length === 0 ? (
                    <div className="text-center text-sm text-gray-600 py-8">
                      No reviews found.
                    </div>
                  ) : (
                    displayedReviews.map((review) => (
                  <div 
                    key={review.id} 
                    className="rounded-2xl bg-white p-3 space-y-3  cursor-pointer"
                    onClick={() => handleReviewClick(review)}
                  >
                    {/* Order & outlet */}
                    <div className="text-[11px] text-gray-500 flex items-center justify-between gap-2">
                      <span className="truncate">
                        Order #{review.orderNumber} · {review.outlet}
                      </span>
                    </div>

                    {/* User row */}
                    <div className="flex items-center gap-3">
                      <img
                        src={review.userImage}
                        alt={review.userName}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {review.userName}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {review.ordersCount} order{review.ordersCount !== 1 ? 's' : ''} with you
                        </p>
                      </div>
                    </div>

                    {/* Rating + text card */}
                    <div className="mt-1 rounded-xl bg-gray-100 px-3 py-2 relative">
                      {/* Speech bubble tail */}
                      <div className="absolute -top-2 left-4 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-gray-100"></div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-700 text-white text-[11px] font-semibold">
                          {review.rating}★
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {review.date}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">
                        {review.reviewText}
                      </p>
                    </div>

                    {/* Reply section - show if reply exists */}
                    {review.reply && (
                      <div className="mt-2 rounded-xl bg-blue-50 px-3 py-2 relative">
                        {/* Speech bubble tail for reply */}
                        <div className="absolute -top-2 right-4 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-blue-50"></div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-gray-600 font-medium">
                            Your reply
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">
                          {review.reply}
                        </p>
                      </div>
                    )}

                    {/* Reply link */}
                    <div className="flex justify-end">
                      <button 
                        className="text-xs font-medium text-blue-700 flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReviewClick(review)
                        }}
                      >
                        <Reply className="w-3.5 h-3.5" />
                        <span>{review.reply ? "Edit Reply" : "Reply"}</span>
                      </button>
                    </div>
                  </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Review Detail Modal */}
      <AnimatePresence>
        {isReviewModalOpen && selectedReview && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[9999]"
              onClick={handleCloseModal}
            />
            
            {/* Modal */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[9999] max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-10">
                <button
                  onClick={handleCloseModal}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-900" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">Review</h2>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {/* Restaurant name */}
                <p className="text-sm text-gray-600 mb-4">
                  {selectedReview.outlet}
                </p>

                {/* User row */}
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={selectedReview.userImage}
                    alt={selectedReview.userName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedReview.userName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedReview.ordersCount} order{selectedReview.ordersCount !== 1 ? 's' : ''} with you
                    </p>
                  </div>
                </div>

                {/* Rating + text card */}
                <div className="mt-1 rounded-xl bg-gray-50 px-3 py-2 relative mb-6">
                  {/* Speech bubble tail */}
                  <div className="absolute -top-2 left-4 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-gray-50"></div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-700 text-white text-[11px] font-semibold">
                      {selectedReview.rating}★
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {selectedReview.date}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">
                    {selectedReview.reviewText}
                  </p>
                </div>
              </div>

              {/* Reply Input Area */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply"
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && replyText.trim()) {
                        handleSendReply()
                      }
                    }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim()}
                    className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${
                      replyText.trim()
                        ? "bg-gray-900 text-white hover:bg-gray-800"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Rejected Dish – Rejection Reason Modal */}
      <AnimatePresence>
        {isRejectedDishModalOpen && selectedRejectedDish && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[9999]"
              onClick={() => {
                setIsRejectedDishModalOpen(false)
                setSelectedRejectedDish(null)
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[9999] max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-10">
                <button
                  onClick={() => {
                    setIsRejectedDishModalOpen(false)
                    setSelectedRejectedDish(null)
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-900" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">Rejection reason</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <p className="text-sm text-gray-600 mb-1">{selectedRejectedDish.sectionName}</p>
                <p className="text-base font-semibold text-gray-900 mb-4">{selectedRejectedDish.name}</p>
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-xs font-semibold text-red-800 mb-1">Reason for rejection</p>
                  <p className="text-sm text-red-900 whitespace-pre-wrap">{selectedRejectedDish.rejectionReason}</p>
                </div>
                {selectedRejectedDish.rejectedAt && (
                  <p className="text-xs text-gray-500 mt-3">
                    Rejected on {new Date(selectedRejectedDish.rejectedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Filter Modal */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[9999]"
              onClick={() => setIsFilterOpen(false)}
            />
            
            {/* Filter Modal */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[9999] h-[65vh] flex flex-col"

              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="w-10 h-10 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Content - Two Column Layout */}
              <div className="flex-1 overflow-hidden flex">
                {/* Left Column - Filter Categories */}
                <div className="w-32 bg-gray-50 border-r border-gray-200 flex flex-col">
                  <button
                    onClick={() => setSelectedFilterCategory("duration")}
                    className={`p-4 text-left text-sm font-medium transition-colors ${
                      selectedFilterCategory === "duration"
                        ? "bg-white text-gray-900 border-l-2 border-black"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Duration
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory("sortBy")}
                    className={`p-4 text-left text-sm font-medium transition-colors ${
                      selectedFilterCategory === "sortBy"
                        ? "bg-white text-gray-900 border-l-2 border-black"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Sort by
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory("reviewType")}
                    className={`p-4 text-left text-sm font-medium transition-colors ${
                      selectedFilterCategory === "reviewType"
                        ? "bg-white text-gray-900 border-l-2 border-black"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Review type
                  </button>
                </div>

                {/* Right Column - Filter Options */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {selectedFilterCategory === "duration" && (
                    <div className="space-y-6">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="duration"
                          checked={filterValues.duration === "7days"}
                          onChange={() => setFilterValues(prev => ({ ...prev, duration: "7days" }))}
                          className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                        />
                        <span className="text-sm text-gray-900 font-medium">Last 7 days</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="duration"
                          checked={filterValues.duration === "30days"}
                          onChange={() => setFilterValues(prev => ({ ...prev, duration: "30days" }))}
                          className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                        />
                        <span className="text-sm text-gray-900 font-medium">Last 30 days</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="duration"
                          checked={filterValues.duration === "90days"}
                          onChange={() => setFilterValues(prev => ({ ...prev, duration: "90days" }))}
                          className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                        />
                        <span className="text-sm text-gray-900 font-medium">Last 90 days</span>
                      </label>
                    </div>
                  )}

                  {selectedFilterCategory === "sortBy" && (
                    <div className="space-y-6">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="sortBy"
                          checked={filterValues.sortBy === "newest"}
                          onChange={() => setFilterValues(prev => ({ ...prev, sortBy: "newest" }))}
                          className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                        />
                        <span className="text-sm text-gray-900 font-medium">Newest first</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="sortBy"
                          checked={filterValues.sortBy === "oldest"}
                          onChange={() => setFilterValues(prev => ({ ...prev, sortBy: "oldest" }))}
                          className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                        />
                        <span className="text-sm text-gray-900 font-medium">Oldest first</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="sortBy"
                          checked={filterValues.sortBy === "bestRated"}
                          onChange={() => setFilterValues(prev => ({ ...prev, sortBy: "bestRated" }))}
                          className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                        />
                        <span className="text-sm text-gray-900 font-medium">Best rated first</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="sortBy"
                          checked={filterValues.sortBy === "worstRated"}
                          onChange={() => setFilterValues(prev => ({ ...prev, sortBy: "worstRated" }))}
                          className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                        />
                        <span className="text-sm text-gray-900 font-medium">Worst rated first</span>
                      </label>
                    </div>
                  )}

                  {selectedFilterCategory === "reviewType" && (
                    <div className="space-y-6">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterValues.reviewType.includes("detailed")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilterValues(prev => ({
                                ...prev,
                                reviewType: [...prev.reviewType, "detailed"]
                              }))
                            } else {
                              setFilterValues(prev => ({
                                ...prev,
                                reviewType: prev.reviewType.filter(t => t !== "detailed")
                              }))
                            }
                          }}
                          className="w-5 h-5 text-black border-gray-300 focus:ring-black rounded"
                        />
                        <span className="text-sm text-gray-900 font-medium">Detailed reviews</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterValues.reviewType.includes("dining")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilterValues(prev => ({
                                ...prev,
                                reviewType: [...prev.reviewType, "dining"]
                              }))
                            } else {
                              setFilterValues(prev => ({
                                ...prev,
                                reviewType: prev.reviewType.filter(t => t !== "dining")
                              }))
                            }
                          }}
                          className="w-5 h-5 text-black border-gray-300 focus:ring-black rounded"
                        />
                        <span className="text-sm text-gray-900 font-medium">Dining</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterValues.reviewType.includes("delivery")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilterValues(prev => ({
                                ...prev,
                                reviewType: [...prev.reviewType, "delivery"]
                              }))
                            } else {
                              setFilterValues(prev => ({
                                ...prev,
                                reviewType: prev.reviewType.filter(t => t !== "delivery")
                              }))
                            }
                          }}
                          className="w-5 h-5 text-black border-gray-300 focus:ring-black rounded"
                        />
                        <span className="text-sm text-gray-900 font-medium">Delivery</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer - Action Buttons */}
              <div className="border-t border-gray-200 px-4 py-4 flex gap-3">
                <button
                  onClick={handleFilterReset}
                  className="flex-1 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={handleFilterApply}
                  className="flex-1 bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Date Selector Popup */}
      <AnimatePresence>
        {isDateSelectorOpen && !isCustomDateOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[9999]"
              onClick={() => setIsDateSelectorOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[9999] max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 text-center">Date range selection</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {(() => {
                  const ranges = getDateRanges()
                  const dateOptions = [
                    { id: "today", label: "Today so far", date: formatDate(ranges.today) },
                    { id: "yesterday", label: "Yesterday", date: formatDate(ranges.yesterday) },
                    { id: "thisWeek", label: "This week so far", date: `${formatDateShort(ranges.thisWeekStart)} - ${formatDateShort(ranges.thisWeekEnd)}` },
                    { id: "lastWeek", label: "Last week", date: `${formatDateShort(ranges.lastWeekStart)} - ${formatDateShort(ranges.lastWeekEnd)}` },
                    { id: "thisMonth", label: "This month so far", date: `${formatDateShort(ranges.thisMonthStart)} - ${formatDateShort(ranges.thisMonthEnd)}` },
                    { id: "lastMonth", label: "Last month", date: `${formatDateShort(ranges.lastMonthStart)} - ${formatDateShort(ranges.lastMonthEnd)}` },
                    { id: "last5days", label: "Last 5 days", date: `${formatDateShort(ranges.last5DaysStart)} - ${formatDateShort(ranges.last5DaysEnd)}` }
                  ]
                  return (
                    <div className="space-y-4">
                      {dateOptions.map((option) => (
                        <label
                          key={option.id}
                          className="flex items-center justify-between cursor-pointer py-2"
                          onClick={() => handleDateRangeSelect(option.id)}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{option.label}</span>
                            <span className="text-xs text-gray-500 mt-0.5">{option.date}</span>
                          </div>
                          <input
                            type="radio"
                            name="dateRange"
                            checked={selectedDateRange === option.id}
                            onChange={() => handleDateRangeSelect(option.id)}
                            className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                          />
                        </label>
                      ))}
                      <button
                        onClick={() => handleDateRangeSelect("custom")}
                        className="w-full flex items-center justify-between py-2 cursor-pointer"
                      >
                        <div className="flex flex-col text-start">
                          <span className="text-sm font-medium text-start text-gray-900">Custom date</span>
                          <span className="text-xs text-gray-500 mt-0.5">Select your own date range and aggregation</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  )
                })()}
              </div>
              <div className="border-t border-gray-200 px-4 py-4 flex gap-3">
                <button
                  onClick={() => setIsDateSelectorOpen(false)}
                  className="flex-1 py-3 text-sm font-medium text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsDateSelectorOpen(false)
                    setIsComplaintsLoading(true)
                    setTimeout(() => {
                      setIsComplaintsLoading(false)
                    }, 200)
                  }}
                  className="flex-1 bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom Date Calendar Popup */}
      <AnimatePresence>
        {isCustomDateOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[10000]"
              onClick={() => {
                setIsCustomDateOpen(false)
                setIsDateSelectorOpen(true)
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[10000] max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
                <button
                  onClick={() => {
                    setIsCustomDateOpen(false)
                    setIsDateSelectorOpen(true)
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-900" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">Custom date</h2>
                <div className="w-8" />
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <DateRangeCalendar
                  startDate={customDateRange.start}
                  endDate={customDateRange.end}
                  onDateRangeChange={(start, end) => {
                    setCustomDateRange({ start, end })
                    setSelectedDateRange("custom")
                  }}
                  onClose={() => {
                    setIsCustomDateOpen(false)
                    setIsDateSelectorOpen(true)
                  }}
                />
              </div>
              <div className="border-t border-gray-200 px-4 py-4 flex gap-3">
                <button
                  onClick={() => {
                    setIsCustomDateOpen(false)
                    setIsDateSelectorOpen(true)
                  }}
                  className="flex-1 py-3 text-sm font-medium text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomDateApply}
                  className="flex-1 bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Complaints Filter Popup */}
      <AnimatePresence>
        {isComplaintsFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[9999]"
              onClick={() => setIsComplaintsFilterOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[9999] h-[65vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 text-center">Filters</h2>
              </div>
              <div className="flex-1 overflow-hidden flex">
                {/* Left Column - Filter Categories */}
                <div className="w-32 bg-gray-50 border-r border-gray-200 flex flex-col">
                  <button
                    onClick={() => setSelectedComplaintsFilterCategory("issueType")}
                    className={`p-4 text-left text-sm font-medium transition-colors ${
                      selectedComplaintsFilterCategory === "issueType"
                        ? "bg-white text-gray-900 border-l-2 border-black"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Issue type
                  </button>
                  <button
                    onClick={() => setSelectedComplaintsFilterCategory("reasons")}
                    className={`p-4 text-left text-sm font-medium transition-colors ${
                      selectedComplaintsFilterCategory === "reasons"
                        ? "bg-white text-gray-900 border-l-2 border-black"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Reasons
                  </button>
                </div>

                {/* Right Column - Filter Options */}
                <div className="flex-1 overflow-y-auto">
                  {selectedComplaintsFilterCategory === "issueType" && (
                    <div className="p-4">
                      <div className="mb-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={complaintsSearchQuery}
                            onChange={(e) => setComplaintsSearchQuery(e.target.value)}
                            placeholder="Search"
                            className="w-full pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        {["Expired", "Dismissed", "Winback", "Open", "Resolved"].filter(option =>
                          option.toLowerCase().includes(complaintsSearchQuery.toLowerCase())
                        ).map((option) => (
                          <label key={option} className="flex items-center gap-4 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={complaintsFilterValues.issueType.includes(option.toLowerCase())}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setComplaintsFilterValues(prev => ({
                                    ...prev,
                                    issueType: [...prev.issueType, option.toLowerCase()]
                                  }))
                                } else {
                                  setComplaintsFilterValues(prev => ({
                                    ...prev,
                                    issueType: prev.issueType.filter(t => t !== option.toLowerCase())
                                  }))
                                }
                              }}
                              className="w-5 h-5 text-black border-gray-300 focus:ring-black rounded"
                            />
                            <span className="text-sm text-gray-900 font-medium">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedComplaintsFilterCategory === "reasons" && (
                    <div className="p-4">
                      <div className="mb-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={complaintsSearchQuery}
                            onChange={(e) => setComplaintsSearchQuery(e.target.value)}
                            placeholder="Search"
                            className="w-full pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        {[
                          "Wrong item(s) delivered",
                          "Issue with food quantity",
                          "Poor packaging or spillage",
                          "Order delayed",
                          "Item(s) missing or not delivered",
                          "Poor taste or quality"
                        ].filter(option =>
                          option.toLowerCase().includes(complaintsSearchQuery.toLowerCase())
                        ).map((option) => (
                          <label key={option} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={complaintsFilterValues.reasons.includes(option)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setComplaintsFilterValues(prev => ({
                                    ...prev,
                                    reasons: [...prev.reasons, option]
                                  }))
                                } else {
                                  setComplaintsFilterValues(prev => ({
                                    ...prev,
                                    reasons: prev.reasons.filter(r => r !== option)
                                  }))
                                }
                              }}
                              className="w-5 h-5 text-black border-gray-300 focus:ring-black rounded"
                            />
                            <span className="text-sm text-gray-900 font-medium">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer - Action Buttons */}
              <div className="border-t border-gray-200 px-4 py-4 flex gap-3">
                <button
                  onClick={handleComplaintsFilterReset}
                  className="flex-1 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Clear all
                </button>
                <button
                  onClick={handleComplaintsFilterApply}
                  className="flex-1 bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <BottomNavOrders />
    </div>
  )
}
