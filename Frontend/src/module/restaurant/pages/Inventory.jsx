import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Loader2,
  Utensils,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  ThumbsUp
} from "lucide-react"
import RestaurantNavbar from "../components/RestaurantNavbar"
import BottomNavOrders from "../components/BottomNavOrders"
import { Switch } from "@/components/ui/switch"
import { useNavigate } from "react-router-dom"
import { restaurantAPI } from "@/lib/api"
import { toast } from "sonner"

const INVENTORY_STORAGE_KEY = "restaurant_inventory_state"

const isAddonApproved = (addon) => {
  const status = String(addon?.approvalStatus || "").trim().toLowerCase()
  if (status === "approved") return true
  if (status === "pending" || status === "rejected") return false
  if (addon?.isApproved === true) return true
  if (addon?.approvedAt && !addon?.rejectedAt) return true
  return false
}

// Mock data - replace with actual data from API
const mockCategories = [
  {
    id: "combo",
    name: "Combo",
    description: "Combo",
    itemCount: 1,
    inStock: true,
    items: [
      { id: 1, name: "Manchurian with Rice", inStock: true, isVeg: true }
    ]
  },
  {
    id: "starters",
    name: "Starters",
    description: "Starters",
    itemCount: 2,
    inStock: true,
    items: [
      { id: 2, name: "Paneer Manchurian", inStock: true, isVeg: true },
      { id: 3, name: "Cheese Manchurian", inStock: true, isVeg: true }
    ]
  },
  {
    id: "main-course",
    name: "Main Course",
    description: "Main Course",
    itemCount: 2,
    inStock: true,
    items: [
      { id: 4, name: "Butter Chicken", inStock: true, isVeg: false },
      { id: 5, name: "Dal Makhani", inStock: true, isVeg: true }
    ]
  },
  {
    id: "rice",
    name: "Rice",
    description: "Rice and Biryani",
    itemCount: 1,
    inStock: false,
    items: [
      { id: 6, name: "Tava Pulao", inStock: false, isVeg: true }
    ]
  },
  {
    id: "desserts",
    name: "Desserts",
    description: "Desserts",
    itemCount: 3,
    inStock: false,
    items: [
      { id: 7, name: "Gulab Jamun", inStock: false, isVeg: true },
      { id: 8, name: "Ice Cream", inStock: true, isVeg: true },
      { id: 9, name: "Kheer", inStock: false, isVeg: true }
    ]
  }
]

