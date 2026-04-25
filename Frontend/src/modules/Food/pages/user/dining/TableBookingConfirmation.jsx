import { useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Calendar, Users, MapPin, Ticket, ChevronRight, Edit2, ShieldCheck, Info, X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { diningAPI, authAPI } from "@food/api"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import { useEffect } from "react"
import { toast } from "sonner"
import Loader from "@food/components/Loader"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const BOOKING_DRAFT_KEY = "food_dining_booking_draft_v1"

export default function TableBookingConfirmation() {
  const location = useLocation()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
    const fallbackDraft = useMemo(() => {
        try {
            const raw = sessionStorage.getItem(BOOKING_DRAFT_KEY)
            return raw ? JSON.parse(raw) : null
        } catch {
            return null
        }
    }, [])
    const resolvedState = location.state || fallbackDraft || {}
    const { restaurant, guests, date, timeSlot, discount } = resolvedState

    const [specialRequest, setSpecialRequest] = useState("")
    const [showRequestModal, setShowRequestModal] = useState(false)
    const [showUserModal, setShowUserModal] = useState(false)
    const [showPolicyModal, setShowPolicyModal] = useState(false)
    const [policyType, setPolicyType] = useState("") // 'modification' or 'cancellation'
    const [tempRequest, setTempRequest] = useState("")
    const [tempUser, setTempUser] = useState({ name: "", phone: "" })
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [bookingInProgress, setBookingInProgress] = useState(false)

    useEffect(() => {
        if (!restaurant) {
            navigate("/food/user/dining")
            return
        }

        const fetchUser = async () => {
            try {
                const response = await authAPI.getCurrentUser()
                if (response.data.success) {
                    const userData =
                        response?.data?.data?.user ||
                        response?.data?.data ||
                        response?.data?.user ||
                        null
                    setUser(userData)
                }
            } catch (error) {
                debugError("Error fetching user:", error)
                // If not logged in, navigate to sign-in but the ProtectedRoute should handle this
            } finally {
                setLoading(false)
            }
        }
        fetchUser()
    }, [restaurant, navigate])

    const handleBooking = async () => {
        try {
            setBookingInProgress(true)
            const restaurantId =
                restaurant?._id ||
                restaurant?.id ||
                restaurant?.restaurant?._id ||
                restaurant?.restaurant?.id ||
                restaurant?.restaurantId ||
                null

            if (!restaurantId) {
                toast.error("Unable to proceed. Restaurant ID is missing.")
                return
            }

            const response = await diningAPI.createBooking({
                restaurant: restaurantId,
                restaurantRef: restaurant,
                userRef: user,
                guests,
                date,
                timeSlot,
                specialRequest
            })

            if (response.data.success) {
                toast.success("Table booked successfully!")
                try {
                    sessionStorage.removeItem(BOOKING_DRAFT_KEY)
                } catch {}
                // Navigate to success page with booking details
                navigate("/food/user/dining/book-success", { state: { booking: response.data.data } })
            }
        } catch (error) {
            debugError("Booking error:", error)
            toast.error(error.response?.data?.message || "Failed to confirm booking")
        } finally {
            setBookingInProgress(false)
        }
    }

    if (loading) return <Loader />

    const bookingDate = new Date(date)
    const formattedDate = Number.isNaN(bookingDate.getTime())
        ? "Today"
        : bookingDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

    return (
        <AnimatedPage className="bg-slate-50 dark:bg-slate-950 min-h-screen pb-24 transition-colors">
            {/* Header */}
            <div className="bg-[#7e3866] text-white px-4 py-4 sticky top-0 z-50 shadow-md">
                <div className="flex items-center gap-3">
                    <button onClick={goBack} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <p className="font-semibold text-sm">Reach the restaurant 15 minutes before your booking time for a hassle-free experience</p>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Booking Summary Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-[#F9F9FB] dark:bg-slate-800 p-2 rounded-xl">
                                <Calendar className="w-5 h-5 text-[#7e3866]" />
                            </div>
                             <div>
                                <p className="font-bold text-gray-900 dark:text-slate-100">{formattedDate} at {timeSlot}</p>
                                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 text-sm mt-0.5">
                                    <Users className="w-4 h-4" />
                                    <span>{guests} guests</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 pt-4 border-t border-dashed border-slate-100 dark:border-slate-800">
                            <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded-xl">
                                <MapPin className="w-5 h-5 text-red-500" />
                            </div>
                             <div>
                                <p className="font-bold text-gray-900 dark:text-slate-100">{restaurant.name}</p>
                                <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5 line-clamp-1">
                                    {typeof restaurant.location === 'string'
                                        ? restaurant.location
                                        : (restaurant.location?.formattedAddress || restaurant.location?.address || `${restaurant.location?.city || ''}${restaurant.location?.area ? ', ' + restaurant.location.area : ''}`)}
                                </p>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Special Request */}
                <button 
                    onClick={() => {
                        setTempRequest(specialRequest)
                        setShowRequestModal(true)
                    }}
                    className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between group transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl transition-colors ${specialRequest ? 'bg-purple-50 dark:bg-purple-950/30' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}>
                            <Info className={`w-5 h-5 ${specialRequest ? 'text-[#7e3866]' : 'text-slate-600 dark:text-slate-400'}`} />
                        </div>
                        <div className="text-left">
                            <span className="font-bold text-gray-700 dark:text-slate-200 block">
                                {specialRequest ? 'Special Request Added' : 'Add special request'}
                            </span>
                            {specialRequest && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 line-clamp-1">{specialRequest}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {specialRequest && (
                            <span className="text-[10px] font-black text-[#7e3866]/40 uppercase tracking-widest">Edit</span>
                        )}
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                </button>

                {/* Preferences Section */}
                <div className="pt-4">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Guest Preferences</span>
                        <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                    </div>

                    <div className="space-y-2">
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                // Dynamic path based on restaurant slug as requested
                                const targetSlug = restaurant?.slug || restaurant?._id || restaurant?.id || 'restaurant';
                                navigate(`/food/user/dining/book/${targetSlug}`, { 
                                    state: { 
                                        restaurant, 
                                        guests, 
                                        date, 
                                        timeSlot, 
                                        discount,
                                        isModifying: true 
                                    } 
                                });
                            }}
                             className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between active:scale-[0.98] transition-all"
                        >
                            <div className="flex items-start gap-3">
                                <div className="text-[#7e3866] dark:text-purple-400 mt-1">
                                    <Edit2 className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-gray-800 dark:text-slate-100 text-sm">Modification available</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">Valid till {timeSlot}, today</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                        </button>

                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                navigate("/food/user/profile/cancellation", { 
                                    state: { 
                                        returnTo: "/food/user/dining/book-confirmation",
                                        originalState: { restaurant, guests, date, timeSlot, discount, specialRequest, user }
                                    } 
                                });
                            }}
                             className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between active:scale-[0.98] transition-all"
                        >
                            <div className="flex items-start gap-3">
                                <div className="text-red-400 mt-1">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-gray-800 dark:text-slate-100 text-sm">Cancellation available</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">Valid till {timeSlot}, today</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                        </button>
                    </div>
                </div>

                {/* Details Section */}
                <div className="pt-4 space-y-3">
                    <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] relative">
                        <span className="bg-[#f8f9fa] dark:bg-slate-950 px-4 z-10 relative">Your Details</span>
                        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-200 dark:bg-slate-800 -z-0"></div>
                    </p>
                     <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between transition-colors">
                        <div className="text-left">
                            <p className="font-bold text-gray-900 dark:text-slate-100">{user?.name || "Shailu"}</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{user?.phone || user?.email || "8090512291"}</p>
                        </div>
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                navigate("/food/user/dining/edit-user", {
                                    state: { restaurant, guests, date, timeSlot, discount, specialRequest, user }
                                });
                            }}
                            className="text-red-500 text-sm font-bold hover:underline"
                        >
                            Edit
                        </button>
                    </div>
                </div>

                {/* Terms and Conditions */}
                <div className="pt-4">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Terms and Conditions</span>
                        <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                    </div>

                     <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
                        <ul className="space-y-4">
                            {[
                                "Please arrive 15 minutes prior to your reservation time.",
                                "Booking valid for the specified number of guests entered during reservation",
                                "Cover charges upon entry are subject to the discretion of the restaurant",
                                "House rules are to be observed at all times",
                                "Special requests will be accommodated at the restaurant's discretion",
                                "Cover charges cannot be refunded if slot is cancelled within 30 minutes of slot start time",
                                "Additional service charges on the bill are at the restaurant's discretion"
                            ].map((term, i) => (
                                 <li key={i} className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-2 flex-shrink-0"></div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{term}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

             {/* Sticky Action Button */}
            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50 transition-colors">
                <Button
                    onClick={handleBooking}
                    disabled={bookingInProgress}
                    className="w-full h-14 bg-[#ef4444] hover:bg-red-600 text-white font-bold text-lg rounded-2xl shadow-xl shadow-red-200 transition-all active:scale-[0.98]"
                >
                    {bookingInProgress ? "Confirming..." : "Confirm your seat"}
                </Button>
            </div>
            {/* Special Request Modal Overlay */}
            {showRequestModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div 
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
                        onClick={() => setShowRequestModal(false)}
                    />
                    <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 overflow-hidden animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Special Request</h3>
                            <button 
                                onClick={() => setShowRequestModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"
                            >
                                <ArrowLeft className="w-4 h-4 rotate-90" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                                Let the restaurant know if you have any allergies or special requirements (e.g. Birthday, Anniversary).
                            </p>
                            
                            <textarea
                                value={tempRequest}
                                onChange={(e) => setTempRequest(e.target.value)}
                                placeholder="E.g. I have a peanut allergy, or we are celebrating a birthday..."
                                className="w-full h-32 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#7e3866]/20 focus:border-[#7e3866] transition-all resize-none"
                                autoFocus
                            />

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button 
                                    onClick={() => setShowRequestModal(false)}
                                    className="h-12 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm uppercase tracking-widest active:scale-95 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => {
                                        setSpecialRequest(tempRequest)
                                        setShowRequestModal(false)
                                    }}
                                    className="h-12 rounded-xl bg-[#7e3866] text-white font-bold text-sm uppercase tracking-widest shadow-lg shadow-purple-200 active:scale-95 transition-all"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Policy Modal Overlay */}
            {showPolicyModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPolicyModal(false)} />
                    <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 overflow-hidden animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                                {policyType === 'cancellation' ? 'Cancellation Policy' : 'Modification Policy'}
                            </h3>
                            <button onClick={() => setShowPolicyModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 py-2">
                            <div className="flex gap-4 p-4 rounded-2xl bg-orange-50 border border-orange-100">
                                <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                                <div className="text-sm font-medium text-orange-800">
                                    {policyType === 'cancellation' 
                                        ? `You can cancel your booking until ${timeSlot} today without any charges.` 
                                        : `You can modify your booking details until ${timeSlot} today for free.`}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Detailed Terms</p>
                                <ul className="space-y-2">
                                    {[
                                        "Refunds (if any) will be processed within 5-7 business days.",
                                        "Modifications are subject to table availability at the chosen restaurant.",
                                        "Frequent cancellations might lead to temporary booking restrictions.",
                                        "Partial refunds are not applicable for no-shows."
                                    ].map((term, i) => (
                                        <li key={i} className="flex gap-2 text-xs text-slate-600 font-medium">
                                            <div className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                                            {term}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShowPolicyModal(false)}
                            className="w-full mt-6 h-12 rounded-xl bg-slate-900 text-white font-bold text-sm uppercase tracking-widest active:scale-95 transition-all"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}

            {/* Edit User Modal Overlay */}
            {showUserModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowUserModal(false)} />
                    <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 overflow-hidden animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Edit Your Details</h3>
                            <button onClick={() => setShowUserModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name</label>
                                <input 
                                    type="text"
                                    value={tempUser.name}
                                    onChange={(e) => setTempUser({ ...tempUser, name: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-100 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all"
                                    placeholder="Enter your name"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Phone Number</label>
                                <input 
                                    type="tel"
                                    value={tempUser.phone}
                                    onChange={(e) => setTempUser({ ...tempUser, phone: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-100 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all"
                                    placeholder="Enter phone number"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <button onClick={() => setShowUserModal(false)} className="h-12 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
                                <button 
                                    onClick={() => {
                                        setUser({ ...user, name: tempUser.name, phone: tempUser.phone })
                                        setShowUserModal(false)
                                    }}
                                    className="h-12 rounded-xl bg-red-500 text-white font-bold text-sm uppercase tracking-widest shadow-lg shadow-red-200 active:scale-95 transition-all"
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AnimatedPage>
    )
}

