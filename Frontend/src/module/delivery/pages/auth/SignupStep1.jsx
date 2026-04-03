import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { deliveryAPI } from "@/lib/api"
import { toast } from "sonner"
import { clearModuleAuth } from "@/lib/utils/auth"

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  // Union Territories
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
].sort()

const STORAGE_KEY_PREFIX = "delivery_signup_basic_details"

const getSignupStorageKey = () => {
  try {
    const authRaw = sessionStorage.getItem("deliveryAuthData")
    if (!authRaw) return STORAGE_KEY_PREFIX
    const auth = JSON.parse(authRaw)
    const phone = String(auth?.phone || "").replace(/\D/g, "")
    return phone ? `${STORAGE_KEY_PREFIX}_${phone}` : STORAGE_KEY_PREFIX
  } catch {
    return STORAGE_KEY_PREFIX
  }
}

export default function SignupStep1() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    city: "",
    state: "",
    vehicleType: "bike",
    vehicleName: "",
    vehicleNumber: "",
    panNumber: "",
    aadharNumber: ""
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Restore previously saved basic details (from signup flow or local persistence)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const scopedKey = getSignupStorageKey()

      // Prefer data saved from a previous visit during this session
      const sessionStored = sessionStorage.getItem(scopedKey)
      const localStored = localStorage.getItem(scopedKey)
      const raw = sessionStored || localStored

      if (!raw) return

      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") return

      setFormData((prev) => ({
        ...prev,
        ...parsed,
      }))
    } catch (e) {
      console.warn("Failed to restore delivery signup basic details:", e)
    }
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    let nextValue = value

    if (name === "city") {
      nextValue = value
    }

    if (name === "vehicleNumber") {
      // Uppercase, only letters/digits, limit length
      nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
    }

    if (name === "panNumber") {
      // Always uppercase, only letters/digits, max 10 chars
      nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
    }

    if (name === "name") {
      // Full name: only letters and spaces (no numbers/special chars)
      nextValue = value.replace(/[^a-zA-Z\s]/g, "").trimStart()
    }

    if (name === "aadharNumber") {
      // Only digits, format as XXXX XXXX XXXX
      const digits = value.replace(/\D/g, "").slice(0, 12)
      const parts = []
      for (let i = 0; i < digits.length; i += 4) {
        parts.push(digits.slice(i, i + 4))
      }
      nextValue = parts.join(" ")
    }

    setFormData((prev) => {
      if (name === "state") {
        // When state changes, reset city
        return {
          ...prev,
          state: nextValue,
          city: "",
        }
      }
      const updated = {
        ...prev,
        [name]: nextValue,
      }

      // Persist draft so navigating away and back keeps the data
      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(getSignupStorageKey(), JSON.stringify(updated))
        }
      } catch (storageError) {
        console.warn("Failed to persist delivery signup basic details:", storageError)
      }

      return updated
    })

    // Field-level real-time validation
    let fieldError = ""
    const trimmed = nextValue.trim()

    switch (name) {
      case "name":
        if (!trimmed) fieldError = "Name is required"
        else if (!/^[a-zA-Z\s]{2,}$/.test(trimmed)) fieldError = "Enter valid name (letters and spaces only)"
        else if (trimmed.split(/\s+/).filter(Boolean).length < 2) fieldError = "Please enter first and last name"
        break
      case "email":
        if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          fieldError = "Invalid email format"
        }
        break
      case "address":
        if (!trimmed) fieldError = "Address is required"
        break
      case "city":
        if (!trimmed) fieldError = "City is required"
        else if (!/^[A-Za-z\s]{2,}$/.test(trimmed)) {
          fieldError = "Enter valid city name"
        }
        break
      case "state":
        if (!trimmed || !INDIAN_STATES.includes(trimmed)) {
          fieldError = "Please select your state"
        }
        break
      case "vehicleNumber":
        if (!trimmed) fieldError = "Vehicle number is required"
        else if (!/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(trimmed)) {
          fieldError = "Enter valid vehicle number (e.g., MP09AB1234)"
        }
        break
      case "panNumber":
        if (!trimmed) fieldError = "PAN number is required"
        else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(trimmed)) {
          fieldError = "Enter valid PAN number (e.g., ABCDE1234F)"
        }
        break
      case "aadharNumber": {
        const digits = nextValue.replace(/\s/g, "")
        if (!digits) fieldError = "Aadhaar number is required"
        else if (!/^\d{12}$/.test(digits)) {
          fieldError = "Enter valid 12-digit Aadhaar number"
        }
        break
      }
      default:
        break
    }

    setErrors((prev) => {
      const updated = { ...prev }
      if (fieldError) {
        updated[name] = fieldError
      } else {
        delete updated[name]
      }
      return updated
    })
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    } else if (!/^[a-zA-Z\s]{2,}$/.test(formData.name.trim())) {
      newErrors.name = "Enter valid name (letters and spaces only)"
    } else if (formData.name.trim().split(/\s+/).filter(Boolean).length < 2) {
      newErrors.name = "Please enter first and last name"
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format"
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required"
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required"
    } else if (!/^[A-Za-z\s]{2,}$/.test(formData.city.trim())) {
      newErrors.city = "Enter valid city name"
    }

    if (!formData.state.trim() || !INDIAN_STATES.includes(formData.state.trim())) {
      newErrors.state = "Please select your state"
    }

    if (!formData.vehicleNumber.trim()) {
      newErrors.vehicleNumber = "Vehicle number is required"
    } else if (!/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(formData.vehicleNumber.trim())) {
      newErrors.vehicleNumber = "Enter valid vehicle number (e.g., MP09AB1234)"
    }

    if (!formData.panNumber.trim()) {
      newErrors.panNumber = "PAN number is required"
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber.toUpperCase())) {
      newErrors.panNumber = "Enter valid PAN number (e.g., ABCDE1234F)"
    }

    if (!formData.aadharNumber.trim()) {
      newErrors.aadharNumber = "Aadhaar number is required"
    } else if (!/^\d{12}$/.test(formData.aadharNumber.replace(/\s/g, ""))) {
      newErrors.aadharNumber = "Enter valid 12-digit Aadhaar number"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      toast.error("Please fill all required fields correctly")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await deliveryAPI.submitSignupDetails({
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        vehicleType: formData.vehicleType,
        vehicleName: formData.vehicleName.trim() || null,
        vehicleNumber: formData.vehicleNumber.trim(),
        panNumber: formData.panNumber.trim().toUpperCase(),
        aadharNumber: formData.aadharNumber.replace(/\s/g, "")
      })

      if (response?.data?.success) {
        toast.success("Details saved successfully")
        // Persist the latest saved details so returning to this page pre-fills from backend state
        try {
          if (typeof window !== "undefined") {
            sessionStorage.setItem(getSignupStorageKey(), JSON.stringify({
              ...formData,
              name: formData.name.trim(),
              email: formData.email.trim(),
              address: formData.address.trim(),
              city: formData.city.trim(),
              state: formData.state.trim(),
              vehicleNumber: formData.vehicleNumber.trim(),
              panNumber: formData.panNumber.trim().toUpperCase(),
              aadharNumber: formData.aadharNumber.replace(/\s/g, "")
            }))
          }
        } catch (storageError) {
          console.warn("Failed to persist saved signup details:", storageError)
        }
        navigate("/delivery/signup/documents")
      }
    } catch (error) {
      console.error("Error submitting signup details:", error)
      const message = error?.response?.data?.message || "Failed to save details. Please try again."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200">
        <button
          type="button"
          onClick={() => {
            try {
              // Clear current auth session before going back so the Guard
              // doesn't force a redirect to home.
              clearModuleAuth("delivery")
              
              const raw = sessionStorage.getItem("deliveryAuthData")
              if (raw) {
                navigate("/delivery/otp")
                return
              }
            } catch (e) {
              console.warn("Failed to clear auth session on back:", e)
            }
            navigate("/delivery/sign-in")
          }}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium">Complete Your Profile</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Basic Details</h2>
          <p className="text-sm text-gray-600">Please provide your information to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Enter your full name"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (Optional)
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.email ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Enter your email"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={3}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.address ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Enter your address"
            />
            {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
          </div>

          {/* City and State */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  errors.city ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Enter city"
              />
              {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <select
                name="state"
                value={formData.state}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white ${
                  errors.state ? "border-red-500" : "border-gray-300"
                }`}
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
            </div>
          </div>

          {/* Vehicle Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type <span className="text-red-500">*</span>
            </label>
            <select
              name="vehicleType"
              value={formData.vehicleType}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="bike">Bike</option>
              <option value="scooter">Scooter</option>
              <option value="bicycle">Bicycle</option>
              <option value="car">Car</option>
            </select>
          </div>

          {/* Vehicle Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Name/Model (Optional)
            </label>
            <input
              type="text"
              name="vehicleName"
              value={formData.vehicleName}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="e.g., Honda Activa"
            />
          </div>

          {/* Vehicle Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="vehicleNumber"
              value={formData.vehicleNumber}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.vehicleNumber ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g., MH12AB1234"
            />
            {errors.vehicleNumber && <p className="text-red-500 text-sm mt-1">{errors.vehicleNumber}</p>}
          </div>

          {/* PAN Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PAN Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="panNumber"
              value={formData.panNumber}
              onChange={handleChange}
              maxLength={10}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 uppercase ${
                errors.panNumber ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="ABCDE1234F"
            />
            {errors.panNumber && <p className="text-red-500 text-sm mt-1">{errors.panNumber}</p>}
          </div>

          {/* Aadhaar Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aadhaar Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="aadharNumber"
              value={formData.aadharNumber}
              onChange={handleChange}
              maxLength={14}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.aadharNumber ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="XXXX XXXX XXXX"
            />
            {errors.aadharNumber && <p className="text-red-500 text-sm mt-1">{errors.aadharNumber}</p>}
          </div>

          {/* Submit Button */}
          {(() => {
            const isFormValid =
              !isSubmitting &&
              formData.name.trim() &&
              formData.address.trim() &&
              formData.city.trim() &&
              formData.state.trim() &&
              INDIAN_STATES.includes(formData.state.trim()) &&
              formData.vehicleNumber.trim() &&
              formData.panNumber.trim() &&
              formData.aadharNumber.trim() &&
              Object.keys(errors).length === 0

            return (
              <button
                type="submit"
                disabled={!isFormValid}
                className={`w-full py-4 rounded-lg font-bold text-white text-base transition-colors mt-6 ${
                  !isFormValid
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#00B761] hover:bg-[#00A055]"
                }`}
              >
                {isSubmitting ? "Saving..." : "Continue"}
              </button>
            )
          })()}
        </form>
      </div>
    </div>
  )
}

