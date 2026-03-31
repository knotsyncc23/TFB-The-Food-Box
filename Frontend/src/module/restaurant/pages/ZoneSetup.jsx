import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, Search, Save, Loader2, ArrowLeft } from "lucide-react"
import RestaurantNavbar from "../components/RestaurantNavbar"
import { restaurantAPI, zoneAPI } from "@/lib/api"
import { getGoogleMapsApiKey } from "@/lib/utils/googleMapsApiKey"
import { toast } from "sonner"

export default function ZoneSetup() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const existingZonesPolygonsRef = useRef([])
  const hasInitializedRef = useRef(false)
  const pendingSelectionRef = useRef(null)
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("")
  const [mapLoading, setMapLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [locationSearch, setLocationSearch] = useState("")
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedAddress, setSelectedAddress] = useState("")
  const [existingZones, setExistingZones] = useState([])

  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true
    fetchRestaurantData()
    fetchExistingZones()
    loadGoogleMaps()
  }, [])

  // Photon-based location search (free, zero Google Maps cost)
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const searchDebounceRef = useRef(null)

  const handleSearchInput = (value) => {
    setLocationSearch(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (!value || value.trim().length < 2) { setSearchSuggestions([]); return }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const resp = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(value.trim())}&limit=5&lang=en`)
        const data = await resp.json()
        setSearchSuggestions((data.features || []).map(f => ({
          name: [f.properties.name, f.properties.city || f.properties.town, f.properties.state].filter(Boolean).join(', '),
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
        })))
      } catch { setSearchSuggestions([]) }
    }, 300)
  }

  const applySelectionToMap = (lat, lng, address) => {
    setLocationSearch(address)
    setSelectedAddress(address)
    setSelectedLocation({ lat, lng, address })
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat, lng })
      mapInstanceRef.current.setZoom(17)
      updateMarker(lat, lng, address)
    } else {
      pendingSelectionRef.current = { lat, lng, address }
    }
  }

  const handleSelectSuggestion = (suggestion) => {
    setSearchSuggestions([])
    const lat = parseFloat(suggestion.lat)
    const lng = parseFloat(suggestion.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    applySelectionToMap(lat, lng, suggestion.name)
  }

  // Load existing restaurant location when data is fetched
  useEffect(() => {
    if (restaurantData?.location && mapInstanceRef.current && !mapLoading && window.google) {
      const location = restaurantData.location
      let lat = null
      let lng = null
      
      // Get coordinates from different possible structures
      if (location.coordinates && Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
        lng = location.coordinates[0]
        lat = location.coordinates[1]
      } else if (location.latitude && location.longitude) {
        lat = parseFloat(location.latitude)
        lng = parseFloat(location.longitude)
      }
      
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        const locationObj = new window.google.maps.LatLng(lat, lng)
        mapInstanceRef.current.setCenter(locationObj)
        mapInstanceRef.current.setZoom(17)
        
        const address = location.formattedAddress || location.address || formatAddress(location) || ""
        setLocationSearch(address)
        setSelectedAddress(address)
        setSelectedLocation({ lat, lng, address })
        
        updateMarker(lat, lng, address)
      }
    }
  }, [restaurantData, mapLoading])

  const fetchRestaurantData = async () => {
    try {
      const response = await restaurantAPI.getCurrentRestaurant()
      const data = response?.data?.data?.restaurant || response?.data?.restaurant
      if (data) {
        setRestaurantData(data)
      }
    } catch (error) {
      console.error("Error fetching restaurant data:", error)
    }
  }

  const fetchExistingZones = async () => {
    try {
      const response = await zoneAPI.getActiveZones()
      if (response?.data?.success && response.data?.data?.zones) {
        setExistingZones(response.data.data.zones)
      } else {
        setExistingZones([])
      }
    } catch (error) {
      console.error("Error fetching existing zones:", error)
      setExistingZones([])
    }
  }

  const waitForGoogleMaps = async (timeoutMs = 10000) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (window.google && window.google.maps && window.google.maps.Map) return true
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return false
  }

  const loadGoogleMaps = async () => {
    try {
      console.log("📍 Starting Google Maps load...")
      if (mapInstanceRef.current) {
        console.log("✅ Map already initialized, skipping load")
        return
      }
      
      // Fetch API key from database
      let apiKey = null
      try {
        apiKey = await getGoogleMapsApiKey()
        console.log("📍 API Key received:", apiKey ? `Yes (${apiKey.substring(0, 10)}...)` : "No")
        
        if (!apiKey || apiKey.trim() === "") {
          console.error("❌ API key is empty or not found in database")
          setMapLoading(false)
          toast.error("Google Maps API key not found in database. Please contact administrator to add the API key in admin panel.")
          return
        }
      } catch (apiKeyError) {
        console.error("❌ Error fetching API key from database:", apiKeyError)
        setMapLoading(false)
        toast.error("Failed to fetch Google Maps API key from database. Please check your connection or contact administrator.")
        return
      }
      
      setGoogleMapsApiKey(apiKey)
      
      // If Google Maps is already loaded, use it directly
      if (window.google && window.google.maps && window.google.maps.Map) {
        console.log("✅ Google Maps already loaded, initializing map...")
        initializeMap(window.google)
        return
      }

      // Wait for mapRef to be available (retry mechanism)
      let refRetries = 0
      const maxRefRetries = 50 // Wait up to 5 seconds for ref
      while (!mapRef.current && refRetries < maxRefRetries) {
        await new Promise(resolve => setTimeout(resolve, 100))
        refRetries++
      }

      if (!mapRef.current) {
        console.error("❌ mapRef.current is still null after waiting")
        setMapLoading(false)
        toast.error("Failed to initialize map container. Please refresh the page.")
        return
      }

      if (window.__googleMapsPromise) {
        try {
          await window.__googleMapsPromise
        } catch {
          // fall through to manual wait
        }
      }

      // Wait for Google Maps from global loader (main.jsx)
      const loaded = await waitForGoogleMaps(15000)
      if (loaded && window.google && window.google.maps) {
        console.log("✅ Google Maps loaded globally, initializing map...")
        initializeMap(window.google)
      } else {
        throw new Error("Google Maps failed to load")
      }
    } else {
        console.error("❌ No API key available")
        setMapLoading(false)
        toast.error("Google Maps API key not found. Please contact administrator.")
      }
    } catch (error) {
      console.error("❌ Error loading Google Maps:", error)
      setMapLoading(false)
      toast.error(`Failed to load Google Maps: ${error.message}. Please refresh the page or contact administrator.`)
    }
  }

  const initializeMap = (google) => {
    try {
      if (!mapRef.current) {
        console.error("❌ mapRef.current is null in initializeMap")
        setMapLoading(false)
        return
      }

      console.log("📍 Initializing map...")
      // Initial location (India center)
      const initialLocation = { lat: 20.5937, lng: 78.9629 }

      // Create map
      const mapOptions = {
        center: initialLocation,
        zoom: 5,
        mapTypeControl: true,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        scrollwheel: true,
        gestureHandling: 'greedy',
        disableDoubleClickZoom: false,
      }

      if (google.maps?.MapTypeControlStyle && google.maps?.ControlPosition && google.maps?.MapTypeId) {
        mapOptions.mapTypeControlOptions = {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE]
        }
      }

      const map = new google.maps.Map(mapRef.current, mapOptions)

      mapInstanceRef.current = map
      console.log("✅ Map initialized successfully")
      if (pendingSelectionRef.current) {
        const { lat, lng, address } = pendingSelectionRef.current
        pendingSelectionRef.current = null
        applySelectionToMap(lat, lng, address)
      }
      if (existingZones && existingZones.length > 0) {
        drawExistingZonesOnMap(google, map)
      }

      // Add click listener to place marker — uses free Nominatim reverse geocode
      map.addListener('click', async (event) => {
        const lat = event.latLng.lat()
        const lng = event.latLng.lng()
        let address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        try {
          const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en&zoom=18`, { headers: { 'User-Agent': 'Tifunbox-App/1.0' } })
          const data = await resp.json()
          if (data?.display_name) address = data.display_name
        } catch { /* use coordinate fallback */ }
        setLocationSearch(address)
        setSelectedAddress(address)
        setSelectedLocation({ lat, lng, address })
        updateMarker(lat, lng, address)
      })

      setMapLoading(false)
      console.log("✅ Map loading complete")
    } catch (error) {
      console.error("❌ Error in initializeMap:", error)
      setMapLoading(false)
      toast.error("Failed to initialize map. Please refresh the page.")
    }
  }

  // Draw existing zones on the map
  const normalizeZoneCoordinates = (zone) => {
    let raw = zone?.coordinates
    if ((!raw || raw.length === 0) && zone?.boundary?.coordinates?.length) {
      raw = zone.boundary.coordinates[0]
    }
    if (!Array.isArray(raw)) return []

    return raw.map((coord) => {
      if (Array.isArray(coord) && coord.length >= 2) {
        let a = parseFloat(coord[0])
        let b = parseFloat(coord[1])
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null
        // Heuristic: fix swapped lat/lng if out of range
        let lat = b
        let lng = a
        if (Math.abs(a) <= 90 && Math.abs(b) > 90) {
          lat = a
          lng = b
        }
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
        return { lat, lng }
        return null
      }
      if (coord && typeof coord === 'object') {
        const lat = parseFloat(coord.latitude ?? coord.lat)
        const lng = parseFloat(coord.longitude ?? coord.lng)
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
        return null
      }
      return null
    }).filter(Boolean)
  }

  const drawExistingZonesOnMap = (google, map) => {
    if (!existingZones || existingZones.length === 0) {
      console.warn("[ZoneSetup] No existing zones to draw")
      return
    }

    // Clear previous polygons
    existingZonesPolygonsRef.current.forEach(polygon => {
      if (polygon) polygon.setMap(null)
    })
    existingZonesPolygonsRef.current = []

    const bounds = new google.maps.LatLngBounds()
    let polygonsDrawn = 0

    existingZones.forEach((zone) => {
      const normalized = normalizeZoneCoordinates(zone)
      if (normalized.length < 3) return

      const path = normalized.map(coord => new google.maps.LatLng(coord.lat, coord.lng))

      if (path.length < 3) return

      path.forEach(p => bounds.extend(p))

      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        editable: false,
        draggable: false,
        clickable: true,
        zIndex: 0
      })

      polygon.setMap(map)
      existingZonesPolygonsRef.current.push(polygon)
      polygonsDrawn += 1

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <strong>${zone.name || zone.zoneName || 'Unnamed Zone'}</strong><br/>
            <small>Country: ${zone.country || 'N/A'}</small>
          </div>
        `
      })

      polygon.addListener('click', () => {
        infoWindow.setPosition(polygon.getPath().getAt(0))
        infoWindow.open(map)
      })
    })

    if (polygonsDrawn > 0) {
      try {
        map.fitBounds(bounds)
      } catch (e) {
        console.warn("[ZoneSetup] Failed to fit bounds:", e)
      }
      console.log(`[ZoneSetup] Zones drawn: ${polygonsDrawn}`)
    } else {
      console.warn("[ZoneSetup] No valid zones were drawn")
    }
  }

  // Redraw existing zones when data changes or map is ready
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && existingZones.length > 0 && window.google) {
      drawExistingZonesOnMap(window.google, mapInstanceRef.current)
    }
  }, [existingZones, mapLoading])

  const updateMarker = (lat, lng, address) => {
    if (!mapInstanceRef.current || !window.google) return

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.setMap(null)
    }

    // Create new marker
    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstanceRef.current,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
      title: address || "Restaurant Location"
    })

    // Add info window
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 250px;">
          <strong>Restaurant Location</strong><br/>
          <small>${address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}</small>
        </div>
      `
    })

    marker.addListener('click', () => {
      infoWindow.open(mapInstanceRef.current, marker)
    })

    // Update location when marker is dragged — uses free Nominatim reverse geocode
    marker.addListener('dragend', async (event) => {
      const newLat = event.latLng.lat()
      const newLng = event.latLng.lng()
      let newAddress = `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}&addressdetails=1&accept-language=en&zoom=18`, { headers: { 'User-Agent': 'Tifunbox-App/1.0' } })
        const data = await resp.json()
        if (data?.display_name) newAddress = data.display_name
      } catch { /* use coordinate fallback */ }
      setLocationSearch(newAddress)
      setSelectedAddress(newAddress)
      setSelectedLocation({ lat: newLat, lng: newLng, address: newAddress })
    })

    markerRef.current = marker
  }

  const formatAddress = (location) => {
    if (!location) return ""
    
    if (location.formattedAddress && location.formattedAddress.trim() !== "") {
      return location.formattedAddress.trim()
    }
    
    if (location.address && location.address.trim() !== "") {
      return location.address.trim()
    }
    
    const parts = []
    if (location.addressLine1) parts.push(location.addressLine1.trim())
    if (location.addressLine2) parts.push(location.addressLine2.trim())
    if (location.area) parts.push(location.area.trim())
    if (location.city) parts.push(location.city.trim())
    if (location.state) parts.push(location.state.trim())
    if (location.zipCode || location.pincode) parts.push((location.zipCode || location.pincode).trim())
    
    return parts.length > 0 ? parts.join(", ") : ""
  }

  const handleSaveLocation = async () => {
    if (!selectedLocation) {
      toast.error("Please select a location on the map first")
      return
    }

    try {
      const { lat, lng, address } = selectedLocation
      const latNum = parseFloat(lat)
      const lngNum = parseFloat(lng)

      if (!existingZones || existingZones.length === 0) {
        toast.error("No active delivery zones are available. Please contact administrator.")
        return
      }

      if (!isLocationInAnyZone(latNum, lngNum, existingZones)) {
        toast.error("Selected location is outside all active zones. Please choose a location within a delivery zone.")
        return
      }

      setSaving(true)
      
      // Update restaurant location
      const response = await restaurantAPI.updateProfile({
        location: {
          ...(restaurantData?.location || {}),
          latitude: lat,
          longitude: lng,
          coordinates: [lng, lat], // GeoJSON format: [longitude, latitude]
          formattedAddress: address
        }
      })

      if (response?.data?.data?.restaurant) {
        setRestaurantData(response.data.data.restaurant)
        toast.success("Location saved successfully!")
      } else {
        throw new Error("Failed to save location")
      }
    } catch (error) {
      console.error("Error saving location:", error)
      toast.error(error.response?.data?.message || "Failed to save location. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const isPointInZone = (lat, lng, zoneCoordinates) => {
    if (!zoneCoordinates || zoneCoordinates.length < 3) return false
    let inside = false
    for (let i = 0, j = zoneCoordinates.length - 1; i < zoneCoordinates.length; j = i++) {
      const coordI = zoneCoordinates[i]
      const coordJ = zoneCoordinates[j]
      const xi = coordI?.lat
      const yi = coordI?.lng
      const xj = coordJ?.lat
      const yj = coordJ?.lng
      if (xi === null || yi === null || xj === null || yj === null) continue
      const intersect = (yi > lng) !== (yj > lng) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  const isLocationInAnyZone = (lat, lng, zones) => {
    if (!zones || zones.length === 0) return false
    return zones.some(zone => {
      const normalized = normalizeZoneCoordinates(zone)
      if (normalized.length < 3) return false
      return isPointInZone(lat, lng, normalized)
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <RestaurantNavbar />
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            {/* Back Button */}
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Zone Setup</h1>
              <p className="text-sm text-gray-600">Set your restaurant location on the map</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={autocompleteInputRef}
                type="text"
                value={locationSearch}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search for your restaurant location..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {searchSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchSuggestions.map((s, i) => (
                    <button key={i} type="button" onClick={() => handleSelectSuggestion(s)} className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm">
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleSaveLocation}
              disabled={!selectedLocation || saving}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Location</span>
                </>
              )}
            </button>
          </div>
          {selectedLocation && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Selected Location:</strong> {selectedAddress}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">How to set your location:</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Search for your location using the search bar above, or</li>
            <li>Click anywhere on the map to place a pin at that location</li>
            <li>You can drag the pin to adjust the exact position</li>
            <li>Click "Save Location" to save your restaurant location</li>
          </ul>
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
          {/* Always render the map div, show loading overlay on top */}
          <div ref={mapRef} className="w-full h-[600px]" style={{ minHeight: '600px' }} />
          {mapLoading && (
            <div className="absolute inset-0 bg-white flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-2" />
                <p className="text-gray-600">Loading map...</p>
                <p className="text-xs text-gray-400 mt-2">If this takes too long, please refresh the page</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
