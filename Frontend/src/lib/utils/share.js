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
  const shareWindow = window.open(whatsappUrl, "_blank", "noopener,noreferrer")

  if (shareWindow) {
    return { method: "whatsapp" }
  }

  const fallbackMessage = buildShareMessage({ title, text, url })
  if (navigator.clipboard?.writeText && fallbackMessage) {
    await navigator.clipboard.writeText(fallbackMessage)
    return { method: "clipboard" }
  }

  throw new Error("Share is not supported on this device")
}
