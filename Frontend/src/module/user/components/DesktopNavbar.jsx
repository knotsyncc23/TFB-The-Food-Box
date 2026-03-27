import { Link, useLocation } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { ChevronDown, ShoppingCart, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocation as useLocationHook } from "../hooks/useLocation"
import { useCart } from "../context/CartContext"
import { useLocationSelector } from "./UserLayout"
import { FaLocationDot } from "react-icons/fa6"

export default function DesktopNavbar() {
  const location = useLocation()
  const { location: userLocation, loading: locationLoading } = useLocationHook()
  const { getCartCount } = useCart()
  const { openLocationSelector } = useLocationSelector()
  const cartCount = getCartCount()
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)

  const fullLocationText =
    userLocation?.formattedAddress ||
    userLocation?.address ||
    [userLocation?.area, userLocation?.city, userLocation?.state].filter(Boolean).join(", ") ||
    "Select location"
  const locationParts = fullLocationText.split(",").map((part) => part.trim()).filter(Boolean)
  const mainLocationName = locationParts.slice(0, 2).join(", ") || "Select location"
  const secondaryLocation = locationParts.slice(2).join(", ")

  const handleLocationClick = () => {
    // Open location selector overlay
    openLocationSelector()
  }

  // Check active routes - support both /user/* and /* paths
  const isDining = location.pathname === "/dining" || location.pathname === "/user/dining"
  const isUnder250 = location.pathname === "/under-250" || location.pathname === "/user/under-250"
  const isProfile = location.pathname.startsWith("/profile") || location.pathname.startsWith("/user/profile")
  const isDelivery = !isDining && !isUnder250 && !isProfile && (location.pathname === "/" || location.pathname === "/user" || (location.pathname.startsWith("/") && !location.pathname.startsWith("/restaurant") && !location.pathname.startsWith("/delivery") && !location.pathname.startsWith("/admin") && !location.pathname.startsWith("/usermain")))

  // Reset visibility and scroll position when route changes
  useEffect(() => {
    setIsVisible(true)
    lastScrollY.current = window.scrollY
  }, [location.pathname])

  useEffect(() => {
    if (isUnder250) {
      setIsVisible(true)
      return
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollDifference = Math.abs(currentScrollY - lastScrollY.current)

      // Show navigation when at the top
      if (currentScrollY < 10) {
        setIsVisible(true)
        lastScrollY.current = currentScrollY
        return
      }

      // Only update if scroll difference is significant (avoid flickering on tiny movements)
      if (scrollDifference < 5) {
        return
      }

      // Show when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY.current) {
        // Scrolling up - show navigation
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY.current) {
        // Scrolling down - hide navigation
        setIsVisible(false)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [location.pathname, isUnder250])

  return (
    <nav
      className={`hidden md:block fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${isVisible ? "translate-y-0" : "-translate-y-full"
        }`}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-white/98 dark:bg-[#1a1a1a]/98 border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm" />

      {/* Content */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Location */}
            <div className="flex items-center gap-3 lg:gap-4 min-w-0">
              <Button
                variant="ghost"
                onClick={handleLocationClick}
                disabled={locationLoading}
                className="h-auto px-0 py-0 hover:bg-transparent transition-colors flex-shrink-0"
              >
                {locationLoading ? (
                  <span className="text-sm font-bold text-black">
                    Loading...
                  </span>
                ) : (
                  <div className="flex flex-col items-start min-w-0">
                    <div className="flex items-center gap-1.5 lg:gap-2">
                      <FaLocationDot
                        className="h-5 w-5 lg:h-6 lg:w-6 text-black flex-shrink-0"
                        fill="black"
                        strokeWidth={2}
                      />
                      <span className="text-sm lg:text-base font-bold text-black whitespace-nowrap">
                        {mainLocationName}
                      </span>
                      <ChevronDown className="h-4 w-4 lg:h-5 lg:w-5 text-black flex-shrink-0" strokeWidth={2.5} />
                    </div>
                    {secondaryLocation && (
                      <span className="text-xs lg:text-sm font-bold text-black mt-0.5 whitespace-nowrap">
                        {secondaryLocation}
                      </span>
                    )}
                  </div>
                )}
              </Button>
            </div>

            {/* Center: Navigation Tabs */}
            <div className="flex items-center space-x-1">
              {/* Delivery Tab */}
              <Link
                to="/"
                className={`px-6 py-2.5 text-sm font-medium transition-all duration-200 relative ${isDelivery
                  ? "text-red-600 dark:text-red-500"
                  : "text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500"
                  }`}
              >
                <span className="relative z-10">Delivery</span>
                {isDelivery && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 dark:bg-red-500 rounded-t-full" />
                )}
              </Link>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />

              {/* Under 250 Tab */}
              <Link
                to="/under-250"
                className={`px-6 py-2.5 text-sm font-medium transition-all duration-200 relative ${isUnder250
                  ? "text-red-600 dark:text-red-500"
                  : "text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500"
                  }`}
              >
                <span className="relative z-10">Under 250</span>
                {isUnder250 && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 dark:bg-red-500 rounded-t-full" />
                )}
              </Link>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />

              {/* Dining Tab */}
              <Link
                to="/user/dining"
                className={`px-6 py-2.5 text-sm font-medium transition-all duration-200 relative ${isDining
                  ? "text-red-600 dark:text-red-500"
                  : "text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500"
                  }`}
              >
                <span className="relative z-10">Dining</span>
                {isDining && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 dark:bg-red-500 rounded-t-full" />
                )}
              </Link>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />

              {/* Profile Tab */}
              <Link
                to="/user/profile"
                className={`px-6 py-2.5 text-sm font-medium transition-all duration-200 relative ${isProfile
                  ? "text-red-600 dark:text-red-500"
                  : "text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500"
                  }`}
              >
                <span className="relative z-10">Profile</span>
                {isProfile && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 dark:bg-red-500 rounded-t-full" />
                )}
              </Link>
            </div>

            {/* Right: Wallet and Cart Icons */}
            <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
              {/* Wallet Icon */}
              <Link to="/user/wallet">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 lg:h-10 lg:w-10 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Wallet"
                >
                  <Wallet className="h-5 w-5 lg:h-6 lg:w-6 text-gray-700 dark:text-gray-300" strokeWidth={2} />
                </Button>
              </Link>

              {/* Cart Icon */}
              <Link to="/user/cart">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 lg:h-10 lg:w-10 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Cart"
                >
                  <ShoppingCart className="h-5 w-5 lg:h-6 lg:w-6 text-gray-700 dark:text-gray-300" strokeWidth={2} />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                      <span className="text-[10px] font-bold text-white">{cartCount > 99 ? "99+" : cartCount}</span>
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

