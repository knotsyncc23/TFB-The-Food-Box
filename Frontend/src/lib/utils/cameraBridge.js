// Shared helpers for bridging camera access from Flutter InAppWebView to the web app
// Safely handles environments where the bridge is not available.

/**
 * Convert a base64 string (without data URL prefix) to a File.
 * @param {string} base64 - Base64 encoded string (may or may not include data: prefix).
 * @param {string} filename - Desired file name.
 * @param {string} mimeType - MIME type, e.g. 'image/jpeg'.
 * @returns {File}
 */
export function base64ToFile(base64, filename = "image.jpg", mimeType = "image/jpeg") {
  let raw = base64 || "";
  // Strip data URL prefix if present
  if (raw.includes(",")) {
    raw = raw.split(",")[1];
  }

  const byteCharacters = atob(raw);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType || "image/jpeg" });
  return new File([blob], filename || "image.jpg", { type: blob.type });
}

/**
 * Check if Flutter InAppWebView bridge is available.
 */
export function hasFlutterCameraBridge() {
  return (
    typeof window !== "undefined" &&
    window.flutter_inappwebview &&
    typeof window.flutter_inappwebview.callHandler === "function"
  );
}

/**
 * Open camera via Flutter InAppWebView bridge.
 * Calls handler with no args to match Flutter: openCamera() -> { success, base64, mimeType, fileName }
 * Returns a File object when successful.
 *
 * @param {Object} options - Optional (Flutter may ignore). source, accept, multiple, quality.
 * @returns {Promise<{ success: boolean, file?: File, raw?: any, error?: any }>}
 */
export async function openCameraViaFlutter(options = {}) {
  if (!hasFlutterCameraBridge()) {
    return { success: false, reason: "no_flutter_bridge" };
  }

  try {
    // Forward options when provided (e.g. { source: "gallery" }).
    // If options are empty, call without args for maximum compatibility.
    let result;
    if (options && Object.keys(options).length > 0) {
      result = await window.flutter_inappwebview.callHandler(
        "openCamera",
        options,
      );
    } else {
      result = await window.flutter_inappwebview.callHandler("openCamera");
    }

    if (!result || !result.success) {
      return { success: false, raw: result };
    }

    // If Flutter returns a File directly, prefer it
    if (result.file instanceof File) {
      return { success: true, file: result.file, raw: result };
    }

    if (result.base64) {
      const file = base64ToFile(
        result.base64,
        result.fileName || `image-${Date.now()}.jpg`,
        result.mimeType || "image/jpeg",
      );
      return { success: true, file, raw: result };
    }

    return { success: false, raw: result };
  } catch (error) {
    console.error("[CameraBridge] Failed to open camera via Flutter:", error);
    return { success: false, error };
  }
}

/**
 * Pick image for upload: uses Flutter camera bridge when in WebView, else triggers file input.
 * Use when you need a single flow that works in both Flutter and browser.
 *
 * @param {HTMLInputElement|null} fileInputRef - Ref to hidden file input (for browser fallback)
 * @param {boolean} useCamera - If true, prefer camera. In Flutter always uses camera.
 * @returns {Promise<File|null>} - The selected file, or null if cancelled/failed
 */
export async function pickImageForUpload(fileInputRef, useCamera = true) {
  if (hasFlutterCameraBridge()) {
    const { success, file } = await openCameraViaFlutter({ source: "camera" });
    return success && file ? file : null;
  }
  if (fileInputRef?.current) {
    return new Promise((resolve) => {
      const input = fileInputRef.current;
      const handler = (e) => {
        const file = e.target?.files?.[0];
        input.removeEventListener("change", handler);
        input.value = "";
        resolve(file || null);
      };
      input.addEventListener("change", handler);
      if (useCamera) input.setAttribute("capture", "environment");
      else input.removeAttribute("capture");
      input.click();
    });
  }
  return null;
}

