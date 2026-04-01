const APPLE_DEBUG_LOG_KEY = "appleDebugLog"

export const appendAppleDebugLog = (message, details = null) => {
  if (typeof sessionStorage === "undefined") return

  try {
    const existing = getAppleDebugLog()
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      details,
    }
    const next = [...existing, entry].slice(-40)
    sessionStorage.setItem(APPLE_DEBUG_LOG_KEY, JSON.stringify(next))
  } catch (error) {
    console.error("Failed to append Apple debug log:", error)
  }
}

export const getAppleDebugLog = () => {
  if (typeof sessionStorage === "undefined") return []

  try {
    const stored = sessionStorage.getItem(APPLE_DEBUG_LOG_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error("Failed to read Apple debug log:", error)
    return []
  }
}

export const clearAppleDebugLog = () => {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.removeItem(APPLE_DEBUG_LOG_KEY)
}
