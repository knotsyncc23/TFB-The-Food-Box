export const LOCATION_STORAGE_KEY = "userLocation"
export const DELIVERY_MODE_STORAGE_KEY = "deliveryAddressMode"
export const SELECTED_ADDRESS_ID_STORAGE_KEY = "selectedAddressId"
export const LOCATION_STATE_EVENT = "foodLocationStateUpdated"

export const getAddressId = (address) => address?.id || address?._id || null

export const normalizeAddressLabel = (label) => {
  const value = String(label || "").trim().toLowerCase()
  if (value === "work" || value === "office") return "Office"
  if (value === "home") return "Home"
  if (value === "other") return "Other"
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Other"
}

export const getAddressCoordinates = (address) => {
  const lng = Number(address?.location?.coordinates?.[0] ?? address?.longitude ?? address?.lng)
  const lat = Number(address?.location?.coordinates?.[1] ?? address?.latitude ?? address?.lat)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { latitude: lat, longitude: lng }
}

export const formatAddressLine = (address) => {
  if (!address) return ""
  const explicit = String(address.formattedAddress || address.address || "").trim()
  if (explicit) return explicit

  return [
    address.additionalDetails,
    address.street,
    address.city,
    address.state,
    address.zipCode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ")
}

export const getLocationTitle = (location) => {
  if (!location) return "Select Location"
  return (
    String(location.area || "").trim() ||
    String(location.additionalDetails || "").trim() ||
    String(location.street || "").trim() ||
    String(location.city || "").trim() ||
    "Select Location"
  )
}

export const addressToLocationState = (address, mode = "saved") => {
  if (!address) return null
  const coords = getAddressCoordinates(address)
  return {
    id: getAddressId(address),
    label: normalizeAddressLabel(address.label),
    mode,
    street: String(address.street || "").trim(),
    additionalDetails: String(address.additionalDetails || "").trim(),
    area: String(address.additionalDetails || address.street || address.area || "").trim(),
    city: String(address.city || "").trim(),
    state: String(address.state || "").trim(),
    zipCode: String(address.zipCode || "").trim(),
    address: formatAddressLine(address),
    formattedAddress: formatAddressLine(address),
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    sourceType: mode === "current" ? "gps" : "saved_address",
  }
}

export const readStoredLocation = () => {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const writeStoredLocation = (location) => {
  if (typeof window === "undefined") return
  if (!location) return
  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location))
}

export const emitLocationStateChange = (detail = {}) => {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(LOCATION_STATE_EVENT, { detail }))
  window.dispatchEvent(new CustomEvent("userLocationUpdated", { detail }))
  window.dispatchEvent(new CustomEvent("deliveryAddressModeUpdated", { detail }))
}
