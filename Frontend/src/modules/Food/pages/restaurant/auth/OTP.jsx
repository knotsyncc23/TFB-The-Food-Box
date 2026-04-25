import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ShieldCheck, Timer, RefreshCw, Store, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"
import {
  setAuthData as setRestaurantAuthData,
  setRestaurantPendingPhone,
} from "@food/utils/auth"
import { checkOnboardingStatus, isRestaurantOnboardingComplete } from "@food/utils/onboardingUtils"

export default function RestaurantOTP() {
  const navigate = useNavigate()
  const [otp, setOtp] = useState(["", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [contactInfo, setContactInfo] = useState("")
  const [focusedIndex, setFocusedIndex] = useState(null)
  const inputRefs = useRef([])
  const hasSubmittedRef = useRef(false)

  const primaryColor = "#7e3866"

  useEffect(() => {
    const stored = sessionStorage.getItem("restaurantAuthData")
    if (stored) {
      const data = JSON.parse(stored)
      setAuthData(data)

      if (data.method === "email" && data.email) {
        setContactInfo(data.email)
      } else if (data.phone) {
        const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
        if (phoneMatch) {
          const formattedPhone = `${phoneMatch[1]} ${phoneMatch[2].replace(/\D/g, "")}`
          setContactInfo(formattedPhone)
        } else {
          setContactInfo(data.phone || "")
        }
      }
    } else {
      navigate("/food/restaurant/login")
      return
    }

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
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newOtp.every((digit) => digit !== "")) {
      if (!hasSubmittedRef.current) {
        hasSubmittedRef.current = true
        handleVerify(newOtp.join(""))
      }
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
  }

  const handleVerify = async (otpValue = null) => {
    const code = otpValue || otp.join("")

    if (code.length !== 4) {
      toast.error("Please enter the complete 4-digit code")
      hasSubmittedRef.current = false
      return
    }

    setIsLoading(true)

    try {
      if (!authData) throw new Error("Session expired. Please login again.")

      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null
      const purpose = authData.isSignUp ? "register" : "login"

      const response = await restaurantAPI.verifyOTP(phone, code, purpose, null, email)
      const data = response?.data?.data || response?.data

      if (data?.needsRegistration) {
        setRestaurantPendingPhone(data.phone || phone)
        sessionStorage.removeItem("restaurantAuthData")
        navigate("/food/restaurant/onboarding", { replace: true })
        return
      }

      const accessToken = data?.accessToken
      const restaurant = data?.user ?? data?.restaurant

      if (accessToken && restaurant) {
        setRestaurantAuthData("restaurant", accessToken, restaurant, data?.refreshToken)
        window.dispatchEvent(new Event("restaurantAuthChanged"))
        sessionStorage.removeItem("restaurantAuthData")
        toast.success("Verification successful!")

        setTimeout(async () => {
          if (authData?.isSignUp) {
            navigate("/food/restaurant/onboarding", { replace: true })
          } else {
            const onboardingComplete = isRestaurantOnboardingComplete(restaurant)
            if (!onboardingComplete) {
              const incompleteStep = await checkOnboardingStatus()
              if (incompleteStep) {
                navigate(`/food/restaurant/onboarding?step=${incompleteStep}`, { replace: true })
                return
              }
            }
            navigate("/food/restaurant", { replace: true })
          }
        }, 800)
      }
    } catch (err) {
      const message = err?.response?.data?.message || "Invalid OTP. Please try again."
      
      if (/pending approval/i.test(message)) {
        const pendingPhone = authData?.phone || authData?.email || contactInfo
        setRestaurantPendingPhone(pendingPhone)
        navigate("/food/restaurant/pending-verification", {
          replace: true,
          state: { phone: pendingPhone || "" },
        })
        return
      }

      toast.error(message)
      setOtp(["", "", "", ""])
      hasSubmittedRef.current = false
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    setIsLoading(true)
    try {
      const purpose = authData.isSignUp ? "register" : "login"
      await restaurantAPI.sendOTP(authData.phone, purpose, authData.email)
      toast.success("New code sent!")
      setResendTimer(60)
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to resend code")
    } finally {
      setIsLoading(false)
    }
  }

  const isOtpComplete = otp.every((digit) => digit !== "")

  if (!authData) return null

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col relative overflow-hidden font-['Poppins']">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-[#7e3866]/10 via-[#7e3866]/5 to-transparent pointer-events-none" />
      <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-[#7e3866]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-[#7e3866]/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Header / Back */}
      <div className="relative z-20 px-6 py-8 flex items-center">
        <motion.button
          whileHover={{ x: -4 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/food/restaurant/login")}
          className="p-3 bg-white dark:bg-[#1a1a1a] shadow-xl shadow-[#7e3866]/10 rounded-2xl text-[#7e3866] border border-[#7e3866]/5 outline-none"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[440px]"
        >
          {/* Icon & Title */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 bg-[#7e3866] rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#7e3866]/30 relative"
            >
              <ShieldCheck className="text-white w-10 h-10" />
            </motion.div>
            
            <h1 className="text-4xl font-black text-[#7e3866] font-['Outfit'] tracking-tight mb-3">
              Verify Account
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              We've sent a 4-digit code to <br />
              <span className="text-[#7e3866] font-bold">{contactInfo}</span>
            </p>
          </div>

          {/* OTP Input Card */}
          <div className="bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-2xl rounded-[3rem] p-10 shadow-[0_40px_80px_-20px_rgba(126,56,102,0.2)] border border-white/20 dark:border-gray-800">
            <div className="grid grid-cols-4 gap-4 mb-10">
              {otp.map((digit, index) => (
                <div key={index} className="relative group">
                  <input
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="tel"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    className={`w-full aspect-square bg-gray-50 dark:bg-gray-900/50 text-center text-3xl font-black text-[#7e3866] border-2 border-transparent rounded-2xl outline-none transition-all ${
                      focusedIndex === index 
                        ? "border-[#7e3866] bg-white scale-105 shadow-[0_10px_30px_rgba(126,56,102,0.1)]" 
                        : "group-hover:border-gray-200 dark:group-hover:border-gray-700"
                    }`}
                  />
                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full transition-all duration-300 ${focusedIndex === index ? "bg-[#7e3866] opacity-100" : "bg-gray-200 opacity-0"}`} />
                </div>
              ))}
            </div>

            <button
              onClick={() => handleVerify()}
              disabled={isLoading || !isOtpComplete}
              className="w-full py-4.5 bg-[#7e3866] hover:bg-[#6a2f56] disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white rounded-2xl font-bold text-lg shadow-xl shadow-[#7e3866]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-8"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify & Continue"}
            </button>

            {/* Resend Logic */}
            <div className="text-center">
              {resendTimer > 0 ? (
                <p className="text-sm text-gray-400 font-medium flex items-center justify-center gap-2 tracking-wide uppercase text-[10px] font-black">
                  <Timer className="w-3.5 h-3.5 text-[#7e3866]" />
                  Resend code in <span className="text-[#7e3866] font-bold">{resendTimer}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  className="text-xs text-[#7e3866] font-black uppercase tracking-widest hover:underline underline-offset-4 flex items-center justify-center gap-2 mx-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Resend OTP Code
                </button>
              )}
            </div>
          </div>

          <p className="mt-12 text-[10px] font-black text-gray-300 dark:text-gray-600 text-center uppercase tracking-[0.3em]">
            Secure Verification &bull; Tifunbox Partner
          </p>
        </motion.div>
      </div>
    </div>
  )
}

