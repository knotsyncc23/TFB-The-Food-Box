import { useEffect, useRef, useState } from "react"
import { Outlet } from "react-router-dom"
import AdminSidebar from "./AdminSidebar"
import AdminNavbar from "./AdminNavbar"
import { subscribeToForegroundFcmMessages } from "@/lib/notifications/fcmWeb"
import { isModuleAuthenticated } from "@/lib/utils/auth"
import { toast } from "sonner"
import io from "socket.io-client"
import { API_BASE_URL } from "@/lib/api/config"

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const adminSocketRef = useRef(null)

  // Get initial collapsed state from localStorage to set initial margin
  useEffect(() => {
    try {
      const saved = localStorage.getItem('adminSidebarCollapsed')
      if (saved !== null) {
        setIsSidebarCollapsed(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Error loading sidebar collapsed state:', e)
    }
  }, [])

  // Admin foreground notifications (FCM, if enabled)
  useEffect(() => {
    let unsub = () => {}
    subscribeToForegroundFcmMessages((payload) => {
      const title = payload?.notification?.title || "Notification"
      const body = payload?.notification?.body || ""
      toast(title, { description: body })
      try {
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification(title, { body })
        }
      } catch {}
    })
      .then((u) => {
        unsub = u
      })
      .catch(() => {})

    return () => {
      try {
        unsub?.()
      } catch {}
    }
  }, [])

  // Admin in-app realtime notifications via Socket.IO (retries after login)
  useEffect(() => {
    const disconnectExisting = () => {
      if (adminSocketRef.current) {
        try {
          adminSocketRef.current.disconnect()
        } catch {}
        adminSocketRef.current = null
      }
    }

    const tryConnect = () => {
      // Only connect when admin is authenticated
      if (!isModuleAuthenticated("admin")) {
        disconnectExisting()
        return
      }

      // Admin id from localStorage
      let adminId = null
      try {
        const raw = localStorage.getItem("admin_user")
        const parsed = raw ? JSON.parse(raw) : null
        adminId = parsed?._id || parsed?.id || parsed?.userId || null
      } catch {}
      if (!adminId) return

      // Already connected
      if (adminSocketRef.current?.connected) return

      // Normalize backend URL from API_BASE_URL (strip /api)
      let backendUrl = API_BASE_URL
      try {
        const urlObj = new URL(backendUrl)
        const pathname = urlObj.pathname.replace(/^\/api\/?$/, "")
        backendUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ""}${pathname}`
      } catch {
        backendUrl = String(backendUrl)
          .replace(/\/api\/?$/, "")
          .replace(/\/+$/, "")
      }
      backendUrl = backendUrl
        .replace(/^(https?):\/+/gi, "$1://")
        .replace(/\/+$/, "")

      const socketUrl = `${backendUrl}/admin`
      const socket = io(socketUrl, {
        path: "/socket.io/",
        transports: ["polling"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        timeout: 20000,
        auth: {
          token:
            localStorage.getItem("admin_accessToken") ||
            localStorage.getItem("accessToken"),
        },
      })

      adminSocketRef.current = socket

      socket.on("connect", () => {
        socket.emit("join-admin", adminId)
      })

      socket.on("admin-inapp-notification", (payload) => {
        const title = payload?.title || "Notification"
        const body = payload?.body || ""
        toast(title, { description: body })
      })

      socket.on("connect_error", () => {
        // silent; will retry
      })
    }

    // Try immediately, then retry after auth changes
    tryConnect()
    window.addEventListener("adminAuthChanged", tryConnect)
    window.addEventListener("storage", tryConnect)

    return () => {
      window.removeEventListener("adminAuthChanged", tryConnect)
      window.removeEventListener("storage", tryConnect)
      disconnectExisting()
    }
  }, [])

  const handleCollapseChange = (collapsed) => {
    setIsSidebarCollapsed(collapsed)
  }

  return (
    <div className="min-h-screen bg-neutral-200 flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapseChange={handleCollapseChange}
      />

      {/* Main Content Area */}
      <div className={`
        flex-1 flex flex-col transition-all duration-300 ease-in-out min-w-0
        ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-80'}
      `}>
        {/* Top Navbar */}
        <AdminNavbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        {/* Page Content */}
        <main className="flex-1  w-full max-w-full overflow-x-hidden bg-neutral-100">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
