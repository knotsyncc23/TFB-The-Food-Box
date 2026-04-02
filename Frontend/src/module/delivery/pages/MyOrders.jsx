import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { 
  ArrowLeft,
  Search,
  Mic,
  MoreVertical,
  ChevronRight,
  Star,
  RotateCcw,
  AlertCircle,
  Loader2,
  Package,
  Trash2,
  X
} from "lucide-react"
import { deliveryAPI } from "@/lib/api"
import { toast } from "sonner"
import { useCompanyName } from "@/lib/hooks/useCompanyName"
import { getHiddenOrderIds, hideOrderId } from "@/lib/utils/orderVisibility"

export default function MyOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeMenuOrderId, setActiveMenuOrderId] = useState(null)
  const [hiddenOrderIds, setHiddenOrderIds] = useState(() => new Set(getHiddenOrderIds("delivery")))

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        
        // Check authentication token
        const deliveryToken = localStorage.getItem('delivery_accessToken') || localStorage.getItem('accessToken')
        console.log('🔐 Delivery Token exists:', !!deliveryToken)
        
        console.log('🔄 Fetching orders using Trip History API (includes all completed orders)...')
        
        // Use Trip History API which includes all orders including delivered/completed
        // Fetch from last 1 year to get all orders
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        
        const response = await deliveryAPI.getTripHistory({
          period: 'monthly',
          date: new Date().toISOString().split('T')[0],
          status: 'ALL TRIPS', // Get all trips including completed
          limit: 1000 // Get more orders
        })
        
        console.log('📦 Trip History API Response:', response?.data)
        
        // Trip History API returns: { success: true, data: { trips: [...] } }
        let ordersData = []
        
        if (response?.data?.success && response?.data?.data?.trips) {
          // Trip History returns trips array
          ordersData = response.data.data.trips || []
          console.log('✅ Using Trip History API, found orders:', ordersData.length)
        } else if (response?.data?.data?.orders) {
          // Fallback to orders structure
          ordersData = response.data.data.orders || []
          console.log('✅ Using orders structure, found orders:', ordersData.length)
        } else if (Array.isArray(response?.data?.data)) {
          // Direct array
          ordersData = response.data.data
          console.log('✅ Using direct array, found orders:', ordersData.length)
        }
        
        console.log('✅ Final orders to set:', ordersData.length)
        console.log('✅ Orders sample:', ordersData.slice(0, 2))
        
        if (ordersData && ordersData.length > 0) {
          setOrders(ordersData)
          console.log('✅ Orders state updated successfully')
        } else {
          console.warn('⚠️ No orders found - trying getOrders API as fallback...')
          // Fallback to getOrders API
          try {
            const fallbackResponse = await deliveryAPI.getOrders({ 
              includeDelivered: 'true', 
              limit: 100 
            })
            if (fallbackResponse?.data?.success && fallbackResponse?.data?.data?.orders) {
              const fallbackOrders = fallbackResponse.data.data.orders || []
              console.log('✅ Fallback API found orders:', fallbackOrders.length)
              setOrders(fallbackOrders)
    } else {
              setOrders([])
            }
          } catch (fallbackError) {
            console.error('❌ Fallback API also failed:', fallbackError)
            setOrders([])
          }
        }
      } catch (error) {
        console.error('❌ ========== ERROR DETAILS ==========')
        console.error('❌ Error fetching orders:', error)
        console.error('❌ Error name:', error?.name)
        console.error('❌ Error message:', error?.message)
        console.error('❌ Error stack:', error?.stack)
        console.error('❌ Error response:', error?.response)
        console.error('❌ Error response data:', error?.response?.data)
        console.error('❌ Error response status:', error?.response?.status)
        console.error('❌ Error response statusText:', error?.response?.statusText)
        console.error('❌ Error response headers:', error?.response?.headers)
        console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
        console.error('❌ ========== END ERROR DETAILS ==========')
        
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load orders'
        toast.error(errorMessage)
        setOrders([])
      } finally {
        console.log('🏁 Setting loading to false')
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  // Format date like "06 Jan, 11:57AM"
  const formatOrderDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = date.toLocaleDateString('en-IN', { month: 'short' })
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${day} ${month}, ${displayHours}:${minutes}${ampm}`
  }

  // Get restaurant location/address
  const getRestaurantLocation = (order) => {
    // Try restaurant address first
    if (order.restaurantId?.location?.formattedAddress) {
      const addr = order.restaurantId.location.formattedAddress
      // Extract area/city from formatted address
      const parts = addr.split(',')
      if (parts.length >= 2) {
        return parts[parts.length - 2].trim() + ', ' + parts[parts.length - 1].trim()
      }
      return addr
    }
    if (order.restaurantId?.location?.area) {
      return order.restaurantId.location.area + ', ' + (order.restaurantId.location.city || '')
    }
    // Fallback to order address city
    if (order.address?.city) {
      return order.address.city + (order.address.state ? ', ' + order.address.state : '')
    }
    return 'Location not available'
  }

  // Get restaurant image (first item image or placeholder)
  const getRestaurantImage = (order) => {
    if (order.items && order.items.length > 0 && order.items[0].image) {
      return order.items[0].image
    }
    if (order.restaurantId?.profileImage?.url) {
      return order.restaurantId.profileImage.url
    }
    return "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=100&q=80"
  }

  // Check if payment failed
  const isPaymentFailed = (order) => {
    return order.payment?.status === 'failed' || order.payment?.status === 'pending'
  }

  // Get order status text
  const getOrderStatus = (order) => {
    const status = order.status || order.orderStatus
    if (status === 'delivered') return 'Delivered'
    if (status === 'completed') return 'Delivered'
    if (status === 'out_for_delivery') return 'Out for Delivery'
    if (status === 'ready') return 'Ready'
    if (status === 'preparing') return 'Preparing'
    if (status === 'accepted') return 'Accepted'
    return status || 'Pending'
  }

  // Debug: Log orders state changes
  useEffect(() => {
    console.log('📊 Orders state changed:', {
      ordersCount: orders.length,
      orders: orders,
      isArray: Array.isArray(orders),
      firstOrder: orders[0]
    })
  }, [orders])

  // Filter orders by search query
  const filteredOrders = orders.filter(order => {
    const orderId = String(order.orderId || order._id || "")
    if (hiddenOrderIds.has(orderId)) return false

    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const restaurantName = (order.restaurantName || order.restaurantId?.name || '').toLowerCase()
    const itemNames = (order.items || []).map(item => item.name?.toLowerCase() || '').join(' ')
    return restaurantName.includes(query) || itemNames.includes(query)
  })

  // Debug: Log filtered orders
  useEffect(() => {
    console.log('🔍 Filtered orders changed:', {
      searchQuery,
      filteredCount: filteredOrders.length,
      filteredOrders: filteredOrders
    })
  }, [filteredOrders, searchQuery])

  // Voice search using Web Speech API (if available in browser)
  const handleVoiceSearch = () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        toast.error("Voice search is not supported in this browser.")
        return
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = "en-IN"

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(" ")
          .trim()

        if (transcript) {
          setSearchQuery(transcript)
          toast.success(`Searching for "${transcript}"`)
        }
      }

      recognition.onerror = (event) => {
        if (event.error !== "no-speech") {
          console.error("Voice search error:", event.error)
          toast.error("Could not start voice search. Please try again.")
        }
      }

      recognition.start()
    } catch (error) {
      console.error("Voice search initialization failed:", error)
      toast.error("Voice search is not available right now.")
    }
  }

  const handleDeleteOrder = (order) => {
    const orderId = String(order.orderId || order._id || "")
    if (!orderId) return

    const confirmed = window.confirm(`Do you want to delete order #${order.orderId || orderId}?`)
    if (!confirmed) return

    const nextHiddenOrderIds = hideOrderId("delivery", orderId)
    setHiddenOrderIds(new Set(nextHiddenOrderIds))
    setActiveMenuOrderId(null)
    toast.success("Order deleted from your list")
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10 font-sans">
      {/* Header */}
      <div className="bg-white p-4 flex items-center shadow-sm sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700" />
                    </button>
        <h1 className="ml-4 text-xl font-semibold text-gray-800">Your Orders</h1>
        {/* Debug: Show orders count and state */}
        {!loading && (
          <div className="ml-auto text-xs text-gray-500 flex flex-col items-end">
            <span>({orders.length} orders, {filteredOrders.length} filtered)</span>
            {process.env.NODE_ENV === 'development' && (
        <button
                onClick={() => {
                  console.log('🔍 Current State:', {
                    orders,
                    filteredOrders,
                    loading,
                    searchQuery
                  })
                  toast.info(`Orders: ${orders.length}, Filtered: ${filteredOrders.length}`)
                }}
                className="text-[10px] mt-1 px-2 py-0.5 bg-gray-200 rounded"
              >
                Debug
              </button>
            )}
        </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white mt-1">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
          <Search className="w-5 h-5 text-red-500" />
          <input 
            type="text" 
            placeholder="Search by restaurant or dish" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 ml-3 outline-none text-gray-600 placeholder-gray-400"
          />
          <button
            type="button"
            onClick={handleVoiceSearch}
            className="ml-2 pl-2 border-l border-gray-300 text-red-500 hover:text-red-600 focus:outline-none"
            aria-label="Voice search"
          >
            <Mic className="w-5 h-5" />
          </button>
            </div>
          </div>
          
      {/* Orders List */}
      <div className="px-4 py-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-4" />
            <p className="text-gray-600">Loading orders...</p>
            </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? "No orders found" : "You haven't placed any orders yet"}
            </h3>
            <p className="text-gray-600 text-sm text-center mb-6">
              {searchQuery 
                ? "Try searching with different keywords"
                : "Start accepting orders to see them here"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const restaurantName = order.restaurantName || order.restaurantId?.name || 'Restaurant'
              const restaurantLocation = getRestaurantLocation(order)
              const restaurantImage = getRestaurantImage(order)
              const orderDate = formatOrderDate(order.createdAt)
              const orderStatus = getOrderStatus(order)
              const orderPrice = order.pricing?.total || order.total || 0
              const paymentFailed = isPaymentFailed(order)
              const isDelivered = order.status === 'delivered' || order.status === 'completed'
              // Rating - check if available in order data (might be in deliveryState or separate field)
              const rating = order.rating || order.deliveryState?.rating || null

              const orderKey = order.orderId || order._id || `order-${Math.random()}`
              
              return (
                <div key={orderKey} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Card Header: Restaurant Info */}
                  <div className="flex items-start justify-between p-4 pb-2">
                    <div className="flex gap-3">
                      {/* Restaurant/Food Image */}
                      <div className="w-14 h-14 rounded-lg bg-gray-200 overflow-hidden shrink-0">
            <img 
                          src={restaurantImage} 
                          alt={restaurantName}
              className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=100&q=80"
                          }}
            />
      </div>

                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 text-lg leading-tight">{restaurantName}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{restaurantLocation}</p>
                        <button 
                          onClick={() => navigate(`/restaurant/${order.restaurantId?.slug || order.restaurantId?._id || order.restaurantId}`)}
                          className="text-xs text-red-500 font-medium flex items-center mt-1 hover:text-red-600"
                        >
                          View menu <span className="ml-0.5">▸</span>
                        </button>
        </div>
      </div>

                    <button
                      type="button"
                      onClick={() => setActiveMenuOrderId(current => current === orderKey ? null : orderKey)}
                      className="p-1 hover:bg-gray-100 rounded-full"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-400" />
            </button>
        </div>

                  {activeMenuOrderId === orderKey && (
                    <>
                      <button
                        type="button"
                        aria-label="Close order actions"
                        onClick={() => setActiveMenuOrderId(null)}
                        className="fixed inset-0 z-30 bg-black/30"
                      />
                      <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl bg-white px-4 pb-6 pt-3 shadow-2xl">
                        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{restaurantName}</p>
                            <p className="text-xs text-gray-500">Order #{order.orderId || order._id}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveMenuOrderId(null)}
                            className="rounded-full p-2 hover:bg-gray-100"
                          >
                            <X className="h-5 w-5 text-gray-500" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order)}
                          className="flex w-full items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-100"
                        >
                          Delete order
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}

                  {/* Separator */}
                  <div className="border-t border-dashed border-gray-200 mx-4 my-1"></div>

                  {/* Items List */}
                  <div className="px-4 py-2">
                    {order.items && order.items.map((item, idx) => (
                      <div key={item._id || item.itemId || idx} className="flex items-center gap-2 mt-1">
                        {/* Veg/Non-Veg Icon */}
                        {/* Veg/Non-Veg indicator (Veg = green, Non-Veg = red) */}
                        <div
                          className={`w-4 h-4 border ${item.isVeg ? "border-green-600" : "border-red-600"} flex items-center justify-center p-[2px] shrink-0`}
                        >
                          <div
                            className={`w-full h-full rounded-full ${item.isVeg ? "bg-green-600" : "bg-red-600"}`}
                          ></div>
              </div>
                        <span className="text-sm text-gray-700 font-medium">
                          {item.quantity || 1} x {item.name}
                        </span>
            </div>
          ))}
      </div>

                  {/* Date and Price */}
                  <div className="px-4 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Order placed on {orderDate}</p>
                      {!paymentFailed && isDelivered && (
                        <p className="text-xs font-medium text-gray-500 mt-1">{orderStatus}</p>
                      )}
        </div>
                    <div className="flex items-center">
                      <span className="text-sm font-semibold text-gray-800">₹{orderPrice.toFixed(2)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 ml-1" />
        </div>
      </div>

                  {/* Separator */}
                  <div className="border-t border-gray-100 mx-4"></div>

                  {/* Card Footer: Actions */}
                  <div className="px-4 py-3 flex items-center justify-between">
                    {/* Left Side: Rating or Error */}
                    {paymentFailed ? (
                      <div className="flex items-center gap-2">
                        <div className="bg-red-100 p-1 rounded-full">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                    </div>
                        <span className="text-xs font-semibold text-red-500">Payment failed</span>
                      </div>
                    ) : isDelivered && rating ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-800">You rated</span>
                          <div className="flex bg-yellow-400 text-white px-1 rounded text-[10px] items-center gap-0.5 h-4">
                            {rating}<Star className="w-2 h-2 fill-current" />
                    </div>
                  </div>
                        <button className="text-xs text-red-500 font-medium mt-0.5 flex items-center hover:text-red-600">
                          View your feedback <span className="ml-0.5">▸</span>
                        </button>
                </div>
                    ) : isDelivered ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-800">Order {orderStatus}</span>
          </div>
                        <button className="text-xs text-red-500 font-medium mt-0.5 flex items-center hover:text-red-600">
                          View details <span className="ml-0.5">▸</span>
                        </button>
        </div>
                    ) : (
                      <div>
                        <span className="text-sm text-gray-800">{orderStatus}</span>
              </div>
                    )}

                    {/* Right Side: Reorder Button */}
              <button
                      onClick={() => {
                        // Navigate to restaurant or reorder functionality
                        if (order.restaurantId) {
                          navigate(`/restaurant/${order.restaurantId?.slug || order.restaurantId?._id || order.restaurantId}`)
                        }
                      }}
                      className="bg-[#E23744] hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reorder
                    </button>
                    </div>
                  </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="flex justify-center mt-8 mb-4">
        <h1 className="text-4xl font-black text-gray-200 tracking-tighter italic">{companyName.toLowerCase()}</h1>
                  </div>
    </div>
  )
}
