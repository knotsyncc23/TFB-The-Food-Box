import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { userAPI } from "@food/api"
import { useProfile } from "@food/context/ProfileContext"
import {
  DELIVERY_MODE_STORAGE_KEY,
  LOCATION_STATE_EVENT,
  LOCATION_STORAGE_KEY,
  SELECTED_ADDRESS_ID_STORAGE_KEY,
  addressToLocationState,
  emitLocationStateChange,
  formatAddressLine,
  getAddressCoordinates,
  getAddressId,
  readStoredLocation,
  writeStoredLocation,
} from "@food/utils/address"

const LocationContext = createContext(null)

const debugError = (..._args) => {}

const isAuthenticated = () => {
  try {
    return Boolean(localStorage.getItem("user_accessToken") || localStorage.getItem("user_authenticated") === "true")
  } catch {
    return false
  }
}

const getStoredMode = () => {
  try {
    return localStorage.getItem(DELIVERY_MODE_STORAGE_KEY) || "saved"
  } catch {
    return "saved"
  }
}

const getStoredSelectedAddressId = () => {
  try {
    return localStorage.getItem(SELECTED_ADDRESS_ID_STORAGE_KEY) || null
  } catch {
    return null
  }
}

const getPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported"))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  })

const buildRichLocation = ({ latitude, longitude, payload = {}, sourceType = "gps" }) => {
  const address = payload?.address || {}
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    payload.city ||
    ""
  const state = address.state || payload.state || ""
  const zipCode = address.postcode || payload.zipCode || ""
  const street = [
    address.house_number,
    address.road || address.pedestrian || address.footway || payload.street,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
  const locality =
    address.suburb ||
    address.neighbourhood ||
    address.residential ||
    address.quarter ||
    address.hamlet ||
    payload.area ||
    ""
  const additionalDetails = payload.additionalDetails || ""
  const formattedAddress =
    String(payload.display_name || payload.formattedAddress || "").trim() ||
    [
      additionalDetails,
      street,
      locality,
      city,
      state,
      zipCode,
    ]
      .filter(Boolean)
      .join(", ")

  return {
    label: payload.label || "",
    street,
    additionalDetails,
    area: locality || additionalDetails || street,
    city,
    state,
    zipCode,
    latitude,
    longitude,
    address: formattedAddress,
    formattedAddress,
    sourceType,
  }
}

const reverseGeocode = async (latitude, longitude, sourceType = "gps") => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}`,
      {
        headers: { Accept: "application/json", "Accept-Language": "en" },
      },
    )
    const data = await response.json()
    const built = buildRichLocation({ latitude, longitude, payload: data, sourceType })
    if (built.formattedAddress) return built
  } catch {}

  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    )
    const data = await response.json()
    return buildRichLocation({
      latitude,
      longitude,
      payload: {
        display_name: data?.formattedAddress || "",
        area: data?.locality || data?.principalSubdivision || "",
        city: data?.city || data?.locality || "",
        state: data?.principalSubdivision || "",
        zipCode: data?.postcode || "",
      },
      sourceType,
    })
  } catch {
    return null
  }
}

const syncLocationStorage = (location, mode, selectedAddressId = null) => {
  writeStoredLocation(location)
  localStorage.setItem(DELIVERY_MODE_STORAGE_KEY, mode)
  if (selectedAddressId) {
    localStorage.setItem(SELECTED_ADDRESS_ID_STORAGE_KEY, String(selectedAddressId))
  } else {
    localStorage.removeItem(SELECTED_ADDRESS_ID_STORAGE_KEY)
  }
  emitLocationStateChange({ location, mode, selectedAddressId })
}

export function LocationProvider({ children }) {
  const { addresses, getDefaultAddress, setDefaultAddress, addAddress } = useProfile()
  const [location, setLocation] = useState(() => readStoredLocation())
  const [loading, setLoading] = useState(() => !readStoredLocation())
  const [error, setError] = useState(null)
  const [permissionGranted, setPermissionGranted] = useState(() => Boolean(readStoredLocation()?.latitude))
  const [deliveryAddressMode, setDeliveryAddressMode] = useState(getStoredMode)
  const [selectedAddressId, setSelectedAddressId] = useState(getStoredSelectedAddressId)

  const hydrateBackendLocation = useCallback(async () => {
    if (!isAuthenticated()) return null
    try {
      const response = await userAPI.getLocation()
      const backendLocation = response?.data?.data?.location || response?.data?.location || null
      if (backendLocation?.latitude && backendLocation?.longitude) {
        setLocation(backendLocation)
        setPermissionGranted(true)
        syncLocationStorage(backendLocation, getStoredMode(), getStoredSelectedAddressId())
        return backendLocation
      }
    } catch {
      return null
    }
    return null
  }, [])

  const syncBackendLocation = useCallback(async (nextLocation) => {
    if (!nextLocation?.latitude || !nextLocation?.longitude || !isAuthenticated()) return
    try {
      await userAPI.updateLocation(nextLocation)
    } catch (err) {
      debugError("Failed to sync location", err)
    }
  }, [])

  const applyLocation = useCallback(
    async (nextLocation, { mode = "current", selectedAddress = null, syncBackend = true } = {}) => {
      if (!nextLocation) return null
      const selectedId = selectedAddress ? getAddressId(selectedAddress) : null
      setLocation(nextLocation)
      setError(null)
      setDeliveryAddressMode(mode)
      setSelectedAddressId(selectedId ? String(selectedId) : null)
      setPermissionGranted(Boolean(nextLocation.latitude && nextLocation.longitude))
      syncLocationStorage(nextLocation, mode, selectedId)
      if (syncBackend) {
        await syncBackendLocation(nextLocation)
      }
      return nextLocation
    },
    [syncBackendLocation],
  )

  const requestLocation = useCallback(
    async () => {
      setLoading(true)
      setError(null)
      try {
        const position = await getPosition()
        const latitude = Number(position.coords.latitude)
        const longitude = Number(position.coords.longitude)
        const geocoded = await reverseGeocode(latitude, longitude, "gps")
        const refinedLocation =
          geocoded ||
          ({
            latitude,
            longitude,
            city: "",
            state: "",
            zipCode: "",
            street: "",
            additionalDetails: "",
            area: "",
            address: "",
            formattedAddress: "",
            sourceType: "gps",
          })

        if (!refinedLocation?.formattedAddress) {
          const fallbackLocation = readStoredLocation()
          if (fallbackLocation?.latitude && fallbackLocation?.longitude) {
            await applyLocation(fallbackLocation, {
              mode: getStoredMode(),
              selectedAddress: addresses.find((item) => String(getAddressId(item)) === String(getStoredSelectedAddressId())),
              syncBackend: false,
            })
            return fallbackLocation
          }
        }

        await applyLocation(refinedLocation, { mode: "current", selectedAddress: null })
        return refinedLocation
      } catch (err) {
        const fallbackLocation = readStoredLocation()
        if (fallbackLocation?.latitude && fallbackLocation?.longitude) {
          setLocation(fallbackLocation)
          setDeliveryAddressMode(getStoredMode())
          setSelectedAddressId(getStoredSelectedAddressId())
          setPermissionGranted(true)
          setLoading(false)
          return fallbackLocation
        }
        setError(err?.message || "Unable to fetch location")
        throw err
      } finally {
        setLoading(false)
      }
    },
    [addresses, applyLocation],
  )

  const selectSavedAddress = useCallback(
    async (addressOrId) => {
      const selected =
        typeof addressOrId === "object"
          ? addressOrId
          : addresses.find((item) => String(getAddressId(item)) === String(addressOrId))

      if (!selected) return null
      const selectedId = getAddressId(selected)
      if (selectedId) {
        await setDefaultAddress(selectedId)
      }
      const nextLocation = addressToLocationState(selected, "saved")
      if (!nextLocation) return null
      await applyLocation(nextLocation, { mode: "saved", selectedAddress: selected, syncBackend: false })
      return nextLocation
    },
    [addresses, applyLocation, setDefaultAddress],
  )

  const saveAddressFromLocation = useCallback(
    async (payload, { makeDefault = true } = {}) => {
      const createdAddress = await addAddress({
        ...payload,
        formattedAddress: formatAddressLine(payload),
      })
      if (!createdAddress) return null
      if (makeDefault) {
        await selectSavedAddress(createdAddress)
      }
      return createdAddress
    },
    [addAddress, selectSavedAddress],
  )

  useEffect(() => {
    const storedLocation = readStoredLocation()
    if (storedLocation?.latitude && storedLocation?.longitude) {
      setLocation(storedLocation)
      setPermissionGranted(true)
      setLoading(false)
    }
    hydrateBackendLocation().finally(() => setLoading(false))
  }, [hydrateBackendLocation])

  useEffect(() => {
    const syncFromEvent = (event) => {
      if (event?.detail && Object.prototype.hasOwnProperty.call(event.detail, "location")) {
        setLocation(event.detail.location || null)
      } else {
        const nextLocation = readStoredLocation()
        if (nextLocation) setLocation(nextLocation)
      }
      setDeliveryAddressMode(getStoredMode())
      setSelectedAddressId(getStoredSelectedAddressId())
    }

    window.addEventListener(LOCATION_STATE_EVENT, syncFromEvent)
    window.addEventListener("userAuthChanged", hydrateBackendLocation)
    return () => {
      window.removeEventListener(LOCATION_STATE_EVENT, syncFromEvent)
      window.removeEventListener("userAuthChanged", hydrateBackendLocation)
    }
  }, [hydrateBackendLocation])

  useEffect(() => {
    if (deliveryAddressMode !== "saved" || selectedAddressId) return
    const defaultAddress = getDefaultAddress()
    if (!defaultAddress) return
    const nextLocation = addressToLocationState(defaultAddress, "saved")
    if (!nextLocation) return
    setLocation((current) => current || nextLocation)
  }, [deliveryAddressMode, selectedAddressId, getDefaultAddress])

  const value = useMemo(
    () => ({
      location,
      loading,
      error,
      permissionGranted,
      deliveryAddressMode,
      selectedAddressId,
      requestLocation,
      selectSavedAddress,
      saveAddressFromLocation,
      setLocationState: applyLocation,
    }),
    [
      location,
      loading,
      error,
      permissionGranted,
      deliveryAddressMode,
      selectedAddressId,
      requestLocation,
      selectSavedAddress,
      saveAddressFromLocation,
      applyLocation,
    ],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useSharedLocation() {
  const context = useContext(LocationContext)
  if (!context) {
    throw new Error("useSharedLocation must be used within LocationProvider")
  }
  return context
}
