import { useNavigate, useLocation } from "react-router-dom"
import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  FileText,
  Package,
  MessageSquare,
  Compass,
} from "lucide-react"
import useNotificationInbox from "@food/hooks/useNotificationInbox"
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications"

const getOrdersTabs = (basePath = "/food/restaurant") => [
  { id: "orders", label: "Orders", icon: FileText, route: `${basePath}` },
  { id: "inventory", label: "Inventory", icon: Package, route: `${basePath}/inventory` },
  { id: "feedback", label: "Feedback", icon: MessageSquare, route: `${basePath}/feedback` },
  { id: "explore", label: "Explore", icon: Compass, route: `${basePath}/explore` },
]

const findActiveTab = (tabs, pathname) =>
  tabs
    .slice()
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => pathname === tab.route || pathname.startsWith(tab.route + "/"))

export default function BottomNavOrders() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const basePath = pathname.includes("/food/restaurant")
    ? "/food/restaurant"
    : pathname.includes("/restaurant")
    ? "/food/restaurant"
    : "/food/restaurant"

  const { unreadCount } = useNotificationInbox("restaurant", { limit: 20, pollMs: 60 * 1000 })
  const { newOrder, newReservation } = useRestaurantNotifications();

  const tabs = useMemo(() => getOrdersTabs(basePath), [basePath])

  const isInternalPage = pathname.includes("/create-offers")
  if (isInternalPage) {
    return null
  }

  const activeTab = useMemo(() => {
    const match = findActiveTab(tabs, pathname)
    return match?.id || "orders"
  }, [tabs, pathname])

  const handleTabClick = (tab) => {
    if (tab.route && tab.route !== pathname) {
      navigate(tab.route)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-60 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md items-end gap-2">
        <div className="flex-1 min-w-0">
          <div className="relative overflow-visible rounded-[30px] bg-[#7e3866] py-2 pl-3 pr-2 shadow-[0_16px_40px_rgba(126,56,102,0.35)]">
            <div className="relative flex items-end justify-around gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => handleTabClick(tab)}
                    aria-current={isActive ? "page" : undefined}
                    className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-visible rounded-full px-2 py-2"
                    whileTap={{ scale: 0.95 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="bottomNavActive"
                        className="absolute inset-0 -z-10 rounded-full bg-white/22"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    <Icon
                      className={`relative z-10 h-4.5 w-4.5 transition-colors duration-300 ease-in-out ${
                        isActive ? "text-white" : "text-white/78"
                      }`}
                    />
                    {/* Notification Dot */}
                    {((tab.id === 'orders' && (newOrder || newReservation)) || 
                      (tab.id === 'feedback' && unreadCount > 0)) && (
                      <span className="absolute top-2 right-1/4 w-2 h-2 rounded-full bg-red-500 border border-[#7e3866] z-20 animate-pulse" />
                    )}
                    <span
                      className={`relative z-10 whitespace-nowrap text-[11px] leading-none transition-colors duration-300 ease-in-out ${
                        isActive ? "text-white" : "text-white/78"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
