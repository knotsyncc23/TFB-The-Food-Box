export const buildShareMessage = ({ title, text, url }) =>
  [text, url].filter(Boolean).join(" ").trim() || title || url || ""

const buildWhatsAppShareUrl = ({ title, text, url }) => {
  const message = buildShareMessage({ title, text, url })
  return message
    ? `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    : ""
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

export const shareContent = async ({ title, text, url }) => {
  const shareData = {}
  if (title) shareData.title = title
  if (text) shareData.text = text
  if (url) shareData.url = url
  const fallbackMessage = buildShareMessage({ title, text, url })

  try {
    if (
      navigator.share &&
      (!navigator.canShare || navigator.canShare(shareData))
    ) {
      await navigator.share(shareData)
      return { method: "native" }
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      return { method: "cancelled" }
    }
  }

  const whatsappUrl = buildWhatsAppShareUrl({ title, text, url })
  if (openShareFallbackWindow(whatsappUrl)) {
    return { method: "whatsapp" }
  }

  // Clipboard is the last resort when the device/browser cannot present a share target.
  if (await copyTextFallback(fallbackMessage)) {
    return { method: "clipboard" }
  }

  throw new Error("Share is not supported on this device")
}
