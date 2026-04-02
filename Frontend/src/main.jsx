import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import { getGoogleMapsApiKey } from './lib/utils/googleMapsApiKey.js'
import { loadBusinessSettings } from './lib/utils/businessSettings.js'

const safeStorageGet = (key, fallback = null) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback
    const value = window.localStorage.getItem(key)
    return value == null ? fallback : value
  } catch {
    return fallback
  }
}

const getUa = () => {
  try {
    return String(window?.navigator?.userAgent || "")
  } catch {
    return ""
  }
}

const isIOS = () => /iPad|iPhone|iPod/i.test(getUa())
const isGoogleInAppBrowser = () => {
  const ua = getUa()
  return /\bGSA\//i.test(ua) || /\bCriOS\//i.test(ua)
}

const safeSessionGet = (key, fallback = null) => {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return fallback
    const value = window.sessionStorage.getItem(key)
    return value == null ? fallback : value
  } catch {
    return fallback
  }
}

const safeSessionSet = (key, value) => {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return
    window.sessionStorage.setItem(key, value)
  } catch {
    return
  }
}

const attemptChunkRecoveryReload = () => {
  // Prevent infinite reload loops in case of persistent server/cache issue.
  const onceKey = "tfb_chunk_recovery_once"
  if (safeSessionGet(onceKey) === "1") return
  safeSessionSet(onceKey, "1")
  // Do not auto-navigate on iOS/in-app contexts to avoid browser handoff behavior.
  if (isIOS() || isGoogleInAppBrowser()) return
  try {
    // Use in-place reload to avoid cross-browser handoff restrictions on iOS in-app browsers.
    window.location.reload()
  } catch {
    // Last-resort same-tab navigation fallback.
    window.location.assign(window.location.href)
  }
}

const isLikelyChunkLoadError = (message = "") => {
  const text = String(message || "").toLowerCase()
  return (
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("importing a module script failed") ||
    text.includes("loading chunk") ||
    text.includes("chunkloaderror")
  )
}

// Load business settings on app start (favicon, title)
// Silently handle errors - this is not critical for app functionality
setTimeout(() => {
  loadBusinessSettings().catch(() => {
    // Silently fail - settings will load when admin is authenticated
  })
}, 0)

// Push: single global FCM foreground handler (bakalacart-style); non-blocking
setTimeout(() => {
  import("./lib/notifications/fcmWeb.js")
    .then(({ initializePushNotifications }) => initializePushNotifications())
    .catch(() => {})
}, 0)

// Global flag to track Google Maps loading state
window.__googleMapsLoading = window.__googleMapsLoading || false
window.__googleMapsLoaded = window.__googleMapsLoaded || false

