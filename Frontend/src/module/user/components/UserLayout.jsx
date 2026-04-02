import { Outlet, useLocation } from "react-router-dom"
import { useEffect, useState, createContext, useContext, lazy, Suspense } from "react"
import { ProfileProvider } from "../context/ProfileContext"
import { CartProvider } from "../context/CartContext"
import { OrdersProvider } from "../context/OrdersContext"
import { isModuleAuthenticated } from "@/lib/utils/auth"
import { getWebNotificationPermission, registerFcmTokenForLoggedInUser } from "@/lib/notifications/fcmWeb"
// Lazy load overlays to reduce initial bundle size
const SearchOverlay = lazy(() => import("./SearchOverlay"))
const LocationSelectorOverlay = lazy(() => import("./LocationSelectorOverlay"))
import BottomNavigation from "./BottomNavigation"
import DesktopNavbar from "./DesktopNavbar"

// Create SearchOverlay context with default value
const SearchOverlayContext = createContext({
  isSearchOpen: false,
  searchValue: "",
  setSearchValue: () => {
    console.warn("SearchOverlayProvider not available")
  },
  openSearch: () => {
    console.warn("SearchOverlayProvider not available")
  },
  closeSearch: () => { }
})

export function useSearchOverlay() {
  const context = useContext(SearchOverlayContext)
  // Always return context, even if provider is not available (will use default values)
  return context
}

function SearchOverlayProvider({ children }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const openSearch = () => {
    setIsSearchOpen(true)
  }

  const closeSearch = () => {
    setIsSearchOpen(false)
    setSearchValue("")
  }

  return (
    <SearchOverlayContext.Provider value={{ isSearchOpen, searchValue, setSearchValue, openSearch, closeSearch }}>
      {children}
      <Suspense fallback={null}>
        {isSearchOpen && (
          <SearchOverlay
            isOpen={isSearchOpen}
            onClose={closeSearch}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
          />
        )}
      </Suspense>
    </SearchOverlayContext.Provider>
  )
}

// Create LocationSelector context with default value
const LocationSelectorContext = createContext({
  isLocationSelectorOpen: false,
  openLocationSelector: () => {
    console.warn("LocationSelectorProvider not available")
  },
  closeLocationSelector: () => { }
})

export function useLocationSelector() {
  const context = useContext(LocationSelectorContext)
  if (!context) {
    throw new Error("useLocationSelector must be used within LocationSelectorProvider")
  }
  return context
}

function LocationSelectorProvider({ children }) {
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false)

  const openLocationSelector = () => {
    setIsLocationSelectorOpen(true)
  }

  const closeLocationSelector = () => {
    setIsLocationSelectorOpen(false)
  }

  const value = {
    isLocationSelectorOpen,
    openLocationSelector,
    closeLocationSelector
  }

  return (
    <LocationSelectorContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        {isLocationSelectorOpen && (
          <LocationSelectorOverlay
            isOpen={isLocationSelectorOpen}
            onClose={closeLocationSelector}
          />
        )}
      </Suspense>
    </LocationSelectorContext.Provider>
  )
}

export default function UserLayout() {
  const location = useLocation()
  const [notifPerm, setNotifPerm] = useState(() => getWebNotificationPermission())

  useEffect(() => {
    // Reset scroll to top whenever location changes (pathname, search, or hash)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname, location.search, location.hash])

  // Register FCM token when user is logged in: on mount and whenever auth changes to logged-in
  useEffect(() => {
    let timeoutId = null
    const tryRegisterFcm = () => {
      if (!isModuleAuthenticated("user")) return
      if (timeoutId) clearTimeout(timeoutId)
      // Short delay so storage is committed before the FCM API request reads the token
      timeoutId = setTimeout(() => {
        registerFcmTokenForLoggedInUser().catch(() => {})
        timeoutId = null
      }, 300)
    }
    tryRegisterFcm()
    window.addEventListener("userAuthChanged", tryRegisterFcm)
    return () => {
      window.removeEventListener("userAuthChanged", tryRegisterFcm)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  // Keep permission state updated
  useEffect(() => {
    const t = setInterval(() => setNotifPerm(getWebNotificationPermission()), 1500)
    return () => clearInterval(t)
  }, [])

  // Note: Authentication checks and redirects are handled by ProtectedRoute components
  // UserLayout should not interfere with authentication redirects

  // Show bottom navigation only on home page, dining page, under-250 page, and profile page
  const showBottomNav = location.pathname === "/" ||
    location.pathname === "/user" ||
    location.pathname === "/dining" ||
    location.pathname === "/user/dining" ||
    location.pathname === "/under-250" ||
    location.pathname === "/user/under-250" ||
    location.pathname === "/profile" ||
    location.pathname === "/user/profile" ||
    location.pathname.startsWith("/user/profile")

  // Auth pages (sign-in, otp, etc.) should fill viewport without layout constraints
  const isAuthRoute = location.pathname === "/auth/sign-in" ||
    location.pathname === "/auth/otp" ||
    location.pathname === "/auth/callback" ||
    location.pathname.startsWith("/auth/")

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a] transition-colors duration-200">
      <CartProvider>
        <ProfileProvider>
          <OrdersProvider>
            <SearchOverlayProvider>
              <LocationSelectorProvider>
                {/* Enable notifications banner (needs user gesture to prompt) */}
                {isModuleAuthenticated("user") && notifPerm === "default" ? (
                  <div className="mx-3 mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">Enable notifications</div>
                      <div className="text-xs text-blue-800/80 truncate">
                        To receive order updates and offers.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => registerFcmTokenForLoggedInUser({ forcePrompt: true }).catch(() => {})}
                      className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Enable
                    </button>
                  </div>
                ) : null}
                {/* <Navbar /> */}
                {showBottomNav && <DesktopNavbar />}
                <main className={isAuthRoute ? "min-h-screen" : ""}>
                  <Outlet />
                </main>
                {showBottomNav && <BottomNavigation />}
              </LocationSelectorProvider>
            </SearchOverlayProvider>
          </OrdersProvider>
        </ProfileProvider>
      </CartProvider>
    </div>
  )
}
