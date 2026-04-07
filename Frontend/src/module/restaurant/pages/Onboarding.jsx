import { useEffect, useState, useRef, useLayoutEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Image as ImageIcon, Upload, Clock, Calendar as CalendarIcon, ArrowLeft, Camera, CheckCircle2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { uploadAPI, api } from "@/lib/api"
import { openCameraViaFlutter, hasFlutterCameraBridge } from "@/lib/utils/cameraBridge"
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import { determineStepToShow } from "../utils/onboardingUtils"
import { toast } from "sonner"
import { useCompanyName } from "@/lib/hooks/useCompanyName"

const cuisinesOptions = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Pizza",
  "Burgers",
  "Bakery",
  "Cafe",
]

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const hasStep3UploadedImage = (value) => {
  if (!value) return false
  if (value instanceof File) return true
  if (value?.url && typeof value.url === "string") return true
  if (typeof value === "string" && value.startsWith("http")) return true
  return false
}

const step3ImageDisplayName = (value) => {
  if (value instanceof File) return value.name || "Image selected"
  if (value?.name && typeof value.name === "string") return value.name
  if (typeof value === "string" && value.startsWith("http")) return "Document on file"
  if (value?.url) return "Document on file"
  return "Document uploaded"
}

const ONBOARDING_STORAGE_KEY = "restaurant_onboarding_data"
const TOTAL_VISIBLE_STEPS = 3
const getTodayDateOnly = () => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

// Helper functions for localStorage
const saveOnboardingToLocalStorage = (step1, step2, step3, step4, currentStep) => {
  try {
    // Convert File objects to a serializable format (we'll store file names/paths if available)
    const serializableStep2 = {
      ...step2,
      menuImages: step2.menuImages.map((file) => {
        if (file instanceof File) {
          return { name: file.name, size: file.size, type: file.type }
        }
        return file
      }),
      profileImage: step2.profileImage instanceof File
        ? { name: step2.profileImage.name, size: step2.profileImage.size, type: step2.profileImage.type }
        : step2.profileImage,
    }

    const serializableStep3 = {
      ...step3,
      panImage: step3.panImage instanceof File
        ? { name: step3.panImage.name, size: step3.panImage.size, type: step3.panImage.type }
        : step3.panImage,
      gstImage: step3.gstImage instanceof File
        ? { name: step3.gstImage.name, size: step3.gstImage.size, type: step3.gstImage.type }
        : step3.gstImage,
      fssaiImage: step3.fssaiImage instanceof File
        ? { name: step3.fssaiImage.name, size: step3.fssaiImage.size, type: step3.fssaiImage.type }
        : step3.fssaiImage,
    }

    const dataToSave = {
      step1,
      step2: serializableStep2,
      step3: serializableStep3,
      step4: step4 || {},
      currentStep,
      timestamp: Date.now(),
    }
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(dataToSave))
  } catch (error) {
    console.error("Failed to save onboarding data to localStorage:", error)
  }
}

const loadOnboardingFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error("Failed to load onboarding data from localStorage:", error)
  }
  return null
}

const clearOnboardingFromLocalStorage = () => {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  } catch (error) {
    console.error("Failed to clear onboarding data from localStorage:", error)
  }
}

// Helper function to convert "HH:mm" string to Date object
const stringToTime = (timeString) => {
  if (!timeString || !timeString.includes(":")) {
    return new Date(2000, 0, 1, 10, 0) // Default to 10:00 AM
  }
  const [hours, minutes] = timeString.split(":").map(Number)
  return new Date(2000, 0, 1, hours || 10, minutes || 0)
}

