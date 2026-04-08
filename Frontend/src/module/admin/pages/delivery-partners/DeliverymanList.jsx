import { useState, useMemo, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Search, Download, ChevronDown, Eye, Trash2, User, Star, ArrowUpDown, Settings, FileText, FileSpreadsheet, Loader2, Check, Columns, ExternalLink, Calendar, MapPin, CreditCard, Mail, Phone, Bike, FileCheck, UserPlus } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { exportDeliverymenToExcel, exportDeliverymenToPDF } from "../../components/deliveryman/deliverymanExportUtils"

export default function DeliverymanList() {
  const [searchParams] = useSearchParams()
  const initialSearchQuery = searchParams.get("search") || ""
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [deliverymen, setDeliverymen] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedDeliveryman, setSelectedDeliveryman] = useState(null)
  const [viewDetails, setViewDetails] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    name: true,
    contact: true,
    zone: true,
    totalOrders: true,
    availabilityStatus: true,
    actions: true,
  })

  // Fetch delivery partners from API
  const fetchDeliverymen = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = {
        page: 1,
        limit: 1000, // Get all for now
      }

      // Add search to params if provided
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }

      const response = await adminAPI.getDeliveryPartners(params)
      
      if (response.data && response.data.success) {
        setDeliverymen(response.data.data.deliveryPartners || [])
      } else {
        setError("Failed to fetch delivery partners")
        setDeliverymen([])
      }
    } catch (err) {
      console.error("Error fetching delivery partners:", err)
      
      // Better error handling
      let errorMessage = "Failed to fetch delivery partners. Please try again."
      
      if (err.code === 'ERR_NETWORK') {
        errorMessage = "Network error. Please check if backend server is running."
      } else if (err.response?.status === 401) {
        errorMessage = "Unauthorized. Please login again."
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. You don't have permission to view this."
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      setDeliverymen([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount
  useEffect(() => {
    fetchDeliverymen()
  }, [])

  useEffect(() => {
    setSearchQuery(initialSearchQuery)
  }, [initialSearchQuery])

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDeliverymen()
    }, 500) // Wait 500ms after user stops typing

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const filteredDeliverymen = useMemo(() => {
    // Backend already handles search, but we can do client-side filtering if needed
    return deliverymen
  }, [deliverymen])

  const handleView = async (deliveryman) => {
    try {
      setLoading(true)
      const response = await adminAPI.getDeliveryPartnerById(deliveryman._id)
      
      if (response.data && response.data.success) {
        setViewDetails(response.data.data.delivery)
        setIsViewOpen(true)
      } else {
        alert("Failed to load details")
      }
    } catch (err) {
      console.error("Error fetching details:", err)
      alert(err.response?.data?.message || "Failed to load details")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (deliveryman) => {
    setSelectedDeliveryman(deliveryman)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedDeliveryman) return

    try {
      setProcessing(true)
      await adminAPI.deleteDeliveryPartner(selectedDeliveryman._id)
      
      // Refresh the list
      await fetchDeliverymen()
      
      setIsDeleteOpen(false)
      setSelectedDeliveryman(null)
      
      // Show success message
      alert(`Successfully deleted ${selectedDeliveryman.name}`)
    } catch (err) {
      console.error("Error deleting delivery partner:", err)
      alert(err.response?.data?.message || "Failed to delete delivery partner. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const handleExportPDF = () => {
    if (filteredDeliverymen.length === 0) {
      alert("No data to export")
      return
    }
    exportDeliverymenToPDF(filteredDeliverymen)
  }

  const handleExportExcel = () => {
    if (filteredDeliverymen.length === 0) {
      alert("No data to export")
      return
    }
    exportDeliverymenToExcel(filteredDeliverymen)
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      name: true,
      contact: true,
      zone: true,
      totalOrders: true,
      availabilityStatus: true,
      actions: true,
    })
  }

  const columnsConfig = {
    si: "Serial Number",
    name: "Name",
    contact: "Contact",
    zone: "Zone",
    totalOrders: "Total Orders",
    availabilityStatus: "Availability Status",
    actions: "Actions",
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-slate-600" />
              <h1 className="text-2xl font-bold text-slate-900">Deliveryman List</h1>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                to="/admin/delivery-partners/add"
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all flex items-center gap-2 shadow-md"
              >
                <UserPlus className="w-4 h-4" />
                <span className="font-semibold">Add Delivery Boy</span>
              </Link>
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search by name or restaur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <button
                onClick={handleExportPDF}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all"
                title="Export as PDF"
              >
                <FileText className="w-4 h-4" />
                <span className="text-black font-bold">PDF</span>
              </button>
              <button
                onClick={handleExportExcel}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all"
                title="Export as Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-black font-bold">Excel</span>
              </button>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Deliveryman</span>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredDeliverymen.length}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={fetchDeliverymen}
                className="mt-2 text-sm text-red-600 underline hover:text-red-800"
              >
                Retry
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-sm text-slate-600">Loading delivery partners...</span>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {visibleColumns.si && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>SI</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.name && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Name</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.contact && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Contact</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.zone && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Zone</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.totalOrders && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Total Orders</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.availabilityStatus && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Availability Status</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredDeliverymen.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center text-slate-500">
                        {error ? "Error loading delivery partners" : "No delivery partners found"}
                      </td>
                    </tr>
                  ) : (
                    filteredDeliverymen.map((dm) => (
                      <tr key={dm._id} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.si && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-700">{dm.sl}</span>
                          </td>
                        )}
                        {visibleColumns.name && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {dm.profileImage ? (
                                <img 
                                  src={dm.profileImage} 
                                  alt={dm.name}
                                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                  <span className="text-sm">👤</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-900">{dm.name}</span>
                                {dm.rating > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                    <span className="text-xs text-slate-600">{dm.rating.toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                        {visibleColumns.contact && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm text-slate-700">{dm.email}</span>
                              <span className="text-xs text-slate-500">{dm.phone}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.zone && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">{dm.zone}</span>
                          </td>
                        )}
                        {visibleColumns.totalOrders && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">{dm.totalOrders || 0}</span>
                          </td>
                        )}
                        {visibleColumns.availabilityStatus && (
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs">
                                Active Status: <span className={`${dm.status === 'Online' ? 'text-blue-600' : 'text-slate-600'} underline`}>{dm.status}</span>
                              </span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => handleView(dm)}
                                className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" 
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(dm)}
                                disabled={processing}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Delete Delivery Partner</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete "{selectedDeliveryman?.name}"? This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={() => setIsDeleteOpen(false)}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100 max-h-[85vh] overflow-y-auto">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="text-xl font-bold text-slate-900">Delivery Partner Details</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {viewDetails ? (
              <div className="space-y-6 mt-4">
                {/* Profile Image & Basic Info */}
                <div className="flex items-start gap-6 pb-6 border-b border-slate-200">
                  <div className="flex-shrink-0">
                    {viewDetails.profileImage?.url ? (
                      <img 
                        src={viewDetails.profileImage.url} 
                        alt={viewDetails.name}
                        className="w-24 h-24 rounded-full object-cover border-2 border-slate-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="w-12 h-12 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                        <User className="w-3 h-3" /> Name
                      </label>
                      <p className="text-sm font-medium text-slate-900 mt-1">{viewDetails.name || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email
                      </label>
                      <p className="text-sm text-slate-900 mt-1">{viewDetails.email || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Phone
                      </label>
                      <p className="text-sm text-slate-900 mt-1">{viewDetails.phone || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Delivery ID</label>
                      <p className="text-sm font-medium text-slate-900 mt-1">{viewDetails.deliveryId || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                        viewDetails.status === 'pending' ? 'bg-blue-100 text-blue-700' :
                        viewDetails.status === 'approved' || viewDetails.status === 'active' ? 'bg-red-100 text-red-700' :
                        viewDetails.status === 'blocked' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {viewDetails.status === 'blocked' ? 'Rejected' : (viewDetails.status?.charAt(0).toUpperCase() + viewDetails.status?.slice(1) || "N/A")}
                      </span>
                    </div>
                    {viewDetails.rejectionReason && (
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase text-red-600">Rejection Reason</label>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-1">
                          <p className="text-sm text-red-700 whitespace-pre-wrap">{viewDetails.rejectionReason}</p>
                        </div>
                      </div>
                    )}
                    {viewDetails.dateOfBirth && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Date of Birth
                        </label>
                        <p className="text-sm text-slate-900 mt-1">
                          {new Date(viewDetails.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                    {viewDetails.gender && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Gender</label>
                        <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.gender || "N/A"}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location Details */}
                {viewDetails.location && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Location Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {viewDetails.location.addressLine1 && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Address Line 1</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.addressLine1}</p>
                        </div>
                      )}
                      {viewDetails.location.addressLine2 && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Address Line 2</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.addressLine2}</p>
                        </div>
                      )}
                      {viewDetails.location.area && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Area</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.area}</p>
                        </div>
                      )}
                      {viewDetails.location.city && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">City</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.city}</p>
                        </div>
                      )}
                      {viewDetails.location.state && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">State</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.state}</p>
                        </div>
                      )}
                      {viewDetails.location.zipCode && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Zip Code</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.zipCode}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vehicle Details */}
                {viewDetails.vehicle && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <Bike className="w-4 h-4" /> Vehicle Details
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                      {viewDetails.vehicle.brand && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Brand</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.vehicle.brand}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.model && (
                        <div className="text-right col-span-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Model</label>
                          <p className="text-xs text-slate-900 mt-1">{viewDetails.vehicle.model}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.number && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle Number</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.vehicle.number}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.type && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle Type</label>
                          <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.vehicle.type}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {viewDetails.documents && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <FileCheck className="w-4 h-4" /> Documents
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Aadhar */}
                      {viewDetails.documents.aadhar && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Aadhar Card</label>
                          <div className="mt-2">
                            {viewDetails.documents.aadhar.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.aadhar.number}</p>
                            )}
                            {viewDetails.documents.aadhar.document && (
                              <a 
                                href={viewDetails.documents.aadhar.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PAN */}
                      {viewDetails.documents.pan && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">PAN Card</label>
                          <div className="mt-2">
                            {viewDetails.documents.pan.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.pan.number}</p>
                            )}
                            {viewDetails.documents.pan.document && (
                              <a 
                                href={viewDetails.documents.pan.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Driving License */}
                      {viewDetails.documents.drivingLicense && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Driving License</label>
                          <div className="mt-2">
                            {viewDetails.documents.drivingLicense.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.drivingLicense.number}</p>
                            )}
                            {viewDetails.documents.drivingLicense.expiryDate && (
                              <p className="text-xs text-slate-500 mb-1">
                                Expiry: {new Date(viewDetails.documents.drivingLicense.expiryDate).toLocaleDateString('en-GB')}
                              </p>
                            )}
                            {viewDetails.documents.drivingLicense.document && (
                              <a 
                                href={viewDetails.documents.drivingLicense.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Vehicle RC */}
                      {viewDetails.documents.vehicleRC && (viewDetails.documents.vehicleRC.number || viewDetails.documents.vehicleRC.document) && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle RC</label>
                          <div className="mt-2">
                            {viewDetails.documents.vehicleRC.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.vehicleRC.number}</p>
                            )}
                            {viewDetails.documents.vehicleRC.document && (
                              <a 
                                href={viewDetails.documents.vehicleRC.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bank Details */}
                {viewDetails.documents?.bankDetails && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Bank Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {viewDetails.documents.bankDetails.accountHolderName && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Account Holder Name</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.accountHolderName}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.accountNumber && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Account Number</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.accountNumber}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.ifscCode && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">IFSC Code</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.ifscCode}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.bankName && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Bank Name</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.bankName}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4">
                  {viewDetails.signupMethod && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Signup Method</label>
                      <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.signupMethod}</p>
                    </div>
                  )}
                  {viewDetails.phoneVerified !== undefined && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Phone Verified</label>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                        viewDetails.phoneVerified ? 'bg-red-100 text-red-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {viewDetails.phoneVerified ? 'Verified' : 'Not Verified'}
                      </span>
                    </div>
                  )}
                  {viewDetails.createdAt && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Joined Date</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {new Date(viewDetails.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 border-t border-slate-200">
            <button
              onClick={() => setIsViewOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Table Settings
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Columns className="w-4 h-4" />
                Visible Columns
              </h3>
              <div className="space-y-2">
                {Object.entries(columnsConfig).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={() => toggleColumn(key)}
                      className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                    {visibleColumns[key] && (
                      <Check className="w-4 h-4 text-red-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={resetColumns}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all shadow-md"
              >
                Apply
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
