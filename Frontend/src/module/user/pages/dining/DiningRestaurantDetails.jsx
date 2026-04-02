import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useProfile } from "@/module/user/context/ProfileContext"
import { restaurantAPI, diningAPI } from "@/lib/api"
import {
    ArrowLeft,
    MapPin,
    Star,
    Phone,
    Navigation,
    Share2,
    Bookmark,
    CheckCircle2,
    Clock,
    UtensilsCrossed
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { shareContent } from "@/lib/utils/share"

export default function DiningRestaurantDetails() {
    const { diningType, slug } = useParams() // Get params from URL
    const navigate = useNavigate()
    const { addFavorite, removeFavorite, isFavorite } = useProfile()
    const isFav = isFavorite(slug)

    const [restaurant, setRestaurant] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [activeTab, setActiveTab] = useState("Pre-book offers")
    const [isBookingOpen, setIsBookingOpen] = useState(false)
    const [selectedGuests, setSelectedGuests] = useState(2)
    const [diningOffers, setDiningOffers] = useState([])
    const [diningMenu, setDiningMenu] = useState(null)

    const handleShareClick = async () => {
        if (!restaurant) return

        const shareUrl = window.location.href
        const shareTitle = `${restaurant.name || "Dining"} - Tifunbox`
        const shareText = `Book your table at ${restaurant.name || "this restaurant"} on Tifunbox.`

        const result = await shareContent({
            title: shareTitle,
            text: shareText,
            url: shareUrl,
        })

        if (result.method === "whatsapp") {
            toast.success("Opening share options")
        } else if (result.method === "clipboard") {
            toast.success("Share link copied")
        }
    }

    // Fetch data
    useEffect(() => {
        const fetchRestaurant = async () => {
            if (!slug) return
            try {
                setLoading(true)
                // Try fetch by ID/Slug
                const response = await diningAPI.getRestaurantBySlug(slug)

                if (response.data && response.data.success) {
                    const raw = response.data.data
                    const inner = raw?.restaurant || raw
                    setRestaurant({
                        ...inner,
                        ...(raw.menuRestaurantId
                            ? { menuRestaurantId: raw.menuRestaurantId }
                            : {}),
                    })
                } else {
                    // Fallback: search by name if slug lookup fails directly (though getRestaurantById usually handles slugs)
                    // For now, assuming direct slug work or we might need the search logic from RestaurantDetails.jsx
                    setRestaurant(null)
                    setError("Restaurant not found")
                }
            } catch (err) {
                // If 404, we might need to search list. For now, simple error.
                console.error("Failed to load restaurant", err)

                // FAILSAFE: If API by slug fails, let's try to get list and find match (temporary fix for development if slug isn't unique ID)
                // In a real app, backend should support slug lookup reliably.
                try {
                    const listResp = await restaurantAPI.getRestaurants()
                    if (listResp.data?.data?.restaurants) {
                        const match = listResp.data.data.restaurants.find(r =>
                            r.slug === slug ||
                            r.name.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()
                        )
                        if (match) {
                            const actualMatch = match?.restaurant || match
                            setRestaurant(actualMatch)
                            setError(null)
                        } else {
                            setError("Restaurant not found")
                        }
                    }
                } catch (e) {
                    setError("Restaurant not found")
                }
            } finally {
                setLoading(false)
            }
        }
        fetchRestaurant()
    }, [slug])

    // Fetch this restaurant's dining offers (pre-book & walk-in) by slug
    useEffect(() => {
        if (!slug) return
        const fetchOffers = async () => {
            try {
                const res = await diningAPI.getRestaurantOffersBySlug(slug)
                if (res?.data?.success && Array.isArray(res.data?.data)) {
                    setDiningOffers(res.data.data)
                } else {
                    setDiningOffers([])
                }
            } catch {
                setDiningOffers([])
            }
        }
        fetchOffers()
    }, [slug])

    // Fetch restaurant menu for Menu tab (with images)
    useEffect(() => {
        const menuId = restaurant?.menuRestaurantId || restaurant?._id
        if (!menuId) return
        const fetchMenu = async () => {
            try {
                const res = await restaurantAPI.getMenuByRestaurantId(menuId)
                const data = res?.data?.data || res?.data
                setDiningMenu(data?.menu || data || null)
            } catch {
                setDiningMenu(null)
            }
        }
        fetchMenu()
    }, [restaurant?.menuRestaurantId, restaurant?._id])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-[#671E1F]" />
            </div>
        )
    }

    if (error || !restaurant) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
                <h2 className="text-xl font-bold text-slate-800">Restaurant not found</h2>
                <Button onClick={() => navigate(-1)} className="mt-4" variant="outline">Go Back</Button>
            </div>
        )
    }

    // Helper to build a full human-readable address for dining pages
    const buildFullAddress = () => {
        // 1) Dining config basic address (usually already formatted)
        const dcAddress = restaurant.diningConfig?.basicDetails?.address
        if (dcAddress && dcAddress.trim()) return dcAddress.trim()

        const loc = restaurant.location || {}

        // 2) Prefer formattedAddress if present and not a raw coordinates string
        if (typeof loc.formattedAddress === "string" && loc.formattedAddress.trim() && loc.formattedAddress !== "Select location") {
            const trimmed = loc.formattedAddress.trim()
            const isCoords = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(trimmed)
            if (!isCoords) return trimmed
        }

        // 3) Build from structured location parts
        const parts = []
        if (loc.addressLine1 && loc.addressLine1.trim()) parts.push(loc.addressLine1.trim())
        if (loc.addressLine2 && loc.addressLine2.trim()) parts.push(loc.addressLine2.trim())
        if (loc.area && loc.area.trim()) parts.push(loc.area.trim())
        if (loc.city && loc.city.trim()) parts.push(loc.city.trim())
        if (loc.state && loc.state.trim()) parts.push(loc.state.trim())
        const pin = loc.pincode || loc.zipCode || loc.postalCode
        if (pin && String(pin).trim()) parts.push(String(pin).trim())
        if (parts.length > 0) return parts.join(", ")

        // 4) Fallback to generic address fields
        if (loc.address && loc.address.trim()) return loc.address.trim()
        if (restaurant.address && restaurant.address.trim()) return restaurant.address.trim()

        return ""
    }

    // Helper values (dynamic from API)
    const dc = restaurant.diningConfig
    const coverImage = dc?.coverImage?.url || restaurant.coverImage || restaurant.profileImage?.url || restaurant.logo || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop"
    const displayName = dc?.basicDetails?.name || restaurant.name
    const displayAddress = buildFullAddress()
    const displayCostForTwo = dc?.basicDetails?.costForTwo ?? restaurant.costForTwo
    const displayOpening = dc?.basicDetails?.openingTime || restaurant.deliveryTimings?.openingTime || "12:00"
    const displayClosing = dc?.basicDetails?.closingTime || restaurant.deliveryTimings?.closingTime || "23:59"
    const formattedDistance = "2.4 km away" // Placeholder or calc
    const rating = restaurant.rating ?? restaurant.avgRating ?? restaurant.averageRating ?? null
    const ratingDisplay = rating != null && rating > 0 ? Number(rating).toFixed(1) : "—"
    const reviewsCount = restaurant.totalRatings ?? restaurant.reviewCount ?? restaurant.reviewsCount ?? 0
    const reviewsEnabled = dc?.pageControls?.reviewsEnabled !== false
    const shareEnabled = dc?.pageControls?.shareEnabled !== false
    const reviewsLabel = reviewsCount > 0 ? `${reviewsCount} Reviews` : "No reviews yet"
    const isOpen = dc?.basicDetails?.isOpen !== undefined ? dc.basicDetails.isOpen : (restaurant.isAcceptingOrders !== false)

    // Max guests for booking:
    // - Admin sets an upper limit (restaurant.diningSettings.maxGuests)
    // - Restaurant chooses seatingCapacity within that range in Dining Management
    // - For users, we show the restaurant's seatingCapacity but never above the admin limit
    const adminMaxGuests = restaurant.diningSettings?.maxGuests ?? null
    const restaurantCapacity = dc?.seatingCapacity ?? null
    let maxGuests = restaurantCapacity ?? adminMaxGuests ?? 6
    if (adminMaxGuests != null && maxGuests > adminMaxGuests) {
        maxGuests = adminMaxGuests
    }

    const restaurantPhone = restaurant.phone || restaurant.primaryContactNumber || ""
    const addressForMaps = displayAddress || ""

    if (dc?.enabled === false || (restaurant.diningSettings && restaurant.diningSettings.isEnabled === false)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 text-center">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                    <UtensilsCrossed className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Dining Unavailable</h2>
                <p className="text-slate-600 mb-6">Dining is currently unavailable for this restaurant.</p>
                <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white pb-20 relative">
            {/* Sticky Header / Back Button */}
            <div className="fixed top-0 left-0 w-full z-50 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white pointer-events-auto hover:bg-black/60 transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>

                <div className="flex gap-3 pointer-events-auto">
                    <button
                        onClick={() => {
                            if (!restaurant) return
                            if (isFav) {
                                removeFavorite(slug)
                                toast.success("Removed from favorites")
                            } else {
                                addFavorite({
                                    slug,
                                    name: displayName,
                                    cuisine: restaurant.cuisine || "Multi-cuisine",
                                    rating: ratingDisplay,
                                    price: displayCostForTwo ? `₹${displayCostForTwo} for two` : "₹1400 for two",
                                    image: coverImage
                                })
                                toast.success("Added to favorites!")
                            }
                        }}
                        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                    >
                        <Bookmark className={`w-5 h-5 ${isFav ? "fill-white" : ""}`} />
                    </button>
                    {shareEnabled && (
                        <button
                            type="button"
                            onClick={handleShareClick}
                            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                        >
                            <Share2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Hero Section */}
            <div className="relative h-[45vh] w-full">
                <img
                    src={coverImage}
                    alt={displayName}
                    className="w-full h-full object-cover"
                />
                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 w-full p-5 text-white">
                    <h1 className="text-3xl font-bold mb-1">{displayName}</h1>
                    <p className="text-sm text-gray-300 line-clamp-2 max-w-[90%] mb-2">
                        {displayAddress || "Location not available"}
                    </p>

                    <div className="flex items-center gap-3 text-sm font-medium mb-3">
                        <span>{formattedDistance}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                        <span>{displayCostForTwo ? `₹${displayCostForTwo} for two` : "₹1400 for two"}</span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {isOpen ? (
                                <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold uppercase tracking-wide">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Open now | {displayOpening} to {displayClosing}</span>
                                </div>
                            ) : (
                                <div className="text-red-400 text-xs font-semibold">Closed</div>
                            )}
                        </div>

                        {reviewsEnabled && (
                            <div className="flex flex-col items-center bg-[#671E1F]/90 backdrop-blur-sm rounded-lg px-2 py-1">
                                <div className="flex items-center gap-1 text-white font-bold text-lg leading-none">
                                    {ratingDisplay} {rating != null && rating > 0 && <Star className="w-3 h-3 fill-current" />}
                                </div>
                                <span className="text-[10px] text-white/90">{reviewsLabel}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons Bar */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 gap-3">
                <Button
                    variant="outline"
                    onClick={() => setIsBookingOpen(true)}
                    className="flex-1 border-gray-200 h-10 text-[#671E1F] hover:text-[#218a56] hover:bg-[#671E1F]/10 font-medium rounded-full"
                >
                    <UtensilsCrossed className="w-4 h-4 mr-2" />
                    Book a table
                </Button>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            if (addressForMaps) {
                                const encoded = encodeURIComponent(addressForMaps)
                                window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, "_blank")
                            }
                        }}
                        className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-[#671E1F] hover:bg-[#671E1F]/10"
                    >
                        <Navigation className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (restaurantPhone) {
                                const digits = restaurantPhone.replace(/\D/g, "").slice(-10)
                                window.location.href = `tel:${digits}`
                            }
                        }}
                        className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-[#671E1F] hover:bg-[#671E1F]/10"
                    >
                        <Phone className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Offer Banner - configurable cashback text */}
            <div className="px-4 py-4">
                <div className="bg-[#FFF8E8] border border-[#F5D8A0] rounded-xl p-4 relative overflow-hidden">
                    <div className="flex flex-col items-center justify-center text-center z-10 relative">
                        <span className="text-2xl font-black text-[#2D2D2D] tracking-tight">Book your table</span>
                        <span className="text-sm font-medium text-gray-700 mt-1">Reserve through Tifunbox for a smooth dining experience</span>
                    </div>

                    {/* Decorative Elements */}
                    <div className="absolute top-0 left-0 w-8 h-8 bg-purple-500/20 -rotate-45 transform -translate-x-4 -translate-y-4"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 bg-red-500/20 rotate-45 transform translate-x-4 translate-y-4"></div>
                </div>
            </div>

            {/* Tabs */}
            <div className="sticky top-0 bg-white z-40 border-b border-gray-100 shadow-sm">
                <div className="flex overflow-x-auto no-scrollbar py-1 px-4 gap-6">
                    {["Pre-book offers", "Walk-in offers", "Menu", "Photos", "Reviews", "About"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`whitespace-nowrap py-3 text-sm font-medium transition-colors relative ${activeTab === tab ? "text-[#671E1F]" : "text-gray-500 hover:text-gray-800"
                                }`}
                        >
                            {tab}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#671E1F] rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="p-4 min-h-[300px]">
                <h3 className="font-bold text-lg mb-2">{activeTab}</h3>

                {activeTab === "Pre-book offers" && (
                    <div className="space-y-3">
                        {diningOffers.filter((o) => o.type === "prebook").length > 0 ? (
                            diningOffers.filter((o) => o.type === "prebook").map((offer) => (
                                <div key={offer._id} className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 p-4">
                                    <p className="font-medium text-gray-900">{offer.title}</p>
                                    {offer.description && <p className="text-sm text-gray-600 mt-1">{offer.description}</p>}
                                    <p className="text-sm text-[#671E1F] font-medium mt-2">
                                        {offer.discountType === "percentage" ? `${offer.discountValue}% off` : `₹${offer.discountValue} off`}
                                    </p>
                                    {offer.validFrom && offer.validTo && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Valid {new Date(offer.validFrom).toLocaleDateString()} – {new Date(offer.validTo).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <>
                                <p className="text-gray-600 text-sm">Pre-book your table to enjoy dining offers and a seamless experience.</p>
                                <div className="bg-[#F0FDF4] border border-[#671E1F]/30 rounded-xl p-4 mt-2">
                                    <p className="text-sm font-medium text-[#671E1F]">Reserve through Tifunbox for a smooth dining experience.</p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === "Walk-in offers" && (
                    <div className="space-y-3">
                        {diningOffers.filter((o) => o.type === "walkin").length > 0 ? (
                            diningOffers.filter((o) => o.type === "walkin").map((offer) => (
                                <div key={offer._id} className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 p-4">
                                    <p className="font-medium text-gray-900">{offer.title}</p>
                                    {offer.description && <p className="text-sm text-gray-600 mt-1">{offer.description}</p>}
                                    <p className="text-sm text-[#671E1F] font-medium mt-2">
                                        {offer.discountType === "percentage" ? `${offer.discountValue}% off` : `₹${offer.discountValue} off`}
                                    </p>
                                    {offer.validFrom && offer.validTo && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Valid {new Date(offer.validFrom).toLocaleDateString()} – {new Date(offer.validTo).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600 text-sm">Walk-in offers may be available at the restaurant. Ask the staff for current promotions.</p>
                        )}
                    </div>
                )}

                {activeTab === "Menu" && (
                    <div className="space-y-4">
                        <p className="text-gray-600 text-sm">View the full menu when you dine. You can also order for delivery from this restaurant.</p>
                        {diningMenu?.sections?.length > 0 ? (
                            <div className="space-y-6">
                                {diningMenu.sections.map((sec, secIdx) => (
                                    <div key={sec.id || sec.name || secIdx}>
                                        <h4 className="font-semibold text-gray-900 mb-3">{sec.name}</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {(sec.items || []).map((item, idx) => {
                                                const img = item.image || item.images?.[0]
                                                return (
                                                    <div key={item.id || idx} className="rounded-xl border border-gray-100 overflow-hidden bg-white">
                                                        {img ? <img src={img} alt={item.name} className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-xs">No image</div>}
                                                        <div className="p-3">
                                                            <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                                                            <p className="text-[#671E1F] font-semibold mt-1">₹{(item.dineInPrice ?? item.price) ?? "—"}</p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {(sec.subsections || []).flatMap((sub, subIdx) => (sub.items || []).map((item, idx) => {
                                                const img = item.image || item.images?.[0]
                                                return (
                                                    <div key={`${sub.id || subIdx}-${item.id || idx}`} className="rounded-xl border border-gray-100 overflow-hidden bg-white">
                                                        {img ? <img src={img} alt={item.name} className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-xs">No image</div>}
                                                        <div className="p-3">
                                                            <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                                                            <p className="text-[#671E1F] font-semibold mt-1">₹{(item.dineInPrice ?? item.price) ?? "—"}</p>
                                                        </div>
                                                    </div>
                                                )
                                            }))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">Menu</div>
                                <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">Specials</div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "Photos" && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            {(coverImage ? [coverImage] : []).map((src, i) => (
                                <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-xl" />
                            ))}
                            {restaurant.profileImage?.url && (
                                <img src={restaurant.profileImage.url} alt="" className="w-full aspect-square object-cover rounded-xl" />
                            )}
                        </div>
                        {!coverImage && !restaurant.profileImage?.url && (
                            <p className="text-gray-600 text-sm">Photos will be added soon.</p>
                        )}
                    </div>
                )}

                {activeTab === "Reviews" && (
                    <div className="space-y-3">
                        <p className="text-gray-600 text-sm">{reviewsLabel}. Customer reviews from diners will appear here after their visit.</p>
                        {reviewsCount === 0 && (
                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 text-center">
                                <p className="text-gray-500 text-sm font-medium">No reviews yet</p>
                                <p className="text-gray-400 text-xs mt-1">Be the first to share your experience after dining here.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "About" && (
                    <div className="text-gray-600 text-sm space-y-4">
                        {(dc?.basicDetails?.description || restaurant.description) ? (
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{dc?.basicDetails?.description || restaurant.description}</p>
                        ) : (
                            <p className="text-gray-500">No description added yet.</p>
                        )}
                        <div className="border-t border-gray-100 pt-4 space-y-2">
                            <p className="font-medium text-gray-900">{displayName}</p>
                            {addressForMaps && <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-[#671E1F] flex-shrink-0 mt-0.5" /><span>{addressForMaps}</span></p>}
                            <p className="text-gray-500 text-xs">Open {displayOpening} – {displayClosing}{displayCostForTwo ? ` · ₹${displayCostForTwo} for two` : ""}</p>
                        </div>
                    </div>
                )}

                {!["Pre-book offers", "Walk-in offers", "Menu", "Photos", "Reviews", "About"].includes(activeTab) && (
                    <p className="text-gray-500 text-sm">Content for {activeTab} will be displayed here.</p>
                )}
            </div>

            {/* Sticky Booking Footer */}
            {(!restaurant.diningSettings || restaurant.diningSettings.isEnabled) ? (
                <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50 flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setIsBookingOpen(true)}
                        className="flex-1 h-12 rounded-xl text-[#671E1F] border-[#671E1F] hover:bg-[#671E1F]/10 font-bold"
                    >
                        Book a table
                    </Button>
                </div>
            ) : (
                <div className="fixed bottom-0 left-0 w-full bg-slate-100 border-t border-gray-200 p-4 z-50 text-center">
                    <p className="text-gray-500 font-medium">Dining is currently unavailable for this restaurant.</p>
                </div>
            )}

            {/* Booking Dialog */}
            {isBookingOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={() => setIsBookingOpen(false)} />

                    {/* Modal Panel */}
                    <div className="relative w-full sm:w-[400px] bg-white rounded-t-2xl sm:rounded-2xl p-6 pointer-events-auto animate-in slide-in-from-bottom-5">
                        <h3 className="text-xl font-bold mb-4">Book a Table</h3>

                        <div className="space-y-4">
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700 block">Number of Guests</label>

                                {/* Manual Input */}
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGuests}
                                        value={selectedGuests}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value)
                                            if (!isNaN(val)) {
                                                const max = maxGuests
                                                if (val > max) setSelectedGuests(max)
                                                else if (val < 1) setSelectedGuests(1)
                                                else setSelectedGuests(val)
                                            } else {
                                                setSelectedGuests("")
                                            }
                                        }}
                                        onBlur={(e) => {
                                            if (!selectedGuests || selectedGuests < 1) setSelectedGuests(1)
                                        }}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#671E1F] focus:ring-1 focus:ring-[#671E1F] transition-all text-lg font-semibold text-center"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
                                        Guests
                                    </span>
                                </div>

                                {/* Scrollable Guest Options */}
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                    {Array.from({ length: maxGuests }, (_, i) => i + 1).map(num => (
                                        <button
                                            key={num}
                                            onClick={() => setSelectedGuests(num)}
                                            className={`min-w-[40px] h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all flex-shrink-0 ${selectedGuests === num
                                                ? "bg-[#671E1F] text-white shadow-md transform scale-105"
                                                : "bg-white border border-gray-200 text-gray-600 hover:border-[#671E1F]/30 hover:bg-[#671E1F]/10"
                                                }`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button
                                onClick={() => {
                                    setIsBookingOpen(false)
                                    navigate(`/dining/book/${slug}`, { state: { guestCount: selectedGuests } })
                                }}
                                className="w-full bg-[#671E1F] hover:bg-[#218a56] text-white font-bold h-12 rounded-xl"
                            >
                                Confirm Booking
                            </Button>
                        </div>

                        <button
                            onClick={() => setIsBookingOpen(false)}
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
                        >
                            <span className="sr-only">Close</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
