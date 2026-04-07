import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { deliveryAPI } from "@/lib/api"
import { toast } from "sonner"

export default function ViewSupportTicket() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchTicket()
    }
  }, [id])

  const fetchTicket = async () => {
    try {
      setLoading(true)
      const response = await deliveryAPI.getSupportTicketById(id)
      
      if (response?.data?.success && response?.data?.data) {
        setTicket(response.data.data)
      } else {
        toast.error("Ticket not found")
        navigate("/delivery/help/tickets")
      }
    } catch (error) {
      console.error("Error fetching ticket:", error)
      toast.error("Failed to load ticket")
      navigate("/delivery/help/tickets")
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case "open":
        return <Clock className="w-5 h-5 text-orange-500" />
      case "in_progress":
        return <Clock className="w-5 h-5 text-blue-500" />
      case "resolved":
        return <CheckCircle className="w-5 h-5 text-red-500" />
      case "closed":
        return <XCircle className="w-5 h-5 text-gray-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "open":
        return "bg-orange-100 text-orange-700"
      case "in_progress":
        return "bg-blue-100 text-blue-700"
      case "resolved":
        return "bg-red-100 text-red-700"
      case "closed":
        return "bg-gray-100 text-gray-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-700"
      case "high":
        return "bg-orange-100 text-orange-700"
      case "medium":
        return "bg-yellow-100 text-yellow-700"
      case "low":
        return "bg-blue-100 text-blue-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getCategoryLabel = (category) => {
    const labels = {
      payment: "Payment",
      account: "Account",
      technical: "Technical",
      order: "Order",
      other: "Other"
    }
    return labels[category] || category
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-4 px-4 py-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Ticket Details</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-4 px-4 py-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Ticket Details</h1>
          </div>
        </div>
        <div className="px-4 py-6">
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-600">Ticket not found</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Ticket Details</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 md:p-8 space-y-6">
            {/* Ticket ID and Status */}
            <div className="pb-4 border-b border-gray-200">
              {ticket.ticketId && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Ticket ID</p>
                  <p className="text-base font-mono font-semibold bg-gray-100 text-gray-900 px-3 py-2 rounded-lg inline-block">
                    #{ticket.ticketId}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                  {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1).replace('_', ' ')}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                  {ticket.priority}
                </span>
                <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                  {getCategoryLabel(ticket.category)}
                </span>
                <div className="ml-auto">
                  {getStatusIcon(ticket.status)}
                </div>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <p className="text-base text-gray-900 font-medium">{ticket.subject}</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-xl leading-relaxed">
                {ticket.description}
              </p>
            </div>

            {/* Admin Response */}
            {ticket.adminResponse ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Admin Response</label>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{ticket.adminResponse}</p>
                  {ticket.respondedAt && (
                    <p className="text-xs text-gray-500 mt-2">
                      Responded on: {formatDateTime(ticket.respondedAt)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
                <p className="text-sm text-yellow-800">No response yet. Our team will get back to you soon.</p>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-xs text-gray-500 mb-1">Created</p>
                <p className="text-sm text-gray-900">{formatDateTime(ticket.createdAt)}</p>
              </div>
              {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Last Updated</p>
                  <p className="text-sm text-gray-900">{formatDateTime(ticket.updatedAt)}</p>
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => navigate(-1)}
                className="w-full px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

