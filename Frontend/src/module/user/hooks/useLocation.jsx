import { useState, useEffect, useRef } from "react"
import { locationAPI, userAPI } from "@/lib/api"

/** Only reverse-geocode + user location DB API after moving at least this far (meters). */
const MIN_MOVE_METERS_FOR_LOCATION_API = 80
const USER_LOCATION_KEY = "userLocation"
const USER_LOCATION_MODE_KEY = "userLocationMode"

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function useLocation() {
  const IS_DEV = import.meta.env.MODE === "development"
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [permissionGranted, setPermissionGranted] = useState(false)

  const watchIdRef = useRef(null)
  const updateTimerRef = useRef(null)
  const prevLocationCoordsRef = useRef({ latitude: null, longitude: null })
  /** Last coords used for reverse geocode / updateLocation API; skip watch churn under MIN_MOVE_METERS. */
  const lastGeocodeApiCoordsRef = useRef(null)

  const getStoredLocationMode = () => {
    try {
      return localStorage.getItem(USER_LOCATION_MODE_KEY) || "current"
    } catch {
      return "current"
    }
  }

  const setStoredLocationMode = (mode) => {
    try {
      localStorage.setItem(USER_LOCATION_MODE_KEY, mode)
    } catch {
      // ignore storage errors
    }
  }

  // Broadcast location so other useLocation instances (e.g. top nav) update instantly
  const dispatchLocationUpdated = (locationData) => {
    if (!locationData || typeof window === "undefined") return
    const isPlaceholder =
      locationData?.city === "Current Location" ||
      locationData?.formattedAddress === "Select location" ||
      locationData?.address === "Select location"
    if (isPlaceholder) return
    try {
      const payload = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        city: locationData.city,
        state: locationData.state,
        area: locationData.area,
        address: locationData.address,
        formattedAddress: locationData.formattedAddress || locationData.address,
        ...locationData
      }
      window.dispatchEvent(new CustomEvent("userLocationUpdated", { detail: payload }))
    } catch {
      // ignore
    }
  }

  /* ===================== DB UPDATE (LIVE LOCATION TRACKING) ===================== */
  const updateLocationInDB = async (locationData) => {
    try {
      // Check if location has placeholder values - don't save placeholders
      const hasPlaceholder =
        locationData?.city === "Current Location" ||
        locationData?.address === "Select location" ||
        locationData?.formattedAddress === "Select location" ||
        (!locationData?.city && !locationData?.address && !locationData?.formattedAddress);

      if (hasPlaceholder) {
        console.log("âš ï¸ Skipping DB update - location contains placeholder values:", {
          city: locationData?.city,
          address: locationData?.address,
          formattedAddress: locationData?.formattedAddress
        });
        return;
      }

      // Check if user is authenticated before trying to update DB
      const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken')
      if (!userToken || userToken === 'null' || userToken === 'undefined') {
        // User not logged in - skip DB update, just use localStorage
        console.log("â„¹ï¸ User not authenticated, skipping DB update (using localStorage only)")
        return
      }

      // Prepare complete location data for database storage
      const locationPayload = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address || "",
        city: locationData.city || "",
        state: locationData.state || "",
        area: locationData.area || "",
        formattedAddress: locationData.formattedAddress || locationData.address || "",
      }

      // Add optional fields if available
      if (locationData.accuracy !== undefined && locationData.accuracy !== null) {
        locationPayload.accuracy = locationData.accuracy
      }
      if (locationData.postalCode) {
        locationPayload.postalCode = locationData.postalCode
      }
      if (locationData.street) {
        locationPayload.street = locationData.street
      }
      if (locationData.streetNumber) {
        locationPayload.streetNumber = locationData.streetNumber
      }

      console.log("ðŸ’¾ Updating live location in database:", {
        coordinates: `${locationPayload.latitude}, ${locationPayload.longitude}`,
        formattedAddress: locationPayload.formattedAddress,
        city: locationPayload.city,
        area: locationPayload.area,
        accuracy: locationPayload.accuracy
      })

      await userAPI.updateLocation(locationPayload)

      console.log("âœ… Live location successfully stored in database")
    } catch (err) {
      // Only log non-network and non-auth errors
      if (err.code !== "ERR_NETWORK" && err.response?.status !== 404 && err.response?.status !== 401) {
        console.error("âŒ DB location update error:", err)
      } else if (err.response?.status === 404 || err.response?.status === 401) {
        // 404 or 401 means user not authenticated or route doesn't exist
        // Silently skip - this is expected for non-authenticated users
        console.log("â„¹ï¸ Location update skipped (user not authenticated or route not available)")
      }
    }
  }

  /* ===================== DIRECT REVERSE GEOCODE (providerâ€‘agnostic fallback, no external APIs) ===================== */
  const reverseGeocodeDirect = async (latitude, longitude) => {
    const coordsString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
    return {
      city: "Current Location",
      state: "",
      country: "",
      area: "",
      address: coordsString,
      formattedAddress: coordsString,
    }
  }

  /* ===================== GOOGLE MAPS REVERSE GEOCODE (now using Google directly on client) ===================== */
  const reverseGeocodeWithGoogleMaps = async (latitude, longitude) => {
    try {
      // Use backend reverse geocode API (free Nominatim, zero Google Maps cost)
      const res = await locationAPI.reverseGeocode(latitude, longitude);
      const backendData = res?.data?.data || {};
      let result = null;
      if (backendData.results && Array.isArray(backendData.results) && backendData.results.length > 0) {
        result = backendData.results[0];
      } else {
        result = backendData;
      }

      if (!result) {
        throw new Error("Backend reverse geocode returned no results");
      }

      const addrComp = result.address_components || {};
      const formattedAddress = result.formatted_address || `${latitude}, ${longitude}`;
      const city = addrComp.city || "";
      const state = addrComp.state || "";
      const area = addrComp.area || "";
      const road = addrComp.road || "";
      const building = addrComp.building || "";

      let mainTitle = building || area || city || "Location Found";
      let displayAddress = formattedAddress;

      // Build short display from formatted_address (take first meaningful parts)
      const parts = formattedAddress.split(",").map(p => p.trim()).filter(p => p.length > 0);
      if (parts.length >= 3) {
        // Show first 2-3 parts as display
        const displayParts = parts.slice(0, Math.min(3, parts.length - 2));
        displayAddress = displayParts.join(", ");
      }

      return {
        city: city,
        state: state,
        area: area || city || "Location Found",
        address: displayAddress,
        formattedAddress: formattedAddress,
        street: road,
        streetNumber: "",
        postalCode: addrComp.postcode || "",
        mainTitle: mainTitle !== "Location Found" ? mainTitle : null,
        pointOfInterest: building || null,
        premise: null,
        placeId: null,
        placeName: building || null,
        phone: null,
        website: null,
        rating: null,
        openingHours: null,
        photos: null,
        hasPlaceDetails: false,
        placeTypes: []
      };
    } catch (backendError) {
      console.warn("Backend reverse geocode failed, trying direct Nominatim:", backendError.message);

      // Direct Nominatim fallback (still free)
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=en&zoom=18`,
          { headers: { "User-Agent": "Tifunbox-App/1.0" } }
        );
        const data = await resp.json();
        if (!data || data.error) throw new Error("Nominatim returned no results");

        const addr = data.address || {};
        const nCity = addr.city || addr.town || addr.village || addr.municipality || "";
        const nState = addr.state || "";
        const nArea = addr.suburb || addr.neighbourhood || addr.quarter || "";
        const nRoad = addr.road || "";
        const nBuilding = addr.building || addr.amenity || addr.shop || "";
        const nMainTitle = nBuilding || nArea || nCity || "Location Found";
        const nFormatted = data.display_name || `${latitude}, ${longitude}`;

        return {
          city: nCity,
          state: nState,
          area: nArea || nCity || "Location Found",
          address: nFormatted.split(",").slice(0, 3).map(p => p.trim()).join(", "),
          formattedAddress: nFormatted,
          street: nRoad,
          streetNumber: "",
          postalCode: addr.postcode || "",
          mainTitle: nMainTitle !== "Location Found" ? nMainTitle : null,
          pointOfInterest: nBuilding || null,
          premise: null,
          placeId: null,
          placeName: nBuilding || null,
          phone: null,
          website: null,
          rating: null,
          openingHours: null,
          photos: null,
          hasPlaceDetails: false,
          placeTypes: []
        };
      } catch (nominatimError) {
        console.error("Direct Nominatim fallback also failed:", nominatimError.message);
        return reverseGeocodeDirect(latitude, longitude);
      }
    }
  };

  // REMOVED: ~700 lines of old Google Maps + Places API code
  // Now using free Nominatim (OpenStreetMap) via backend API

  /* ===================== OLA MAPS REVERSE GEOCODE (DEPRECATED - KEPT FOR FALLBACK) ===================== */
  const reverseGeocodeWithOLAMaps = async (latitude, longitude) => {
    try {
      console.log("ðŸ” Fetching address from OLA Maps for:", latitude, longitude)

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OLA Maps API timeout")), 10000)
      )

      const apiPromise = locationAPI.reverseGeocode(latitude, longitude)
      const res = await Promise.race([apiPromise, timeoutPromise])

      // Log full response for debugging
      console.log("ðŸ“¦ Full OLA Maps API Response:", JSON.stringify(res?.data, null, 2))

      // Check if response is valid
      if (!res || !res.data) {
        throw new Error("Invalid response from OLA Maps API")
      }

      // Check if API call was successful
      if (res.data.success === false) {
        throw new Error(res.data.message || "OLA Maps API returned error")
      }

      // Backend returns: { success: true, data: { results: [{ formatted_address, address_components: { city, state, country, area } }] } }
      const backendData = res?.data?.data || {}

      // Debug: Check backend data structure
      console.log("ðŸ” Backend data structure:", {
        hasResults: !!backendData.results,
        hasResult: !!backendData.result,
        keys: Object.keys(backendData),
        dataType: typeof backendData,
        backendData: JSON.stringify(backendData, null, 2).substring(0, 500) // First 500 chars
      })

      // Handle different OLA Maps response structures
      // Backend processes OLA Maps response and returns: { results: [{ formatted_address, address_components: { city, state, area } }] }
      let result = null;
      if (backendData.results && Array.isArray(backendData.results) && backendData.results.length > 0) {
        result = backendData.results[0];
        console.log("âœ… Using results[0] from backend")
      } else if (backendData.result && Array.isArray(backendData.result) && backendData.result.length > 0) {
        result = backendData.result[0];
        console.log("âœ… Using result[0] from backend")
      } else if (backendData.results && !Array.isArray(backendData.results)) {
        result = backendData.results;
        console.log("âœ… Using results object from backend")
      } else {
        result = backendData;
        console.log("âš ï¸ Using backendData directly (fallback)")
      }

      if (!result) {
        console.warn("âš ï¸ No result found in backend data")
        result = {};
      }

      console.log("ðŸ“¦ Parsed result:", {
        hasFormattedAddress: !!result.formatted_address,
        hasAddressComponents: !!result.address_components,
        formattedAddress: result.formatted_address,
        addressComponents: result.address_components
      })

      // Extract address_components - handle both object and array formats
      let addressComponents = {};
      if (result.address_components) {
        if (Array.isArray(result.address_components)) {
          // Google Maps style array
          result.address_components.forEach(comp => {
            const types = comp.types || [];
            if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
              addressComponents.area = comp.long_name || comp.short_name;
            } else if (types.includes('neighborhood') && !addressComponents.area) {
              addressComponents.area = comp.long_name || comp.short_name;
            } else if (types.includes('locality')) {
              addressComponents.city = comp.long_name || comp.short_name;
            } else if (types.includes('administrative_area_level_1')) {
              addressComponents.state = comp.long_name || comp.short_name;
            } else if (types.includes('country')) {
              addressComponents.country = comp.long_name || comp.short_name;
            }
          });
        } else {
          // Object format
          addressComponents = result.address_components;
        }
      } else if (result.components) {
        addressComponents = result.components;
      }

      console.log("ðŸ“¦ Parsed result structure:", {
        result,
        addressComponents,
        hasArrayComponents: Array.isArray(result.address_components),
        hasObjectComponents: !Array.isArray(result.address_components) && !!result.address_components
      })

      // Extract address details - try multiple possible response structures
      let city = addressComponents?.city ||
        result?.city ||
        result?.locality ||
        result?.address_components?.city ||
        ""

      let state = addressComponents?.state ||
        result?.state ||
        result?.administrative_area_level_1 ||
        result?.address_components?.state ||
        ""

      let country = addressComponents?.country ||
        result?.country ||
        result?.country_name ||
        result?.address_components?.country ||
        ""

      let formattedAddress = result?.formatted_address ||
        result?.formattedAddress ||
        result?.address ||
        ""

      // PRIORITY 1: Extract area from formatted_address FIRST (most reliable for Indian addresses)
      // Indian address format: "Area, City, State" e.g., "New Palasia, Indore, Madhya Pradesh"
      // ALWAYS try formatted_address FIRST - it's the most reliable source and preserves full names like "New Palasia"
      let area = ""
      if (formattedAddress) {
        const addressParts = formattedAddress.split(',').map(part => part.trim()).filter(part => part.length > 0)

        console.log("ðŸ” Parsing formatted address for area:", { formattedAddress, addressParts, city, state, currentArea: area })

        // ZOMATO-STYLE: If we have 3+ parts, first part is ALWAYS the area/locality
        // Format: "New Palasia, Indore, Madhya Pradesh" -> area = "New Palasia"
        if (addressParts.length >= 3) {
          const firstPart = addressParts[0]
          const secondPart = addressParts[1] // Usually city
          const thirdPart = addressParts[2]  // Usually state

          // First part is the area (e.g., "New Palasia")
          // Second part is usually city (e.g., "Indore")
          // Third part is usually state (e.g., "Madhya Pradesh")
          if (firstPart && firstPart.length > 2 && firstPart.length < 50) {
            // Make sure first part is not the same as city or state
            const firstLower = firstPart.toLowerCase()
            const cityLower = (city || secondPart || "").toLowerCase()
            const stateLower = (state || thirdPart || "").toLowerCase()

            if (firstLower !== cityLower &&
              firstLower !== stateLower &&
              !firstPart.match(/^\d+/) && // Not a number
              !firstPart.match(/^\d+\s*(km|m|meters?)$/i) && // Not a distance
              !firstLower.includes("district") && // Not a district name
              !firstLower.includes("city")) { // Not a city name
              area = firstPart
              console.log("âœ…âœ…âœ… EXTRACTED AREA from formatted address (3+ parts):", area)

              // Also update city if second part matches better
              if (secondPart && (!city || secondPart.toLowerCase() !== city.toLowerCase())) {
                city = secondPart
              }
              // Also update state if third part matches better
              if (thirdPart && (!state || thirdPart.toLowerCase() !== state.toLowerCase())) {
                state = thirdPart
              }
            }
          }
        } else if (addressParts.length === 2 && !area) {
          // Two parts: Could be "Area, City" or "City, State"
          const firstPart = addressParts[0]
          const secondPart = addressParts[1]

          // Check if first part is city (if we already have city name)
          const isFirstCity = city && firstPart.toLowerCase() === city.toLowerCase()

          // If first part is NOT the city, it's likely the area
          if (!isFirstCity &&
            firstPart.length > 2 &&
            firstPart.length < 50 &&
            !firstPart.toLowerCase().includes("district") &&
            !firstPart.toLowerCase().includes("city") &&
            !firstPart.match(/^\d+/)) {
            area = firstPart
            console.log("âœ… Extracted area from 2 part address:", area)
            // Update city if second part exists
            if (secondPart && !city) {
              city = secondPart
            }
          } else if (isFirstCity) {
            // First part is city, second part might be state
            // No area in this case, but update state if needed
            if (secondPart && !state) {
              state = secondPart
            }
          }
        } else if (addressParts.length === 1 && !area) {
          // Single part - could be just city or area
          const singlePart = addressParts[0]
          if (singlePart && singlePart.length > 2 && singlePart.length < 50) {
            // If it doesn't match city exactly, it might be an area
            if (!city || singlePart.toLowerCase() !== city.toLowerCase()) {
              // Don't use as area if it looks like a city name (contains common city indicators)
              if (!singlePart.toLowerCase().includes("city") &&
                !singlePart.toLowerCase().includes("district")) {
                // Could be area, but be cautious - only use if we're sure
                console.log("âš ï¸ Single part address - ambiguous, not using as area:", singlePart)
              }
            }
          }
        }
      }

      // PRIORITY 2: If still no area from formatted_address, try from address_components (fallback)
      // Note: address_components might have incomplete/truncated names like "Palacia" instead of "New Palasia"
      // So we ALWAYS prefer formatted_address extraction over address_components
      if (!area && addressComponents) {
        // Try all possible area fields (but exclude state and generic names!)
        const possibleAreaFields = [
          addressComponents.sublocality,
          addressComponents.sublocality_level_1,
          addressComponents.neighborhood,
          addressComponents.sublocality_level_2,
          addressComponents.locality,
          addressComponents.area, // Check area last
        ].filter(field => {
          // Filter out invalid/generic area names
          if (!field) return false
          const fieldLower = field.toLowerCase()
          return fieldLower !== state.toLowerCase() &&
            fieldLower !== city.toLowerCase() &&
            !fieldLower.includes("district") &&
            !fieldLower.includes("city") &&
            field.length > 3 // Minimum length
        })

        if (possibleAreaFields.length > 0) {
          const fallbackArea = possibleAreaFields[0]
          // CRITICAL: If formatted_address exists and has a different area, prefer formatted_address
          // This ensures "New Palasia" from formatted_address beats "Palacia" from address_components
          if (formattedAddress && formattedAddress.toLowerCase().includes(fallbackArea.toLowerCase())) {
            // formatted_address contains the fallback area, so it's likely more complete
            // Try one more time to extract from formatted_address
            console.log("âš ï¸ address_components has area but formatted_address might have full name, re-checking formatted_address")
          } else {
            area = fallbackArea
            console.log("âœ… Extracted area from address_components (fallback):", area)
          }
        }
      }

      // Also check address_components array structure (Google Maps style)
      if (!area && result?.address_components && Array.isArray(result.address_components)) {
        const components = result.address_components
        // Find sublocality or neighborhood in the components array
        const sublocality = components.find(comp =>
          comp.types?.includes('sublocality') ||
          comp.types?.includes('sublocality_level_1') ||
          comp.types?.includes('neighborhood')
        )
        if (sublocality?.long_name || sublocality?.short_name) {
          area = sublocality.long_name || sublocality.short_name
        }
      }

      // FINAL FALLBACK: If area is still empty, force extract from formatted_address
      // This is the last resort - be very aggressive (ZOMATO-STYLE)
      // Even if formatted_address only has 2 parts (City, State), try to extract area
      if (!area && formattedAddress) {
        const parts = formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)
        console.log("ðŸ” Final fallback: Parsing formatted_address for area", { parts, city, state })

        if (parts.length >= 2) {
          const potentialArea = parts[0]
          // Very lenient check - if it's not obviously city/state, use it as area
          const potentialAreaLower = potentialArea.toLowerCase()
          const cityLower = (city || "").toLowerCase()
          const stateLower = (state || "").toLowerCase()

          if (potentialArea &&
            potentialArea.length > 2 &&
            potentialArea.length < 50 &&
            !potentialArea.match(/^\d+/) &&
            potentialAreaLower !== cityLower &&
            potentialAreaLower !== stateLower &&
            !potentialAreaLower.includes("district") &&
            !potentialAreaLower.includes("city")) {
            area = potentialArea
            console.log("âœ…âœ…âœ… FORCE EXTRACTED area (final fallback):", area)
          }
        }
      }

      // Final validation and logging
      console.log("âœ…âœ…âœ… FINAL PARSED OLA Maps response:", {
        city,
        state,
        country,
        area,
        formattedAddress,
        hasArea: !!area,
        areaLength: area?.length || 0
      })

      // CRITICAL: If formattedAddress has only 2 parts, OLA Maps didn't provide sublocality
      // Try to get more detailed location using coordinates-based search
      if (!area && formattedAddress) {
        const parts = formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)

        // If we have 3+ parts, extract area from first part
        if (parts.length >= 3) {
          // ZOMATO PATTERN: "New Palasia, Indore, Madhya Pradesh"
          // First part = Area, Second = City, Third = State
          const potentialArea = parts[0]
          // Validate it's not state, city, or generic names
          const potentialAreaLower = potentialArea.toLowerCase()
          if (potentialAreaLower !== state.toLowerCase() &&
            potentialAreaLower !== city.toLowerCase() &&
            !potentialAreaLower.includes("district") &&
            !potentialAreaLower.includes("city")) {
            area = potentialArea
            if (!city && parts[1]) city = parts[1]
            if (!state && parts[2]) state = parts[2]
            console.log("âœ…âœ…âœ… ZOMATO-STYLE EXTRACTION:", { area, city, state })
          }
        } else if (parts.length === 2) {
          // Only 2 parts: "Indore, Madhya Pradesh" - area is missing
          // OLA Maps API didn't provide sublocality
          console.warn("âš ï¸ Only 2 parts in address - OLA Maps didn't provide sublocality")
          // Try to extract from other fields in the response
          // Check if result has any other location fields
          if (result.locality && result.locality !== city) {
            area = result.locality
            console.log("âœ… Using locality as area:", area)
          } else if (result.neighborhood) {
            area = result.neighborhood
            console.log("âœ… Using neighborhood as area:", area)
          } else {
            // Leave area empty - will show city instead
            area = ""
          }
        }
      }

      // FINAL VALIDATION: Never use state as area!
      if (area && state && area.toLowerCase() === state.toLowerCase()) {
        console.warn("âš ï¸âš ï¸âš ï¸ REJECTING area (same as state):", area)
        area = ""
      }

      // FINAL VALIDATION: Reject district names
      if (area && area.toLowerCase().includes("district")) {
        console.warn("âš ï¸âš ï¸âš ï¸ REJECTING area (contains district):", area)
        area = ""
      }

      // If we have a valid formatted address or city, return it
      if (formattedAddress || city) {
        const finalLocation = {
          city: city || "",
          state: state || "",
          country: country || "",
          area: area || "", // Area is CRITICAL - must be extracted
          address: formattedAddress || `${city || "Current Location"}`,
          formattedAddress: formattedAddress || `${city || "Current Location"}`,
        }

        console.log("âœ…âœ…âœ… RETURNING LOCATION DATA:", finalLocation)
        return finalLocation
      }

      // If no valid data, throw to trigger fallback
      throw new Error("No valid address data from OLA Maps")
    } catch (err) {
      console.warn("âš ï¸ Google Maps failed, trying direct geocoding:", err.message)
      // Fallback to direct reverse geocoding (no Google Maps dependency)
      try {
        return await reverseGeocodeWithGoogleMaps(latitude, longitude)
      } catch (fallbackErr) {
        // If all fail, return minimal location data
        console.error("âŒ All reverse geocoding failed:", fallbackErr)
        return {
          city: "Current Location",
          address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        }
      }
    }
  }

  /* ===================== DB FETCH ===================== */
  const fetchLocationFromDB = async () => {
    try {
      // Check if user is authenticated before trying to fetch from DB
      const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken')
      if (!userToken || userToken === 'null' || userToken === 'undefined') {
        // User not logged in - skip DB fetch, return null to use localStorage
        return null
      }

      const res = await userAPI.getLocation()
      const loc = res?.data?.data?.location
      if (loc?.latitude && loc?.longitude) {
        // Validate coordinates are in India range BEFORE attempting geocoding
        const isInIndiaRange = loc.latitude >= 6.5 && loc.latitude <= 37.1 && loc.longitude >= 68.7 && loc.longitude <= 97.4 && loc.longitude > 0

        if (!isInIndiaRange || loc.longitude < 0) {
          // Coordinates are outside India - return placeholder
          console.warn("âš ï¸ Coordinates from DB are outside India range:", { latitude: loc.latitude, longitude: loc.longitude })
          return {
            latitude: loc.latitude,
            longitude: loc.longitude,
            city: "Current Location",
            state: "",
            country: "",
            area: "",
            address: "Select location",
            formattedAddress: "Select location",
          }
        }

        try {
          const addr = await reverseGeocodeWithGoogleMaps(
            loc.latitude,
            loc.longitude
          )
          return { ...addr, latitude: loc.latitude, longitude: loc.longitude }
        } catch (geocodeErr) {
          // If reverse geocoding fails, return location without coordinates in address
          console.warn("âš ï¸ Reverse geocoding failed in fetchLocationFromDB:", geocodeErr.message)
          return {
            latitude: loc.latitude,
            longitude: loc.longitude,
            city: "Current Location",
            area: "",
            state: "",
            address: "Select location", // Don't show coordinates
            formattedAddress: "Select location", // Don't show coordinates
          }
        }
      }
    } catch (err) {
      // Silently fail for 404/401 (user not authenticated) or network errors
      if (err.code !== "ERR_NETWORK" && err.response?.status !== 404 && err.response?.status !== 401) {
        console.error("DB location fetch error:", err)
      }
    }
    return null
  }

  /* ===================== MAIN LOCATION ===================== */
  const getLocation = async (updateDB = true, forceFresh = false, showLoading = false) => {
    // If not forcing fresh, try DB first (faster)
    let dbLocation = !forceFresh ? await fetchLocationFromDB() : null
    if (dbLocation && !forceFresh) {
      setLocation(dbLocation)
      if (showLoading) setLoading(false)
      return dbLocation
    }

    if (!navigator.geolocation) {
      setError("Geolocation not supported")
      if (showLoading) setLoading(false)
      return dbLocation
    }

    // Helper function to get position with retry mechanism
    const getPositionWithRetry = (options, retryCount = 0) => {
      return new Promise((resolve, reject) => {
        const isRetry = retryCount > 0
        console.log(`ðŸ“ Requesting location${isRetry ? ' (retry with lower accuracy)' : ' (high accuracy)'}...`)
        console.log(`ðŸ“ Force fresh: ${forceFresh ? 'YES' : 'NO'}, maximumAge: ${options.maximumAge || (forceFresh ? 0 : 60000)}`)

        // Use cached location if available and not too old (faster response)
        // If forceFresh is true, don't use cache (maximumAge: 0)
        const cachedOptions = {
          ...options,
          maximumAge: forceFresh ? 0 : (options.maximumAge || 60000), // If forceFresh, get fresh location
        }

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const { latitude, longitude, accuracy } = pos.coords
              const timestamp = pos.timestamp || Date.now()

              console.log(`âœ… Got location${isRetry ? ' (lower accuracy)' : ' (high accuracy)'}:`, {
                latitude,
                longitude,
                accuracy: `${accuracy}m`,
                timestamp: new Date(timestamp).toISOString(),
                coordinates: `${latitude.toFixed(8)}, ${longitude.toFixed(8)}`
              })

              // Validate coordinates are in India range BEFORE attempting geocoding
              // India: Latitude 6.5Â° to 37.1Â° N, Longitude 68.7Â° to 97.4Â° E
              const isInIndiaRange = latitude >= 6.5 && latitude <= 37.1 && longitude >= 68.7 && longitude <= 97.4 && longitude > 0

              // Get address from Google Maps API
              let addr
              if (!isInIndiaRange || longitude < 0) {
                // Coordinates are outside India - skip geocoding and use placeholder
                console.warn("âš ï¸ Coordinates outside India range, skipping geocoding:", { latitude, longitude })
                addr = {
                  city: "Current Location",
                  state: "",
                  country: "",
                  area: "",
                  address: "Select location",
                  formattedAddress: "Select location",
                }
              } else {
                console.log("ðŸ” Calling reverse geocode with coordinates:", { latitude, longitude })
                try {
                  // Try Google Maps first
                  addr = await reverseGeocodeWithGoogleMaps(latitude, longitude)
                  console.log("âœ… Google Maps geocoding successful:", addr)
                } catch (geocodeErr) {
                  console.warn("âš ï¸ Google Maps geocoding failed, trying fallback:", geocodeErr.message)
                  try {
                  // Fallback to direct reverse geocode (local minimal address)
                    addr = await reverseGeocodeDirect(latitude, longitude)
                    console.log("âœ… Fallback geocoding successful:", addr)

                    // Validate fallback result - if it still has placeholder values, don't use it
                    if (addr.city === "Current Location" || addr.address.includes(latitude.toFixed(4))) {
                      console.warn("âš ï¸ Fallback geocoding returned placeholder, will not save")
                      addr = {
                        city: "Current Location",
                        state: "",
                        country: "",
                        area: "",
                        address: "Select location",
                        formattedAddress: "Select location",
                      }
                    }
                  } catch (fallbackErr) {
                    console.error("âŒ All geocoding methods failed:", fallbackErr.message)
                    addr = {
                      city: "Current Location",
                      state: "",
                      country: "",
                      area: "",
                      address: "Select location",
                      formattedAddress: "Select location",
                    }
                  }
                }
              }
              console.log("âœ… Reverse geocode result:", addr)

              // Ensure we don't use coordinates as address if we have area/city
              // Keep the complete formattedAddress from Google Maps (it has all details)
              const completeFormattedAddress = addr.formattedAddress || "";
              let displayAddress = addr.address || "";

              // If address contains coordinates pattern, use area/city instead
              const isCoordinatesPattern = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(displayAddress.trim());
              if (isCoordinatesPattern) {
                if (addr.area && addr.area.trim() !== "") {
                  displayAddress = addr.area;
                } else if (addr.city && addr.city.trim() !== "" && addr.city !== "Unknown City") {
                  displayAddress = addr.city;
                }
              }

              // Build location object with ALL fields from reverse geocoding
              const finalLoc = {
                ...addr, // This includes: city, state, area, street, streetNumber, postalCode, formattedAddress
                latitude,
                longitude,
                accuracy: accuracy || null,
                address: displayAddress, // Locality parts for navbar display
                formattedAddress: completeFormattedAddress || addr.formattedAddress || displayAddress // Complete detailed address
              }

              // Check if location has placeholder values - don't save placeholders
              const hasPlaceholder =
                finalLoc.city === "Current Location" ||
                finalLoc.address === "Select location" ||
                finalLoc.formattedAddress === "Select location" ||
                (!finalLoc.city && !finalLoc.address && !finalLoc.formattedAddress && !finalLoc.area);

              if (hasPlaceholder) {
                console.warn("âš ï¸ Skipping save - location contains placeholder values:", finalLoc)
                // Don't save placeholder values to localStorage or DB
                // Just set in state for display but don't persist
                const coordOnlyLoc = {
                  latitude,
                  longitude,
                  accuracy: accuracy || null,
                  city: finalLoc.city,
                  address: finalLoc.address,
                  formattedAddress: finalLoc.formattedAddress
                }
                setLocation(coordOnlyLoc)
                setPermissionGranted(true)
                if (showLoading) setLoading(false)
                setError(null)
                lastGeocodeApiCoordsRef.current = { latitude, longitude }
                resolve(coordOnlyLoc)
                return
              }

              console.log("ðŸ’¾ Saving location:", finalLoc)
              localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(finalLoc))
              setStoredLocationMode("current")
              setLocation(finalLoc)
              setPermissionGranted(true)
              if (showLoading) setLoading(false)
              setError(null)
              dispatchLocationUpdated(finalLoc)
              lastGeocodeApiCoordsRef.current = { latitude, longitude }

              if (updateDB) {
                await updateLocationInDB(finalLoc).catch(err => {
                  console.warn("Failed to update location in DB:", err)
                })
              }
              resolve(finalLoc)
            } catch (err) {
              console.error("âŒ Error processing location:", err)
              // Try one more time with direct reverse geocode as last resort
              const { latitude, longitude } = pos.coords

              try {
                console.log("ðŸ”„ Last attempt: trying direct reverse geocode...")
                const lastResortAddr = await reverseGeocodeDirect(latitude, longitude)

                // Check if we got valid data (not just coordinates)
                if (lastResortAddr &&
                  lastResortAddr.city !== "Current Location" &&
                  !lastResortAddr.address.includes(latitude.toFixed(4)) &&
                  lastResortAddr.formattedAddress &&
                  !lastResortAddr.formattedAddress.includes(latitude.toFixed(4))) {
                  const lastResortLoc = {
                    ...lastResortAddr,
                    latitude,
                    longitude,
                    accuracy: pos.coords.accuracy || null
                  }
                  console.log("âœ… Last resort geocoding succeeded:", lastResortLoc)
                  localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(lastResortLoc))
                  setStoredLocationMode("current")
                  setLocation(lastResortLoc)
                  setPermissionGranted(true)
                  if (showLoading) setLoading(false)
                  setError(null)
                  dispatchLocationUpdated(lastResortLoc)
                  lastGeocodeApiCoordsRef.current = { latitude, longitude }
                  if (updateDB) await updateLocationInDB(lastResortLoc).catch(() => { })
                  resolve(lastResortLoc)
                  return
                } else {
                  console.warn("âš ï¸ Last resort geocoding returned invalid data:", lastResortAddr)
                }
              } catch (lastErr) {
                console.error("âŒ Last resort geocoding also failed:", lastErr.message)
              }

              // If all geocoding fails, use placeholder but don't save
              const fallbackLoc = {
                latitude,
                longitude,
                city: "Current Location",
                area: "",
                state: "",
                address: "Select location", // Don't show coordinates
                formattedAddress: "Select location", // Don't show coordinates
              }
              // Don't save placeholder values to localStorage
              // Only set in state for display
              console.warn("âš ï¸ Skipping save - all geocoding failed, using placeholder")
              setLocation(fallbackLoc)
              setPermissionGranted(true)
              if (showLoading) setLoading(false)
              // Don't try to update DB with placeholder
              resolve(fallbackLoc)
            }
          },
          async (err) => {
            // If timeout and we haven't retried yet, try with lower accuracy
            if (err.code === 3 && retryCount === 0 && options.enableHighAccuracy) {
              console.warn("â±ï¸ High accuracy timeout, retrying with lower accuracy...")
              // Retry with lower accuracy - faster response (uses network-based location)
              getPositionWithRetry({
                enableHighAccuracy: false,
                timeout: 5000,  // 5 seconds for lower accuracy (network-based is faster)
                maximumAge: 300000 // Allow 5 minute old cached location for instant response
              }, 1).then(resolve).catch(reject)
              return
            }

            // Don't log timeout errors as errors - they're expected in some cases
            if (err.code === 3) {
              console.warn("â±ï¸ Geolocation timeout (code 3) - using fallback location")
            } else {
              console.error("âŒ Geolocation error:", err.code, err.message)
            }
            // Try multiple fallback strategies
            try {
              // Strategy 1: Use DB location if available
              let fallback = dbLocation
              if (!fallback) {
                fallback = await fetchLocationFromDB()
              }

              // Strategy 2: Use cached location from localStorage
              if (!fallback) {
                const stored = localStorage.getItem("userLocation")
                if (stored) {
                  try {
                    fallback = JSON.parse(stored)
                    console.log("âœ… Using cached location from localStorage")
                  } catch (parseErr) {
                    console.warn("âš ï¸ Failed to parse stored location:", parseErr)
                  }
                }
              }

              if (fallback) {
                console.log("âœ… Using fallback location:", fallback)
                setLocation(fallback)
                // Don't set error for timeout when we have fallback
                if (err.code !== 3) {
                  setError(err.message)
                }
                setPermissionGranted(true) // Still grant permission if we have location
                if (showLoading) setLoading(false)
                resolve(fallback)
              } else {
                // No fallback available - set a default location so UI doesn't hang
                console.warn("âš ï¸ No fallback location available, setting default")
                const defaultLocation = {
                  city: "Select location",
                  address: "Select location",
                  formattedAddress: "Select location"
                }
                setLocation(defaultLocation)
                setError(err.code === 3 ? "Location request timed out. Please try again." : err.message)
                setPermissionGranted(false)
                if (showLoading) setLoading(false)
                resolve(defaultLocation) // Always resolve with something
              }
            } catch (fallbackErr) {
              console.warn("âš ï¸ Fallback retrieval failed:", fallbackErr)
              setLocation(null)
              setError(err.code === 3 ? "Location request timed out. Please try again." : err.message)
              setPermissionGranted(false)
              if (showLoading) setLoading(false)
              resolve(null)
            }
          },
          options
        )
      })
    }

    // Try with high accuracy first
    // If forceFresh is true, don't use cached location (maximumAge: 0)
    // Otherwise, allow cached location for faster response
    return getPositionWithRetry({
      enableHighAccuracy: true,  // Use GPS for exact location (highest accuracy)
      timeout: 15000,            // 15 seconds timeout (gives GPS more time to get accurate fix)
      maximumAge: forceFresh ? 0 : 60000  // If forceFresh, get fresh location. Otherwise allow 1 minute cache
    })
  }

  /* ===================== WATCH LOCATION ===================== */
  const startWatchingLocation = () => {
    if (getStoredLocationMode() === "manual") {
      console.log("📍 Manual location selected - skipping live geolocation watcher")
      return
    }

    if (!navigator.geolocation) {
      console.warn("âš ï¸ Geolocation not supported")
      return
    }

    // Clear any existing watch
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    console.log("ðŸ‘€ Starting to watch location for live updates...")

    let retryCount = 0
    const maxRetries = 2

    const startWatch = (options) => {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          try {
            if (getStoredLocationMode() === "manual") {
              stopWatchingLocation()
              return
            }

            const { latitude, longitude, accuracy } = pos.coords

            // Reset retry count on success
            retryCount = 0

            const lastGeo = lastGeocodeApiCoordsRef.current
            if (
              lastGeo?.latitude != null &&
              lastGeo?.longitude != null &&
              haversineDistanceMeters(lastGeo.latitude, lastGeo.longitude, latitude, longitude) <
                MIN_MOVE_METERS_FOR_LOCATION_API
            ) {
              // Browser still emits many watchPosition events (GPS drift, accuracy refresh).
              // We intentionally skip reverse geocode + DB until movement ≥ MIN_MOVE_METERS_FOR_LOCATION_API.
              return
            }

            if (IS_DEV) {
              console.log("ðŸ“ Location moved ≥80m (or first fix) — reverse geocoding / APIs:", {
                latitude,
                longitude,
                accuracy: `${accuracy}m`,
              })
            }

            // Validate coordinates are in India range BEFORE attempting geocoding
            // India: Latitude 6.5Â° to 37.1Â° N, Longitude 68.7Â° to 97.4Â° E
            const isInIndiaRange = latitude >= 6.5 && latitude <= 37.1 && longitude >= 68.7 && longitude <= 97.4 && longitude > 0

            // Get address from Google Maps API with error handling
            let addr
            if (!isInIndiaRange || longitude < 0) {
              // Coordinates are outside India - skip geocoding and use placeholder
              console.warn("âš ï¸ Coordinates outside India range, skipping geocoding:", { latitude, longitude })
              addr = {
                city: "Current Location",
                state: "",
                country: "",
                area: "",
                address: "Select location",
                formattedAddress: "Select location",
              }
            } else {
              try {
                addr = await reverseGeocodeWithGoogleMaps(latitude, longitude)
                console.log("âœ… Reverse geocoding successful:", {
                  city: addr.city,
                  area: addr.area,
                  formattedAddress: addr.formattedAddress
                })
              } catch (geocodeErr) {
                console.error("âŒ Google Maps reverse geocoding failed:", geocodeErr.message)
                // Try fallback geocoding
                try {
                  console.log("ðŸ”„ Trying fallback geocoding...")
                  addr = await reverseGeocodeDirect(latitude, longitude)
                  console.log("âœ… Fallback geocoding successful:", {
                    city: addr.city,
                    area: addr.area
                  })
                } catch (fallbackErr) {
                  console.error("âŒ Fallback geocoding also failed:", fallbackErr.message)
                  // Don't use coordinates - use placeholder instead
                  addr = {
                    city: "Current Location",
                    state: "",
                    country: "",
                    area: "",
                    address: "Select location", // Don't show coordinates
                    formattedAddress: "Select location", // Don't show coordinates
                  }
                }
              }
            }

            // CRITICAL: Ensure formattedAddress is NEVER coordinates
            // Check if reverse geocoding returned proper address or just coordinates
            let completeFormattedAddress = addr.formattedAddress || "";
            let displayAddress = addr.address || "";

            // Check if formattedAddress is coordinates pattern
            const isFormattedAddressCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(completeFormattedAddress.trim());
            const isDisplayAddressCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(displayAddress.trim());

            // If formattedAddress is coordinates, it means reverse geocoding failed
            // Build proper address from components or use fallback
            if (isFormattedAddressCoordinates || !completeFormattedAddress || completeFormattedAddress === "Select location") {
              if (IS_DEV) {
                console.warn("âš ï¸âš ï¸âš ï¸ Reverse geocoding returned coordinates or empty address!")
                console.warn("âš ï¸ Attempting to build address from components:", {
                  city: addr.city,
                  state: addr.state,
                  area: addr.area,
                  street: addr.street,
                  streetNumber: addr.streetNumber
                })
              }

              // Build address from components
              const addressParts = [];
              if (addr.area && addr.area.trim() !== "") {
                addressParts.push(addr.area);
              }
              if (addr.city && addr.city.trim() !== "") {
                addressParts.push(addr.city);
              }
              if (addr.state && addr.state.trim() !== "") {
                addressParts.push(addr.state);
              }

              if (addressParts.length > 0) {
                completeFormattedAddress = addressParts.join(', ');
                displayAddress = addr.area || addr.city || "Select location";
                if (IS_DEV) {
                  console.log("âœ… Built address from components:", completeFormattedAddress);
                }
              } else {
                // Final fallback - don't use coordinates
                completeFormattedAddress = addr.city || "Select location";
                displayAddress = addr.city || "Select location";
                if (IS_DEV) {
                  console.warn("âš ï¸ Using fallback address:", completeFormattedAddress);
                }
              }
            }

            // Also check displayAddress
            if (isDisplayAddressCoordinates) {
              displayAddress = addr.area || addr.city || "Select location";
            }

            // Build location object with ALL fields from reverse geocoding
            // NEVER include coordinates in formattedAddress or address
            const loc = {
              ...addr, // This includes: city, state, area, street, streetNumber, postalCode
              latitude,
              longitude,
              accuracy: accuracy || null,
              address: displayAddress, // Locality parts for navbar display (NEVER coordinates)
              formattedAddress: completeFormattedAddress // Complete detailed address (NEVER coordinates)
            }

            // Final validation - ensure formattedAddress is never coordinates
            if (loc.formattedAddress && /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(loc.formattedAddress.trim())) {
              console.error("âŒâŒâŒ CRITICAL: formattedAddress is still coordinates! Replacing with city/area")
              loc.formattedAddress = loc.area || loc.city || "Select location";
              loc.address = loc.area || loc.city || "Select location";
            }

            // Check if location has placeholder values - don't save placeholders
            const hasPlaceholder =
              loc.city === "Current Location" ||
              loc.address === "Select location" ||
              loc.formattedAddress === "Select location" ||
              (!loc.city && !loc.address && !loc.formattedAddress && !loc.area);

            if (hasPlaceholder) {
              console.warn("âš ï¸ Skipping live location update - contains placeholder values:", loc)
              lastGeocodeApiCoordsRef.current = { latitude, longitude }
              return // Don't update location or save to DB
            }

            prevLocationCoordsRef.current = { latitude: loc.latitude, longitude: loc.longitude }
            lastGeocodeApiCoordsRef.current = { latitude: loc.latitude, longitude: loc.longitude }
            console.log("ðŸ’¾ Updating live location:", loc)
            localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(loc))
            setStoredLocationMode("current")
            setLocation(loc)
            setPermissionGranted(true)
            setError(null)
            dispatchLocationUpdated(loc)

            // Debounce DB updates - only update every 5 seconds
            clearTimeout(updateTimerRef.current)
            updateTimerRef.current = setTimeout(() => {
              updateLocationInDB(loc).catch(err => {
                console.warn("Failed to update location in DB:", err)
              })
            }, 5000)
          } catch (err) {
            console.error("âŒ Error processing live location update:", err)
            // If reverse geocoding fails, DON'T use coordinates - use placeholder
            const { latitude, longitude } = pos.coords
            const fallbackLoc = {
              latitude,
              longitude,
              city: "Current Location",
              area: "",
              state: "",
              address: "Select location", // NEVER use coordinates
              formattedAddress: "Select location", // NEVER use coordinates
            }
            console.warn("âš ï¸ Using fallback location (reverse geocoding failed):", fallbackLoc)
            // Don't save placeholder values to localStorage
            // Only set in state for display
            console.warn("âš ï¸ Skipping localStorage save - fallback location contains placeholder values")
            setLocation(fallbackLoc)
            setPermissionGranted(true)
          }
        },
        (err) => {
          // Don't log timeout errors for watchPosition (it's a background operation)
          // Only log non-timeout errors
          if (err.code !== 3) {
            console.warn("âš ï¸ Watch position error (non-timeout):", err.code, err.message)
          }

          // If timeout and we haven't exceeded max retries, retry with HIGH ACCURACY GPS
          // CRITICAL: Keep using GPS (not network-based) for accurate location
          // Network-based location won't give exact landmarks like "Mama Loca Cafe"
          if (err.code === 3 && retryCount < maxRetries) {
            retryCount++
            console.log(`â±ï¸ GPS timeout, retrying with high accuracy GPS (attempt ${retryCount}/${maxRetries})...`)

            // Clear current watch
            if (watchIdRef.current) {
              navigator.geolocation.clearWatch(watchIdRef.current)
              watchIdRef.current = null
            }

            // Retry with HIGH ACCURACY GPS (don't use network-based location)
            // Network-based location is less accurate and won't give exact landmarks
            setTimeout(() => {
              startWatch({
                enableHighAccuracy: true,   // Keep using GPS (not network-based)
                timeout: 20000,              // 20 seconds timeout (give GPS more time)
                maximumAge: 0                // Always get fresh GPS location
              })
            }, 3000) // 3 second delay before retry
            return
          }

          // If all retries failed, silently continue - don't set error state for background watch
          // The watch will keep trying in background, user won't notice
          // Only set error for non-timeout errors that are critical
          if (err.code !== 3) {
            setError(err.message)
            setPermissionGranted(false)
          }

          // Don't clear the watch - let it keep trying in background
          // The user might move to a location with better GPS signal
        },
        options
      )
    }

    // Start with HIGH ACCURACY GPS for live location tracking
    // CRITICAL: enableHighAccuracy: true forces GPS (not network-based) for accurate location
    // Network-based location won't give exact landmarks like "Mama Loca Cafe"
    startWatch({
      enableHighAccuracy: true,   // CRITICAL: Use GPS (not network-based) for accurate location
      timeout: 15000,             // 15 seconds timeout (gives GPS more time to get accurate fix)
      maximumAge: 0               // Always get fresh GPS location (no cache for live tracking)
    })

    console.log("âœ…âœ…âœ… GPS High Accuracy enabled for live location tracking")
    console.log("âœ… GPS will provide accurate coordinates for reverse geocoding")
    console.log("âœ… Network-based location disabled (less accurate)")
  }

  const stopWatchingLocation = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    clearTimeout(updateTimerRef.current)
  }

  /* ===================== INIT ===================== */
  useEffect(() => {
    // Load stored location first for IMMEDIATE display (no loading state)
    const stored = localStorage.getItem(USER_LOCATION_KEY)
    const storedLocationMode = getStoredLocationMode()
    let shouldForceRefresh = false
    let hasInitialLocation = false

    if (stored) {
      try {
        const parsedLocation = JSON.parse(stored)

        // Show cached location immediately (even if incomplete) - better UX
        // We'll refresh in background but user sees something right away
        // BUT: Skip if it's just placeholder values ("Select location" or "Current Location")
        if (parsedLocation &&
          (parsedLocation.latitude || parsedLocation.city) &&
          parsedLocation.formattedAddress !== "Select location" &&
          parsedLocation.city !== "Current Location") {
          setLocation(parsedLocation)
          setPermissionGranted(true)
          setLoading(false) // Set loading to false immediately
          hasInitialLocation = true
          if (parsedLocation.latitude != null && parsedLocation.longitude != null) {
            lastGeocodeApiCoordsRef.current = {
              latitude: parsedLocation.latitude,
              longitude: parsedLocation.longitude,
            }
          }
          console.log("ðŸ“‚ Loaded stored location instantly:", parsedLocation)

          // Check if we should refresh in background for better address
          const hasCompleteAddress = parsedLocation?.formattedAddress &&
            parsedLocation.formattedAddress !== "Select location" &&
            !parsedLocation.formattedAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/) &&
            parsedLocation.formattedAddress.split(',').length >= 4

          if (!hasCompleteAddress) {
            console.log("âš ï¸ Cached location incomplete, will refresh in background")
            shouldForceRefresh = true
          }
        } else {
          console.log("âš ï¸ Cached location is placeholder, will fetch fresh")
          shouldForceRefresh = true
        }
      } catch (err) {
        console.error("Failed to parse stored location:", err)
        shouldForceRefresh = true
      }
    }

    // If no cached location, try DB
    if (!hasInitialLocation) {
      fetchLocationFromDB()
        .then((dbLoc) => {
          if (dbLoc && (dbLoc.latitude || dbLoc.city)) {
            setLocation(dbLoc)
            setPermissionGranted(true)
            setLoading(false)
            hasInitialLocation = true
            if (dbLoc.latitude != null && dbLoc.longitude != null) {
              lastGeocodeApiCoordsRef.current = {
                latitude: dbLoc.latitude,
                longitude: dbLoc.longitude,
              }
            }
            console.log("ðŸ“‚ Loaded location from DB:", dbLoc)

            // Check if we should refresh for better address
            const hasCompleteAddress = dbLoc?.formattedAddress &&
              dbLoc.formattedAddress !== "Select location" &&
              !dbLoc.formattedAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/) &&
              dbLoc.formattedAddress.split(',').length >= 4

            if (!hasCompleteAddress) {
              shouldForceRefresh = true
            }
          } else {
            // No location found - set loading to false and show fallback
            setLoading(false)
            shouldForceRefresh = true
          }
        })
        .catch(() => {
          setLoading(false)
          shouldForceRefresh = true
        })
    }

    // Always ensure loading is false after initial check
    // Safety timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      setLoading((currentLoading) => {
        if (currentLoading) {
          console.warn("âš ï¸ Loading timeout - setting loading to false")
          // Only set fallback if we still don't have a location
          setLocation((currentLocation) => {
            if (!currentLocation ||
              (currentLocation.formattedAddress === "Select location" &&
                !currentLocation.latitude && !currentLocation.city)) {
              return {
                city: "Select location",
                address: "Select location",
                formattedAddress: "Select location"
              }
            }
            return currentLocation
          })
        }
        return false
      })
    }, 5000) // 5 second safety timeout (increased to allow background fetch to complete)

    // Don't set fallback immediately - wait for background fetch to complete
    // The background fetch will set the location, or we'll use the cached/DB location
    // Only set fallback if we have no location after all attempts

    // Request fresh location in BACKGROUND (non-blocking)
    // CRITICAL FIX: Only auto-request if permission is ALREADY granted
    // This prevents "Requests geolocation permission on page load" warning
    const checkPermissionAndStart = async () => {
      try {
        let permissionGranted = false;

        if (navigator.permissions && navigator.permissions.query) {
          try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            if (result.state === 'granted') {
              permissionGranted = true;
            } else {
              console.log(`ðŸ“ Geolocation permission is '${result.state}' - Waiting for user action (avoiding prompt on load)`);
            }
          } catch (permErr) {
            console.warn("âš ï¸ Permission query failed:", permErr);
          }
        } else {
          // Fallback for browsers without permissions API - assume not granted to be safe
          console.log("ðŸ“ Permissions API not available - Skipping auto-start");
        }

        // If permission NOT granted, and we don't have a specific user request (this is page load),
        // we should SKIP automatic fetching/watching to allow the user to choose when to enable it.
        // UNLESS we already have a valid initial location from localStorage/DB, in which case we might want to refresh?
        // Actually, even then, we shouldn't prompt.
        if (!permissionGranted) {
          // If we have an initial location, we are fine (it's displayed).
          // If we don't, we show "Select Location".
          // In either case, we avoid the PROMPT.
          // Ensure loading is false so UI doesn't hang
          setLoading(false);
          return;
        }

        console.log("ðŸš€ Permission granted! Fetching/Watching location...", shouldForceRefresh ? "(FORCE REFRESH)" : "");

        // Always fetch fresh location if we don't have a valid one
        // Check current location state to see if it's a placeholder
        const currentLocation = location
        const hasPlaceholder = currentLocation &&
          (currentLocation.formattedAddress === "Select location" ||
            currentLocation.city === "Current Location")

        const shouldFetch = shouldForceRefresh || !hasInitialLocation || hasPlaceholder

        if (shouldFetch) {
          console.log("ðŸ”„ Fetching location - shouldForceRefresh:", shouldForceRefresh, "hasInitialLocation:", hasInitialLocation, "hasPlaceholder:", hasPlaceholder)
          getLocation(true, shouldForceRefresh) // forceFresh = true if cached location is incomplete
            .then((location) => {
              if (location &&
                location.formattedAddress !== "Select location" &&
                location.city !== "Current Location") {
                console.log("âœ… Fresh location fetched:", location)
                console.log("âœ… Location details:", {
                  formattedAddress: location?.formattedAddress,
                  address: location?.address,
                  city: location?.city,
                  state: location?.state,
                  area: location?.area
                })
                // CRITICAL: Update state with fresh location so PageNavbar displays it
                setLocation(location)
                setPermissionGranted(true)
                dispatchLocationUpdated(location)
                // Start watching for live updates
                startWatchingLocation()
              } else {
                console.warn("âš ï¸ Location fetch returned placeholder, retrying...")
                // Retry after 2 seconds if we got placeholder
                setTimeout(() => {
                  getLocation(true, true)
                    .then((retryLocation) => {
                      if (retryLocation &&
                        retryLocation.formattedAddress !== "Select location" &&
                        retryLocation.city !== "Current Location") {
                        setLocation(retryLocation)
                        setPermissionGranted(true)
                        dispatchLocationUpdated(retryLocation)
                        startWatchingLocation()
                      }
                    })
                    .catch(() => {
                      startWatchingLocation()
                    })
                }, 2000)
              }
            })
            .catch((err) => {
              console.warn("âš ï¸ Background location fetch failed (using cached):", err.message)
              // Still start watching in case permission is granted later
              startWatchingLocation()
            })
        } else {
          // We have a valid location, just start watching
          startWatchingLocation()
        }
      } catch (err) {
        console.error("Error in checkPermissionAndStart:", err);
        setLoading(false);
      }
    };

    // Only check permissions/start watching if we already have a saved location
    // This avoids "Requests geolocation permission on page load" warnings on fresh visits
    // New users must explicitly click "Use Current Location" first
    const hasStoredLocation = localStorage.getItem(USER_LOCATION_KEY);
    if (hasStoredLocation && storedLocationMode === "manual") {
      console.log("📍 Using manually selected location - skipping auto geolocation refresh")
      setLoading(false);
    } else if (hasStoredLocation) {
      checkPermissionAndStart();
    } else {
      console.log("ðŸ“ Fresh visit - skipping auto-geolocation check (waiting for user action)");
      setLoading(false);
    }

    // Cleanup timeout and watcher
    return () => {
      clearTimeout(loadingTimeout)
      console.log("ðŸ§¹ Cleaning up location watcher")
      stopWatchingLocation()
    }

    return () => {
      console.log("ðŸ§¹ Cleaning up location watcher")
      stopWatchingLocation()
    }
  }, [])

  // Listen for address updates (from overlay, cart, or other tabs) so top nav and all consumers update instantly
  useEffect(() => {
    const onUserLocationUpdated = (e) => {
      const payload = e?.detail
      if (!payload || (payload.formattedAddress === "Select location" && payload.latitude == null)) return
      if (payload.selectionMode === "manual") {
        setStoredLocationMode("manual")
        stopWatchingLocation()
      } else if (payload.selectionMode === "current") {
        setStoredLocationMode("current")
      }
      setLocation((prev) => {
        const next = { ...(prev || {}), ...payload }
        try {
          if (next.latitude != null && next.longitude != null) {
            localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(next))
            lastGeocodeApiCoordsRef.current = {
              latitude: next.latitude,
              longitude: next.longitude,
            }
          }
        } catch {
          // ignore
        }
        return next
      })
      setPermissionGranted(true)
    }
    window.addEventListener("userLocationUpdated", onUserLocationUpdated)
    return () => window.removeEventListener("userLocationUpdated", onUserLocationUpdated)
  }, [])

  const requestLocation = async () => {
    console.log("ðŸ“ðŸ“ðŸ“ User requested location update - clearing cache and fetching fresh")
    setLoading(true)
    setError(null)

    try {
      // Clear cached location to force fresh fetch
      localStorage.removeItem(USER_LOCATION_KEY)
      setStoredLocationMode("current")
      console.log("ðŸ—‘ï¸ Cleared cached location from localStorage")

      // Show loading, so pass showLoading = true
      // forceFresh = true, updateDB = true, showLoading = true
      // This ensures we get fresh GPS coordinates and reverse geocode with Google Maps
      const location = await getLocation(true, true, true)

      console.log("âœ…âœ…âœ… Fresh location requested successfully:", location)
      console.log("âœ…âœ…âœ… Complete Location details:", {
        formattedAddress: location?.formattedAddress,
        address: location?.address,
        city: location?.city,
        state: location?.state,
        area: location?.area,
        pointOfInterest: location?.pointOfInterest,
        premise: location?.premise,
        coordinates: location?.latitude && location?.longitude ?
          `${location.latitude.toFixed(8)}, ${location.longitude.toFixed(8)}` : "N/A",
        hasCompleteAddress: location?.formattedAddress &&
          location.formattedAddress !== "Select location" &&
          !location.formattedAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/) &&
          location.formattedAddress.split(',').length >= 4
      })

      // Verify we got complete address (POI, building, floor, area, city, state, pincode)
      if (!location?.formattedAddress ||
        location.formattedAddress === "Select location" ||
        location.formattedAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/) ||
        location.formattedAddress.split(',').length < 4) {
        console.warn("âš ï¸âš ï¸âš ï¸ Location received but address is incomplete!")
        console.warn("âš ï¸ Address parts count:", location?.formattedAddress?.split(',').length || 0)
        console.warn("âš ï¸ This might be due to:")
        console.warn("   1. Google Maps API not enabled or billing not set up")
        console.warn("   2. Location permission not granted")
        console.warn("   3. GPS accuracy too low (try on mobile device)")
      } else {
        console.log("âœ…âœ…âœ… SUCCESS: Complete detailed address received!")
        console.log("âœ… Full address:", location.formattedAddress)
      }

      // Restart watching for live updates
      startWatchingLocation()

      return location
    } catch (err) {
      console.error("âŒ Failed to request location:", err)
      setError(err.message || "Failed to get location")
      // Still try to start watching in case it works
      startWatchingLocation()
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    location,
    loading,
    error,
    permissionGranted,
    requestLocation,
    startWatchingLocation,
    stopWatchingLocation,
  }
}
