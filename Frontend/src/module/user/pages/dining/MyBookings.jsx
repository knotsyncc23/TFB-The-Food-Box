import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { ArrowLeft, Calendar, Clock, Users, MapPin, ChevronRight, Utensils, Star, X, Share2, Receipt, Loader2 } from "lucide-react"
import { diningAPI } from "@/lib/api"
import Loader from "@/components/Loader"
import AnimatedPage from "../../components/AnimatedPage"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { initRazorpayPayment } from "@/lib/utils/razorpay"
import { getCompanyNameAsync } from "@/lib/utils/businessSettings"
import { shareContent } from "@/lib/utils/share"

function BookingDetailsModal({ booking, onClose, onBookingUpdate }) {
    const [shared, setShared] = useState(false)
    const [couponCode, setCouponCode] = useState("")
    const [applyingCoupon, setApplyingCoupon] = useState(false)
    const [paymentLoading, setPaymentLoading] = useState(false)
    const formattedDate = booking?.date
        ? new Date(booking.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
        : "—"
    const locationText = typeof booking?.restaurant?.location === 'string'
        ? booking.restaurant.location
        : (booking?.restaurant?.location?.formattedAddress || booking?.restaurant?.location?.address ||
            `${booking?.restaurant?.location?.city || ''}${booking?.restaurant?.location?.area ? ', ' + booking?.restaurant?.location?.area : ''}`) || "—"
    const img = booking?.restaurant?.image || booking?.restaurant?.profileImage?.url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80"

    const handleShare = async () => {
        const text = `Table booked at ${booking?.restaurant?.name} – ${formattedDate} at ${booking?.timeSlot}, ${booking?.guests} guests. ID: ${booking?.bookingId || booking?._id}`
        try {
            const result = await shareContent({ title: "Booking details", text })
            if (result.method !== "cancelled") {
                setShared(true)
                setTimeout(() => setShared(false), 2000)
            }
        } catch (e) { /* ignore */ }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
        >
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
            >
                <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between rounded-t-3xl">
                    <h2 className="text-lg font-bold text-slate-900">Booking details</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                        <img src={img} alt="" className="w-16 h-16 rounded-xl object-cover bg-slate-100" />
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900">{booking?.restaurant?.name || "Restaurant"}</p>
                            <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{locationText}</span>
                            </p>
                        </div>
                        <button
                            onClick={handleShare}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
                            aria-label="Share"
                        >
                            {shared ? <span className="text-xs text-[#671E1F] font-medium">Shared</span> : <Share2 className="w-4 h-4" />}
                        </button>
                    </div>

                    <p className="text-xs font-mono text-slate-500">Booking ID: #{booking?.bookingId || booking?._id?.slice(-8)}</p>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Date</p>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                {formattedDate}
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Time</p>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-500" />
                                {booking?.timeSlot || "—"}
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Guests</p>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-500" />
                                {booking?.guests ?? "—"} guests
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Status</p>
                            <p className="mt-0.5">
                                <Badge className={`${booking?.status === 'confirmed' ? 'bg-red-100 text-red-700' :
                                    booking?.status === 'checked-in' ? 'bg-orange-100 text-orange-700' :
                                        booking?.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                            booking?.status === 'dining_completed' ? 'bg-violet-100 text-violet-700' :
                                                'bg-slate-100 text-slate-700'
                                    }`}>
                                    {booking?.status?.replace?.('_', ' ') || "—"}
                                </Badge>
                            </p>
                        </div>
                    </div>

                    {/* Bill & Payment section – when bill is pending */}
                    {booking?.billStatus === "pending" && (
                        <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-4">
                            <div className="flex items-center gap-2 text-slate-800 font-bold">
                                <Receipt className="w-5 h-5" />
                                Bill & Payment
                            </div>
                            {booking?.paymentStatus === "paid" ? (
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-medium text-red-700">Paid ₹{(booking?.finalAmount ?? 0).toFixed(2)}</p>
                                    {booking?.paidAt && (
                                        <p className="text-xs text-slate-500">Paid on {new Date(booking.paidAt).toLocaleString()}</p>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Bill amount</span>
                                        <span className="font-semibold">₹{(booking?.billAmount ?? 0).toFixed(2)}</span>
                                    </div>
                                    {booking?.discountAmount > 0 && (
                                        <div className="flex justify-between text-sm text-red-600">
                                            <span>Discount</span>
                                            <span>- ₹{(booking?.discountAmount ?? 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
                                        <span>Payable</span>
                                        <span>₹{(booking?.finalAmount ?? booking?.billAmount ?? 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <input
                                            type="text"
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value.trim().toUpperCase())}
                                            placeholder="Coupon code"
                                            className="flex-1 min-w-[120px] px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                                if (!couponCode.trim()) {
                                                    toast.error("Enter a coupon code")
                                                    return
                                                }
                                                setApplyingCoupon(true)
                                                try {
                                                    const res = await diningAPI.applyCoupon(booking._id, couponCode.trim())
                                                    if (res.data.success && res.data.data) {
                                                        const d = res.data.data
                                                        onBookingUpdate?.({ ...booking, discountAmount: d.discountAmount, finalAmount: d.finalAmount, billAmount: d.billAmount })
                                                        toast.success("Coupon applied")
                                                    }
                                                } catch (err) {
                                                    toast.error(err.response?.data?.message || "Invalid or expired coupon")
                                                } finally {
                                                    setApplyingCoupon(false)
                                                }
                                            }}
                                            disabled={applyingCoupon}
                                            className="shrink-0"
                                        >
                                            {applyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                                        </Button>
                                    </div>
                                    <Button
                                        className="w-full bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl"
                                        disabled={paymentLoading || (booking?.finalAmount ?? 0) <= 0}
                                        onClick={async () => {
                                            setPaymentLoading(true)
                                            try {
                                                const orderRes = await diningAPI.createDiningPaymentOrder(booking._id)
                                                const data = orderRes.data?.data
                                                if (!data?.orderId || !data?.key_id) {
                                                    toast.error("Payment could not be started")
                                                    setPaymentLoading(false)
                                                    return
                                                }
                                                onClose?.()
                                                const companyName = await getCompanyNameAsync().catch(() => "Tifunbox")
                                                await initRazorpayPayment({
                                                    key: data.key_id,
                                                    amount: data.amount,
                                                    currency: data.currency || "INR",
                                                    order_id: data.orderId,
                                                    name: companyName,
                                                    description: `Dining bill – ₹${(data.finalAmount ?? 0).toFixed(2)}`,
                                                    handler: async (response) => {
                                                        try {
                                                            const verifyRes = await diningAPI.verifyDiningPayment(booking._id, {
                                                                razorpay_order_id: response.razorpay_order_id,
                                                                razorpay_payment_id: response.razorpay_payment_id,
                                                                razorpay_signature: response.razorpay_signature,
                                                            })
                                                            if (verifyRes.data.success) {
                                                                onBookingUpdate?.({
                                                                    ...booking,
                                                                    paymentStatus: "paid",
                                                                    billStatus: "completed",
                                                                    paidAt: new Date().toISOString(),
                                                                    finalAmount: verifyRes.data.data?.finalAmount ?? booking.finalAmount,
                                                                })
                                                                toast.success("Payment successful")
                                                            }
                                                        } catch (e) {
                                                            toast.error(e.response?.data?.message || "Payment verification failed")
                                                        }
                                                    },
                                                    onError: (err) => {
                                                        toast.error(err?.description || "Payment failed")
                                                    },
                                                })
                                            } catch (err) {
                                                toast.error(err.response?.data?.message || "Could not start payment")
                                            } finally {
                                                setPaymentLoading(false)
                                            }
                                        }}
                                    >
                                        {paymentLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Processing…
                                            </>
                                        ) : (
                                            "Pay ₹" + (booking?.finalAmount ?? 0).toFixed(2)
                                        )}
                                    </Button>
                                </>
                            )}
                        </div>
                    )}

                    {booking?.specialRequest && (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                            <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Special request</p>
                            <p className="text-sm text-slate-700 mt-1">{booking.specialRequest}</p>
                        </div>
                    )}

                    <p className="text-xs text-slate-400 text-center pt-2">Show this at the restaurant for entry</p>
                </div>
            </motion.div>
        </motion.div>
    )
}

function ReviewModal({ booking, onClose, onSubmit }) {
    const [rating, setRating] = useState(5)
    const [comment, setComment] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!comment.trim()) {
            toast.error("Please add a comment")
            return
        }
        setSubmitting(true)
        await onSubmit({ bookingId: booking._id, rating, comment })
        setSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900">Review your experience</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-col items-center">
                        <p className="text-sm font-medium text-slate-500 mb-3">How was your visit to {booking.restaurant?.name}?</p>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className="p-1 transition-transform active:scale-90"
                                >
                                    <Star
                                        className={`w-10 h-10 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-slate-200"
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Share your feedback</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Write about the food, service, and atmosphere..."
                            className="w-full h-32 p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all text-sm resize-none"
                        />
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-bold h-12 rounded-2xl shadow-lg shadow-red-200"
                    >
                        {submitting ? "Submitting..." : "Submit Review"}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default function MyBookings() {
    const navigate = useNavigate()
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedBooking, setSelectedBooking] = useState(null)
    const [detailsBooking, setDetailsBooking] = useState(null)

    useEffect(() => {
        const fetchBookings = async () => {
            try {
                const response = await diningAPI.getBookings()
                if (response.data.success) {
                    setBookings(response.data.data)
                }
            } catch (error) {
                console.error("Error fetching bookings:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchBookings()
    }, [])

    const handleReviewSubmit = async (reviewData) => {
        try {
            const response = await diningAPI.createReview(reviewData)
            if (response.data.success) {
                toast.success("Review submitted! Thank you for your feedback.")
                // Update booking list to mark it as reviewed if we had a reviewed flag
                // For now just close the modal
                setSelectedBooking(null)
            }
        } catch (error) {
            console.error("Error submitting review:", error)
            toast.error(error.response?.data?.message || "Failed to submit review")
        }
    }

    if (loading) return <Loader />

    return (
        <AnimatedPage className="bg-slate-50 min-h-screen pb-10">
            {/* Header */}
            <div className="bg-white p-4 flex items-center shadow-sm sticky top-0 z-10">
                <button onClick={() => navigate("/profile")}>
                    <ArrowLeft className="w-6 h-6 text-gray-700 cursor-pointer" />
                </button>
                <h1 className="ml-4 text-xl font-semibold text-gray-800">My Table Bookings</h1>
            </div>

            <div className="p-4 space-y-4">
                {bookings.length > 0 ? (
                    [...bookings].sort((a, b) => b._id.localeCompare(a._id)).map((booking) => {
                        const locationStr = typeof booking.restaurant?.location === 'string'
                            ? booking.restaurant.location
                            : (booking.restaurant?.location?.formattedAddress || booking.restaurant?.location?.address || `${booking.restaurant?.location?.city || ''}${booking.restaurant?.location?.area ? ', ' + booking.restaurant.location.area : ''}`) || ''
                        const showPayBill = booking.billStatus === "pending" && booking.paymentStatus !== "paid"
                        return (
                            <div
                                key={booking._id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setDetailsBooking(booking)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailsBooking(booking); } }}
                                className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-stretch gap-4 hover:border-slate-200 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer"
                            >
                                <div className="flex flex-1 min-w-0 gap-4">
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                                        <img
                                            src={booking.restaurant?.image || booking.restaurant?.profileImage?.url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80"}
                                            className="w-full h-full object-cover"
                                            alt={booking.restaurant?.name}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-bold text-gray-900 break-words text-sm sm:text-base">{booking.restaurant?.name || 'Restaurant'}</h3>
                                            <Badge className={`shrink-0 ${booking.status === 'confirmed' ? 'bg-red-100 text-red-700' :
                                                booking.status === 'checked-in' ? 'bg-orange-100 text-orange-700' :
                                                    booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                        booking.status === 'dining_completed' ? 'bg-violet-100 text-violet-700' :
                                                            'bg-slate-100 text-slate-700'
                                                }`}>
                                                {booking.status?.replace?.(/_/g, ' ') || booking.status}
                                            </Badge>
                                            {booking.billStatus === "pending" && booking.paymentStatus !== "paid" && (
                                                <span className="text-[10px] text-amber-600 font-medium shrink-0">Bill pending</span>
                                            )}
                                            {booking.paymentStatus === "paid" && (
                                                <span className="text-[10px] text-red-600 font-medium shrink-0">Paid</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 flex items-start gap-1 mt-1 break-words line-clamp-2">
                                            <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                            <span>{locationStr || '—'}</span>
                                        </p>

                                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3">
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                                                <Clock className="w-3 h-3" />
                                                {booking.timeSlot}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                                                <Users className="w-3 h-3" />
                                                {booking.guests} Guests
                                            </span>
                                        </div>

                                        {booking.specialRequest && (
                                            <p className="text-[10px] text-gray-500 mt-2 flex items-start gap-1">
                                                <span className="font-bold text-gray-700 shrink-0">Request:</span>
                                                <span className="italic line-clamp-2 break-words">"{booking.specialRequest}"</span>
                                            </p>
                                        )}

                                        {booking.status === 'completed' && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setDetailsBooking(null)
                                                    setSelectedBooking(booking)
                                                }}
                                                className="mt-3 w-full sm:w-auto py-2 px-4 bg-red-50 text-red-600 text-[11px] font-bold rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                                            >
                                                RATE & REVIEW
                                            </button>
                                        )}
                                    </div>
                                    <div className="hidden sm:flex items-center flex-shrink-0">
                                        <ChevronRight className="w-5 h-5 text-slate-400" />
                                    </div>
                                </div>

                                {showPayBill && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setDetailsBooking(booking)
                                        }}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl shadow-sm shrink-0"
                                    >
                                        <Receipt className="w-4 h-4" />
                                        Pay Bill {booking.finalAmount != null ? `₹${Number(booking.finalAmount).toFixed(0)}` : ''}
                                    </button>
                                )}

                                <div className="sm:hidden flex justify-end">
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="text-center py-20">
                        <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Utensils className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">No bookings yet</h3>
                        <p className="text-gray-500 text-sm mt-2">Book your favorite restaurant for a great dining experience!</p>
                        <Link to="/dining">
                            <button className="mt-6 bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-red-200">
                                Book a table
                            </button>
                        </Link>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {detailsBooking && (
                    <BookingDetailsModal
                        key={detailsBooking._id}
                        booking={detailsBooking}
                        onClose={() => setDetailsBooking(null)}
                        onBookingUpdate={(updated) => {
                            setBookings((prev) => prev.map((b) => (b._id === updated._id ? { ...b, ...updated } : b)))
                            setDetailsBooking((current) => (current?._id === updated._id ? { ...current, ...updated } : current))
                        }}
                    />
                )}
            </AnimatePresence>
            {selectedBooking && (
                <ReviewModal
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onSubmit={handleReviewSubmit}
                />
            )}
        </AnimatedPage>
    )
}
