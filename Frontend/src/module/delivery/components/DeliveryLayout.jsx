import { useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import BottomNavigation from "./BottomNavigation"
import { getUnreadDeliveryNotificationCount } from "../utils/deliveryNotifications"
import { isModuleAuthenticated } from "@/lib/utils/auth"
import { getWebNotificationPermission, registerFcmTokenForDelivery } from "@/lib/notifications/fcmWeb"
import { useDeliveryNotifications } from "../hooks/useDeliveryNotifications"

export default function DeliveryLayout({
  children,
  showGig = false,
  showPocket = false,
  onHomeClick,
  onGigClick
}) {
  const location = useLocation()
  const [notifPerm, setNotifPerm] = useState(() => getWebNotificationPermission())
  const [requestBadgeCount, setRequestBadgeCount] = useState(() =>
    getUnreadDeliveryNotificationCount()
  )
  useDeliveryNotifications({ approvalOnly: true })

  // Update badge count when location changes
  useEffect(() => {
    setRequestBadgeCount(getUnreadDeliveryNotificationCount())

    // Listen for notification updates
    const handleNotificationUpdate = () => {
      setRequestBadgeCount(getUnreadDeliveryNotificationCount())
    }

    window.addEventListener('deliveryNotificationsUpdated', handleNotificationUpdate)
    window.addEventListener('storage', handleNotificationUpdate)

    return () => {
      window.removeEventListener('deliveryNotificationsUpdated', handleNotificationUpdate)
      window.removeEventListener('storage', handleNotificationUpdate)
    }
  }, [location.pathname])

  // Keep permission state updated
  useEffect(() => {
    const t = setInterval(() => setNotifPerm(getWebNotificationPermission()), 1500)
    return () => clearInterval(t)
  }, [])

  // Register delivery FCM token after login (won't prompt without user gesture)
  useEffect(() => {
    let timeoutId = null
    const tryRegister = () => {
      if (!isModuleAuthenticated("delivery")) return
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        registerFcmTokenForDelivery().catch(() => {})
        timeoutId = null
      }, 300)
    }
    tryRegister()
    window.addEventListener("deliveryAuthChanged", tryRegister)
    return () => {
      window.removeEventListener("deliveryAuthChanged", tryRegister)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  // Pages where bottom navigation should be shown
  const showBottomNav = [
    '/delivery',
    '/delivery/requests',
    '/delivery/trip-history',
    '/delivery/profile'
  ].includes(location.pathname)

  return (
    <>
      {/* Enable notifications banner (needs user gesture to prompt) */}
      {isModuleAuthenticated("delivery") && notifPerm === "default" ? (
        <div className="mx-3 mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold">Enable notifications</div>
            <div className="text-xs text-blue-800/80 truncate">
              To receive order requests and updates.
            </div>
          </div>
          <button
            type="button"
            onClick={() => registerFcmTokenForDelivery({ forcePrompt: true }).catch(() => {})}
            className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Enable
          </button>
        </div>
      ) : null}
      <main>
        {children}
      </main>
      {showBottomNav && (
        <BottomNavigation
          showGig={showGig}
          showPocket={showPocket}
          onHomeClick={onHomeClick}
          onGigClick={onGigClick}
          requestBadgeCount={requestBadgeCount}
        />
      )}
    </>
  )
}

