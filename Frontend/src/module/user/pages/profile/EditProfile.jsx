import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, X, Pencil, Loader2, Camera, ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useProfile } from "../../context/ProfileContext"
import { userAPI } from "@/lib/api"
import { openCameraViaFlutter, hasFlutterCameraBridge } from "@/lib/utils/cameraBridge"
import { toast } from "sonner"
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'

const datePickerTextFieldSx = {
  '& .MuiOutlinedInput-root': {
    height: '48px',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    color: '#111827',
    '& fieldset': {
      borderColor: '#d1d5db',
    },
    '&:hover fieldset': {
      borderColor: '#9ca3af',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#671E1F',
      borderWidth: '1px',
    },
  },
  '& .MuiInputBase-input': {
    padding: '12px 14px',
    fontSize: '16px',
    color: 'inherit',
    WebkitTextFillColor: 'currentColor',
  },
  '& .MuiInputBase-input::placeholder': {
    color: '#9ca3af',
    opacity: 1,
  },
  '& .MuiSvgIcon-root': {
    color: 'inherit',
  },
  '& .MuiIconButton-root': {
    color: 'inherit',
  },
  '@media (prefers-color-scheme: dark)': {
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#4b5563',
    },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#6b7280',
    },
    '& .MuiInputBase-input': {
      color: '#ffffff',
      WebkitTextFillColor: '#ffffff',
    },
    '& .MuiSvgIcon-root': {
      color: '#ffffff',
    },
    '& .MuiIconButton-root': {
      color: '#ffffff',
    },
  },
  '.dark & .MuiInputBase-input': {
    color: '#ffffff',
    WebkitTextFillColor: '#ffffff',
  },
  '.dark & .MuiOutlinedInput-root': {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
  },
  '.dark & .MuiOutlinedInput-notchedOutline': {
    borderColor: '#4b5563',
  },
  '.dark & .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#6b7280',
  },
  '.dark & .MuiSvgIcon-root': {
    color: '#ffffff',
  },
  '.dark & .MuiIconButton-root': {
    color: '#ffffff',
  },
}

// Gender options
const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
]

// Load profile data from localStorage
const loadProfileFromStorage = () => {
  try {
    const stored = localStorage.getItem('appzeto_user_profile')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error loading profile from localStorage:', error)
  }
  return null
}

// Save profile data to localStorage
const saveProfileToStorage = (data) => {
  try {
    localStorage.setItem('appzeto_user_profile', JSON.stringify(data))
  } catch (error) {
    console.error('Error saving profile to localStorage:', error)
  }
}

