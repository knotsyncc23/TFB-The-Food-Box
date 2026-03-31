export const buildShareMessage = ({ title, text, url }) =>
  [text, url].filter(Boolean).join(" ").trim() || title || url || ""

const buildWhatsAppShareUrl = ({ title, text, url }) => {
  const message = buildShareMessage({ title, text, url })
  return `https://wa.me/?text=${encodeURIComponent(message)}`
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

  // Try clipboard first - this works even if popup blockers block new windows.
  if (navigator.clipboard?.writeText && fallbackMessage) {
    try {
      await navigator.clipboard.writeText(fallbackMessage)
      return { method: "clipboard" }
    } catch {
      // continue to whatsapp fallbacks
    }
  }

  const whatsappUrl = buildWhatsAppShareUrl({ title, text, url })
  const shareWindow = window.open(whatsappUrl, "_blank", "noopener,noreferrer")

  if (shareWindow) {
    return { method: "whatsapp" }
  }

  // Last-resort fallback for aggressive popup blockers.
  if (whatsappUrl) {
    window.location.assign(whatsappUrl)
    return { method: "whatsapp" }
  }

  throw new Error("Share is not supported on this device")
}
