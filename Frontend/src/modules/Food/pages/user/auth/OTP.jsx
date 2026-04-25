import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, Smartphone, AlertCircle } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Input } from "@food/components/ui/input"
import { Button } from "@food/components/ui/button"
import { authAPI } from "@food/api"
import { setAuthData as setUserAuthData } from "@food/utils/auth"

export default function OTP() {
  const gold = "#c89b3c"
  const goldDark = "#a67b22"
  const goldSoft = "#fff7e4"

  const navigate = useNavigate()
  const [otp, setOtp] = useState(["", "", "", ""]) // exactly 4 digits
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [verifiedOtp, setVerifiedOtp] = useState("")
  const [contactInfo, setContactInfo] = useState("")
  const [contactType, setContactType] = useState("phone")
  const [deviceToken, setDeviceToken] = useState(null)
  const [activePlatform, setActivePlatform] = useState("web")
  const inputRefs = useRef([])
  const submittingRef = useRef(false)

  useEffect(() => {
    // Redirect to home if already authenticated
    const isAuthenticated = localStorage.getItem("user_authenticated") === "true"
    if (isAuthenticated) {
      navigate("/food/user", { replace: true })
      return
    }

    // Get auth data from sessionStorage
    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) {
      // No auth data, redirect to sign in
      navigate("/user/auth/login", { replace: true })
      return
    }
    const data = JSON.parse(stored)
    setAuthData(data)

    // Handle both phone and email
    if (data.method === "email" && data.email) {
      setContactType("email")
      setContactInfo(data.email)
    } else if (data.phone) {
      setContactType("phone")
      // Extract and format phone number for display
      const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
      if (phoneMatch) {
        const formattedPhone = `${phoneMatch[1]}-${phoneMatch[2].replace(/\D/g, "")}`
        setContactInfo(formattedPhone)
      } else {
        setContactInfo(data.phone || "")
      }

      // OTP auto-fill removed - user must manually enter OTP
    }

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
  }, [navigate])

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0] && !showNameInput) {
      inputRefs.current[0].focus()
    }
  }, [showNameInput])

  const handleChange = (index, value) => {
    // Only allow digits; OTP is exactly 4 digits
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    // Auto-focus next input (4 boxes only)
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 4 digits are entered
    if (!showNameInput && newOtp.slice(0, 4).every((digit) => digit !== "")) {
      handleVerify(newOtp.slice(0, 4).join(""))
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
    // Handle paste (4 digits only)
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 4).split("")
        const newOtp = [...otp]
        digits.forEach((digit, i) => {
          if (i < 4) newOtp[i] = digit
        })
        setOtp(newOtp)
        if (!showNameInput && digits.length === 4) {
          handleVerify(newOtp.slice(0, 4).join(""))
        } else {
          inputRefs.current[Math.min(digits.length, 3)]?.focus()
        }
      })
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 4).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 4) newOtp[i] = digit
    })
    setOtp(newOtp)
    if (!showNameInput && digits.length === 4) {
      handleVerify(newOtp.slice(0, 4).join(""))
    } else {
      inputRefs.current[Math.min(digits.length, 3)]?.focus()
    }
  }

  const handleVerify = async (otpValue = null) => {
    if (showNameInput) return
    if (submittingRef.current) return

    const code = (otpValue || otp.join("")).replace(/\D/g, "")
    const code4 = code.slice(0, 4)
    if (code4.length !== 4) {
      setError("OTP must be exactly 4 digits")
      return
    }

    submittingRef.current = true
    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"
      const providedName = authData?.isSignUp ? authData?.name || null : null
      const referralCode = authData?.referralCode || null

      // Try to get FCM token before verifying OTP
      let fcmToken = null;
      let platform = "web";
      try {
        if (typeof window !== "undefined") {
          if (window.flutter_inappwebview) {
            platform = "mobile";
            const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"];
            for (const handlerName of handlerNames) {
              try {
                const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "user" });
                if (t && typeof t === "string" && t.length > 20) {
                  fcmToken = t.trim();
                  break;
                }
              } catch (e) {}
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e);
      }

      setDeviceToken(fcmToken);
      setActivePlatform(platform);

      const response = await authAPI.verifyOTP(
        phone,
        code4,
        purpose,
        providedName,
        email,
        "user",
        null,
        referralCode,
        fcmToken,
        platform
      )
      const data = response?.data?.data || response?.data || {}

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken ?? null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }
      if (!refreshToken) {
        throw new Error("Invalid response from server: missing refresh token")
      }

      // Check if user needs name prompt (isNewUser flag or missing name)
      const hasName = user.name && String(user.name).trim().length > 0 && String(user.name).toLowerCase() !== "null";
      const needsName = data.isNewUser === true || !hasName;

      if (needsName) {
        setVerifiedOtp(code4)
        setShowNameInput(true)
        setIsLoading(false)
        submittingRef.current = false
        return
      }

      // Clear auth data from sessionStorage
      sessionStorage.removeItem("userAuthData")

      setUserAuthData("user", accessToken, user, refreshToken)

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("userAuthChanged"))

      setSuccess(true)

      // Redirect to user home after short delay
      setTimeout(() => {
        navigate("/food/user")
      }, 500)
    } catch (err) {
      const status = err?.response?.status
      let message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to verify OTP. Please try again."

      if (/name is required for first-time signup/i.test(String(message))) {
        setVerifiedOtp(code4)
        setShowNameInput(true)
        setError("")
        setIsLoading(false)
        submittingRef.current = false
        return
      }

      if (status === 401) {
        // Friendlier copy for deactivated users or auth errors
        if (/deactivat(ed|e)/i.test(String(message))) {
          message = "Your account is deactivated. Please contact support."
        } else {
          message = "Invalid or expired code, or account not active."
        }
      }
      setError(message)
    } finally {
      setIsLoading(false)
      submittingRef.current = false
    }
  }

  const handleSubmitName = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Name is required")
      return
    }

    if (trimmedName.length < 2) {
      setNameError("Name must be at least 2 characters")
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
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"
      const referralCode = authData?.referralCode || null

      // Second call with name to auto-register and login
      const response = await authAPI.verifyOTP(
        phone,
        verifiedOtp,
        purpose,
        trimmedName,
        email,
        "user",
        null,
        referralCode,
        deviceToken,
        activePlatform
      )
      const data = response?.data?.data || response?.data || {}

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken ?? null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }
      if (!refreshToken) {
        throw new Error("Invalid response from server: missing refresh token")
      }

      sessionStorage.removeItem("userAuthData")

      setUserAuthData("user", accessToken, user, refreshToken)

      window.dispatchEvent(new Event("userAuthChanged"))

      setSuccess(true)

      setTimeout(() => {
        navigate("/food/user")
      }, 500)
    } catch (err) {
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
    if (resendTimer > 0 || isLoading) return

    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"

      // Call backend to resend OTP
      await authAPI.sendOTP(phone, purpose, email)
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

    setOtp(["", "", "", ""])
    setShowNameInput(false)
    setName("")
    setNameError("")
    setVerifiedOtp("")
    inputRefs.current[0]?.focus()
  }

  if (!authData) {
    return null
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#fffdf8] flex items-center justify-center p-4">
      <div className="w-full max-w-[450px] bg-white rounded-[1.75rem] shadow-[0_24px_60px_rgba(200,155,60,0.16)] relative z-10 overflow-hidden border border-[#f1dfaa]">
        {/* Header */}
        <div className="flex items-center px-6 py-4 border-b border-[#f5ead0]">
          <button
            onClick={() => navigate("/food/user/auth/login")}
            className="p-1 rounded-full transition-colors hover:bg-[#fff5dc]"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-[#7c6322]" />
          </button>
          <span className="ml-4 font-bold text-[#3d2d08]">
            {showNameInput ? "Welcome!" : "OTP Verification"}
          </span>
        </div>

        <div className="p-6 sm:p-8 md:p-10 space-y-6 md:space-y-8">
          {/* Message */}
          <div className="text-center space-y-4">
            {showNameInput && (
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f7ecd0]">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-[0_10px_24px_rgba(200,155,60,0.25)]"
                    style={{ background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)` }}
                  >
                    <Smartphone className="h-5 w-5" />
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <h2 className="text-xl md:text-2xl font-bold text-[#2f2308] leading-tight">
                {showNameInput 
                  ? "Help us know you better" 
                  : contactType === "email"
                    ? "Verify your email"
                    : "Verify your phone"}
              </h2>
              <p className="text-sm text-[#7f6f4d] max-w-xs mx-auto">
                {showNameInput
                  ? "We're excited to have you join us! Please tell us your full name to get started."
                  : `We've sent a 4-digit code to ${contactInfo}`}
              </p>
            </div>
          </div>

          {/* OTP Input Fields */}
          {!showNameInput && (
            <div className="space-y-6">
              <div className="flex justify-between gap-3 sm:gap-4 max-w-[280px] mx-auto">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    disabled={isLoading}
                    aria-label={`OTP digit ${index + 1} of 4`}
                    className="w-12 h-12 sm:w-14 sm:h-14 text-center text-xl font-bold border-2 border-[#ecd9a0] rounded-xl bg-[#fffdf8] text-[#2f2308] transition-all outline-none"
                    style={{ boxShadow: "none" }}
                  />
                ))}
              </div>

              {error && (
                <div className="flex items-center justify-center gap-1.5 rounded-lg bg-red-50 py-2 text-xs text-red-500">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Resend Section */}
              <div className="text-center">
                <p className="text-sm text-[#7f6f4d]">
                  Didn't get the OTP?{" "}
                  {resendTimer > 0 ? (
                    <span className="font-medium text-[#3d2d08]">Retry in {resendTimer}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isLoading}
                      className="font-bold transition-colors disabled:opacity-50"
                      style={{ color: goldDark }}
                    >
                      Resend SMS
                    </button>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Name Input */}
          {showNameInput && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (nameError) setNameError("")
                  }}
                  disabled={isLoading}
                  placeholder="Full Name"
                  className={`h-12 md:h-14 rounded-xl border text-lg text-[#3d2d08] placeholder:text-[#b18c45] ${nameError ? "border-red-500" : "border-[#d9bc73]"} transition-all`}
                  style={{ backgroundColor: goldSoft, boxShadow: "none" }}
                />
                {nameError && (
                  <p className="text-xs text-red-500 pl-1">
                    {nameError}
                  </p>
                )}
              </div>

              <Button
                onClick={handleSubmitName}
                disabled={isLoading}
                className="w-full h-12 md:h-14 rounded-xl text-lg font-bold text-[#3d2d08] transition-all active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, #f4d97b 0%, ${gold} 55%, ${goldDark} 100%)` }}
              >
                {isLoading ? "Getting things ready..." : "Finish Registration"}
              </Button>
            </div>
          )}

          {/* Verification Loading Overlay */}
          {isLoading && !showNameInput && (
            <div className="flex justify-center pt-2">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: goldDark }} />
            </div>
          )}
        </div>
        
        {/* Footer info */}
        <div className="bg-[#fffaf0] p-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#b39b67]">
                Tifunbox Food Delivery
            </p>
        </div>
      </div>
    </AnimatedPage>
  )
}

