import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Bell,
  CheckCircle,
  AlertCircle,
  Info,
  Package,
  Gift
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getDeliveryNotifications, markDeliveryNotificationAsRead } from "../utils/deliveryNotifications"

const fallbackNotifications = [
  {
    id: 1,
    type: "order",
    title: "New Order Request",
    message: "You have a new order request from Hungry Puppets. Order #100102",
    time: "2 minutes ago",
    read: false,
    icon: Package,
    color: "bg-[#ff8100]"
  },
  {
    id: 2,
    type: "success",
    title: "Order Delivered",
    message: "Order #100101 has been successfully delivered. Payment received: Rs. 2,539.80",
    time: "1 hour ago",
    read: false,
    icon: CheckCircle,
    color: "bg-red-500"
  },
  {
    id: 3,
    type: "alert",
    title: "Payment Pending",
    message: "Payment for Order #100099 is still pending. Please collect from customer.",
    time: "3 hours ago",
    read: true,
    icon: AlertCircle,
    color: "bg-yellow-500"
  },
  {
    id: 4,
    type: "info",
    title: "System Update",
    message: "New features have been added to the delivery app. Check them out!",
    time: "5 hours ago",
    read: true,
    icon: Info,
    color: "bg-blue-500"
  },
  {
    id: 5,
    type: "order",
    title: "Order Cancelled",
    message: "Order #100098 has been cancelled by the customer.",
    time: "1 day ago",
    read: true,
    icon: Package,
    color: "bg-red-500"
  },
  {
    id: 6,
    type: "success",
    title: "Withdrawal Successful",
    message: "Your withdrawal of Rs. 41,500.00 has been processed successfully.",
    time: "2 days ago",
    read: true,
    icon: CheckCircle,
    color: "bg-red-500"
  },
  {
    id: 7,
    type: "info",
    title: "Profile Updated",
    message: "Your profile information has been updated successfully.",
    time: "3 days ago",
    read: true,
    icon: Info,
    color: "bg-blue-500"
  }
]

function getNotificationMeta(notification) {
  const type = (notification?.type || notification?.category || "").toLowerCase()

  if (type === "bonus") {
    return { icon: Gift, color: "bg-emerald-500" }
  }

  if (type === "success" || type === "payment") {
    return { icon: CheckCircle, color: "bg-red-500" }
  }

  if (type === "alert" || type === "warning") {
    return { icon: AlertCircle, color: "bg-yellow-500" }
  }

  if (type === "order") {
    return { icon: Package, color: "bg-[#ff8100]" }
  }

  return { icon: Info, color: "bg-blue-500" }
}

export default function Notifications() {
  const navigate = useNavigate()
  const [storedNotifications, setStoredNotifications] = useState(() => getDeliveryNotifications())

  useEffect(() => {
    const syncNotifications = () => setStoredNotifications(getDeliveryNotifications())

    syncNotifications()
    window.addEventListener("deliveryNotificationsUpdated", syncNotifications)
    window.addEventListener("storage", syncNotifications)

    return () => {
      window.removeEventListener("deliveryNotificationsUpdated", syncNotifications)
      window.removeEventListener("storage", syncNotifications)
    }
  }, [])

  const notifications = useMemo(() => {
    const source = storedNotifications.length > 0 ? storedNotifications : fallbackNotifications

    return source.map((notification) => {
      const meta = getNotificationMeta(notification)
      return {
        ...notification,
        icon: notification.icon || meta.icon,
        color: notification.color || meta.color,
        time: notification.time || "Just now"
      }
    })
  }, [storedNotifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkRead = (notification) => {
    if (notification?.id == null) return
    markDeliveryNotificationAsRead(notification.id)
    setStoredNotifications(getDeliveryNotifications())
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-24 md:pb-6">
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:py-3 flex items-center justify-between rounded-b-3xl md:rounded-b-none sticky top-0 z-10">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={() => navigate("/delivery")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <span className="bg-[#ff8100] text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {unreadCount} New
          </span>
        )}
      </div>

      <div className="px-4 py-6">
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const Icon = notification.icon
              return (
                <Card
                  key={notification.id}
                  className={`bg-white shadow-sm border py-0 border-gray-100 transition-all ${
                    !notification.read ? "border-l-4 border-l-[#ff8100]" : ""
                  }`}
                  onClick={() => handleMarkRead(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`${notification.color} p-2 rounded-full flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3
                            className={`font-semibold text-sm md:text-base ${
                              !notification.read ? "text-gray-900" : "text-gray-700"
                            }`}
                          >
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-[#ff8100] rounded-full flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-gray-600 text-sm md:text-base mb-2 leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {notification.time}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-base md:text-lg">No notifications</p>
          </div>
        )}
      </div>
    </div>
  )
}
