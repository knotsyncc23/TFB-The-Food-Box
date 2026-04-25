import { toast } from "sonner"

const openTransientImageInput = ({
  onSelectFile,
  accept = "image/*",
  capture = undefined,
}) => {
  if (typeof document === "undefined") {
    throw new Error("Document is not available")
  }

  const input = document.createElement("input")
  input.type = "file"
  input.accept = accept
  input.multiple = false
  if (capture) {
    input.setAttribute("capture", capture)
  }

  input.style.position = "fixed"
  input.style.left = "-9999px"
  input.style.width = "1px"
  input.style.height = "1px"
  input.style.opacity = "0"
  input.style.pointerEvents = "none"

  const cleanup = () => {
    input.onchange = null
    input.oncancel = null
    if (input.parentNode) {
      input.parentNode.removeChild(input)
    }
  }

  input.onchange = (event) => {
    const file = event?.target?.files?.[0] || null
    if (file) onSelectFile(file)
    cleanup()
  }

  input.oncancel = cleanup
  document.body.appendChild(input)

  if (typeof input.showPicker === "function") {
    try {
      input.showPicker()
      return
    } catch {
      // Fall back to the standard click-based picker below.
    }
  }

  input.click()
}

/**
 * Utility to convert base64 image data from Flutter bridge into a File object
 */
export const convertBase64ToFile = (
  base64Value,
  mimeType = "image/jpeg",
  fileNamePrefix = "upload",
  originalFileName = "",
) => {
  if (!base64Value || typeof base64Value !== "string") {
    throw new Error("Invalid base64 image data")
  }

  let pureBase64 = base64Value
  if (base64Value.includes(",")) {
    pureBase64 = base64Value.split(",")[1]
  }

  try {
    const byteCharacters = atob(pureBase64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    const normalizedFileName = String(originalFileName || "").trim()
    const extension = normalizedFileName.includes(".")
      ? normalizedFileName.split(".").pop()
      : mimeType.includes("png")
        ? "png"
        : mimeType.includes("webp")
          ? "webp"
          : "jpg"
    const blob = new Blob([byteArray], { type: mimeType })
    const fileName = normalizedFileName || `${fileNamePrefix}-${Date.now()}.${extension}`
    return new File([blob], fileName, { type: mimeType })
  } catch (error) {
    console.error("Base64 conversion failed:", error)
    throw new Error("Failed to process image data")
  }
}

/**
 * Standard browser camera fallback
 */
export const openBrowserCameraFallback = (onSelectFile) => {
  if (!onSelectFile || typeof onSelectFile !== "function") {
    console.warn("openBrowserCameraFallback: onSelectFile callback not provided")
    return
  }

  try {
    openTransientImageInput({
      onSelectFile,
      accept: "image/*",
      capture: "environment",
    })
  } catch (error) {
    console.error("Browser camera fallback failed:", error)
    // Only show toast for actual errors, not for user cancellation
    if (error?.message && !error.message.includes("canceled") && !error.message.includes("cancelled")) {
      toast.error("Could not open camera")
    }
  }
}

/**
 * Check if the Flutter InAppWebView bridge is available
 */
export const isFlutterBridgeAvailable = () => {
  return (
    typeof window !== "undefined" &&
    window.flutter_inappwebview &&
    typeof window.flutter_inappwebview.callHandler === "function"
  )
}

/**
 * Open camera via Flutter bridge or browser fallback
 */
export const openCamera = async ({ onSelectFile, fileNamePrefix = "camera-photo", quality = 0.8 }) => {
  if (!onSelectFile || typeof onSelectFile !== "function") {
    console.warn("openCamera: onSelectFile callback not provided")
    return
  }

  try {
    if (!isFlutterBridgeAvailable()) {
      try {
        openBrowserCameraFallback(onSelectFile)
      } catch (fallbackError) {
        console.error("Browser camera fallback error:", fallbackError)
        // Don't throw - user might have canceled
      }
      return
    }

    try {
      const result = await window.flutter_inappwebview.callHandler("openCamera", {
        source: "camera",
        accept: "image/*",
        multiple: false,
        quality: quality,
      })

      const isSuccess = result?.success === true || Boolean(result?.base64 || result?.base64String || result?.data?.base64)
      if (!result || !isSuccess) {
        // User likely cancelled or camera unavailable - silent fail
        return
      }

      let selectedFile = null
      const base64Value = result?.base64 || result?.base64String || result?.data?.base64
      const mimeType = result?.mimeType || result?.type || result?.data?.mimeType || "image/jpeg"
      const originalFileName = result?.fileName || result?.name || result?.data?.fileName || ""

      if (base64Value) {
        selectedFile = convertBase64ToFile(
          base64Value,
          mimeType,
          fileNamePrefix,
          originalFileName,
        )
      } else if (result.file instanceof File || result.file instanceof Blob) {
        selectedFile = result.file
      }

      if (!selectedFile || !String(selectedFile.type || "").startsWith("image/")) {
        toast.error("Failed to capture image")
        return
      }

      onSelectFile(selectedFile)
    } catch (bridgeError) {
      console.error("Bridge camera error:", bridgeError)
      // Try browser fallback on bridge failure
      try {
        openBrowserCameraFallback(onSelectFile)
      } catch (fallbackError) {
        console.error("Fallback after bridge error:", fallbackError)
        // Silent fail - user might have canceled
      }
    }
  } catch (error) {
    console.error("Camera capture outer error:", error)
    // This should not reach here due to inner try-catches, but just in case
  }
}

/**
 * Open gallery via Flutter bridge or browser fallback
 */
export const openGallery = async ({ onSelectFile, fileNamePrefix = "gallery-photo" }) => {
  if (!onSelectFile || typeof onSelectFile !== "function") {
    console.warn("openGallery: onSelectFile callback not provided")
    return
  }

  try {
    // For Gallery, we use the standard browser input.
    // Why? Because the browser's native file picker on Android/iOS
    // is highly reliable and provides direct gallery access.
    // The bridge "openCamera" seems to force camera even for gallery source.
    openTransientImageInput({
      onSelectFile,
      accept: "image/*",
    })
  } catch (error) {
    console.error("Gallery pick failed:", error)
    // Only show error if it's not just a user cancellation
    if (error?.message && !error.message.includes("canceled") && !error.message.includes("cancelled")) {
      toast.error("Failed to open gallery")
    }
  }
}
