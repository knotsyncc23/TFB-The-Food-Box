import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import {
  ArrowLeft,
  Edit,
  Pencil,
  Plus,
  MapPin,
  Clock,
  Phone,
  Star,
  ChevronRight,
  X,
  Trash2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { restaurantAPI } from "@/lib/api"
import { toast } from "sonner"
import { openCameraViaFlutter, hasFlutterCameraBridge } from "@/lib/utils/cameraBridge"

const CUISINES_STORAGE_KEY = "restaurant_cuisines"

export default function OutletInfo() {
  const navigate = useNavigate()
  
  // State management
  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [restaurantName, setRestaurantName] = useState("")
  const [cuisineTags, setCuisineTags] = useState("")
  const [address, setAddress] = useState("")
  const [mainImage, setMainImage] = useState("https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop")
  const [thumbnailImage, setThumbnailImage] = useState("https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop")
  const [coverImages, setCoverImages] = useState([]) // Array of cover images (separate from menu images)
  const [showEditNameDialog, setShowEditNameDialog] = useState(false)
  const [editNameValue, setEditNameValue] = useState("")
  const [restaurantId, setRestaurantId] = useState("")
  const [restaurantMongoId, setRestaurantMongoId] = useState("")
  const [reviewStats, setReviewStats] = useState({
    averageRating: 0,
    totalReviews: 0,
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageType, setImageType] = useState(null) // 'profile' or 'menu'
  const [uploadingCount, setUploadingCount] = useState(0) // Track how many images are being uploaded
  const profileImageInputRef = useRef(null)
  const menuImageInputRef = useRef(null)

  // Format address from location object
  const formatAddress = (location) => {
    if (!location) return ""
    
    const parts = []
    if (location.addressLine1) parts.push(location.addressLine1.trim())
    if (location.addressLine2) parts.push(location.addressLine2.trim())
    if (location.area) parts.push(location.area.trim())
    if (location.city) {
      const city = location.city.trim()
      // Only add city if it's not already included in area
      if (!location.area || !location.area.includes(city)) {
        parts.push(city)
      }
    }
    if (location.landmark) parts.push(location.landmark.trim())
    
    return parts.join(", ") || ""
  }

  // Fetch restaurant data on mount
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
          
          // Set restaurant name
          setRestaurantName(data.name || "")
          
          // Set restaurant ID
          setRestaurantId(data.restaurantId || data.id || "")
          // Set MongoDB _id for last 5 digits display
          // Backend returns id field which contains the MongoDB _id
          // Convert to string to ensure we can slice it
          const mongoId = String(data.id || data._id || "")
          setRestaurantMongoId(mongoId)
          
          // Format and set address
          const formattedAddress = formatAddress(data.location)
          setAddress(formattedAddress)
          
          // Format cuisines
          if (data.cuisines && Array.isArray(data.cuisines) && data.cuisines.length > 0) {
            setCuisineTags(data.cuisines.join(", "))
          } else {
            // Load from localStorage as fallback
            try {
              const saved = localStorage.getItem(CUISINES_STORAGE_KEY)
              if (saved) {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed) && parsed.length) {
                  setCuisineTags(parsed.join(", "))
                }
              }
            } catch (error) {
              console.error("Error loading cuisines from storage:", error)
            }
          }
          
          // Set images
          if (data.profileImage?.url) {
            setThumbnailImage(data.profileImage.url)
          }
          // Use coverImages if available, otherwise fallback to menuImages for backward compatibility
          if (data.coverImages && Array.isArray(data.coverImages) && data.coverImages.length > 0) {
            // Store all cover images with url and publicId
            setCoverImages(data.coverImages.map(img => ({
              url: img.url || img,
              publicId: img.publicId
            })))
            // Use first cover image as main image
            setMainImage(data.coverImages[0].url || data.coverImages[0])
          } else if (data.menuImages && Array.isArray(data.menuImages) && data.menuImages.length > 0) {
            // Fallback: Store menu images as cover images (for backward compatibility)
            setCoverImages(data.menuImages.map(img => ({
              url: img.url,
              publicId: img.publicId
            })))
            // Use first menu image as main image
            setMainImage(data.menuImages[0].url)
          } else {
            setCoverImages([])
          }
        }

        try {
          const reviewsResponse = await restaurantAPI.getReviews({ limit: 1 })
          const stats = reviewsResponse?.data?.data?.statistics
          if (stats) {
            setReviewStats({
              averageRating: Number(stats.averageRating) || 0,
              totalReviews: Number(stats.totalReviews) || 0,
            })
          }
        } catch (reviewError) {
          console.warn("Error fetching restaurant review stats:", reviewError)
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          console.error("Error fetching restaurant data:", error)
        }
        // Continue with default values if fetch fails
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurantData()

    // Listen for updates from edit pages
    const handleCuisinesUpdate = () => {
      fetchRestaurantData()
    }
    const handleAddressUpdate = () => {
      fetchRestaurantData()
    }

    window.addEventListener("cuisinesUpdated", handleCuisinesUpdate)
    window.addEventListener("addressUpdated", handleAddressUpdate)
    
    return () => {
      window.removeEventListener("cuisinesUpdated", handleCuisinesUpdate)
      window.removeEventListener("addressUpdated", handleAddressUpdate)
    }
  }, [])

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  // Load cuisines from localStorage
  useEffect(() => {
    const loadCuisines = () => {
      try {
        const saved = localStorage.getItem(CUISINES_STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length) {
            setCuisineTags(parsed.join(", "))
          }
        }
      } catch (error) {
        console.error("Error loading cuisines from storage:", error)
      }
    }

    loadCuisines()

    const handleUpdate = () => {
      loadCuisines()
    }

    window.addEventListener("cuisinesUpdated", handleUpdate)
    return () => window.removeEventListener("cuisinesUpdated", handleUpdate)
  }, [])

  // Handle profile image replacement
  const handleProfileImageReplace = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingImage(true)
      setImageType('profile')

      // Upload image to Cloudinary
      const uploadResponse = await restaurantAPI.uploadProfileImage(file)
      const uploadedImage = uploadResponse?.data?.data?.profileImage

      if (uploadedImage) {
        // Update local state immediately for better UX
        if (uploadedImage.url) {
          setThumbnailImage(uploadedImage.url)
        }
        
        // Refresh restaurant data to get latest from backend
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
          if (data.profileImage?.url) {
            setThumbnailImage(data.profileImage.url)
          } else if (uploadedImage.url) {
            // Fallback to uploaded image URL
            setThumbnailImage(uploadedImage.url)
          }
        } else if (uploadedImage.url) {
          // Fallback if refresh fails
          setThumbnailImage(uploadedImage.url)
        }
      }
    } catch (error) {
      console.error("Error uploading profile image:", error)
      alert("Failed to upload image. Please try again.")
    } finally {
      setUploadingImage(false)
      setImageType(null)
      // Reset input
      if (profileImageInputRef.current) {
        profileImageInputRef.current.value = null
      }
    }
  }

  // Bridge-aware handler for editing profile photo
  const handleEditPhotoClick = async () => {
    if (!hasFlutterCameraBridge()) {
      profileImageInputRef.current?.click()
      return
    }

    try {
      const result = await openCameraViaFlutter()

      if (result?.success && result.file) {
        const syntheticEvent = { target: { files: [result.file] } }
        await handleProfileImageReplace(syntheticEvent)
      } else if (result && !result.success) {
        console.error("Flutter camera returned unsuccessful result:", result)
        toast.error("Failed to capture image from camera")
      } else {
        console.log("Camera cancelled by user or no result returned")
      }
    } catch (error) {
      console.error("Error opening camera for profile image:", error)
      toast.error("Failed to open camera. Please try again.")
      profileImageInputRef.current?.click()
    }
  }

  // Handle multiple cover images addition (separate from menu images)
  const handleCoverImageAdd = async (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    try {
      setUploadingImage(true)
      setImageType('menu')
      setUploadingCount(files.length)

      // Get current images first to preserve them
      const currentResponse = await restaurantAPI.getCurrentRestaurant()
      const currentData = currentResponse?.data?.data?.restaurant || currentResponse?.data?.restaurant
      const existingImages = currentData?.menuImages && Array.isArray(currentData.menuImages)
        ? currentData.menuImages.map(img => ({
            url: img.url,
            publicId: img.publicId
          }))
        : []

      // Upload all images and collect their URLs
      // Since backend replaces first image, we'll collect all uploaded URLs
      // and then update profile with complete array
      const uploadedImageData = []
      const failedUploads = []
      
      for (let i = 0; i < files.length; i++) {
        try {
          const uploadResponse = await restaurantAPI.uploadMenuImage(files[i])
          
          // Extract uploaded image URL and publicId
          const uploadedImage = uploadResponse?.data?.data?.menuImage
          if (uploadedImage?.url) {
            uploadedImageData.push({
              url: uploadedImage.url,
              publicId: uploadedImage.publicId || null
            })
          } else {
            // Try alternative response structure
            const menuImages = uploadResponse?.data?.data?.menuImages
            if (menuImages && Array.isArray(menuImages) && menuImages.length > 0) {
              uploadedImageData.push({
                url: menuImages[0].url,
                publicId: menuImages[0].publicId || null
              })
            } else {
              throw new Error("No image URL in response")
            }
          }
        } catch (error) {
          const errorMessage = error?.response?.data?.message || error?.message || "Unknown error"
          const fileName = files[i]?.name || `Image ${i + 1}`
          failedUploads.push({ fileName, error: errorMessage })
          console.error(`Error uploading image ${i + 1} (${fileName}):`, {
            error: errorMessage,
            status: error?.response?.status,
            data: error?.response?.data
          })
          // Continue with other images even if one fails
        }
      }

      // Show error messages for failed uploads
      if (failedUploads.length > 0) {
        const errorSummary = failedUploads.length === 1
          ? `Failed to upload ${failedUploads[0].fileName}: ${failedUploads[0].error}`
          : `Failed to upload ${failedUploads.length} image(s). Please check file size and format, then try again.`
        toast.error(errorSummary)
      }

      if (uploadedImageData.length > 0) {
        // Combine existing images with newly uploaded ones
        // Remove duplicates based on URL
        const allImages = [...existingImages]
        uploadedImageData.forEach(uploaded => {
          if (!allImages.find(img => img.url === uploaded.url)) {
            allImages.push(uploaded)
          }
        })

        // Update profile with complete array of images
        try {
          await restaurantAPI.updateProfile({
            menuImages: allImages
          })
          if (uploadedImageData.length === files.length) {
            toast.success(`Successfully uploaded ${uploadedImageData.length} image(s)`)
          } else {
            toast.warning(`Uploaded ${uploadedImageData.length} of ${files.length} image(s)`)
          }
        } catch (updateError) {
          console.error("Error updating profile with images:", updateError)
          toast.error("Images uploaded but failed to save. Please try again.")
          // Continue anyway - images are uploaded, just not in correct order
        }

        // Update local state
        setCoverImages(allImages)
        if (allImages.length > 0) {
          setMainImage(allImages[0].url)
        }

        // Refresh restaurant data to confirm
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
          // Update from refreshed data
          if (data.menuImages && Array.isArray(data.menuImages) && data.menuImages.length > 0) {
            const refreshedImages = data.menuImages.map(img => ({
              url: img.url,
              publicId: img.publicId
            }))
            setCoverImages(refreshedImages)
            setMainImage(refreshedImages[0].url)
          }
        }
      } else if (failedUploads.length === files.length) {
        // All uploads failed
        toast.error("Failed to upload all images. Please check file size (max 5MB) and format (JPG, PNG, WEBP), then try again.")
      }
    } catch (error) {
      console.error("Error uploading menu images:", error)
      const errorMessage = error?.response?.data?.message || error?.message || "Unknown error"
      toast.error(`Failed to upload images: ${errorMessage}`)
    } finally {
      setUploadingImage(false)
      setImageType(null)
      setUploadingCount(0)
      // Reset input
      if (menuImageInputRef.current) {
        menuImageInputRef.current.value = null
      }
    }
  }

  // Bridge-aware handler for adding cover images
  const handleAddCoverImageClick = async () => {
    if (!hasFlutterCameraBridge()) {
      menuImageInputRef.current?.click()
      return
    }

    try {
      const result = await openCameraViaFlutter()

      if (result?.success && result.file) {
        const syntheticEvent = { target: { files: [result.file] } }
        await handleCoverImageAdd(syntheticEvent)
      } else if (result && !result.success) {
        console.error("Flutter camera returned unsuccessful result for cover image:", result)
        toast.error("Failed to capture image from camera")
      } else {
        console.log("Cover image camera cancelled by user or no result returned")
      }
    } catch (error) {
      console.error("Error opening camera for cover image:", error)
      toast.error("Failed to open camera. Please try again.")
      menuImageInputRef.current?.click()
    }
  }

  // Handle cover image deletion
  const handleCoverImageDelete = async (indexToDelete) => {
    if (!window.confirm("Are you sure you want to delete this cover image?")) {
      return
    }

    // Store original state for rollback
    const originalImages = [...coverImages]

    try {
      setUploadingImage(true)
      setImageType('menu')

      // Remove image from local state first (optimistic update)
      const updatedImages = coverImages.filter((_, index) => index !== indexToDelete)
      setCoverImages(updatedImages)

      // Update main image if deleted image was the first one
      if (indexToDelete === 0 && updatedImages.length > 0) {
        setMainImage(updatedImages[0].url)
      } else if (updatedImages.length === 0) {
        // If no images left, set default
        setMainImage("https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop")
      }

      // Update backend - convert coverImages back to menuImages format for API
      const menuImagesForBackend = updatedImages.map(img => ({
        url: typeof img === 'string' ? img : img.url,
        publicId: typeof img === 'string' ? null : (img.publicId || null)
      }))

      // Update restaurant profile with new menuImages array
      try {
        const updateResponse = await restaurantAPI.updateProfile({
          menuImages: menuImagesForBackend.length > 0 ? menuImagesForBackend : []
        })

        if (updateResponse?.data && !updateResponse.data.success) {
          throw new Error(updateResponse.data.message || 'Failed to update profile')
        }

        // Refresh restaurant data to confirm
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
          // Update cover images from refreshed data
          if (data.coverImages && Array.isArray(data.coverImages) && data.coverImages.length > 0) {
            setCoverImages(data.coverImages.map(img => ({
              url: img.url || img,
              publicId: img.publicId
            })))
          } else if (data.menuImages && Array.isArray(data.menuImages) && data.menuImages.length > 0) {
            setCoverImages(data.menuImages.map(img => ({
              url: img.url,
              publicId: img.publicId
            })))
          } else {
            setCoverImages([])
          }
        }
      } catch (apiError) {
        console.error("API Error deleting cover image:", apiError)
        console.error("API Error details:", {
          message: apiError.message,
          code: apiError.code,
          response: apiError.response?.data,
          status: apiError.response?.status,
          config: apiError.config
        })
        // Revert local state on API error
        setCoverImages(originalImages)
        if (originalImages.length > 0) {
          setMainImage(typeof originalImages[0] === 'string' ? originalImages[0] : originalImages[0].url)
        }
        throw apiError
      }
    } catch (error) {
      console.error("Error deleting cover image:", error)
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      })
      
      let errorMessage = "Failed to delete image. Please try again."
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        if (error.message.includes('Network Error') || error.code === 'ERR_NETWORK') {
          errorMessage = "Network error. Please check your connection and ensure the backend server is running."
        } else {
          errorMessage = error.message
        }
      }
      alert(errorMessage)
      
      // Revert local state on error
      setCoverImages(originalImages)
      if (originalImages.length > 0) {
        setMainImage(typeof originalImages[0] === 'string' ? originalImages[0] : originalImages[0].url)
      } else {
        // Try to refresh from server
        try {
          const response = await restaurantAPI.getCurrentRestaurant()
          const data = response?.data?.data?.restaurant || response?.data?.restaurant
          if (data) {
            if (data.coverImages && Array.isArray(data.coverImages) && data.coverImages.length > 0) {
              setCoverImages(data.coverImages.map(img => ({
                url: img.url || img,
                publicId: img.publicId
              })))
              setMainImage(data.coverImages[0].url || data.coverImages[0])
            } else if (data.menuImages && Array.isArray(data.menuImages) && data.menuImages.length > 0) {
              setCoverImages(data.menuImages.map(img => ({
                url: img.url,
                publicId: img.publicId
              })))
              setMainImage(data.menuImages[0].url)
            }
          }
        } catch (refreshError) {
          console.error("Error refreshing data:", refreshError)
        }
      }
    } finally {
      setUploadingImage(false)
      setImageType(null)
    }
  }

  // Handle edit name dialog
  const handleOpenEditDialog = () => {
    setEditNameValue(restaurantName)
    setShowEditNameDialog(true)
  }

  const handleSaveName = async () => {
    const newName = editNameValue.trim()
    if (!newName) {
      alert("Restaurant name cannot be empty")
      return
    }

    if (newName === restaurantName) {
      // No change, just close dialog
      setShowEditNameDialog(false)
      return
    }

    try {
      // Update restaurant name via API
      const response = await restaurantAPI.updateProfile({ name: newName })
      
      if (response?.data?.data?.restaurant) {
        // Update local state
        setRestaurantName(newName)
        setRestaurantData(prev => prev ? { ...prev, name: newName } : null)
        setShowEditNameDialog(false)
        
        // Refresh restaurant data to get latest from backend
        const refreshResponse = await restaurantAPI.getCurrentRestaurant()
        const data = refreshResponse?.data?.data?.restaurant || refreshResponse?.data?.restaurant
        if (data) {
          setRestaurantData(data)
          setRestaurantName(data.name || newName)
        }
      } else {
        throw new Error("Invalid response from server")
      }
    } catch (error) {
      console.error("Error updating restaurant name:", error)
      alert(`Failed to update restaurant name: ${error.response?.data?.message || error.message || "Please try again."}`)
    }
  }


  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (showEditNameDialog) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showEditNameDialog])

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Outlet info</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-900 font-normal">
              Restaurant id: {loading ? "Loading..." : (restaurantMongoId && restaurantMongoId.length >= 5 ? restaurantMongoId.slice(-5) : (restaurantId || "N/A"))}
            </span>
          </div>
        </div>
      </div>

      {/* Main Image Section */}
      <div className="relative w-full h-[200px] overflow-visible">
        <img 
          src={mainImage}
          alt="Restaurant banner"
          className="w-full h-full object-cover"
        />
        
        {/* Add Image Button - Black background with white text */}
        <button
          onClick={handleAddCoverImageClick}
          disabled={uploadingImage}
          className="absolute top-4 right-4 bg-black/90 hover:bg-black px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-white transition-colors shadow-lg z-10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>
            {uploadingImage && imageType === 'menu' 
              ? `Uploading ${uploadingCount} image${uploadingCount > 1 ? 's' : ''}...` 
              : 'Add image'}
          </span>
        </button>
        <input
          ref={menuImageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleCoverImageAdd}
        />
        
        {/* Cover Images Gallery - Show all cover images with delete buttons */}
        {coverImages.length > 0 && (
          <div className="absolute bottom-2 right-4 flex gap-1.5 z-10">
            {coverImages.slice(0, 4).map((img, index) => (
              <div
                key={index}
                className="relative w-8 h-8 rounded border-2 border-white overflow-hidden bg-gray-200"
              >
                <img
                  src={typeof img === 'string' ? img : img.url}
                  alt={`Cover ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Delete Button - Top Left */}
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleCoverImageDelete(index)
                  }}
                  disabled={uploadingImage}
                  className="absolute top-0 left-0 bg-red-500/90 hover:bg-red-600 p-0.5 rounded-br-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
                  aria-label={`Delete cover image ${index + 1}`}
                >
                  <Trash2 className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
            {coverImages.length > 4 && (
              <div className="w-8 h-8 rounded border-2 border-white bg-black/70 flex items-center justify-center">
                <span className="text-white text-xs font-bold">+{coverImages.length - 4}</span>
              </div>
            )}
          </div>
        )}

        {/* Thumbnail Section - Overlapping bottom edge */}
        <div className="absolute bottom-0 left-4 -mb-[45px] flex flex-col gap-2 shrink-0 z-10">
          <div className="relative w-[70px] h-[70px] rounded overflow-hidden">
            <img 
              src={thumbnailImage}
              alt="Restaurant thumbnail"
              className="w-full h-full rounded-xl object-cover"
            />
          </div>
          <button
            onClick={handleEditPhotoClick}
            disabled={uploadingImage}
            className="text-blue-600 text-sm font-semibold hover:text-blue-700 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadingImage && imageType === 'profile' ? 'Uploading...' : 'Edit photo'}
          </button>
          <input
            ref={profileImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleProfileImageReplace}
          />
        </div>
      </div>

      {/* Thumbnail and Reviews Section */}
      <div className="px-4 pt-[50px] pb-4 bg-white">
        <div className="flex items-start gap-4">
     
          {/* Reviews Section - Left Aligned */}
          <div className="flex flex-col gap-2">
            {/* Delivery Reviews */}
            <button
              onClick={() => navigate("/restaurant/ratings-reviews")}
              className="flex items-center gap-2 text-left w-full"
            >
              <div className="bg-red-700 px-2.5 py-1.5 rounded flex items-center gap-1 shrink-0">
                <span className="text-white text-sm font-bold">
                  {(reviewStats.averageRating || restaurantData?.rating || 0).toFixed(1)}
                </span>
                <Star className="w-3.5 h-3.5 text-white fill-white" />
              </div>
              <span className="text-gray-800 text-sm font-normal">
                {reviewStats.totalReviews || restaurantData?.totalRatings || 0} DELIVERY REVIEWS
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 ml-auto" />
            </button>

            {/* Dining Reviews */}
            <div className="flex items-center gap-2">
              <div className="bg-gray-300 px-2.5 py-1.5 rounded flex items-center gap-1 shrink-0">
                <span className="text-white text-sm font-normal">-</span>
                <Star className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-gray-800 text-sm font-normal">NOT ENOUGH DINING REVIEWS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Restaurant Information Heading */}
      <div className="px-4 py-4">
        <h2 className="text-base font-bold text-gray-900 text-center">Restaurant Information</h2>
      </div>

      {/* Information Cards */}
      <div className="px-4 pb-6 space-y-3">
        {/* Restaurant Name Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-blue-100/50  rounded-lg p-4 border border-blue-300"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-normal mb-1">Restaurant's name</p>
              <p className="text-base font-semibold text-gray-900">
                {loading ? "Loading..." : (restaurantName || "N/A")}
              </p>
            </div>
            <button
              onClick={handleOpenEditDialog}
              className="text-blue-600 text-sm font-normal hover:text-blue-700 transition-colors ml-4 shrink-0"
            >
              Edit
            </button>
          </div>
        </motion.div>

        {/* Cuisine Tags Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-blue-100/50 rounded-lg p-4 border border-blue-300"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-normal mb-1">Cuisine tags</p>
              <p className="text-base font-semibold text-gray-900">
                {loading ? "Loading..." : (cuisineTags || "No cuisines selected")}
              </p>
            </div>
            <button
              onClick={() => navigate("/restaurant/edit-cuisines")}
              className="text-blue-600 text-sm font-normal hover:text-blue-700 transition-colors ml-4 shrink-0 self-start"
            >
              Edit
            </button>
          </div>
        </motion.div>

        {/* Address Card */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          onClick={() => navigate("/restaurant/edit-address")}
          className="w-full text-left bg-blue-100/50 rounded-lg p-4 border border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-normal mb-1">Address</p>
              <div className="flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-base font-semibold text-gray-900">
                  {loading ? "Loading..." : (address || "No address provided")}
                </p>
              </div>
            </div>
            <span className="text-blue-600 text-sm font-normal ml-4 shrink-0 self-start">
              Edit
            </span>
          </div>
        </motion.button>

        {/* Action Cards */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="space-y-3 pt-2"
        >
          {/* Outlet Timings Card */}
          <button
            onClick={() => navigate("/restaurant/outlet-timings")}
            className="w-full bg-blue-100/50 rounded-lg p-4 border border-blue-300 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-base font-semibold text-gray-900">Outlet Timings</span>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-600" />
          </button>

          {/* Contact Details Card */}
          <button
            onClick={() => navigate("/restaurant/contact-details")}
            className="w-full bg-blue-100/50 rounded-lg p-4 border border-blue-300 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-blue-600" />
              <span className="text-base font-semibold text-gray-900">Contact Details</span>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-600" />
          </button>
        </motion.div>
      </div>


      {/* Edit Restaurant Name Dialog */}
      <Dialog open={showEditNameDialog} onOpenChange={setShowEditNameDialog}>
        <DialogContent className="sm:max-w-md p-4 w-[90%]">
          <DialogHeader>
            <DialogTitle className="text-left">Edit Restaurant Name</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              placeholder="Enter restaurant name"
              className="w-full focus-visible:border-black focus-visible:ring-0"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditNameDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveName}
              disabled={!editNameValue.trim()}
              className="bg-black text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
