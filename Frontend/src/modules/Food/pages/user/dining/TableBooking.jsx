import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ChevronDown } from "lucide-react"
import { Button } from "@food/components/ui/button"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { diningAPI, restaurantAPI } from "@food/api"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import Loader from "@food/components/Loader"
import { toast } from "sonner"

const BOOKING_DRAFT_KEY = "food_dining_booking_draft_v1"

const buildDates = (count = 7) =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    return date
  })

const formatTimeValue = (value) => {
  if (!value) return null
  if (/[ap]m/i.test(value)) return value.toUpperCase()
  const date = new Date(`2000-01-01T${String(value).padStart(5, "0")}`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
}

const parseTimeToMinutes = (value) => {
  if (!value) return null
  const raw = String(value).trim()

  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmmMatch) {
    return Number(hhmmMatch[1]) * 60 + Number(hhmmMatch[2])
  }

  const meridiemMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!meridiemMatch) return null

  let hour = Number(meridiemMatch[1])
  const minute = Number(meridiemMatch[2] || 0)
  const meridiem = meridiemMatch[3].toUpperCase()

  if (meridiem === "PM" && hour !== 12) hour += 12
  if (meridiem === "AM" && hour === 12) hour = 0

  return hour * 60 + minute
}

const getDayName = (date) => date.toLocaleDateString("en-US", { weekday: "long" })

