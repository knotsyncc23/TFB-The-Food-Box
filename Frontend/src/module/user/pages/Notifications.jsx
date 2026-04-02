import { Link } from "react-router-dom"
import { useEffect, useState, useMemo } from "react"
import { ArrowLeft, Bell, CheckCircle2, Clock, Tag, Gift, AlertCircle } from "lucide-react"
import AnimatedPage from "../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { userAPI } from "@/lib/api"

const fallbackNotifications = [
  {
    id: 1,
    type: "order",
    title: "Order Confirmed",
    message: "Your order #12345 has been confirmed and is being prepared",
    time: "2 minutes ago",
    read: false,
    icon: CheckCircle2,
    iconColor: "text-red-600"
  },
  {
    id: 2,
    type: "offer",
    title: "Special Offer",
    message: "Get 50% off on your next order above ₹500",
    time: "1 hour ago",
    read: false,
    icon: Tag,
    iconColor: "text-red-600"
  },
  {
    id: 3,
    type: "promotion",
    title: "New Restaurant Added",
    message: "Check out the new Italian restaurant in your area",
    time: "3 hours ago",
    read: true,
    icon: Gift,
    iconColor: "text-blue-600"
  },
  {
    id: 4,
    type: "order",
    title: "Order Delivered",
    message: "Your order #12340 has been delivered successfully",
    time: "Yesterday",
    read: true,
    icon: CheckCircle2,
    iconColor: "text-red-600"
  },
  {
    id: 5,
    type: "alert",
    title: "Payment Failed",
    message: "Your payment for order #12338 failed. Please try again",
    time: "2 days ago",
    read: true,
    icon: AlertCircle,
    iconColor: "text-orange-600"
  },
  {
    id: 6,
    type: "offer",
    title: "Weekend Special",
    message: "Enjoy free delivery on all orders this weekend",
    time: "3 days ago",
    read: true,
    icon: Tag,
    iconColor: "text-red-600"
  }
]

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const fetchNotifications = async () => {
      try {
        setLoading(true)
        const response = await userAPI.getNotifications({ limit: 50, page: 1 })
        const items = response?.data?.data?.notifications || []
        if (!mounted) return

        const mapped = items.map((notification, index) => ({
          id: notification._id || index + 1,
          type:
            notification.sendTo === "Restaurant" ? "promotion" :
            notification.sendTo === "Delivery Man" ? "alert" :
            notification.title?.toLowerCase().includes("order") ? "order" : "offer",
          title: notification.title || "Notification",
          message: notification.description || "",
          time: notification.createdAt
            ? new Date(notification.createdAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })
            : "Just now",
          read: false,
          icon:
            notification.sendTo === "Restaurant" ? Gift :
            notification.sendTo === "Delivery Man" ? AlertCircle :
            notification.title?.toLowerCase().includes("order") ? CheckCircle2 : Bell,
          iconColor:
            notification.sendTo === "Restaurant" ? "text-blue-600" :
            notification.sendTo === "Delivery Man" ? "text-orange-600" :
            "text-red-600",
        }))

        setNotifications(mapped.length > 0 ? mapped : fallbackNotifications)
      } catch (error) {
        console.error("Error fetching notifications:", error)
        if (mounted) setNotifications(fallbackNotifications)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchNotifications()

    return () => {
      mounted = false
    }
  }, [])

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  return (
    <AnimatedPage className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-4 md:mb-6 lg:mb-8">
          <Link to="/user">
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 flex-1">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 fill-red-600" />
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white">Notifications</h1>
            {unreadCount > 0 && (
              <Badge className="bg-red-600 text-white text-xs md:text-sm">
                {unreadCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400">
            Loading notifications...
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {notifications.map((notification) => {
            const Icon = notification.icon
            return (
              <Card
                key={notification.id}
                className={`relative cursor-pointer transition-all duration-200 py-1 hover:shadow-md ${
                  !notification.read ? "bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                }`}
              >
                {/* Unread Dot - Top Right */}
                {!notification.read && (
                  <div className="absolute top-2 right-2 w-2.5 h-2.5 md:w-3 md:h-3 bg-red-600 rounded-full" />
                )}
                
                <CardContent className="p-3 md:p-4 lg:p-5">
                  <div className="flex items-start gap-3 sm:gap-4 md:gap-5">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center ${
                      notification.type === "order" ? "bg-red-100 dark:bg-red-900/40" :
                      notification.type === "offer" ? "bg-red-100 dark:bg-red-900/40" :
                      notification.type === "promotion" ? "bg-blue-100 dark:bg-blue-900/40" :
                      "bg-orange-100 dark:bg-orange-900/40"
                    }`}>
                      <Icon className={`h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 ${notification.iconColor}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm sm:text-base md:text-lg font-semibold mb-1 md:mb-2 ${
                        !notification.read ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"
                      }`}>
                        {notification.title}
                      </h3>
                      <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400 mb-2 md:mb-3 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-1 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="h-3 w-3 md:h-4 md:w-4" />
                        <span>{notification.time}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          </div>
        )}

        {/* Empty State (if no notifications) */}
        {!loading && notifications.length === 0 && (
          <div className="text-center py-12 md:py-16 lg:py-20">
            <Bell className="h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24 text-gray-300 dark:text-gray-600 mx-auto mb-4 md:mb-5 lg:mb-6" />
            <h3 className="text-lg md:text-xl lg:text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2 md:mb-3">No notifications</h3>
            <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">You're all caught up!</p>
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}

