import { useNavigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { User } from "lucide-react"
import { deliveryAPI } from "@food/api"

// Heroicons Outline
import {
  HomeIcon as HomeOutline,
  WalletIcon as WalletOutline,
  ClockIcon as ClockOutline,
} from "@heroicons/react/24/outline"

// Heroicons Solid
import {
  HomeIcon as HomeSolid,
  WalletIcon as WalletSolid,
  ClockIcon as ClockSolid,
} from "@heroicons/react/24/solid"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function BottomNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const [profileImage, setProfileImage] = useState(null)
  const [imageError, setImageError] = useState(false)

  const isActive = (path) => {
    if (path === "/food/delivery") return location.pathname === "/food/delivery"
    return location.pathname.startsWith(path)
  }

  const iconClass = "w-6 h-6"

  const TabIcon = (active, Outline, Solid) => {
    const Icon = active ? Solid : Outline
    return <Icon className={iconClass} />
  }

  const TabLabel = (active, label) => (
    <span
      className={`text-[11px] font-bold tracking-[0.02em] ${active ? "" : "text-gray-500"}`}
      style={active ? { color: "var(--dv-primary)" } : undefined}
    >
      {label}
    </span>
  )

  // Fetch profile image
  useEffect(() => {
    const fetchProfileImage = async () => {
      try {
        const response = await deliveryAPI.getProfile()
        if (response?.data?.success && response?.data?.data?.profile) {
          const profile = response.data.data.profile
          // Use profileImage.url first, fallback to documents.photo
          const imageUrl = profile.profileImage?.url || profile.documents?.photo
          if (imageUrl) {
            setProfileImage(imageUrl)
          }
        }
      } catch (error) {
        // Skip logging network and timeout errors (handled by axios interceptor)
        if (error.code !== 'ECONNABORTED' && 
            error.code !== 'ERR_NETWORK' && 
            error.message !== 'Network Error' &&
            !error.message?.includes('timeout')) {
          debugError("Error fetching profile image for navigation:", error)
        }
      }
    }

    fetchProfileImage()

    // Listen for profile refresh events
    const handleProfileRefresh = () => {
      fetchProfileImage()
    }

    window.addEventListener('deliveryProfileRefresh', handleProfileRefresh)
    
    return () => {
      window.removeEventListener('deliveryProfileRefresh', handleProfileRefresh)
    }
  }, [])

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t shadow-[0_-14px_34px_rgba(15,107,203,0.16)] z-50"
      style={{ borderColor: "color-mix(in srgb, var(--dv-primary) 18%, #ffffff)" }}
    >
      <div className="flex items-center justify-around py-2.5 px-3">

        {/* Feed */}
        <button
          onClick={() => navigate("/food/delivery")}
          className="flex flex-col items-center gap-1.5 p-2.5"
        >
          {TabIcon(isActive("/food/delivery"), HomeOutline, HomeSolid)}
          {TabLabel(isActive("/food/delivery"), "Feed")}
        </button>

        {/* Pocket */}
        <button
          onClick={() => navigate("/food/delivery/pocket")}
          className="flex flex-col items-center gap-1.5 p-2.5"
        >
          {TabIcon(isActive("/food/delivery/pocket"), WalletOutline, WalletSolid)}
          {TabLabel(isActive("/food/delivery/pocket"), "Pocket")}
        </button>

        {/* Trip History */}
        <button
          onClick={() => navigate("/food/delivery/history")}
          className="flex flex-col items-center gap-1.5 p-2.5"
        >
          {TabIcon(isActive("/food/delivery/history"), ClockOutline, ClockSolid)}
          {TabLabel(isActive("/food/delivery/history"), "History")}
        </button>

        {/* Profile */}
        <button
          onClick={() => navigate("/food/delivery/profile")}
          className="flex flex-col items-center gap-1.5 p-2.5"
        >
          {profileImage && !imageError ? (
            <img
              src={profileImage}
              alt="Profile"
              className={`w-7 h-7 rounded-full border-2 object-cover ${
                isActive("/food/delivery/profile") ? "" : "border-gray-300"
              }`}
              style={isActive("/food/delivery/profile") ? { borderColor: "var(--dv-primary)" } : undefined}
              onError={() => {
                setImageError(true)
              }}
            />
          ) : (
            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center bg-gray-200 ${
              isActive("/food/delivery/profile") ? "" : "border-gray-300"
            }`} style={isActive("/food/delivery/profile") ? { borderColor: "var(--dv-primary)" } : undefined}>
              <User className="w-4 h-4 text-gray-500" />
            </div>
          )}
          {TabLabel(isActive("/food/delivery/profile"), "Profile")}
        </button>
      </div>
    </div>
  )
}