// Load Google Maps API dynamically from backend database
// Only load if not already loaded to prevent multiple loads
setTimeout(async () => {
  // Check if Google Maps is already loaded
  if (window.google && window.google.maps) {
    window.__googleMapsLoaded = true
    return
  }

  // Check if script is already being loaded
  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
  if (existingScript) {
    window.__googleMapsLoading = true

    // Wait for script to load
    existingScript.addEventListener('load', () => {
      window.__googleMapsLoaded = true
      window.__googleMapsLoading = false
    })
    return
  }

  // Check if Loader is already loading
  if (window.__googleMapsLoading) {
    return
  }

  window.__googleMapsLoading = true

  try {
    const googleMapsApiKey = await getGoogleMapsApiKey()
    if (googleMapsApiKey) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,geometry,drawing`
      script.async = true
      script.defer = true
      script.onload = () => {
        window.__googleMapsLoaded = true
        window.__googleMapsLoading = false
      }
      script.onerror = () => {
        window.__googleMapsLoading = false
      }
      document.head.appendChild(script)
    } else {
      window.__googleMapsLoading = false
    }
  } catch {
    window.__googleMapsLoading = false
    // No fallback - Google Maps will not load if key is not in database
    console.warn('⚠️ Google Maps API key not available. Please set it in Admin → System → Environment Variables')
  }
}, 0)

// Apply theme on app initialization
const savedTheme = safeStorageGet('appTheme', 'light')
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

// Suppress browser extension errors
const originalError = console.error
console.error = (...args) => {
  const errorStr = args
    .map((arg) => {
      try {
        return typeof arg === 'string' ? arg : JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    })
    .join(' ')
  
  // Suppress browser extension errors
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('chrome-extension://') ||
     args[0].includes('_$initialUrl') ||
     args[0].includes('_$onReInit') ||
     args[0].includes('_$bindListeners'))
  ) {
    return // Suppress browser extension errors
  }
  
  
  // Suppress geolocation errors (non-critical, will retry or use fallback)
  if (
    errorStr.includes('Timeout expired') ||
    errorStr.includes('GeolocationPositionError') ||
    errorStr.includes('Geolocation error') ||
    errorStr.includes('User denied Geolocation') ||
    errorStr.includes('permission denied') ||
    (errorStr.includes('code: 3') && errorStr.includes('location')) ||
    (errorStr.includes('code: 1') && errorStr.includes('location'))
  ) {
    return // Silently ignore geolocation errors (permission denied, timeout, etc.)
  }
  
  // Suppress duplicate network error messages (handled by axios interceptor with cooldown)
  // Check if any argument is an AxiosError with network error
  const hasNetworkError = args.some(arg => {
    if (arg && typeof arg === 'object') {
      // Check for AxiosError with ERR_NETWORK code
      if (arg.name === 'AxiosError' && (arg.code === 'ERR_NETWORK' || arg.message === 'Network Error')) {
        return true
      }
      // Check for error objects with network error message
      if (arg.message === 'Network Error' || arg.code === 'ERR_NETWORK') {
        return true
      }
    }
    return false
  })
  
  // If we have a network error object, suppress it regardless of the message prefix
  if (hasNetworkError) {
    // The axios interceptor already handles throttling and shows toast notifications
    return
  }
  
  // Check error string for network error patterns (for string-based error messages)
  if (
    errorStr.includes('🌐 Network Error') ||
    errorStr.includes('Network Error - Backend server may not be running') ||
    (errorStr.includes('ERR_NETWORK') && errorStr.includes('AxiosError')) ||
    errorStr.includes('💡 API Base URL:') ||
    errorStr.includes('💡 Backend URL:') ||
    errorStr.includes('💡 Start backend with:') ||
    errorStr.includes('💡 Check backend health:') ||
    errorStr.includes('💡 Make sure backend server is running:') ||
    errorStr.includes('❌ Backend not accessible at:') ||
    errorStr.includes('💡 Start backend:')
  ) {
    // Only show first occurrence, subsequent ones are suppressed
    // The axios interceptor already handles throttling
    return
  }
  
  // Suppress timeout errors (handled by axios interceptor)
  if (
    errorStr.includes('timeout of') ||
    errorStr.includes('ECONNABORTED') ||
    (errorStr.includes('AxiosError') && errorStr.includes('timeout'))
  ) {
    // Timeout errors are handled by axios interceptor with proper error handling
    return
  }
  
  // Suppress OTP verification errors (handled by UI error messages)
  if (
    errorStr.includes('OTP Verification Error:') ||
    (errorStr.includes('AxiosError') && errorStr.includes('Request failed with status code 403') && errorStr.includes('verify-otp'))
  ) {
    // OTP errors are already displayed to users via UI error messages
    return
  }

  // Suppress Restaurant Socket transport errors (handled by useRestaurantNotifications with throttled message)
  if (
    errorStr.includes('Restaurant Socket connection error') ||
    errorStr.includes('xhr poll error') ||
    (typeof args[0] === 'object' && args[0]?.type === 'TransportError' && args[0]?.message?.includes('xhr poll error'))
  ) {
    return
  }

  // Suppress Socket.IO WebSocket failed (backend unreachable; hook shows throttled message)
  if (errorStr.includes('WebSocket connection to') && errorStr.includes('socket.io') && errorStr.includes('failed')) {
    return
  }

  originalError.apply(console, args)
}

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason || event
  const errorMsg = error?.message || String(error) || ''
  const errorName = error?.name || ''
  const errorStr = String(error) || ''
  
  // Suppress geolocation errors (permission denied, timeout, etc.)
  if (
    errorMsg.includes('Timeout expired') ||
    errorMsg.includes('User denied Geolocation') ||
    errorMsg.includes('permission denied') ||
    errorName === 'GeolocationPositionError' ||
    (error?.code === 3 && errorMsg.includes('timeout')) ||
    (error?.code === 1 && (errorMsg.includes('location') || errorMsg.includes('geolocation')))
  ) {
    event.preventDefault() // Prevent error from showing in console
    return
  }

  // iOS Google in-app browser is more prone to stale chunk cache after deploy.
  if ((isIOS() || isGoogleInAppBrowser()) && isLikelyChunkLoadError(errorMsg || errorStr)) {
    event.preventDefault()
    attemptChunkRecoveryReload()
    return
  }
  
  // Suppress refund processing errors that are already handled by the component
  // These errors are logged with console.error in the component's catch block
  if (
    errorStr.includes('Error processing refund') ||
    (errorName === 'AxiosError' && errorMsg.includes('refund'))
  ) {
    // Error is already handled by the component, just prevent unhandled rejection
    event.preventDefault()
    return
  }
})

window.addEventListener("error", (event) => {
  const message = event?.message || ""
  if ((isIOS() || isGoogleInAppBrowser()) && isLikelyChunkLoadError(message)) {
    attemptChunkRecoveryReload()
  }
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-center" richColors offset="80px" />
      <OfflineBanner />
    </BrowserRouter>
  </StrictMode>,
)
