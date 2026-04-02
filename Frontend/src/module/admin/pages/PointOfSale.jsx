import { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  XCircle,
  Star,
  Calendar,
  BarChart3,
  Users,
  Award,
  Package,
  Search,
} from 'lucide-react'
import { adminAPI } from '@/lib/api'

export default function PointOfSale() {
  const [restaurants, setRestaurants] = useState([])
  const [selectedRestaurant, setSelectedRestaurant] = useState('')
  const [loading, setLoading] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)

  // API may return numeric values as strings; ensure we never call `.toFixed` on non-numbers.
  const safeNumber = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }

  const safeToFixed = (v, decimals = 1) => safeNumber(v).toFixed(decimals)

  // Dummy data structure - replace with actual API calls
  const [analyticsData, setAnalyticsData] = useState({
    totalOrders: 0,
    cancelledOrders: 0,
    completedOrders: 0,
    averageRating: 0,
    totalRatings: 0,
    commissionPercentage: 0,
    monthlyProfit: 0,
    yearlyProfit: 0,
    averageOrderValue: 0,
    totalRevenue: 0,
    totalCommission: 0,
    restaurantEarning: 0,
    monthlyOrders: 0,
    yearlyOrders: 0,
    averageMonthlyProfit: 0,
    averageYearlyProfit: 0,
    status: 'active',
    joinDate: '',
    totalCustomers: 0,
    repeatCustomers: 0,
    cancellationRate: 0,
    completionRate: 0
  })

  // Fetch restaurants list
  useEffect(() => {
    fetchRestaurants()
  }, [])

  // Fetch restaurant analytics when restaurant is selected
  useEffect(() => {
    if (selectedRestaurant) {
      fetchRestaurantAnalytics(selectedRestaurant)
    } else {
      setRestaurantData(null)
      setAnalyticsData({
        totalOrders: 0,
        cancelledOrders: 0,
        completedOrders: 0,
        averageRating: 0,
        totalRatings: 0,
        commissionPercentage: 0,
        monthlyProfit: 0,
        yearlyProfit: 0,
        averageOrderValue: 0,
        totalRevenue: 0,
        totalCommission: 0,
        restaurantEarning: 0,
        monthlyOrders: 0,
        yearlyOrders: 0,
        averageMonthlyProfit: 0,
        averageYearlyProfit: 0,
        status: 'active',
        joinDate: '',
        totalCustomers: 0,
        repeatCustomers: 0,
        cancellationRate: 0,
        completionRate: 0
      })
    }
  }, [selectedRestaurant])

  const fetchRestaurants = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getRestaurants({ limit: 1000, isActive: true })
      if (response?.data?.success) {
        setRestaurants(response.data.data?.restaurants || response.data.data || [])
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error)
      // Fallback to dummy data for development
      setRestaurants([
        { _id: '1', name: 'Spice Garden', restaurantId: 'RST001' },
        { _id: '2', name: 'Tandoor Express', restaurantId: 'RST002' },
        { _id: '3', name: 'Coastal Delights', restaurantId: 'RST003' }
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchRestaurantAnalytics = async (restaurantId) => {
    try {
      setLoading(true)
      
      // Validate restaurantId
      if (!restaurantId) {
        console.error('Restaurant ID is required')
        return
      }
      
      console.log('Fetching analytics for restaurant:', restaurantId)
      
      // Fetch comprehensive restaurant analytics from backend
      const analyticsResponse = await adminAPI.getRestaurantAnalytics(restaurantId)
      
      console.log('Analytics response:', analyticsResponse)
      
      if (analyticsResponse?.data?.success && analyticsResponse.data.data) {
        const { restaurant, analytics } = analyticsResponse.data.data
        
        console.log('Analytics data received:', analytics)
        console.log('Commission percentage from API:', analytics.commissionPercentage)
        console.log('Commission percentage type:', typeof analytics.commissionPercentage)
        
        // Set restaurant data
        setRestaurantData(restaurant)
        
        // Parse commission percentage - handle both number and string
        const commissionPercentage = safeNumber(analytics.commissionPercentage)
        
        console.log('Parsed commission percentage:', commissionPercentage)
        
        // Set analytics data - ensure all values are numbers, not null/undefined
        setAnalyticsData({
          totalOrders: Number(analytics.totalOrders) || 0,
          cancelledOrders: Number(analytics.cancelledOrders) || 0,
          completedOrders: Number(analytics.completedOrders) || 0,
          averageRating: Number(analytics.averageRating) || 0,
          totalRatings: Number(analytics.totalRatings) || 0,
          commissionPercentage: commissionPercentage,
          monthlyProfit: safeNumber(analytics.monthlyProfit),
          yearlyProfit: safeNumber(analytics.yearlyProfit),
          averageOrderValue: safeNumber(analytics.averageOrderValue),
          totalRevenue: safeNumber(analytics.totalRevenue),
          totalCommission: safeNumber(analytics.totalCommission),
          restaurantEarning: safeNumber(analytics.restaurantEarning),
          monthlyOrders: safeNumber(analytics.monthlyOrders),
          yearlyOrders: safeNumber(analytics.yearlyOrders),
          averageMonthlyProfit: safeNumber(analytics.averageMonthlyProfit),
          averageYearlyProfit: safeNumber(analytics.averageYearlyProfit),
          status: analytics.status || 'inactive',
          joinDate: analytics.joinDate || restaurant.createdAt || new Date(),
          totalCustomers: safeNumber(analytics.totalCustomers),
          repeatCustomers: safeNumber(analytics.repeatCustomers),
          cancellationRate: safeNumber(analytics.cancellationRate),
          completionRate: safeNumber(analytics.completionRate)
        })
      } else {
        // Fallback to empty data if API fails
        setAnalyticsData({
          totalOrders: 0,
          cancelledOrders: 0,
          completedOrders: 0,
          averageRating: 0,
          totalRatings: 0,
          commissionPercentage: 0,
          monthlyProfit: 0,
          yearlyProfit: 0,
          averageOrderValue: 0,
          totalRevenue: 0,
          totalCommission: 0,
          restaurantEarning: 0,
          monthlyOrders: 0,
          yearlyOrders: 0,
          averageMonthlyProfit: 0,
          averageYearlyProfit: 0,
          status: 'inactive',
          joinDate: new Date(),
          totalCustomers: 0,
          repeatCustomers: 0,
          cancellationRate: 0,
          completionRate: 0
        })
      }
    } catch (error) {
      console.error('Error fetching restaurant analytics:', error)
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        restaurantId: selectedRestaurant
      })
      
      // Show user-friendly error message
      if (error?.response?.status === 404) {
        console.warn('Restaurant not found')
      } else if (error?.response?.status === 400) {
        console.warn('Invalid restaurant ID')
      } else {
        console.warn('Failed to fetch analytics. Please try again.')
      }
      
      // Set empty data on error
      setAnalyticsData({
        totalOrders: 0,
        cancelledOrders: 0,
        completedOrders: 0,
        averageRating: 0,
        totalRatings: 0,
        commissionPercentage: 0,
        monthlyProfit: 0,
        yearlyProfit: 0,
        averageOrderValue: 0,
        totalRevenue: 0,
        totalCommission: 0,
        restaurantEarning: 0,
        monthlyOrders: 0,
        yearlyOrders: 0,
        averageMonthlyProfit: 0,
        averageYearlyProfit: 0,
        status: 'inactive',
        joinDate: new Date(),
        totalCustomers: 0,
        repeatCustomers: 0,
        cancellationRate: 0,
        completionRate: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return `₹ ${amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`
  }

  const formatNumber = (num) => {
    return num?.toLocaleString('en-IN') || '0'
  }

  const getSelectedRestaurantName = () => {
    const restaurant = restaurants.find(r => r._id === selectedRestaurant)
    return restaurant?.name || 'Select Restaurant'
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-neutral-200 overflow-x-hidden w-full" style={{ maxWidth: '100vw', boxSizing: 'border-box' }}>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
        
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#334257] mb-2">Restaurant POS Analytics & Benefits</h1>
          <p className="text-sm text-[#8a94aa]">Track restaurant performance, profits, and commission details</p>
                </div>

        {/* Restaurant Selection Card */}
        <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-[#334257] mb-2">
                Select Restaurant <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedRestaurant}
                  onChange={(e) => setSelectedRestaurant(e.target.value)}
                  className="w-full h-11 rounded-md border border-[#e3e6ef] bg-white px-3 pr-10 text-sm text-[#4a5671] focus:outline-none focus:ring-1 focus:ring-[#006fbd]"
                >
                  <option value="">Select Restaurant</option>
                  {restaurants.map(restaurant => (
                    <option key={restaurant._id} value={restaurant._id}>
                      {restaurant.name} ({restaurant.restaurantId || restaurant._id})
                    </option>
                  ))}
                </select>
              </div>
              {selectedRestaurant && (
                <p className="text-xs text-red-600 mt-2">✓ Selected: {getSelectedRestaurantName()}</p>
              )}
            </div>
                  </div>
                </div>

        {/* Analytics Dashboard */}
        {selectedRestaurant && !loading ? (
          <div className="space-y-6">
            {/* Restaurant Header Info */}
            <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#334257] mb-1">{getSelectedRestaurantName()}</h2>
                  <p className="text-sm text-[#8a94aa]">
                    Restaurant ID: {restaurants.find(r => r._id === selectedRestaurant)?.restaurantId || selectedRestaurant}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  analyticsData.status === 'active' 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {analyticsData.status === 'active' ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Orders */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-blue-600" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-sm font-medium text-[#8a94aa] mb-1">Total Orders</h3>
                <p className="text-2xl font-bold text-[#334257]">{formatNumber(analyticsData.totalOrders)}</p>
                <p className="text-xs text-[#8a94aa] mt-2">Completed: {formatNumber(analyticsData.completedOrders)}</p>
                </div>

              {/* Cancelled Orders */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <span className="text-sm font-semibold text-red-600">{safeToFixed(analyticsData.cancellationRate, 1)}%</span>
                </div>
                <h3 className="text-sm font-medium text-[#8a94aa] mb-1">Cancelled Orders</h3>
                <p className="text-2xl font-bold text-[#334257]">{formatNumber(analyticsData.cancelledOrders)}</p>
                <p className="text-xs text-[#8a94aa] mt-2">Cancellation Rate</p>
                </div>

              {/* Average Rating */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Star className="w-6 h-6 text-yellow-600 fill-yellow-600" />
                  </div>
                  <span className="text-sm font-semibold text-red-600">+{analyticsData.averageRating}</span>
                </div>
                <h3 className="text-sm font-medium text-[#8a94aa] mb-1">Average Rating</h3>
                <p className="text-2xl font-bold text-[#334257]">{safeToFixed(analyticsData.averageRating, 1)}</p>
                <p className="text-xs text-[#8a94aa] mt-2">From {formatNumber(analyticsData.totalRatings)} reviews</p>
              </div>

              {/* Commission Rate */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Award className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-sm font-semibold text-purple-600">{safeNumber(analyticsData.commissionPercentage)}%</span>
                  </div>
                <h3 className="text-sm font-medium text-[#8a94aa] mb-1">Commission Rate</h3>
                <p className="text-2xl font-bold text-[#334257]">{safeNumber(analyticsData.commissionPercentage)}%</p>
                <p className="text-xs text-[#8a94aa] mt-2">Set Commission</p>
                  </div>
                  </div>

            {/* Profit & Revenue Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Profit */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <Calendar className="w-6 h-6 text-red-600" />
                  </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#334257]">Monthly Profit</h3>
                      <p className="text-xs text-[#8a94aa]">Current Month</p>
                  </div>
                  </div>
                  <TrendingUp className="w-5 h-5 text-red-500" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-[#334257] mb-2">{formatCurrency(analyticsData.monthlyProfit)}</p>
                  <div className="flex items-center gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-[#8a94aa]">Orders: </span>
                      <span className="font-semibold text-[#334257]">{formatNumber(analyticsData.monthlyOrders)}</span>
                    </div>
                    <div>
                      <span className="text-[#8a94aa]">Avg/Month: </span>
                      <span className="font-semibold text-[#334257]">{formatCurrency(analyticsData.averageMonthlyProfit)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Yearly Profit */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#334257]">Yearly Profit</h3>
                      <p className="text-xs text-[#8a94aa]">Current Year</p>
                    </div>
                  </div>
                  <TrendingUp className="w-5 h-5 text-red-500" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-[#334257] mb-2">{formatCurrency(analyticsData.yearlyProfit)}</p>
                  <div className="flex items-center gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-[#8a94aa]">Orders: </span>
                      <span className="font-semibold text-[#334257]">{formatNumber(analyticsData.yearlyOrders)}</span>
              </div>
                    <div>
                      <span className="text-[#8a94aa]">Avg/Year: </span>
                      <span className="font-semibold text-[#334257]">{formatCurrency(analyticsData.averageYearlyProfit)}</span>
            </div>
          </div>
        </div>
        </div>
      </div>

            {/* Detailed Financial Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
              <h3 className="text-lg font-semibold text-[#334257] mb-4">Financial Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Total Revenue</span>
                    <span className="text-base font-semibold text-[#334257]">{formatCurrency(analyticsData.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Total Commission (Admin)</span>
                    <span className="text-base font-semibold text-[#006fbd]">{formatCurrency(analyticsData.totalCommission)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Restaurant Earning</span>
                    <span className="text-base font-semibold text-red-600">{formatCurrency(analyticsData.restaurantEarning)}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Average Order Value</span>
                    <span className="text-base font-semibold text-[#334257]">{formatCurrency(analyticsData.averageOrderValue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Completion Rate</span>
                    <span className="text-base font-semibold text-red-600">{safeToFixed(analyticsData.completionRate, 1)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Commission Percentage</span>
                    <span className="text-base font-semibold text-[#334257]">
                      {analyticsData.commissionPercentage !== undefined && analyticsData.commissionPercentage !== null
                        ? `${analyticsData.commissionPercentage}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Additional Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Statistics */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-base font-semibold text-[#334257]">Customer Statistics</h3>
                  </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Total Customers</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatNumber(analyticsData.totalCustomers)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Repeat Customers</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatNumber(analyticsData.repeatCustomers)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Customer Retention</span>
                    <span className="text-sm font-semibold text-red-600">
                      {analyticsData.totalCustomers > 0 
                        ? (safeNumber(analyticsData.repeatCustomers) / safeNumber(analyticsData.totalCustomers)) * 100
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Restaurant Details */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Package className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="text-base font-semibold text-[#334257]">Restaurant Details</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Join Date</span>
                    <span className="text-sm font-semibold text-[#334257]">
                      {new Date(analyticsData.joinDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Status</span>
                    <span className={`text-sm font-semibold px-2 py-1 rounded ${
                      analyticsData.status === 'active' 
                        ? 'bg-red-100 text-red-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {analyticsData.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Total Reviews</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatNumber(analyticsData.totalRatings)}</span>
                  </div>
          </div>
              </div>
              </div>

            {/* Order Statistics Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
              <h3 className="text-lg font-semibold text-[#334257] mb-4">Order Statistics Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{formatNumber(analyticsData.totalOrders)}</p>
                  <p className="text-xs text-[#8a94aa] mt-1">Total Orders</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{formatNumber(analyticsData.completedOrders)}</p>
                  <p className="text-xs text-[#8a94aa] mt-1">Completed</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{formatNumber(analyticsData.cancelledOrders)}</p>
                  <p className="text-xs text-[#8a94aa] mt-1">Cancelled</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{safeToFixed(analyticsData.completionRate, 1)}%</p>
                  <p className="text-xs text-[#8a94aa] mt-1">Success Rate</p>
                </div>
              </div>
            </div>
          </div>
        ) : selectedRestaurant && loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#006fbd] mx-auto mb-4"></div>
            <p className="text-sm text-[#8a94aa]">Loading restaurant analytics...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-12 text-center">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#d1d7e6] flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-[#8a94aa]" />
            </div>
            <p className="text-base font-medium text-[#334257] mb-2">Select a Restaurant</p>
            <p className="text-sm text-[#8a94aa] max-w-md mx-auto">
              Please select a restaurant from the dropdown above to view detailed analytics, profit information, and commission details.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
