import { useEffect, useRef, useState } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { Apple, AlertCircle, ChevronDown, Loader2, Mail, Check } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { authAPI } from "@food/api"
import { setAuthData as setUserAuthData } from "@food/utils/auth"
import { getFirebaseAuth, getGoogleAuthProvider } from "@food/firebase"
import { toast } from "sonner"
import logoNew from "@food/assets/logo.png"

const REMEMBER_LOGIN_KEY = "user_login_phone"
const APPLE_SDK_SRC = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
const APPLE_REDIRECT_URI_FALLBACK =
  import.meta.env.VITE_APPLE_USER_REDIRECT_URI || import.meta.env.VITE_APPLE_REDIRECT_URI || ""

const loadAppleSdk = () =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Apple sign-in is only available in the browser"))
      return
    }

    if (window.AppleID?.auth) {
      resolve(window.AppleID)
      return
    }

    const existingScript = document.querySelector(`script[src="${APPLE_SDK_SRC}"]`)
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.AppleID), { once: true })
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Apple sign-in SDK")), {
        once: true,
      })
      return
    }

    const script = document.createElement("script")
    script.src = APPLE_SDK_SRC
    script.async = true
    script.onload = () => resolve(window.AppleID)
    script.onerror = () => reject(new Error("Failed to load Apple sign-in SDK"))
    document.head.appendChild(script)
  })

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
  })
  const [rememberLogin, setRememberLogin] = useState(true)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isAppleLoading, setIsAppleLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    const storedPhone = localStorage.getItem(REMEMBER_LOGIN_KEY) || ""
    if (storedPhone) {
      setFormData((prev) => ({ ...prev, phone: storedPhone }))
      setRememberLogin(true)
      return
    }

    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) return

    try {
      const data = JSON.parse(stored)
      const fullPhone = String(data.phone || "").trim()
      const phoneDigits = fullPhone.replace(/^\+91\s*/, "").replace(/\D/g, "").slice(0, 10)
      setFormData((prev) => ({
        ...prev,
        phone: phoneDigits || prev.phone,
      }))
    } catch {
      // Ignore invalid session data and keep the form empty.
    }
  }, [])

  const validatePhone = (phone) => {
    if (!phone.trim()) return "Phone number is required"
    const cleanPhone = phone.replace(/\D/g, "")
    if (!/^\d{10}$/.test(cleanPhone)) return "Phone number must be exactly 10 digits"
    return ""
  }

  const handleChange = (e) => {
    const { name } = e.target
    let { value } = e.target

    if (name === "phone") {
      value = value.replace(/\D/g, "").slice(0, 10)
      setError(validatePhone(value))
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const phoneError = validatePhone(formData.phone)
    setError(phoneError)
    if (phoneError) return
    if (submittingRef.current) return

    submittingRef.current = true
    setIsLoading(true)
    setError("")

    try {
      const countryCode = formData.countryCode?.trim() || "+91"
      const phoneDigits = String(formData.phone ?? "").replace(/\D/g, "").slice(0, 10)
      const fullPhone = `${countryCode} ${phoneDigits}`

      await authAPI.sendOTP(fullPhone, "login", null)

      if (rememberLogin) {
        localStorage.setItem(REMEMBER_LOGIN_KEY, phoneDigits)
      } else {
        localStorage.removeItem(REMEMBER_LOGIN_KEY)
      }

      const ref = String(searchParams.get("ref") || "").trim()
      const authData = {
        method: "phone",
        phone: fullPhone,
        email: null,
        name: null,
        referralCode: ref || null,
        isSignUp: false,
        module: "user",
      }

      sessionStorage.setItem("userAuthData", JSON.stringify(authData))
      navigate("/food/user/auth/otp")
    } catch (apiError) {
      const message =
        apiError?.response?.data?.message ||
        apiError?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
      submittingRef.current = false
    }
  }

  const showProviderComingSoon = (provider) => {
    toast.message(`${provider} sign-in will be added on this screen soon.`)
  }

  const handleAppleSignIn = async () => {
    if (isAppleLoading) return

    setIsAppleLoading(true)
    setError("")

    try {
      const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "")
      const configResponse = await fetch(`${apiBaseUrl}/food/public/env`)
      const configPayload = await configResponse.json().catch(() => ({}))
      const publicConfig = configPayload?.data || {}
      const clientId = publicConfig.APPLE_CLIENT_ID || publicConfig.VITE_APPLE_CLIENT_ID
      const redirectURI =
        publicConfig.APPLE_USER_REDIRECT_URI ||
        publicConfig.VITE_APPLE_USER_REDIRECT_URI ||
        publicConfig.APPLE_REDIRECT_URI ||
        publicConfig.VITE_APPLE_REDIRECT_URI ||
        APPLE_REDIRECT_URI_FALLBACK

      if (!configResponse.ok || !clientId || !redirectURI) {
        throw new Error("Apple sign-in is not configured yet")
      }

      await loadAppleSdk()

      if (!window.AppleID?.auth) {
        throw new Error("Apple sign-in SDK is unavailable")
      }

      const state = `apple_user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      sessionStorage.setItem("appleAuthState", state)

      window.AppleID.auth.init({
        clientId,
        scope: "name email",
        redirectURI,
        state,
        usePopup: false,
      })

      await window.AppleID.auth.signIn()
    } catch (providerError) {
      const message =
        providerError?.message || "Apple sign-in could not be started. Please try again."
      setError(message)
      toast.error(message)
      setIsAppleLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading) return

    setIsGoogleLoading(true)
    setError("")

    try {
      const [{ signInWithPopup }, firebaseAuth, googleProvider] = await Promise.all([
        import("firebase/auth"),
        Promise.resolve(getFirebaseAuth()),
        Promise.resolve(getGoogleAuthProvider()),
      ])

      googleProvider.setCustomParameters({ prompt: "select_account" })

      let fcmToken = null
      let platform = "web"
      try {
        if (typeof window !== "undefined") {
          if (window.flutter_inappwebview) {
            platform = "mobile"
            const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"]
            for (const handlerName of handlerNames) {
              try {
                const nativeToken = await window.flutter_inappwebview.callHandler(handlerName, { module: "user" })
                if (nativeToken && typeof nativeToken === "string" && nativeToken.length > 20) {
                  fcmToken = nativeToken.trim()
                  break
                }
              } catch {
                // Try the next bridge handler.
              }
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null
          }
        }
      } catch {
        // Ignore FCM token collection errors during auth.
      }

      const firebaseResult = await signInWithPopup(firebaseAuth, googleProvider)
      const idToken = await firebaseResult.user.getIdToken()
      const response = await authAPI.loginWithGoogle(idToken, fcmToken, platform)
      const data = response?.data?.data || response?.data || {}
      const accessToken = data.accessToken
      const refreshToken = data.refreshToken ?? null
      const user = data.user

      if (!accessToken || !refreshToken || !user) {
        throw new Error("Invalid response from server")
      }

      sessionStorage.removeItem("userAuthData")
      setUserAuthData("user", accessToken, user, refreshToken)
      window.dispatchEvent(new Event("userAuthChanged"))
      navigate("/food/user")
    } catch (providerError) {
      const message =
        providerError?.response?.data?.message ||
        providerError?.response?.data?.error ||
        providerError?.message ||
        "Google sign-in failed. Please try again."
      setError(message)
      toast.error(message)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <AnimatedPage className="min-h-screen bg-white flex items-start justify-center overflow-hidden px-4 py-3 sm:px-6">
      <div className="w-full max-w-[390px] bg-white px-5 py-5 pb-1 sm:px-7 sm:pt-7 sm:pb-1">
        <div className="flex flex-col">
          <div>
            <div className="flex min-h-[220px] items-center justify-center pt-3">
              <img
                src={logoNew}
                alt="Tifun Box"
                className="h-24 w-auto object-contain sm:h-28"
              />
            </div>

            <div className="mt-10 text-center">
              <h1 className="text-[1.6rem] sm:text-[1.8rem] font-semibold leading-[1.18] tracking-[-0.03em] text-black">
                India&apos;s #1 Food Delivery and Dining App
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
              <div className="flex items-stretch gap-3">
                <button
                  type="button"
                  className="flex min-w-[102px] items-center justify-between rounded-2xl border border-[#d7d5d2] bg-white px-4 text-[1rem] font-medium text-[#221f1b]"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">IN</span>
                    <span className="text-[#6a6662]">+91</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-[#8a847d]" />
                </button>

                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="Enter Phone Number"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`h-14 flex-1 rounded-2xl border bg-white px-4 text-lg text-[#7d4f1c] placeholder:text-[#9f6d37] focus-visible:ring-0 focus-visible:border-[#8a2323] ${
                    error ? "border-red-400" : "border-[#d7d5d2]"
                  }`}
                  aria-invalid={error ? "true" : "false"}
                />
              </div>

              {error ? (
                <div className="flex items-center gap-1.5 pl-1 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              ) : null}

              <label className="flex cursor-pointer items-center gap-3 pt-1 text-[0.98rem] text-[#3e3a36]">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => setRememberLogin(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md transition-colors ${
                    rememberLogin ? "bg-[#7d2323] text-white" : "border border-[#cfc7bf] bg-white text-transparent"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span>Remember my login for faster sign-in</span>
              </label>

              <Button
                type="submit"
                className="mt-2 h-14 w-full rounded-2xl bg-[#7d2323] text-lg font-bold text-white transition-all hover:bg-[#681b1b] active:scale-[0.99]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          </div>

          <div className="mt-12">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-[#d8d8d8]" />
              <span className="text-lg text-[#66615d]">or</span>
              <div className="h-px flex-1 bg-[#d8d8d8]" />
            </div>

            <div className="mt-3 flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={handleAppleSignIn}
                disabled={isAppleLoading}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Continue with Apple"
              >
                {isAppleLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Apple className="h-7 w-7 fill-current" />
                )}
              </button>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d8d8d8] bg-white transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Continue with Google"
              >
                {isGoogleLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[#5f6368]" />
                ) : (
                  <svg className="h-7 w-7" viewBox="0 0 24 24" aria-hidden="true">
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
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.14-4.53z"
                    />
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={() => showProviderComingSoon("Email")}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7d2323] text-white transition-transform hover:scale-[1.03]"
                aria-label="Continue with Email"
              >
                <Mail className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-6 text-center text-[0.78rem] leading-5 text-[#67635f]">
              <p>By continuing, you agree to our</p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                <Link to="/profile/terms" className="underline underline-offset-2 hover:text-black transition-colors">
                  Terms of Service
                </Link>
                <span>•</span>
                <Link to="/profile/privacy" className="underline underline-offset-2 hover:text-black transition-colors">
                  Privacy Policy
                </Link>
                <span>•</span>
                <Link to="/profile/refund" className="underline underline-offset-2 hover:text-black transition-colors">
                  Content Policy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  )
}