// Time Picker Wheel Component (copied from DaySlots.jsx)
function TimePickerWheel({
  isOpen,
  onClose,
  initialHour,
  initialMinute,
  initialPeriod,
  onConfirm
}) {
  const parsedHour = Math.max(1, Math.min(12, parseInt(initialHour) || 1))
  const parsedMinute = Math.max(0, Math.min(59, parseInt(initialMinute) || 0))
  const parsedPeriod = (initialPeriod === "am" || initialPeriod === "pm") ? initialPeriod : "am"

  const [selectedHour, setSelectedHour] = useState(parsedHour)
  const [selectedMinute, setSelectedMinute] = useState(parsedMinute)
  const [selectedPeriod, setSelectedPeriod] = useState(parsedPeriod)

  const hourRef = useRef(null)
  const minuteRef = useRef(null)
  const periodRef = useRef(null)
  const scrollTimeoutRef = useRef(null)
  const isScrollingRef = useRef(false)

  const hours = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = Array.from({ length: 60 }, (_, i) => i)
  const periods = ["am", "pm"]

  useEffect(() => {
    if (isOpen) {
      setSelectedHour(parsedHour)
      setSelectedMinute(parsedMinute)
      setSelectedPeriod(parsedPeriod)
    }
  }, [isOpen, initialHour, initialMinute, initialPeriod, parsedHour, parsedMinute, parsedPeriod])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'

      const timer = setTimeout(() => {
        const padding = 80
        const itemHeight = 40

        const hourIndex = parsedHour - 1
        const hourScrollPos = padding + (hourIndex * itemHeight)
        if (hourRef.current) {
          hourRef.current.scrollTop = hourScrollPos
          setSelectedHour(parsedHour)
          setTimeout(() => {
            hourRef.current?.scrollTo({
              top: hourScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }

        const minuteIndex = Math.max(0, Math.min(59, parsedMinute))
        const minuteScrollPos = padding + (minuteIndex * itemHeight)
        if (minuteRef.current) {
          minuteRef.current.scrollTop = minuteScrollPos
          setSelectedMinute(minuteIndex)
          setTimeout(() => {
            minuteRef.current?.scrollTo({
              top: minuteScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }

        const periodIndex = periods.indexOf(parsedPeriod)
        const periodScrollPos = padding + (periodIndex * itemHeight)
        if (periodRef.current) {
          periodRef.current.scrollTop = periodScrollPos
          setSelectedPeriod(parsedPeriod)
          setTimeout(() => {
            periodRef.current?.scrollTo({
              top: periodScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }
      }, 150)

      return () => {
        clearTimeout(timer)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, parsedHour, parsedMinute, parsedPeriod])

  const handleScroll = (container, setValue, values, itemHeight) => {
    if (!container || isScrollingRef.current) return

    const padding = 80
    const scrollTop = container.scrollTop
    const index = Math.round((scrollTop - padding) / itemHeight)
    const clampedIndex = Math.max(0, Math.min(index, values.length - 1))
    const newValue = values[clampedIndex]

    if (newValue !== undefined) {
      setValue(newValue)
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    isScrollingRef.current = true
    scrollTimeoutRef.current = setTimeout(() => {
      const finalIndex = Math.round((container.scrollTop - padding) / itemHeight)
      const finalClampedIndex = Math.max(0, Math.min(finalIndex, values.length - 1))
      const snapPosition = padding + (finalClampedIndex * itemHeight)
      container.scrollTop = snapPosition
      if (values[finalClampedIndex] !== undefined) {
        setValue(values[finalClampedIndex])
      }
      setTimeout(() => {
        container.scrollTo({
          top: snapPosition,
          behavior: 'smooth'
        })
      }, 50)

      setTimeout(() => {
        isScrollingRef.current = false
      }, 300)
    }, 150)
  }

  const handleConfirm = () => {
    const hourStr = selectedHour.toString()
    const minuteStr = selectedMinute.toString().padStart(2, '0')
    onConfirm(hourStr, minuteStr, selectedPeriod)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-lg shadow-2xl w-full max-w-xs overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-center py-8 px-4 relative">
            <style>{`
              .time-picker-scroll::-webkit-scrollbar {
                display: none;
              }
              .time-picker-scroll {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>

            <div className="flex-1 flex flex-col items-center">
              <div
                ref={hourRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(hourRef.current, setSelectedHour, hours, 40)}
                onTouchEnd={() => {
                  setTimeout(() => {
                    if (hourRef.current) {
                      const padding = 80
                      const itemHeight = 40
                      const scrollTop = hourRef.current.scrollTop
                      const index = Math.round((scrollTop - padding) / itemHeight)
                      const clampedIndex = Math.max(0, Math.min(index, hours.length - 1))
                      const snapPosition = padding + (clampedIndex * itemHeight)
                      hourRef.current.scrollTop = snapPosition
                      if (hours[clampedIndex] !== undefined) {
                        setSelectedHour(hours[clampedIndex])
                      }
                      setTimeout(() => {
                        hourRef.current?.scrollTo({
                          top: snapPosition,
                          behavior: 'smooth'
                        })
                      }, 50)
                    }
                  }, 100)
                }}
              >
                <div className="h-20"></div>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${selectedHour === hour
                          ? 'font-bold text-gray-900 text-xl'
                          : 'font-normal text-gray-400 text-base'
                        }`}
                    >
                      {hour}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            <div className="px-2">
              <span className="text-2xl font-bold text-gray-900">:</span>
            </div>

            <div className="flex-1 flex flex-col items-center">
              <div
                ref={minuteRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(minuteRef.current, setSelectedMinute, minutes, 40)}
                onTouchEnd={() => {
                  setTimeout(() => {
                    if (minuteRef.current) {
                      const padding = 80
                      const itemHeight = 40
                      const scrollTop = minuteRef.current.scrollTop
                      const index = Math.round((scrollTop - padding) / itemHeight)
                      const clampedIndex = Math.max(0, Math.min(index, minutes.length - 1))
                      const snapPosition = padding + (clampedIndex * itemHeight)
                      minuteRef.current.scrollTop = snapPosition
                      if (minutes[clampedIndex] !== undefined) {
                        setSelectedMinute(minutes[clampedIndex])
                      }
                      setTimeout(() => {
                        minuteRef.current?.scrollTo({
                          top: snapPosition,
                          behavior: 'smooth'
                        })
                      }, 50)
                    }
                  }, 100)
                }}
              >
                <div className="h-20"></div>
                {minutes.map((minute) => (
                  <div
                    key={minute}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${selectedMinute === minute
                          ? 'font-bold text-gray-900 text-xl'
                          : 'font-normal text-gray-400 text-base'
                        }`}
                    >
                      {minute.toString().padStart(2, '0')}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center">
              <div
                ref={periodRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(periodRef.current, setSelectedPeriod, periods, 40)}
                onTouchEnd={() => {
                  setTimeout(() => {
                    if (periodRef.current) {
                      const padding = 80
                      const itemHeight = 40
                      const scrollTop = periodRef.current.scrollTop
                      const index = Math.round((scrollTop - padding) / itemHeight)
                      const clampedIndex = Math.max(0, Math.min(index, periods.length - 1))
                      const snapPosition = padding + (clampedIndex * itemHeight)
                      periodRef.current.scrollTop = snapPosition
                      if (periods[clampedIndex] !== undefined) {
                        setSelectedPeriod(periods[clampedIndex])
                      }
                      setTimeout(() => {
                        periodRef.current?.scrollTo({
                          top: snapPosition,
                          behavior: 'smooth'
                        })
                      }, 50)
                    }
                  }, 100)
                }}
              >
                <div className="h-20"></div>
                {periods.map((period) => (
                  <div
                    key={period}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${selectedPeriod === period
                          ? 'font-bold text-gray-900 text-xl'
                          : 'font-normal text-gray-400 text-base'
                        }`}
                    >
                      {period}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="border-t border-gray-300 mx-4"></div>
              <div className="border-b border-gray-300 mx-4 mt-10"></div>
            </div>
          </div>

          <div className="border-t border-gray-200 px-4 py-4 flex justify-center">
            <button
              onClick={handleConfirm}
              className="text-blue-600 hover:text-blue-700 font-medium text-base transition-colors"
            >
              Okay
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Simple Calendar Component
function SimpleCalendar({ selectedDate, onDateSelect, isOpen, onClose }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    return selectedDate ? new Date(selectedDate) : new Date()
  })
  const calendarRef = useRef(null)

  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(new Date(selectedDate))
    }
  }, [selectedDate])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - startDate.getDay() + (startDate.getDay() === 0 ? -6 : 1))

    const days = []
    const currentDate = new Date(startDate)

    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return days
  }, [currentMonth])

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentMonth.getMonth()
  }

  const isSelected = (date) => {
    if (!selectedDate) return false
    return date.toDateString() === new Date(selectedDate).toDateString()
  }

  const isToday = (date) => {
    return date.toDateString() === new Date().toDateString()
  }

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"]
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          ref={calendarRef}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  const prevMonth = new Date(currentMonth)
                  prevMonth.setMonth(prevMonth.getMonth() - 1)
                  setCurrentMonth(prevMonth)
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-semibold">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button
                onClick={() => {
                  const nextMonth = new Date(currentMonth)
                  nextMonth.setMonth(nextMonth.getMonth() + 1)
                  setCurrentMonth(nextMonth)
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, index) => {
                const isCurrent = isCurrentMonth(date)
                const isSelectedDate = isSelected(date)
                const isTodayDate = isToday(date)

                return (
                  <button
                    key={index}
                    onClick={() => {
                      onDateSelect(new Date(date))
                      onClose()
                    }}
                    className={`h-10 text-sm rounded transition-colors ${!isCurrent
                        ? 'text-gray-300'
                        : isSelectedDate
                          ? 'bg-black text-white'
                          : isTodayDate
                            ? 'bg-gray-100 text-black font-semibold'
                            : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function Inventory() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("all-items")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [categories, setCategories] = useState(() => {
    try {
      if (typeof window === "undefined") return mockCategories
      const saved = localStorage.getItem(INVENTORY_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed
        }
      }
    } catch (error) {
      console.error("Error loading inventory from storage:", error)
    }
    return mockCategories
  })
  const [expandedCategories, setExpandedCategories] = useState(() =>
    mockCategories.map(c => c.id)
  )
  const [togglePopupOpen, setTogglePopupOpen] = useState(false)
  const [toggleTarget, setToggleTarget] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Toggle popup state
  const [selectedOption, setSelectedOption] = useState("specific-time")
  const [hours, setHours] = useState(3)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState({ hour: "2", minute: "30", period: "pm" })
  const [showCalendar, setShowCalendar] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const categoryRefs = useRef({})

  // Swipe gesture refs
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)
  const mouseStartX = useRef(0)
  const mouseEndX = useRef(0)
  const isMouseDown = useRef(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [addons, setAddons] = useState([])
  const [loadingAddons, setLoadingAddons] = useState(false)

  // Inventory tabs
  const inventoryTabs = ["all-items", "add-ons"]

  // Tab bar ref for excluding swipe on topbar
  const tabBarRef = useRef(null)

  // Content container ref
  const contentContainerRef = useRef(null)

  // Fetch menu items from API and convert to inventory format
  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        setLoadingInventory(true)
        
        // Fetch menu from API
        const menuResponse = await restaurantAPI.getMenu()
        
        if (menuResponse.data && menuResponse.data.success && menuResponse.data.data && menuResponse.data.data.menu) {
          const menuSections = menuResponse.data.data.menu.sections || []
          
          // Convert menu sections to inventory categories
          const convertedCategories = menuSections.map((section, sectionIndex) => {
            // Collect all items from section and subsections
            const allItems = []
            
            // Add direct items from section
            if (Array.isArray(section.items)) {
              section.items.forEach(item => {
                  allItems.push({
                  id: String(item.id || Date.now() + Math.random()),
                  name: item.name || "Unnamed Item",
                  inStock: item.isAvailable !== undefined ? item.isAvailable : true,
                  isVeg: item.foodType === "Veg",
                  isRecommended: item.isRecommended !== undefined ? item.isRecommended : false,
                  stockQuantity: item.stock || "Unlimited",
                  unit: item.itemSizeUnit || "piece",
                  expiryDate: null,
                  lastRestocked: null,
                })
              })
            }
            
            // Add items from subsections
            if (Array.isArray(section.subsections)) {
              section.subsections.forEach(subsection => {
                if (Array.isArray(subsection.items)) {
                  subsection.items.forEach(item => {
                  allItems.push({
                  id: String(item.id || Date.now() + Math.random()),
                  name: item.name || "Unnamed Item",
                  inStock: item.isAvailable !== undefined ? item.isAvailable : true,
                  isVeg: item.foodType === "Veg",
                  isRecommended: item.isRecommended !== undefined ? item.isRecommended : false,
                  stockQuantity: item.stock || "Unlimited",
                  unit: item.itemSizeUnit || "piece",
                  expiryDate: null,
                  lastRestocked: null,
                })
                  })
                }
              })
            }
            
            // Use category's isEnabled from menu API, not calculated from items
            // Category toggle should be independent of item toggles
            const categoryInStock = section.isEnabled !== undefined ? section.isEnabled : true
            const itemCount = allItems.length
            
            return {
              id: section.id || `category-${sectionIndex}`,
              name: section.name || "Unnamed Category",
              description: section.description || "",
              itemCount: itemCount,
              inStock: categoryInStock,
              items: allItems,
              order: section.order !== undefined ? section.order : sectionIndex,
            }
          })
          
          setCategories(convertedCategories)
          setExpandedCategories(convertedCategories.map(c => c.id))
        } else {
          // Empty menu - start fresh
          setCategories([])
          setExpandedCategories([])
        }
      } catch (error) {
        // Only log and show toast if it's not a network/timeout error
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
        console.error('Error fetching menu data:', error)
          toast.error('Failed to load menu data')
        } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          // Silently handle network errors - backend is not running
          // The axios interceptor already handles these with proper error messages
        }
        setCategories([])
        setExpandedCategories([])
      } finally {
        setLoadingInventory(false)
      }
    }
    
    fetchMenuData()
  }, [])

  // Note: Menu items are now displayed from menu API
  // Stock status updates should be managed through the menu API, not inventory API
  // Auto-save disabled since we're displaying menu data, not inventory data

  // Fetch add-ons when add-ons tab is active
  const fetchAddons = async (showLoading = true) => {
    try {
      if (showLoading) setLoadingAddons(true)
      const response = await restaurantAPI.getAddons()
      const data = response?.data?.data?.addons || response?.data?.addons || []
      // Filter to show only approved add-ons
      const approvedAddons = data.filter((addon) => isAddonApproved(addon))
      setAddons(approvedAddons)
    } catch (error) {
      console.error('Error fetching add-ons:', error)
      toast.error('Failed to load add-ons')
      setAddons([])
    } finally {
      if (showLoading) setLoadingAddons(false)
    }
  }

  useEffect(() => {
    if (activeTab === "add-ons") {
      fetchAddons(true)
    }
  }, [activeTab])

  // Handle addon toggle
  const handleAddonToggle = async (addonId, isAvailable) => {
    try {
      // Update addon availability via API
      await restaurantAPI.updateAddon(addonId, {
        isAvailable: isAvailable
      })

      // Update local state
      setAddons(prev => prev.map(a => 
        a.id === addonId ? { ...a, isAvailable } : a
      ))

      toast.success(`Add-on ${isAvailable ? 'enabled' : 'disabled'} successfully`)
    } catch (error) {
      console.error('Error toggling addon:', error)
      toast.error('Failed to update add-on availability')
    }
  }

  // Handle swipe gestures
  const handleTouchStart = (e) => {
    const target = e.target
    // Don't handle swipe if starting on topbar
    if (tabBarRef.current?.contains(target)) return

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
      const currentIndex = inventoryTabs.findIndex(tab => tab === activeTab)
      let newIndex = currentIndex

      if (swipeDistance > 0 && currentIndex < inventoryTabs.length - 1) {
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
          setActiveTab(inventoryTabs[newIndex])

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

  // Persist categories to localStorage whenever they change
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(categories))
    } catch (error) {
      console.error("Error saving inventory to storage:", error)
    }
  }, [categories])

  // Calculate total items
  const totalItems = useMemo(
    () => categories.reduce((sum, cat) => sum + (cat.itemCount || (cat.items?.length || 0)), 0),
    [categories]
  )

  // Filter categories based on selected filter (in stock / out of stock)
  const statusFilteredCategories = useMemo(() => {
    if (!selectedFilter) return categories

    return categories.filter(category => {
      const items = category.items || []
      if (selectedFilter === "out-of-stock") {
        // Show categories that have at least one out of stock item
        return items.some(item => !item.inStock)
      } else if (selectedFilter === "in-stock") {
        // Show categories that have all items in stock
        return items.length > 0 && items.every(item => item.inStock)
      }
      return true
    })
  }, [categories, selectedFilter])

  // Apply text search on categories & items
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return statusFilteredCategories

    return statusFilteredCategories
      .map(category => {
        const items = category.items || []
        const matchesCategory =
          category.name?.toLowerCase().includes(q) ||
          (category.description || "").toLowerCase().includes(q)

        const matchingItems = items.filter(item =>
          item.name?.toLowerCase().includes(q)
        )

        if (!matchesCategory && matchingItems.length === 0) {
          return null
        }

        return {
          ...category,
          items: matchingItems.length > 0 ? matchingItems : items,
        }
      })
      .filter(Boolean)
  }, [statusFilteredCategories, searchQuery])

  // Derived add-ons list with stock filter applied
  const statusFilteredAddons = useMemo(() => {
    if (!selectedFilter) return addons

    if (selectedFilter === "out-of-stock") {
      // Out of stock = explicitly not available
      return addons.filter(addon => addon.isAvailable === false)
    }

    if (selectedFilter === "in-stock") {
      // In stock = available or missing flag (treated as available)
      return addons.filter(addon => addon.isAvailable !== false)
    }

    return addons
  }, [addons, selectedFilter])

  // Apply text search on add-ons (name + category-like fields)
  const filteredAddons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return statusFilteredAddons

    return statusFilteredAddons.filter(addon => {
      const name = addon.name || ""
      const categoryName = addon.categoryName || addon.category || addon.groupName || ""
      return (
        name.toLowerCase().includes(q) ||
        categoryName.toLowerCase().includes(q)
      )
    })
  }, [statusFilteredAddons, searchQuery])

  // When on Add-ons tab, we hide the main categories list
  const listToRender = activeTab === "add-ons" ? [] : filteredCategories

  // Calculate out of stock count for a category
  const getOutOfStockCount = (category) => {
    return category.items.filter(item => !item.inStock).length
  }

  // Handle filter apply
  const handleFilterApply = () => {
    setIsLoading(true)
    setFilterOpen(false)

    // Simulate loading
    setTimeout(() => {
      setIsLoading(false)
    }, 1500)
  }

  // Handle filter clear
  const handleFilterClear = () => {
    setSelectedFilter(null)
    setFilterOpen(false)
  }

  // Update menu API when category/item toggles change
  const updateMenuAPI = async (categoryId, itemId, isEnabled, isAvailable) => {
    try {
      // Fetch current menu
      const menuResponse = await restaurantAPI.getMenu()
      if (!menuResponse.data || !menuResponse.data.success || !menuResponse.data.data || !menuResponse.data.data.menu) {
        console.error('Failed to fetch menu for update')
        return
      }

      const menu = menuResponse.data.data.menu
      const sections = menu.sections || []

      // Update menu sections
      const updatedSections = sections.map(section => {
        if (section.id !== categoryId) return section

        // If updating category, set isEnabled and propagate availability to all items
        if (itemId === null) {
          const items = Array.isArray(section.items)
            ? section.items.map(item => ({
                ...item,
                isAvailable: isAvailable,
              }))
            : []

          const subsections = Array.isArray(section.subsections)
            ? section.subsections.map(subsection => ({
                ...subsection,
                items: Array.isArray(subsection.items)
                  ? subsection.items.map(item => ({
                      ...item,
                      isAvailable: isAvailable,
                    }))
                  : [],
              }))
            : []

          return {
            ...section,
            isEnabled: isEnabled,
            items,
            subsections,
          }
        }

        // If updating a single item, update only that specific instance (not all items with same ID)
        const updatedSection = { ...section }

        const items = Array.isArray(section.items) ? [...section.items] : []
        let itemUpdated = false

        // First, try to update in top-level items
        if (items.length > 0) {
          const index = items.findIndex(item => String(item.id) === String(itemId))
          if (index !== -1) {
            items[index] = {
              ...items[index],
              isAvailable: isAvailable,
            }
            itemUpdated = true
          }
        }

        // If not found yet, try to update in subsections
        let subsections = Array.isArray(section.subsections) ? section.subsections : []
        if (!itemUpdated && subsections.length > 0) {
          subsections = subsections.map(subsection => ({ ...subsection }))

          for (let si = 0; si < subsections.length; si++) {
            const current = subsections[si]
            const ssItems = Array.isArray(current.items) ? [...current.items] : []
            const idx = ssItems.findIndex(item => String(item.id) === String(itemId))

            if (idx !== -1) {
              ssItems[idx] = {
                ...ssItems[idx],
                isAvailable: isAvailable,
              }
              subsections[si] = {
                ...current,
                items: ssItems,
              }
              itemUpdated = true
              break
            }
          }
        }

        return {
          ...updatedSection,
          items,
          subsections,
        }
      })

      // Save updated menu
      await restaurantAPI.updateMenu({ sections: updatedSections })
      console.log('Menu updated successfully')
    } catch (error) {
      console.error('Error updating menu:', error)
      toast.error('Failed to update menu')
    }
  }

  // Handle toggle click
  const handleToggleChange = async (type, categoryId, itemId, nextChecked) => {
    if (nextChecked) {
      // Turning ON - apply immediately without popup
      setCategories(prev =>
        prev.map(category => {
          if (category.id !== categoryId) return category
          const items = category.items || []

          if (type === "category") {
            const updatedItems = items.map(item => ({ ...item, inStock: true }))
            return {
              ...category,
              inStock: true,
              items: updatedItems,
            }
          }

          const updatedItems = items.map(item =>
            item.id === itemId ? { ...item, inStock: true } : item
          )
          // Don't automatically update category inStock when item is toggled
          // Category toggle should be independent
          return {
            ...category,
            items: updatedItems,
          }
        })
      )

      // Update menu API
      if (type === "category") {
        await updateMenuAPI(categoryId, null, true, true)
      } else {
        await updateMenuAPI(categoryId, itemId, undefined, true)
      }
      return
    }

    // Turning OFF - open popup and wait for confirmation
    setToggleTarget({ type, categoryId, itemId })
    setSelectedOption("specific-time")
    setHours(3)
    setSelectedDate(null)
    setSelectedTime({ hour: "2", minute: "30", period: "pm" })
    setShowCalendar(false)
    setShowTimePicker(false)
    setTogglePopupOpen(true)
  }

  // Handle toggle confirm
  const handleToggleConfirm = async () => {
    if (!toggleTarget) {
      setTogglePopupOpen(false)
      return
    }

    const { type, categoryId, itemId } = toggleTarget

    // Apply OFF state for item or category
    setCategories(prev =>
      prev.map(category => {
        if (category.id !== categoryId) return category
        const items = category.items || []

        if (type === "category") {
          const updatedItems = items.map(item => ({ ...item, inStock: false }))
          return {
            ...category,
            inStock: false,
            items: updatedItems,
          }
        }

        const updatedItems = items.map(item =>
          item.id === itemId ? { ...item, inStock: false } : item
        )
        // Don't automatically update category inStock when item is toggled
        // Category toggle should be independent
        return {
          ...category,
          items: updatedItems,
        }
      })
    )

    // Update menu API
    if (type === "category") {
      await updateMenuAPI(categoryId, null, false, false)
    } else {
      await updateMenuAPI(categoryId, itemId, undefined, false)
    }

    setTogglePopupOpen(false)
    setToggleTarget(null)
  }

  // Get category data for popup
  const getCategoryData = () => {
    if (!toggleTarget || toggleTarget.type !== 'category') return null
    return categories.find(cat => cat.id === toggleTarget.categoryId)
  }

  // Format date for display
  const formatDate = (date) => {
    if (!date) return ""
    const day = date.getDate()
    const month = date.toLocaleString('en-US', { month: 'short' })
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  // Format time for display
  const formatTime = (time) => {
    if (!time) return ""
    const minute = time.minute.padStart(2, '0')
    const period = time.period.toUpperCase()
    return `${time.hour}:${minute} ${period}`
  }

  // Handle time picker confirm
  const handleTimePickerConfirm = (hour, minute, period) => {
    setSelectedTime({ hour, minute, period })
    setShowTimePicker(false)
  }

  // Toggle category expansion
  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  // Update menu API when recommendation toggle changes
  const updateRecommendationAPI = async (categoryId, itemId, isRecommended) => {
    try {
      // Fetch current menu
      const menuResponse = await restaurantAPI.getMenu()
      if (!menuResponse.data || !menuResponse.data.success || !menuResponse.data.data || !menuResponse.data.data.menu) {
        console.error('Failed to fetch menu for update')
        return
      }

      const menu = menuResponse.data.data.menu
      const sections = menu.sections || []

      // Update menu sections
      const updatedSections = sections.map(section => {
        if (section.id !== categoryId) return section

        // Update item in direct items
        const updatedItems = section.items.map(item =>
          item.id === String(itemId) ? { ...item, isRecommended: isRecommended } : item
        )
        
        // Update item in subsections too
        const updatedSubsections = section.subsections.map(subsection => ({
          ...subsection,
          items: subsection.items.map(item =>
            item.id === String(itemId) ? { ...item, isRecommended: isRecommended } : item
          )
        }))

        return {
          ...section,
          items: updatedItems,
          subsections: updatedSubsections
        }
      })

      // Save updated menu
      await restaurantAPI.updateMenu({ sections: updatedSections })
      console.log('Menu recommendation updated successfully')
    } catch (error) {
      console.error('Error updating menu recommendation:', error)
      toast.error('Failed to update recommendation')
    }
  }

  // Handle item recommendation toggle
  const handleRecommendToggle = async (categoryId, itemId) => {
    // Find current recommendation status
    const category = categories.find(cat => cat.id === categoryId)
    const item = category?.items.find(i => i.id === itemId)
    const newRecommendationStatus = !item?.isRecommended

    // Update local state
    setCategories(prev =>
      prev.map(category => {
        if (category.id !== categoryId) return category
        const updatedItems = category.items.map(item =>
          item.id === itemId ? { ...item, isRecommended: newRecommendationStatus } : item
        )
        return {
          ...category,
          items: updatedItems,
        }
      })
    )

    // Update menu API
    await updateRecommendationAPI(categoryId, itemId, newRecommendationStatus)
  }

  const scrollToCategory = (categoryId) => {
    const el = categoryRefs.current[categoryId]
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    window.scrollTo({ top: el.offsetTop - 100, behavior: "smooth" })
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Navbar */}
      <div className="sticky top-0 z-50 bg-white">
        <RestaurantNavbar
          showSearch={false}
          showOfflineOnlineTag={false}
          showNotifications={false}
        />
      </div>

      {/* Top Tabs */}
      <div className=" top-[50px] z-40 bg-gray-100 px-4 pt-4 pb-4">
        <div ref={tabBarRef} className="flex gap-2">
          <motion.button
            onClick={() => setActiveTab("all-items")}
            className={`px-6 py-3.5 rounded-full font-medium text-sm whitespace-nowrap relative overflow-hidden ${activeTab === "all-items"
                ? 'text-white'
                : 'bg-white text-black'
              }`}
            animate={{
              scale: activeTab === "all-items" ? 1.05 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "all-items" && (
              <motion.div
                layoutId="activeTabBackground"
                className="absolute inset-0 bg-black rounded-full -z-10"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              All items
              {activeTab === "all-items" && (
                <span className="bg-white text-black px-2 py-0.5 rounded-full text-xs font-medium">
                  {totalItems}
                </span>
              )}
            </span>
          </motion.button>

          <motion.button
            onClick={() => setActiveTab("add-ons")}
            className={`px-6 py-3.5 rounded-full font-medium text-sm whitespace-nowrap relative overflow-hidden ${activeTab === "add-ons"
                ? 'text-white'
                : 'bg-white text-black'
              }`}
            animate={{
              scale: activeTab === "add-ons" ? 1.05 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "add-ons" && (
              <motion.div
                layoutId="activeTabBackground"
                className="absolute inset-0 bg-black rounded-full -z-10"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
              />
            )}
            <span className="relative z-10">Add ons</span>
          </motion.button>
        </div>
      </div>

      {/* Main Content */}
      <div
        ref={contentContainerRef}
        className="flex-1 overflow-y-auto px-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => {
          const target = e.target
          // Don't handle swipe if starting on topbar
          if (tabBarRef.current?.contains(target)) return

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
              const currentIndex = inventoryTabs.findIndex(tab => tab === activeTab)
              let newIndex = currentIndex

              if (swipeDistance > 0 && currentIndex < inventoryTabs.length - 1) {
                newIndex = currentIndex + 1
              } else if (swipeDistance < 0 && currentIndex > 0) {
                newIndex = currentIndex - 1
              }

              if (newIndex !== currentIndex) {
                setIsTransitioning(true)
                setTimeout(() => {
                  setActiveTab(inventoryTabs[newIndex])
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
        {/* Edit Menu Banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate("/restaurant/hub-menu")}
          className="bg-blue-200/20 rounded-lg p-4 mt-4 mb-4 flex items-center justify-between"
        >
          <span className="text-sm font-light text-gray-900">Want to edit your menu?</span>
          <button className="bg-blue-200/30 hover:bg-blue-300 text-black  px-4 py-2 rounded-full text-sm font-light transition-colors">
            Edit now
          </button>
        </motion.div>

        {/* Search and Filter */}
        <div className="flex sticky top-[50px] gap-2 mb-4">
          {/* Search Bar */}
          <div className="flex-1  z-40 bg-white rounded-sm border border-gray-200">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu"
              className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none rounded-sm"
            />
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setFilterOpen(true)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-sm flex items-center justify-center hover:bg-gray-50 transition-colors relative"
          >
            <SlidersHorizontal className="w-5 h-5 text-gray-700" />
            {/* Blue dot indicator when filter is applied */}
            {selectedFilter && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Categories Accordions */}
        <div className="space-y-3 mb-6">
          {activeTab === "add-ons" && (
            <>
              {loadingAddons ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : filteredAddons.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4">
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-500">No add-ons found</p>
                    <p className="text-sm text-gray-400 mt-2">
                      {addons.length === 0
                        ? "Approved add-ons will appear here"
                        : "Try adjusting your search or filters"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className="bg-white rounded-lg border border-gray-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-base font-semibold text-gray-900">{addon.name}</h3>
                            {addon.approvalStatus === 'approved' && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded">Approved</span>
                            )}
                          </div>
                          {addon.description && (
                            <p className="text-sm text-gray-600 mb-2">{addon.description}</p>
                          )}
                          <p className="text-base font-bold text-gray-900">₹{addon.price}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          {addon.images && addon.images.length > 0 && addon.images[0] && (
                            <img
                              src={addon.images[0]}
                              alt={addon.name}
                              className="w-20 h-20 object-cover rounded-lg"
                              onError={(e) => {
                                e.target.style.display = 'none'
                              }}
                            />
                          )}
                          <div className="flex items-center">
                            <Switch
                              checked={addon.isAvailable !== false}
                              onCheckedChange={(checked) =>
                                handleAddonToggle(addon.id, checked)
                              }
                              className="data-[state=checked]:bg-red-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {listToRender.map((category, index) => {
            const isExpanded = expandedCategories.includes(category.id)
            const categoryItems = category.items || []

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: isLoading ? 0.6 : 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-lg shadow-0 overflow-hidden relative"
                ref={(el) => {
                  if (el) {
                    categoryRefs.current[category.id] = el
                  }
                }}
              >
                {/* Loading Overlay */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg"
                  >
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </motion.div>
                )}

                {/* Category Header - Clickable */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-gray-900">
                          {category.name}
                        </h3>
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {category.itemCount}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{category.description}</p>
                      <div className="flex items-center justify-between">
                        <div>

                          {category.inStock ? (
                            <p className="text-xs text-red-600 font-medium">In stock</p>
                          ) : (
                            <p className="text-xs text-red-500 font-medium">
                              {getOutOfStockCount(category)} out of {category.itemCount} item{category.itemCount !== 1 ? 's' : ''} is out of stock
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-3 ml-4">
                      {/* Category Toggle Switch */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={category.inStock}
                          onCheckedChange={(checked) =>
                            handleToggleChange("category", category.id, null, checked)
                          }
                          className="data-[state=checked]:bg-red-600"
                        />
                      </div>

                      {/* Expand/Collapse Button - Right of In stock */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleCategory(category.id)
                        }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Category Items */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {/* Divider */}
                      <div className="border-t border-gray-200 mx-4" />
                      <div className="px-4 pb-4 space-y-0">
                        {categoryItems.map((item, itemIndex) => (
                          <div key={item.id}>
                            {itemIndex > 0 && (
                              <div className="border-t border-dashed border-gray-200 my-3" />
                            )}
                            <div className="flex items-center justify-between py-2">
                              <div className="flex items-center gap-2 flex-1">
                                {/* Veg/Non-veg Icon */}
                                <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center ${item.isVeg ? "border-green-600" : "border-red-600"
                                  }`}>
                                  <div className={`w-2 h-2 rounded-full ${item.isVeg ? "bg-green-600" : "bg-red-600"
                                    }`} />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                  {item.inStock ? (
                                    <p className="text-xs text-red-600 font-medium">In stock</p>
                                  ) : (
                                    <p className="text-xs text-red-500 font-medium">No time set. Turn item in stock manually.</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {/* Recommend Thumb Icon */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRecommendToggle(category.id, item.id)
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    item.isRecommended
                                      ? "bg-blue-100 text-blue-600"
                                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                  }`}
                                  title={item.isRecommended ? "Recommended" : "Click to recommend"}
                                >
                                  <ThumbsUp className="w-4 h-4" />
                                </button>
                                {/* Item Toggle Switch */}
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Switch
                                    checked={item.inStock}
                                    onCheckedChange={(checked) =>
                                      handleToggleChange("item", category.id, item.id, checked)
                                    }
                                    className="data-[state=checked]:bg-red-600"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Filter Popup */}
      <AnimatePresence>
        {filterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setFilterOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6">Filters</h2>

                <div className="space-y-4 mb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="filter"
                      checked={selectedFilter === "out-of-stock"}
                      onChange={() => setSelectedFilter("out-of-stock")}
                      className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                    />
                    <span className="text-base text-gray-900">Out of stock items only</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="filter"
                      checked={selectedFilter === "in-stock"}
                      onChange={() => setSelectedFilter("in-stock")}
                      className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                    />
                    <span className="text-base text-gray-900">In stock items only</span>
                  </label>
                </div>

                <div className="flex gap-3">
                  {selectedFilter && (
                    <button
                      onClick={handleFilterClear}
                      className="flex-1 border border-gray-300 text-gray-900 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={handleFilterApply}
                    className={`${selectedFilter ? 'flex-1' : 'w-full'} bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors`}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toggle Popup */}
      <AnimatePresence>
        {togglePopupOpen && toggleTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setTogglePopupOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* Header */}
                <h2 className="text-lg font-bold text-gray-900 text-center mb-6">
                  {toggleTarget.type === "category" ? "Mark sub category out of stock" : "Mark item out of stock"}
                </h2>

                {/* Category Info - Only show for category toggles */}
                {toggleTarget.type === 'category' && (() => {
                  const categoryData = getCategoryData()
                  if (!categoryData) return null
                  return (
                    <div className="">
                      <h3 className="text-base font-bold text-gray-900 mb-3">{categoryData.name}</h3>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• {categoryData.name}</li>
                        <li>• Includes {categoryData.itemCount} item{categoryData.itemCount !== 1 ? 's' : ''}</li>
                      </ul>
                      <div className="border-t border-gray-200 mt-4"></div>
                    </div>
                  )
                })()}

                {/* Radio Options */}
                <div className="space-y-0 mb-6">
                  {/* Option 1: For specific time */}
                  <label className="flex items-center justify-between py-4 cursor-pointer border-b border-gray-200">
                    <div className="flex items-center gap-3 flex-1">
                    
                      <span className="text-base text-gray-900">For specific time</span>
                      {selectedOption === "specific-time" && (
                        <div className="ml-auto py-3 flex items-center justify-center gap-4">
                          <button
                            onClick={() => setHours(Math.max(1, hours - 1))}
                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <Minus className="w-4 h-4 text-gray-700" />
                          </button>
                          <span className="text-base font-medium text-gray-900 min-w-[60px] text-center">
                            {hours} hour{hours !== 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={() => setHours(hours + 1)}
                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <Plus className="w-4 h-4 text-gray-700" />
                          </button>
                        </div>
                      )}
                        <input
                        type="radio"
                        name="outOfStockOption"
                        checked={selectedOption === "specific-time"}
                        onChange={() => setSelectedOption("specific-time")}
                        style={{ accentColor: "#000000" }}
                        className="ml-auto w-5 h-5 !text-black !border-gray-300 !bg-black !focus:ring-black"
                      />
                    </div>
                  </label>

                  {/* Option 2: Next business day */}
                  <label className="flex items-center justify-between py-4 cursor-pointer border-b border-gray-200">
                    <div className="flex items-center gap-3 flex-1">
                   
                      <span className="text-base text-gray-900">Next business day - Opening time</span>
                      <input
                        type="radio"
                        name="outOfStockOption"
                        checked={selectedOption === "next-business-day"}
                        onChange={() => setSelectedOption("next-business-day")}
                        style={{ accentColor: "#000000" }}
                        className="ml-auto w-5 h-5 !text-black !border-gray-300 !bg-black !focus:ring-black"
                      />
                    </div>
                  </label>

                  {/* Option 3: Custom date & time */}
                  <label className="flex items-center justify-between py-4 cursor-pointer border-b border-gray-200">
                    <div className="flex items-center gap-3 flex-1">
                    
                      <span className="text-base text-gray-900">Custom date & time</span>
                      <input
                        type="radio"
                        name="outOfStockOption"
                        checked={selectedOption === "custom-date-time"}
                        onChange={() => setSelectedOption("custom-date-time")}
                        style={{ accentColor: "#000000" }}
                        className="ml-auto w-5 h-5 text-black border-gray-300 focus:ring-black"
                      />
                    </div>
                  </label>
                  {selectedOption === "custom-date-time" && (
                    <div className="ml-auto py-3 flex items-center justify-center gap-4">
                      <button
                        onClick={() => setShowCalendar(true)}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                      >
                        <span>{selectedDate ? formatDate(selectedDate) : "15 Dec 2025"}</span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => setShowTimePicker(true)}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                      >
                        <span>{formatTime(selectedTime)}</span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  )}

                  {/* Option 4: Manual */}
                  <label className="flex items-center justify-between py-4 cursor-pointer">
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-3">
                       
                        <span className="text-base text-gray-900">I will turn it on manually</span>
                        <input
                          type="radio"
                          name="outOfStockOption"
                          checked={selectedOption === "manual"}
                          onChange={() => setSelectedOption("manual")}
                          style={{ accentColor: "#000000" }}
                          className="ml-auto w-5 h-5 !text-black !border-gray-300 !bg-black !focus:ring-black"
                        />
                      </div>
                      <p className="text-sm text-gray-500">
                        Item won't be visible to customers on Zomato app till you mark it back in stock
                      </p>
                    </div>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setTogglePopupOpen(false)}
                    className="flex-1 border border-gray-300 text-gray-900 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleToggleConfirm}
                    className="flex-1 bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Calendar Popup */}
      <SimpleCalendar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
      />

      {/* Time Picker Popup */}
      <TimePickerWheel
        isOpen={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        initialHour={selectedTime.hour}
        initialMinute={selectedTime.minute}
        initialPeriod={selectedTime.period}
        onConfirm={handleTimePickerConfirm}
      />

      {/* Floating Menu Button & Popup (hidden on Add-ons tab) */}
      {activeTab !== "add-ons" && (
        <div className="fixed right-4 bottom-24 z-30">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-800 bg-white text-sm font-medium shadow-sm"
          >
            <span className="w-5 h-5 flex items-center justify-center">
              {isMenuOpen ? (
                <X className="w-4 h-4 text-gray-900" />
              ) : (
                <Utensils className="w-4 h-4 text-gray-900" />
              )}
            </span>
            <span>{isMenuOpen ? "Close" : "Menu"}</span>
          </motion.button>

          <AnimatePresence>
            {isMenuOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/40 z-30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsMenuOpen(false)}
                />

                {/* Menu Popup */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.2 }}
                  className="fixed right-4 bottom-36 z-30 w-[60vw] max-w-sm h-[45vh] bg-white rounded-3xl shadow-lg overflow-hidden"
                >
                  <div className="h-full flex flex-col">
                    <div className="px-4 pt-4 pb-2">
                      <p className="text-sm font-semibold text-gray-900">Menu</p>
                    </div>
                    <div className="h-px bg-gray-200 mx-4" />
                    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
                      {categories.map((category, index) => {
                        const itemCount =
                          category.itemCount || (category.items?.length || 0)
                        const isLast = index === categories.length - 1

                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                              setIsMenuOpen(false)
                              setTimeout(() => scrollToCategory(category.id), 200)
                            }}
                            className="w-full text-left py-3 focus:outline-none"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">
                                {category.name}
                              </span>
                              <span className="min-w-[28px] h-7 rounded-full border border-gray-300 flex items-center justify-center text-xs text-gray-800">
                                {itemCount}
                              </span>
                            </div>
                            {!isLast && (
                              <div className="mt-3 border-t border-dashed border-gray-200" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNavOrders />
    </div>
  )
}
