import { useState, useRef, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Mail, ChevronDown, Phone, Apple } from "lucide-react"
import { setAuthData } from "@/lib/utils/auth"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { restaurantAPI } from "@/lib/api"
import { firebaseAuth, googleProvider, appleProvider, ensureFirebaseInitialized } from "@/lib/firebase"
import { hasFlutterGoogleBridge, nativeGoogleSignIn } from "@/lib/utils/flutterGoogleAuthBridge"
import { useCompanyName } from "@/lib/hooks/useCompanyName"

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

export default function RestaurantLogin() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [loginMethod, setLoginMethod] = useState("phone") // "phone" or "email"
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
    email: "",
  })
  const [errors, setErrors] = useState({
    phone: "",
    email: "",
  })
  const [touched, setTouched] = useState({
    phone: false,
    email: false,
  })
  const [isSending, setIsSending] = useState(false)
  const [isAppleLoading, setIsAppleLoading] = useState(false)
  const [apiError, setApiError] = useState("")
  const isIOSBrowser = /iPad|iPhone|iPod/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  )

  // Prefill phone when user comes back from OTP screen
  useEffect(() => {
    const stored = sessionStorage.getItem("restaurantAuthData")
    if (!stored) return
    try {
      const data = JSON.parse(stored)
      if (data.phone) {
        const match = data.phone.match(/^(\+\d+)\s*(\d*)/)
        if (match) {
          const [, code, num] = match
          setFormData((prev) => ({
            ...prev,
            countryCode: code || prev.countryCode,
            phone: (num || "").replace(/\D/g, "").slice(0, code === "+91" ? 10 : 15),
          }))
        }
      }
    } catch (_) { }
  }, [])

  // Get selected country details dynamically
  const selectedCountry = countryCodes.find(c => c.code === formData.countryCode) || countryCodes[2] // Default to India (+91)

  // Phone number validation
  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required"
    }

    // Remove any non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, "")

    // Minimum length check (at least 7 digits)
    if (digitsOnly.length < 7) {
      return "Phone number must be at least 7 digits"
    }

    // Maximum length check (typically 15 digits for international numbers)
    if (digitsOnly.length > 15) {
      return "Phone number is too long"
    }

    // Country-specific validation (India +91)
    if (countryCode === "+91") {
      if (digitsOnly.length !== 10) {
        return "Indian phone number must be 10 digits"
      }
      // Check if it starts with valid Indian mobile prefixes
      const firstDigit = digitsOnly[0]
      if (!["6", "7", "8", "9"].includes(firstDigit)) {
        return "Invalid Indian mobile number"
      }
    }

    return ""
  }

  const handleSendOTP = async () => {
    // Mark all fields as touched
    setTouched({ phone: true })
    setApiError("")

    // Validate
    const phoneError = validatePhone(formData.phone, formData.countryCode)

    if (phoneError) {
      setErrors({ phone: phoneError })
      return
    }

    // Clear errors if validation passes
    setErrors({ phone: "" })

    // Build full phone in E.164-ish format (e.g. +91xxxxxxxxxx)
    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)

      // Call backend to send OTP for login
      await restaurantAPI.sendOTP(fullPhone, "login")

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/restaurant/otp")
    } catch (error) {
      // Extract backend error message if available
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setApiError(message)
    } finally {
      setIsSending(false)
    }
  }

  // Email validation
  const validateEmail = (email) => {
    if (!email || email.trim() === "") {
      return "Email is required"
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address"
    }

    return ""
  }

  const handleEmailChange = (e) => {
    const value = e.target.value
    const newFormData = {
      ...formData,
      email: value,
    }
    setFormData(newFormData)

    // Validate if field has been touched
    if (touched.email) {
      const error = validateEmail(value)
      setErrors({ ...errors, email: error })
    }
  }

  const handleEmailBlur = () => {
    setTouched({ ...touched, email: true })
    const error = validateEmail(formData.email)
    setErrors({ ...errors, email: error })
  }

  const handleEmailLogin = () => {
    setLoginMethod("email")
  }

  const handleSendEmailOTP = async () => {
    // Mark email field as touched
    setTouched({ ...touched, email: true })
    setApiError("")

    // Validate
    const emailError = validateEmail(formData.email)

    if (emailError) {
      setErrors({ ...errors, email: emailError })
      return
    }

    // Clear errors if validation passes
    setErrors({ ...errors, email: "" })

    try {
      setIsSending(true)

      // Call backend API to send OTP via email
      await restaurantAPI.sendOTP(null, "login", formData.email)

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "email",
        email: formData.email,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/restaurant/otp")
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setApiError(message)
    } finally {
      setIsSending(false)
    }
  }

  const redirectHandledRef = useRef(false)

  const resolveFirebaseProvider = (user, providerOverride = null) => {
    if (providerOverride) return providerOverride

    const providerId = (user?.providerData || [])
      .find((providerData) => ["google.com", "apple.com"].includes(providerData?.providerId))
      ?.providerId

    return providerId === "apple.com" ? "apple" : "google"
  }

  // Helper function to process signed-in user
  const processSignedInUser = async (user, source = "unknown", providerOverride = null) => {
    if (redirectHandledRef.current) return
    redirectHandledRef.current = true
    setIsSending(true)
    setApiError("")

    try {
      const provider = resolveFirebaseProvider(user, providerOverride)
      const idToken = await user.getIdToken(true)
      const response = provider === "apple"
        ? await restaurantAPI.firebaseAppleLogin(idToken)
        : await restaurantAPI.firebaseGoogleLogin(idToken)
      const data = response?.data?.data || {}

      const accessToken = data.accessToken
      const restaurant = data.restaurant

      if (accessToken && restaurant) {
        setAuthData("restaurant", accessToken, restaurant)
        window.dispatchEvent(new Event("restaurantAuthChanged"))
        navigate("/restaurant", { replace: true })
      } else {
        throw new Error("Invalid response from server")
      }
    } catch (error) {
      console.error(`Authentication error from ${source}:`, error)
      redirectHandledRef.current = false
      setIsSending(false)
      setIsAppleLoading(false)
      setApiError(error?.response?.data?.message || error?.message || "Authentication failed")
    }
  }

  // Handle Firebase auth state and redirect results
  useEffect(() => {
    let unsubscribe = null

    const handleRedirectResult = async () => {
      try {
        // Ensure Firebase is fully initialized before using auth instance
        await ensureFirebaseInitialized()
        const { getRedirectResult } = await import("firebase/auth")
        if (!firebaseAuth) return

        let result = null
        try {
          result = await Promise.race([
            getRedirectResult(firebaseAuth),
            new Promise((resolve) => setTimeout(() => resolve(null), 3000))
          ])
        } catch (e) { result = null }

        if (result?.user) {
          await processSignedInUser(result.user, "redirect-result")
        } else if (firebaseAuth.currentUser && !redirectHandledRef.current) {
          await processSignedInUser(firebaseAuth.currentUser, "current-user-check")
        }
      } catch (error) {
        console.error("❌ Google sign-in check error:", error)
        setIsSending(false)
      }
    }

    const setupAuthListener = async () => {
      try {
        // Ensure Firebase is fully initialized before attaching listener
        await ensureFirebaseInitialized()
        const { onAuthStateChanged } = await import("firebase/auth")
        if (!firebaseAuth) return

        unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
          if (user && !redirectHandledRef.current) {
            await processSignedInUser(user, "auth-state-listener")
          }
        })
      } catch (e) {
        console.error("❌ Auth listener error:", e)
      }
    }

    setupAuthListener()
    setTimeout(handleRedirectResult, 500)

    return () => { if (unsubscribe) unsubscribe() }
  }, [navigate])

  const handleGoogleLogin = async () => {
    setApiError("")
    setIsSending(true)
    redirectHandledRef.current = false

    try {
      // Ensure Firebase Auth + Google provider are initialized
      await ensureFirebaseInitialized()
      if (!firebaseAuth || !googleProvider) {
        throw new Error("Firebase is not configured correctly for Google login")
      }

      // 1) Flutter WebView bridge path
      if (hasFlutterGoogleBridge()) {
        const flutterResult = await nativeGoogleSignIn()

        const flutterToken = flutterResult?.idToken || flutterResult?.accessToken || ""
        if (!flutterResult?.success || !flutterToken) {
          setIsSending(false)
          const cancelledMessage = flutterResult?.cancelled
            ? "Google sign-in was cancelled."
            : "Google sign-in cancelled or failed. Please try again."
          setApiError(cancelledMessage)
          console.warn("[Google][Flutter] Unexpected nativeGoogleSignIn payload:", flutterResult?.raw || flutterResult)
          return
        }

        const idToken = flutterToken

        // 2) Preferred: use Firebase credential with idToken
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
          // 3) Fallback: call backend directly
          console.warn(
            "Flutter Google token credential failed; falling back to backend login:",
            credentialError?.message || credentialError,
          )

          const response = await restaurantAPI.firebaseGoogleLogin(idToken)
          const data = response?.data?.data || {}

          const accessToken = data.accessToken
          const restaurant = data.restaurant

          if (accessToken && restaurant) {
            redirectHandledRef.current = true
            setAuthData("restaurant", accessToken, restaurant)
            window.dispatchEvent(new Event("restaurantAuthChanged"))
            navigate("/restaurant", { replace: true })
            return
          }

          throw new Error("Invalid backend response during Flutter login fallback")
        }
      }

      // 4) Normal browser path
      const { signInWithPopup, signInWithRedirect } = await import("firebase/auth")

      // iOS browsers are more reliable with redirect auth flow.
      if (isIOSBrowser) {
        await signInWithRedirect(firebaseAuth, googleProvider)
        return
      }

      const result = await signInWithPopup(firebaseAuth, googleProvider)
      if (result?.user) {
        await processSignedInUser(result.user, "popup-result")
      }
    } catch (error) {
      console.error("Firebase Google login error:", error)
      setIsSending(false)
      if (error?.code === "auth/popup-blocked") {
        try {
          const { signInWithRedirect } = await import("firebase/auth")
          await signInWithRedirect(firebaseAuth, googleProvider)
          return
        } catch (_) {}
      }
      if (error?.code !== "auth/popup-closed-by-user") {
        setApiError(error?.message || "Google sign-in failed")
      }
    }
  }

  const handleAppleLogin = async () => {
    setApiError("")
    setIsAppleLoading(true)
    redirectHandledRef.current = false

    try {
      await ensureFirebaseInitialized()

      if (!firebaseAuth || !appleProvider) {
        throw new Error("Firebase is not configured correctly for Apple login")
      }

      const {
        browserLocalPersistence,
        setPersistence,
        signInWithPopup,
      } = await import("firebase/auth")

      await setPersistence(firebaseAuth, browserLocalPersistence)

      const result = await signInWithPopup(firebaseAuth, appleProvider)
      if (result?.user) {
        await processSignedInUser(result.user, "apple-popup-result", "apple")
        return
      }

      throw new Error("Apple sign-in completed without returning a Firebase user")
    } catch (error) {
      console.error("Firebase Apple login error:", error)
      redirectHandledRef.current = false
      setApiError(
        error?.code === "auth/popup-blocked"
          ? "Popup was blocked. Please allow popups and try again."
          : error?.code === "auth/popup-closed-by-user"
            ? "Apple sign-in was cancelled."
            : error?.message || "Apple sign-in failed",
      )
    } finally {
      setIsAppleLoading(false)
      setIsSending(false)
    }
  }

  const maxPhoneLength = formData.countryCode === "+91" ? 10 : 15

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, maxPhoneLength)
    setFormData((prev) => ({ ...prev, phone: value }))
    setErrors((prev) => ({ ...prev, phone: validatePhone(value, formData.countryCode) }))
    if (!touched.phone && value.length > 0) setTouched((prev) => ({ ...prev, phone: true }))
  }

  const handlePhoneBlur = () => {
    // Mark as touched on blur if not already touched
    if (!touched.phone) {
      setTouched({ ...touched, phone: true })
    }
    // Re-validate on blur
    const error = validatePhone(formData.phone, formData.countryCode)
    setErrors({ ...errors, phone: error })
  }

  const handleCountryCodeChange = (value) => {
    const maxLen = value === "+91" ? 10 : 15
    const trimmed = (formData.phone || "").replace(/\D/g, "").slice(0, maxLen)
    setFormData((prev) => ({ ...prev, countryCode: value, phone: trimmed }))
    if (trimmed) setErrors((prev) => ({ ...prev, phone: validatePhone(trimmed, value) }))
  }

  const isValidPhone = !errors.phone && formData.phone.trim().length > 0
  const isValidEmail = !errors.email && formData.email.trim().length > 0

  return (
    <div className="max-h-screen h-screen bg-white flex flex-col">
      {/* Header - no back button per requirement */}
      <div className="relative flex items-center justify-center py-4 px-4 mt-2" />

      {/* Top Section - Logo and Badge */}
      <div className="flex flex-col items-center pt-8 pb-8 px-6">
        {/* Tifunbox Logo */}
        <div>
          <h1
            className="text-3xl italic md:text-4xl tracking-wide font-extrabold text-black"
            style={{
              WebkitTextStroke: "0.5px black",
              textStroke: "0.5px black"
            }}
          >

            {companyName.toLowerCase()}
          </h1>
        </div>

        {/* Restaurant Partner Badge */}
        <div className="">
          <span className="text-gray-600 font-light text-sm tracking-wide block text-center">
            — restaurant partner —
          </span>
        </div>
      </div>

      {/* Main Content - Form Section */}
      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        <div className="w-full max-w-md mx-auto space-y-6 py-4">
          {/* Instruction Text */}
          <div className="text-center">
            <p className="text-base text-gray-700 leading-relaxed">
              {loginMethod === "email"
                ? "Enter your registered email and we will send an OTP to continue"
                : "Enter your registered phone number and we will send an OTP to continue"
              }
            </p>
          </div>

          {/* Phone Number Input */}
          {loginMethod === "phone" && (
            <div className="space-y-4">
              <div className="flex gap-2 items-stretch w-full">
                {/* Country Code Selector */}
                <Select
                  value={formData.countryCode}
                  onValueChange={handleCountryCodeChange}
                >
                  <SelectTrigger className="w-[100px] h-12 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center shrink-0" style={{ height: '48px' }}>
                    <SelectValue>
                      <span className="flex items-center gap-1.5">
                        <span className="text-base">{selectedCountry.flag}</span>
                        <span className="text-sm font-medium text-gray-900">{selectedCountry.code}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {countryCodes.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        <span className="flex items-center gap-2">
                          <span>{country.flag}</span>
                          <span>{country.code}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Phone Number Input */}
                <div className="flex-1 flex flex-col">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    onBlur={handlePhoneBlur}
                    className={`w-full px-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 text-base border rounded-lg min-w-0 bg-white ${errors.phone && formData.phone.length > 0
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      }`}
                    style={{ height: '48px' }}
                  />
                  {errors.phone && formData.phone.length > 0 && (
                    <p className="text-red-500 text-xs mt-1 ml-1">{errors.phone}</p>
                  )}
                </div>
              </div>

              {/* API error */}
              {apiError && (
                <p className="text-red-500 text-xs mt-1 ml-1">{apiError}</p>
              )}

              {/* Send OTP Button */}
              <Button
                onClick={handleSendOTP}
                disabled={!isValidPhone || isSending}
                className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${isValidPhone && !isSending
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {isSending ? "Sending OTP..." : "Send OTP"}
              </Button>
            </div>
          )}

          {/* Email Input */}
          {loginMethod === "email" && (
            <div className="space-y-4">
              <div className="flex flex-col">
                <input
                  type="email"
                  inputMode="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  className={`w-full px-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 text-base border rounded-lg bg-white ${errors.email && formData.email.length > 0
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    }`}
                  style={{ height: '48px' }}
                />
                {errors.email && formData.email.length > 0 && (
                  <p className="text-red-500 text-xs mt-1 ml-1">{errors.email}</p>
                )}
              </div>

              {/* API error */}
              {apiError && (
                <p className="text-red-500 text-xs mt-1 ml-1">{apiError}</p>
              )}

              {/* Send OTP Button */}
              <Button
                onClick={handleSendEmailOTP}
                disabled={!isValidEmail || isSending}
                className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${isValidEmail && !isSending
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {isSending ? "Sending OTP..." : "Send OTP"}
              </Button>
            </div>
          )}

          {/* OR Separator */}
          <div className="relative flex items-center py-4">
            <div className="flex-1 border-t border-gray-500"></div>
            <span className="px-4 text-sm font-medium text-gray-600">OR</span>
            <div className="flex-1 border-t border-gray-500"></div>
          </div>

          {/* Alternative Login Options */}
          <div className="space-y-3">
            {/* Login with Email Button */}
            <Button
              onClick={() => {
                if (loginMethod === "phone") {
                  handleEmailLogin()
                } else {
                  setLoginMethod("phone")
                }
              }}
              variant="outline"
              className="w-full h-12 rounded-lg border border-gray- hover:border-gray-400 hover:bg-gray-50 text-gray-900 font-semibold text-base flex items-center justify-center gap-3"
            >
              {loginMethod === "email" ? <Phone className="w-5 h-5 mr-auto text-blue-600" /> : <Mail className="w-5 h-5 mr-auto text-blue-600" />}
              <span className="mr-auto text-gray-900">
                {loginMethod === "phone" ? "Login with Email" : "Back to Phone"}
              </span>
            </Button>

            {/* Login with Google Button */}
            <Button
              onClick={handleGoogleLogin}
              disabled={isSending || isAppleLoading}
              variant="outline"
              className="w-full h-12 rounded-lg border border-gray- hover:border-gray-400 hover:bg-gray-50 text-gray-900 font-semibold text-base flex items-center justify-center gap-3"
            >
              {/* Google Logo SVG */}
              <svg className="w-5 h-5 mr-auto" viewBox="0 0 24 24">
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
              <span className="mr-auto text-gray-900">Login with Google</span>
            </Button>

            <Button
              onClick={handleAppleLogin}
              disabled={isSending || isAppleLoading}
              variant="outline"
              className="w-full h-12 rounded-lg border border-gray- hover:border-gray-400 hover:bg-gray-50 text-gray-900 font-semibold text-base flex items-center justify-center gap-3"
            >
              <Apple className="w-5 h-5 mr-auto text-black" />
              <span className="mr-auto text-gray-900">
                {isAppleLoading ? "Signing in with Apple" : "Login with Apple"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Section - Terms and Conditions */}
      <div className="px-6 pb-8 pt-4">
        <div className="w-full max-w-md mx-auto">
          <p className="text-xs text-center text-gray-600 leading-relaxed">
            By continuing, you agree to our{" "}
            <Link to="/restaurant/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
            {" | "}
            <Link to="/restaurant/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
            {" | "}
            <span className="text-gray-600">Code of Conduct</span>
          </p>
        </div>
      </div>
    </div>
  )
}

