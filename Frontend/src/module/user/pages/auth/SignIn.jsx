import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { Mail, Phone, AlertCircle, Loader2, Apple } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { authAPI } from "@/lib/api"
import { firebaseAuth, googleProvider, ensureFirebaseInitialized } from "@/lib/firebase"
import { hasFlutterGoogleBridge, nativeGoogleSignIn } from "@/lib/utils/flutterGoogleAuthBridge"
import { setAuthData } from "@/lib/utils/auth"
import { registerFcmTokenForLoggedInUser } from "@/lib/notifications/fcmWeb"
import { appendAppleDebugLog, clearAppleDebugLog, getAppleDebugLog } from "@/lib/utils/appleDebugLog"
import { useFirebaseUserSession } from "@/lib/firebaseUserSession"
import loginBanner from "@/assets/loginbanner.jpg"
import tifunboxLogo from "@/assets/tifunboxlogo.png"

// Common country codes
const countryCodes = [
  { code: "+1", country: "US/CA", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+91", country: "IN", flag: "🇮🇳" },
  { code: "+86", country: "CN", flag: "🇨🇳" },
  { code: "+81", country: "JP", flag: "🇯🇵" },
  { code: "+49", country: "DE", flag: "🇩🇪" },
  { code: "+33", country: "FR", flag: "🇫🇷" },
  { code: "+39", country: "IT", flag: "🇮🇹" },
  { code: "+34", country: "ES", flag: "🇪🇸" },
  { code: "+61", country: "AU", flag: "🇦🇺" },
  { code: "+7", country: "RU", flag: "🇷🇺" },
  { code: "+55", country: "BR", flag: "🇧🇷" },
  { code: "+52", country: "MX", flag: "🇲🇽" },
  { code: "+82", country: "KR", flag: "🇰🇷" },
  { code: "+65", country: "SG", flag: "🇸🇬" },
  { code: "+971", country: "AE", flag: "🇦🇪" },
  { code: "+966", country: "SA", flag: "🇸🇦" },
  { code: "+27", country: "ZA", flag: "🇿🇦" },
  { code: "+31", country: "NL", flag: "🇳🇱" },
  { code: "+46", country: "SE", flag: "🇸🇪" },
]

const redirectToUserHome = () => {
  window.location.replace("/")
}

const logAppleDebug = (message, details = null) => {
  appendAppleDebugLog(message, details)
  if (details) {
    console.log(`[AppleAuth] ${message}`, details)
    return
  }
  console.log(`[AppleAuth] ${message}`)
}

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isSignUp = searchParams.get("mode") === "signup"

  const PENDING_PROVIDER_KEY = "pendingSocialProvider"
  const APPLE_REDIRECT_IN_PROGRESS_KEY = "appleRedirectInProgress"
  const safeLocalSet = (key, value) => {
    try {
      if (typeof localStorage === "undefined") return
      localStorage.setItem(key, value)
    } catch {}
  }
  const safeLocalGet = (key) => {
    try {
      if (typeof localStorage === "undefined") return null
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }
  const safeLocalRemove = (key) => {
    try {
      if (typeof localStorage === "undefined") return
      localStorage.removeItem(key)
    } catch {}
  }
  const safeSessionSet = (key, value) => {
    try {
      if (typeof sessionStorage === "undefined") return
      sessionStorage.setItem(key, value)
    } catch {}
  }
  const safeSessionGet = (key) => {
    try {
      if (typeof sessionStorage === "undefined") return null
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  }
  const safeSessionRemove = (key) => {
    try {
      if (typeof sessionStorage === "undefined") return
      sessionStorage.removeItem(key)
    } catch {}
  }
  const setPendingProvider = (provider) => {
    if (!provider) return
    const payload = JSON.stringify({ provider, startedAt: Date.now() })
    safeSessionSet(PENDING_PROVIDER_KEY, payload)
    safeLocalSet(PENDING_PROVIDER_KEY, payload)
  }
  const getPendingProvider = () => {
    const stored = safeSessionGet(PENDING_PROVIDER_KEY) || safeLocalGet(PENDING_PROVIDER_KEY)
    if (!stored) return null

    try {
      const parsed = JSON.parse(stored)
      return typeof parsed?.provider === "string" ? parsed.provider : stored
    } catch {
      return stored
    }
  }
  const clearPendingProvider = () => {
    safeSessionRemove(PENDING_PROVIDER_KEY)
    safeSessionRemove(APPLE_REDIRECT_IN_PROGRESS_KEY)
    safeLocalRemove(PENDING_PROVIDER_KEY)
    safeLocalRemove(APPLE_REDIRECT_IN_PROGRESS_KEY)
  }

  const [authMethod, setAuthMethod] = useState("phone") // "phone" or "email"
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
    email: "",
    name: "",
    // Default to true so users stay logged in across app restarts
    rememberMe: true,
  })
  const [errors, setErrors] = useState({
    phone: "",
    email: "",
    name: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState("")
  const redirectHandledRef = useRef(false)
  const [isAppleLoading, setIsAppleLoading] = useState(false)
  const [appleError, setAppleError] = useState("")
  const [appleDebugEntries, setAppleDebugEntries] = useState(() => getAppleDebugLog())
  const isIOSBrowser = /iPad|iPhone|iPod/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  )
  const firebaseUserSession = useFirebaseUserSession()
  const hostname = typeof window !== "undefined" ? window.location.hostname : ""
  const shouldUsePopupForGoogle =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local")
  const shouldUsePopupForApple = true

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return
    if (
      getPendingProvider() === "apple" &&
      (
        safeSessionGet(APPLE_REDIRECT_IN_PROGRESS_KEY) === "true" ||
        safeLocalGet(APPLE_REDIRECT_IN_PROGRESS_KEY) === "true"
      )
    ) {
      setIsAppleLoading(true)
    }
  }, [])

  useEffect(() => {
    const syncAppleLogs = () => {
      setAppleDebugEntries(getAppleDebugLog())
    }

    syncAppleLogs()
    window.addEventListener("focus", syncAppleLogs)
    document.addEventListener("visibilitychange", syncAppleLogs)

    return () => {
      window.removeEventListener("focus", syncAppleLogs)
      document.removeEventListener("visibilitychange", syncAppleLogs)
    }
  }, [])

  useEffect(() => {
    const pendingProvider = getPendingProvider()
    if (!pendingProvider) return

    console.log("[SocialAuth] Observed Firebase restore status", {
      provider: pendingProvider,
      path: window.location.pathname,
      search: window.location.search,
      isRestoring: firebaseUserSession.isRestoring,
      hasCurrentUser: !!firebaseUserSession.currentUser,
      hasRedirectUser: !!firebaseUserSession.redirectResultUser,
      authDomain: firebaseUserSession.authDomain || null,
      hostname: firebaseUserSession.hostname || null,
      domainMatches: firebaseUserSession.domainMatches,
      error: firebaseUserSession.lastError?.message || null,
    })

    if (!firebaseUserSession.isRestoring) {
      setIsAppleLoading(false)
    }

    if (pendingProvider === "apple" && firebaseUserSession.lastError) {
      setAppleError(firebaseUserSession.lastError.message || "Apple sign-in restore failed.")
      setAppleDebugEntries(getAppleDebugLog())
    }
  }, [
    firebaseUserSession.authDomain,
    firebaseUserSession.currentUser,
    firebaseUserSession.domainMatches,
    firebaseUserSession.hostname,
    firebaseUserSession.isRestoring,
    firebaseUserSession.lastError,
    firebaseUserSession.redirectResultUser,
  ])

  // Prefill phone when user comes back from OTP screen
  useEffect(() => {
    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) return
    try {
      const data = JSON.parse(stored)
      if (data.method === "phone" && data.phone) {
        const match = data.phone.match(/^(\+\d+)\s*(\d*)/)
        if (match) {
          const [, code, num] = match
          setFormData((prev) => ({
            ...prev,
            countryCode: code || prev.countryCode,
            phone: (num || "").replace(/\D/g, ""),
          }))
        }
      }
    } catch (_) {}
  }, [])

  // Helper function to process signed-in user
  const processSignedInUser = async (user, source = "unknown", providerOverride = null) => {
    if (redirectHandledRef.current) {
      console.log(`ℹ️ User already being processed, skipping (source: ${source})`)
      return
    }

    console.log(`✅ Processing signed-in user from ${source}:`, {
      email: user.email,
      uid: user.uid,
      displayName: user.displayName
    })
    if (providerOverride === "apple" || source.includes("apple")) {
      logAppleDebug(`Processing signed-in Firebase user from ${source}`, {
        uid: user.uid,
        email: user.email || null,
        providerData: (user.providerData || []).map((item) => item?.providerId).filter(Boolean),
      })
    }

    redirectHandledRef.current = true
    setIsLoading(true)
    setApiError("")

    try {
      // Force refresh so backend always gets a valid token (avoids expired/stale token 400)
      const idToken = await user.getIdToken(true)
      const pendingProvider = getPendingProvider()
      const socialProvider =
        providerOverride ||
        pendingProvider ||
        (user.providerData || []).find((providerData) =>
          ["google.com", "apple.com"].includes(providerData?.providerId),
        )?.providerId?.replace(".com", "") ||
        "google"
      if (socialProvider === "apple") {
        logAppleDebug("Prepared backend social login payload", {
          source,
          pendingProvider,
          resolvedProvider: socialProvider,
          hasIdToken: !!idToken,
          idTokenLength: idToken?.length || 0,
        })
      }
      console.log(`✅ Got fresh ID token from ${source}, calling backend...`)

      const response = await authAPI.firebaseSocialLogin(idToken, "user", socialProvider)
      const data = response?.data?.data || {}
      if (socialProvider === "apple") {
        logAppleDebug("Received backend social login response", {
          source,
          hasAccessToken: !!data.accessToken,
          hasUser: !!data.user,
          role: data.user?.role || null,
          signupMethod: data.user?.signupMethod || null,
        })
      }

      console.log(`✅ Backend response from ${source}:`, {
        hasAccessToken: !!data.accessToken,
        hasUser: !!data.user,
        userEmail: data.user?.email
      })

      const accessToken = data.accessToken
      const appUser = data.user

      if (accessToken && appUser) {
        clearPendingProvider()
        setAuthData("user", accessToken, appUser)
        if (socialProvider === "apple") {
          logAppleDebug("Stored app auth token after backend login", {
            source,
            localToken: !!localStorage.getItem("user_accessToken"),
            sessionToken: !!sessionStorage.getItem("user_accessToken"),
            redirectPath: window.location.pathname,
          })
        }
        window.dispatchEvent(new Event("userAuthChanged"))

        // Register FCM token for push notifications (fire-and-forget)
        registerFcmTokenForLoggedInUser().catch(() => {})

        // Clear any URL hash or params
        const hasHash = window.location.hash.length > 0
        const hasQueryParams = window.location.search.length > 0
        if (hasHash || hasQueryParams) {
          window.history.replaceState({}, document.title, window.location.pathname)
        }

        console.log(`✅ Navigating to user dashboard from ${source}...`)
        if (socialProvider === "apple") {
          logAppleDebug("Redirecting to home after successful Apple login", {
            source,
            destination: "/",
          })
        }
        redirectToUserHome()
      } else {
        console.error(`❌ Invalid backend response from ${source}`)
        redirectHandledRef.current = false
        setIsLoading(false)
        setApiError("Invalid response from server. Please try again.")
      }
    } catch (error) {
      console.error(`❌ Error processing user from ${source}:`, error)
      if (providerOverride === "apple" || source.includes("apple")) {
        logAppleDebug("Failed while processing Apple user", {
          source,
          status: error?.response?.status || null,
          message: error?.response?.data?.message || error?.message || "Unknown error",
          responseData: error?.response?.data || null,
        })
      }
      redirectHandledRef.current = false
      setIsLoading(false)

      // If backend rejected the token (400), sign out from Firebase so user can try again with a fresh sign-in
      if (error?.response?.status === 400 && firebaseAuth?.currentUser) {
        try {
          const { signOut } = await import("firebase/auth")
          await signOut(firebaseAuth)
        } catch (_) {}
      }

      let errorMessage = "Failed to complete sign-in. Please try again."
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error?.message) {
        errorMessage = error.message
      }
      setApiError(errorMessage)
    }
  }

  const finalizeSocialLogin = async (payload, source = "social-login") => {
    const accessToken = payload?.accessToken
    const appUser = payload?.user

    if (!accessToken || !appUser) {
      throw new Error("Invalid response from server while processing social login")
    }

    setAuthData("user", accessToken, appUser)
    window.dispatchEvent(new Event("userAuthChanged"))

    registerFcmTokenForLoggedInUser().catch(() => {})

    const hasHash = window.location.hash.length > 0
    const hasQueryParams = window.location.search.length > 0
    if (hasHash || hasQueryParams) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    redirectToUserHome()
  }

  // Handle Firebase redirect result on component mount and URL changes
  useEffect(() => {
    // Redirect restoration is handled globally by firebaseUserSession bootstrap.
    return undefined

    let unsubscribe = null

    const handleRedirectResult = async () => {
      try {
        const { getRedirectResult } = await import("firebase/auth")
        await ensureFirebaseInitialized()

        if (!firebaseAuth) {
          console.log("ℹ️ Firebase Auth not ready, skipping redirect check")
          return
        }

        if (getPendingProvider() === "apple") {
          logAppleDebug("Checking redirect result on mount", {
            path: window.location.pathname,
            search: window.location.search,
            hasCurrentUser: !!firebaseAuth?.currentUser,
          })
        }

        // Check if we're coming back from a redirect
        const redirectResolution = await resolveFirebaseRedirectUser(
          firebaseAuth,
          getRedirectResult,
          {
            timeoutMs: getPendingProvider() === "apple" ? 25000 : 12000,
            pollIntervalMs: 600,
            shouldLog: getPendingProvider() === "apple",
            logLabel: "AppleAuth",
          }
        )

        if (redirectResolution?.user) {
          if (getPendingProvider() === "apple") {
            logAppleDebug("Firebase redirect result returned a user", {
              uid: redirectResolution.user.uid,
              email: redirectResolution.user.email || null,
              source: redirectResolution.source,
            })
          }
          await processSignedInUser(
            redirectResolution.user,
            redirectResolution.source || "redirect-result"
          )
        } else if (getPendingProvider() === "apple") {
          logAppleDebug("No redirect result and no current user after waiting", {
            hasRedirectResult: false,
            hasCurrentUser: !!firebaseAuth?.currentUser,
            redirectHandled: redirectHandledRef.current,
            error: redirectResolution?.error?.message || null,
          })
          setIsAppleLoading(false)
        }
      } catch (error) {
        console.error("❌ Google sign-in check error:", error)
        if (getPendingProvider() === "apple") {
          logAppleDebug("Redirect result check failed", {
            message: error?.message || "Unknown error",
            code: error?.code || null,
          })
        }
        setApiError("Failed to check authentication status. Please try refreshing.")
        setIsLoading(false)
      }
    }

    const setupAuthListener = async () => {
      try {
        const { onAuthStateChanged } = await import("firebase/auth")
        await ensureFirebaseInitialized()

        if (!firebaseAuth) return

        unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
          if (user && !redirectHandledRef.current) {
            if (getPendingProvider() === "apple") {
              logAppleDebug("Auth state listener received user", {
                uid: user.uid,
                email: user.email || null,
              })
            }
            await processSignedInUser(user, "auth-state-listener")
          }
        })
      } catch (error) {
        console.error("❌ Error setting up auth state listener:", error)
      }
    }

    // Initialize everything
    const init = async () => {
      await setupAuthListener()
      // Small delay to let Firebase state settle
      setTimeout(() => {
        handleRedirectResult()
      }, 500)
    }

    init()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [navigate])

  // Get selected country details dynamically
  const selectedCountry = countryCodes.find(c => c.code === formData.countryCode) || countryCodes[2] // Default to India (+91)

  const validateEmail = (email) => {
    if (!email.trim()) {
      return "Email is required"
    }
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address"
    }
    return ""
  }

  const validatePhone = (phone, countryCode = formData.countryCode) => {
    if (!phone.trim()) {
      return "Phone number is required"
    }
    const cleanPhone = phone.replace(/\D/g, "")
    if (!/^\d+$/.test(cleanPhone)) {
      return "Please enter a valid phone number (digits only)"
    }
    if (countryCode === "+91") {
      if (cleanPhone.length !== 10) {
        return "Phone number must be 10 digits"
      }
      if (!["6", "7", "8", "9"].includes(cleanPhone[0])) {
        return "Please enter a valid 10-digit mobile number"
      }
      return ""
    }
    if (cleanPhone.length < 7 || cleanPhone.length > 15) {
      return "Phone number must be 7-15 digits"
    }
    return ""
  }

  const validateName = (name) => {
    if (!name.trim()) {
      return "Name is required"
    }
    if (name.trim().length < 2) {
      return "Name must be at least 2 characters"
    }
    if (name.trim().length > 50) {
      return "Name must be less than 50 characters"
    }
    const nameRegex = /^[a-zA-Z\s'-]+$/
    if (!nameRegex.test(name.trim())) {
      return "Name can only contain letters, spaces, hyphens, and apostrophes"
    }
    return ""
  }

  const maxPhoneLength = formData.countryCode === "+91" ? 10 : 15

  const handleChange = (e) => {
    const { name, value } = e.target
    let nextValue = value
    if (name === "phone") {
      nextValue = value.replace(/\D/g, "").slice(0, maxPhoneLength)
    }
    setFormData({
      ...formData,
      [name]: name === "phone" ? nextValue : value,
    })

    // Real-time validation
    if (name === "email") {
      setErrors({ ...errors, email: validateEmail(value) })
    } else if (name === "phone") {
      setErrors({ ...errors, phone: validatePhone(nextValue, formData.countryCode) })
    } else if (name === "name") {
      setErrors({ ...errors, name: validateName(value) })
    }
  }

  const handleCountryCodeChange = (value) => {
    const maxLen = value === "+91" ? 10 : 15
    const trimmed = (formData.phone || "").replace(/\D/g, "").slice(0, maxLen)
    setFormData((prev) => ({ ...prev, countryCode: value, phone: trimmed }))
    if (trimmed) setErrors((prev) => ({ ...prev, phone: validatePhone(trimmed, value) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setApiError("")

    // Validate based on auth method
    let hasErrors = false
    const newErrors = { phone: "", email: "", name: "" }

    if (authMethod === "phone") {
      const phoneError = validatePhone(formData.phone, formData.countryCode)
      newErrors.phone = phoneError
      if (phoneError) hasErrors = true
    } else {
      const emailError = validateEmail(formData.email)
      newErrors.email = emailError
      if (emailError) hasErrors = true
    }

    // Validate name for sign up
    if (isSignUp) {
      const nameError = validateName(formData.name)
      newErrors.name = nameError
      if (nameError) hasErrors = true
    }

    setErrors(newErrors)

    if (hasErrors) {
      setIsLoading(false)
      return
    }

    try {
      const purpose = isSignUp ? "register" : "login"
      const phoneDigits = (formData.phone || "").replace(/\D/g, "")
      const fullPhone = authMethod === "phone" ? `${formData.countryCode} ${phoneDigits}`.trim() : null
      const email = authMethod === "email" ? formData.email.trim() : null

      // Call backend to send OTP
      await authAPI.sendOTP(fullPhone, purpose, email)

      // Store auth data in sessionStorage for OTP page (include rememberMe for after OTP)
      const authData = {
        method: authMethod,
        phone: fullPhone,
        email: email,
        name: isSignUp ? formData.name.trim() : null,
        isSignUp,
        module: "user",
        rememberMe: !!formData.rememberMe,
      }
      sessionStorage.setItem("userAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/user/auth/otp")
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setApiError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setApiError("")
    setIsLoading(true)
    setPendingProvider("google")
    safeSessionSet(APPLE_REDIRECT_IN_PROGRESS_KEY, "true")
    safeLocalSet(APPLE_REDIRECT_IN_PROGRESS_KEY, "true")
    redirectHandledRef.current = false // Reset flag when starting new sign-in

    try {
      // Ensure Firebase is initialized before use
      await ensureFirebaseInitialized()

      // Validate Firebase Auth instance
      if (!firebaseAuth) {
        throw new Error("Firebase Auth is not initialized. Please check your Firebase configuration.")
      }

      // 1) Flutter WebView bridge path (works in in-app browser)
      if (hasFlutterGoogleBridge()) {
        const flutterResult = await nativeGoogleSignIn()

        const flutterToken = flutterResult?.idToken || flutterResult?.accessToken || ""
        if (!flutterResult?.success || !flutterToken) {
          const cancelledMessage = flutterResult?.cancelled
            ? "Google sign-in was cancelled."
            : "Google sign-in cancelled or failed. Please try again."
          setApiError(cancelledMessage)
          console.warn("[Google][Flutter] Unexpected nativeGoogleSignIn payload:", flutterResult?.raw || flutterResult)
          setIsLoading(false)
          return
        }

        const idToken = flutterToken

        // 2) Preferred: try to sign in via Firebase credential using idToken
        try {
          const { GoogleAuthProvider, signInWithCredential } = await import("firebase/auth")
          const credential = GoogleAuthProvider.credential(idToken)
          const userCredential = await signInWithCredential(firebaseAuth, credential)

          if (userCredential?.user) {
            await processSignedInUser(userCredential.user, "flutter-webview")
            return
          }

          throw new Error("Firebase did not return a user after credential exchange")
        } catch (credentialError) {
          // 3) Fallback: token might already be Firebase ID token; call backend directly.
          console.warn(
            "Flutter Google token credential failed; falling back to backend login:",
            credentialError?.message || credentialError,
          )

          const response = await authAPI.firebaseSocialLogin(idToken, "user", "google")
          const data = response?.data?.data || {}

          if (data.accessToken && data.user) {
            redirectHandledRef.current = true
            await finalizeSocialLogin(data, "flutter-google")
            return
          }

          throw new Error("Invalid backend response during Flutter login fallback")
        }
      }

      // 4) Normal browser path
      const {
        browserLocalPersistence,
        setPersistence,
        signInWithPopup,
        signInWithRedirect,
      } = await import("firebase/auth")

      // Log current origin for debugging
      console.log("🚀 Starting Google sign-in popup...")

      console.log("[GoogleAuth] Starting Google sign-in", {
        path: window.location.pathname,
        origin: window.location.origin,
        isIOSBrowser,
        shouldUsePopupForGoogle,
      })
      await setPersistence(firebaseAuth, browserLocalPersistence)
      console.log("[GoogleAuth] Configured Firebase persistence for Google sign-in", {
        persistence: "browserLocalPersistence",
      })

      if (shouldUsePopupForGoogle) {
        console.log("[GoogleAuth] Using Google popup flow", {
          reason: "Local development cannot reliably restore cross-domain redirect auth",
        })
        const result = await signInWithPopup(firebaseAuth, googleProvider)

        console.log("✅ Popup sign-in successful:", {
          user: result?.user?.email,
          operationType: result?.operationType,
        })

        if (result?.user) {
          await processSignedInUser(result.user, "popup-result", "google")
          return
        }
      }

      console.log("[GoogleAuth] Using Google redirect flow", {
        reason: "Firebase Hosting auth flow standardized on redirect",
      })
      await signInWithRedirect(firebaseAuth, googleProvider)
      return
    } catch (error) {
      console.error("❌ Google sign-in redirect error:", error)
      console.error("Error code:", error?.code)
      console.error("Error message:", error?.message)
      setIsLoading(false)
      redirectHandledRef.current = false

      const errorCode = error?.code || ""
      const errorMessage = error?.message || ""

      let message = "Google sign-in failed. Please try again."

      if (errorCode === "auth/configuration-not-found") {
        message = "Firebase configuration error. Please ensure your domain is authorized in Firebase Console. Current domain: " + window.location.hostname
      } else if (errorCode === "auth/operation-not-allowed") {
        message = "This sign-in method is disabled. Please enable it in the Firebase Console."
      } else if (errorCode === "auth/popup-blocked") {
        try {
          const { signInWithRedirect } = await import("firebase/auth")
          await signInWithRedirect(firebaseAuth, googleProvider)
          return
        } catch (_) {}
        message = "Popup was blocked. Please allow popups and try again."
      } else if (errorCode === "auth/popup-closed-by-user") {
        message = "Sign-in was cancelled. Please try again."
      } else if (errorCode === "auth/network-request-failed") {
        message = "Network error. Please check your connection and try again."
      } else if (errorMessage) {
        message = errorMessage
      } else if (error?.response?.data?.message) {
        message = error.response.data.message
      } else if (error?.response?.data?.error) {
        message = error.response.data.error
      }

      setApiError(message)
    }
  }

  const handleAppleSignIn = async () => {
    clearAppleDebugLog()
    setAppleDebugEntries([])
    setAppleError("")
    setIsAppleLoading(true)
    setPendingProvider("apple")
    safeSessionSet(APPLE_REDIRECT_IN_PROGRESS_KEY, "true")
    safeLocalSet(APPLE_REDIRECT_IN_PROGRESS_KEY, "true")
    logAppleDebug("Starting Apple sign-in", {
      path: window.location.pathname,
      origin: window.location.origin,
      isIOSBrowser,
      shouldUsePopupForApple,
    })

    try {
      await ensureFirebaseInitialized()

      if (!firebaseAuth) {
        throw new Error("Firebase Auth is not initialized. Please check your Firebase configuration.")
      }

      const {
        OAuthProvider,
        browserLocalPersistence,
        setPersistence,
        signInWithPopup,
      } = await import("firebase/auth")
      const appleProvider = new OAuthProvider("apple.com")
      appleProvider.addScope("email")
      appleProvider.addScope("name")

      // Apple often falls back to a full-page redirect on mobile/Safari, so we
      // force persistent auth storage before starting the OAuth flow.
      await setPersistence(firebaseAuth, browserLocalPersistence)
      logAppleDebug("Configured Firebase persistence for Apple sign-in", {
        persistence: "browserLocalPersistence",
      })

      if (shouldUsePopupForApple) {
        logAppleDebug("Using Apple popup flow", {
          reason: "Prefer popup on all browsers to avoid iOS redirect restore stalls",
        })

        const result = await signInWithPopup(firebaseAuth, appleProvider)
        if (result?.user) {
          await processSignedInUser(result.user, "apple-popup-result", "apple")
          return
        }

        throw new Error("Apple popup completed without returning a Firebase user.")
      }

    } catch (error) {
      console.error("Apple sign-in failed:", error)
      logAppleDebug("Apple sign-in entry flow failed", {
        code: error?.code || error?.error || null,
        message: error?.response?.data?.message || error?.message || "Unknown error",
      })
      let message = "Apple sign-in failed. Please try again."

      if (error?.code === "auth/configuration-not-found") {
        message = "Firebase Apple sign-in is not configured for this domain. Enable Apple in Firebase Console and authorize this domain."
      } else if (error?.code === "auth/operation-not-allowed") {
        message = "Apple sign-in is disabled in Firebase Console."
      } else if (error?.code === "auth/popup-blocked") {
        message = "Popup was blocked. Please allow popups and try again."
      } else if (error?.error === "popup_closed_by_user" || error?.code === "popup_closed_by_user" || error?.code === "auth/popup-closed-by-user") {
        message = "Apple sign-in was cancelled."
      } else if (error?.response?.data?.message) {
        message = error.response.data.message
      } else if (error?.message) {
        message = error.message
      }

      setAppleError(message)
      setAppleDebugEntries(getAppleDebugLog())
    } finally {
      setIsAppleLoading(false)
      setAppleDebugEntries(getAppleDebugLog())
    }
  }

  const toggleMode = () => {
    const newMode = isSignUp ? "signin" : "signup"
    navigate(`/user/auth/sign-in?mode=${newMode}`, { replace: true })
    // Reset form
    setFormData({ phone: "", countryCode: "+91", email: "", name: "", rememberMe: true })
    setErrors({ phone: "", email: "", name: "" })
  }

  const handleLoginMethodChange = () => {
    setAuthMethod(authMethod === "email" ? "phone" : "email")
  }

  return (
    <AnimatedPage className="min-h-screen md:min-h-0 md:h-screen flex flex-col bg-white dark:bg-[#0a0a0a] !pb-0 md:flex-row">

      {/* Mobile: Top Section - Banner Image */}
      {/* Desktop: Left Section - Banner Image */}
      {/* Mobile: Top Section - Logo with matching green background */}
      <div className="relative md:hidden w-full shrink-0 flex items-center justify-center bg-white" style={{ height: "45vh", minHeight: "300px" }}>
        <img
          src={tifunboxLogo}
          alt="Tifunbox Logo"
          className="w-64 h-auto object-contain"
        />
      </div>

      {/* Desktop: Left Section - Logo with white background (full height) */}
      <div className="relative hidden md:flex md:w-1/2 md:min-h-full shrink-0 items-center justify-center bg-white">
        <img
          src={tifunboxLogo}
          alt="Tifunbox Logo"
          className="w-80 lg:w-96 h-auto object-contain"
        />
      </div>

      {/* Mobile: Bottom Section - White Login Form; Desktop: Right Section - Login Form */}
      <div className="flex-1 flex flex-col md:w-1/2 md:min-h-0 md:overflow-y-auto">
        <div className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 xl:p-10 md:flex md:items-center md:justify-center bg-white dark:bg-[#1a1a1a]">
        <div className="max-w-md lg:max-w-lg xl:max-w-xl mx-auto space-y-6 md:space-y-8 lg:space-y-10 w-full">
          {/* Heading */}
          <div className="text-center space-y-2 md:space-y-3">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black dark:text-white leading-tight">
              India's #1 Food Delivery and Dining App
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400">
              Log in or sign up
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            {/* Name field for sign up - hidden by default, shown only when needed */}
            {isSignUp && (
              <div className="space-y-2">
                <Input
                  id="name"
                  name="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`text-base md:text-lg h-12 md:h-14 bg-white dark:bg-[#1a1a1a] text-black dark:text-white ${errors.name ? "border-red-500" : "border-gray-300 dark:border-gray-700"} transition-colors`}
                  aria-invalid={errors.name ? "true" : "false"}
                />
                {errors.name && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>{errors.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Phone Number Input */}
            {authMethod === "phone" && (
              <div className="space-y-2">
                <div className="flex gap-2 items-stretch">
                  <Select
                    value={formData.countryCode}
                    onValueChange={handleCountryCodeChange}
                  >
                    <SelectTrigger
                      className="w-[100px] md:w-[120px] !h-12 md:!h-14 border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-black dark:text-white rounded-lg flex items-center transition-colors"
                      size="default"
                      aria-label="Select country code"
                    >
                      <SelectValue>
                        <span className="flex items-center gap-2 text-sm md:text-base">
                          <span>{selectedCountry.country}</span>
                          <span>{selectedCountry.code}</span>
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {countryCodes.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          <span className="flex items-center gap-2">
                            <span>{country.country}</span>
                            <span>{country.code}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="Enter Phone Number"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`flex-1 h-12 md:h-14 text-base md:text-lg bg-white dark:bg-[#1a1a1a] text-black dark:text-white border-gray-300 dark:border-gray-700 rounded-lg ${errors.phone ? "border-red-500" : ""} transition-colors`}
                    aria-invalid={errors.phone ? "true" : "false"}
                  />
                </div>
                {errors.phone && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>{errors.phone}</span>
                  </div>
                )}
                {apiError && authMethod === "phone" && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>{apiError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Email Input */}
            {authMethod === "email" && (
              <div className="space-y-2">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full h-12 md:h-14 text-base md:text-lg bg-white dark:bg-[#1a1a1a] text-black dark:text-white border-gray-300 dark:border-gray-700 rounded-lg ${errors.email ? "border-red-500" : ""} transition-colors`}
                  aria-invalid={errors.email ? "true" : "false"}
                />
                {errors.email && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>{errors.email}</span>
                  </div>
                )}
                {apiError && authMethod === "email" && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>{apiError}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod("phone")
                    setApiError("")
                  }}
                  className="text-xs text-[#671E1F] hover:underline text-left"
                >
                  Use phone instead
                </button>
              </div>
            )}

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="rememberMe"
                checked={formData.rememberMe}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, rememberMe: checked === true })
                }
                className="w-4 h-4 border-2 border-gray-300 rounded data-[state=checked]:bg-[#671E1F] data-[state=checked]:border-[#671E1F] flex items-center justify-center text-white"
              />
              <label
                htmlFor="rememberMe"
                className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
              >
                Remember my login for faster sign-in
              </label>
            </div>

            {/* Continue Button */}
            <Button
              type="submit"
              className="w-full h-12 md:h-14 text-white font-bold text-base md:text-lg rounded-lg transition-all hover:shadow-lg active:scale-[0.98]"
              style={{ backgroundColor: "#671E1F" }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isSignUp ? "Creating Account..." : "Signing In..."}
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>

          {/* Or Separator */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-[#1a1a1a] px-2 text-sm text-gray-500 dark:text-gray-400">
                or
              </span>
            </div>
          </div>

          {/* Social Login Controls */}
            <div className="flex justify-center items-center gap-4 md:gap-6">
              {/* Apple Login */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  disabled={isAppleLoading}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black flex items-center justify-center hover:bg-gray-900 transition-all hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Sign in with Apple"
                  aria-busy={isAppleLoading ? "true" : undefined}
                >
                  {isAppleLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <Apple className="h-6 w-6 text-white" />
                  )}
                </button>
              </div>

              {/* Google Login */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-12 h-12 md:w-14 md:h-14 rounded-full border border-gray-300 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-all hover:shadow-md active:scale-95"
                aria-label="Sign in with Google"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </button>

              {/* Email/Phone Toggle Login */}
              <button
                type="button"
                onClick={handleLoginMethodChange}
                className="w-12 h-12 md:w-14 md:h-14 rounded-full border border-[#671E1F] flex items-center justify-center hover:opacity-90 transition-all hover:shadow-md active:scale-95 bg-[#671E1F]"
                aria-label="Sign in with Email"
              >
                {authMethod === "phone" ? (
                  <Mail className="h-5 w-5 md:h-6 md:w-6 text-white" />
                ) : (
                  <Phone className="h-5 w-5 md:h-6 md:w-6 text-white" />
                )}
              </button>
            </div>

            {/* Social Login Error Messages */}
            <div className="text-center space-y-1">
              {appleError && <p className="text-xs text-red-600 font-medium">{appleError}</p>}
            </div>

          {(appleDebugEntries.length > 0 || isAppleLoading) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Apple Debug
                </p>
                <button
                  type="button"
                  onClick={() => {
                    clearAppleDebugLog()
                    setAppleDebugEntries([])
                  }}
                  className="text-[11px] font-medium text-amber-700 underline"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded bg-white/70 p-2">
                {appleDebugEntries.length === 0 ? (
                  <p className="text-[11px] text-amber-700">Waiting for Apple sign-in logs...</p>
                ) : (
                  appleDebugEntries.map((entry, index) => (
                    <div key={`${entry.timestamp}-${index}`} className="text-[11px] text-gray-700">
                      <p className="font-medium">{entry.message}</p>
                      {entry.details && (
                        <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-gray-600">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Legal Disclaimer */}
          <div className="text-center text-xs md:text-sm text-gray-500 dark:text-gray-400 pt-4 md:pt-6">
            <p className="mb-1 md:mb-2">
              By continuing, you agree to our
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              <Link to="/terms" className="underline hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Terms of Service</Link>
              <span>•</span>
              <Link to="/privacy" className="underline hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Privacy Policy</Link>
              <span>•</span>
              <Link to="/content-policy" className="underline hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Content Policy</Link>
            </div>
          </div>
        </div>
        </div>
      </div>
    </AnimatedPage>
  )
}
