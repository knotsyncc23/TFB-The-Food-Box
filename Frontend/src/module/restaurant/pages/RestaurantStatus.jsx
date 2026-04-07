import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import { ArrowLeft, Settings, ChevronRight } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { restaurantAPI } from "@/lib/api"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function RestaurantStatus() {
  const navigate = useNavigate()
  const [deliveryStatus, setDeliveryStatus] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [isWithinTimings, setIsWithinTimings] = useState(null) // null = not calculated yet
  const [showOutletClosedDialog, setShowOutletClosedDialog] = useState(false)
  const [showOutsideTimingsDialog, setShowOutsideTimingsDialog] = useState(false)
  const [isDayClosed, setIsDayClosed] = useState(false)
  const [outletTimings, setOutletTimings] = useState(null)

  const syncRestaurantStatus = async () => {
    try {
      const response = await restaurantAPI.getCurrentRestaurant()
      const restaurant = response?.data?.data?.restaurant || response?.data?.restaurant
      if (restaurant?.isAcceptingOrders !== undefined) {
        setDeliveryStatus(restaurant.isAcceptingOrders)
        setRestaurantData((prev) => ({ ...(prev || {}), ...restaurant }))
        localStorage.setItem("restaurant_online_status", JSON.stringify(restaurant.isAcceptingOrders))
        window.dispatchEvent(new CustomEvent("restaurantStatusChanged", {
          detail: { isOnline: restaurant.isAcceptingOrders }
        }))
      }
    } catch (error) {
      if (error.code !== "ERR_NETWORK" && error.code !== "ECONNABORTED" && !error.message?.includes("timeout")) {
        console.error("Error syncing restaurant status:", error)
      }
    }
  }

  // Update current date/time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Fetch restaurant data from backend
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true)
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
        setLoading(false)
      }
    }

    fetchRestaurantData()
  }, [])

  // Load outlet timings from localStorage
  useEffect(() => {
    const loadOutletTimings = () => {
      try {
        const saved = localStorage.getItem("restaurant_outlet_timings")
        if (saved) {
          const data = JSON.parse(saved)
          setOutletTimings(data)
        }
      } catch (error) {
        console.error("Error loading outlet timings:", error)
      }
    }

    loadOutletTimings()

    // Listen for outlet timings updates
    window.addEventListener("outletTimingsUpdated", loadOutletTimings)

    return () => {
      window.removeEventListener("outletTimingsUpdated", loadOutletTimings)
    }
  }, [])

  // Check if restaurant is currently open based on timings
  useEffect(() => {
    if (!restaurantData) return

    const checkIfOpen = () => {
      const now = new Date()
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const currentDayFull = daysOfWeek[now.getDay()]
      const currentDay = currentDayFull.substring(0, 3) // "Sun", "Mon", etc.
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const currentTimeInMinutes = currentHour * 60 + currentMinute

      // First check outlet timings from localStorage (OutletTimings.jsx stores it there)
      const STORAGE_KEY = "restaurant_outlet_timings"
      let outletTimingsData = null
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          outletTimingsData = JSON.parse(saved)
          setOutletTimings(outletTimingsData)
        }
      } catch (error) {
        console.error("Error loading outlet timings:", error)
      }

      // Check if current day is closed in outlet timings
      if (outletTimingsData && outletTimingsData[currentDayFull]) {
        const dayData = outletTimingsData[currentDayFull]
        if (dayData.isOpen === false) {
          // Day is closed in outlet timings
          setIsDayClosed(true)
          setIsWithinTimings(false)
          setShowOutletClosedDialog(true)
          return
        }

        // Resolve opening/closing times from either legacy "slots" format or new openingTime/closingTime
        let openingTimeStr = null
        let closingTimeStr = null

        // Legacy: slots array with start/end and AM/PM periods
        if (Array.isArray(dayData.slots) && dayData.slots.length > 0) {
          const firstSlot = dayData.slots[0]
          const parseSlotTime = (time, period) => {
            if (!time || typeof time !== "string") return null
            const [rawHours, rawMinutes] = time.split(":")
            let hours = parseInt(rawHours || "0", 10)
            const minutes = parseInt(rawMinutes || "0", 10)
            if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

            const p = (period || "").toLowerCase()
            if (p === "pm" && hours !== 12) hours += 12
            if (p === "am" && hours === 12) hours = 0

            const hh = hours.toString().padStart(2, "0")
            const mm = minutes.toString().padStart(2, "0")
            return `${hh}:${mm}`
          }

          openingTimeStr = parseSlotTime(firstSlot.start, firstSlot.startPeriod || "am")
          closingTimeStr = parseSlotTime(firstSlot.end, firstSlot.endPeriod || "pm")
        } else if (dayData.isOpen && dayData.openingTime && dayData.closingTime) {
          // New format already in "HH:mm"
          openingTimeStr = dayData.openingTime
          closingTimeStr = dayData.closingTime
        }

        if (openingTimeStr && closingTimeStr) {
          // Parse opening and closing times (format: "HH:mm")
          const [openHour, openMinute] = openingTimeStr.split(":").map(Number)
          const [closeHour, closeMinute] = closingTimeStr.split(":").map(Number)

          const openingTimeInMinutes = openHour * 60 + openMinute
          const closingTimeInMinutes = closeHour * 60 + closeMinute

          // Handle case where closing time is next day (e.g., 22:00 to 02:00)
          let isWithin = false
          if (closingTimeInMinutes > openingTimeInMinutes) {
            // Normal case: same day
            isWithin = currentTimeInMinutes >= openingTimeInMinutes && currentTimeInMinutes < closingTimeInMinutes
          } else {
            // Overnight case: closing time is next day
            isWithin = currentTimeInMinutes >= openingTimeInMinutes || currentTimeInMinutes < closingTimeInMinutes
          }

          setIsWithinTimings(isWithin)
          setIsDayClosed(false)
          return
        }
      }

      setIsDayClosed(false)

      // Check if current day is in openDays (from backend)
      const openDays = restaurantData.openDays || []
      const isDayOpen = openDays.some(day => {
        const dayAbbr = day.substring(0, 3) // "Mon", "Tue", etc.
        return dayAbbr === currentDay
      })

      if (!isDayOpen) {
        setIsWithinTimings(false)
        return
      }

      // Check if current time is within delivery timings
      const deliveryTimings = restaurantData.deliveryTimings
      if (!deliveryTimings || !deliveryTimings.openingTime || !deliveryTimings.closingTime) {
        setIsWithinTimings(true) // Default to open if no timings set
        return
      }

      // Parse opening and closing times (format: "HH:mm")
      const [openHour, openMinute] = deliveryTimings.openingTime.split(':').map(Number)
      const [closeHour, closeMinute] = deliveryTimings.closingTime.split(':').map(Number)

      const openingTimeInMinutes = openHour * 60 + openMinute
      const closingTimeInMinutes = closeHour * 60 + closeMinute

      // Handle case where closing time is next day (e.g., 22:00 to 02:00)
      let isWithin = false
      if (closingTimeInMinutes > openingTimeInMinutes) {
        // Normal case: same day
        isWithin = currentTimeInMinutes >= openingTimeInMinutes && currentTimeInMinutes <= closingTimeInMinutes
      } else {
        // Overnight case: closing time is next day
        isWithin = currentTimeInMinutes >= openingTimeInMinutes || currentTimeInMinutes <= closingTimeInMinutes
      }

      setIsWithinTimings(isWithin)
    }

    checkIfOpen()
    // Recheck every minute
    const interval = setInterval(checkIfOpen, 60000)

    // Listen for outlet timings updates
    const handleOutletTimingsUpdate = () => {
      checkIfOpen()
    }
    window.addEventListener("outletTimingsUpdated", handleOutletTimingsUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener("outletTimingsUpdated", handleOutletTimingsUpdate)
    }
  }, [restaurantData, currentDateTime])

  // Note: Delivery status is now manually controlled by user via toggle
  // We don't automatically set it based on timings anymore
  // The isWithinTimings is only used to show warning messages

  // Load delivery status from backend and sync with localStorage
  useEffect(() => {
    const loadDeliveryStatus = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const restaurant = response?.data?.data?.restaurant || response?.data?.restaurant
        if (restaurant?.isAcceptingOrders !== undefined) {
          setDeliveryStatus(restaurant.isAcceptingOrders)
          setRestaurantData((prev) => ({ ...(prev || {}), ...restaurant }))
          localStorage.setItem('restaurant_online_status', JSON.stringify(restaurant.isAcceptingOrders))
          window.dispatchEvent(new CustomEvent('restaurantStatusChanged', {
            detail: { isOnline: restaurant.isAcceptingOrders }
          }))
        } else {
          // Fallback to localStorage
          const savedStatus = localStorage.getItem('restaurant_online_status')
          if (savedStatus !== null) {
            const status = JSON.parse(savedStatus)
            setDeliveryStatus(status)
            // Dispatch event to update navbar
            window.dispatchEvent(new CustomEvent('restaurantStatusChanged', {
              detail: { isOnline: status }
            }))
          } else {
            // Default to false if not set
            setDeliveryStatus(false)
            // Dispatch event to update navbar
            window.dispatchEvent(new CustomEvent('restaurantStatusChanged', {
              detail: { isOnline: false }
            }))
          }
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          console.error("Error loading delivery status:", error)
        }
        // Fallback to localStorage
        try {
          const savedStatus = localStorage.getItem('restaurant_online_status')
          if (savedStatus !== null) {
            const status = JSON.parse(savedStatus)
            setDeliveryStatus(status)
            window.dispatchEvent(new CustomEvent('restaurantStatusChanged', {
              detail: { isOnline: status }
            }))
          } else {
            setDeliveryStatus(false)
            window.dispatchEvent(new CustomEvent('restaurantStatusChanged', {
              detail: { isOnline: false }
            }))
          }
        } catch (localError) {
          setDeliveryStatus(false)
          window.dispatchEvent(new CustomEvent('restaurantStatusChanged', {
            detail: { isOnline: false }
          }))
        }
      }
    }

    loadDeliveryStatus()
  }, [])

  useEffect(() => {
    const handleFocus = () => {
      syncRestaurantStatus()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncRestaurantStatus()
      }
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  // Handle delivery status change
  const handleDeliveryStatusChange = async (checked) => {
    const previousStatus = deliveryStatus
    // If turning on, check if restaurant is verified by admin
    if (checked && !restaurantData?.approvedAt) {
      toast.error("You cannot take orders until your restaurant is verified by admin.");
      return
    }
    // If day is closed in outlet timings, don't allow turning on
    if (checked && isDayClosed) {
      setShowOutletClosedDialog(true)
      return
    }

    // If outside scheduled delivery timings, show popup
    if (checked && isWithinTimings === false && !isDayClosed) {
      setShowOutsideTimingsDialog(true)
      return
    }

    try {
      // Update backend first (backend is source of truth for verification).
      await restaurantAPI.updateDeliveryStatus(checked)

      // Persist + update local state only after backend succeeds.
      localStorage.setItem('restaurant_online_status', JSON.stringify(checked))
      setDeliveryStatus(checked)
      setRestaurantData((prev) => prev ? { ...prev, isAcceptingOrders: checked } : prev)

      // Dispatch custom event for navbar to listen
      window.dispatchEvent(new CustomEvent('restaurantStatusChanged', {
        detail: { isOnline: checked }
      }))

      await syncRestaurantStatus()
    } catch (error) {
      console.error("Error saving delivery status:", error)
      // Revert UI if backend rejected the update
      try {
        localStorage.setItem('restaurant_online_status', JSON.stringify(previousStatus))
      } catch {}
      setDeliveryStatus(previousStatus)
      toast.error(error?.response?.data?.message || "Failed to update delivery status")
    }
  }

  // Handle dialog close and navigate to outlet timings
  const handleGoToOutletTimings = () => {
    setShowOutletClosedDialog(false)
    navigate("/restaurant/outlet-timings")
  }

  // Format time from 24-hour to 12-hour format
  const formatTime12Hour = (time24) => {
    if (!time24) return ""
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'pm' : 'am'
    const hours12 = hours % 12 || 12
    const minutesStr = minutes.toString().padStart(2, '0')
    return `${hours12}:${minutesStr} ${period}`
  }

  // Format current date and time
  const formatCurrentDateTime = () => {
    const now = currentDateTime
    const dateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    return `${dateStr}, ${timeStr}`
  }

  // Get delivery timings for current day (from outlet timings first, then backend)
  const getCurrentDayTimings = () => {
    const now = new Date()
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const currentDayFull = daysOfWeek[now.getDay()] // "Monday", "Tuesday", etc.

    // First try to get from outlet timings (localStorage)
    if (outletTimings && outletTimings[currentDayFull]) {
      const dayData = outletTimings[currentDayFull]
      // Support both legacy slots format and new openingTime/closingTime
      if (Array.isArray(dayData.slots) && dayData.slots.length > 0) {
        const firstSlot = dayData.slots[0]
        const parseSlotTime = (time, period) => {
          if (!time || typeof time !== "string") return null
          const [rawHours, rawMinutes] = time.split(":")
          let hours = parseInt(rawHours || "0", 10)
          const minutes = parseInt(rawMinutes || "0", 10)
          if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

          const p = (period || "").toLowerCase()
          if (p === "pm" && hours !== 12) hours += 12
          if (p === "am" && hours === 12) hours = 0

          const hh = hours.toString().padStart(2, "0")
          const mm = minutes.toString().padStart(2, "0")
          return `${hh}:${mm}`
        }

        const open24 = parseSlotTime(firstSlot.start, firstSlot.startPeriod || "am")
        const close24 = parseSlotTime(firstSlot.end, firstSlot.endPeriod || "pm")
        if (open24 && close24) {
          return {
            openingTime: formatTime12Hour(open24),
            closingTime: formatTime12Hour(close24),
          }
        }
      } else if (dayData.isOpen && dayData.openingTime && dayData.closingTime) {
        return {
          openingTime: formatTime12Hour(dayData.openingTime),
          closingTime: formatTime12Hour(dayData.closingTime),
        }
      }
    }

    // Fallback to backend delivery timings
    if (restaurantData?.deliveryTimings) {
      const openingTime = formatTime12Hour(restaurantData.deliveryTimings.openingTime)
      const closingTime = formatTime12Hour(restaurantData.deliveryTimings.closingTime)
      return { openingTime, closingTime }
    }

    return null
  }

  // Format address
  const formatAddress = (location) => {
    if (!location) return ""
    const parts = []
    if (location.area) parts.push(location.area.trim())
    if (location.city) parts.push(location.city.trim())
    return parts.join(", ") || ""
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

  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
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
            <h1 className="text-lg font-bold text-gray-900">Restaurant status</h1>
            <p className="text-sm text-gray-500 mt-0.5">You are mapped to 1 restaurant</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6">
        {/* Restaurant Information Card */}
        <Card className="bg-gray-50 border-none py-0 shadow-sm rounded-b-none rounded-t-lg">
          <CardContent className="p-4 gap-6 flex flex-col">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900 mb-1">
                  {loading ? "Loading..." : (restaurantData?.name || "Restaurant")}
                </h2>
                <p className="text-sm text-gray-500">
                  {loading ? "Loading..." : (
                    <>
                      {restaurantData?.id ? `ID: ${String(restaurantData.id).slice(-5)}` : ""}
                      {restaurantData?.location && formatAddress(restaurantData.location) ? (
                        <> | {formatAddress(restaurantData.location)}</>
                      ) : ""}
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  // Navigate to restaurant settings
                  navigate("/restaurant/explore")
                }}
                className="ml-3 p-2 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors shrink-0"
                aria-label="Explore more"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900 mb-1.5">Delivery status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${deliveryStatus ? 'bg-red-500' : 'bg-gray-600'}`}></div>
                  <p className="text-sm text-gray-500">
                    {deliveryStatus ? 'Receiving orders' : 'Not receiving orders'}
                  </p>
                </div>
              </div>
              <Switch
                checked={deliveryStatus}
                onCheckedChange={handleDeliveryStatusChange}
                className="ml-4 data-[state=unchecked]:bg-gray-300 data-[state=checked]:bg-red-600"
              />
            </div>

            <p className="text-sm text-gray-700 mb-2">Current delivery slot</p>
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-gray-900">
                {loading ? "Loading..." : (
                  (() => {
                    // If current day is closed, show "Today is Off"
                    if (isDayClosed) {
                      return "Today is Off"
                    }
                    const timings = getCurrentDayTimings()
                    if (timings) {
                      const dateStr = currentDateTime.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
                      return `${dateStr}, ${timings.openingTime} - ${timings.closingTime}`
                    }
                    return "Not configured"
                  })()
                )}
              </p>
              {!isDayClosed && (
                <button
                  onClick={() => navigate("/restaurant/outlet-timings")}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Details
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>



          </CardContent>
        </Card>

        {/* Warning Message - Only show if outside timings AND day is not closed */}
        {!isWithinTimings && restaurantData && !isDayClosed && (
          <div className="bg-pink-50 rounded-b-lg rounded-t-none p-4 flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <p className="text-sm text-gray-700 flex-1">
              You are currently outside your scheduled delivery timings.
            </p>
          </div>
        )}

        {/* Outlet Closed Dialog */}
        <Dialog open={showOutletClosedDialog} onOpenChange={setShowOutletClosedDialog}>
          <DialogContent className="sm:max-w-md p-4 w-[90%] gap-2 flex flex-col">
            <DialogHeader className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                <span className="text-3xl">⚠️</span>
              </div>
              <DialogTitle className="text-lg font-semibold text-gray-900 text-center">
                Outlet Timings Closed
              </DialogTitle>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => setShowOutletClosedDialog(false)}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGoToOutletTimings}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
              >
                Go to Outlet Timings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Outside Timings Dialog */}
        <Dialog open={showOutsideTimingsDialog} onOpenChange={setShowOutsideTimingsDialog}>
          <DialogContent className="sm:max-w-md p-4 w-[90%] gap-2 flex flex-col">
            <DialogHeader className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                <span className="text-3xl">⚠️</span>
              </div>
              <DialogTitle className="text-lg font-semibold text-gray-900 text-center">
                Outside Delivery Timings
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-gray-600">
                You are currently outside your scheduled delivery timings. Please change outlet timings to enable delivery status.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => setShowOutsideTimingsDialog(false)}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowOutsideTimingsDialog(false)
                  navigate("/restaurant/outlet-timings")
                }}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
              >
                Change Outlet Timings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}
