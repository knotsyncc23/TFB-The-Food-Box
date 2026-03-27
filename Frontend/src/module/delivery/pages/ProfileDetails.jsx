import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Edit2, ChevronRight, FileText, CheckCircle, XCircle, Eye, X, Camera, Trash2 } from "lucide-react"
import BottomPopup from "../components/BottomPopup"
import { toast } from "sonner"
import { deliveryAPI } from "@/lib/api"
import apiClient from "@/lib/api/axios"
import { openCameraViaFlutter, hasFlutterCameraBridge } from "@/lib/utils/cameraBridge"

const BANK_OPTIONS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "IDFC FIRST Bank",
]

export default function ProfileDetails() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [showVehiclePopup, setShowVehiclePopup] = useState(false)
  const [vehicleInput, setVehicleInput] = useState("")
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [showBankDetailsPopup, setShowBankDetailsPopup] = useState(false)
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: ""
  })
  const [bankDetailsErrors, setBankDetailsErrors] = useState({})
  const [isUpdatingBankDetails, setIsUpdatingBankDetails] = useState(false)
  const [showRiderDetailsPopup, setShowRiderDetailsPopup] = useState(false)
  const [riderDetails, setRiderDetails] = useState({
    name: "",
    city: "",
    vehicleType: "bike",
  })
  const [riderDetailsErrors, setRiderDetailsErrors] = useState({})
  const [isUpdatingRiderDetails, setIsUpdatingRiderDetails] = useState(false)
  const [showPersonalDetailsPopup, setShowPersonalDetailsPopup] = useState(false)
  const [personalDetails, setPersonalDetails] = useState({
    name: "",
    email: "",
    city: ""
  })
  const [personalDetailsErrors, setPersonalDetailsErrors] = useState({})
  const [isUpdatingPersonalDetails, setIsUpdatingPersonalDetails] = useState(false)
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false)
  const fileInputRef = useRef(null)
  const [showPhotoSourcePopup, setShowPhotoSourcePopup] = useState(false)

  const handleRemovePhoto = async () => {
    if (!window.confirm("Remove profile photo?")) return
    if (!profile?.profileImage?.url) {
      toast.error("There is no uploaded profile photo to remove")
      return
    }
    try {
      setIsUpdatingPhoto(true)
      await deliveryAPI.updateProfile({
        profileImage: { url: "", publicId: "" },
      })
      const response = await deliveryAPI.getProfile()
      if (response?.data?.success && response?.data?.data?.profile) {
        setProfile(response.data.data.profile)
      }
      toast.success("Profile photo removed")
    } catch (error) {
      console.error("Error removing profile photo:", error)
      toast.error(error?.response?.data?.message || "Failed to remove profile photo")
    } finally {
      setIsUpdatingPhoto(false)
    }
  }

  const handleProfilePhotoUpload = async (file) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB")
      return
    }
    try {
      setIsUpdatingPhoto(true)
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "appzeto/delivery/documents")
      const response = await apiClient.post("/upload/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      if (response?.data?.success && response?.data?.data) {
        const { url, publicId } = response.data.data
        await deliveryAPI.updateProfile({ profileImage: { url, publicId } })
        const profileRes = await deliveryAPI.getProfile()
        if (profileRes?.data?.success && profileRes?.data?.data?.profile) {
          setProfile(profileRes.data.data.profile)
        }
        toast.success("Profile photo updated successfully")
      } else {
        toast.error("Failed to upload profile photo")
      }
    } catch (error) {
      console.error("Error updating profile photo:", error)
      toast.error(error?.response?.data?.message || "Failed to update profile photo")
    } finally {
      setIsUpdatingPhoto(false)
    }
  }

  // Note: All alternate phone related code has been removed

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const response = await deliveryAPI.getProfile()
        if (response?.data?.success && response?.data?.data?.profile) {
          const profileData = response.data.data.profile
          setProfile(profileData)
          setVehicleNumber(profileData?.vehicle?.number || "")
          setVehicleInput(profileData?.vehicle?.number || "")
          // Set bank details
          setBankDetails({
            accountHolderName: profileData?.documents?.bankDetails?.accountHolderName || "",
            accountNumber: profileData?.documents?.bankDetails?.accountNumber || "",
            ifscCode: profileData?.documents?.bankDetails?.ifscCode || "",
            bankName: profileData?.documents?.bankDetails?.bankName || ""
          })
        }
      } catch (error) {
        console.error("Error fetching profile:", error)

        // More detailed error handling
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          toast.error("Cannot connect to server. Please check if backend is running.")
        } else if (error.response?.status === 401) {
          toast.error("Session expired. Please login again.")
          // Optionally redirect to login
          setTimeout(() => {
            navigate("/delivery/sign-in", { replace: true })
          }, 2000)
        } else {
          toast.error(error?.response?.data?.message || "Failed to load profile data")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [navigate])

  const hasUploadedProfilePhoto = !!profile?.profileImage?.url
  const hasAnyVisiblePhoto = hasUploadedProfilePhoto || !!profile?.documents?.photo

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium">Profile</h1>
      </div>

      {/* Profile Picture Area */}
      <div className="relative w-full bg-gray-200 flex items-center justify-center">
        <div className="relative group my-4">
          <div className="h-28 w-28 md:h-32 md:w-32 rounded-full overflow-hidden bg-gray-100 border-2 md:border-4 border-white shadow-md flex items-center justify-center">
            {profile?.profileImage?.url || profile?.documents?.photo ? (
              <img
                src={profile?.profileImage?.url || profile?.documents?.photo}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl md:text-3xl text-gray-400">
                {profile?.name?.[0]?.toUpperCase() || "D"}
              </span>
            )}
          </div>

          {/* Hover overlay for change/remove actions */}
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-xs text-white transition-opacity">
            <button
              type="button"
              disabled={isUpdatingPhoto}
              onClick={() => setShowPhotoSourcePopup(true)}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/90 text-gray-900 text-[11px] font-medium hover:bg-white disabled:opacity-60"
            >
              <Camera className="w-3 h-3" />
              <span>Change photo</span>
            </button>
            {hasUploadedProfilePhoto && (
              <button
                type="button"
                disabled={isUpdatingPhoto}
                onClick={handleRemovePhoto}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/90 text-white text-[11px] font-medium hover:bg-red-600 disabled:opacity-60"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
            )}
          </div>

          {/* Hidden file input for gallery fallback (camera uses Flutter bridge when in WebView) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleProfilePhotoUpload(file)
              if (e.target) e.target.value = ""
            }}
          />
        </div>
      </div>

      {/* Explicit profile photo actions for mobile/non-hover */}
      <div className="flex items-center justify-center gap-4 pb-2 pt-1">
        <button
          type="button"
          disabled={isUpdatingPhoto}
          onClick={() => setShowPhotoSourcePopup(true)}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
        >
          {hasAnyVisiblePhoto ? "Change photo" : "Upload photo"}
        </button>
        {hasUploadedProfilePhoto && (
          <button
            type="button"
            disabled={isUpdatingPhoto}
            onClick={handleRemovePhoto}
            className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>


      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Rider Details Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Rider details</h2>
            {!loading && profile && (
              <button
                type="button"
                onClick={() => {
                  setShowRiderDetailsPopup(true)
                  setRiderDetails({
                    name: profile?.name || "",
                    city: profile?.location?.city || "",
                    vehicleType: profile?.vehicle?.type || "bike",
                  })
                  setRiderDetailsErrors({})
                }}
                className="text-red-600 font-medium text-sm flex items-center gap-1 hover:text-red-700"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
          </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            <div className="p-2 px-3 flex items-center justify-between">
              <p className="text-base text-gray-900">
                {loading ? "Loading..." : `${profile?.name || "N/A"} (${profile?.deliveryId || "N/A"})`}
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">City</p>
                <p className="text-base text-gray-900">
                  {profile?.location?.city || "N/A"}
                </p>
              </div>
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">Vehicle type</p>
                <p className="text-base text-gray-900 capitalize">
                  {profile?.vehicle?.type || "N/A"}
                </p>
              </div>
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">Vehicle number</p>
                {vehicleNumber ? (
                  <div className="flex items-center gap-2">
                    <p className="text-base text-gray-900">{vehicleNumber}</p>
                    <button
                      onClick={() => {
                        setVehicleInput(vehicleNumber)
                        setShowVehiclePopup(true)
                      }}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setVehicleInput("")
                      setShowVehiclePopup(true)
                    }}
                    className="flex items-center gap-2 text-red-600 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-3">Documents</h2>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            {/* Aadhar Card */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">Aadhar Card</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const statusLower = profile?.status?.toLowerCase()
                    const hasDoc = !!profile?.documents?.aadhar?.document
                    const verified =
                      profile?.documents?.aadhar?.verified ||
                      ["active", "approved", "verified"].includes(statusLower || "")
                    if (!hasDoc) return "Not uploaded"
                    if (verified) return "Approved"
                    if (statusLower === "blocked") return "Rejected"
                    return "Pending"
                  })()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {profile?.documents?.aadhar?.document && (
                  <button
                    onClick={() => {
                      setSelectedDocument({
                        name: "Aadhar Card",
                        url: profile.documents.aadhar.document,
                      })
                      setShowDocumentModal(true)
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Eye className="w-5 h-5 text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            {/* PAN Card */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">PAN Card</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const statusLower = profile?.status?.toLowerCase()
                    const hasDoc = !!profile?.documents?.pan?.document
                    const verified =
                      profile?.documents?.pan?.verified ||
                      ["active", "approved", "verified"].includes(statusLower || "")
                    if (!hasDoc) return "Not uploaded"
                    if (verified) return "Approved"
                    if (statusLower === "blocked") return "Rejected"
                    return "Pending"
                  })()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {profile?.documents?.pan?.document && (
                  <button
                    onClick={() => {
                      setSelectedDocument({
                        name: "PAN Card",
                        url: profile.documents.pan.document,
                      })
                      setShowDocumentModal(true)
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Eye className="w-5 h-5 text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Driving License */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">Driving License</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const statusLower = profile?.status?.toLowerCase()
                    const hasDoc = !!profile?.documents?.drivingLicense?.document
                    const verified =
                      profile?.documents?.drivingLicense?.verified ||
                      ["active", "approved", "verified"].includes(statusLower || "")
                    if (!hasDoc) return "Not uploaded"
                    if (verified) return "Approved"
                    if (statusLower === "blocked") return "Rejected"
                    return "Pending"
                  })()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {profile?.documents?.drivingLicense?.document && (
                  <button
                    onClick={() => {
                      setSelectedDocument({
                        name: "Driving License",
                        url: profile.documents.drivingLicense.document,
                      })
                      setShowDocumentModal(true)
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Eye className="w-5 h-5 text-gray-600" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Personal Details Section */}
        <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-gray-900">Personal details</h2>
          <button
            onClick={() => {
              setShowPersonalDetailsPopup(true)
              setPersonalDetails({
                name: profile?.name || "",
                email: profile?.email || "",
                city: profile?.location?.city || "",
              })
              setPersonalDetailsErrors({})
            }}
            className="text-red-600 font-medium text-sm flex items-center gap-1 hover:text-red-700"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </button>
        </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Phone</p>
                <p className="text-base text-gray-900">
                  {profile?.phone || "N/A"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Email</p>
                <p className="text-base text-gray-900">{profile?.email || "-"}</p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Aadhar Card Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.aadhar?.number || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Wallet Balance</p>
                <p className="text-base text-gray-900">
                  ₹{profile?.wallet?.balance?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Status</p>
                <p className="text-base text-gray-900 capitalize">
                  {profile?.status || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Bank details</h2>
            <button
              onClick={() => {
                setShowBankDetailsPopup(true)
                // Pre-fill form with existing data
                setBankDetails({
                  accountHolderName: profile?.documents?.bankDetails?.accountHolderName || "",
                  accountNumber: profile?.documents?.bankDetails?.accountNumber || "",
                  ifscCode: profile?.documents?.bankDetails?.ifscCode || "",
                  bankName: profile?.documents?.bankDetails?.bankName || ""
                })
                setBankDetailsErrors({})
              }}
              className="text-red-600 font-medium text-sm flex items-center gap-1 hover:text-red-700"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Account Holder Name</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.accountHolderName || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Account Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.accountNumber
                    ? `****${profile.documents.bankDetails.accountNumber.slice(-4)}`
                    : "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">IFSC Code</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.ifscCode || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Bank Name</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.bankName || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Pan Card Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.pan?.number || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Photo source chooser using existing BottomPopup pattern */}
      <BottomPopup
        isOpen={showPhotoSourcePopup}
        onClose={() => setShowPhotoSourcePopup(false)}
        title="Update profile photo"
        showCloseButton={true}
      >
        <div className="py-4 space-y-3">
          <button
            type="button"
            disabled={isUpdatingPhoto}
            onClick={async () => {
              setShowPhotoSourcePopup(false)
              if (hasFlutterCameraBridge()) {
                const { success, file } = await openCameraViaFlutter()
                if (success && file) {
                  await handleProfilePhotoUpload(file)
                  return
                }
              }
              if (fileInputRef.current) {
                fileInputRef.current.setAttribute("capture", "environment")
                fileInputRef.current.click()
              }
            }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900">Use camera</span>
            <Camera className="w-4 h-4 text-gray-500" />
          </button>
          <button
            type="button"
            disabled={isUpdatingPhoto}
            onClick={() => {
              setShowPhotoSourcePopup(false)
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute("capture")
                fileInputRef.current.click()
              }
            }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900">Choose from gallery</span>
          </button>
        </div>
      </BottomPopup>

      {/* Vehicle Number Popup */}
      <BottomPopup
        isOpen={showVehiclePopup}
        onClose={() => setShowVehiclePopup(false)}
        title={vehicleNumber ? "Edit Vehicle Number" : "Add Vehicle Number"}
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="50vh"
      >
        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={vehicleInput}
              onChange={(e) => setVehicleInput(e.target.value)}
              placeholder="Enter vehicle number"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <button
            onClick={async () => {
              const raw = vehicleInput.trim().toUpperCase().replace(/[\s-]/g, "")
              const vehicleRegex = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/
              if (!raw || !vehicleRegex.test(raw)) {
                toast.error("Please enter a valid vehicle number (e.g., MH12AB1234)")
                return
              }
              try {
                await deliveryAPI.updateProfile({
                  vehicle: {
                    ...profile?.vehicle,
                    number: raw,
                  },
                })
                setVehicleNumber(raw)
                setShowVehiclePopup(false)
                toast.success("Vehicle number updated successfully")
                const response = await deliveryAPI.getProfile()
                if (response?.data?.success && response?.data?.data?.profile) {
                  setProfile(response.data.data.profile)
                }
              } catch (error) {
                console.error("Error updating vehicle number:", error)
                toast.error(error?.response?.data?.message || "Failed to update vehicle number")
              }
            }}
            className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            {vehicleNumber ? "Update" : "Add"}
          </button>
        </div>
      </BottomPopup>

      {/* Document Image Modal */}
      {showDocumentModal && selectedDocument && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowDocumentModal(false)
                setSelectedDocument(null)
              }}
              className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            {/* Document Title */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{selectedDocument.name}</h3>
            </div>

            {/* Document Image */}
            <div className="p-4">
              <img
                src={selectedDocument.url}
                alt={selectedDocument.name}
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bank Details Edit Popup */}
      <BottomPopup
        isOpen={showBankDetailsPopup}
        onClose={() => {
          setShowBankDetailsPopup(false)
          setBankDetailsErrors({})
        }}
        title="Edit Bank Details"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="80vh"
      >
        <div className="space-y-4">
          {/* Account Holder Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Holder Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bankDetails.accountHolderName}
              onChange={(e) => {
                setBankDetails(prev => ({ ...prev, accountHolderName: e.target.value }))
                setBankDetailsErrors(prev => ({ ...prev, accountHolderName: "" }))
              }}
              placeholder="Enter account holder name"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${bankDetailsErrors.accountHolderName ? "border-red-500" : "border-gray-300"
                }`}
            />
            {bankDetailsErrors.accountHolderName && (
              <p className="text-red-500 text-xs mt-1">{bankDetailsErrors.accountHolderName}</p>
            )}
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bankDetails.accountNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '') // Only numbers
                setBankDetails(prev => ({ ...prev, accountNumber: value }))
                setBankDetailsErrors(prev => ({ ...prev, accountNumber: "" }))
              }}
              placeholder="Enter account number"
              maxLength={18}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${bankDetailsErrors.accountNumber ? "border-red-500" : "border-gray-300"
                }`}
            />
            {bankDetailsErrors.accountNumber && (
              <p className="text-red-500 text-xs mt-1">{bankDetailsErrors.accountNumber}</p>
            )}
          </div>

          {/* IFSC Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              IFSC Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bankDetails.ifscCode}
              onChange={(e) => {
                const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') // Only uppercase letters and numbers
                setBankDetails(prev => ({ ...prev, ifscCode: value }))
                setBankDetailsErrors(prev => ({ ...prev, ifscCode: "" }))
              }}
              placeholder="Enter IFSC code"
              maxLength={11}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${bankDetailsErrors.ifscCode ? "border-red-500" : "border-gray-300"
                }`}
            />
            {bankDetailsErrors.ifscCode && (
              <p className="text-red-500 text-xs mt-1">{bankDetailsErrors.ifscCode}</p>
            )}
          </div>

          {/* Bank Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank Name <span className="text-red-500">*</span>
            </label>
            <select
              value={bankDetails.bankName}
              onChange={(e) => {
                setBankDetails(prev => ({ ...prev, bankName: e.target.value }))
                setBankDetailsErrors(prev => ({ ...prev, bankName: "" }))
              }}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${bankDetailsErrors.bankName ? "border-red-500" : "border-gray-300"
                }`}
            >
              <option value="">Select bank</option>
              {BANK_OPTIONS.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
            {bankDetailsErrors.bankName && (
              <p className="text-red-500 text-xs mt-1">{bankDetailsErrors.bankName}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={async () => {
              // Validate
              const errors = {}
              if (!bankDetails.accountHolderName.trim()) {
                errors.accountHolderName = "Account holder name is required"
              }
              if (!bankDetails.accountNumber.trim()) {
                errors.accountNumber = "Account number is required"
              } else if (bankDetails.accountNumber.length < 9 || bankDetails.accountNumber.length > 18) {
                errors.accountNumber = "Account number must be between 9 and 18 digits"
              }
              if (!bankDetails.ifscCode.trim()) {
                errors.ifscCode = "IFSC code is required"
              } else if (bankDetails.ifscCode.length !== 11) {
                errors.ifscCode = "IFSC code must be 11 characters"
              }
              if (!bankDetails.bankName.trim()) {
                errors.bankName = "Bank name is required"
              } else if (!BANK_OPTIONS.includes(bankDetails.bankName.trim())) {
                errors.bankName = "Please select a valid bank"
              }

              if (Object.keys(errors).length > 0) {
                setBankDetailsErrors(errors)
                toast.error("Please fill all required fields correctly")
                return
              }

              setIsUpdatingBankDetails(true)
              try {
                await deliveryAPI.updateProfile({
                  documents: {
                    ...profile?.documents,
                    bankDetails: {
                      accountHolderName: bankDetails.accountHolderName.trim(),
                      accountNumber: bankDetails.accountNumber.trim(),
                      ifscCode: bankDetails.ifscCode.trim(),
                      bankName: bankDetails.bankName.trim()
                    }
                  }
                })
                toast.success("Bank details updated successfully")
                setShowBankDetailsPopup(false)
                // Refetch profile
                const response = await deliveryAPI.getProfile()
                if (response?.data?.success && response?.data?.data?.profile) {
                  setProfile(response.data.data.profile)
                }
              } catch (error) {
                console.error("Error updating bank details:", error)
                toast.error(error?.response?.data?.message || "Failed to update bank details")
              } finally {
                setIsUpdatingBankDetails(false)
              }
            }}
            disabled={isUpdatingBankDetails}
            className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${isUpdatingBankDetails
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#00B761] hover:bg-[#00A055]"
              }`}
          >
            {isUpdatingBankDetails ? "Updating..." : "Save Bank Details"}
          </button>
        </div>
      </BottomPopup>

      {/* Rider Details Edit Popup */}
      <BottomPopup
        isOpen={showRiderDetailsPopup}
        onClose={() => {
          setShowRiderDetailsPopup(false)
          setRiderDetailsErrors({})
        }}
        title="Edit Rider Details"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="60vh"
      >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rider Name
            </label>
            <input
              type="text"
              value={riderDetails.name}
              onChange={(e) => {
                setRiderDetails((prev) => ({ ...prev, name: e.target.value }))
                setRiderDetailsErrors((prev) => ({ ...prev, name: "" }))
              }}
              placeholder="Enter rider name"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                riderDetailsErrors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {riderDetailsErrors.name && (
              <p className="text-red-500 text-xs mt-1">{riderDetailsErrors.name}</p>
            )}
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <input
              type="text"
              value={riderDetails.city}
              onChange={(e) => {
                const value = e.target.value.replace(/[^a-zA-Z\s]/g, "")
                setRiderDetails((prev) => ({ ...prev, city: value }))
                setRiderDetailsErrors((prev) => ({ ...prev, city: "" }))
              }}
              placeholder="Enter city"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                riderDetailsErrors.city ? "border-red-500" : "border-gray-300"
              }`}
            />
            {riderDetailsErrors.city && (
              <p className="text-red-500 text-xs mt-1">{riderDetailsErrors.city}</p>
            )}
          </div>

          {/* Vehicle Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type
            </label>
            <select
              value={riderDetails.vehicleType}
              onChange={(e) => {
                setRiderDetails((prev) => ({ ...prev, vehicleType: e.target.value }))
                setRiderDetailsErrors((prev) => ({ ...prev, vehicleType: "" }))
              }}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                riderDetailsErrors.vehicleType ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select vehicle type</option>
              <option value="bike">Bike</option>
              <option value="scooter">Scooter</option>
              <option value="bicycle">Bicycle</option>
              <option value="car">Car</option>
            </select>
            {riderDetailsErrors.vehicleType && (
              <p className="text-red-500 text-xs mt-1">{riderDetailsErrors.vehicleType}</p>
            )}
          </div>

          <button
            onClick={async () => {
              const errors = {}
              const nameTrimmed = riderDetails.name.trim()
              const cityTrimmed = riderDetails.city.trim()
              const vehicleType = riderDetails.vehicleType

              if (!nameTrimmed) {
                errors.name = "Name is required"
              } else if (!/^[a-zA-Z\s'-]{2,50}$/.test(nameTrimmed)) {
                errors.name = "Name can only contain letters and spaces (2-50 characters)"
              }

              if (!cityTrimmed) {
                errors.city = "City is required"
              } else if (!/^[A-Za-z\s]{2,}$/.test(cityTrimmed)) {
                errors.city = "City should only contain letters and spaces"
              }

              const allowedVehicleTypes = ["bike", "scooter", "bicycle", "car"]
              if (!vehicleType || !allowedVehicleTypes.includes(vehicleType)) {
                errors.vehicleType = "Please select vehicle type"
              }

              if (Object.keys(errors).length > 0) {
                setRiderDetailsErrors(errors)
                toast.error("Please fix the highlighted fields")
                return
              }

              setIsUpdatingRiderDetails(true)
              try {
                await deliveryAPI.updateProfile({
                  name: nameTrimmed,
                  location: {
                    ...profile?.location,
                    city: cityTrimmed,
                  },
                  vehicle: {
                    ...profile?.vehicle,
                    type: vehicleType,
                  },
                })
                const refreshed = await deliveryAPI.getProfile()
                if (refreshed?.data?.success && refreshed?.data?.data?.profile) {
                  setProfile(refreshed.data.data.profile)
                  setVehicleNumber(refreshed.data.data.profile?.vehicle?.number || vehicleNumber)
                }
                toast.success("Rider details updated successfully")
                setShowRiderDetailsPopup(false)
              } catch (error) {
                console.error("Error updating rider details:", error)
                toast.error(error?.response?.data?.message || "Failed to update rider details")
              } finally {
                setIsUpdatingRiderDetails(false)
              }
            }}
            disabled={isUpdatingRiderDetails}
            className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${
              isUpdatingRiderDetails
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#00B761] hover:bg-[#00A055]"
            }`}
          >
            {isUpdatingRiderDetails ? "Updating..." : "Save Rider Details"}
          </button>
        </div>
      </BottomPopup>

      {/* Personal Details Edit Popup */}
      <BottomPopup
        isOpen={showPersonalDetailsPopup}
        onClose={() => {
          setShowPersonalDetailsPopup(false)
          setPersonalDetailsErrors({})
        }}
        title="Edit Personal Details"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="70vh"
      >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={personalDetails.name}
              onChange={(e) => {
                setPersonalDetails(prev => ({ ...prev, name: e.target.value }))
                setPersonalDetailsErrors(prev => ({ ...prev, name: "" }))
              }}
              placeholder="Enter full name"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${personalDetailsErrors.name ? "border-red-500" : "border-gray-300"
                }`}
            />
            {personalDetailsErrors.name && (
              <p className="text-red-500 text-xs mt-1">{personalDetailsErrors.name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={personalDetails.email}
              onChange={(e) => {
                setPersonalDetails(prev => ({ ...prev, email: e.target.value }))
                setPersonalDetailsErrors(prev => ({ ...prev, email: "" }))
              }}
              placeholder="Enter email address"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${personalDetailsErrors.email ? "border-red-500" : "border-gray-300"
                }`}
            />
            {personalDetailsErrors.email && (
              <p className="text-red-500 text-xs mt-1">{personalDetailsErrors.email}</p>
            )}
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <input
              type="text"
              value={personalDetails.city}
              onChange={(e) => {
                setPersonalDetails(prev => ({ ...prev, city: e.target.value }))
                setPersonalDetailsErrors(prev => ({ ...prev, city: "" }))
              }}
              placeholder="Enter city"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${personalDetailsErrors.city ? "border-red-500" : "border-gray-300"
                }`}
            />
            {personalDetailsErrors.city && (
              <p className="text-red-500 text-xs mt-1">{personalDetailsErrors.city}</p>
            )}
          </div>

          <button
            onClick={async () => {
              const errors = {}

              const nameTrimmed = personalDetails.name.trim()
              const cityTrimmed = personalDetails.city.trim()
              const emailTrimmed = personalDetails.email.trim()

              if (nameTrimmed && !/^[a-zA-Z\s'-]{2,50}$/.test(nameTrimmed)) {
                errors.name = "Name can only contain letters and spaces (2-50 characters)"
              }

              if (cityTrimmed && !/^[a-zA-Z\s]+$/.test(cityTrimmed)) {
                errors.city = "City should only contain letters and spaces"
              }

              if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
                errors.email = "Please enter a valid email address"
              }

              if (Object.keys(errors).length > 0) {
                setPersonalDetailsErrors(errors)
                toast.error("Please fix the highlighted fields")
                return
              }

              setIsUpdatingPersonalDetails(true)
              try {
                const updatePayload = {}
                if (nameTrimmed) updatePayload.name = nameTrimmed
                if (emailTrimmed) updatePayload.email = emailTrimmed
                if (cityTrimmed) {
                  updatePayload.location = {
                    ...profile?.location,
                    city: cityTrimmed,
                  }
                }

                if (Object.keys(updatePayload).length === 0) {
                  toast.error("Nothing to update")
                  setIsUpdatingPersonalDetails(false)
                  return
                }

                await deliveryAPI.updateProfile(updatePayload)
                const refreshed = await deliveryAPI.getProfile()
                if (refreshed?.data?.success && refreshed?.data?.data?.profile) {
                  setProfile(refreshed.data.data.profile)
                }
                toast.success("Personal details updated successfully")
                setShowPersonalDetailsPopup(false)
              } catch (error) {
                console.error("Error updating personal details:", error)
                toast.error(error?.response?.data?.message || "Failed to update personal details")
              } finally {
                setIsUpdatingPersonalDetails(false)
              }
            }}
            disabled={isUpdatingPersonalDetails}
            className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${isUpdatingPersonalDetails
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#00B761] hover:bg-[#00A055]"
              }`}
          >
            {isUpdatingPersonalDetails ? "Updating..." : "Save Personal Details"}
          </button>
        </div>
      </BottomPopup>

    </div>
  )
}

