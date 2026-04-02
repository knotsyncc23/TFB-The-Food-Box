import { useState, useEffect, useCallback } from "react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { AlertCircle, CheckCircle, Clock, XCircle, FileText } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
]

const COMPLAINT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'food_quality', label: 'Food Quality' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'missing_item', label: 'Missing Item' },
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' },
]

export default function RestaurantComplaints() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [filters, setFilters] = useState({
    status: 'all',
    complaintType: 'all',
    search: '',
    page: 1,
    limit: 50
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  })

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        page: filters.page,
        limit: filters.limit,
      }
      if (filters.status && filters.status !== 'all') params.status = filters.status
      if (filters.complaintType && filters.complaintType !== 'all') params.complaintType = filters.complaintType
      const normalizedSearch = filters.search?.replace(/\s+/g, "").trim()
      if (normalizedSearch) params.search = normalizedSearch

      const response = await adminAPI.getRestaurantComplaints(params)
      if (response?.data?.success) {
        setComplaints(response.data.data.complaints || [])
        setPagination(response.data.data.pagination || {
          page: 1,
          limit: 50,
          total: 0,
          pages: 1,
        })
      }
    } catch (error) {
      console.error('Error fetching complaints:', error)
      toast.error('Failed to fetch complaints')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchComplaints()
  }, [fetchComplaints])

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-600" />
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-red-600" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <FileText className="w-4 h-4 text-gray-600" />
    }
  }

  const handleStatusChange = async (complaintId, newStatus) => {
    if (!complaintId || !newStatus) return
    try {
      setUpdatingStatusId(complaintId)
      await adminAPI.updateRestaurantComplaintStatus(complaintId, newStatus)
      setComplaints((prev) =>
        prev.map((c) => (c._id === complaintId ? { ...c, status: newStatus } : c))
      )
      toast.success('Complaint status updated')
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to update complaint status'
      toast.error(message)
    } finally {
      setUpdatingStatusId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restaurant Complaints</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and track customer complaints</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by order, Customer, Restaurant name"
              value={filters.search}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  search: e.target.value.replace(/^\s+/, ""),
                  page: 1
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Select value={filters.status || 'all'} onValueChange={(value) => setFilters({ ...filters, status: value, page: 1 })}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.complaintType || 'all'} onValueChange={(value) => setFilters({ ...filters, complaintType: value, page: 1 })}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {COMPLAINT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Complaints List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Loading complaints...</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No complaints found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {complaints.map((complaint) => (
              <div key={complaint._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(complaint.status)}
                      <h3 className="font-semibold text-gray-900">{complaint.subject}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-xs text-gray-500">Order</p>
                        <p className="font-medium">#{complaint.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Customer</p>
                        <p className="font-medium">{complaint.customerName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Restaurant</p>
                        <p className="font-medium">{complaint.restaurantName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Type</p>
                        <p className="font-medium capitalize">{complaint.complaintType.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>
                  <Select
                    value={complaint.status}
                    onValueChange={(value) => handleStatusChange(complaint._id, value)}
                    disabled={updatingStatusId === complaint._id}
                  >
                    <SelectTrigger className="w-[140px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.filter((o) => o.value !== 'all').map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-gray-700 mb-3">{complaint.description}</p>
                {complaint.restaurantResponse && (
                  <div className="bg-blue-50 rounded p-3 mb-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Restaurant Response:</p>
                    <p className="text-sm text-blue-800">{complaint.restaurantResponse}</p>
                  </div>
                )}
                {complaint.adminResponse && (
                  <div className="bg-red-50 rounded p-3 mb-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">Admin Response:</p>
                    <p className="text-sm text-red-800">{complaint.adminResponse}</p>
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} complaints
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              disabled={filters.page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              disabled={filters.page >= pagination.pages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
