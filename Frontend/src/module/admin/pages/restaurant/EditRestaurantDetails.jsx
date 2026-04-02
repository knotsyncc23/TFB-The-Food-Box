import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Pencil, Loader2, ArrowUpDown } from "lucide-react"
import { adminAPI, restaurantAPI } from "@/lib/api"
import { Button } from "@/components/ui/button"

export default function EditRestaurantDetails() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sort, setSort] = useState({ key: null, order: "asc" })
  const [filters, setFilters] = useState({
    status: "active",
    zone: "__all__",
    cuisine: "__all__",
  })

  const formatRestaurantId = (id) => {
    if (!id) return "REST000000"
    const idString = String(id)
    const parts = idString.split(/[-.]/)
    let lastDigits = ""
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1]
      const digits = lastPart.match(/\d+/g)
      if (digits?.length) {
        lastDigits = digits.join("").slice(-6).padStart(6, "0")
      }
    }
    if (!lastDigits) {
      const hash = idString.split("").reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0) | 0, 0)
      lastDigits = Math.abs(hash).toString().slice(-6).padStart(6, "0")
    }
    return `REST${lastDigits}`
  }

  const renderStars = (rating) => {
    let r = Number(rating) || 0;
    r = Math.max(0, Math.min(5, r)); // Clamp between 0 and 5
    const full = Math.floor(r)
    const half = r % 1 >= 0.5 ? 1 : 0
    const empty = Math.max(0, 5 - full - half)
    return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty) + ` ${(Number(rating) || 0).toFixed(1)}`
  }

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoading(true)
        setError(null)
        const params = { limit: 500 }
        if (filters.status === "inactive") params.status = "inactive"
        if (filters.status === "all") params.status = "all"
        let response
        try {
          response = await adminAPI.getRestaurants(params)
        } catch {
          response = await restaurantAPI.getRestaurants(params)
        }
        const data = response.data?.data
        const list = data?.restaurants || data || []
        const mapped = list.map((r, i) => ({
          id: r._id || r.id || i + 1,
          _id: r._id,
          name: r.name || "N/A",
          ownerName: r.ownerName || "N/A",
          ownerPhone: r.ownerPhone || r.phone || "N/A",
          zone: r.location?.area || r.location?.city || r.zone || "N/A",
          cuisine: Array.isArray(r.cuisines)?.length ? r.cuisines[0] : (r.cuisine || "N/A"),
          status: r.isActive !== false,
          rating: r.ratings?.average ?? r.rating ?? 0,
          logo: r.profileImage?.url || r.logo || "https://via.placeholder.com/40",
          originalData: r,
        }))
        setRestaurants(mapped)
      } catch (err) {
        console.error(err)
        setError(err.message || "Failed to fetch restaurants")
        setRestaurants([])
      } finally {
        setLoading(false)
      }
    }
    fetchRestaurants()
  }, [filters.status])

  const uniqueZones = useMemo(() => {
    const zones = new Set(restaurants.map((r) => r.zone || "N/A").filter(Boolean))
    return Array.from(zones).sort()
  }, [restaurants])

  const uniqueCuisines = useMemo(() => {
    const cuisines = new Set(restaurants.map((r) => r.cuisine || "N/A").filter(Boolean))
    return Array.from(cuisines).sort()
  }, [restaurants])

  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.ownerPhone.includes(q)
      )
    }
    if (filters.zone && filters.zone !== "__all__") {
      result = result.filter((r) => (r.zone || "N/A") === filters.zone)
    }
    if (filters.cuisine && filters.cuisine !== "__all__") {
      result = result.filter((r) => (r.cuisine || "N/A").toLowerCase().includes(filters.cuisine.toLowerCase()))
    }
    const key = sort.key
    const order = sort.order
    if (key) {
      result = [...result].sort((a, b) => {
        let aVal = a[key] ?? ""
        let bVal = b[key] ?? ""
        if (key === "name" || key === "ownerName" || key === "zone" || key === "cuisine") {
          aVal = String(aVal).toLowerCase()
          bVal = String(bVal).toLowerCase()
        }
        if (key === "status") {
          aVal = a.status ? 1 : 0
          bVal = b.status ? 1 : 0
        }
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return order === "asc" ? cmp : -cmp
      })
    }
    return result
  }, [restaurants, searchQuery, filters, sort])

  const handleSort = (key) => {
    setSort((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }))
  }

  const handleEdit = (restaurant) => {
    navigate(`/admin/restaurants/edit/${restaurant._id || restaurant.id}`)
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Edit Restaurant Details</h1>
          <p className="text-sm text-slate-600 mb-6">
            Search and filter restaurants, then click Edit to update their details.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, owner, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="w-[140px] px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </select>
              <select
                value={filters.zone}
                onChange={(e) => setFilters((f) => ({ ...f, zone: e.target.value }))}
                className="w-[140px] px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="__all__">All Zones</option>
                {uniqueZones.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
              <select
                value={filters.cuisine}
                onChange={(e) => setFilters((f) => ({ ...f, cuisine: e.target.value }))}
                className="w-[140px] px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="__all__">All Cuisines</option>
                {uniqueCuisines.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-slate-600">Loading restaurants...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-lg font-semibold text-red-600 mb-1">Error Loading Data</p>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">SL</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">
                      <button type="button" onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-slate-900">
                        Restaurant <ArrowUpDown className={`w-3 h-3 ${sort.key === "name" ? "text-blue-600" : "text-slate-400"}`} />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">
                      <button type="button" onClick={() => handleSort("ownerName")} className="flex items-center gap-1 hover:text-slate-900">
                        Owner <ArrowUpDown className={`w-3 h-3 ${sort.key === "ownerName" ? "text-blue-600" : "text-slate-400"}`} />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">
                      <button type="button" onClick={() => handleSort("zone")} className="flex items-center gap-1 hover:text-slate-900">
                        Zone <ArrowUpDown className={`w-3 h-3 ${sort.key === "zone" ? "text-blue-600" : "text-slate-400"}`} />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">
                      <button type="button" onClick={() => handleSort("cuisine")} className="flex items-center gap-1 hover:text-slate-900">
                        Cuisine <ArrowUpDown className={`w-3 h-3 ${sort.key === "cuisine" ? "text-blue-600" : "text-slate-400"}`} />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">
                      <button type="button" onClick={() => handleSort("status")} className="flex items-center gap-1 hover:text-slate-900">
                        Status <ArrowUpDown className={`w-3 h-3 ${sort.key === "status" ? "text-blue-600" : "text-slate-400"}`} />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRestaurants.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-20 text-center text-slate-500">
                        No restaurants found
                      </td>
                    </tr>
                  ) : (
                    filteredRestaurants.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-700">{i + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={r.logo}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => { e.target.src = "https://via.placeholder.com/40" }}
                            />
                            <div>
                              <span className="font-medium text-slate-900">{r.name}</span>
                              <span className="block text-xs text-slate-500">#{formatRestaurantId(r._id || r.id)}</span>
                              <span className="block text-xs text-slate-500">{renderStars(r.rating)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-900">{r.ownerName}</span>
                          <span className="block text-xs text-slate-500">{r.ownerPhone}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">{r.zone}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{r.cuisine}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${r.status ? "bg-red-100 text-red-800" : "bg-red-100 text-red-800"}`}>
                            {r.status ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(r)}
                            className="gap-1"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
