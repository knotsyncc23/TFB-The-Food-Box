import { useState, useRef, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, X, Check, Camera, Image } from "lucide-react"
import { deliveryAPI } from "@/lib/api"
import apiClient from "@/lib/api/axios"
import { toast } from "sonner"
import { openCameraViaFlutter, hasFlutterCameraBridge } from "@/lib/utils/cameraBridge"

const STORAGE_PREFIX = "delivery_signup_documents"

function getDocumentsStorageKey() {
  try {
    const authRaw = sessionStorage.getItem("deliveryAuthData")
    if (!authRaw) return STORAGE_PREFIX
    const auth = JSON.parse(authRaw)
    const phone = String(auth?.phone || "").replace(/\D/g, "")
    return phone ? `${STORAGE_PREFIX}_${phone}` : STORAGE_PREFIX
  } catch {
    return STORAGE_PREFIX
  }
}

const emptyDocs = {
  profilePhoto: null,
  aadharPhoto: null,
  panPhoto: null,
  drivingLicensePhoto: null,
}

function DocumentUpload({
  docType,
  label,
  required = true,
  uploadedDocs,
  uploading,
  onFileSelect,
  onRemove,
}) {
  const uploaded = uploadedDocs[docType]
  const isUploading = uploading[docType]
  const galleryInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const handleCamera = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (isUploading) return

    if (hasFlutterCameraBridge()) {
      try {
        const result = await openCameraViaFlutter({ source: "camera" })
        if (result?.success && result.file) {
          await onFileSelect(docType, result.file)
        } else if (result && !result.success) {
          toast.error("Failed to capture image from camera")
        }
      } catch {
        toast.error("Failed to open camera. Please try again.")
      }
    } else if (cameraInputRef.current) {
      cameraInputRef.current.click()
    }
  }

  const handleGallery = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (isUploading) return

    if (hasFlutterCameraBridge()) {
      try {
        const result = await openCameraViaFlutter({ source: "gallery" })
        if (result?.success && result.file) {
          await onFileSelect(docType, result.file)
        }
      } catch (err) {
        galleryInputRef.current?.click()
      }
    } else {
      galleryInputRef.current?.click()
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) onFileSelect(docType, selectedFile)
    e.target.value = ""
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {uploaded ? (
        <div className="relative">
          <img
            src={uploaded.url}
            alt={label}
            className="w-full h-48 object-cover rounded-lg"
          />
          <button
            type="button"
            onClick={() => onRemove(docType)}
            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-2 bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm">
            <Check className="w-4 h-4" />
            <span>Uploaded</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-lg">
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mb-2"></div>
                <p className="text-sm text-gray-500">Uploading...</p>
              </>
            ) : (
              <p className="text-sm text-gray-500 py-4">PNG, JPG up to 5MB</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleGallery}
              disabled={isUploading}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-gray-300 hover:border-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Image className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium">Select From Gallery</span>
            </button>
            <button
              type="button"
              onClick={handleCamera}
              disabled={isUploading}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-gray-300 hover:border-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Camera className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium">Camera</span>
            </button>
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
          />
        </div>
      )}
    </div>
  )
}

