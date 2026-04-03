import { useState, useEffect } from "react"
import { Settings, Key, Save, Loader2 } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"

export default function SystemAddons() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form state for all environment variables
  const [envData, setEnvData] = useState({
    // Razorpay
    RAZORPAY_API_KEY: "",
    RAZORPAY_SECRET_KEY: "",

    // Cloudinary
    CLOUDINARY_CLOUD_NAME: "",
    CLOUDINARY_API_KEY: "",
    CLOUDINARY_API_SECRET: "",

    // Firebase
    FIREBASE_API_KEY: "",
    FIREBASE_AUTH_DOMAIN: "",
    FIREBASE_STORAGE_BUCKET: "",
    FIREBASE_MESSAGING_SENDER_ID: "",
    FIREBASE_APP_ID: "",
    MEASUREMENT_ID: "",
    FIREBASE_PROJECT_ID: "",
    FIREBASE_CLIENT_EMAIL: "",
    FIREBASE_PRIVATE_KEY: "",
    FIREBASE_VAPID_KEY: "",
    FIREBASE_DATABASE_URL: "",

    // SMTP
    SMTP_HOST: "",
    SMTP_PORT: "",
    SMTP_USER: "",
    SMTP_PASS: "",

    // SMS Hub India
    SMSINDIAHUB_API_KEY: "",
    SMSINDIAHUB_SENDER_ID: "",

    // Google Maps
    VITE_GOOGLE_MAPS_API_KEY: "",

    // Apple Sign-In
    // APPLE_CLIENT_ID: "",
    // APPLE_REDIRECT_URI: "",

    APPLE_CLIENT_ID: "app.tifunbox.com",
    APPLE_REDIRECT_URI: "https://app.tifunbox.com/__/auth/handler",






  })




  // Load environment variables on component mount
  useEffect(() => {
    loadEnvVariables()
  }, [])

  const loadEnvVariables = async () => {
    try {
      setIsLoading(true)
      const response = await adminAPI.getEnvVariables()
      if (response.data.success && response.data.data) {
        setEnvData(prev => ({
          ...prev,
          ...response.data.data
        }))
      }
    } catch (error) {
      console.error("Error loading environment variables:", error)
      // Don't show error toast on initial load if endpoint doesn't exist yet
      if (error.response?.status !== 404) {
        toast.error("Failed to load environment variables")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (key, value) => {
    setEnvData(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const response = await adminAPI.saveEnvVariables(envData)
      if (response.data.success) {
        toast.success("Environment variables saved successfully")

        // Clear Google Maps API key cache after saving
        try {
          const { clearGoogleMapsApiKeyCache } = await import('@/lib/utils/googleMapsApiKey.js');
          clearGoogleMapsApiKeyCache();
        } catch (cacheError) {
          console.warn("Failed to clear cache:", cacheError);
        }
      } else {
        toast.error(response.data.message || "Failed to save environment variables")
      }
    } catch (error) {
      console.error("Error saving environment variables:", error)
      toast.error(error.response?.data?.message || "Failed to save environment variables")
    } finally {
      setIsSaving(false)
    }
  }

  const InputField = ({ label, fieldKey, type = "text", placeholder = "" }) => {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">{label}</label>
        {type === "textarea" ? (
          <textarea
            value={envData[fieldKey] || ""}
            onChange={(e) => handleInputChange(fieldKey, e.target.value)}
            placeholder={placeholder || `Enter ${label}`}
            rows={4}
            className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm resize-y"
          />
        ) : (
          <input
            type={type}
            value={envData[fieldKey] || ""}
            onChange={(e) => handleInputChange(fieldKey, e.target.value)}
            placeholder={placeholder || `Enter ${label}`}
            className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
          />
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-slate-600 font-medium">Loading environment variables...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <Key className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">ENV Setup</h1>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save All
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Razorpay Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Key className="w-4 h-4 text-blue-600" />
              </div>
              Razorpay Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Razorpay API Key" fieldKey="RAZORPAY_API_KEY" />
              <InputField label="Razorpay Secret Key" fieldKey="RAZORPAY_SECRET_KEY" type="password" />
            </div>
          </div>

          {/* Cloudinary Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <Key className="w-4 h-4 text-red-600" />
              </div>
              Cloudinary Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField label="Cloudinary Cloud Name" fieldKey="CLOUDINARY_CLOUD_NAME" />
              <InputField label="Cloudinary API Key" fieldKey="CLOUDINARY_API_KEY" />
              <InputField label="Cloudinary API Secret" fieldKey="CLOUDINARY_API_SECRET" type="password" />
            </div>
          </div>

          {/* Firebase Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Key className="w-4 h-4 text-orange-600" />
              </div>
              Firebase Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Firebase API Key" fieldKey="FIREBASE_API_KEY" />
              <InputField label="Firebase Auth Domain" fieldKey="FIREBASE_AUTH_DOMAIN" />
              <InputField label="Firebase Storage Bucket" fieldKey="FIREBASE_STORAGE_BUCKET" />
              <InputField label="Firebase Messaging Sender ID" fieldKey="FIREBASE_MESSAGING_SENDER_ID" />
              <InputField label="Firebase App ID" fieldKey="FIREBASE_APP_ID" />
              <InputField label="Measurement ID" fieldKey="MEASUREMENT_ID" />
              <InputField label="Firebase Project ID" fieldKey="FIREBASE_PROJECT_ID" />
              <InputField label="Firebase Client Email" fieldKey="FIREBASE_CLIENT_EMAIL" type="email" />
              <div className="md:col-span-2">
                <InputField
                  label="Firebase Realtime Database URL"
                  fieldKey="FIREBASE_DATABASE_URL"
                  placeholder="https://tifunbox-default-rtdb.asia-southeast1.firebasedatabase.app"
                />
              </div>
              <div className="md:col-span-2">
                <InputField
                  label="Firebase VAPID Key (Web Push)"
                  fieldKey="FIREBASE_VAPID_KEY"
                  placeholder="Public key from Firebase Console → Cloud Messaging → Web Push certificates (Key pair)"
                />
              </div>
              <div className="md:col-span-2">
                <InputField
                  label="Firebase Private Key"
                  fieldKey="FIREBASE_PRIVATE_KEY"
                  type="textarea"
                  placeholder="Enter Firebase Private Key (can be multiline)"
                />
              </div>
            </div>
          </div>

          {/* SMTP Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Key className="w-4 h-4 text-purple-600" />
              </div>
              SMTP Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="SMTP Host" fieldKey="SMTP_HOST" placeholder="smtp.gmail.com" />
              <InputField label="SMTP Port" fieldKey="SMTP_PORT" type="number" placeholder="587" />
              <InputField label="SMTP User" fieldKey="SMTP_USER" type="email" />
              <InputField label="SMTP Password" fieldKey="SMTP_PASS" type="password" />
            </div>
          </div>

          {/* SMS Hub India Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                <Key className="w-4 h-4 text-pink-600" />
              </div>
              SMS Hub India Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="SMS Hub India API Key" fieldKey="SMSINDIAHUB_API_KEY" />
              <InputField label="SMS Hub India Sender ID" fieldKey="SMSINDIAHUB_SENDER_ID" />
            </div>
          </div>

          {/* Apple Sign-In Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
                <Key className="w-4 h-4 text-white" />
              </div>
              Apple Sign-In Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Apple Service ID (Client ID)"
                fieldKey="APPLE_CLIENT_ID"
                placeholder="e.g. com.example.foodapp"
              />
              <InputField
                label="Apple Redirect URI"
                fieldKey="APPLE_REDIRECT_URI"
                placeholder="https://app.example.com/auth/apple/callback"
              />
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Make sure the redirect URI matches exactly what you register in the Apple Developer Console.
            </p>
          </div>

          {/* Google Maps Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <Key className="w-4 h-4 text-red-600" />
              </div>
              Google Maps Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <InputField label="Google Maps API Key" fieldKey="VITE_GOOGLE_MAPS_API_KEY" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
