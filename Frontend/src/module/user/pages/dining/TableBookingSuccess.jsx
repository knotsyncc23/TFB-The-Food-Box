import { useLocation, useNavigate } from "react-router-dom"
import { Check, Calendar, Clock, Users, MapPin, Share2, Home } from "lucide-react"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { shareContent } from "@/lib/utils/share"

export default function TableBookingSuccess() {
    const location = useLocation()
    const navigate = useNavigate()
    const { booking } = location.state || {}
    const [shared, setShared] = useState(false)
    const [showPopup, setShowPopup] = useState(true)

    if (!booking) {
        navigate("/dining")
        return null
    }

    const formattedDate = new Date(booking.date).toLocaleDateString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    })

    const handleShare = async () => {
        const text = `Table booked at ${booking.restaurant?.name} – ${formattedDate} at ${booking.timeSlot}, ${booking.guests} guests. ID: ${booking.bookingId}`
        try {
            const result = await shareContent({ title: "Booking confirmed", text })
            if (result.method !== "cancelled") {
                setShared(true)
                setTimeout(() => setShared(false), 2000)
            }
        } catch (e) { /* ignore */ }
    }

    useEffect(() => {
        const t = setTimeout(() => setShowPopup(false), 2500)
        return () => clearTimeout(t)
    }, [])

    const statusLabel =
        booking.status === "pending"
            ? "Pending approval"
            : booking.status === "confirmed"
                ? "Confirmed"
                : booking.status === "rejected"
                    ? "Rejected"
                    : booking.status === "cancelled"
                        ? "Cancelled"
                        : (booking.status || "Confirmed")

    const restaurantImg = booking.restaurant?.image
        || booking.restaurant?.profileImage?.url
        || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80"

    const restaurantLocation = typeof booking.restaurant?.location === 'string'
        ? booking.restaurant.location
        : (booking.restaurant?.location?.formattedAddress
            || booking.restaurant?.location?.address
            || `${booking.restaurant?.location?.city || ''}${booking.restaurant?.location?.area ? ', ' + booking.restaurant.location.area : ''}`)

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {showPopup && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
                    <div
                        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
                        onClick={() => setShowPopup(false)}
                    />
                    <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-5">
                        <p className="text-sm font-bold text-slate-900">
                            {booking.status === "pending" ? "Booking request sent" : "Booking confirmed"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                            {booking.restaurant?.name ? `Restaurant: ${booking.restaurant.name}` : "Restaurant booking created."}
                        </p>
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowPopup(false)}
                                className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex-1 w-full max-w-sm mx-auto px-5 pt-16 pb-8 flex flex-col items-center">

                {/* Success */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="w-16 h-16 rounded-full bg-[#671E1F] flex items-center justify-center mb-5"
                >
                    <Check className="w-8 h-8 text-white" strokeWidth={2.5} />
                </motion.div>
                <motion.h1
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-2xl font-bold text-slate-900 mb-1"
                >
                    Seat confirmed
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="text-sm text-slate-500 mb-6"
                >
                    #{booking.bookingId}
                </motion.p>

                {/* Card */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8"
                >
                    <div className="p-4 flex items-center gap-3 border-b border-slate-100">
                        <img
                            src={restaurantImg}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover bg-slate-100"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 truncate">{booking.restaurant?.name || "Restaurant"}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                {restaurantLocation || "—"}
                            </p>
                        </div>
                        <button
                            onClick={handleShare}
                            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            aria-label="Share"
                        >
                            {shared ? <span className="text-xs text-[#671E1F] font-medium">Shared</span> : <Share2 className="w-4 h-4" />}
                        </button>
                    </div>

                    <div className="p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                {formattedDate}
                            </span>
                            <span className="text-slate-500 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                {booking.timeSlot}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500 flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-400" />
                                {booking.guests} guests
                            </span>
                            <span className="text-xs font-medium text-[#671E1F] bg-[#671E1F]/10 px-2 py-0.5 rounded">{statusLabel}</span>
                        </div>
                    </div>
                </motion.div>

                {/* Actions */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="w-full space-y-3"
                >
                    <button
                        onClick={() => navigate("/bookings")}
                        className="w-full h-12 rounded-xl bg-[#671E1F] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#258555] active:scale-[0.99] transition-all"
                    >
                        View my bookings
                    </button>
                    <button
                        onClick={() => navigate("/")}
                        className="w-full h-12 rounded-xl border border-slate-200 text-slate-700 font-medium flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-[0.99] transition-all"
                    >
                        <Home className="w-4 h-4" />
                        Go to home
                    </button>
                </motion.div>

                <p className="mt-8 text-xs text-slate-400 text-center">
                    Show this at the restaurant for entry
                </p>
            </div>
        </div>
    )
}
