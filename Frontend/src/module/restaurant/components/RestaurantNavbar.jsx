import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Menu, ChevronRight, MapPin, X, Bell } from "lucide-react"
import { restaurantAPI } from "@/lib/api"

export default function RestaurantNavbar({
  restaurantName: propRestaurantName,
  location: propLocation,
  showSearch = true,
  showOfflineOnlineTag = true,
  showNotifications = true,
}) {
  const navigate = useNavigate()
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [status, setStatus] = useState("Offline")
  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch restaurant data on mount
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          console.error("Error fetching restaurant data:", error)
        }
        // Continue with default values if fetch fails
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurantData()
  }, [])

  // Format full address from location object - using stored data only, no live fetching
  const formatAddress = (location) => {
    if (!location) return ""
    
    // Priority 1: Use formattedAddress if available (stored address from database)
    if (location.formattedAddress && location.formattedAddress.trim() !== "" && location.formattedAddress !== "Select location") {
      // Check if it's just coordinates (latitude, longitude format)
      const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(location.formattedAddress.trim())
      if (!isCoordinates) {
        return location.formattedAddress.trim()
      }
    }
    
    // Priority 2: Use address field if available
    if (location.address && location.address.trim() !== "") {
      return location.address.trim()
    }
    
    // Priority 3: Build from individual components
    const parts = []
    
    // Add street address (addressLine1 or street)
    if (location.addressLine1) {
      parts.push(location.addressLine1.trim())
    } else if (location.street) {
      parts.push(location.street.trim())
    }
    
    // Add addressLine2 if available
    if (location.addressLine2) {
      parts.push(location.addressLine2.trim())
    }
    
    // Add area if available
    if (location.area) {
      parts.push(location.area.trim())
    }
    
    // Add landmark if available
    if (location.landmark) {
      parts.push(location.landmark.trim())
    }
    
    // Add city if available and not already in area
    if (location.city) {
      const city = location.city.trim()
      // Only add city if it's not already included in previous parts
      const cityAlreadyIncluded = parts.some(part => part.toLowerCase().includes(city.toLowerCase()))
      if (!cityAlreadyIncluded) {
        parts.push(city)
      }
    }
    
    // Add state if available
    if (location.state) {
      const state = location.state.trim()
      // Only add state if it's not already included
      const stateAlreadyIncluded = parts.some(part => part.toLowerCase().includes(state.toLowerCase()))
      if (!stateAlreadyIncluded) {
        parts.push(state)
      }
    }
    
    // Add zipCode/pincode if available
    if (location.zipCode || location.pincode || location.postalCode) {
      const zip = (location.zipCode || location.pincode || location.postalCode).trim()
      parts.push(zip)
    }
    
    return parts.length > 0 ? parts.join(", ") : ""
  }

  // Get restaurant name (use prop if provided, otherwise use fetched data)
  const restaurantName = propRestaurantName || restaurantData?.name || "Restaurant"

  const [location, setLocation] = useState("")

  // Update location when restaurantData or propLocation changes
  useEffect(() => {
    let newLocation = ""
    
    // Priority 1: Explicit prop takes highest priority
    if (propLocation && propLocation.trim() !== "") {
      newLocation = propLocation.trim()
    }
    // Priority 2: Check restaurantData location
    else if (restaurantData) {
      console.log('🔍 Checking restaurant data for address:', {
        hasLocation: !!restaurantData.location,
        locationKeys: restaurantData.location ? Object.keys(restaurantData.location) : [],
        formattedAddress: restaurantData.location?.formattedAddress,
        address: restaurantData.location?.address,
        directAddress: restaurantData.address,
        fullLocation: restaurantData.location
      })
      
      if (restaurantData.location) {
        // Use stored formattedAddress first (from database)
        if (restaurantData.location.formattedAddress && 
            restaurantData.location.formattedAddress.trim() !== "" && 
            restaurantData.location.formattedAddress !== "Select location") {
          // Check if it's just coordinates (latitude, longitude format)
          const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(restaurantData.location.formattedAddress.trim())
          if (!isCoordinates) {
            newLocation = restaurantData.location.formattedAddress.trim()
            console.log('✅ Using formattedAddress:', newLocation)
          }
        }
        
        // If formattedAddress is not available or is coordinates, try formatAddress function
        if (!newLocation) {
          const formatted = formatAddress(restaurantData.location)
          if (formatted && formatted.trim() !== "") {
            newLocation = formatted.trim()
            console.log('✅ Using formatAddress result:', newLocation)
          }
        }
        
        // Additional fallback: check if address is directly on location
        if (!newLocation && restaurantData.location.address && restaurantData.location.address.trim() !== "") {
          newLocation = restaurantData.location.address.trim()
          console.log('✅ Using location.address:', newLocation)
        }
      }
      
      // Priority 3: Fallback - check if address is directly on restaurantData (not in location object)
      if (!newLocation && restaurantData.address && restaurantData.address.trim() !== "") {
        newLocation = restaurantData.address.trim()
        console.log('✅ Using restaurantData.address:', newLocation)
      }
    }
    
    setLocation(newLocation)
    
    // Debug log
    if (newLocation) {
      console.log('📍 Restaurant address displayed:', newLocation)
    } else if (restaurantData) {
      console.log('⚠️ Restaurant data available but no address found')
    }
  }, [restaurantData, propLocation])

  // Load status from localStorage on mount and listen for changes
  useEffect(() => {
    const updateStatus = () => {
      try {
        const savedStatus = localStorage.getItem('restaurant_online_status')
        if (savedStatus !== null) {
          const isOnline = JSON.parse(savedStatus)
          if (isOnline && !restaurantData?.approvedAt) {
            localStorage.setItem('restaurant_online_status', JSON.stringify(false))
            setStatus("Offline")
            return
          }
          setStatus(isOnline ? "Online" : "Offline")
        } else {
          // Default to Offline if not set
          setStatus("Offline")
        }
      } catch (error) {
        console.error("Error loading restaurant status:", error)
        setStatus("Offline")
      }
    }

    // Load initial status
    updateStatus()

    // Listen for status changes from RestaurantStatus page
    const handleStatusChange = (event) => {
      const isOnline = event.detail?.isOnline ?? false
      setStatus(isOnline ? "Online" : "Offline")
    }

    window.addEventListener('restaurantStatusChanged', handleStatusChange)
    
    // Also check localStorage periodically to catch direct changes
    const interval = setInterval(updateStatus, 1000)
    
    return () => {
      window.removeEventListener('restaurantStatusChanged', handleStatusChange)
      clearInterval(interval)
    }
  }, [restaurantData?.approvedAt])

  const handleStatusClick = () => {
    navigate("/restaurant/status")
  }

  const handleSearchClick = () => {
    setIsSearchActive(true)
  }

  const handleSearchClose = () => {
    setIsSearchActive(false)
    setSearchValue("")
  }

  const handleSearchChange = (e) => {
    setSearchValue(e.target.value)
  }

  const handleMenuClick = () => {
    navigate("/restaurant/explore")
  }

  const handleNotificationsClick = () => {
    navigate("/restaurant/notifications")
  }

  // Show search input when search is active
  if (isSearchActive) {
    return (
      <div className="w-full bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        {/* Search Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search by order ID"
            className="w-full px-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none"
            autoFocus
          />
        </div>

        {/* Close Button */}
        <button
          onClick={handleSearchClose}
          className="w-6 h-6 bg-black rounded-full flex items-center justify-center shrink-0"
          aria-label="Close search"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-full bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {/* Left Side - Restaurant Info */}
      <div className="flex-1 min-w-0 pr-4">
        {/* Restaurant Name */}
        <h1 className="text-base font-bold text-gray-900 truncate">
          {loading ? "Loading..." : restaurantName}
        </h1>
        
        {/* Location */}
        {!loading && location && location.trim() !== "" && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
            <p className="text-xs text-gray-600 truncate" title={location}>
              {location}
            </p>
          </div>
        )}
      </div>

      {/* Right Side - Interactive Elements */}
      <div className="flex items-center">
        {/* Offline/Online Status Tag */}
        {showOfflineOnlineTag && (
          <button
            onClick={handleStatusClick}
            className={`flex items-center gap-1.5 px-2 py-1 border rounded-full hover:opacity-80 transition-all ${
              status === "Online" 
                ? "bg-red-50 border-red-300" 
                : "bg-gray-100 border-gray-300"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              status === "Online" ? "bg-red-500" : "bg-gray-500"
            }`}></span>
            <span className={`text-sm font-medium ${
              status === "Online" ? "text-red-700" : "text-gray-700"
            }`}>
              {status}
            </span>
            <ChevronRight className={`w-4 h-4 ${
              status === "Online" ? "text-red-700" : "text-gray-700"
            }`} />
          </button>
        )}

        {/* Search Icon */}
        {showSearch && (
          <button
            onClick={handleSearchClick}
            className="p-2 ml-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-gray-700" />
          </button>
        )}

        {/* Notifications Icon */}
        {showNotifications && (
          <button
            onClick={handleNotificationsClick}
            className="p-2 ml-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-gray-700" />
          </button>
        )}

        {/* Hamburger Menu Icon */}
        <button
          onClick={handleMenuClick}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
      </div>
    </div>
  )
}