export default function SignupStep2() {
  const navigate = useNavigate()
  const [uploadedDocs, setUploadedDocs] = useState(emptyDocs)
  const [uploading, setUploading] = useState({
    profilePhoto: false,
    aadharPhoto: false,
    panPhoto: false,
    drivingLicensePhoto: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(getDocumentsStorageKey())
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.uploadedDocs && typeof parsed.uploadedDocs === "object") {
        setUploadedDocs((prev) => ({ ...prev, ...parsed.uploadedDocs }))
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(
        getDocumentsStorageKey(),
        JSON.stringify({ uploadedDocs }),
      )
    } catch {
      /* ignore */
    }
  }, [uploadedDocs])

  const handleFileSelect = useCallback(async (docType, file) => {
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB")
      return
    }

    setUploading((prev) => ({ ...prev, [docType]: true }))

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "appzeto/delivery/documents")

      const response = await apiClient.post("/upload/media", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      if (response?.data?.success && response?.data?.data) {
        const { url, publicId } = response.data.data

        setUploadedDocs((prev) => ({
          ...prev,
          [docType]: { url, publicId },
        }))

        toast.success(
          `${docType.replace(/([A-Z])/g, " $1").trim()} uploaded successfully`,
        )
      }
    } catch (error) {
      console.error(`Error uploading ${docType}:`, error)
      toast.error(
        `Failed to upload ${docType.replace(/([A-Z])/g, " $1").trim()}`,
      )
    } finally {
      setUploading((prev) => ({ ...prev, [docType]: false }))
    }
  }, [])

  const handleRemove = useCallback((docType) => {
    setUploadedDocs((prev) => ({
      ...prev,
      [docType]: null,
    }))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (
      !uploadedDocs.profilePhoto ||
      !uploadedDocs.aadharPhoto ||
      !uploadedDocs.panPhoto ||
      !uploadedDocs.drivingLicensePhoto
    ) {
      toast.error("Please upload all required documents")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await deliveryAPI.submitSignupDocuments({
        profilePhoto: uploadedDocs.profilePhoto,
        aadharPhoto: uploadedDocs.aadharPhoto,
        panPhoto: uploadedDocs.panPhoto,
        drivingLicensePhoto: uploadedDocs.drivingLicensePhoto,
      })

      if (response?.data?.success) {
        try {
          sessionStorage.removeItem(getDocumentsStorageKey())
        } catch {
          /* ignore */
        }
        toast.success("Signup completed successfully!")
        setTimeout(() => {
          navigate("/delivery", { replace: true })
        }, 1000)
      }
    } catch (error) {
      console.error("Error submitting documents:", error)
      const message =
        error?.response?.data?.message ||
        "Failed to submit documents. Please try again."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200">
        <button
          type="button"
          onClick={() => navigate("/delivery/signup/details")}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium">Upload Documents</h1>
      </div>

      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Document Verification
          </h2>
          <p className="text-sm text-gray-600">
            Please upload clear photos of your documents
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <DocumentUpload
            docType="profilePhoto"
            label="Profile Photo"
            required
            uploadedDocs={uploadedDocs}
            uploading={uploading}
            onFileSelect={handleFileSelect}
            onRemove={handleRemove}
          />
          <DocumentUpload
            docType="aadharPhoto"
            label="Aadhar Card Photo"
            required
            uploadedDocs={uploadedDocs}
            uploading={uploading}
            onFileSelect={handleFileSelect}
            onRemove={handleRemove}
          />
          <DocumentUpload
            docType="panPhoto"
            label="PAN Card Photo"
            required
            uploadedDocs={uploadedDocs}
            uploading={uploading}
            onFileSelect={handleFileSelect}
            onRemove={handleRemove}
          />
          <DocumentUpload
            docType="drivingLicensePhoto"
            label="Driving License Photo"
            required
            uploadedDocs={uploadedDocs}
            uploading={uploading}
            onFileSelect={handleFileSelect}
            onRemove={handleRemove}
          />

          <button
            type="submit"
            disabled={
              isSubmitting ||
              !uploadedDocs.profilePhoto ||
              !uploadedDocs.aadharPhoto ||
              !uploadedDocs.panPhoto ||
              !uploadedDocs.drivingLicensePhoto
            }
            className={`w-full py-4 rounded-lg font-bold text-white text-base transition-colors mt-6 ${
              isSubmitting ||
              !uploadedDocs.profilePhoto ||
              !uploadedDocs.aadharPhoto ||
              !uploadedDocs.panPhoto ||
              !uploadedDocs.drivingLicensePhoto
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#00B761] hover:bg-[#00A055]"
            }`}
          >
            {isSubmitting ? "Submitting..." : "Complete Signup"}
          </button>
        </form>
      </div>
    </div>
  )
}