const buildSlots = (timing) => {
  if (!timing || timing.isOpen === false) return []
  const opening = parseTimeToMinutes(timing.openingTime)
  let closing = parseTimeToMinutes(timing.closingTime)
  if (opening === null || closing === null) return []

  // Handle case where closing time is earlier than opening time (e.g., 2:00 AM next day)
  if (closing <= opening) {
    closing += 24 * 60
  }

  const slots = []
  let cursor = opening

  while (cursor <= closing) {
    const hours = Math.floor((cursor % (24 * 60)) / 60)
    const minutes = cursor % 60
    slots.push(formatTimeValue(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`))
    cursor += 30
  }

  return slots
}

const buildFallbackTiming = (restaurant) => {
  const openingTime = String(
    restaurant?.openingTime ||
      restaurant?.diningSettings?.openingTime ||
      "12:00",
  ).trim()
  const closingTime = String(
    restaurant?.closingTime ||
      restaurant?.diningSettings?.closingTime ||
      "23:00",
  ).trim()

  return {
    isOpen: true,
    openingTime,
    closingTime,
  }
}

const getMealPeriod = (slot) => {
  if (!slot) return "all"
  const normalized = String(slot).toUpperCase()
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/)
  if (!match) return "all"

  let hour = Number(match[1])
  const minute = Number(match[2])
  const meridiem = match[3]

  if (meridiem === "PM" && hour !== 12) hour += 12
  if (meridiem === "AM" && hour === 12) hour = 0

  const totalMinutes = hour * 60 + minute
  if (totalMinutes < 17 * 60) return "lunch"
  return "dinner"
}

const getOfferLabel = (slot) => {
  const period = getMealPeriod(slot)
  return period === "lunch" ? "Lunch" : "Carnival"
}

export default function TableBooking() {
  const { slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()

  const [restaurant, setRestaurant] = useState(location.state?.restaurant || null)
  const [loading, setLoading] = useState(!location.state?.restaurant)
  const [outletTimings, setOutletTimings] = useState({})
  const [selectedGuests, setSelectedGuests] = useState(location.state?.guestCount || 2)
  const [selectedDate, setSelectedDate] = useState(() => {
    const initial = location.state?.selectedDate ? new Date(location.state.selectedDate) : new Date()
    return Number.isNaN(initial.getTime()) ? new Date() : initial
  })
  const [selectedSlot, setSelectedSlot] = useState(location.state?.selectedTime || null)
  const [selectedMealPeriod, setSelectedMealPeriod] = useState("lunch")
  const [currentBookings, setCurrentBookings] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())

  // Real-time update for slots filtering
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  const fetchRestaurant = async () => {
    try {
      setLoading(true)
      const response = await diningAPI.getRestaurantBySlug(slug)
      if (response?.data?.success) {
        const apiRestaurant = response?.data?.data?.restaurant || response?.data?.data
        setRestaurant(apiRestaurant || null)

        const restaurantId = apiRestaurant?._id || apiRestaurant?.id || slug
        
        // Fetch Bookings for Availability check
        try {
            const bookingsRes = await diningAPI.getRestaurantBookings(apiRestaurant)
            if (bookingsRes.data.success) {
                setCurrentBookings(Array.isArray(bookingsRes.data.data) ? bookingsRes.data.data : [])
            }
        } catch (err) {
            console.error("Error fetching bookings:", err)
        }

        const timingsResponse = await restaurantAPI.getOutletTimingsByRestaurantId(restaurantId)
        setOutletTimings(timingsResponse?.data?.data?.outletTimings || {})
      }
    } catch {
      setRestaurant(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (location.state?.restaurant) {
      const restaurantId = location.state.restaurant?._id || location.state.restaurant?.id || slug
      restaurantAPI
        .getOutletTimingsByRestaurantId(restaurantId)
        .then((response) => setOutletTimings(response?.data?.data?.outletTimings || {}))
        .catch(() => setOutletTimings({}))
      
      // Still fetch bookings even if restaurant is in state
      diningAPI.getRestaurantBookings(location.state.restaurant)
        .then(res => {
            if (res.data.success) setCurrentBookings(Array.isArray(res.data.data) ? res.data.data : [])
        })
        .catch(() => {})

      setLoading(false)
      return
    }

    fetchRestaurant()
  }, [location.state?.restaurant, slug])

  const occupiedSeats = useMemo(() => {
    const now = new Date()
    const THIRTY_MINUTES = 30 * 60 * 1000

    return currentBookings
        .filter(b => {
            const isApproved = b.status === "approved"
            const isPending = b.status === "pending"
            
            if (isApproved) return true
            if (isPending) {
                const createdAt = new Date(b.createdAt || b.date)
                const ageMs = now - createdAt
                return ageMs < THIRTY_MINUTES
            }
            return false
        })
        .reduce((sum, b) => sum + (Number(b.guests) || 0), 0)
  }, [currentBookings])

  const maxCapacity = restaurant?.diningSettings?.maxGuests || 10
  const remainingSeats = Math.max(0, maxCapacity - occupiedSeats)

  const dates = useMemo(() => buildDates(7), [])
  const selectedDayTiming = useMemo(() => {
    const fromOutletTimings = outletTimings?.[getDayName(selectedDate)] || null
    if (fromOutletTimings && fromOutletTimings.isOpen !== false) {
      return fromOutletTimings
    }
    return buildFallbackTiming(restaurant)
  }, [outletTimings, selectedDate, restaurant])
  const allSlots = useMemo(() => buildSlots(selectedDayTiming), [selectedDayTiming])

  const availableSlots = useMemo(() => {
    const isToday = selectedDate.toDateString() === currentTime.toDateString()
    if (!isToday) return allSlots

    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
    const buffer = 15 // Allow booking at least 15 minutes ahead

    return allSlots.filter((slot) => {
      const slotMinutes = parseTimeToMinutes(slot)
      return slotMinutes > currentMinutes + buffer
    })
  }, [allSlots, selectedDate, currentTime])

  const filteredSlots = useMemo(
    () => availableSlots.filter((slot) => getMealPeriod(slot) === selectedMealPeriod),
    [availableSlots, selectedMealPeriod]
  )

  useEffect(() => {
    if (!selectedSlot && filteredSlots.length > 0) {
      setSelectedSlot(filteredSlots[0])
      return
    }

    if (selectedSlot && filteredSlots.length > 0 && !filteredSlots.includes(selectedSlot)) {
      setSelectedSlot(filteredSlots[0])
      return
    }

    if (filteredSlots.length === 0) {
      setSelectedSlot(null)
    }
  }, [filteredSlots, selectedSlot])

  useEffect(() => {
    if (availableSlots.length === 0) return
    const hasLunch = availableSlots.some((slot) => getMealPeriod(slot) === "lunch")
    const hasDinner = availableSlots.some((slot) => getMealPeriod(slot) === "dinner")

    if (selectedMealPeriod === "lunch" && !hasLunch && hasDinner) {
      setSelectedMealPeriod("dinner")
    }
    if (selectedMealPeriod === "dinner" && !hasDinner && hasLunch) {
      setSelectedMealPeriod("lunch")
    }
  }, [availableSlots, selectedMealPeriod])

  if (loading) return <Loader />
  if (!restaurant) return <div className="p-6 text-center">Restaurant not found</div>

  const isDiningEnabled = restaurant?.diningSettings?.isEnabled !== false
  const canProceed = Boolean(isDiningEnabled && restaurant && selectedSlot && selectedDate && selectedGuests)

  const handleProceed = () => {
    if (!isDiningEnabled) {
      toast.error("Dining bookings are currently paused for this restaurant.")
      return
    }
    if (!canProceed) {
      toast.error("Please select date, time, and guests to continue.")
      return
    }

    const bookingDraft = {
      restaurant: {
        _id: restaurant?._id || restaurant?.id || restaurant?.restaurant?._id || restaurant?.restaurant?.id || null,
        id: restaurant?.id || restaurant?._id || restaurant?.restaurant?.id || restaurant?.restaurant?._id || null,
        name: restaurant?.name || restaurant?.restaurantName || "Restaurant",
        restaurantName: restaurant?.restaurantName || restaurant?.name || "Restaurant",
        profileImage: restaurant?.profileImage || restaurant?.restaurant?.profileImage || null,
        image: restaurant?.image || restaurant?.restaurant?.image || restaurant?.profileImage?.url || "",
        location: restaurant?.location || restaurant?.restaurant?.location || null,
        slug: restaurant?.slug || slug || "",
        diningSettings: restaurant?.diningSettings || restaurant?.restaurant?.diningSettings || null,
      },
      guests: selectedGuests,
      date: selectedDate,
      timeSlot: selectedSlot,
      discount: selectedSlot,
    }

    try {
      sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(bookingDraft))
    } catch {}

    navigate("/food/user/dining/book-confirmation", { state: bookingDraft })
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f6fb] pb-40">
      <div className="relative overflow-hidden bg-gradient-to-b from-[#ffe7c6] via-[#fff1d7] to-[#f5f6fb] px-4 pb-10 pt-5">
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_65%)]" />

        <div className="relative z-10">
          <button
            onClick={goBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#383838] shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="mt-6 text-center">
            <h1 className="text-[30px] font-black tracking-tight text-[#25314a]">Book a table</h1>
            <p className="mt-1 text-sm font-medium text-[#636363]">{restaurant.name || restaurant.restaurantName}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-4 max-w-md space-y-4 px-4">
        {!isDiningEnabled && (
          <section className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <p className="text-sm font-semibold text-amber-900">Dining bookings are paused by this restaurant.</p>
            <p className="mt-1 text-xs text-amber-800">You can still view details, but new table bookings are disabled right now.</p>
          </section>
        )}

        <section className="rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="text-sm font-medium text-[#2f3545]">Select number of guests</span>
            <span className="text-xs font-bold text-[#7e3866] bg-[#fdfafc] px-2 py-1 rounded-lg">
                {remainingSeats} left
            </span>
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: maxCapacity }, (_, index) => {
              const count = index + 1
              const isBooked = count <= occupiedSeats
              const isTooLarge = count > remainingSeats && !isBooked

              return (
                <button
                  key={count}
                  disabled={isBooked || isTooLarge}
                  onClick={() => setSelectedGuests(count)}
                  className={`flex h-11 items-center justify-center rounded-xl border text-sm font-bold transition-all ${
                    selectedGuests === count
                      ? "border-[#ef8f98] bg-[#fffaf9] text-[#d64f63] shadow-sm"
                      : isBooked
                        ? "border-red-50 bg-red-50 text-red-200 cursor-not-allowed"
                        : isTooLarge
                          ? "border-gray-50 bg-gray-50 text-gray-200 cursor-not-allowed"
                          : "border-[#ececf2] bg-white text-[#444b5f] hover:border-[#ef8f98]/30"
                  }`}
                >
                  {isBooked ? "X" : count}
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-medium text-[#2f3545]">Select date</h3>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {dates.slice(0, 3).map((date, index) => {
              const active = selectedDate.toDateString() === date.toDateString()
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`rounded-[18px] border px-3 py-4 text-center transition-colors ${
                    active
                      ? "border-[#ef8f98] bg-[#fffaf9]"
                      : "border-[#ececf2] bg-white"
                  }`}
                >
                  <span className="block text-sm font-medium text-[#444b5f]">
                    {index === 0 ? "Today" : index === 1 ? "Tomorrow" : date.toLocaleDateString("en-IN", { weekday: "long" })}
                  </span>
                  <span className="mt-1 block text-sm text-[#7b8191]">
                    {date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-medium text-[#2f3545]">Select time of day</h3>

          <div className="mt-4 flex gap-2">
            {[
              { id: "lunch", label: "Lunch" },
              { id: "dinner", label: "Dinner" },
            ].map((period) => {
              const active = selectedMealPeriod === period.id
              return (
                <button
                  key={period.id}
                  onClick={() => setSelectedMealPeriod(period.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-[#ef8f98] bg-white text-[#d64f63]"
                      : "border-[#ececf2] bg-[#fafafc] text-[#666f82]"
                  }`}
                >
                  {period.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {filteredSlots.length === 0 ? (
              <div className="col-span-3 rounded-[18px] border border-dashed border-[#e5e7ef] px-4 py-8 text-center text-sm text-[#7c8394]">
                No {selectedMealPeriod} slots available for the selected date.
              </div>
            ) : (
              filteredSlots.map((slot) => {
                const active = selectedSlot === slot
                return (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`rounded-[16px] border px-3 py-4 text-center transition-colors ${
                      active
                        ? "border-[#ef8f98] bg-[#fffaf9]"
                        : "border-[#ececf2] bg-white"
                    }`}
                  >
                    <span className="block text-sm font-medium text-[#334155]">{slot}</span>
                    <span className="mt-1 block text-xs font-medium text-[#2d5ea8]">
                      {getOfferLabel(slot)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section className="rounded-[18px] bg-white px-4 py-5 text-center shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <p className="text-sm text-[#6f7687]">
            Select your preferred time slot to view available booking options
          </p>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[70] border-t border-[#e6e7ef] bg-[#f5f6fb]/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto max-w-md">
          <Button
            disabled={!canProceed}
            onClick={handleProceed}
            className={`h-14 w-full rounded-2xl text-lg font-bold ${
              canProceed
                ? "bg-[#eb4d60] text-white hover:bg-[#d73f52]"
                : "bg-[#a4abba] text-white/95"
            }`}
          >
            {!isDiningEnabled
              ? "Dining paused"
              : canProceed
                ? "Proceed to confirmation"
                : "Select a time slot to proceed"}
          </Button>
        </div>
      </div>
    </AnimatedPage>
  )
}
