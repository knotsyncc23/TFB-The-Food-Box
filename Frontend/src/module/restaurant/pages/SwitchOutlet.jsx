import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import { ArrowLeft, Search, Power, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { clearModuleAuth } from "@/lib/utils/auth"
import { restaurantAPI } from "@/lib/api"
import { firebaseAuth } from "@/lib/firebase"
import { removeFcmTokenForRestaurant } from "@/lib/notifications/fcmWeb"

const OUTLET_STORAGE_KEY = "restaurant_selected_outlet_id"

/**
 * Build a single outlet from current restaurant response.
 * Backend returns one restaurant per auth; we treat it as one "outlet" for the switch list.
 */
function buildOutletsFromRestaurant(restaurant) {
  if (!restaurant) return []
  const id = restaurant.restaurantId ?? restaurant.id ?? restaurant._id
  const name = restaurant.name ?? ""
  const address =
    restaurant.location?.formattedAddress ||
    restaurant.location?.address ||
    restaurant.location?.addressLine1 ||
    ""
  const image =
    restaurant.profileImage?.url || restaurant.profileImage?.publicId
      ? (restaurant.profileImage?.url || null)
      : null
  // Use isAcceptingOrders as online/offline for delivery; fallback to isActive
  const status =
    restaurant.isAcceptingOrders === true ? "online" : "offline"
  return [
    {
      id: typeof id === "string" ? id : String(id),
      name,
      address,
      image: image || undefined,
      status,
    },
  ]
}

export default function SwitchOutlet() {
  const navigate = useNavigate()
  const [showOffline, setShowOffline] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [outlets, setOutlets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)

  // Fetch outlets (current restaurant as single outlet until backend supports multiple)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    restaurantAPI
      .getCurrentRestaurant()
      .then((res) => {
        if (cancelled) return
        const data = res?.data?.data?.restaurant ?? res?.data?.restaurant
        if (data) {
          setOutlets(buildOutletsFromRestaurant(data))
        } else {
          setOutlets([])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || err?.message || "Failed to load outlets")
          setOutlets([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const mappedOutletsCount = outlets.length

  // Filter by "Show outlets currently offline": when checked show only offline; when unchecked show all
  const filteredByStatus = useMemo(() => {
    if (showOffline) {
      return outlets.filter((o) => o.status === "offline")
    }
    return outlets
  }, [outlets, showOffline])

  // Apply search (name, address, outlet id)
  const visibleOutlets = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase()
    if (!q) return filteredByStatus
    return filteredByStatus.filter(
      (o) =>
        (o.name && o.name.toLowerCase().includes(q)) ||
        (o.address && o.address.toLowerCase().includes(q)) ||
        (o.id && String(o.id).toLowerCase().includes(q))
    )
  }, [filteredByStatus, searchQuery])

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
    return () => lenis.destroy()
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      try {
        await removeFcmTokenForRestaurant()
      } catch (fcmError) {
        console.warn("Restaurant FCM token removal failed:", fcmError)
      }

      try {
        await restaurantAPI.logout()
      } catch (apiError) {
        console.warn("Logout API call failed, continuing with local cleanup:", apiError)
      }
      try {
        const { signOut } = await import("firebase/auth")
        if (firebaseAuth.currentUser) await signOut(firebaseAuth)
      } catch (firebaseError) {
        console.warn("Firebase logout failed, continuing with local cleanup:", firebaseError)
      }
      clearModuleAuth("restaurant")
      localStorage.removeItem("restaurant_onboarding")
      localStorage.removeItem("restaurant_accessToken")
      localStorage.removeItem(OUTLET_STORAGE_KEY)
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      setTimeout(() => navigate("/restaurant/welcome", { replace: true }), 300)
    } catch (error) {
      console.error("Error during logout:", error)
      clearModuleAuth("restaurant")
      localStorage.removeItem("restaurant_onboarding")
      localStorage.removeItem(OUTLET_STORAGE_KEY)
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/restaurant/welcome", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleOutletClick = (outlet) => {
    try {
      localStorage.setItem(OUTLET_STORAGE_KEY, String(outlet.id))
    } catch (_) {}
    navigate("/restaurant", { replace: true })
  }

  const handleSearchClick = () => {
    setSearchOpen((prev) => !prev)
    if (!searchOpen) setSearchQuery("")
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="min-h-screen bg-white overflow-x-hidden"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900">Switch outlet</h1>
              <p className="text-sm text-gray-600 mt-0.5">
                {loading
                  ? "Loading..."
                  : `You are mapped to ${mappedOutletsCount} outlet${mappedOutletsCount !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleSearchClick}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-gray-900" />
          </button>
        </div>

        {/* Search bar (when search icon clicked) */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pt-3"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, address or outlet ID"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={() => setSearchOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  aria-label="Close search"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Main Content */}
      <div className="px-4 py-6">
        {/* Show Offline Outlets Checkbox */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="flex items-center gap-3 mb-6"
        >
          <Checkbox
            id="show-offline"
            checked={showOffline}
            onCheckedChange={setShowOffline}
            className="w-5 h-5 border-2 border-gray-300 rounded data-[state=checked]:bg-red-600 text-white data-[state=checked]:border-red-600"
          />
          <label
            htmlFor="show-offline"
            className="text-sm font-light text-red-600 cursor-pointer"
          >
            Show outlets currently offline
          </label>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">Loading outlets…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="py-6 rounded-lg bg-red-50 border border-red-200 px-4">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm font-medium text-red-600 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Outlet Cards */}
        {!loading && !error && (
          <div className="space-y-4 mb-8">
            {visibleOutlets.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                {filteredByStatus.length === 0 && searchQuery.trim()
                  ? "No outlets match your search."
                  : filteredByStatus.length === 0
                    ? showOffline
                      ? "You have no outlets currently offline."
                      : "No outlets to show."
                    : "No outlets match your search."}
              </p>
            ) : (
              visibleOutlets.map((outlet, index) => (
                <motion.div
                  key={outlet.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
                  onClick={() => handleOutletClick(outlet)}
                  className="bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  <div className="flex items-start gap-4 p-2 pb-1 rounded-t-lg">
                    <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm border border-gray-200">
                      {outlet.image ? (
                        <img
                          src={outlet.image}
                          alt={outlet.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none"
                            if (e.target.nextSibling) e.target.nextSibling.style.display = "flex"
                          }}
                        />
                      ) : null}
                      <div
                        className="w-full h-full bg-gray-100 flex items-center justify-center"
                        style={{
                          display: outlet.image ? "none" : "flex",
                        }}
                      >
                        <span className="text-3xl">🍔</span>
                      </div>
                    </div>
                    <div className="flex-1 my-auto min-w-0">
                      <h3 className="text-base font-bold text-gray-900">{outlet.name}</h3>
                      <p className="text-sm text-gray-700">{outlet.address || "—"}</p>
                      <p className="text-xs text-gray-600">Outlet ID: {outlet.id}</p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Information Message */}
        {!loading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mb-6"
          >
            <p className="text-sm text-gray-900 leading-relaxed">
              Couldn't find the outlet you are looking for? Logout and try again with a
              different account.
            </p>
          </motion.div>
        )}

        {/* Logout Button */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Power className={`w-5 h-5 ${isLoggingOut ? "animate-spin" : ""}`} />
          <span className="text-base font-medium">
            {isLoggingOut ? "Logging out..." : "Logout"}
          </span>
        </motion.button>
      </div>
    </motion.div>
  )
}
