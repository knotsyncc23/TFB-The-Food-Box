import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { diningAPI } from "@/lib/api"
import { getCompanyNameAsync } from "@/lib/utils/businessSettings"
import { shareContent } from "@/lib/utils/share"
import { useProfile } from "../../context/ProfileContext"
import { toast } from "sonner"
import {
  ArrowLeft,
  Bookmark,
  Share2,
  MapPin,
  Phone,
  Clock,
  ChevronRight,
  Smartphone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import AnimatedPage from "../../components/AnimatedPage"
import { Loader2 } from "lucide-react"

/** Format 24h time string to display (e.g. "22:00" -> "10:00 pm") */
function formatTimeForDisplay(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return ""
  const trimmed = timeStr.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i) || trimmed.match(/^(\d{1,2})(\d{2})\s*(am|pm)?$/i)
  if (!match) return trimmed
  let h = parseInt(match[1], 10)
  const m = match[2] ? parseInt(match[2], 10) : 0
  const suffix = (match[3] || "").toLowerCase()
  if (suffix !== "am" && suffix !== "pm") {
    if (h >= 12) {
      if (h > 12) h -= 12
      return `${h}:${String(m).padStart(2, "0")} pm`
    }
    if (h === 0) h = 12
    return `${h}:${String(m).padStart(2, "0")} am`
  }
  return `${h}:${String(m).padStart(2, "0")} ${suffix}`
}

/** Check if currently within opening/closing time (simple 24h comparison; assumes same day) */
function isCurrentlyOpen(openingTime, closingTime, openDays) {
  if (!openingTime || !closingTime) return null
  const now = new Date()
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const today = dayNames[now.getDay()]
  if (Array.isArray(openDays) && openDays.length > 0) {
    const normalized = openDays.map((d) => (typeof d === "string" ? d.slice(0, 3) : ""))
    if (!normalized.includes(today)) return false
  }
  const parse = (t) => {
    const s = String(t).trim()
    const withAmPm = s.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i)
    if (!withAmPm) return null
    let h = parseInt(withAmPm[1], 10)
    const min = parseInt(withAmPm[2] || 0, 10)
    const ampm = (withAmPm[3] || "").toLowerCase()
    if (ampm === "pm" && h < 12) h += 12
    if (ampm === "am" && h === 12) h = 0
    return h * 60 + min
  }
  const openM = parse(openingTime)
  let closeM = parse(closingTime)
  if (openM == null || closeM == null) return null
  if (closeM <= openM) closeM += 24 * 60
  const currentM = now.getHours() * 60 + now.getMinutes()
  const inRange = currentM >= openM && currentM < closeM
  return inRange
}

