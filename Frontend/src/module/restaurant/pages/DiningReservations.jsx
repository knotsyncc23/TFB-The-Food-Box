import { useState, useEffect } from "react"
import { Calendar, Clock, Users, Search, Filter, MessageSquare, ChevronRight, CheckCircle2, XCircle, Clock4, Receipt, X } from "lucide-react"
import { diningAPI, restaurantAPI } from "@/lib/api"
import Loader from "@/components/Loader"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export default function DiningReservations() {
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [restaurant, setRestaurant] = useState(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all") // all | pending | confirmed | rejected | checked-in | cancelled | completed | dining_completed
    const [todayOnly, setTodayOnly] = useState(false)
    const [showFilter, setShowFilter] = useState(false)
    const [sendBillModal, setSendBillModal] = useState(null) // { booking }
    const [billAmount, setBillAmount] = useState("")
    const [billNote, setBillNote] = useState("")
    const [sendingBill, setSendingBill] = useState(false)

    useEffect(() => {
        const fetchAll = async () => {
            try {
                // First get the current restaurant
                const resResponse = await restaurantAPI.getCurrentRestaurant()
                if (resResponse.data.success) {
                    const resData = resResponse.data?.data?.restaurant || resResponse.data?.restaurant || resResponse.data?.data

                    const restaurantId = resData?._id || resData?.id

                    if (restaurantId) {
                        setRestaurant(resData)
                        // Then get its bookings
                        const bookingsResponse = await diningAPI.getRestaurantBookings(restaurantId)
                        if (bookingsResponse.data.success) {
                            setBookings(bookingsResponse.data.data)
                        }
                    } else {
                        console.error("Restaurant ID not found in response:", resData)
                    }
                }
            } catch (error) {
                console.error("Error fetching reservations:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchAll()
    }, [])

    const handleStatusUpdate = async (bookingId, newStatus) => {
        // Bug #108: Add confirmation popup before status update
        const statusLabels = {
            'pending': 'Pending',
            'confirmed': 'Confirm',
            'checked-in': 'Check-in',
            'rejected': 'Reject',
            'completed': 'Check-out',
            'dining_completed': 'Dining Completed',
            'cancelled': 'Cancel'
        }
        const label = statusLabels[newStatus] || newStatus
        const confirmed = window.confirm(`Are you sure you want to mark this booking as "${label}"?`)
        if (!confirmed) return

        try {
            const response = await diningAPI.updateBookingStatusRestaurant(bookingId, newStatus)
            if (response.data.success) {
                setBookings(prev => prev.map(b =>
                    b._id === bookingId ? { ...b, status: newStatus } : b
                ))
                toast.success(`Status updated to "${label}"`)
            }
        } catch (error) {
            console.error("Error updating status:", error)
            toast.error(error.response?.data?.message || "Failed to update status")
        }
    }

    const handleSendBill = async () => {
        if (!sendBillModal?.booking) return
        const amount = parseFloat(billAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error("Enter a valid bill amount")
            return
        }
        setSendingBill(true)
        try {
            const res = await diningAPI.sendBill(sendBillModal.booking._id, {
                billAmount: amount,
                note: billNote.trim() || undefined,
            })
            if (res.data.success) {
                setBookings(prev => prev.map(b =>
                    b._id === sendBillModal.booking._id ? { ...b, ...res.data.data } : b
                ))
                setSendBillModal(null)
                setBillAmount("")
                setBillNote("")
                toast.success("Bill sent successfully")
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to send bill")
        } finally {
            setSendingBill(false)
        }
    }

    const filteredBookings = bookings
        .filter(booking => {
            const term = searchTerm.trim().toLowerCase()
            if (!term) return true
            return (
                booking.user?.name?.toLowerCase().includes(term) ||
                booking.bookingId?.toLowerCase().includes(term)
            )
        })
        .filter(booking => {
            if (statusFilter === "all") return true
            return booking.status === statusFilter
        })
        .filter(booking => {
            if (!todayOnly) return true
            return new Date(booking.date).toDateString() === new Date().toDateString()
        })
        .sort((a, b) => b._id.localeCompare(a._id))

    if (loading) return <Loader />

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white p-6 border-b sticky top-0 z-30">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Table Reservations</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage your upcoming guest bookings</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                id="reservation-search"
                                name="reservation-search"
                                placeholder="Search by name or ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                            />
                        </div>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowFilter((prev) => !prev)}
                                className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-1"
                            >
                                <Filter className="w-5 h-5 text-slate-600" />
                            </button>
                            {showFilter && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 z-40">
                                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                            Filters
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStatusFilter("all")
                                                setTodayOnly(false)
                                                setShowFilter(false)
                                            }}
                                            className="text-[11px] text-blue-600 font-semibold"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    <div className="px-4 py-3 space-y-3">
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 mb-1">
                                                Status
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { id: "all", label: "All" },
                                                    { id: "pending", label: "Pending" },
                                                    { id: "confirmed", label: "Confirmed" },
                                                    { id: "rejected", label: "Rejected" },
                                                    { id: "checked-in", label: "Checked-in" },
                                                    { id: "completed", label: "Completed" },
                                                    { id: "dining_completed", label: "Dining completed" },
                                                    { id: "cancelled", label: "Cancelled" },
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => setStatusFilter(opt.id)}
                                                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === opt.id
                                                            ? "bg-slate-900 text-white border-slate-900"
                                                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                                                            }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-slate-600">
                                                Only today&apos;s bookings
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setTodayOnly((prev) => !prev)}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${todayOnly ? "bg-red-500" : "bg-slate-200"
                                                    }`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${todayOnly ? "translate-x-4" : "translate-x-1"
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-sm font-medium">Total Bookings</p>
                                <p className="text-2xl font-bold text-slate-900">{bookings.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="bg-red-50 p-3 rounded-xl text-red-600">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-sm font-medium">Confirmed</p>
                                <p className="text-2xl font-bold text-slate-900">
                                    {bookings.filter(b => b.status === 'confirmed' || b.status === 'checked-in').length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="bg-orange-50 p-3 rounded-xl text-orange-600">
                                <Clock4 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-sm font-medium">Today's Bookings</p>
                                <p className="text-2xl font-bold text-slate-900">
                                    {bookings.filter(b => new Date(b.date).toDateString() === new Date().toDateString()).length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bookings List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-bold text-slate-800">Recent Reservations</h2>
                    </div>

                    {filteredBookings.length > 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Booking ID</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Guest Details</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Guests</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredBookings.map((booking) => {
                                        // Bug #109: Determine next status action for row click
                                        const getNextStatus = (status) => {
                                            switch(status) {
                                                case 'pending': return null
                                                case 'confirmed': return 'checked-in'
                                                case 'checked-in': return 'completed'
                                                case 'completed': return 'dining_completed'
                                                default: return null
                                            }
                                        }
                                        const nextStatus = getNextStatus(booking.status)
                                        return (
                                        <tr
                                            key={booking._id}
                                            className={`hover:bg-slate-50/50 transition-colors ${nextStatus ? 'cursor-pointer' : ''}`}
                                            onClick={() => nextStatus && handleStatusUpdate(booking._id, nextStatus)}
                                        >
                                            <td className="px-6 py-4 font-bold text-slate-700">#{booking.bookingId}</td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-bold text-slate-900">{booking.user?.name}</p>
                                                    <p className="text-xs text-slate-500">{booking.user?.phone || 'No phone'}</p>
                                                    {booking.specialRequest && (
                                                        <div className="mt-2 flex items-start gap-1.5 p-2 bg-blue-50 rounded-lg border border-blue-100 max-w-[200px]">
                                                            <MessageSquare className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                                                            <p className="text-[10px] text-blue-700 font-medium leading-tight line-clamp-2">
                                                                {booking.specialRequest}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                        <Calendar className="w-4 h-4 text-slate-400" />
                                                        {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                        <Clock className="w-4 h-4 text-slate-400" />
                                                        {booking.timeSlot}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                                    <Users className="w-4 h-4 text-slate-400" />
                                                    {booking.guests}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <Badge className={`rounded-lg px-2.5 py-1 w-fit ${booking.status === 'confirmed' ? 'bg-red-100 text-red-700' :
                                                        booking.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                        booking.status === 'rejected' ? 'bg-slate-200 text-slate-700' :
                                                        booking.status === 'checked-in' ? 'bg-orange-100 text-orange-700' :
                                                            booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                                booking.status === 'dining_completed' ? 'bg-violet-100 text-violet-700' :
                                                                    booking.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                                                                    'bg-slate-100 text-slate-700'
                                                        }`}>
                                                        {booking.status.replace('_', ' ')}
                                                    </Badge>
                                                    {booking.billStatus === 'pending' && booking.paymentStatus !== 'paid' && (
                                                        <span className="text-[10px] text-amber-600 font-medium">Bill sent</span>
                                                    )}
                                                    {booking.paymentStatus === 'paid' && (
                                                        <span className="text-[10px] text-red-600 font-medium">Paid</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {booking.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleStatusUpdate(booking._id, 'confirmed')}
                                                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                                                        >
                                                            Confirm
                                                        </button>
                                                    )}

                                                    {(booking.status === 'pending' || booking.status === 'confirmed') && (
                                                        <button
                                                            onClick={() => handleStatusUpdate(booking._id, 'rejected')}
                                                            className="px-3 py-1.5 bg-slate-700 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
                                                        >
                                                            Reject
                                                        </button>
                                                    )}

                                                    {(booking.status === 'pending' || booking.status === 'confirmed') && (
                                                        <button
                                                            onClick={() => handleStatusUpdate(booking._id, 'cancelled')}
                                                            className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}

                                                    {booking.status === 'confirmed' && (
                                                        <button
                                                            onClick={() => handleStatusUpdate(booking._id, 'checked-in')}
                                                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                                                        >
                                                            Check-in
                                                        </button>
                                                    )}
                                                    {booking.status === 'checked-in' && (
                                                        <button
                                                            onClick={() => handleStatusUpdate(booking._id, 'completed')}
                                                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                                        >
                                                            Check-out
                                                        </button>
                                                    )}
                                                    {booking.status === 'completed' && (
                                                        <button
                                                            onClick={() => handleStatusUpdate(booking._id, 'dining_completed')}
                                                            className="px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 transition-colors"
                                                        >
                                                            Dining completed
                                                        </button>
                                                    )}
                                                    {booking.status === 'dining_completed' && booking.billStatus === 'not_sent' && booking.paymentStatus !== 'paid' && (
                                                        <button
                                                            onClick={() => setSendBillModal({ booking })}
                                                            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1"
                                                        >
                                                            <Receipt className="w-3.5 h-3.5" />
                                                            Send Bill
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Calendar className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">No reservations found</h3>
                            <p className="text-slate-500 mt-2">When guests book a table, they will appear here.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Send Bill Modal */}
            {sendBillModal?.booking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !sendingBill && setSendBillModal(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Send Bill</h3>
                            <button type="button" onClick={() => !sendingBill && setSendBillModal(null)} className="p-2 rounded-lg hover:bg-slate-100">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">Booking #{sendBillModal.booking.bookingId} – {sendBillModal.booking.user?.name}</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Total Bill Amount (₹)</label>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={billAmount}
                                    onChange={(e) => setBillAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
                                <textarea
                                    value={billNote}
                                    onChange={(e) => setBillNote(e.target.value)}
                                    placeholder="Add a note for the guest..."
                                    rows={2}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => !sendingBill && setSendBillModal(null)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSendBill}
                                disabled={sendingBill || !billAmount || parseFloat(billAmount) <= 0}
                                className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sendingBill ? "Sending..." : "Send Bill"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
