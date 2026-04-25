import { useLocation, useNavigate } from "react-router-dom"
import { CheckCircle2, Calendar, Clock, Users, MapPin, Share2, Home, List, Info } from "lucide-react"
import { Button } from "@food/components/ui/button"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { useEffect } from "react"

export default function TableBookingSuccess() {
    const location = useLocation()
    const navigate = useNavigate()
    const { booking } = location.state || {}

    useEffect(() => {
        // Trigger confetti on mount
        const duration = 3 * 1000
        const animationEnd = Date.now() + duration
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

        const randomInRange = (min, max) => Math.random() * (max - min) + min

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now()

            if (timeLeft <= 0) {
                return clearInterval(interval)
            }

            const particleCount = 50 * (timeLeft / duration)
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
        }, 250)

        return () => clearInterval(interval)
    }, [])

    if (!booking) {
        navigate("/food/user/dining")
        return null
    }

    const formattedDate = new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

    return (
        <AnimatedPage className="bg-white dark:bg-slate-950 min-h-screen flex flex-col items-center justify-center p-6 pb-24 transition-colors">
            <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`w-20 h-20 ${booking.status === 'pending' ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-[#F9F9FB] dark:bg-slate-900'} rounded-full flex items-center justify-center mb-6 transition-colors`}
            >
                {booking.status === 'pending' ? (
                    <Clock className="w-12 h-12 text-amber-500" />
                ) : (
                    <CheckCircle2 className="w-12 h-12 text-[#7e3866]" />
                )}
            </motion.div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center space-y-2 mb-10"
            >
                <h1 className="text-3xl font-black text-gray-900 dark:text-slate-100">
                    {booking.status === 'pending' ? 'Booking Requested!' : 'Seat Confirmed!'}
                </h1>
                <p className="text-gray-500 dark:text-slate-400 font-medium tracking-wide italic">
                    {booking.status === 'pending' ? 'Waiting for restaurant approval' : 'Your table is ready for you'}
                </p>
                <div className="pt-2">
                    <span className="bg-[#F9F9FB] dark:bg-slate-900 text-[#7e3866] dark:text-purple-400 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-[#7e3866]/20 dark:border-purple-400/20">
                        BOOKING ID: {booking.bookingId}
                    </span>
                </div>

                {booking.status === 'pending' && (
                    <div className="mt-6 mx-auto max-w-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 text-left flex gap-3 shadow-sm shadow-amber-100/50 dark:shadow-none transition-colors">
                        <div className="bg-amber-100 p-2 rounded-xl h-fit">
                            <Info className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                            <p className="font-bold text-amber-900 dark:text-amber-300 text-xs">Waiting for Confirmation</p>
                            <p className="text-amber-700 dark:text-amber-400/80 text-[10px] mt-1 leading-relaxed">
                                The restaurant will review and approve your request shortly. You'll be notified of the status.
                            </p>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Ticket Card */}
            <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="w-full max-w-sm bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200 dark:shadow-none transition-colors"
            >
                <div className="p-6 space-y-6 relative">
                    {/* Circle cutouts for ticket look */}
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-slate-950 rounded-full border border-slate-100 dark:border-slate-800 transition-colors"></div>
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-slate-950 rounded-full border border-slate-100 dark:border-slate-800 transition-colors"></div>

                    <div className="flex items-center gap-4 text-left">
                        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex-shrink-0 p-1">
                            <img
                                src={booking.restaurant?.image || booking.restaurant?.profileImage?.url || ""}
                                className="w-full h-full object-cover rounded-xl"
                                alt="restaurant"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                }}
                            />
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-black text-lg text-gray-900 dark:text-slate-100 truncate">{booking.restaurant?.name || "The Great Indian Restaurant"}</h2>
                            <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">
                                    {typeof booking.restaurant?.location === 'string'
                                        ? booking.restaurant.location
                                        : (booking.restaurant?.location?.formattedAddress || booking.restaurant?.location?.address || `${booking.restaurant?.location?.city || ''}${booking.restaurant?.location?.area ? ', ' + booking.restaurant.location.area : ''}`)}
                                </span>
                            </p>
                        </div>
                    </div>

                     <div className="grid grid-cols-2 gap-4 py-6 border-y border-dashed border-slate-200 dark:border-slate-800 text-left">
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Date</p>
                            <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-slate-200">
                                <Calendar className="w-4 h-4 text-red-500" />
                                <span>{formattedDate}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Time</p>
                            <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-slate-200">
                                <Clock className="w-4 h-4 text-red-500" />
                                <span>{booking.timeSlot}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Guests</p>
                            <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-slate-200">
                                <Users className="w-4 h-4 text-red-500" />
                                <span>{booking.guests} People</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Status</p>
                            <div className={`${booking.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'} px-2 py-0.5 rounded-lg text-[10px] font-black tracking-widest w-fit uppercase`}>
                                {booking.status === 'pending' ? 'PENDING' : 'CONFIRMED'}
                            </div>
                        </div>
                    </div>

                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-12 w-full max-w-sm space-y-3"
            >
                <Button
                    onClick={() => navigate("/food/user/bookings")}
                    className="w-full h-14 bg-red-500 hover:bg-red-600 text-white font-bold text-lg rounded-2xl shadow-xl shadow-red-100 flex items-center justify-center gap-2"
                >
                    <List className="w-5 h-5" />
                    View My Bookings
                </Button>
                <Button
                    onClick={() => navigate("/food/user")}
                    variant="outline"
                    className="w-full h-14 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-lg rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                    <Home className="w-5 h-5" />
                    Go to Home
                </Button>
            </motion.div>

            <p className="fixed bottom-10 text-[10px] font-bold text-slate-300 uppercase tracking-widest px-10 text-center">
                Show this ticket at the restaurant for a smooth entry
            </p>
        </AnimatedPage>
    )
}