// Helper function to convert Date object to "HH:mm" string
const timeToString = (date) => {
  if (!date) return ""
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

function TimeSelector({ label, value, onChange }) {
  const timeValue = stringToTime(value)

  const handleTimeChange = (newValue) => {
    if (newValue) {
      const timeString = timeToString(newValue)
      onChange(timeString)
    }
  }

  return (
    <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50/60">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-gray-800" />
        <span className="text-xs font-medium text-gray-900">{label}</span>
      </div>
      <MobileTimePicker
        value={timeValue}
        onChange={handleTimeChange}
        slotProps={{
          textField: {
            variant: "outlined",
            size: "small",
            placeholder: "Select time",
            sx: {
              "& .MuiOutlinedInput-root": {
                height: "36px",
                fontSize: "12px",
                backgroundColor: "white",
                "& fieldset": {
                  borderColor: "#e5e7eb",
                },
                "&:hover fieldset": {
                  borderColor: "#d1d5db",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#000",
                },
              },
              "& .MuiInputBase-input": {
                padding: "8px 12px",
                fontSize: "12px",
              },
            },
          },
        }}
        format="hh:mm a"
      />
    </div>
  )
}

export default function RestaurantOnboarding() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const mainContentRef = useRef(null)
  const [error, setError] = useState("")
  const fssaiCameraInputRef = useRef(null)
  const gstCameraInputRef = useRef(null)
  const profileCameraInputRef = useRef(null)

  const [step1, setStep1] = useState({
    restaurantName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    primaryContactNumber: "",
    location: {
      addressLine1: "",
      addressLine2: "",
      area: "",
      city: "",
      landmark: "",
    },
  })

  const [step2, setStep2] = useState({
    menuImages: [],
    profileImage: null,
    cuisines: [],
    openingTime: "",
    closingTime: "",
    openDays: [],
  })

  const [step3, setStep3] = useState({
    panNumber: "",
    nameOnPan: "",
    panImage: null,
    gstRegistered: false,
    gstNumber: "",
    gstLegalName: "",
    gstAddress: "",
    gstImage: null,
    fssaiNumber: "",
    fssaiExpiry: "",
    fssaiImage: null,
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    accountType: "",
  })

  const [step4, setStep4] = useState({
    estimatedDeliveryTime: "",
    featuredDish: "",
    featuredPrice: "",
    offer: "",
  })

  const [step3Errors, setStep3Errors] = useState({})


  const validateStep3Field = (field, value, allStep3 = step3) => {
    const s = { ...allStep3, [field]: value }
    switch (field) {
      case "panNumber":
        if (!s.panNumber?.trim()) return "PAN number is required"
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(s.panNumber.trim().toUpperCase()))
          return "5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)"
        return ""
      case "nameOnPan":
        if (!s.nameOnPan?.trim()) return "Name on PAN is required"
        if (!/^[a-zA-Z\s]+$/.test(s.nameOnPan.trim())) return "Name on PAN must contain only letters"
        return ""
      case "panImage":
        if (!s.panImage) return "PAN image is required"
      {
        const validPan = s.panImage instanceof File || (s.panImage?.url && typeof s.panImage.url === "string") || (typeof s.panImage === "string" && s.panImage.startsWith("http"))
        return !validPan ? "Please upload a valid PAN image" : ""
      }
      case "fssaiNumber":
        if (!s.fssaiNumber?.trim()) return "FSSAI number is required"
        if (!/^\d{14}$/.test(s.fssaiNumber.trim())) return "FSSAI number must be 14 digits"
        return ""
      case "fssaiExpiry":
        if (!s.fssaiExpiry?.trim()) return "FSSAI expiry date is required"
      {
        const expDate = new Date(s.fssaiExpiry + "T12:00:00")
        if (expDate < getTodayDateOnly()) return "FSSAI expiry date must be today or a future date"
        return ""
      }
      case "fssaiImage":
        if (!s.fssaiImage) return "FSSAI image is required"
      {
        const validFssai = s.fssaiImage instanceof File || (s.fssaiImage?.url && typeof s.fssaiImage.url === "string") || (typeof s.fssaiImage === "string" && s.fssaiImage.startsWith("http"))
        return !validFssai ? "Please upload a valid FSSAI image" : ""
      }
      case "gstNumber":
        if (!s.gstRegistered) return ""
        if (!s.gstNumber?.trim()) return "GST number is required"
      {
        const gst = s.gstNumber.trim().toUpperCase()
        if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z0-9]Z[A-Z0-9]$/.test(gst)) {
          return "GST format must be: 2 digits state code + PAN + entity + Z + check code"
        }
        return ""
      }
      case "gstLegalName":
        return s.gstRegistered && !s.gstLegalName?.trim() ? "Legal name is required" : ""
      case "gstAddress":
        return s.gstRegistered && !s.gstAddress?.trim() ? "Registered address is required" : ""
      case "gstImage":
        if (!s.gstRegistered) return ""
        if (!s.gstImage) return "GST image is required"
      {
        const validGst = s.gstImage instanceof File || (s.gstImage?.url && typeof s.gstImage.url === "string") || (typeof s.gstImage === "string" && s.gstImage.startsWith("http"))
        return !validGst ? "Please upload a valid GST image" : ""
      }
      case "accountNumber":
        if (!s.accountNumber?.trim()) return "Account number is required"
        if (!/^\d+$/.test(s.accountNumber.trim())) return "Account number must contain only digits"
        if (s.accountNumber.trim().length < 9) return "Account number must be at least 9 digits"
        if (s.accountNumber.trim().length > 18) return "Account number must be at most 18 digits"
        return ""
      case "confirmAccountNumber":
        if (!s.confirmAccountNumber?.trim()) return "Please re-enter account number"
        if (s.accountNumber?.trim() !== s.confirmAccountNumber?.trim()) return "Account numbers do not match"
        return ""
      case "ifscCode":
        if (!s.ifscCode?.trim()) return "IFSC code is required"
        if (s.ifscCode.trim().length !== 11) return "IFSC code must be exactly 11 characters"
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(s.ifscCode.trim().toUpperCase())) return "Invalid IFSC format (e.g., SBIN0018764)"
        return ""
      case "accountType":
        if (!s.accountType?.trim()) return "Account type is required"
      {
        const at = s.accountType.trim().toLowerCase()
        if (at !== "savings" && at !== "current") return "Must be 'savings' or 'current'"
        return ""
      }
      case "accountHolderName":
        if (!s.accountHolderName?.trim()) return "Account holder name is required"
        if (!/^[a-zA-Z\s]+$/.test(s.accountHolderName.trim())) return "Account holder name must contain only letters"
        return ""
      default:
        return ""
    }
  }

  const handleStep3Blur = (field) => {
    const err = validateStep3Field(field, step3[field])
    setStep3Errors((prev) => ({ ...prev, [field]: err || null }))
  }

  // Load from localStorage on mount and check URL parameter
  useEffect(() => {
    // Check if step is specified in URL (from OTP login redirect)
    const stepParam = searchParams.get("step")
    if (stepParam) {
      const stepNum = parseInt(stepParam, 10)
      if (stepNum >= 1 && stepNum <= 4) {
        setStep(Math.min(stepNum, TOTAL_VISIBLE_STEPS))
      }
    }

    const localData = loadOnboardingFromLocalStorage()
    if (localData) {
      if (localData.step1) {
        setStep1({
          restaurantName: localData.step1.restaurantName || "",
          ownerName: localData.step1.ownerName || "",
          ownerEmail: localData.step1.ownerEmail || "",
          ownerPhone: localData.step1.ownerPhone || "",
          primaryContactNumber: localData.step1.primaryContactNumber || "",
          location: {
            addressLine1: localData.step1.location?.addressLine1 || "",
            addressLine2: localData.step1.location?.addressLine2 || "",
            area: localData.step1.location?.area || "",
            city: localData.step1.location?.city || "",
            landmark: localData.step1.location?.landmark || "",
          },
        })
      }
      if (localData.step2) {
        setStep2({
          menuImages: localData.step2.menuImages || [],
          profileImage: localData.step2.profileImage || null,
          cuisines: localData.step2.cuisines || [],
          openingTime: localData.step2.openingTime || "",
          closingTime: localData.step2.closingTime || "",
          openDays: localData.step2.openDays || [],
        })
      }
      if (localData.step3) {
        setStep3({
          panNumber: localData.step3.panNumber || "",
          nameOnPan: localData.step3.nameOnPan || "",
          panImage: localData.step3.panImage || null,
          gstRegistered: localData.step3.gstRegistered || false,
          gstNumber: localData.step3.gstNumber || "",
          gstLegalName: localData.step3.gstLegalName || "",
          gstAddress: localData.step3.gstAddress || "",
          gstImage: localData.step3.gstImage || null,
          fssaiNumber: localData.step3.fssaiNumber || "",
          fssaiExpiry: localData.step3.fssaiExpiry || "",
          fssaiImage: localData.step3.fssaiImage || null,
          accountNumber: localData.step3.accountNumber || "",
          confirmAccountNumber: localData.step3.confirmAccountNumber || "",
          ifscCode: localData.step3.ifscCode || "",
          accountHolderName: localData.step3.accountHolderName || "",
          accountType: localData.step3.accountType || "",
        })
      }
      if (localData.step4) {
        setStep4({
          estimatedDeliveryTime: localData.step4.estimatedDeliveryTime || "",
          featuredDish: localData.step4.featuredDish || "",
          featuredPrice: localData.step4.featuredPrice || "",
          offer: localData.step4.offer || "",
        })
      }
      // Only set step from localStorage if URL doesn't have a step parameter
      if (localData.currentStep && !stepParam) {
        setStep(Math.min(localData.currentStep, TOTAL_VISIBLE_STEPS))
      }
    }
  }, [searchParams])

  const [verifiedOwnerPhone, setVerifiedOwnerPhone] = useState("")
  // Prefill owner phone from verified restaurant user and keep it read-only
  useEffect(() => {
    try {
      const stored = localStorage.getItem("restaurant_user")
      if (!stored) return
      const user = JSON.parse(stored)
      const phone = user?.phone || user?.ownerPhone
      if (phone) {
        const normalized = typeof phone === "string" ? phone.replace(/\s/g, "").trim() : String(phone)
        setVerifiedOwnerPhone(normalized)
        setStep1((prev) => ({ ...prev, ownerPhone: prev.ownerPhone || normalized }))
      }
    } catch {
      // Ignore invalid stored restaurant payloads.
    }
  }, [])

  // Prevent old onboarding drafts from a different logged-in number.
  useEffect(() => {
    if (!verifiedOwnerPhone) return
    const localData = loadOnboardingFromLocalStorage()
    const draftPhone = localData?.step1?.ownerPhone
    if (!draftPhone) return
    const normalizedDraft = String(draftPhone).replace(/\D/g, "").trim()
    const normalizedVerified = String(verifiedOwnerPhone).replace(/\D/g, "").trim()
    if (normalizedDraft && normalizedVerified && normalizedDraft !== normalizedVerified) {
      clearOnboardingFromLocalStorage()
    }
  }, [verifiedOwnerPhone])

  // Save to localStorage whenever step data changes
  useEffect(() => {
    saveOnboardingToLocalStorage(step1, step2, step3, step4, step)
  }, [step1, step2, step3, step4, step])

  // Keep focused input visible when keyboard opens (scroll into view)
  const scrollTimerRef = useRef(null)
  useEffect(() => {
    const el = mainContentRef.current
    if (!el) return
    const handleFocusIn = (e) => {
      const target = e.target
      const tag = target?.tagName?.toLowerCase()
      const isInputLike = tag === "input" || tag === "textarea" || tag === "select" || target?.getAttribute?.("contenteditable") === "true"
      if (!isInputLike) return
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center" })
        scrollTimerRef.current = null
      }, 350)
    }
    el.addEventListener("focusin", handleFocusIn)
    return () => {
      el.removeEventListener("focusin", handleFocusIn)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [loading])

  // Onboarding scroll bug: when navigating between steps, ensure we start from the top.
  useLayoutEffect(() => {
    const el = mainContentRef.current
    if (el) el.scrollTo({ top: 0, left: 0, behavior: "auto" })
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    const timer = setTimeout(() => {
      if (el) el.scrollTo({ top: 0, left: 0, behavior: "auto" })
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    }, 10)
    return () => clearTimeout(timer)
  }, [step])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await api.get("/restaurant/onboarding")
        const data = res?.data?.data?.onboarding
        if (data) {
          if (data.step1) {
            setStep1({
              restaurantName: data.step1.restaurantName || "",
              ownerName: data.step1.ownerName || "",
              ownerEmail: data.step1.ownerEmail || "",
              ownerPhone: data.step1.ownerPhone || "",
              primaryContactNumber: data.step1.primaryContactNumber || "",
              location: {
                addressLine1: data.step1.location?.addressLine1 || "",
                addressLine2: data.step1.location?.addressLine2 || "",
                area: data.step1.location?.area || "",
                city: data.step1.location?.city || "",
                landmark: data.step1.location?.landmark || "",
              },
            })
          }
          if (data.step2) {
            setStep2({
              // Load menu images from URLs if available
              menuImages: data.step2.menuImageUrls || [],
              // Load profile image URL if available
              profileImage: data.step2.profileImageUrl || null,
              cuisines: data.step2.cuisines || [],
              openingTime: data.step2.deliveryTimings?.openingTime || "",
              closingTime: data.step2.deliveryTimings?.closingTime || "",
              openDays: data.step2.openDays || [],
            })
          }
          if (data.step3) {
            setStep3({
              panNumber: data.step3.pan?.panNumber || "",
              nameOnPan: data.step3.pan?.nameOnPan || "",
              panImage: null, // Don't load images from API, user needs to re-upload
              gstRegistered: data.step3.gst?.isRegistered || false,
              gstNumber: data.step3.gst?.gstNumber || "",
              gstLegalName: data.step3.gst?.legalName || "",
              gstAddress: data.step3.gst?.address || "",
              gstImage: null, // Don't load images from API, user needs to re-upload
              fssaiNumber: data.step3.fssai?.registrationNumber || "",
              fssaiExpiry: data.step3.fssai?.expiryDate
                ? data.step3.fssai.expiryDate.slice(0, 10)
                : "",
              fssaiImage: null, // Don't load images from API, user needs to re-upload
              accountNumber: data.step3.bank?.accountNumber || "",
              confirmAccountNumber: data.step3.bank?.accountNumber || "",
              ifscCode: data.step3.bank?.ifscCode || "",
              accountHolderName: data.step3.bank?.accountHolderName || "",
              accountType: data.step3.bank?.accountType || "",
            })
          }

          if (data.step4) {
            setStep4({
              estimatedDeliveryTime: data.step4.estimatedDeliveryTime || "",
              featuredDish: data.step4.featuredDish || "",
              featuredPrice: data.step4.featuredPrice || "",
              offer: data.step4.offer || "",
            })
          }

          // Determine which step to show based on completeness
          const stepToShow = determineStepToShow(data)
          setStep(stepToShow)
        }
      } catch (err) {
        // Handle error gracefully - if it's a 401 (unauthorized), the user might need to login again
        // Otherwise, just continue with empty onboarding data
        if (err?.response?.status === 401) {
          console.error("Authentication error fetching onboarding:", err)
          // Don't show error to user, they can still fill the form
          // The error might be because restaurant is not yet active (pending verification)
        } else {
          console.error("Error fetching onboarding data:", err)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleUpload = async (file, folder) => {
    try {
      const res = await uploadAPI.uploadMedia(file, { folder })
      const d = res?.data?.data || res?.data
      return { url: d.url, publicId: d.publicId }
    } catch (err) {
      // Provide more informative error message for upload failures
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to upload image"
      console.error("Upload error:", errorMsg, err)
      throw new Error(`Image upload failed: ${errorMsg}`)
    }
  }

  // Validation functions for each step
  const validateStep1 = () => {
    const errors = []

    if (!step1.restaurantName?.trim()) {
      errors.push("Restaurant name is required")
    }
    if (!step1.ownerName?.trim()) {
      errors.push("Owner name is required")
    } else if (!/^[A-Za-z\s]+$/.test(step1.ownerName.trim())) {
      errors.push("Owner name must contain only alphabets")
    }
    if (!step1.ownerEmail?.trim()) {
      errors.push("Owner email is required")
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(step1.ownerEmail)) {
      errors.push("Please enter a valid email address")
    }
    if (!step1.ownerPhone?.trim()) {
      errors.push("Owner phone number is required")
    }
    if (!step1.primaryContactNumber?.trim()) {
      errors.push("Primary contact number is required")
    } else if (!/^\d{10}$/.test(step1.primaryContactNumber.trim())) {
      errors.push("Primary contact number must be exactly 10 digits")
    }
    if (!step1.location?.area?.trim()) {
      errors.push("Area/Sector/Locality is required")
    }
    if (!step1.location?.city?.trim()) {
      errors.push("City is required")
    } else if (!/^[A-Za-z\s]{2,50}$/.test(step1.location.city.trim())) {
      errors.push("City must contain only letters")
    }

    return errors
  }

  const validateStep2 = () => {
    const errors = []

    // Check profile image - must be a File or existing URL
    if (!step2.profileImage) {
      errors.push("Restaurant profile image is required")
    } else {
      // Verify profile image is either a File or has a valid URL
      const isValidProfileImage =
        step2.profileImage instanceof File ||
        (step2.profileImage?.url && typeof step2.profileImage.url === 'string') ||
        (typeof step2.profileImage === 'string' && step2.profileImage.startsWith('http'))
      if (!isValidProfileImage) {
        errors.push("Please upload a valid restaurant profile image")
      }
    }

    if (!step2.cuisines || step2.cuisines.length === 0) {
      errors.push("Please select at least one cuisine")
    }
    if (!step2.openingTime?.trim()) {
      errors.push("Opening time is required")
    }
    if (!step2.closingTime?.trim()) {
      errors.push("Closing time is required")
    }
    if (!step2.openDays || step2.openDays.length === 0) {
      errors.push("Please select at least one open day")
    }
    if (step2.openingTime?.trim() && step2.closingTime?.trim()) {
      const [oh, om] = step2.openingTime.split(":").map(Number)
      const [ch, cm] = step2.closingTime.split(":").map(Number)
      const openingMins = oh * 60 + om
      const closingMins = ch * 60 + cm
      if (!Number.isNaN(openingMins) && !Number.isNaN(closingMins) && openingMins >= closingMins) {
        errors.push("Opening time must be earlier than closing time")
      }
    }

    return [...errors, ...validateStep4()]
  }

  const validateStep4 = () => {
    const errors = []
    if (!step4.estimatedDeliveryTime || !step4.estimatedDeliveryTime.trim()) {
      errors.push("Estimated delivery time is required")
    }
    if (!step4.featuredDish || !step4.featuredDish.trim()) {
      errors.push("Featured dish name is required")
    }
    if (!step4.featuredPrice || step4.featuredPrice === "" || isNaN(parseFloat(step4.featuredPrice)) || parseFloat(step4.featuredPrice) <= 0) {
      errors.push("Featured dish price is required and must be greater than 0")
    }
    if (!step4.offer || !step4.offer.trim()) {
      errors.push("Special offer/promotion is required")
    }
    return errors
  }

  const validateStep3 = () => {
    const errors = []

    if (!step3.fssaiNumber?.trim()) {
      errors.push("FSSAI number is required")
    } else if (!/^\d{14}$/.test(step3.fssaiNumber.trim())) {
      errors.push("FSSAI number must be exactly 14 digits")
    }
    if (!step3.fssaiExpiry?.trim()) {
      errors.push("FSSAI expiry date is required")
    } else {
      const expDate = new Date(step3.fssaiExpiry + "T12:00:00")
      if (expDate < getTodayDateOnly()) {
        errors.push("FSSAI expiry date must be today or a future date")
      }
    }
    // Validate FSSAI image - must be a File or existing URL
    if (!step3.fssaiImage) {
      errors.push("FSSAI image is required")
    } else {
      const isValidFssaiImage =
        step3.fssaiImage instanceof File ||
        (step3.fssaiImage?.url && typeof step3.fssaiImage.url === 'string') ||
        (typeof step3.fssaiImage === 'string' && step3.fssaiImage.startsWith('http'))
      if (!isValidFssaiImage) {
        errors.push("Please upload a valid FSSAI image")
      }
    }

    // Validate GST details if GST registered
    if (step3.gstRegistered) {
      if (!step3.gstNumber?.trim()) {
        errors.push("GST number is required when GST registered")
      } else if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z0-9]Z[A-Z0-9]$/.test(step3.gstNumber.trim().toUpperCase())) {
        errors.push("GST number format is invalid")
      }
      if (!step3.gstLegalName?.trim()) {
        errors.push("GST legal name is required when GST registered")
      }
      if (!step3.gstAddress?.trim()) {
        errors.push("GST registered address is required when GST registered")
      }
      // Validate GST image if GST registered
      if (!step3.gstImage) {
        errors.push("GST image is required when GST registered")
      } else {
        const isValidGstImage =
          step3.gstImage instanceof File ||
          (step3.gstImage?.url && typeof step3.gstImage.url === 'string') ||
          (typeof step3.gstImage === 'string' && step3.gstImage.startsWith('http'))
        if (!isValidGstImage) {
          errors.push("Please upload a valid GST image")
        }
      }
    }

    if (!step3.accountNumber?.trim()) {
      errors.push("Account number is required")
    } else if (!/^\d+$/.test(step3.accountNumber.trim())) {
      errors.push("Account number must contain only digits")
    } else if (step3.accountNumber.trim().length < 9 || step3.accountNumber.trim().length > 18) {
      errors.push("Account number must be 9–18 digits")
    }
    if (!step3.confirmAccountNumber?.trim()) {
      errors.push("Please confirm your account number")
    } else if (step3.accountNumber !== step3.confirmAccountNumber) {
      errors.push("Account number and confirmation do not match")
    }
    if (!step3.ifscCode?.trim()) {
      errors.push("IFSC code is required")
    } else if (step3.ifscCode.trim().length !== 11 || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(step3.ifscCode.trim())) {
      errors.push("IFSC code must be 11 characters (e.g., SBIN0018764)")
    }
    if (!step3.accountHolderName?.trim()) {
      errors.push("Account holder name is required")
    } else if (!/^[a-zA-Z\s]+$/.test(step3.accountHolderName.trim())) {
      errors.push("Account holder name must contain only letters")
    }
    if (!step3.accountType?.trim()) {
      errors.push("Account type is required")
    } else {
      const at = step3.accountType.trim().toLowerCase()
      if (at !== "savings" && at !== "current") {
        errors.push("Account type must be 'savings' or 'current'")
      }
    }

    return errors
  }

  // Fill dummy data for testing (development mode only)
  const fillDummyData = () => {
    if (step === 1) {
      setStep1({
        restaurantName: "Tifunbox Premium Bakes",
        ownerName: "Akash Sharma",
        ownerEmail: "akash.sharma@example.com",
        ownerPhone: "9876543210",
        primaryContactNumber: "9123456789",
        location: {
          addressLine1: "G-42, Sector 18",
          addressLine2: "Opposite Metro Station",
          area: "Noida",
          city: "Delhi NCR",
          landmark: "Metro Pillar 42",
        },
      })
      toast.success("Step 1 (Basic Info) auto-filled")
    } else if (step === 2) {
      setStep2({
        menuImages: [],
        profileImage: "https://res.cloudinary.com/dbv5id2cy/image/upload/v1707212002/restaurant_profile.jpg",
        cuisines: ["North Indian", "Chinese", "Bakery"],
        openingTime: "10:00",
        closingTime: "23:00",
        openDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      })
      setStep4({
        estimatedDeliveryTime: "20-25 mins",
        featuredDish: "Signature Truffle Cake",
        featuredPrice: "499",
        offer: "Flat ₹100 OFF on First Order",
      })
      toast.success("Step 2 (Setup & Launch) auto-filled")
    } else if (step === 3) {
      const expiryDate = new Date()
      expiryDate.setFullYear(expiryDate.getFullYear() + 2)
      setStep3({
        panNumber: "",
        nameOnPan: "",
        panImage: null,
        gstRegistered: true,
        gstNumber: "07ABCDE1234F1Z5",
        gstLegalName: "Tifunbox Premium Ventures",
        gstAddress: "Sector 18, Noida, Uttar Pradesh 201301",
        gstImage: "https://res.cloudinary.com/dbv5id2cy/image/upload/v1707212004/gst_placeholder.jpg",
        fssaiNumber: "12345678901234",
        fssaiExpiry: expiryDate.toISOString().split("T")[0],
        fssaiImage: "https://res.cloudinary.com/dbv5id2cy/image/upload/v1707212005/fssai_placeholder.jpg",
        accountNumber: "",
        confirmAccountNumber: "",
        ifscCode: "",
        accountHolderName: "",
        accountType: "",
      })
      toast.success("Step 3 (Compliance) auto-filled")
    } else if (step === 4) {
      setStep4({
        estimatedDeliveryTime: "20-25 mins",
        featuredDish: "Signature Truffle Cake",
        featuredPrice: "499",
        offer: "Flat ₹100 OFF on First Order",
      })
      toast.success("Step 4 (Hero Info) auto-filled")
    }
  }

  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-4 sm:px-0">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col items-center flex-1 relative">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 z-10 ${step >= i ? "bg-black text-white" : "bg-gray-200 text-gray-500"
              }`}
          >
            {i}
          </div>
          <span className={`text-[10px] mt-1 font-medium hidden sm:block ${step >= i ? "text-black" : "text-gray-400"
            }`}>
            {i === 1 ? "Verify Kitchen" : i === 2 ? "Setup & Launch" : "Documents"}
          </span>
          {i < TOTAL_VISIBLE_STEPS && (
            <div className={`absolute left-[50%] top-4 w-full h-[2px] -z-0 ${step > i ? "bg-black" : "bg-gray-200"
              }`} />
          )}
        </div>
      ))}
    </div>
  )

  const handleNext = async () => {
    setError("")

    // Validate current step before proceeding
    let validationErrors = []
    if (step === 1) {
      validationErrors = validateStep1()
    } else if (step === 2) {
      validationErrors = validateStep2()
    } else if (step === 3) {
      validationErrors = validateStep3().filter(
        (message) =>
          !message.toLowerCase().includes("pan") &&
          !message.toLowerCase().includes("account") &&
          !message.toLowerCase().includes("ifsc")
      )
    } else if (step === 4) {
      validationErrors = validateStep4()
    }

    if (validationErrors.length > 0) {
      if (step === 3) {
        const fields = ["fssaiNumber", "fssaiExpiry", "fssaiImage", "gstNumber", "gstLegalName", "gstAddress", "gstImage"]
        const errs = {}
        fields.forEach((f) => {
          const e = validateStep3Field(f, step3[f])
          if (e) errs[f] = e
        })
        setStep3Errors(errs)
      }
      validationErrors.forEach((error, index) => {
        setTimeout(() => {
          toast.error(error, { duration: 4000 })
        }, index * 100)
      })
      return
    }

    setSaving(true)
    try {
      if (step === 1) {
        const payload = {
          step1,
          completedSteps: 1,
        }
        await api.put("/restaurant/onboarding", payload)
        setStep(2)
      } else if (step === 2) {
        // Upload profile image if it's a File object
        let profileUpload = null
        if (step2.profileImage instanceof File) {
          try {
            profileUpload = await handleUpload(step2.profileImage, "appzeto/restaurant/profile")
            // Verify upload was successful and has valid URL
            if (!profileUpload || !profileUpload.url) {
              throw new Error('Failed to upload profile image')
            }
          } catch (uploadError) {
            console.error('Profile image upload error:', uploadError)
            throw new Error(`Failed to upload profile image: ${uploadError.message}`)
          }
        } else if (step2.profileImage?.url) {
          // If profileImage already has a URL (from previous save), use it
          profileUpload = step2.profileImage
        } else if (typeof step2.profileImage === 'string' && step2.profileImage.startsWith('http')) {
          // If it's a direct URL string
          profileUpload = { url: step2.profileImage }
        }

        // Verify profile image is present
        if (!profileUpload || !profileUpload.url) {
          throw new Error('Profile image must be uploaded')
        }

        const payload = {
          step2: {
            menuImageUrls: [],
            profileImageUrl: profileUpload,
            cuisines: step2.cuisines || [],
            deliveryTimings: {
              openingTime: step2.openingTime || "",
              closingTime: step2.closingTime || "",
            },
            openDays: step2.openDays || [],
          },
          step4: {
            estimatedDeliveryTime: step4.estimatedDeliveryTime,
            featuredDish: step4.featuredDish,
            featuredPrice: parseFloat(step4.featuredPrice) || 249,
            offer: step4.offer,
          },
          completedSteps: 2,
        }
        console.log('📤 Step2 payload:', {
          menuImageUrlsCount: payload.step2.menuImageUrls.length,
          hasProfileImage: !!payload.step2.profileImageUrl,
          cuisines: payload.step2.cuisines,
          openDays: payload.step2.openDays,
          deliveryTimings: payload.step2.deliveryTimings,
        })

        const response = await api.put("/restaurant/onboarding", payload)
        console.log('✅ Step2 response:', response?.data)

        // Verify response is successful
        if (!response || !response.data) {
          throw new Error('Invalid response from server')
        }

        // After step2, also update restaurant schema with step2 data
        // This ensures data is saved immediately, not just in onboarding subdocument
        if (response?.data?.data?.restaurant) {
          console.log('✅ Step2 data saved and restaurant updated')
        }

        // Only proceed to step 3 if save was successful
        if (response?.data?.data?.onboarding || response?.data?.data) {
          console.log('✅ Step2 completed successfully, moving to step 3')
          setStep(3)
        } else {
          throw new Error('Failed to save step2 data')
        }
      } else if (step === 3) {
        let panImageUpload = null
        if (step3.panImage instanceof File) {
          try {
            panImageUpload = await handleUpload(step3.panImage, "appzeto/restaurant/pan")
            if (!panImageUpload || !panImageUpload.url) {
              throw new Error('Failed to upload PAN image')
            }
          } catch (uploadError) {
            console.error('PAN image upload error:', uploadError)
            throw new Error(`Failed to upload PAN image: ${uploadError.message}`)
          }
        } else if (step3.panImage?.url) {
          panImageUpload = step3.panImage
        } else if (typeof step3.panImage === 'string' && step3.panImage.startsWith('http')) {
          panImageUpload = { url: step3.panImage }
        }

        // Upload PAN image if it's a File object
        // Upload GST image if it's a File object (only if GST registered)
        let gstImageUpload = null
        if (step3.gstRegistered) {
          if (step3.gstImage instanceof File) {
            try {
              gstImageUpload = await handleUpload(step3.gstImage, "appzeto/restaurant/gst")
              // Verify upload was successful and has valid URL
              if (!gstImageUpload || !gstImageUpload.url) {
                throw new Error('Failed to upload GST image')
              }
            } catch (uploadError) {
              console.error('GST image upload error:', uploadError)
              throw new Error(`Failed to upload GST image: ${uploadError.message}`)
            }
          } else if (step3.gstImage?.url) {
            // If gstImage already has a URL (from previous save), use it
            gstImageUpload = step3.gstImage
          } else if (typeof step3.gstImage === 'string' && step3.gstImage.startsWith('http')) {
            // If it's a direct URL string
            gstImageUpload = { url: step3.gstImage }
          }

          // Verify GST image is present if GST registered
          if (!gstImageUpload || !gstImageUpload.url) {
            throw new Error('GST image must be uploaded when GST registered')
          }
        }

        // Upload FSSAI image if it's a File object
        let fssaiImageUpload = null
        if (step3.fssaiImage instanceof File) {
          try {
            fssaiImageUpload = await handleUpload(step3.fssaiImage, "appzeto/restaurant/fssai")
            // Verify upload was successful and has valid URL
            if (!fssaiImageUpload || !fssaiImageUpload.url) {
              throw new Error('Failed to upload FSSAI image')
            }
          } catch (uploadError) {
            console.error('FSSAI image upload error:', uploadError)
            throw new Error(`Failed to upload FSSAI image: ${uploadError.message}`)
          }
        } else if (step3.fssaiImage?.url) {
          // If fssaiImage already has a URL (from previous save), use it
          fssaiImageUpload = step3.fssaiImage
        } else if (typeof step3.fssaiImage === 'string' && step3.fssaiImage.startsWith('http')) {
          // If it's a direct URL string
          fssaiImageUpload = { url: step3.fssaiImage }
        }

        // Verify FSSAI image is present
        if (!fssaiImageUpload || !fssaiImageUpload.url) {
          throw new Error('FSSAI image must be uploaded')
        }

        const payload = {
          step3: {
            pan: {
              panNumber: step3.panNumber || "",
              nameOnPan: step3.nameOnPan || "",
              image: panImageUpload,
            },
            gst: {
              isRegistered: step3.gstRegistered || false,
              gstNumber: step3.gstNumber || "",
              legalName: step3.gstLegalName || "",
              address: step3.gstAddress || "",
              image: gstImageUpload,
            },
            fssai: {
              registrationNumber: step3.fssaiNumber || "",
              expiryDate: step3.fssaiExpiry || null,
              image: fssaiImageUpload,
            },
            bank: {
              accountNumber: step3.accountNumber || "",
              ifscCode: step3.ifscCode?.trim().toUpperCase() || "",
              accountHolderName: step3.accountHolderName || "",
              accountType: step3.accountType || "",
            },
          },
          step4: {
            estimatedDeliveryTime: step4.estimatedDeliveryTime,
            featuredDish: step4.featuredDish,
            featuredPrice: parseFloat(step4.featuredPrice) || 249,
            offer: step4.offer,
          },
          completedSteps: 4,
        }
        console.log('📤 Step3 payload:', {
          hasPan: !!payload.step3.pan.panNumber,
          hasGst: payload.step3.gst.isRegistered,
          hasFssai: !!payload.step3.fssai.registrationNumber,
          hasBank: !!payload.step3.bank.accountNumber,
        })

        const response = await api.put("/restaurant/onboarding", payload)
        console.log('✅ Step3 response:', response?.data)

        // Onboarding now completes in 3 visible steps.
        setStep3Errors({})
        if (!response || !response.data) {
          throw new Error('Invalid response from server')
        }
        clearOnboardingFromLocalStorage()
        setTimeout(() => {
          navigate("/restaurant?showZoneSetup=1", { replace: true })
        }, 800)
      } else if (step === 4) {
        console.log('📤 Submitting Step 4:', step4)
        const payload = {
          step4: {
            estimatedDeliveryTime: step4.estimatedDeliveryTime,
            featuredDish: step4.featuredDish,
            featuredPrice: parseFloat(step4.featuredPrice) || 249,
            offer: step4.offer,
          },
          completedSteps: 4,
        }
        console.log('📤 Step 4 payload:', payload)
        const response = await api.put("/restaurant/onboarding", payload)
        console.log('✅ Step4 completed, response:', response?.data)

        // Verify response is successful
        if (!response || !response.data) {
          throw new Error('Invalid response from server')
        }

        // Clear localStorage when onboarding is complete
        clearOnboardingFromLocalStorage()

        // Show success message briefly, then navigate
        console.log('✅ Onboarding completed successfully, redirecting to restaurant home with zone-setup prompt...')

        // Wait a moment to ensure data is saved, then navigate.
        // Add a query flag so the home page can show a Zone Setup popup once.
        setTimeout(() => {
          console.log('🚀 Navigating to restaurant home page with showZoneSetup flag...')
          navigate("/restaurant?showZoneSetup=1", { replace: true })
        }, 800)
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to save onboarding data"
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const toggleCuisine = (cuisine) => {
    setStep2((prev) => {
      const exists = prev.cuisines.includes(cuisine)
      if (exists) {
        return { ...prev, cuisines: prev.cuisines.filter((c) => c !== cuisine) }
      }
      if (prev.cuisines.length >= 3) return prev
      return { ...prev, cuisines: [...prev.cuisines, cuisine] }
    })
  }

  const toggleDay = (day) => {
    setStep2((prev) => {
      const exists = prev.openDays.includes(day)
      if (exists) {
        return { ...prev, openDays: prev.openDays.filter((d) => d !== day) }
      }
      return { ...prev, openDays: [...prev.openDays, day] }
    })
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Restaurant information</h2>
        <p className="text-sm text-gray-600 mb-4">Restaurant name</p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-700">Restaurant name*</Label>
            <Input
              value={step1.restaurantName || ""}
              onChange={(e) => setStep1({ ...step1, restaurantName: e.target.value })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="Customers will see this name"
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Owner details</h2>
        <p className="text-sm text-gray-600 mb-4">
          These details will be used for all business communications and updates.
        </p>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-700">Full name*</Label>
            <Input
              value={step1.ownerName || ""}
              onChange={(e) => {
                const sanitizedName = e.target.value
                  .replace(/[^a-zA-Z\s]/g, "")
                  .replace(/\s{2,}/g, " ")
                  .replace(/^\s+/, "")

                setStep1({
                  ...step1,
                  ownerName: sanitizedName,
                })
              }}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="Owner full name"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Email address*</Label>
            <Input
              type="email"
              value={step1.ownerEmail || ""}
              onChange={(e) => setStep1({ ...step1, ownerEmail: e.target.value })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="owner@example.com"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Phone number*</Label>
            <Input
              value={step1.ownerPhone || ""}
            onChange={(e) => {
              if (verifiedOwnerPhone) return
              const digits = e.target.value.replace(/\D/g, "").slice(0, 10)
              setStep1({ ...step1, ownerPhone: digits })
            }}
              disabled={!!verifiedOwnerPhone}
              className="mt-1 bg-white text-sm text-black placeholder-black disabled:opacity-80 disabled:cursor-not-allowed"
              placeholder="+91 98XXXXXX"
            />
            {verifiedOwnerPhone && (
              <p className="text-[11px] text-gray-500 mt-1">Verified number cannot be changed</p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Restaurant contact & location</h2>
        <div>
          <Label className="text-xs text-gray-700">Primary contact number*</Label>
          <Input
            value={step1.primaryContactNumber || ""}
            onChange={(e) =>
              setStep1({ ...step1, primaryContactNumber: e.target.value.replace(/\D/g, "").slice(0, 10) })
            }
            className="mt-1 bg-white text-sm text-black placeholder-black"
            placeholder="Restaurant's primary contact number"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Customers, delivery partners and {companyName} may call on this number for order
            support.
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Add your restaurant's location for order pick-up.
          </p>
          <Input
            value={step1.location?.area || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, area: e.target.value },
              })
            }
            className="bg-white text-sm"
            placeholder="Area / Sector / Locality*"
          />
          <Input
            value={step1.location?.city || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, city: e.target.value },
              })
            }
            className="bg-white text-sm"
            placeholder="City"
          />
          <Input
            value={step1.location?.addressLine1 || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, addressLine1: e.target.value },
              })
            }
            className="bg-white text-sm"
            placeholder="Shop no. / building no. (optional)"
          />
          <Input
            value={step1.location?.addressLine2 || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, addressLine2: e.target.value },
              })
            }
            className="bg-white text-sm"
            placeholder="Floor / tower (optional)"
          />
          <Input
            value={step1.location?.landmark || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, landmark: e.target.value },
              })
            }
            className="bg-white text-sm"
            placeholder="Nearby landmark (optional)"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Please ensure that this address is the same as mentioned on your FSSAI license.
          </p>
        </div>
      </section>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        <h2 className="text-lg font-semibold text-black">Restaurant profile</h2>
        <p className="text-xs text-gray-500">
          Add one clean profile image now. Menu images can be uploaded later from your dashboard.
        </p>

        {/* Profile image */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Restaurant profile image</Label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {step2.profileImage ? (
                (() => {
                  let imageSrc = null;

                  if (step2.profileImage instanceof File) {
                    imageSrc = URL.createObjectURL(step2.profileImage);
                  } else if (step2.profileImage?.url) {
                    // If it's an object with url property (from backend)
                    imageSrc = step2.profileImage.url;
                  } else if (typeof step2.profileImage === 'string') {
                    // If it's a direct URL string
                    imageSrc = step2.profileImage;
                  }

                  return imageSrc ? (
                    <img
                      src={imageSrc}
                      alt="Restaurant profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-gray-500" />
                  );
                })()
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-500" />
              )}
            </div>
            <div className="flex-1 flex-col flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-900">Upload profile image</span>
                <span className="text-[11px] text-gray-500">
                  This will be shown on your listing card and restaurant page.
                </span>
              </div>

            </div>

          </div>
          <div className="flex w-full gap-2 mt-2">
            <label
              className="inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-2 border border-black rounded-sm bg-white text-black hover:bg-gray-50 text-xs font-medium cursor-pointer"
              onClick={async (e) => {
                if (hasFlutterCameraBridge()) {
                  e.preventDefault()
                  const { success, file } = await openCameraViaFlutter({ source: "gallery" })
                  if (success && file) {
                    setStep2((prev) => ({ ...prev, profileImage: file }))
                  }
                }
              }}
            >
              <Upload className="w-4 h-4" />
              <span>Gallery</span>
              <input
                id="profileImageInput"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  if (file) {
                    console.log('📸 Profile image selected:', file.name)
                    setStep2((prev) => ({
                      ...prev,
                      profileImage: file,
                    }))
                  }
                  e.target.value = ''
                }}
              />
            </label>
            <div className="flex-1">
              <input
                ref={profileCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  if (file) {
                    setStep2((prev) => ({
                      ...prev,
                      profileImage: file,
                    }))
                  }
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="inline-flex w-full justify-center items-center gap-1.5 px-3 py-2 border border-black rounded-sm bg-white text-black hover:bg-gray-50 text-xs font-medium cursor-pointer"
                onClick={async () => {
                  if (hasFlutterCameraBridge()) {
                    const { success, file } = await openCameraViaFlutter()
                    if (success && file) {
                      setStep2((prev) => ({
                        ...prev,
                        profileImage: file,
                      }))
                    }
                  } else {
                    profileCameraInputRef.current?.click()
                  }
                }}
              >
                <Camera className="w-4 h-4" />
                <span>Camera</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Operational details */}
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        {/* Cuisines */}
        <div>
          <Label className="text-xs text-gray-700">Select cuisines (up to 3)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {cuisinesOptions.map((cuisine) => {
              const active = step2.cuisines.includes(cuisine)
              return (
                <button
                  key={cuisine}
                  type="button"
                  onClick={() => toggleCuisine(cuisine)}
                  className={`px-3 py-1.5 text-xs rounded-full ${active ? "bg-black text-white" : "bg-gray-100 text-gray-800"
                    }`}
                >
                  {cuisine}
                </button>
              )
            })}
          </div>
        </div>

        {/* Timings with popover time selectors */}
        <div className="space-y-3">
          <Label className="text-xs text-gray-700">Delivery timings</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TimeSelector
              label="Opening time"
              value={step2.openingTime || ""}
              onChange={(val) => setStep2({ ...step2, openingTime: val || "" })}
            />
            <TimeSelector
              label="Closing time"
              value={step2.closingTime || ""}
              onChange={(val) => setStep2({ ...step2, closingTime: val || "" })}
            />
          </div>
        </div>

        {/* Open days in a calendar-like grid */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-700 flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-gray-800" />
            <span>Open days</span>
          </Label>
          <p className="text-[11px] text-gray-500">
            Select the days your restaurant accepts delivery orders.
          </p>
          <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
            {daysOfWeek.map((day) => {
              const active = step2.openDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`aspect-square flex items-center justify-center rounded-md text-[11px] font-medium ${active ? "bg-black text-white" : "bg-gray-100 text-gray-800"
                    }`}
                >
                  {day.charAt(0)}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Customer-facing listing details</h2>
        <p className="text-sm text-gray-600">
          Finish the public details customers will see before they open your menu.
        </p>

        <div>
          <Label className="text-xs text-gray-700">Estimated Delivery Time*</Label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={step4.estimatedDeliveryTime || ""}
            onChange={(e) => {
              const sanitized = e.target.value.replace(/\D/g, "").slice(0, 3)
              setStep4({ ...step4, estimatedDeliveryTime: sanitized })
            }}
            className="mt-1 bg-white text-sm"
            placeholder="e.g., 25"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-700">Featured Dish Name*</Label>
          <Input
            value={step4.featuredDish || ""}
            onChange={(e) => setStep4({ ...step4, featuredDish: e.target.value })}
            className="mt-1 bg-white text-sm"
            placeholder="e.g., Butter Chicken Special"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-700">Featured Dish Price (₹)*</Label>
          <Input
            type="number"
            value={step4.featuredPrice || ""}
            onChange={(e) => setStep4({ ...step4, featuredPrice: e.target.value })}
            className="mt-1 bg-white text-sm"
            placeholder="e.g., 249"
            min="0"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-700">Special Offer/Promotion*</Label>
          <Input
            value={step4.offer || ""}
            onChange={(e) => setStep4({ ...step4, offer: e.target.value })}
            className="mt-1 bg-white text-sm"
            placeholder="e.g., Flat ₹50 OFF above ₹199"
          />
        </div>
      </section>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Compliance details</h2>
        <p className="text-sm text-gray-600">
          PAN and bank account details will be collected later when you set up payouts.
        </p>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">GST details</h2>
        <div className="flex gap-4 items-center text-sm">
          <span className="text-gray-700">GST registered?</span>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: true })}
            className={`px-3 py-1.5 text-xs rounded-full ${step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"
              }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: false })}
            className={`px-3 py-1.5 text-xs rounded-full ${!step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"
              }`}
          >
            No
          </button>
        </div>
        {step3.gstRegistered && (
          <div className="space-y-3">
            <div>
              <Input
                value={step3.gstNumber || ""}
                onChange={(e) => {
                  const formattedGst = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 15)

                  setStep3({ ...step3, gstNumber: formattedGst })
                  if (step3Errors.gstNumber) setStep3Errors((p) => ({ ...p, gstNumber: null }))
                }}
                onBlur={() => handleStep3Blur("gstNumber")}
                className={`bg-white text-sm ${step3Errors.gstNumber ? "border-red-500" : ""}`}
                placeholder="GST number"
              />
              {step3Errors.gstNumber && <p className="text-xs text-red-500 mt-1">{step3Errors.gstNumber}</p>}
            </div>
            <div>
              <Input
                value={step3.gstLegalName || ""}
                onChange={(e) => {
                  setStep3({ ...step3, gstLegalName: e.target.value })
                  if (step3Errors.gstLegalName) setStep3Errors((p) => ({ ...p, gstLegalName: null }))
                }}
                onBlur={() => handleStep3Blur("gstLegalName")}
                className={`bg-white text-sm ${step3Errors.gstLegalName ? "border-red-500" : ""}`}
                placeholder="Legal name"
              />
              {step3Errors.gstLegalName && <p className="text-xs text-red-500 mt-1">{step3Errors.gstLegalName}</p>}
            </div>
            <div>
              <Input
                value={step3.gstAddress || ""}
                onChange={(e) => {
                  setStep3({ ...step3, gstAddress: e.target.value })
                  if (step3Errors.gstAddress) setStep3Errors((p) => ({ ...p, gstAddress: null }))
                }}
                onBlur={() => handleStep3Blur("gstAddress")}
                className={`bg-white text-sm ${step3Errors.gstAddress ? "border-red-500" : ""}`}
                placeholder="Registered address"
              />
              {step3Errors.gstAddress && <p className="text-xs text-red-500 mt-1">{step3Errors.gstAddress}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <label
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-md bg-white text-sm cursor-pointer hover:bg-gray-50"
                onClick={async (e) => {
                  if (hasFlutterCameraBridge()) {
                    e.preventDefault()
                    const { success, file } = await openCameraViaFlutter({ source: "gallery" })
                    if (success && file) {
                      setStep3({ ...step3, gstImage: file })
                      setStep3Errors((p) => ({ ...p, gstImage: null }))
                    }
                  }
                }}
              >
                <Upload className="w-4 h-4" />
                <span>Gallery</span>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setStep3({ ...step3, gstImage: e.target.files?.[0] || null })
                    setStep3Errors((p) => ({ ...p, gstImage: null }))
                  }}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-md bg-white text-sm hover:bg-gray-50"
                onClick={async () => {
                  if (hasFlutterCameraBridge()) {
                    const { success, file } = await openCameraViaFlutter()
                    if (success && file) {
                      setStep3({ ...step3, gstImage: file })
                      setStep3Errors((p) => ({ ...p, gstImage: null }))
                    }
                    return
                  }
                  gstCameraInputRef.current?.click()
                }}
              >
                <Camera className="w-4 h-4" />
                <span>Camera</span>
              </button>
              <Input
                ref={gstCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  setStep3({ ...step3, gstImage: e.target.files?.[0] || null })
                  setStep3Errors((p) => ({ ...p, gstImage: null }))
                }}
                className="hidden"
              />
            </div>
            {hasStep3UploadedImage(step3.gstImage) && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-green-800">Document uploaded</p>
                  <p className="text-[11px] text-green-700/90 truncate">{step3ImageDisplayName(step3.gstImage)}</p>
                </div>
              </div>
            )}
            {step3Errors.gstImage && <p className="text-xs text-red-500 mt-1">{step3Errors.gstImage}</p>}
          </div>
        )}
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">FSSAI details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              value={step3.fssaiNumber || ""}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 14)
                setStep3({ ...step3, fssaiNumber: v })
                if (step3Errors.fssaiNumber) setStep3Errors((p) => ({ ...p, fssaiNumber: null }))
              }}
              onBlur={() => handleStep3Blur("fssaiNumber")}
              className={`bg-white text-sm ${step3Errors.fssaiNumber ? "border-red-500" : ""}`}
              placeholder="FSSAI number (14 digits)"
            />
            {step3Errors.fssaiNumber && <p className="text-xs text-red-500 mt-1">{step3Errors.fssaiNumber}</p>}
          </div>
          <div>
            <Label className="text-xs text-gray-700 mb-1 block">FSSAI expiry date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`w-full px-3 py-2 border rounded-md bg-white text-sm text-left flex items-center justify-between hover:bg-gray-50 ${step3Errors.fssaiExpiry ? "border-red-500" : "border-gray-200"}`}
                >
                  <span className={step3.fssaiExpiry ? "text-gray-900" : "text-gray-500"}>
                    {step3.fssaiExpiry
                      ? new Date(step3.fssaiExpiry + "T12:00:00").toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                      : "Select expiry date"}
                  </span>
                  <CalendarIcon className="w-4 h-4 text-gray-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={step3.fssaiExpiry ? new Date(step3.fssaiExpiry + "T12:00:00") : undefined}
                  disabled={(date) => date < getTodayDateOnly()}
                  onSelect={(date) => {
                    if (date) {
                      const y = date.getFullYear()
                      const m = String(date.getMonth() + 1).padStart(2, "0")
                      const d = String(date.getDate()).padStart(2, "0")
                      const val = `${y}-${m}-${d}`
                      setStep3({ ...step3, fssaiExpiry: val })
                      const err = validateStep3Field("fssaiExpiry", val)
                      setStep3Errors((p) => ({ ...p, fssaiExpiry: err || null }))
                    }
                  }}
                  initialFocus
                  className="rounded-md border border-gray-200"
                />
              </PopoverContent>
            </Popover>
            {step3Errors.fssaiExpiry && <p className="text-xs text-red-500 mt-1">{step3Errors.fssaiExpiry}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-md bg-white text-sm cursor-pointer hover:bg-gray-50"
            onClick={async (e) => {
              if (hasFlutterCameraBridge()) {
                e.preventDefault()
                const { success, file } = await openCameraViaFlutter({ source: "gallery" })
                if (success && file) {
                  setStep3({ ...step3, fssaiImage: file })
                  setStep3Errors((p) => ({ ...p, fssaiImage: null }))
                }
              }
            }}
          >
            <Upload className="w-4 h-4" />
            <span>Gallery</span>
            <Input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                setStep3({ ...step3, fssaiImage: e.target.files?.[0] || null })
                setStep3Errors((p) => ({ ...p, fssaiImage: null }))
              }}
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-md bg-white text-sm hover:bg-gray-50"
            onClick={async () => {
              if (hasFlutterCameraBridge()) {
                const { success, file } = await openCameraViaFlutter()
                if (success && file) {
                  setStep3({ ...step3, fssaiImage: file })
                  setStep3Errors((p) => ({ ...p, fssaiImage: null }))
                }
                return
              }
              fssaiCameraInputRef.current?.click()
            }}
          >
            <Camera className="w-4 h-4" />
            <span>Camera</span>
          </button>
          <Input
            ref={fssaiCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              setStep3({ ...step3, fssaiImage: e.target.files?.[0] || null })
              setStep3Errors((p) => ({ ...p, fssaiImage: null }))
            }}
          />
        </div>
        {hasStep3UploadedImage(step3.fssaiImage) && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-green-800">Document uploaded</p>
              <p className="text-[11px] text-green-700/90 truncate">{step3ImageDisplayName(step3.fssaiImage)}</p>
            </div>
          </div>
        )}
        {step3Errors.fssaiImage && <p className="text-xs text-red-500 mt-1">{step3Errors.fssaiImage}</p>}
      </section>

    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Restaurant Display Information</h2>
        <p className="text-sm text-gray-600">
          Add information that will be displayed to customers on the home page
        </p>

        <div>
          <Label className="text-xs text-gray-700">Estimated Delivery Time*</Label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={step4.estimatedDeliveryTime || ""}
            onChange={(e) => {
              const sanitized = e.target.value.replace(/\D/g, "").slice(0, 3)
              setStep4({ ...step4, estimatedDeliveryTime: sanitized })
            }}
            className="mt-1 bg-white text-sm"
            placeholder="e.g., 25"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-700">Featured Dish Name*</Label>
          <Input
            value={step4.featuredDish || ""}
            onChange={(e) => setStep4({ ...step4, featuredDish: e.target.value })}
            className="mt-1 bg-white text-sm"
            placeholder="e.g., Butter Chicken Special"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-700">Featured Dish Price (₹)*</Label>
          <Input
            type="number"
            value={step4.featuredPrice || ""}
            onChange={(e) => setStep4({ ...step4, featuredPrice: e.target.value })}
            className="mt-1 bg-white text-sm"
            placeholder="e.g., 249"
            min="0"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-700">Special Offer/Promotion*</Label>
          <Input
            value={step4.offer || ""}
            onChange={(e) => setStep4({ ...step4, offer: e.target.value })}
            className="mt-1 bg-white text-sm"
            placeholder="e.g., Flat ₹50 OFF above ₹199"
          />
        </div>
      </section>
    </div>
  )

  const renderStep = () => {
    if (step === 1) return renderStep1()
    if (step === 2) return renderStep2()
    if (step === 3) return renderStep3()
    return renderStep4()
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <header className="px-4 py-4 sm:px-6 sm:py-5 bg-white border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-black tracking-tight">Restaurant Onboarding</div>
          </div>
          <div className="flex items-center gap-3">
            {import.meta.env.DEV && (
              <Button
                onClick={fillDummyData}
                variant="outline"
                size="sm"
                className="text-xs bg-black text-white hover:bg-gray-800 border-none rounded-full px-4 flex items-center gap-1.5 transition-all active:scale-95"
                title="Fill with dummy data (Dev only)"
              >
                Auto-Fill
              </Button>
            )}
          </div>
        </header>

        <main ref={mainContentRef} className="flex-1 px-4 sm:px-6 py-8 max-w-3xl mx-auto w-full overflow-y-auto">
          <StepIndicator />
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-500 font-medium">Preparing your workspace...</p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {renderStep()}
            </div>
          )}
        </main>

        {error && (
          <div className="px-4 sm:px-6 pb-2 text-xs text-red-600">
            {error}
          </div>
        )}

        <footer className="px-4 sm:px-6 py-4 bg-white border-t border-gray-100 shadow-lg">
          <div className="flex justify-between items-center max-w-3xl mx-auto">
            <Button
              variant="ghost"
              disabled={step === 1 || saving}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="flex items-center gap-3">
              {import.meta.env.DEV && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (step === 1) setStep1({ restaurantName: "", ownerName: "", ownerEmail: "", ownerPhone: "", primaryContactNumber: "", location: { addressLine1: "", addressLine2: "", area: "", city: "", landmark: "" } });
                    if (step === 2) {
                      setStep2({ menuImages: [], profileImage: null, cuisines: [], openingTime: "", closingTime: "", openDays: [] });
                      setStep4({ estimatedDeliveryTime: "", featuredDish: "", featuredPrice: "", offer: "" });
                    }
                    if (step === 3) setStep3({ panNumber: "", nameOnPan: "", panImage: null, gstRegistered: false, gstNumber: "", gstLegalName: "", gstAddress: "", gstImage: null, fssaiNumber: "", fssaiExpiry: "", fssaiImage: null, accountNumber: "", confirmAccountNumber: "", ifscCode: "", accountHolderName: "", accountType: "" });
                    if (step === 4) setStep4({ estimatedDeliveryTime: "", featuredDish: "", featuredPrice: "", offer: "" });
                    toast("Step reset cleared");
                  }}
                  className="text-[10px] text-gray-400 hover:text-red-500 uppercase tracking-widest font-bold"
                >
                  Reset Step
                </Button>
              )}

              <Button
                onClick={handleNext}
                disabled={saving}
                className={`text-sm px-8 py-5 rounded-lg font-bold transition-all shadow-md active:scale-95 ${step === TOTAL_VISIBLE_STEPS ? "bg-black hover:bg-gray-800" : "bg-black hover:bg-gray-800"
                  } text-white`}
              >
                {saving ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : step === TOTAL_VISIBLE_STEPS ? (
                  "Complete Onboarding"
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </div>
        </footer>


      </div>
    </LocalizationProvider>
  )
}
