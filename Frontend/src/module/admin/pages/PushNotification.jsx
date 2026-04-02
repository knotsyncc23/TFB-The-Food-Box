import { useEffect, useState, useMemo, useRef } from "react"
import { Search, Download, Bell, Edit, Trash2, Upload, Settings, Image as ImageIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { adminAPI } from "../../../lib/api/index.js"
import { pushNotificationsDummy } from "../data/pushNotificationsDummy"
// Using placeholders for notification images
const notificationImage1 = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop"
const notificationImage2 = "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=400&fit=crop"
const notificationImage3 = "https://images.unsplash.com/photo-1556910096-6f5e72db6803?w=800&h=400&fit=crop"

const notificationImages = {
  15: notificationImage1,
  17: notificationImage2,
  18: notificationImage3,
}

export default function PushNotification() {
  const [formData, setFormData] = useState({
    title: "",
    zone: "All",
    sendTo: "Customer",
    description: "",
    bannerImage: null,
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [notifications, setNotifications] = useState(pushNotificationsDummy)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(false)

  // Load real notification history from backend (fallback to dummy if API fails)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await adminAPI.getPushNotifications({ limit: 50, page: 1 })
        const items = res?.data?.data?.items || []
        if (!mounted) return
        if (Array.isArray(items) && items.length) {
          const mapped = items.map((n, idx) => ({
            sl: idx + 1,
            _id: n._id,
            title: n.title,
            description: n.description,
            image: n.image || null,
            zone: n.zone || "All",
            target: n.sendTo || "Customer",
            status: true,
            createdAt: n.createdAt,
            total: n.total,
            sent: n.sent,
            failed: n.failed,
          }))
          setNotifications(mapped)
        }
      } catch {
        // keep dummy
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) {
      return notifications
    }
    
    const query = searchQuery.toLowerCase().trim()
    return notifications.filter(notification =>
      notification.title.toLowerCase().includes(query) ||
      notification.description.toLowerCase().includes(query)
    )
  }, [notifications, searchQuery])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title?.trim() || !formData.description?.trim()) {
      alert("Please fill in title and description.")
      return
    }
    const sendToMap = {
      Customer: "Customer",
      "Delivery Man": "Delivery Man",
      Restaurant: "Restaurant",
      All: "All",
    }
    const normalizedSendTo = sendToMap[formData.sendTo] || "Customer"

    try {
      const res = await adminAPI.sendPushNotification({
        title: formData.title.trim(),
        description: formData.description.trim(),
        sendTo: normalizedSendTo,
        target: normalizedSendTo,
        zone: formData.zone,
      })
      if (res?.data?.success) {
        const { sent, failed, total, notification } = res.data.data || {}
        const msg = total === 0
          ? "No devices with FCM tokens found. Users need to enable notifications."
          : `Notification sent: ${sent} delivered${failed ? `, ${failed} failed` : ""} (${total} total)` 
        alert(msg)
        // Add to top of list so admin can see it immediately
        if (notification?._id) {
          setNotifications(prev => ([
            {
              sl: 1,
              _id: notification._id,
              title: notification.title,
              description: notification.description,
              image: notification.image || null,
              zone: notification.zone || "All",
              target: notification.sendTo || formData.sendTo,
              status: true,
              createdAt: notification.createdAt,
              total: notification.total,
              sent: notification.sent,
              failed: notification.failed,
            },
            ...prev.map((p, idx) => ({ ...p, sl: idx + 2 })),
          ]))
        }
        handleReset()
      } else {
        alert(res?.data?.message || "Failed to send notification.")
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to send notification."
      alert(msg)
    }
  }

  const handleReset = () => {
    setFormData({
      title: "",
      zone: "All",
      sendTo: "Customer",
      description: "",
      bannerImage: null,
    })
  }

  const handleBannerUpload = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("image/") && file.size <= 2 * 1024 * 1024) {
      const reader = new FileReader()
      reader.onload = () => setFormData(prev => ({ ...prev, bannerImage: reader.result }))
      reader.readAsDataURL(file)
    } else if (file) {
      alert("Please upload an image (jpg, png, jpeg, gif, webp) under 2 MB.")
    }
  }

  const handleEditNotification = (notification) => {
    setFormData({
      title: notification.title || "",
      zone: notification.zone || "All",
      sendTo: notification.sendTo || notification.target || "Customer",
      description: notification.description || "",
    })
  }

  const handleExportNotifications = () => {
    const headers = ["SI", "Title", "Description", "Zone", "Target", "Status"]
    const rows = filteredNotifications.map(n => [
      n.sl,
      n.title,
      n.description,
      n.zone,
      n.target,
      n.status ? "Active" : "Inactive",
    ])
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "notifications.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleToggleStatus = (sl) => {
    setNotifications(notifications.map(notification =>
      notification.sl === sl ? { ...notification, status: !notification.status } : notification
    ))
  }

  const handleDelete = (sl) => {
    if (window.confirm("Are you sure you want to delete this notification?")) {
      setNotifications(notifications.filter(notification => notification.sl !== sl))
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Create New Notification Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Notification</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Ex: Notification Title"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Zone
                </label>
                <select
                  value={formData.zone}
                  onChange={(e) => handleInputChange("zone", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="All">All</option>
                  <option value="Asia">Asia</option>
                  <option value="Europe">Europe</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Send To
                </label>
                <select
                  value={formData.sendTo}
                  onChange={(e) => handleInputChange("sendTo", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="All">All</option>
                  <option value="Customer">Customer</option>
                  <option value="Delivery Man">Delivery Man</option>
                  <option value="Restaurant">Restaurant</option>
                </select>
              </div>
            </div>

            {/* Notification Banner Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Notification banner
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
                className="hidden"
                onChange={handleBannerUpload}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
              >
                {formData.bannerImage ? (
                  <img src={formData.bannerImage} alt="Banner preview" className="max-h-24 mx-auto mb-2 rounded object-cover" />
                ) : (
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                )}
                <p className="text-sm font-medium text-blue-600 mb-1">Upload Image</p>
                <p className="text-xs text-slate-500">Image format - jpg png jpeg gif webp Image Size -maximum size 2 MB Image Ratio - 3:1</p>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Ex: Notification Descriptions"
                rows={4}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md"
                >
                  Send Notification
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
                  title="Notification settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Notification List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Notification List</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredNotifications.length}
              </span>
              {loading ? (
                <span className="text-xs text-slate-500">Loading…</span>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by title"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <button
                onClick={handleExportNotifications}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Image</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Zone</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredNotifications.map((notification) => (
                  <tr
                    key={notification.sl}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">{notification.sl}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">{notification.title}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700">{notification.description}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {notification.image ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100">
                          <img
                            src={notificationImages[notification.sl] || notificationImage1}
                            alt={notification.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none"
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">{notification.zone}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">{notification.target}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(notification.sl)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          notification.status ? "bg-blue-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notification.status ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditNotification(notification)}
                          className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(notification.sl)}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-slate-600">
            Configure default notification preferences, delivery options, and templates here.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
