import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import { ArrowLeft, ChevronUp, ChevronDown, Clock, Edit2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import { useCompanyName } from "@/lib/hooks/useCompanyName"
import { restaurantAPI } from "@/lib/api"

const STORAGE_KEY = "restaurant_outlet_timings"

// Helper function to convert "HH:mm" string to Date object
const stringToTime = (timeString) => {
  if (!timeString || !timeString.includes(":")) {
    return new Date(2000, 0, 1, 9, 0) // Default to 9:00 AM
  }
  const [hours, minutes] = timeString.split(":").map(Number)
  // Ensure valid hours (0-23) and minutes (0-59)
  const validHours = Math.max(0, Math.min(23, hours || 9))
  const validMinutes = Math.max(0, Math.min(59, minutes || 0))
  return new Date(2000, 0, 1, validHours, validMinutes)
}

// Helper function to convert Date object to "HH:mm" string
const timeToString = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return "09:00"
  }
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

// Format time from 24-hour to 12-hour format for display
const formatTime12Hour = (time24) => {
  if (!time24) return "09:00 AM"
  const [hours, minutes] = time24.split(":").map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours % 12 || 12
  const minutesStr = minutes.toString().padStart(2, '0')
  return `${hours12}:${minutesStr} ${period}`
}

const getDefaultDays = () => ({
  Monday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Tuesday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Wednesday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Thursday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Friday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Saturday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Sunday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
})

const DAY_NAME_MAP = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
}

const buildDaysFromRestaurant = (restaurant) => {
  const fallback = getDefaultDays()
  const openingTime = restaurant?.deliveryTimings?.openingTime || "09:00"
  const closingTime = restaurant?.deliveryTimings?.closingTime || "22:00"
  const openDays = Array.isArray(restaurant?.openDays) ? restaurant.openDays : []
  const normalizedOpenDays = new Set(
    openDays.map((day) => DAY_NAME_MAP[day] || day).filter(Boolean)
  )

  return Object.fromEntries(
    Object.keys(fallback).map((day) => [
      day,
      {
        isOpen: normalizedOpenDays.size ? normalizedOpenDays.has(day) : fallback[day].isOpen,
        openingTime,
        closingTime,
      },
    ])
  )
}

