import { Link } from "react-router-dom"
import { useState, useEffect } from "react"
import { ChevronDown, ShoppingCart, Wallet, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocation } from "../hooks/useLocation"
import { useCart } from "../context/CartContext"
import { useLocationSelector } from "./UserLayout"
import { FaLocationDot } from "react-icons/fa6"
import { getCachedSettings, loadBusinessSettings } from "@/lib/utils/businessSettings"
import { DEFAULT_LOGO_PLACEHOLDER } from "@/lib/constants/defaultLogo"

export default function PageNavbar({
  textColor = "white",
  zIndex = 20,
  showProfile = false,
  onNavClick
}) {
  const { location, loading, requestLocation } = useLocation()
  const { getCartCount } = useCart()
  const { openLocationSelector } = useLocationSelector()
  const cartCount = getCartCount()
  const [logoUrl, setLogoUrl] = useState(null)
  const [companyName, setCompanyName] = useState(null)

  // Auto-trigger location fetch if we have placeholder values (only once on mount)
  useEffect(() => {
    if (location &&
      !loading &&
      requestLocation &&
      (location.formattedAddress === "Select location" ||
        location.city === "Current Location")) {
      // Wait a bit to avoid multiple rapid calls, and only trigger once
      const timeoutId = setTimeout(() => {
        requestLocation().catch(() => {})
      }, 2000) // Wait 2 seconds before triggering

      return () => clearTimeout(timeoutId)
    }
  }, []) // Only run once on mount

  // Load business settings logo
  useEffect(() => {
    const loadLogo = async () => {
      try {
        // First check cache
        let cached = getCachedSettings()
        if (cached) {
          if (cached.logo?.url) {
            setLogoUrl(cached.logo.url)
          }
          if (cached.companyName) {
            setCompanyName(cached.companyName)
          }
        }

        // Always try to load fresh data to ensure we have the latest
        const settings = await loadBusinessSettings()
        if (settings) {
          if (settings.logo?.url) {
            setLogoUrl(settings.logo.url)
          }
          if (settings.companyName) {
            setCompanyName(settings.companyName)
          }
        }
      } catch (error) {
        console.error('Error loading logo:', error)
      }
    }

    // Load immediately
    loadLogo()

    // Also try after a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      loadLogo()
    }, 100)

    // Listen for business settings updates
    const handleSettingsUpdate = () => {
      const cached = getCachedSettings()
      if (cached) {
        if (cached.logo?.url) {
          setLogoUrl(cached.logo.url)
        }
        if (cached.companyName) {
          setCompanyName(cached.companyName)
        }
      }
    }
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
    }
  }, [])

  // Function to extract location parts for display
  // Main location: First 2 parts only (e.g., "Mama Loca, G-2")
  // Sub location: City and State (e.g., "New Palasia, Indore")
  const getLocationDisplay = (fullAddress, city, state, area) => {
    if (!fullAddress) {
      // Fallback: Use area and city/state if available
      if (area) {
        return {
          main: area,
          sub: city && state ? `${city}, ${state}` : city || state || ""
        }
      }
      if (city) {
        return {
          main: city,
          sub: state || ""
        }
      }
      return { main: "Select location", sub: "" }
    }

    // Split address by comma
    const parts = fullAddress.split(',').map(part => part.trim()).filter(part => part.length > 0)

    // Main location: First 2 parts only (e.g., "Mama Loca, G-2")
    let mainLocation = ""
    if (parts.length >= 2) {
      mainLocation = parts.slice(0, 2).join(', ')
    } else if (parts.length >= 1) {
      mainLocation = parts[0]
    }

    // Sub location: City and State (prefer from location object, fallback to address parts)
    let subLocation = ""
    if (city && state) {
      subLocation = `${city}, ${state}`
    } else if (city) {
      subLocation = city
    } else if (state) {
      subLocation = state
    }

    return {
      main: mainLocation || "Select location",
      sub: subLocation
    }
  }

  // Get display location parts
  // Priority: formattedAddress (complete) > address > area/city
  // IMPORTANT: Sub location ALWAYS uses city and state from location object, never from address parts
  const locationDisplay = (() => {
    let mainLocation = ""
    let subLocation = ""

    // Get main location - prioritize area name over coordinates
    // Check if address/formattedAddress contains coordinates pattern (e.g., "22.7282, 75.8843")
    const isCoordinates = (str) => {
      if (!str) return false
      // Pattern: number.number, number.number (latitude, longitude)
      const coordPattern = /^-?\d+\.\d+,\s*-?\d+\.\d+$/
      return coordPattern.test(str.trim())
    }

    // Special case: backend / hooks could not get a rich address and we only have
    // placeholder text plus raw coordinates. In that case, show the coordinates
    // in the navbar instead of treating everything as a placeholder.
    if (
      !mainLocation &&
      location?.address === "Current Location" &&
      isCoordinates(location?.formattedAddress)
    ) {
      mainLocation = location.formattedAddress
    }

    // Priority 0: Use mainTitle (ZOMATO-STYLE) - Exact building/cafe name
    // This is the most accurate - directly from Google Maps components
    // If mainTitle is available, show it with area if area is different
    if (location?.mainTitle && location.mainTitle.trim() !== "" && location.mainTitle !== "Location Found") {
      mainLocation = location.mainTitle;
      // If area is available and different from mainTitle, append it
      if (location?.area && location.area.trim() !== "" &&
        location.area.toLowerCase() !== location.mainTitle.toLowerCase() &&
        location.area.toLowerCase() !== location?.city?.toLowerCase()) {
        mainLocation = `${location.mainTitle}, ${location.area}`;
      }
    }

    // Priority 1: Use formattedAddress if it contains complete detailed address (has multiple parts)
    // Format: "Mama Loca Cafe, 501 Princess Center, 5th Floor, New Palasia, Indore, Madhya Pradesh 452001"
    if (!mainLocation && location?.formattedAddress && !isCoordinates(location.formattedAddress) && location.formattedAddress !== "Select location") {
      const formattedParts = location.formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)

      // Check if formattedAddress has complete address (4+ parts means it has POI, building, area, city, state)
      if (formattedParts.length >= 4) {
        // Extract locality parts (everything before city)
        // Find city index
        let cityIndex = -1
        if (location?.city) {
          cityIndex = formattedParts.findIndex(part =>
            part.toLowerCase() === location.city.toLowerCase() ||
            part.toLowerCase().includes(location.city.toLowerCase())
          )
        }

        // If city not found, look for state (city is usually before state)
        if (cityIndex === -1 && location?.state) {
          const stateIndex = formattedParts.findIndex(part =>
            part.toLowerCase().includes("madhya") ||
            part.toLowerCase().includes("pradesh") ||
            part.toLowerCase().includes(location.state.toLowerCase())
          )
          if (stateIndex > 0) {
            cityIndex = stateIndex - 1
          }
        }

        // Extract locality parts (POI, building, floor, area) - everything before city
        if (cityIndex > 0) {
          const localityParts = formattedParts.slice(0, cityIndex)
          if (localityParts.length > 0) {
            mainLocation = localityParts.join(', ')
          }
        } else {
          // If city not found, take first 3-4 parts (usually POI, building, floor, area)
          const localityParts = formattedParts.slice(0, Math.min(4, formattedParts.length - 2))
          if (localityParts.length > 0) {
            mainLocation = localityParts.join(', ')
          }
        }
      }
    }

    // Priority 2: Use address field (it has the extracted locality from Google Maps)
    // This is more reliable as it's already processed by useLocation hook
    // Address field contains: "Mama Loca Cafe, 501 Princess Center, 5th Floor, New Palasia"
    if (!mainLocation && location?.address && !isCoordinates(location.address) && location.address !== "Select location") {
      // Check if address already contains locality (not just city)
      const addressParts = location.address.split(',').map(p => p.trim()).filter(p => p.length > 0)
      const cityInAddress = addressParts.some(part =>
        part.toLowerCase() === location?.city?.toLowerCase() ||
        part.toLowerCase() === "indore" ||
        part.toLowerCase() === "bhopal"
      )

      // If address doesn't contain city name, it's likely the locality
      if (!cityInAddress && addressParts.length > 0) {
        mainLocation = location.address
      } else {
        // Address contains city, extract locality parts before city
        const filteredParts = addressParts.filter(part => {
          if (/^\d{6}$/.test(part)) return false
          if (part.toLowerCase() === "india" || part.length > 25) return false
          return true
        })

        let cityIndex = filteredParts.findIndex(part =>
          part.toLowerCase() === location?.city?.toLowerCase() ||
          part.toLowerCase() === "indore" ||
          part.toLowerCase() === "bhopal"
        )

        if (cityIndex > 0) {
          mainLocation = filteredParts.slice(0, cityIndex).join(', ')
        } else if (filteredParts.length >= 3) {
          mainLocation = filteredParts.slice(0, 3).join(', ')
        }
      }
    }

    // Priority 2: Use formattedAddress to extract exact locality (e.g., "Princess center, 5th Floor, New Palasia")
    if (!mainLocation && location?.formattedAddress &&
      !isCoordinates(location.formattedAddress) &&
      location.formattedAddress !== "Select location") {
      const parts = location.formattedAddress.split(',').map(part => part.trim()).filter(part => part.length > 0)

      // Remove pincode and country from parts (they're usually at the end)
      const filteredParts = parts.filter(part => {
        // Skip 6-digit pincode (standalone or with state)
        if (/^\d{6}$/.test(part)) return false
        // Skip parts that are just pincode (e.g., "Madhya Pradesh 452001" - we'll handle this)
        if (/^\d{6}$/.test(part.split(' ').pop())) {
          // Remove pincode from part (e.g., "Madhya Pradesh 452001" -> "Madhya Pradesh")
          return part.replace(/\s+\d{6}$/, '').trim()
        }
        // Skip "India" or country names
        if (part.toLowerCase() === "india" || part.length > 25) return false
        return true
      })

      // Extract locality parts (building, floor, area) - usually first 3 parts before city
      // Format: "Princess center, 5th Floor, New Palasia, Indore, Madhya Pradesh 452001"
      // We want: "Princess center, 5th Floor, New Palasia"

      // Find city index - check multiple ways
      let cityIndex = -1

      // Method 1: Check exact match with location.city
      if (location?.city) {
        cityIndex = filteredParts.findIndex(part =>
          part.toLowerCase() === location.city.toLowerCase()
        )
      }

      // Method 2: Check common city names (case-insensitive)
      if (cityIndex === -1) {
        const commonCities = ["Indore", "indore", "Bhopal", "bhopal", "Mumbai", "mumbai", "Delhi", "delhi"]
        cityIndex = filteredParts.findIndex(part =>
          commonCities.some(city => part.toLowerCase() === city.toLowerCase())
        )
      }

      // Method 3: Check if part contains state name (usually comes after city)
      if (cityIndex === -1 && location?.state) {
        const stateIndex = filteredParts.findIndex(part =>
          part.toLowerCase().includes(location.state.toLowerCase()) ||
          part.toLowerCase().includes("madhya") ||
          part.toLowerCase().includes("pradesh")
        )
        if (stateIndex > 0) {
          // City is usually one position before state
          cityIndex = stateIndex - 1
        }
      }

      // Method 4: Check for "Madhya Pradesh" or other state names
      if (cityIndex === -1) {
        const stateIndex = filteredParts.findIndex(part =>
          part.toLowerCase().includes("madhya") ||
          part.toLowerCase().includes("pradesh") ||
          part.toLowerCase().includes("maharashtra") ||
          part.toLowerCase().includes("gujarat")
        )
        if (stateIndex > 0) {
          cityIndex = stateIndex - 1
        }
      }

      if (cityIndex > 0) {
        // Take all parts before city (building, floor, area)
        const localityParts = filteredParts.slice(0, cityIndex)
        if (localityParts.length > 0) {
          mainLocation = localityParts.join(', ')
        }
      } else {
        // City not found, try to find state and take parts before it
        const stateIndex = filteredParts.findIndex(part =>
          part.toLowerCase().includes("madhya") ||
          part.toLowerCase().includes("pradesh") ||
          (location?.state && part.toLowerCase().includes(location.state.toLowerCase()))
        )

        if (stateIndex > 0) {
          // Take first 3 parts before state (usually building, floor, area)
          const localityParts = filteredParts.slice(0, Math.min(3, stateIndex))
          if (localityParts.length > 0) {
            mainLocation = localityParts.join(', ')
          }
        }

        // If still no mainLocation, use first 3 parts as fallback
        if (!mainLocation && filteredParts.length >= 3) {
          mainLocation = filteredParts.slice(0, 3).join(', ')
        } else if (!mainLocation && filteredParts.length >= 2) {
          mainLocation = filteredParts.slice(0, 2).join(', ')
        } else if (!mainLocation && filteredParts.length >= 1) {
          const firstPart = filteredParts[0]
          if (!isCoordinates(firstPart) && firstPart.length > 2) {
            mainLocation = firstPart
          }
        }
      }
    }
    // Priority 2: Use address field if formattedAddress not available or didn't work
    if (!mainLocation &&
      location?.address &&
      !isCoordinates(location.address) &&
      location.address !== "Select location") {
      const parts = location.address.split(',').map(part => part.trim()).filter(part => part.length > 0)

      // Remove pincode, country, and placeholder values
      const filteredParts = parts.filter(part => {
        if (/^\d{6}$/.test(part)) return false
        if (part.toLowerCase() === "india" || part.length > 25) return false
        if (part.toLowerCase() === "select location" || part.toLowerCase() === "current location") return false
        return true
      })

      // If filtered parts is empty or only has placeholder, skip this priority
      if (filteredParts.length === 0 ||
        (filteredParts.length === 1 &&
          (filteredParts[0].toLowerCase() === "select location" ||
            filteredParts[0].toLowerCase() === "current location"))) {
        // Don't set mainLocation, continue to next priority
      } else {

        // Find city index - same logic as formattedAddress
        let cityIndex = -1

        if (location?.city) {
          cityIndex = filteredParts.findIndex(part =>
            part.toLowerCase() === location.city.toLowerCase()
          )
        }

        if (cityIndex === -1) {
          const commonCities = ["Indore", "indore", "Bhopal", "bhopal"]
          cityIndex = filteredParts.findIndex(part =>
            commonCities.some(city => part.toLowerCase().includes(city.toLowerCase()))
          )
        }

        if (cityIndex === -1 && location?.state) {
          const stateIndex = filteredParts.findIndex(part =>
            part.toLowerCase().includes(location.state.toLowerCase())
          )
          if (stateIndex > 0) {
            cityIndex = stateIndex - 1
          }
        }

        if (cityIndex > 0) {
          const localityParts = filteredParts.slice(0, cityIndex)
          if (localityParts.length > 0) {
            mainLocation = localityParts.join(', ')
          }
        } else if (filteredParts.length >= 3) {
          mainLocation = filteredParts.slice(0, 3).join(', ')
        } else if (filteredParts.length >= 2) {
          mainLocation = filteredParts.slice(0, 2).join(', ')
        } else if (filteredParts.length >= 1) {
          const firstPart = filteredParts[0]
          if (!isCoordinates(firstPart) &&
            firstPart.length > 2 &&
            firstPart.toLowerCase() !== "select location" &&
            firstPart.toLowerCase() !== "current location") {
            mainLocation = firstPart
          }
        }
      }
    }
    // Priority 3: Try to extract from formattedAddress or address again with simpler logic
    if (!mainLocation) {
      // Try to get first 3 parts from any available address field
      const addressToUse = location?.formattedAddress || location?.address || ""
      if (addressToUse &&
        !isCoordinates(addressToUse) &&
        addressToUse !== "Select location" &&
        addressToUse.trim() !== "") {
        const parts = addressToUse.split(',').map(part => part.trim()).filter(part => part.length > 0)
        const filteredParts = parts.filter(part => {
          if (/^\d{6}$/.test(part)) return false // Skip pincode
          if (part.toLowerCase() === "india" || part.length > 25) return false // Skip country
          return true
        })

        // If we have 3+ parts, take first 3 (usually building, floor, area)
        if (filteredParts.length >= 3) {
          mainLocation = filteredParts.slice(0, 3).join(', ')
        } else if (filteredParts.length >= 2) {
          mainLocation = filteredParts.slice(0, 2).join(', ')
        } else if (filteredParts.length >= 1) {
          const firstPart = filteredParts[0]
          if (!isCoordinates(firstPart) && firstPart.length > 2) {
            mainLocation = firstPart
          }
        }
      }
    }

    // Priority 4: Force extract from formattedAddress if still no mainLocation
    // This is a last resort to get locality before falling back to city
    if (!mainLocation &&
      location?.formattedAddress &&
      !isCoordinates(location.formattedAddress) &&
      location.formattedAddress !== "Select location") {
      const parts = location.formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)
      const filteredParts = parts.filter(part => {
        if (/^\d{6}$/.test(part)) return false
        if (part.toLowerCase() === "india" || part.length > 25) return false
        return true
      })

      // Force take first 3 parts (building, floor, area) - ignore city detection
      if (filteredParts.length >= 3) {
        // Check if 3rd part is city, if yes take first 2
        const thirdPart = filteredParts[2].toLowerCase()
        if (thirdPart === "indore" || thirdPart === location?.city?.toLowerCase()) {
          mainLocation = filteredParts.slice(0, 2).join(', ')
        } else {
          mainLocation = filteredParts.slice(0, 3).join(', ')
        }
      } else if (filteredParts.length >= 2) {
        mainLocation = filteredParts.slice(0, 2).join(', ')
      } else if (filteredParts.length >= 1) {
        const firstPart = filteredParts[0]
        if (!isCoordinates(firstPart) && firstPart.length > 2 && firstPart.toLowerCase() !== location?.city?.toLowerCase()) {
          mainLocation = firstPart
        }
      }
    }

    // Priority 5: Use area name if address extraction failed (fallback)
    // Show area + city format if both available, otherwise just area
    if (!mainLocation && location?.area && location.area.trim() !== "" && !isCoordinates(location.area)) {
      // If we have both area and city, show "Area, City" format
      if (location?.city && location.city.trim() !== "" && location.city !== "Unknown City" &&
        location.area.toLowerCase() !== location.city.toLowerCase()) {
        mainLocation = `${location.area}, ${location.city}`
      } else {
        mainLocation = location.area
      }
    }
    // Priority 6: Use city ONLY if nothing else worked (last resort)
    else if (!mainLocation && location?.city &&
      location.city.trim() !== "" &&
      location.city !== "Unknown City" &&
      location.city !== "Select location") {
      // Even if city is "Current Location", prefer showing that instead of placeholder
      mainLocation = location.city
    }
    // Final fallback: if we STILL have nothing, fall back to city or generic placeholder
    else if (!mainLocation) {
      if (location?.city && location.city.trim() !== "") {
        mainLocation = location.city
      } else {
        mainLocation = "Select location"
      }
    }

    // If mainLocation is still coordinates, replace with area or city
    if (isCoordinates(mainLocation)) {
      if (location?.area && location.area.trim() !== "") {
        mainLocation = location.area
      } else if (location?.city && location.city.trim() !== "" && location.city !== "Unknown City") {
        mainLocation = location.city
      } else {
        mainLocation = "Select location"
      }
    }

    // Final check: If mainLocation is just city name, try one more time to extract from formattedAddress
    if (mainLocation && (mainLocation.toLowerCase() === location?.city?.toLowerCase() || mainLocation === "Indore")) {
      // First priority: Check if area is available in location object
      if (location?.area && location.area.trim() !== "" &&
        location.area.toLowerCase() !== location?.city?.toLowerCase() &&
        !isCoordinates(location.area)) {
        mainLocation = `${location.area}, ${location.city}`
      } else if (location?.formattedAddress && !isCoordinates(location.formattedAddress)) {
        // Second priority: Extract area from formattedAddress (before city)
        const parts = location.formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)

        // Find city index
        let cityIndex = -1
        if (location?.city) {
          cityIndex = parts.findIndex(part =>
            part.toLowerCase() === location.city.toLowerCase() ||
            part.toLowerCase().includes(location.city.toLowerCase())
          )
        }

        // If city found, take parts before city as area
        if (cityIndex > 0) {
          const areaParts = parts.slice(0, cityIndex)
          if (areaParts.length > 0) {
            // Take the last part before city as area (usually sublocality like "New Palasia")
            const extractedArea = areaParts[areaParts.length - 1]
            if (extractedArea && extractedArea.toLowerCase() !== location.city.toLowerCase() &&
              !extractedArea.match(/^\d+/) && extractedArea.length > 2 &&
              !extractedArea.toLowerCase().includes("madhya") &&
              !extractedArea.toLowerCase().includes("pradesh")) {
              mainLocation = `${extractedArea}, ${location.city}`
            } else if (areaParts.length >= 2) {
              // Take last 2 parts before city
              const lastTwoParts = areaParts.slice(-2)
              if (lastTwoParts.every(p => p.toLowerCase() !== location.city.toLowerCase())) {
                mainLocation = lastTwoParts.join(', ')
              }
            }
          }
        } else {
          // City not found, filter out city/state and take first parts
          const filteredParts = parts.filter(part => {
            if (/^\d{6}$/.test(part)) return false
            if (part.toLowerCase() === "india" || part.length > 25) return false
            if (part.toLowerCase() === "indore" || part.toLowerCase() === location?.city?.toLowerCase()) return false
            if (part.toLowerCase().includes("madhya") || part.toLowerCase().includes("pradesh")) return false
            return true
          })

          if (filteredParts.length >= 1) {
            const extractedArea = filteredParts[0]
            if (extractedArea && extractedArea.toLowerCase() !== location.city.toLowerCase() &&
              extractedArea.length > 2 && !extractedArea.match(/^\d+/)) {
              mainLocation = `${extractedArea}, ${location.city}`
            }
          }
        }
      }
    }

    // Final check: If mainLocation is still just city, try to add area if available
    if (mainLocation && mainLocation.toLowerCase() === location?.city?.toLowerCase()) {
      // First try location.area field
      if (location?.area && location.area.trim() !== "" &&
        location.area.toLowerCase() !== location.city.toLowerCase() &&
        !isCoordinates(location.area)) {
        mainLocation = `${location.area}, ${location.city}`
      }
      // If area field is empty, try to extract from formattedAddress one more time
      else if (location?.formattedAddress && !isCoordinates(location.formattedAddress)) {
        const parts = location.formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)
        // Look for parts that might be sublocality (usually 2nd or 3rd part before city)
        if (parts.length >= 3) {
          // Try second-to-last part before city/state
          for (let i = parts.length - 3; i >= 0; i--) {
            const part = parts[i]
            if (part && part.toLowerCase() !== location.city.toLowerCase() &&
              !part.match(/^\d+/) && part.length > 2 &&
              !part.toLowerCase().includes("madhya") &&
              !part.toLowerCase().includes("pradesh") &&
              part.toLowerCase() !== "india") {
              mainLocation = `${part}, ${location.city}`
              break
            }
          }
        }
      }
    }

    // Sub location: ALWAYS use city and state from location object ONLY (never from address parts)
    // Check if city and state exist in location object
    const hasCity = location?.city && location.city.trim() !== "" && location.city !== "Unknown City"
    const hasState = location?.state && location.state.trim() !== ""

    if (hasCity && hasState) {
      subLocation = `${location.city}, ${location.state}`
    } else if (hasCity) {
      subLocation = location.city
    } else if (hasState) {
      subLocation = location.state
    } else {
      // If city/state not available in location object, try to extract from formattedAddress
      // This is a fallback - formattedAddress format: "Mama Loca, G-2, Princess Center 6/3, Opposite Manpasand Garden, New Palasia, Indore, 452001, India"
      if (location?.formattedAddress) {
        const parts = location.formattedAddress.split(',').map(part => part.trim()).filter(part => part.length > 0)

        // For Indian addresses: city and state are usually before pincode (which is a 6-digit number)
        // Format: "Mama Loca, G-2, Princess Center 6/3, Opposite Manpasand Garden, New Palasia, Indore, 452001, India"
        if (parts.length >= 4) {
          // Method 1: Find pincode index (6-digit number)
          const pincodeIndex = parts.findIndex(part => /^\d{6}$/.test(part))

          if (pincodeIndex > 1 && pincodeIndex !== -1) {
            // City is 2 positions before pincode, State is 1 position before pincode
            const cityPart = parts[pincodeIndex - 2]
            const statePart = parts[pincodeIndex - 1]

            // Validate: both should be non-empty and not numbers
            if (cityPart && statePart &&
              !cityPart.match(/^\d+$/) &&
              !statePart.match(/^\d+$/) &&
              cityPart.length > 2 &&
              statePart.length > 2) {
              subLocation = `${cityPart}, ${statePart}`
            }
          }

          // Method 2: If pincode not found or extraction failed, try alternative method
          if (!subLocation && parts.length >= 4) {
            // Last part is usually "India", second last might be pincode
            const lastPart = parts[parts.length - 1]
            const secondLastPart = parts[parts.length - 2]

            // If last part is "India" and second last is pincode (6-digit)
            if (lastPart === "India" && /^\d{6}$/.test(secondLastPart)) {
              // City and state are 3 and 4 positions before "India"
              // Format: "..., New Palasia, Indore, 452001, India"
              // parts[length-1] = "India"
              // parts[length-2] = "452001" (pincode)
              // parts[length-3] = "Indore" (state)
              // parts[length-4] = "New Palasia" (city)
              const cityPart = parts[parts.length - 4]
              const statePart = parts[parts.length - 3]

              if (cityPart && statePart &&
                !cityPart.match(/^\d+$/) &&
                !statePart.match(/^\d+$/) &&
                cityPart.length > 2 &&
                statePart.length > 2) {
                subLocation = `${cityPart}, ${statePart}`
              }
            }
          }

          // Method 3: Direct extraction - if we have 8 parts, city and state are at index 4 and 5
          // Format: "Mama Loca, G-2, Princess Center 6/3, Opposite Manpasand Garden, New Palasia, Indore, 452001, India"
          // parts[4] = "New Palasia" (city), parts[5] = "Indore" (state)
          if (!subLocation && parts.length >= 6) {
            // If we have pincode at index 6, city and state are at 4 and 5
            const pincodeIndex = parts.findIndex(part => /^\d{6}$/.test(part))
            if (pincodeIndex === 6 && parts.length >= 7) {
              const cityPart = parts[4]
              const statePart = parts[5]

              if (cityPart && statePart &&
                !cityPart.match(/^\d+$/) &&
                !statePart.match(/^\d+$/) &&
                cityPart.length > 2 &&
                statePart.length > 2) {
                subLocation = `${cityPart}, ${statePart}`
              }
            }
          }

          // Method 4: Simple fallback - if we have 6+ parts, always try parts[4] and parts[5]
          // This is the most reliable method for the given address format
          // Format: "Mama Loca, G-2, Princess Center 6/3, Opposite Manpasand Garden, New Palasia, Indore, 452001, India"
          // parts[0] = "Mama Loca", parts[1] = "G-2", parts[2] = "Princess Center 6/3", parts[3] = "Opposite Manpasand Garden"
          // parts[4] = "New Palasia" (city), parts[5] = "Indore" (state)
          if (!subLocation && parts.length >= 6) {
            // Directly use parts[4] and parts[5] - these are ALWAYS city and state for this format
            const cityPart = parts[4]
            const statePart = parts[5]

            // Less strict validation - just check they're not numbers and not empty
            if (cityPart && statePart &&
              !cityPart.match(/^\d+$/) &&
              !statePart.match(/^\d+$/) &&
              cityPart.length > 1 &&
              statePart.length > 1) {
              subLocation = `${cityPart}, ${statePart}`
            }
          }
        }
      }

      // Also try from address field if formattedAddress didn't work
      if (!subLocation && location?.address && location.address !== location?.formattedAddress) {
        const parts = location.address.split(',').map(part => part.trim()).filter(part => part.length > 0)

        if (parts.length >= 4) {
          const pincodeIndex = parts.findIndex(part => /^\d{6}$/.test(part))
          if (pincodeIndex > 1 && pincodeIndex !== -1) {
            const cityPart = parts[pincodeIndex - 2]
            const statePart = parts[pincodeIndex - 1]
            if (cityPart && statePart &&
              !cityPart.match(/^\d+$/) &&
              !statePart.match(/^\d+$/) &&
              cityPart.length > 2 &&
              statePart.length > 2) {
              subLocation = `${cityPart}, ${statePart}`
            }
          }
        }
      }

      // If still empty, leave it empty
      if (!subLocation) {
        subLocation = ""
      }
    }

    // CRITICAL: Ensure subLocation is NEVER from address parts[1] and parts[2]
    // If subLocation looks like "G-2, Princess Center 6/3", it's wrong - force extraction
    if (subLocation && (subLocation.includes("G-2") || subLocation.includes("Princess Center"))) {
      // Force re-extraction
      if (location?.formattedAddress) {
        const parts = location.formattedAddress.split(',').map(part => part.trim()).filter(part => part.length > 0)
        if (parts.length >= 6) {
          const cityPart = parts[4]
          const statePart = parts[5]
          if (cityPart && statePart &&
            !cityPart.match(/^\d+$/) &&
            !statePart.match(/^\d+$/) &&
            cityPart.length > 1 &&
            statePart.length > 1) {
            subLocation = `${cityPart}, ${statePart}`
          }
        }
      }
    }

    return {
      main: mainLocation,
      sub: subLocation
    }
  })()

  const activeLocationText = (
    location?.formattedAddress ||
    location?.address ||
    [location?.area, location?.city, location?.state].filter(Boolean).join(", ") ||
    "Select location"
  )
    .replace(/,\s*India\s*$/i, "")
    .trim()

  const activeLocationParts = activeLocationText
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  const mainLocationName =
    activeLocationParts.slice(0, 2).join(", ") ||
    locationDisplay.main ||
    "Select location"
  const subLocationName = activeLocationParts.slice(2).join(", ")

  const handleLocationClick = () => {
    // Open location selector overlay
    openLocationSelector()
  }

  const textColorClass = textColor === "white" ? "text-white" : "text-black"
  const iconFill = textColor === "white" ? "white" : "black"
  const ringColor = textColor === "white" ? "ring-white/30" : "ring-gray-800/30"

  const zIndexClass = zIndex === 50 ? "z-50" : "z-20"

  return (
    <nav
      className={`relative ${zIndexClass} w-full px-1 pr-2 sm:px-2 sm:pr-3 md:px-3 lg:px-6 xl:px-8 py-1.5 sm:py-3 lg:py-4`}
      onClick={onNavClick}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4 lg:gap-6 max-w-7xl mx-auto">
        {/* Left: Location - Hidden on desktop, shown on mobile */}
        <div className="flex md:hidden flex-1 items-center gap-3 sm:gap-4 min-w-0">
          {/* Location Button */}
          <Button
            variant="ghost"
            onClick={handleLocationClick}
            disabled={loading}
            className="h-auto min-w-0 max-w-full justify-start px-0 py-0 hover:bg-transparent transition-colors"
          >
            {loading ? (
              <span className={`text-sm font-bold ${textColorClass} ${textColor === "white" ? "drop-shadow-lg" : ""}`}>
                Loading...
              </span>
            ) : (
              <div className="flex flex-col items-start min-w-0 max-w-[170px] sm:max-w-[220px]">
                <div className="flex items-center gap-1.5 min-w-0 w-full">
                  <span className={`text-md sm:text-lg font-bold ${textColorClass} truncate ${textColor === "white" ? "drop-shadow-lg" : ""}`}>
                    {mainLocationName}
                  </span>
                  <ChevronDown className={`h-4 w-4 sm:h-5 sm:w-5 ${textColorClass} flex-shrink-0 ${textColor === "white" ? "drop-shadow-lg" : ""}`} strokeWidth={2.5} />
                </div>
                {/* Show sub location (city, state) in second line */}
                {subLocationName && (
                  <span className={`text-xs font-bold ${textColorClass}${textColor === "white" ? "/90" : ""} truncate mt-0.5 ${textColor === "white" ? "drop-shadow-md" : ""}`}>
                    {subLocationName}
                  </span>
                )}
              </div>
            )}
          </Button>
        </div>

        {/* Center: Company Logo or Name - Show on all screen sizes; show nothing if no logo */}
        <Link to="/" className="flex items-center justify-center flex-shrink-0">
          {logoUrl && logoUrl !== DEFAULT_LOGO_PLACEHOLDER && (
            <img
              src={logoUrl}
              alt="Company Logo"
              className="h-12 w-20 mr-3 sm:h-10 sm:w-10 md:h-12 md:w-12 object-contain"
              crossOrigin="anonymous"
              onError={(e) => {
                e.target.style.display = "none"
              }}
            />
          )}
        </Link>

        {/* Right: Actions - Hidden on desktop, shown on mobile */}
        <div className="flex md:hidden items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Notifications Icon */}
          <Link to="/notifications">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 hover:opacity-80 transition-opacity"
              title="Notifications"
            >
              <div className={`h-full w-full rounded-full bg-white/20 flex items-center justify-center ring-2 ${ringColor}`}>
                <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-gray-800" strokeWidth={2} />
              </div>
            </Button>
          </Link>

          {/* Wallet Icon */}
          <Link to="/user/wallet">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 hover:opacity-80 transition-opacity"
              title="Wallet"
            >
              <div className={`h-full w-full rounded-full bg-white/20 flex items-center justify-center ring-2 ${ringColor}`}>
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-gray-800" strokeWidth={2} />
              </div>
            </Button>
          </Link>

          {/* Cart Icon */}
          <Link to="/user/cart">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 hover:opacity-80 transition-opacity"
              title="Cart"
            >
              <div className={`h-full w-full rounded-full bg-white/20 flex items-center justify-center ring-2 ${ringColor}`}>
                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-gray-800" strokeWidth={2} />
              </div>
              {cartCount > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center ring-2 ${textColor === "white" ? "ring-white/50" : "ring-gray-800/30"}`}>
                  <span className="text-[9px] font-bold text-white">{cartCount > 99 ? "99+" : cartCount}</span>
                </span>
              )}
            </Button>
          </Link>

          {/* Profile - Only shown if showProfile is true */}
          {showProfile && (
            <Link to="/user/profile">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 hover:opacity-80 transition-opacity"
                title="Profile"
              >
                <div className={`h-full w-full rounded-full bg-white flex items-center justify-center shadow-lg ring-2 ${ringColor}`}>
                  <span className="text-black text-xs sm:text-sm font-extrabold">
                    A
                  </span>
                </div>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

