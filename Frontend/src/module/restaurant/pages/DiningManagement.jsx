import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  UtensilsCrossed,
  Info,
  Image as ImageIcon,
  Users,
  Tag,
  Utensils,
  Settings,
  Loader2,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  LayoutGrid,
  Check,
} from "lucide-react"
import { restaurantAPI, diningAPI } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

const SECTION_IDS = {
  BASIC: "basic",
  ABOUT: "about",
  COVER: "cover",
  SEATING: "seating",
  CATEGORIES: "categories",
  OFFERS: "offers",
  MENU: "menu",
  PAGE_CONTROLS: "page-controls",
}

export default function DiningManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [expandedSection, setExpandedSection] = useState(SECTION_IDS.BASIC)
  const [config, setConfig] = useState(null)
  const [adminControls, setAdminControls] = useState({
    isEnabledByAdmin: true,
    requestStatus: "none",
    lastRequestAt: null,
    recommendedCategorySlug: null,
    maxGuests: null,
  })
  const [offers, setOffers] = useState([])
  const [diningMenu, setDiningMenu] = useState({ sections: [], addons: [] })
  const [allDiningCategories, setAllDiningCategories] = useState([])

  const [form, setForm] = useState({
    enabled: false,
    basicDetails: {
      name: "",
      address: "",
      description: "",
      costForTwo: "",
      openingTime: "12:00",
      closingTime: "23:59",
      isOpen: true,
    },
    coverImage: { url: "", publicId: "" },
    gallery: [],
    tableBooking: {
      enabled: false,
      timeSlots: [],
      minGuestsPerBooking: 1,
      maxGuestsPerBooking: 10,
      approvalMode: "manual",
    },
    seatingCapacity: null,
    categories: [],
    pageControls: {
      reviewsEnabled: true,
      shareEnabled: true,
      diningSlug: "",
    },
  })

  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [offerForm, setOfferForm] = useState({ type: "prebook", title: "", description: "", discountType: "percentage", discountValue: "", validFrom: "", validTo: "", isActive: true })

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true)
        setError(null)
        const [configRes, offersRes, menuRes, categoriesRes] = await Promise.all([
          restaurantAPI.getDiningConfig(),
          restaurantAPI.getDiningOffers(),
          restaurantAPI.getDiningMenu(),
          diningAPI.getCategories(),
        ])
        if (configRes.data?.success && configRes.data?.data?.diningConfig) {
          const c = configRes.data.data.diningConfig
          setConfig(c)
          if (c.adminControls) {
            setAdminControls({
              isEnabledByAdmin: c.adminControls.isEnabledByAdmin !== false,
              requestStatus: c.adminControls.requestStatus || "none",
              lastRequestAt: c.adminControls.lastRequestAt || null,
              recommendedCategorySlug: c.adminControls.recommendedCategorySlug || null,
              maxGuests: c.adminControls.maxGuests ?? null,
            })
          } else {
            setAdminControls({
              isEnabledByAdmin: true,
              requestStatus: "none",
              lastRequestAt: null,
              recommendedCategorySlug: null,
              maxGuests: null,
            })
          }
          setForm({
            enabled: c.enabled ?? false,
            basicDetails: {
              name: c.basicDetails?.name ?? "",
              address: c.basicDetails?.address ?? "",
              description: c.basicDetails?.description ?? "",
              costForTwo: c.basicDetails?.costForTwo ?? "",
              openingTime: c.basicDetails?.openingTime ?? "12:00",
              closingTime: c.basicDetails?.closingTime ?? "23:59",
              isOpen: c.basicDetails?.isOpen !== false,
            },
            coverImage: c.coverImage || { url: "", publicId: "" },
            gallery: c.gallery || [],
            tableBooking: {
              enabled: c.tableBooking?.enabled ?? false,
              timeSlots: c.tableBooking?.timeSlots || [],
              minGuestsPerBooking: c.tableBooking?.minGuestsPerBooking ?? 1,
              maxGuestsPerBooking: c.tableBooking?.maxGuestsPerBooking ?? 10,
              approvalMode: c.tableBooking?.approvalMode ?? "manual",
            },
            seatingCapacity: c.seatingCapacity ?? null,
            categories: c.categories || [],
            pageControls: {
              reviewsEnabled: c.pageControls?.reviewsEnabled !== false,
              shareEnabled: c.pageControls?.shareEnabled !== false,
              diningSlug: c.pageControls?.diningSlug ?? "",
            },
          })
        }
        if (offersRes.data?.success && Array.isArray(offersRes.data?.data?.offers)) setOffers(offersRes.data.data.offers)
        if (menuRes.data?.success && menuRes.data?.data) setDiningMenu(menuRes.data.data)
        if (categoriesRes?.data?.success && Array.isArray(categoriesRes?.data?.data)) {
          setAllDiningCategories(categoriesRes.data.data)
        }
      } catch (e) {
        setError(e.response?.data?.message || e.message || "Failed to load dining config")
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  // When admin recommends a dining category (via slug), sync it into the form selection
  useEffect(() => {
    if (!adminControls.recommendedCategorySlug || allDiningCategories.length === 0) return

    const match = allDiningCategories.find((cat) => {
      if (!cat?.name) return false
      const slug = cat.name.toLowerCase().replace(/\s+/g, "-")
      return slug === adminControls.recommendedCategorySlug
    })
    if (!match) return

    setForm((prev) => {
      const idStr = String(match._id)
      const current = prev.categories || []
      if (current.some((categoryId) => String(categoryId) === idStr)) {
        return prev
      }
      return { ...prev, categories: [...current, match._id] }
    })
  }, [adminControls.recommendedCategorySlug, allDiningCategories])

  const recommendedCategoryName =
    adminControls.recommendedCategorySlug && allDiningCategories.length > 0
      ? (() => {
        const match = allDiningCategories.find((cat) => {
          if (!cat?.name) return false
          const slug = cat.name.toLowerCase().replace(/\s+/g, "-")
          return slug === adminControls.recommendedCategorySlug
        })
        return match?.name || null
      })()
      : null

  const saveDiningConfig = async () => {
    try {
      setSaving(true)
      const payload = {
        enabled: form.enabled,
        basicDetails: form.basicDetails,
        coverImage: form.coverImage?.url ? form.coverImage : undefined,
        gallery: form.gallery,
        seatingCapacity:
          form.seatingCapacity == null || form.seatingCapacity === ""
            ? null
            : Number(form.seatingCapacity),
        categories: form.categories,
        pageControls: form.pageControls,
      }
      await restaurantAPI.updateDiningConfig(payload)
      setConfig((prev) => ({ ...prev, ...payload }))
      toast.success("Dining configuration saved successfully")
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploadingCover(true)
      setError(null)
      const res = await restaurantAPI.uploadProfileImage(file)
      const data = res.data?.data || res.data
      const profileImage = data?.profileImage || data
      if (profileImage?.url) {
        setForm((p) => ({ ...p, coverImage: { url: profileImage.url, publicId: profileImage.publicId || "" } }))
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to upload cover image")
    } finally {
      setUploadingCover(false)
      e.target.value = ""
    }
  }

  const handleGalleryUpload = async (e) => {
    const files = e.target.files
    if (!files?.length) return
    try {
      setUploadingGallery(true)
      setError(null)
      const newEntries = []
      for (let i = 0; i < files.length; i++) {
        const res = await restaurantAPI.uploadMenuImage(files[i])
        const data = res.data?.data || res.data
        const menuImage = data?.menuImage || data
        if (menuImage?.url) newEntries.push({ url: menuImage.url, publicId: menuImage.publicId || "" })
      }
      if (newEntries.length) setForm((p) => ({ ...p, gallery: [...(p.gallery || []), ...newEntries] }))
    } catch (err) {
      setError(err.response?.data?.message || "Failed to upload gallery image(s)")
    } finally {
      setUploadingGallery(false)
      e.target.value = ""
    }
  }

  const removeGalleryImage = (index) => {
    setForm((p) => ({ ...p, gallery: (p.gallery || []).filter((_, i) => i !== index) }))
  }

  const createOffer = async () => {
    if (!offerForm.title || offerForm.discountValue === "" || !offerForm.validFrom || !offerForm.validTo) return
    try {
      await restaurantAPI.createDiningOffer({
        ...offerForm,
        discountValue: Number(offerForm.discountValue),
      })
      const res = await restaurantAPI.getDiningOffers()
      if (res.data?.success) setOffers(res.data.data?.offers || [])
      setOfferForm({ type: "prebook", title: "", description: "", discountType: "percentage", discountValue: "", validFrom: "", validTo: "", isActive: true })
    } catch (e) {
      setError(e.response?.data?.message || "Failed to create offer")
    }
  }

  const deleteOffer = async (offerId) => {
    if (!confirm("Delete this offer?")) return
    try {
      await restaurantAPI.deleteDiningOffer(offerId)
      setOffers((prev) => prev.filter((o) => o._id !== offerId))
    } catch (e) {
      setError(e.response?.data?.message || "Failed to delete")
    }
  }

  const toggleOfferActive = async (offer) => {
    try {
      await restaurantAPI.updateDiningOffer(offer._id, { isActive: !offer.isActive })
      setOffers((prev) => prev.map((o) => (o._id === offer._id ? { ...o, isActive: !o.isActive } : o)))
    } catch (e) {
      setError(e.response?.data?.message || "Failed to update offer")
    }
  }

  const updateMenuItemDining = async (sectionId, itemId, subsectionId, dineInPrice, availableForDining) => {
    try {
      await restaurantAPI.updateDiningMenuItem({ sectionId, itemId, subsectionId, dineInPrice, availableForDining })
      const res = await restaurantAPI.getDiningMenu()
      if (res.data?.success) setDiningMenu(res.data.data)
    } catch (e) {
      setError(e.response?.data?.message || "Failed to update item")
    }
  }

  // Dining categories allow multi-select.
  const toggleCategory = (categoryId) => {
    setForm(prev => {
      const current = prev.categories || [];
      const isSelected = current.includes(categoryId);
      const updated = isSelected
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId];
      return { ...prev, categories: updated };
    });
  }

  const handleRequestEnable = async () => {
    try {
      setSaving(true)
      setError(null)
      await restaurantAPI.requestDiningEnable()
      setAdminControls((prev) => ({
        ...prev,
        requestStatus: "pending",
        lastRequestAt: new Date().toISOString(),
      }))
      toast.success("Dining enable request sent to admin.")
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || "Failed to send request"
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/restaurant/explore")} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Back">
                <ArrowLeft className="w-5 h-5 text-slate-700" />
              </button>
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-6 h-6 text-slate-700" />
                <h1 className="text-xl font-bold text-gray-900">Dining Management</h1>
              </div>
            </div>
            <Button onClick={saveDiningConfig} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="ml-2">Save</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Admin status + request controls */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">
                Dining status (Admin)
              </span>
              {adminControls.isEnabledByAdmin ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                  Enabled
                </span>
              ) : adminControls.requestStatus === "pending" ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Pending Approval
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                  Disabled by Admin
                </span>
              )}
            </div>
            {!adminControls.isEnabledByAdmin && adminControls.requestStatus !== "pending" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRequestEnable}
                disabled={saving}
                className="text-red-700 border-red-300 hover:bg-red-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>Request Dining Enable</>
                )}
              </Button>
            )}
          </div>
          {!adminControls.isEnabledByAdmin && (
            <p className="text-xs text-slate-500">
              Dining service is currently disabled by Admin.{" "}
              {adminControls.requestStatus === "pending"
                ? "Your enable request is pending approval."
                : "Send a request to enable dining for this restaurant."}
            </p>
          )}
        </div>

        {/* Dining enable toggle */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <span className="font-medium text-slate-900">Enable Dining Page</span>
          <button
            role="switch"
            aria-checked={form.enabled}
            onClick={() => {
              if (!adminControls.isEnabledByAdmin) return;
              setForm((p) => ({ ...p, enabled: !p.enabled }));
            }}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              !adminControls.isEnabledByAdmin
                ? "bg-slate-200 cursor-not-allowed opacity-60"
                : form.enabled
                ? "bg-red-600"
                : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                form.enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Basic Details */}
        <Section
          id={SECTION_IDS.BASIC}
          title="Dining Basic Details"
          icon={Info}
          expanded={expandedSection === SECTION_IDS.BASIC}
          onToggle={() => setExpandedSection(expandedSection === SECTION_IDS.BASIC ? null : SECTION_IDS.BASIC)}
        >
          <div className="grid gap-4">
            <label className="block text-sm font-medium text-slate-700">Restaurant name</label>
            <Input value={form.basicDetails.name} onChange={(e) => setForm((p) => ({ ...p, basicDetails: { ...p.basicDetails, name: e.target.value } }))} placeholder="Name" className="max-w-md" />
            <label className="block text-sm font-medium text-slate-700">Address</label>
            <Input value={form.basicDetails.address} onChange={(e) => setForm((p) => ({ ...p, basicDetails: { ...p.basicDetails, address: e.target.value } }))} placeholder="Address" className="max-w-md" />
            <label className="block text-sm font-medium text-slate-700">Cost for two (₹)</label>
            <Input type="number" value={form.basicDetails.costForTwo} onChange={(e) => setForm((p) => ({ ...p, basicDetails: { ...p.basicDetails, costForTwo: e.target.value } }))} placeholder="e.g. 1400" className="max-w-xs" />
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Opening time</label>
                <Input type="time" value={form.basicDetails.openingTime} onChange={(e) => setForm((p) => ({ ...p, basicDetails: { ...p.basicDetails, openingTime: e.target.value } }))} className="max-w-[140px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Closing time</label>
                <Input type="time" value={form.basicDetails.closingTime} onChange={(e) => setForm((p) => ({ ...p, basicDetails: { ...p.basicDetails, closingTime: e.target.value } }))} className="max-w-[140px]" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isOpen" checked={form.basicDetails.isOpen} onChange={(e) => setForm((p) => ({ ...p, basicDetails: { ...p.basicDetails, isOpen: e.target.checked } }))} className="rounded" />
              <label htmlFor="isOpen" className="text-sm font-medium text-slate-700">Open for dining</label>
            </div>
          </div>
        </Section>

        {/* About */}
        <Section
          id={SECTION_IDS.ABOUT}
          title="About"
          icon={FileText}
          expanded={expandedSection === SECTION_IDS.ABOUT}
          onToggle={() => setExpandedSection(expandedSection === SECTION_IDS.ABOUT ? null : SECTION_IDS.ABOUT)}
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">About your restaurant</label>
            <p className="text-xs text-slate-500 mt-1 mb-2">This text is shown on the dining page in the About tab.</p>
            <textarea
              value={form.basicDetails.description}
              onChange={(e) => setForm((p) => ({ ...p, basicDetails: { ...p.basicDetails, description: e.target.value } }))}
              placeholder="e.g. We serve fresh, locally sourced ingredients in a cozy atmosphere..."
              rows={4}
              className="w-full max-w-md border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </Section>

        {/* Cover & Gallery */}
        <Section id={SECTION_IDS.COVER} title="Dining Cover & Gallery" icon={ImageIcon} expanded={expandedSection === SECTION_IDS.COVER} onToggle={() => setExpandedSection(expandedSection === SECTION_IDS.COVER ? null : SECTION_IDS.COVER)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Cover image</label>
              <p className="text-xs text-slate-500 mt-1 mb-2">Upload a cover image for your dining page.</p>
              <input type="file" accept="image/*" onChange={handleCoverUpload} disabled={uploadingCover} className="block w-full max-w-md text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-red-50 file:text-red-700 file:font-medium hover:file:bg-red-100" />
              {uploadingCover && <p className="text-sm text-slate-500 mt-1">Uploading…</p>}
            </div>
            {form.coverImage?.url && (
              <div className="relative inline-block">
                <img src={form.coverImage.url} alt="Cover" className="w-full max-w-md h-40 object-cover rounded-lg" onError={(e) => e.target.style.display = "none"} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700">Gallery images</label>
              <p className="text-xs text-slate-500 mt-1 mb-2">Upload one or more images for the gallery.</p>
              <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} disabled={uploadingGallery} className="block w-full max-w-md text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-red-50 file:text-red-700 file:font-medium hover:file:bg-red-100" />
              {uploadingGallery && <p className="text-sm text-slate-500 mt-1">Uploading…</p>}
            </div>
            {(form.gallery || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(form.gallery || []).map((g, i) => (
                  <div key={i} className="relative">
                    <img src={g.url} alt="" className="w-24 h-24 object-cover rounded-lg" />
                    <button type="button" onClick={() => removeGalleryImage(i)} className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* Seating Capacity */}
        <Section id={SECTION_IDS.SEATING} title="Seating Capacity" icon={Users} expanded={expandedSection === SECTION_IDS.SEATING} onToggle={() => setExpandedSection(expandedSection === SECTION_IDS.SEATING ? null : SECTION_IDS.SEATING)}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Number of seats</label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                value={form.seatingCapacity ?? ""}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === "") {
                    setForm((p) => ({ ...p, seatingCapacity: null }))
                    return
                  }
                  let val = Number(raw)
                  if (Number.isNaN(val) || val < 0) val = 0
                  const max = adminControls.maxGuests ?? null
                  if (max != null && val > max) val = max
                  setForm((p) => ({ ...p, seatingCapacity: val }))
                }}
                placeholder="e.g. 50"
                className="max-w-[140px] mt-1"
              />
              {adminControls.maxGuests != null && (
                <p className="text-xs text-slate-500">
                  Admin limit: up to <span className="font-semibold">{adminControls.maxGuests}</span> seats
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* Dining Categories */}
        {form.enabled && (
          <Section
            id={SECTION_IDS.CATEGORIES}
            title="Dining Categories"
            icon={LayoutGrid}
            expanded={expandedSection === SECTION_IDS.CATEGORIES}
            onToggle={() => setExpandedSection(expandedSection === SECTION_IDS.CATEGORIES ? null : SECTION_IDS.CATEGORIES)}
          >
            <div className="space-y-3">
              <p className="text-sm text-slate-600 mb-1">Select the category that best describes your dining experience.</p>
              {recommendedCategoryName && (
                <p className="text-xs font-semibold text-red-700">
                  Recommended by admin: <span className="underline">{recommendedCategoryName}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {allDiningCategories.length === 0 ? (
                  <div className="col-span-2 py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-sm text-slate-500">No dining categories found.</p>
                  </div>
                ) : (
                  allDiningCategories.map((category) => {
                    const isSelected = form.categories?.includes(category._id);
                    return (
                      <button
                        key={category._id}
                        type="button"
                        onClick={() => toggleCategory(category._id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isSelected
                          ? "border-red-500 bg-red-50 ring-1 ring-red-500"
                          : "border-slate-200 hover:border-red-200 hover:bg-slate-50"
                          }`}
                      >
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? "bg-red-500 border-red-500" : "bg-white border-slate-300"
                          }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${isSelected ? "text-red-900" : "text-slate-700"}`}>
                            {category.name}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Pre-book & Walk-in Offers */}
        <Section id={SECTION_IDS.OFFERS} title="Pre-book & Walk-in Offers" icon={Tag} expanded={expandedSection === SECTION_IDS.OFFERS} onToggle={() => setExpandedSection(expandedSection === SECTION_IDS.OFFERS ? null : SECTION_IDS.OFFERS)}>
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={offerForm.title} onChange={(e) => setOfferForm((p) => ({ ...p, title: e.target.value }))} placeholder="Offer title" />
              <select value={offerForm.type} onChange={(e) => setOfferForm((p) => ({ ...p, type: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
                <option value="prebook">Pre-book</option>
                <option value="walkin">Walk-in</option>
              </select>
              <select value={offerForm.discountType} onChange={(e) => setOfferForm((p) => ({ ...p, discountType: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
                <option value="percentage">Percentage</option>
                <option value="flat">Flat</option>
              </select>
              <Input type="number" value={offerForm.discountValue} onChange={(e) => setOfferForm((p) => ({ ...p, discountValue: e.target.value }))} placeholder="Discount value" />
              <Input type="date" value={offerForm.validFrom} onChange={(e) => setOfferForm((p) => ({ ...p, validFrom: e.target.value }))} />
              <Input type="date" value={offerForm.validTo} onChange={(e) => setOfferForm((p) => ({ ...p, validTo: e.target.value }))} />
            </div>
            <Button onClick={createOffer} disabled={!offerForm.title || offerForm.discountValue === "" || !offerForm.validFrom || !offerForm.validTo}>
              <Plus className="w-4 h-4 mr-2" /> Add offer
            </Button>
            <ul className="divide-y divide-slate-200">
              {offers.map((o) => (
                <li key={o._id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-medium">{o.title}</span>
                    <span className="ml-2 text-sm text-slate-500">{o.type} · {o.discountType} {o.discountValue}{o.discountType === "percentage" ? "%" : "₹"}</span>
                    {!o.isActive && <span className="ml-2 text-amber-600 text-sm">Disabled</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleOfferActive(o)} className="text-sm text-slate-600 hover:underline">{o.isActive ? "Disable" : "Enable"}</button>
                    <button type="button" onClick={() => deleteOffer(o._id)} className="text-red-600 hover:underline"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* Dining Menu */}
        <Section id={SECTION_IDS.MENU} title="Dining Menu Management" icon={Utensils} expanded={expandedSection === SECTION_IDS.MENU} onToggle={() => setExpandedSection(expandedSection === SECTION_IDS.MENU ? null : SECTION_IDS.MENU)}>
          <p className="text-sm text-slate-600 mb-4">Categories and items come from your main menu. Set dine-in price and availability below.</p>
          <div className="space-y-4">
            {diningMenu.sections?.map((sec) => (
              <div key={sec.id} className="border rounded-lg p-4">
                <h4 className="font-medium text-slate-900 mb-2">{sec.name}</h4>
                <ul className="space-y-2">
                  {(sec.items || []).map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-4 text-sm">
                      <span>{item.name}</span>
                      <div className="flex items-center gap-2">
                        <Input type="number" className="w-20 h-8" placeholder="Dine-in price" value={item.dineInPrice ?? ""} onChange={(e) => updateMenuItemDining(sec.id, item.id, null, e.target.value ? Number(e.target.value) : null, undefined)} />
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={item.availableForDining} onChange={(e) => updateMenuItemDining(sec.id, item.id, null, undefined, e.target.checked)} />
                          <span>Available</span>
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* Page Controls */}
        <Section id={SECTION_IDS.PAGE_CONTROLS} title="Dining Page Controls" icon={Settings} expanded={expandedSection === SECTION_IDS.PAGE_CONTROLS} onToggle={() => setExpandedSection(expandedSection === SECTION_IDS.PAGE_CONTROLS ? null : SECTION_IDS.PAGE_CONTROLS)}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="reviewsEnabled" checked={form.pageControls.reviewsEnabled} onChange={(e) => setForm((p) => ({ ...p, pageControls: { ...p.pageControls, reviewsEnabled: e.target.checked } }))} className="rounded" />
              <label htmlFor="reviewsEnabled">Enable reviews</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="shareEnabled" checked={form.pageControls.shareEnabled} onChange={(e) => setForm((p) => ({ ...p, pageControls: { ...p.pageControls, shareEnabled: e.target.checked } }))} className="rounded" />
              <label htmlFor="shareEnabled">Enable share button</label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Dining page slug</label>
              <Input value={form.pageControls.diningSlug} onChange={(e) => setForm((p) => ({ ...p, pageControls: { ...p.pageControls, diningSlug: e.target.value } }))} placeholder="e.g. my-restaurant" className="max-w-md mt-1" />
              <p className="text-xs text-slate-500 mt-1">URL: /dining/family-dining/[slug]</p>
            </div>
          </div>
        </Section>
      </div>
    </div >
  )
}

function Section({ id, title, icon: Icon, expanded, onToggle, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50">
        <Icon className="w-5 h-5 text-slate-600" />
        <span className="font-semibold text-slate-900">{title}</span>
        {expanded ? <ChevronDown className="w-5 h-5 ml-auto text-slate-500" /> : <ChevronRight className="w-5 h-5 ml-auto text-slate-500" />}
      </button>
      {expanded && <div className="px-4 pb-4 pt-0 border-t border-slate-100">{children}</div>}
    </div>
  )
}