export default function EditProfile() {
  const navigate = useNavigate()
  const { userProfile, updateUserProfile } = useProfile()
  
  // Load from localStorage or use context (prefer context as it has latest data including signupMethod)
  const storedProfile = loadProfileFromStorage()
  const initialProfile = userProfile || storedProfile || {}
  
  const initialFormData = {
    name: initialProfile.name ?? "",
    mobile: initialProfile.mobile ?? initialProfile.phone ?? "",
    email: initialProfile.email ?? "",
    dateOfBirth: initialProfile.dateOfBirth 
      ? (typeof initialProfile.dateOfBirth === 'string' 
        ? dayjs(initialProfile.dateOfBirth) 
        : dayjs(initialProfile.dateOfBirth))
      : null,
    anniversary: initialProfile.anniversary 
      ? (typeof initialProfile.anniversary === 'string' 
        ? dayjs(initialProfile.anniversary) 
        : dayjs(initialProfile.anniversary))
      : null,
    gender: initialProfile.gender ?? "",
  }
  
  const [formData, setFormData] = useState(initialFormData)
  const [initialData] = useState(initialFormData)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [profileImage, setProfileImage] = useState(initialProfile?.profileImage || "")
  const [initialImage] = useState(initialProfile?.profileImage || "")
  const [imagePreview, setImagePreview] = useState(initialProfile?.profileImage || "")
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  // Update form data when profile changes
  useEffect(() => {
    const storedProfile = loadProfileFromStorage()
    const profile = storedProfile || userProfile || {}
    const newFormData = {
      name: profile.name ?? "",
      mobile: profile.mobile ?? profile.phone ?? "",
      email: profile.email ?? "",
      dateOfBirth: profile.dateOfBirth 
        ? (typeof profile.dateOfBirth === 'string' 
          ? dayjs(profile.dateOfBirth) 
          : dayjs(profile.dateOfBirth))
        : null,
      anniversary: profile.anniversary 
        ? (typeof profile.anniversary === 'string' 
          ? dayjs(profile.anniversary) 
          : dayjs(profile.anniversary))
        : null,
      gender: profile.gender ?? "",
    }
    setFormData(newFormData)
    
    // Update profile image
    if (profile.profileImage) {
      setProfileImage(profile.profileImage)
      setImagePreview(profile.profileImage)
    }
  }, [userProfile])

  // Get avatar initial
  const avatarInitial = formData.name?.charAt(0).toUpperCase() || 'A'

  // Check if form has changes (including profile image changes)
  useEffect(() => {
    const currentSnapshot = JSON.stringify({ ...formData, profileImage })
    const initialSnapshot = JSON.stringify({ ...initialData, profileImage: initialImage })
    setHasChanges(currentSnapshot !== initialSnapshot)
  }, [formData, initialData, profileImage, initialImage])

  const handleChange = (field, value) => {
    if (field === "mobile") {
      const digitsOnly = value.replace(/\D/g, "")
      const valid = digitsOnly.length <= 15 ? digitsOnly : digitsOnly.slice(0, 15)
      setFormData(prev => ({ ...prev, [field]: valid }))
      return
    }
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleClear = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: ""
    }))
  }

  const handleImageSelect = async (e) => {
    const inputEl = e.target
    const file = inputEl.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB')
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)

    // Upload to server
    try {
      setIsUploadingImage(true)
      const response = await userAPI.uploadProfileImage(file)
      const imageUrl = response?.data?.data?.profileImage || response?.data?.profileImage
      
      if (imageUrl) {
        setProfileImage(imageUrl)
        setImagePreview(imageUrl)
        toast.success('Profile image uploaded successfully')
        
        // Update context
        updateUserProfile({ profileImage: imageUrl })
        
        // Dispatch event to refresh profile
        window.dispatchEvent(new Event("userAuthChanged"))
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error(error?.response?.data?.message || 'Failed to upload image')
      // Revert preview
      setImagePreview(profileImage)
    } finally {
      setIsUploadingImage(false)
      // Reset input so selecting the same file/camera capture again still triggers onChange
      if (inputEl) {
        inputEl.value = ""
      }
    }
  }

  const handleCameraClick = async () => {
    if (isUploadingImage) return

    // Prefer Flutter bridge when available (WebView/PWA in Flutter shell)
    if (hasFlutterCameraBridge()) {
      try {
        const { success, file, error } = await openCameraViaFlutter()

        if (!success || !file) {
          if (error) {
            console.error("Error capturing image via Flutter bridge:", error)
          }
          toast.error("Could not capture image from camera. Please try again.")
          return
        }

        // Reuse existing upload logic by faking a change event
        await handleImageSelect({ target: { files: [file] } })
        return
      } catch (err) {
        console.error("Camera bridge failed, falling back to browser input:", err)
      }
    }

    // Fallback: use native file input with capture attribute
    if (cameraInputRef.current) {
      cameraInputRef.current.click()
    }
  }

  const handleUpdate = async () => {
    if (isSaving) return

    if (formData.mobile) {
      const digits = formData.mobile.replace(/\D/g, "")
      if (digits.length < 7 || digits.length > 15) {
        toast.error("Please enter a valid mobile number (7–15 digits)")
        return
      }
      if (digits.length === 10 && !["6", "7", "8", "9"].includes(digits[0])) {
        toast.error("Please enter a valid 10-digit mobile number")
        return
      }
    }

    try {
      setIsSaving(true)

      // Prepare data for API
      const updateData = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.mobile || undefined,
        dateOfBirth: formData.dateOfBirth ? formData.dateOfBirth.format('YYYY-MM-DD') : undefined,
        anniversary: formData.anniversary ? formData.anniversary.format('YYYY-MM-DD') : undefined,
        gender: formData.gender || undefined,
        profileImage: profileImage || undefined, // Include profileImage in update
      }

      // Call API to update profile
      const response = await userAPI.updateProfile(updateData)
      const updatedUser = response?.data?.data?.user || response?.data?.user

      if (updatedUser) {
        // Update context with all fields including profileImage
        updateUserProfile({
          ...updatedUser,
          phone: updatedUser.phone || formData.mobile,
          profileImage: updatedUser.profileImage || profileImage,
        })

        // Save to localStorage with complete data
        saveProfileToStorage({
          name: updatedUser.name || formData.name,
          phone: updatedUser.phone || formData.mobile,
          email: updatedUser.email || formData.email,
          profileImage: updatedUser.profileImage || profileImage,
          dateOfBirth: updatedUser.dateOfBirth || formData.dateOfBirth?.format('YYYY-MM-DD'),
          anniversary: updatedUser.anniversary || formData.anniversary?.format('YYYY-MM-DD'),
          gender: updatedUser.gender || formData.gender,
        })

        // Dispatch event to refresh profile from API
        window.dispatchEvent(new Event("userAuthChanged"))

        toast.success('Profile updated successfully')
        
        // Navigate back
        navigate("/user/profile")
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error(error?.response?.data?.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveProfileImage = async () => {
    if (isUploadingImage) return
    if (!profileImage) return

    try {
      setIsUploadingImage(true)
      await userAPI.removeProfileImage()

      setProfileImage(null)
      setImagePreview(null)

      updateUserProfile({ profileImage: null })
      saveProfileToStorage({
        name: formData.name,
        phone: formData.mobile,
        email: formData.email,
        profileImage: null,
        dateOfBirth: formData.dateOfBirth ? formData.dateOfBirth.format('YYYY-MM-DD') : undefined,
        anniversary: formData.anniversary ? formData.anniversary.format('YYYY-MM-DD') : undefined,
        gender: formData.gender,
      })

      toast.success("Profile photo removed")
      window.dispatchEvent(new Event("userAuthChanged"))
    } catch (error) {
      console.error("Error removing profile image:", error)
      toast.error(error?.response?.data?.message || "Failed to remove profile photo")
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleMobileChange = () => {
    // Navigate to mobile change page or show modal
    console.log('Change mobile clicked')
  }

  const handleEmailChange = () => {
    // Navigate to email change page or show modal
    console.log('Change email clicked')
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a1a] sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 md:py-5 lg:py-6">
          <button 
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-white" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Your Profile</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-6 sm:py-8 md:py-10 lg:py-12 space-y-6 md:space-y-8 lg:space-y-10">
        {/* Avatar Section */}
        <div className="flex justify-center">
          <div className="relative">
            <Avatar className="h-24 w-24 bg-blue-400 border-0">
              {imagePreview && (
                <AvatarImage 
                  src={imagePreview} 
                  alt={formData.name || 'User'}
                />
              )}
              <AvatarFallback className="bg-blue-400 text-white text-3xl font-semibold">
                {avatarInitial}
              </AvatarFallback>
            </Avatar>
            {imagePreview && (
              <button
                type="button"
                onClick={handleRemoveProfileImage}
                disabled={isUploadingImage}
                className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gray-900/90 hover:bg-gray-900 text-white flex items-center justify-center shadow-sm border-2 border-white disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Remove profile photo"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {/* Edit: Camera and Gallery options */}
            <div className="absolute bottom-0 right-0 flex gap-1">
              <button
                type="button"
                onClick={handleCameraClick}
                disabled={isUploadingImage}
                className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Take photo"
                aria-label="Upload profile photo from camera"
              >
                {isUploadingImage ? (
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 text-white" />
                )}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isUploadingImage) return
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ""
                    fileInputRef.current.click()
                  }
                }}
                disabled={isUploadingImage}
                className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Choose from gallery"
                aria-label="Upload profile photo from gallery"
              >
                <ImagePlus className="h-4 w-4 text-white" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>
        </div>
        
        {imagePreview && (
          <div className="flex justify-center -mt-2">
            <button
              type="button"
              onClick={handleRemoveProfileImage}
              disabled={isUploadingImage}
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              Remove Photo
            </button>
          </div>
        )}

        {/* Form Card */}
        <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800">
          <CardContent className="p-4 sm:p-5 md:p-6 lg:p-8 space-y-4 md:space-y-5 lg:space-y-6">
            {/* Name Field */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-white">
                Name
              </Label>
              <div className="relative">
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="pr-10 h-12 text-base border border-gray-300 dark:border-gray-700 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                  placeholder="Name"
                />
                {formData.name && (
                  <button
                    type="button"
                    onClick={() => handleClear('name')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Field - always editable */}
            <div className="space-y-1.5">
              <Label htmlFor="mobile" className="text-sm font-medium text-gray-700 dark:text-white">
                Mobile
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  value={formData.mobile}
                  onChange={(e) => handleChange('mobile', e.target.value)}
                  className="flex-1 h-12 text-base border border-gray-300 dark:border-gray-700 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                  placeholder="Mobile"
                />
              </div>
            </div>

            {/* Email Field - read-only ONLY when user signed up/logged in with email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-white">
                Email
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  disabled={(userProfile?.signupMethod || initialProfile?.signupMethod) === "email"}
                  className="flex-1 h-12 text-base border border-gray-300 dark:border-gray-700 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
                  placeholder="Email"
                  aria-readonly={(userProfile?.signupMethod || initialProfile?.signupMethod) === "email"}
                />
              </div>
              {(userProfile?.signupMethod || initialProfile?.signupMethod) === "email" && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Email cannot be changed when you logged in with email. You can update mobile number above.</p>
              )}
            </div>

            {/* Date of Birth Field */}
            <div className="space-y-1.5">
              <Label htmlFor="dateOfBirth" className="text-sm font-medium text-gray-700 dark:text-white">
                Date of birth
              </Label>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  value={formData.dateOfBirth}
                  onChange={(newValue) => handleChange('dateOfBirth', newValue)}
                  slotProps={{
                    textField: {
                      className: "w-full bg-white dark:bg-[#1a1a1a]",
                      sx: datePickerTextFieldSx,
                    },
                  }}
                />
              </LocalizationProvider>
            </div>

            {/* Anniversary Field */}
            <div className="space-y-1.5">
              <Label htmlFor="anniversary" className="text-sm font-medium text-gray-700 dark:text-white">
                Anniversary <span className="text-gray-400 dark:text-gray-500 font-normal">(Optional)</span>
              </Label>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  value={formData.anniversary}
                  onChange={(newValue) => handleChange('anniversary', newValue)}
                  slotProps={{
                    textField: {
                      className: "w-full bg-white dark:bg-[#1a1a1a]",
                      sx: datePickerTextFieldSx,
                    },
                  }}
                />
              </LocalizationProvider>
            </div>

            {/* Gender Field */}
            <div className="space-y-1.5">
              <Label htmlFor="gender" className="text-sm font-medium text-gray-700 dark:text-white">
                Gender
              </Label>
              <Select
                value={formData.gender || ""}
                onValueChange={(value) => handleChange('gender', value)}
              >
                <SelectTrigger className="h-12 text-base border border-gray-300 dark:border-gray-700 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white border-gray-200 dark:border-gray-700">
                  {genderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Update Profile Button */}
        <Button
          onClick={handleUpdate}
          disabled={!hasChanges || isSaving || isUploadingImage}
          className={`w-full h-14 rounded-xl font-semibold text-base transition-all ${
            hasChanges && !isSaving && !isUploadingImage
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300 cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Update profile'
          )}
        </Button>
      </div>
    </div>
  )
}
