import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ChevronDown, Download, Loader2 } from "lucide-react"
import { restaurantAPI } from "@/lib/api"

export default function FssaiDetails() {
  const navigate = useNavigate()
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const response = await restaurantAPI.getRestaurantByOwner()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant || response?.data?.data
        setRestaurant(data || null)
      } catch (error) {
        console.error("Error fetching FSSAI details:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurant()
  }, [])

  const fssai = restaurant?.onboarding?.step3?.fssai || {}
  const fssaiDocumentUrl = fssai?.image?.url || ""
  const expiryDate = fssai?.expiryDate ? new Date(fssai.expiryDate) : null
  const headerAddress =
    restaurant?.location?.address ||
    restaurant?.location?.formattedAddress ||
    [restaurant?.location?.area, restaurant?.location?.city].filter(Boolean).join(", ")

  const daysUntilExpiry = useMemo(() => {
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) return null
    return Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / 86400000))
  }, [expiryDate])

  const handleDownload = () => {
    if (fssaiDocumentUrl) {
      window.open(fssaiDocumentUrl, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <h1 className="text-base font-semibold text-gray-900">
              {restaurant?.name || "Restaurant"}
            </h1>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </div>
          <p className="text-xs text-gray-500">{headerAddress || "Address not added yet"}</p>
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-28 space-y-4">
        {loading && (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
            <p className="text-sm text-gray-500">Loading FSSAI details...</p>
          </div>
        )}

        {/* Warning banner */}
        {!loading && daysUntilExpiry !== null && (
        <div className="rounded-2xl bg-[#ffe9b3] px-4 py-3 flex items-start gap-3">
          <div className="mt-1 h-6 w-6 rounded-full bg-black/80 flex items-center justify-center text-white text-xs font-semibold">
            i
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">
              {daysUntilExpiry === 0 ? "FSSAI expires today" : `FSSAI is expiring in ${daysUntilExpiry} days`}
            </p>
            <p className="text-xs text-gray-700 mt-1">
              Update before expiry to keep getting orders
            </p>
          </div>
        </div>
        )}

        {/* Details card */}
        {!loading && (
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">FSSAI registration number</p>
            <p className="text-sm font-semibold text-gray-900">
              {fssai?.registrationNumber || "Not added yet"}
            </p>
          </div>

          <div className="border-t border-dashed border-gray-200" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Document</p>
              <p className="text-sm font-semibold text-gray-900">
                {fssaiDocumentUrl ? "FSSAI document on file" : "No document uploaded"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!fssaiDocumentUrl}
              className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
            >
              <Download className="w-4 h-4 text-gray-800" />
            </button>
          </div>

          <div className="border-t border-dashed border-gray-200" />

          <div>
            <p className="text-xs text-gray-500 mb-1">Valid up to</p>
            <p className="text-sm font-semibold text-gray-900">
              {expiryDate && !Number.isNaN(expiryDate.getTime())
                ? expiryDate.toLocaleDateString("en-GB")
                : "Not added yet"}
            </p>
          </div>
        </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="px-4 pb-6 pt-3 border-t border-gray-200 bg-white">
        <button
          type="button"
          className="w-full py-3 rounded-full bg-black text-white text-sm font-medium mb-2"
          onClick={() => navigate("/restaurant/fssai/update")}
        >
          Update FSSAI license
        </button>
        <p className="text-xs text-center text-gray-600">
          Havent renewed your FSSAI?{" "}
          <button
            type="button"
            className="text-blue-600 underline underline-offset-2"
            onClick={() => navigate("/restaurant/fssai/update")}
          >
            Apply Now
          </button>
        </p>
      </div>
    </div>
  )
}