export default function OutletTimings() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [expandedDay, setExpandedDay] = useState("Monday")
  const isInternalUpdate = useRef(false)
  const [days, setDays] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Validate and ensure all days have proper structure
        const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        const validated = {}
        dayNames.forEach(day => {
          if (parsed[day]) {
            // Migrate from old slot-based format to new time-based format
            if (parsed[day].slots && Array.isArray(parsed[day].slots) && parsed[day].slots.length > 0) {
              const firstSlot = parsed[day].slots[0]
              // Convert slot format to time format
              const parseSlotTime = (time, period) => {
                if (!time) return "09:00"
                const [hours, minutes] = time.split(":").map(Number)
                let hour24 = hours || 9
                if (period === "pm" && hour24 !== 12) hour24 += 12
                if (period === "am" && hour24 === 12) hour24 = 0
                return `${hour24.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
              }
              validated[day] = {
                isOpen: parsed[day].isOpen !== undefined ? parsed[day].isOpen : true,
                openingTime: parseSlotTime(firstSlot.start, firstSlot.startPeriod || "am"),
                closingTime: parseSlotTime(firstSlot.end, firstSlot.endPeriod || "pm"),
              }
            } else {
              validated[day] = {
                isOpen: parsed[day].isOpen !== undefined ? parsed[day].isOpen : true,
                openingTime: parsed[day].openingTime || "09:00",
                closingTime: parsed[day].closingTime || "22:00",
              }
            }
          } else {
            validated[day] = { isOpen: true, openingTime: "09:00", closingTime: "22:00" }
          }
        })
        return validated
      }
    } catch (error) {
      console.error("Error loading outlet timings:", error)
    }
    return getDefaultDays()
  })

  // Save to localStorage whenever days change (but only if it's an internal update)
  useEffect(() => {
    if (isInternalUpdate.current) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(days))
        // Dispatch event to notify other components
        window.dispatchEvent(new Event("outletTimingsUpdated"))
      } catch (error) {
        console.error("Error saving outlet timings:", error)
      }
      isInternalUpdate.current = false
    }
  }, [days])

  // Listen for updates from other components
  useEffect(() => {
    const handleUpdate = () => {
      if (!isInternalUpdate.current) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) {
            const newDays = JSON.parse(saved)
            setDays(prevDays => {
              if (JSON.stringify(newDays) !== JSON.stringify(prevDays)) {
                return newDays
              }
              return prevDays
            })
          }
        } catch (error) {
          console.error("Error loading updated outlet timings:", error)
        }
      }
    }

    window.addEventListener("outletTimingsUpdated", handleUpdate)
    return () => window.removeEventListener("outletTimingsUpdated", handleUpdate)
  }, [])

  useEffect(() => {
    const hydrateFromRestaurant = async () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) return

        const response = await restaurantAPI.getCurrentRestaurant()
        const restaurant = response?.data?.data?.restaurant || response?.data?.restaurant
        if (!restaurant) return

        const prefetchedDays = buildDaysFromRestaurant(restaurant)
        setDays(prefetchedDays)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefetchedDays))
        window.dispatchEvent(new Event("outletTimingsUpdated"))
      } catch (error) {
        console.error("Error prefilling outlet timings from restaurant data:", error)
      }
    }

    hydrateFromRestaurant()
  }, [])

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

  const toggleDay = (day) => {
    setExpandedDay(expandedDay === day ? null : day)
  }

  const toggleDayOpen = (day) => {
    isInternalUpdate.current = true
    setDays(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isOpen: !prev[day].isOpen
      }
    }))
  }

  const handleTimeChange = (day, timeType, newTime) => {
    if (!newTime) {
      console.warn('⚠️ No time value received in handleTimeChange')
      return
    }

    isInternalUpdate.current = true
    const timeString = timeToString(newTime)

    // Validate time string format
    if (!timeString || !timeString.includes(":")) {
      console.warn('⚠️ Invalid time string generated:', timeString)
      return
    }

    console.log(`🕐 Time changed for ${day} - ${timeType}: ${timeString}`)

    setDays(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [timeType]: timeString
      }
    }))
  }

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div className="min-h-screen bg-white overflow-x-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/restaurant/status")}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Outlet timings</h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 py-6">
          {/* Tifunbox delivery Section Header */}
          <div className="mb-6">
            <div className="text-center mb-2">
              <h2 className="text-base font-semibold text-blue-600">{companyName} delivery</h2>
            </div>
            <div className="h-0.5 bg-blue-600"></div>
          </div>

          {/* Day-wise Accordion */}
          <div className="space-y-2">
            {dayNames.map((day, index) => {
              const dayData = days[day] || { isOpen: true, openingTime: "09:00", closingTime: "22:00" }
              const isExpanded = expandedDay === day

              return (
                <motion.div
                  key={day}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="bg-white border border-gray-200 rounded-sm overflow-hidden"
                >
                  {/* Day Header */}
                  <div
                    className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-color transition-all ${isExpanded ? "bg-gray-100" : ""}`}
                  >
                    <button
                      onClick={() => toggleDay(day)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-700" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-700" />
                      )}
                      <span className="text-base font-medium text-gray-900">{day}</span>
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-700">{dayData.isOpen ? "Open" : "Close"}</span>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={dayData.isOpen}
                          onCheckedChange={() => toggleDayOpen(day)}
                          className="data-[state=checked]:bg-red-500 data-[state=unchecked]:bg-gray-300"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-4 border-t border-gray-100">
                          {dayData.isOpen ? (
                            <>
                              {/* Opening Time */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  Opening time
                                </label>
                                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50/60">
                                  <MobileTimePicker
                                    value={stringToTime(dayData.openingTime)}
                                    onChange={(newValue) => {
                                      console.log('🕐 Opening time picker onChange:', newValue)
                                      if (newValue) {
                                        handleTimeChange(day, "openingTime", newValue)
                                      }
                                    }}
                                    onAccept={(newValue) => {
                                      console.log('✅ Opening time picker onAccept:', newValue)
                                      if (newValue) {
                                        handleTimeChange(day, "openingTime", newValue)
                                      }
                                    }}
                                    slotProps={{
                                      textField: {
                                        variant: "outlined",
                                        size: "small",
                                        placeholder: "Select opening time",
                                        sx: {
                                          "& .MuiOutlinedInput-root": {
                                            height: "36px",
                                            fontSize: "12px",
                                            backgroundColor: "white",
                                            "& fieldset": {
                                              borderColor: "#e5e7eb",
                                            },
                                            "&:hover fieldset": {
                                              borderColor: "#d1d5db",
                                            },
                                            "&.Mui-focused fieldset": {
                                              borderColor: "#000",
                                            },
                                          },
                                          "& .MuiInputBase-input": {
                                            padding: "8px 12px",
                                            fontSize: "12px",
                                          },
                                        },
                                      },
                                    }}
                                    format="hh:mm a"
                                  />
                                </div>
                                <p className="text-xs text-gray-500">
                                  Current: {formatTime12Hour(dayData.openingTime)}
                                </p>
                              </div>

                              {/* Closing Time */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  Closing time
                                </label>
                                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50/60">
                                  <MobileTimePicker
                                    value={stringToTime(dayData.closingTime)}
                                    onChange={(newValue) => {
                                      console.log('🕐 Closing time picker onChange:', newValue)
                                      if (newValue) {
                                        handleTimeChange(day, "closingTime", newValue)
                                      }
                                    }}
                                    onAccept={(newValue) => {
                                      console.log('✅ Closing time picker onAccept:', newValue)
                                      if (newValue) {
                                        handleTimeChange(day, "closingTime", newValue)
                                      }
                                    }}
                                    slotProps={{
                                      textField: {
                                        variant: "outlined",
                                        size: "small",
                                        placeholder: "Select closing time",
                                        sx: {
                                          "& .MuiOutlinedInput-root": {
                                            height: "36px",
                                            fontSize: "12px",
                                            backgroundColor: "white",
                                            "& fieldset": {
                                              borderColor: "#e5e7eb",
                                            },
                                            "&:hover fieldset": {
                                              borderColor: "#d1d5db",
                                            },
                                            "&.Mui-focused fieldset": {
                                              borderColor: "#000",
                                            },
                                          },
                                          "& .MuiInputBase-input": {
                                            padding: "8px 12px",
                                            fontSize: "12px",
                                          },
                                        },
                                      },
                                    }}
                                    format="hh:mm a"
                                  />
                                </div>
                                <p className="text-xs text-gray-500">
                                  Current: {formatTime12Hour(dayData.closingTime)}
                                </p>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500 pl-6">This day is closed</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </LocalizationProvider>
  )
}
