import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  Info,
  LogOut,
  Settings,
  Shield,
  Store,
  Trash2,
  Truck,
  Users,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { restaurantAPI } from "@/lib/api"
import { clearModuleAuth } from "@/lib/utils/auth"
import { firebaseAuth } from "@/lib/firebase"
import { removeFcmTokenForRestaurant } from "@/lib/notifications/fcmWeb"
import { toast } from "sonner"

export default function SettingsPage() {
  const navigate = useNavigate()
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

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

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoadingRestaurant(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
        }
      } catch (error) {
        if (error.code !== "ERR_NETWORK" && error.code !== "ECONNABORTED" && !error.message?.includes("timeout")) {
          console.error("Error fetching restaurant data:", error)
        }
      } finally {
        setLoadingRestaurant(false)
      }
    }

    fetchRestaurantData()
  }, [])

  const formatAddress = (location) => {
    if (!location) return ""

    const parts = []
    if (location.area) parts.push(location.area.trim())
    if (location.city) {
      const city = location.city.trim()
      const alreadyIncluded = parts.some((part) => part.toLowerCase().includes(city.toLowerCase()))
      if (!alreadyIncluded) parts.push(city)
    }

    return parts.join(", ")
  }

  const completeRestaurantSignOut = async () => {
    try {
      const { signOut } = await import("firebase/auth")
      if (firebaseAuth?.currentUser) {
        await signOut(firebaseAuth)
      }
    } catch (firebaseError) {
      console.warn("Firebase logout failed for restaurant cleanup:", firebaseError)
    }

    clearModuleAuth("restaurant")
    localStorage.removeItem("restaurant_onboarding")
    localStorage.removeItem("restaurant_invited_users")
    sessionStorage.removeItem("restaurantAuthData")
    window.dispatchEvent(new Event("restaurantAuthChanged"))
  }

  const handleLogout = async () => {
    if (isLoggingOut || isDeletingAccount) return
    if (!window.confirm("Are you sure you want to logout?")) return

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
        console.warn("Restaurant logout API failed, continuing with cleanup:", apiError)
      }

      await completeRestaurantSignOut()
      toast.success("Logged out successfully")
      navigate("/restaurant/login", { replace: true })
    } catch (error) {
      console.error("Error during restaurant logout:", error)
      await completeRestaurantSignOut()
      navigate("/restaurant/login", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (isDeletingAccount || isLoggingOut) return
    if (!window.confirm("Are you sure you want to delete your restaurant account? This action cannot be undone.")) return

    setIsDeletingAccount(true)
    try {
      try {
        await removeFcmTokenForRestaurant()
      } catch (fcmError) {
        console.warn("Restaurant FCM token removal failed before account deletion:", fcmError)
      }

      await restaurantAPI.deleteAccount()
      await completeRestaurantSignOut()
      toast.success("Account deleted successfully")
      navigate("/restaurant/welcome", { replace: true })
    } catch (error) {
      console.error("Error deleting restaurant account:", error)
      toast.error(
        error?.response?.data?.message ||
        error?.message ||
        "Failed to delete account",
      )
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const settingsSections = [
    {
      id: "operations",
      title: "Operations",
      items: [
        { id: "status", label: "Restaurant status", description: "Manage live order availability", icon: Settings, route: "/restaurant/status" },
        { id: "delivery", label: "Delivery settings", description: "Control delivery timings and status", icon: Truck, route: "/restaurant/delivery-settings" },
        { id: "timings", label: "Outlet timings", description: "Set opening and closing schedule", icon: Clock, route: "/restaurant/outlet-timings" },
        { id: "contact", label: "Manage staff", description: "Update restaurant contacts and team", icon: Users, route: "/restaurant/contact-details" },
      ],
    },
    {
      id: "support",
      title: "Support & Legal",
      items: [
        { id: "help", label: "Help centre", description: "Get support and answers", icon: HelpCircle, route: "/restaurant/help-centre" },
        { id: "privacy", label: "Privacy policy", description: "Review restaurant privacy information", icon: Shield, route: "/restaurant/privacy" },
        { id: "terms", label: "Terms & conditions", description: "View legal terms for restaurant partners", icon: FileText, route: "/restaurant/terms" },
      ],
    },
    {
      id: "account",
      title: "Account",
      items: [
        {
          id: "logout",
          label: isLoggingOut ? "Logging out..." : "Logout",
          description: "Sign out from this restaurant account",
          icon: LogOut,
          action: handleLogout,
          isDestructive: true,
          disabled: isLoggingOut || isDeletingAccount,
        },
        {
          id: "delete",
          label: isDeletingAccount ? "Deleting account..." : "Delete account",
          description: "Permanently remove this restaurant account",
          icon: Trash2,
          action: handleDeleteAccount,
          isDestructive: true,
          disabled: isDeletingAccount || isLoggingOut,
        },
      ],
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="min-h-screen bg-white overflow-x-hidden"
    >
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
            <h1 className="text-lg font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your restaurant preferences</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Card className="bg-white border-gray-200 py-3 mb-6 rounded-lg shadow-sm">
            <CardContent className="px-4">
              <button
                onClick={() => navigate("/restaurant/switch-outlet")}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Store className="w-5 h-5 text-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h2 className="text-base font-semibold text-gray-900 mb-0.5">
                      {loadingRestaurant ? "Loading..." : (restaurantData?.name || "Restaurant")}
                    </h2>
                    <p className="text-sm text-gray-500 truncate">
                      {loadingRestaurant ? "Loading..." : (formatAddress(restaurantData?.location) || "Switch or review outlet details")}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              </button>
            </CardContent>
          </Card>
        </motion.div>

        <div className="space-y-6">
          {settingsSections.map((section, sectionIndex) => (
            <motion.section
              key={section.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 + sectionIndex * 0.05 }}
            >
              <h2 className="text-base font-bold text-gray-900 mb-3">{section.title}</h2>
              <Card className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {section.items.map((item, itemIndex) => {
                    const Icon = item.icon
                    const isLast = itemIndex === section.items.length - 1

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.disabled) return
                          if (item.action) {
                            item.action()
                            return
                          }
                          if (item.route) {
                            navigate(item.route)
                          }
                        }}
                        disabled={item.disabled}
                        className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed ${
                          !isLast ? "border-b border-gray-100" : ""
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${item.isDestructive ? "bg-red-50" : "bg-gray-100"}`}>
                          <Icon className={`w-5 h-5 ${item.isDestructive ? "text-red-600" : "text-gray-900"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${item.isDestructive ? "text-red-600" : "text-gray-900"}`}>
                            {item.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                        </div>
                        {!item.action || !item.isDestructive ? (
                          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                        ) : (
                          <Info className="w-4 h-4 text-red-300 shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            </motion.section>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
