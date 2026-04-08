export const buildShareMessage = ({ title, text, url }) =>
  [text, url].filter(Boolean).join(" ").trim() || title || url || ""

const buildWhatsAppShareUrl = ({ title, text, url }) => {
  const message = buildShareMessage({ title, text, url })
  if (!message) return ""
  // `wa.me` generally works better across desktop + mobile than `api.whatsapp.com`.
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

const copyTextFallback = async (text) => {
  if (!text) return false

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to legacy copy.
    }
  }

  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "true")
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    textarea.style.left = "-9999px"
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    const copied = document.execCommand("copy")
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}

const openShareFallbackWindow = (url) => {
  if (!url || typeof window === "undefined") return false

  const shareWindow = window.open(url, "_blank", "noopener,noreferrer")
  if (shareWindow) return true

  try {
    const link = document.createElement("a")
    link.href = url
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return true
  } catch {
    return false
  }
}

const normalizeShareUrl = (url) => {
  if (!url || typeof window === "undefined") return url
  try {
    return new URL(url, window.location.href).toString()
  } catch {
    return url
  }
}

const hasFlutterShareBridge = () => {
  return (
    typeof window !== "undefined" &&
    window.flutter_inappwebview &&
    typeof window.flutter_inappwebview.callHandler === "function"
  )
}

export const shareContent = async ({ title, text, url }) => {
  const shareData = {}
  if (title) shareData.title = title
  if (text) shareData.text = text
  if (url) shareData.url = normalizeShareUrl(url)

  const fallbackMessage =
    buildShareMessage({ title, text, url: shareData.url || url }) ||
    (typeof window !== "undefined" ? window.location.href : "")

  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      // `navigator.canShare()` is unreliable across browsers for `{ title, text, url }`.
      // We only treat it as authoritative when sharing files.
      if (typeof navigator.canShare === "function" && shareData.files) {
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData)
          return { method: "native" }
        }
      } else {
        await navigator.share(shareData)
        return { method: "native" }
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      return { method: "cancelled" }
    }
  }

  // Flutter InAppWebView: try native share via a bridge if the host app supports it.
  if (hasFlutterShareBridge()) {
    try {
      const payload = {
        title: shareData.title,
        text: shareData.text,
        url: shareData.url || url,
      }
      const result = await window.flutter_inappwebview.callHandler(
        "nativeShare",
        payload,
      )

      const ok =
        result === true ||
        result === "ok" ||
        result === "success" ||
        (result && typeof result === "object" && result.success === true)

      if (ok) return { method: "flutter" }
    } catch {
      // ignore and continue to web fallbacks
    }
  }

  const whatsappUrl = buildWhatsAppShareUrl({
    title,
    text,
    url: shareData.url || url,
  })
  if (openShareFallbackWindow(whatsappUrl)) {
    return { method: "whatsapp" }
  }

  // Clipboard is the last resort when the device/browser cannot present a share target.
  if (await copyTextFallback(fallbackMessage)) {
    return { method: "clipboard" }
  }

  throw new Error("Share is not supported on this device")
}