export default function RestaurantInfoPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { addFavorite, removeFavorite, isFavorite } = useProfile()
  const [restaurant, setRestaurant] = useState(null)
  const [companyName, setCompanyName] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) {
        setError("Invalid restaurant")
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        setError(null)
        let apiRestaurant = null

        try {
          const response = await diningAPI.getRestaurantBySlug(slug)
          if (response.data?.success) {
            apiRestaurant = response.data.data
          }
        } catch (_) {}

        if (apiRestaurant) {
          setRestaurant(apiRestaurant)
        } else {
          setError("Restaurant not found")
        }

        const name = await getCompanyNameAsync()
        setCompanyName(name || "Tifunbox")
      } catch (err) {
        setError(err?.message || "Failed to load restaurant")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [slug])

  if (loading) {
    return (
      <AnimatedPage>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AnimatedPage>
    )
  }

  if (error || !restaurant) {
    return (
      <AnimatedPage>
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
          <p className="text-muted-foreground mb-4">{error || "Restaurant not found"}</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </AnimatedPage>
    )
  }

  const r = restaurant

  const name = r.name || "Restaurant"
  const cuisines = Array.isArray(r.cuisines)
    ? r.cuisines.filter(Boolean).join(" • ")
    : r.cuisine || r.cuisines || ""

  const address =
    r.location?.formattedAddress ||
    r.location?.address ||
    r.address ||
    (typeof r.location === "string" ? r.location : "") ||
    "Address not available"

  const phone = r.primaryContactNumber || r.phone || r.ownerPhone || ""

  const openingTime =
    r.deliveryTimings?.openingTime ||
    r.onboarding?.step2?.deliveryTimings?.openingTime ||
    r.diningConfig?.basicDetails?.openingTime ||
    ""
  const closingTimeRaw =
    r.deliveryTimings?.closingTime ||
    r.onboarding?.step2?.deliveryTimings?.closingTime ||
    r.diningConfig?.basicDetails?.closingTime ||
    ""
  const closingTime = closingTimeRaw || "11:59 pm"
  const closingTimeDisplay = formatTimeForDisplay(closingTime) || closingTime
  const openDays = r.openDays || r.onboarding?.step2?.openDays
  const computedOpen = isCurrentlyOpen(openingTime, closingTime, openDays)
  const isOpen =
    computedOpen !== null
      ? computedOpen
      : (r.diningConfig?.basicDetails?.isOpen ?? true)
  const openStatus = isOpen ? "Open now" : "Closed"
  const closesText = closingTimeDisplay ? `Closes ${closingTimeDisplay}` : ""
  const opensText = openingTime && !isOpen ? formatTimeForDisplay(openingTime) : ""

  const diningEnabled = !!(r.diningSettings?.isEnabled ?? r.diningConfig?.enabled)
  const isDeliveryOnly = r.isDeliveryOnly !== false && r.operationType !== "dine_in_only"
  const multipleBrands = !!(r.multipleBrands ?? r.hasMultipleBrands)
  const kitchenServiceText = diningEnabled
    ? "Dine-in and delivery available"
    : "This is a delivery-only kitchen"

  const legalName =
    r.onboarding?.step3?.gst?.legalName || r.ownerName || ""

  const fssaiNumber =
    r.onboarding?.step3?.fssai?.registrationNumber || ""

  const liveSinceYear = r.createdAt
    ? new Date(r.createdAt).getFullYear()
    : new Date().getFullYear()

  const coords = r.location?.coordinates || r.coordinates
  const lat = coords?.[1] ?? coords?.latitude
  const lng = coords?.[0] ?? coords?.longitude
  const mapsUrl =
    lat != null && lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  const telUrl = phone ? `tel:${phone.replace(/\D/g, "").slice(-10)}` : "#"

  return (
    <AnimatedPage>
      <div className="min-h-screen bg-background pb-8">
        {/* Header - back, bookmark, share all working */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => {
                if (!slug || !restaurant) return
                if (isFavorite(slug)) {
                  removeFavorite(slug)
                  toast.success("Removed from favorites")
                } else {
                  addFavorite({ slug, name: restaurant.name, id: restaurant._id || restaurant.id })
                  toast.success("Added to favorites")
                }
              }}
              aria-label={isFavorite(slug) ? "Remove from favorites" : "Add to favorites"}
            >
              <Bookmark
                className={`h-5 w-5 ${isFavorite(slug) ? "fill-[#671E1F] text-[#671E1F]" : ""}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={async () => {
                const url = window.location.href
                const title = restaurant?.name ? `${restaurant.name} - ${companyName}` : companyName
                try {
                  const result = await shareContent({ title, url })
                  if (result.method === "native") {
                    toast.success("Shared")
                  } else if (result.method === "whatsapp") {
                    toast.success("Opening share options")
                  } else if (result.method === "clipboard") {
                    toast.success("Share link copied")
                  }
                } catch (err) {
                  if (err?.name !== "AbortError") {
                    toast.error("Could not share")
                  }
                }
              }}
              aria-label="Share"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Name & Cuisine */}
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {name}
            </h1>
            {cuisines ? (
              <p className="text-sm text-muted-foreground mt-1">
                {cuisines}
              </p>
            ) : null}
            <p className="text-sm text-foreground mt-2 flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <span>{address}</span>
            </p>
          </div>

          {/* Contact */}
          <div className="flex gap-3">
            {phone ? (
              <a
                href={telUrl}
                className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-lg border-2 border-[#671E1F] text-[#671E1F] hover:bg-[#671E1F]/5 transition-colors"
              >
                <Phone className="h-5 w-5" />
                <span>Call</span>
              </a>
            ) : null}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-lg border-2 border-[#671E1F] text-[#671E1F] hover:bg-[#671E1F]/5 transition-colors"
            >
              <MapPin className="h-5 w-5" />
              <span>Direction</span>
            </a>
          </div>

          {/* Open / Closes - dynamic from restaurant hours */}
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span>
                {openStatus}
                {closesText ? ` • ${closesText}` : ""}
                {!isOpen && opensText ? ` • Opens ${opensText}` : ""}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Service type - dynamic: when dining is enabled by restaurant show different text */}
          {isDeliveryOnly ? (
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center gap-2 text-foreground">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <span>{kitchenServiceText}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : null}
          {multipleBrands ? (
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center gap-2 text-foreground">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <span>There are multiple brands delivering from this kitchen</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : null}

          {/* Live since - dynamic from companyName + restaurant.createdAt */}
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div className="flex items-center gap-2 text-foreground">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <span>Live on {companyName} since {liveSinceYear}</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Legal */}
          <div className="pt-4 space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Legal Name</span>
              <p className="font-medium text-foreground">
                {legalName || "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">FSSAI Lic No</span>
              <p className="font-medium text-foreground">
                {fssaiNumber || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  )
}
