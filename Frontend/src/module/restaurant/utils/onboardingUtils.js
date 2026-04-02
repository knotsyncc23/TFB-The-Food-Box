import { api } from "@/lib/api"

const ONBOARDING_STORAGE_KEY = "restaurant_onboarding_data"
const TOTAL_VISIBLE_ONBOARDING_STEPS = 3

// Helper function to check if a step is complete
const isStepComplete = (stepData, stepNumber) => {
  if (!stepData) return false

  if (stepNumber === 1) {
    return (
      stepData.restaurantName &&
      stepData.ownerName &&
      stepData.ownerEmail &&
      stepData.ownerPhone &&
      stepData.primaryContactNumber &&
      stepData.location?.area &&
      stepData.location?.city
    )
  }

  if (stepNumber === 2) {
    return (
      Array.isArray(stepData.cuisines) &&
      stepData.cuisines.length > 0 &&
      stepData.deliveryTimings?.openingTime &&
      stepData.deliveryTimings?.closingTime &&
      Array.isArray(stepData.openDays) &&
      stepData.openDays.length > 0 &&
      stepData.profileImageUrl &&
      (stepData.profileImageUrl.url || typeof stepData.profileImageUrl === 'string')
    )
  }

  if (stepNumber === 3) {
    const hasFssaiImage = stepData.fssai?.image && 
      (stepData.fssai.image.url || typeof stepData.fssai.image === 'string')
    // GST image is required only if GST is registered
    const hasGstImage = !stepData.gst?.isRegistered || 
      (stepData.gst?.image && (stepData.gst.image.url || typeof stepData.gst.image === 'string'))
    
    return (
      stepData.fssai?.registrationNumber &&
      hasFssaiImage &&
      hasGstImage
    )
  }

  return false
}

// Determine which step to show based on completeness
export const determineStepToShow = (data) => {
  if (!data) return 1

  // If completedSteps is 4, onboarding is complete (admin-created restaurants)
  if (data.completedSteps === 4) {
    return null
  }

  // Check step 1
  if (!isStepComplete(data.step1, 1)) {
    return 1
  }

  // Check step 2
  if (!isStepComplete(data.step2, 2)) {
    return 2
  }

  // Check step 3
  if (!isStepComplete(data.step3, 3)) {
    return TOTAL_VISIBLE_ONBOARDING_STEPS
  }

  // Step 4 is now merged into the final visible step.
  return TOTAL_VISIBLE_ONBOARDING_STEPS
}

// Check onboarding status from API and return the step to navigate to
export const checkOnboardingStatus = async () => {
  try {
    const res = await api.get("/restaurant/onboarding")
    const data = res?.data?.data?.onboarding
    if (data) {
      const stepToShow = determineStepToShow(data)
      return stepToShow
    }
    // No onboarding data, start from step 1
    return 1
  } catch {
    // If API call fails, check localStorage
    try {
      const localData = localStorage.getItem(ONBOARDING_STORAGE_KEY)
      if (localData) {
        const parsed = JSON.parse(localData)
        const rawStep = parsed.currentStep || 1
        return Math.min(rawStep, TOTAL_VISIBLE_ONBOARDING_STEPS)
      }
    } catch (localErr) {
      console.error("Failed to check localStorage:", localErr)
    }
    // Default to step 1 if everything fails
    return 1
  }
}

