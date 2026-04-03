import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import AnimatedPage from "../../../user/components/AnimatedPage"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { deliveryAPI } from "@/lib/api"
import { setAuthData as storeAuthData } from "@/lib/utils/auth"

export default function DeliveryOTP() {
  const navigate = useNavigate()
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [verifiedOtp, setVerifiedOtp] = useState("")
  const inputRefs = useRef([])

  useEffect(() => {
    // Get auth data from sessionStorage (delivery module key)
    // If this exists, user has just started a fresh login flow and
    // we should NOT auto-redirect using any existing token.
    const stored = sessionStorage.getItem("deliveryAuthData")
    if (!stored) {
      // No pending OTP flow; if a valid delivery session exists, go to home,
      // otherwise send user to sign-in.
      const token = localStorage.getItem("delivery_accessToken")
      const authenticated = localStorage.getItem("delivery_authenticated") === "true"

      if (token && authenticated) {
        try {
          const parts = token.split(".")
          if (parts.length === 3) {
            const payload = JSON.parse(
              atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
            )
            const now = Math.floor(Date.now() / 1000)
            if (payload.exp && payload.exp > now) {
              navigate("/delivery", { replace: true })
              return
            }
          }
        } catch (e) {
          // Token parsing failed, fall through to sign-in
        }
      }

      navigate("/delivery/sign-in", { replace: true })
      return
    }
    const data = JSON.parse(stored)
    setAuthData(data)

    // OTP field should be empty - delivery boy needs to enter it manually
    // No auto-fill for delivery OTP

    // Start resend timer (60 seconds)
    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Don't auto-focus - let user manually enter OTP
    // Focus first input only if all fields are empty (small delay to ensure inputs are rendered)
    if (inputRefs.current[0] && otp.every(digit => digit === "")) {
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    }
  }, [otp])

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are entered and we are in OTP step
    if (!showNameInput && newOtp.every((digit) => digit !== "") && newOtp.length === 6) {
      handleVerify(newOtp.join(""))
    }
  }

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace") {
      if (otp[index]) {
        // If current input has value, clear it
        const newOtp = [...otp]
        newOtp[index] = ""
        setOtp(newOtp)
      } else if (index > 0) {
        // If current input is empty, move to previous and clear it
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
    // Handle paste
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 6).split("")
        const newOtp = [...otp]
        digits.forEach((digit, i) => {
          if (i < 6) {
            newOtp[i] = digit
          }
        })
        setOtp(newOtp)
        if (digits.length === 6) {
          handleVerify(newOtp.join(""))
        } else {
          inputRefs.current[digits.length]?.focus()
        }
      })
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 6).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 6) {
        newOtp[i] = digit
      }
    })
    setOtp(newOtp)
    if (!showNameInput && digits.length === 6) {
      handleVerify(newOtp.join(""))
      return
    } 
    inputRefs.current[digits.length]?.focus()
  }

  const handleVerify = async (otpValue = null) => {
    if (showNameInput) {
      // In name collection step, ignore OTP auto-submit
      return
    }

    const code = otpValue || otp.join("")
    
    if (code.length !== 6) {
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.phone
      if (!phone) {
        setError("Phone number not found. Please try again.")
        setIsLoading(false)
        return
      }

      // First attempt: verify OTP for login
      const response = await deliveryAPI.verifyOTP(phone, code, "login")
      const data = response?.data?.data || {}

      const userStatus = data?.user?.status
      const skipSignupForApproved =
        userStatus === "approved" || userStatus === "active"

      // Check if user needs to complete signup (but never force it
      // for already approved/active riders).
      if (data.needsSignup && !skipSignupForApproved) {
        // Store tokens for authenticated signup flow
        const accessToken = data.accessToken
        const user = data.user

        if (!accessToken || !user) {
          throw new Error("Invalid response from server")
        }

        // Store auth data using utility function
        try {
          console.log("Storing auth data for signup flow:", { hasToken: !!accessToken, hasUser: !!user })
          storeAuthData("delivery", accessToken, user)
          console.log("Auth data stored successfully for signup")
        } catch (storageError) {
          console.error("Failed to store authentication data:", storageError)
          setError("Failed to save authentication. Please try again or clear your browser storage.")
          setIsLoading(false)
          return
        }

        // Dispatch custom event
        window.dispatchEvent(new Event("deliveryAuthChanged"))

        // Redirect to signup step 1 after token is stored
        setTimeout(() => {
          navigate("/delivery/signup/details", { replace: true })
        }, 200)
        setIsLoading(false)
        return
      }

      // Otherwise, OTP verified and user logged in (existing user with complete profile)
      const accessToken = data.accessToken
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      // Clear auth data from sessionStorage
      sessionStorage.removeItem("deliveryAuthData")

      // Store auth data using utility function to ensure proper role handling
      // The setAuthData function includes error handling and verification
      try {
        console.log("Storing auth data for delivery:", { hasToken: !!accessToken, hasUser: !!user })
        storeAuthData("delivery", accessToken, user)
        console.log("Auth data stored successfully")
      } catch (storageError) {
        console.error("Failed to store authentication data:", storageError)
        setError("Failed to save authentication. Please try again or clear your browser storage.")
        setIsLoading(false)
        return
      }

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("deliveryAuthChanged"))

      setSuccess(true)
      setIsLoading(false)

      // Verify token is stored and then navigate
      let retryCount = 0
      const maxRetries = 10
      const verifyAndNavigate = () => {
        const storedToken = localStorage.getItem("delivery_accessToken")
        const storedAuth = localStorage.getItem("delivery_authenticated")
        
        console.log("Verifying token storage:", { hasToken: !!storedToken, authenticated: storedAuth, retryCount })
        
        if (storedToken && storedAuth === "true") {
          // Token is stored, navigate to delivery home
          console.log("Token verified, navigating to /delivery")
          navigate("/delivery", { replace: true })
        } else if (retryCount < maxRetries) {
          // Token not stored yet, retry after short delay
          retryCount++
          setTimeout(verifyAndNavigate, 100)
        } else {
          // Max retries reached, show error
          console.error("Token storage verification failed after max retries")
          setError("Failed to save authentication. Please try again.")
          setIsLoading(false)
        }
      }

      // Start verification after a small delay
      setTimeout(verifyAndNavigate, 200)
    } catch (err) {
      console.error("OTP Verification Error:", err)
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to verify OTP. Please try again."
      setError(message)
      setIsLoading(false)
    }
  }

  const handleSubmitName = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Name is required")
      return
    }

    if (!verifiedOtp) {
      setError("OTP verification step missing. Please request a new OTP.")
      return
    }

    setIsLoading(true)
    setError("")
    setNameError("")

    try {
      const phone = authData?.phone
      if (!phone) {
        setError("Phone number not found. Please try again.")
        return
      }

      // Second call with name to auto-register and login
      const response = await deliveryAPI.verifyOTP(phone, verifiedOtp, "login", trimmedName)
      const data = response?.data?.data || {}

      const accessToken = data.accessToken
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      // Clear auth data from sessionStorage
      sessionStorage.removeItem("deliveryAuthData")

      // Store auth data using utility function to ensure proper role handling
      // The setAuthData function includes error handling and verification
      try {
        console.log("Storing auth data for delivery (with name):", { hasToken: !!accessToken, hasUser: !!user })
        storeAuthData("delivery", accessToken, user)
        console.log("Auth data stored successfully")
      } catch (storageError) {
        console.error("Failed to store authentication data:", storageError)
        setError("Failed to save authentication. Please try again or clear your browser storage.")
        setIsLoading(false)
        return
      }

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("deliveryAuthChanged"))

      setSuccess(true)
      setIsLoading(false)

      // Verify token is stored and then navigate
      let retryCount = 0
      const maxRetries = 10
      const verifyAndNavigate = () => {
        const storedToken = localStorage.getItem("delivery_accessToken")
        const storedAuth = localStorage.getItem("delivery_authenticated")
        
        console.log("Verifying token storage (with name):", { hasToken: !!storedToken, authenticated: storedAuth, retryCount })
        
        if (storedToken && storedAuth === "true") {
          // Token is stored, navigate to delivery home
          console.log("Token verified, navigating to /delivery")
          navigate("/delivery", { replace: true })
        } else if (retryCount < maxRetries) {
          // Token not stored yet, retry after short delay
          retryCount++
          setTimeout(verifyAndNavigate, 100)
        } else {
          // Max retries reached, show error
          console.error("Token storage verification failed after max retries")
          setError("Failed to save authentication. Please try again.")
          setIsLoading(false)
        }
      }

      // Start verification after a small delay
      setTimeout(verifyAndNavigate, 200)
    } catch (err) {
      console.error("Name Submission Error:", err)
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to complete registration. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return

    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.phone
      if (!phone) {
        setError("Phone number not found. Please go back and try again.")
        return
      }

      const purpose = authData?.isSignUp ? "register" : "login"
      await deliveryAPI.sendOTP(phone, purpose)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to resend OTP. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }

    // Reset timer to 60 seconds
    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setOtp(["", "", "", "", "", ""])
    setShowNameInput(false)
    setName("")
    setNameError("")
    setVerifiedOtp("")
    inputRefs.current[0]?.focus()
  }

  const getPhoneNumber = () => {
    if (!authData) return ""
    if (authData.method === "phone") {
      // Format phone number as +91-9098569620
      const phone = authData.phone || ""
      // Remove spaces and format
      const cleaned = phone.replace(/\s/g, "")
      // Add hyphen after country code if not present
      if (cleaned.startsWith("+91") && cleaned.length > 3) {
        return cleaned.slice(0, 3) + "-" + cleaned.slice(3)
      }
      return cleaned
    }
    return authData.email || ""
  }

  if (!authData) {
    return null
  }

  return (
    <AnimatedPage className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="relative flex items-center justify-center py-4 px-4 border-b border-gray-200">
        <button
          onClick={() => navigate("/delivery/sign-in")}
          className="absolute left-4 top-1/2 -translate-y-1/2"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-black" />
        </button>
        <h1 className="text-lg font-bold text-black">OTP Verification</h1>
      </div> 

      {/* Main Content */}
      <div className="flex flex-col justify-center px-6 pt-8 pb-12">
        <div className="max-w-md mx-auto w-full space-y-8">
          {/* Message */}
          <div className="text-center space-y-2">
            <p className="text-base text-black">
              {showNameInput
                ? "You're almost done! Please tell us your name to complete registration."
                : "We have sent a verification code to"}
            </p>
            {!showNameInput && (
              <p className="text-base text-black font-medium">
                {getPhoneNumber()}
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-500 text-center">
              {error}
            </p>
          )}

          {/* OTP Input Fields */}
          {!showNameInput && (
            <>
              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    disabled={isLoading}
                    autoComplete="off"
                    autoFocus={false}
                    className="w-12 h-12 text-center text-lg font-semibold p-0 border border-black rounded-md focus-visible:ring-0 focus-visible:border-black bg-white"
                  />
                ))}
              </div>

              {/* Resend Section */}
              <div className="text-center space-y-1">
                <p className="text-sm text-black">
                  Didn't get the OTP?
                </p>
                {resendTimer > 0 ? (
                  <p className="text-sm text-gray-500">
                    Resend SMS in {resendTimer}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    Resend SMS
                  </button>
                )}
              </div>
            </>
          )}

          {/* Name Input (shown only after OTP verified and user is new) */}
          {showNameInput && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-black text-left">
                  Full name
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (nameError) setNameError("")
                  }}
                  disabled={isLoading}
                  placeholder="Enter your name"
                  className={`h-11 border ${
                    nameError ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {nameError && (
                  <p className="text-xs text-red-500 text-left">
                    {nameError}
                  </p>
                )}
              </div>

              <Button
                onClick={handleSubmitName}
                disabled={isLoading}
                className="w-full h-11 bg-[#00B761] hover:bg-[#00A055] text-white font-semibold"
              >
                {isLoading ? "Continuing..." : "Continue"}
              </Button>
            </div>
          )}

          {/* Loading Spinner */}
          {isLoading && !showNameInput && (
            <div className="flex justify-center pt-4">
              <Loader2 className="h-6 w-6 text-red-500 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Go back to login methods */}
      <div className="pt-4 mt-auto px-6 text-center pb-8">
        <button
          type="button"
          onClick={() => navigate("/delivery/sign-in")}
          className="text-sm text-[#E23744] hover:underline"
        >
          Go back to login methods
        </button>
      </div>
    </AnimatedPage>
  )
}