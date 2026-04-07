import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  MapPin,
  Utensils,
  ChefHat,
  DollarSign,
  Home,
  FileText,
  UtensilsCrossed,
  User
} from "lucide-react"
import {
  getDeliveryOrderStatus,
  getDeliveryStatusMessage,
  saveDeliveryOrderStatus,
  normalizeDeliveryStatus,
  DELIVERY_ORDER_STATUS
} from "../utils/deliveryOrderStatus"
import {
  getDeliveryOrderPaymentStatus
} from "../utils/deliveryWalletState"
import { deliveryAPI } from "@/lib/api"
import { toast } from "sonner"

export default function AcceptedOrderDetails() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [orderStatus, setOrderStatus] = useState(() => getDeliveryOrderStatus(orderId))
  const [paymentStatus, setPaymentStatus] = useState(() => getDeliveryOrderPaymentStatus(orderId))

  // Fetch order data from real API
  useEffect(() => {
    const fetchOrderData = async () => {
      try {
        setIsLoading(true)
        const response = await deliveryAPI.getOrderDetails(orderId)
        if (response.data?.success) {
          setOrder(response.data.data)
        } else {
          toast.error("Failed to fetch order details")
        }
      } catch (error) {
        console.error("Error fetching order details:", error)
        toast.error("Error loading order details")
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrderData()
  }, [orderId])

  // Listen for order status updates
  useEffect(() => {
    const handleStatusUpdate = () => {
      setOrderStatus(getDeliveryOrderStatus(orderId))
      setPaymentStatus(getDeliveryOrderPaymentStatus(orderId))
    }

    window.addEventListener('deliveryOrderStatusUpdated', handleStatusUpdate)
    window.addEventListener('deliveryWalletStateUpdated', handleStatusUpdate)
    window.addEventListener('storage', handleStatusUpdate)

    return () => {
      window.removeEventListener('deliveryOrderStatusUpdated', handleStatusUpdate)
      window.removeEventListener('deliveryWalletStateUpdated', handleStatusUpdate)
      window.removeEventListener('storage', handleStatusUpdate)
    }
  }, [orderId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-gray-500 mb-4">Order not found</p>
        <button onClick={() => navigate(-1)} className="text-orange-500 font-medium">Go Back</button>
      </div>
    )
  }

  const statusMessage = getDeliveryStatusMessage(orderStatus)
  const normalizedOrderStatus = normalizeDeliveryStatus(orderStatus)
  const deliveryPhase = String(order?.deliveryState?.currentPhase || "").toLowerCase()
  const deliveryStateStatus = String(order?.deliveryState?.status || "").toLowerCase()
  const hasReachedDrop =
    normalizedOrderStatus === DELIVERY_ORDER_STATUS.DELIVERED ||
    ["at_drop", "completed"].includes(deliveryPhase) ||
    ["reached_drop", "completed"].includes(deliveryStateStatus)
  const restaurantLocation = order.restaurantId?.location || order.restaurant?.location || {}
  const restaurantCoordinates = Array.isArray(restaurantLocation.coordinates)
    ? {
        lat: restaurantLocation.coordinates[1],
        lng: restaurantLocation.coordinates[0],
      }
    : {
        lat: order.restaurantLat ?? order.restaurant?.lat,
        lng: order.restaurantLng ?? order.restaurant?.lng,
      }

  const restaurantAddress = (
    order.restaurantId?.address ||
    order.restaurant?.address ||
    restaurantLocation.formattedAddress ||
    restaurantLocation.address ||
    [
      restaurantLocation.addressLine1,
      restaurantLocation.addressLine2,
      restaurantLocation.street,
      restaurantLocation.area,
      restaurantLocation.city,
      restaurantLocation.state,
      restaurantLocation.pincode || restaurantLocation.zipCode || restaurantLocation.postalCode,
    ]
      .filter(Boolean)
      .join(", ")
  ) || "Restaurant address not available"

  const openMapLocation = (lat, lng, address, fallbackLabel) => {
    if (lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, "_blank")
      return
    }

    const trimmedAddress = String(address || "").trim()
    if (trimmedAddress) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedAddress)}`, "_blank")
      return
    }

    toast.error(`${fallbackLabel} location not available`)
  }

  // Map backend order to frontend orderData structure
  const orderData = {
    id: order.orderId || orderId,
    status: orderStatus,
    deliveryTime: order.estimatedDeliveryTime ? `${order.estimatedDeliveryTime} Min` : "N/A",
    customer: {
      name: order.userId?.name || order.customerName || "Customer",
      address: order.address?.formattedAddress || order.deliveryAddress || "N/A",
      phone: order.userId?.phone || order.customerPhone,
      image: order.userId?.image || "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=100&h=100&fit=crop&q=80"
    },
    restaurant: {
      name: order.restaurantName || order.restaurantId?.name || order.restaurant?.name || "Restaurant",
      address: restaurantAddress,
      rating: order.restaurantId?.rating || order.restaurant?.rating || 4.0
    },
    items: order.items?.map((item, idx) => ({
      id: item.itemId || idx,
      name: item.name,
      price: item.price,
      variation: item.selectedVariation?.variationName || "",
      subCategory: item.subCategory || "",
      quantity: item.quantity,
      type: item.isVeg ? "Veg" : "Non Veg",
      image: item.image || "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=100&h=100&fit=crop&q=80"
    })) || [],
    cutlery: order.sendCutlery ? "Yes" : "No",
    paymentMethod: {
      status: paymentStatus || (order.payment?.status === 'pending' ? 'Unpaid' : order.payment?.status),
      method: order.payment?.method === 'cash' ? 'Cash' : 'Online'
    },
    billing: {
      subtotal: order.pricing?.totalItemAmount || 0,
      deliverymanTips: 0.00,
      total: order.pricing?.total || order.totalAmount || 0
    },
    deliveryInstructions: order.deliveryInstructions || order.note || "",
    statusMessage: statusMessage.message,
    statusDescription: statusMessage.description
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:py-3 flex items-center justify-between rounded-b-3xl md:rounded-b-none sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-gray-900 font-medium">Order #{orderData.id}</p>
          <p className="text-[#ff8100] text-sm font-medium">{orderData.status}</p>
        </div>
        <div className="w-10"></div>
      </div>

      {/* Delivery Time Estimate */}
      <div className="px-4 py-4 bg-transparent border-none">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-14 h-14 bg-red-100 rounded-lg flex items-center justify-center relative overflow-hidden">
              <Utensils className="w-7 h-7 text-red-600 z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-orange-400 to-red-500 opacity-60"></div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Food need to deliver within</p>
            <p className="text-[#ff8100] font-bold text-lg">{orderData.deliveryTime}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Customer Contact Details */}
        <div>
          <h3 className="text-gray-900 font-semibold mb-3">Customer Contact Details</h3>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <img
                src={orderData.customer.image}
                alt="Customer"
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-medium mb-1">{orderData.customer.name}</p>
                <p className="text-gray-600 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{orderData.customer.address}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => navigate(`/delivery/orders/${orderId}/chat`)}
                  className="w-10 h-10 rounded-full bg-[#ff8100] flex items-center justify-center hover:bg-[#e67300] transition-colors"
                >
                  <MessageCircle className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => {
                    const phone = orderData.customer.phone;
                    if (phone) window.open(`tel:${phone}`, '_self');
                    else toast.error("Phone number not available");
                  }}
                  className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <Phone className="w-5 h-5 text-white" />
                </button>
                {!hasReachedDrop && (
                  <button
                    onClick={() => {
                      const customerLocation = order.address?.location
                      const coords = Array.isArray(customerLocation?.coordinates)
                        ? {
                            lat: customerLocation.coordinates[1],
                            lng: customerLocation.coordinates[0],
                          }
                        : {
                            lat: order.customerLat,
                            lng: order.customerLng,
                          }

                      openMapLocation(
                        coords.lat,
                        coords.lng,
                        orderData.customer.address,
                        "Customer",
                      )
                    }}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <MapPin className="w-5 h-5 text-gray-600" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Restaurant Details */}
        <div>
          <h3 className="text-gray-900 font-semibold mb-3">Restaurant Details</h3>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-[#ff8100]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-medium mb-1">{orderData.restaurant.name}</p>
                <p className="text-gray-600 text-sm mb-1 whitespace-nowrap overflow-hidden text-ellipsis">{orderData.restaurant.address}</p>
                <div className="flex items-center gap-1">
                  <span className="text-orange-500">★</span>
                  <span className="text-gray-600 text-sm">{orderData.restaurant.rating}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => {
                    const phone =
                      order.restaurantId?.phone ||
                      order.restaurantId?.ownerPhone ||
                      order.restaurant?.phone ||
                      order.restaurantPhone
                    if (phone) window.open(`tel:${phone}`, '_self');
                    else toast.error("Phone number not available");
                  }}
                  className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <Phone className="w-5 h-5 text-white" />
                </button>
                {!hasReachedDrop && (
                  <button
                    onClick={() => {
                      openMapLocation(
                        restaurantCoordinates.lat,
                        restaurantCoordinates.lng,
                        orderData.restaurant.address,
                        "Restaurant",
                      )
                    }}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <MapPin className="w-5 h-5 text-gray-600" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Item Info */}
        <div>
          <h3 className="text-gray-900 font-semibold mb-3">Item Info ({orderData.items.length})</h3>
          <div className="space-y-4">
            {orderData.items.map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-medium mb-1 truncate">{item.name}</p>
                    <p className="text-[#ff8100] font-bold mb-1">₹ {item.price.toFixed(2)}</p>
                    {item.subCategory && (
                      <p className="text-gray-500 text-xs mb-1">({item.subCategory})</p>
                    )}
                    {(item.variation) && (
                      <p className="text-gray-600 text-xs">Variation: {item.variation}</p>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="text-gray-900 text-sm font-medium mb-2">Qty: {item.quantity}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.type === 'Veg' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Instructions */}
        {orderData.deliveryInstructions && (
          <div>
            <h3 className="text-gray-900 font-semibold mb-3">Delivery Instructions</h3>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-gray-600 text-sm italic">"{orderData.deliveryInstructions}"</p>
            </div>
          </div>
        )}

        {/* Payment & Billing */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-900 font-medium">Payment Method</span>
              <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs uppercase">{orderData.paymentMethod.status}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <span className="text-gray-900 font-medium">{orderData.paymentMethod.method}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="text-gray-900 font-semibold mb-2">Billing Info</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900 font-medium">₹ {orderData.billing.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-[#ff8100] font-bold">Total Amount</span>
              <span className="text-[#ff8100] font-bold text-lg">₹ {orderData.billing.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {(() => {
        const normalizedStatus = normalizeDeliveryStatus(orderStatus)
        const isDelivered = normalizedStatus === DELIVERY_ORDER_STATUS.DELIVERED
        const isCancelled = normalizedStatus === DELIVERY_ORDER_STATUS.CANCELLED

        if (isDelivered || isCancelled) return null

        return (
          <div className="fixed bottom-28 md:bottom-12 left-0 right-0 px-4 z-[60]">
            <div className="bg-white rounded-xl shadow-xl p-3 border border-gray-100">
              {normalizedStatus === DELIVERY_ORDER_STATUS.ACCEPTED && (
                <button
                  onClick={() => {
                    saveDeliveryOrderStatus(orderId, DELIVERY_ORDER_STATUS.PICKED_UP)
                    setOrderStatus(DELIVERY_ORDER_STATUS.PICKED_UP)
                    toast.success("Order marked as Picked Up")
                  }}
                  className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
                >
                  Mark as Picked Up
                </button>
              )}
              {normalizedStatus === DELIVERY_ORDER_STATUS.PICKED_UP && (
                <button
                  onClick={() => {
                    saveDeliveryOrderStatus(orderId, DELIVERY_ORDER_STATUS.ON_THE_WAY)
                    setOrderStatus(DELIVERY_ORDER_STATUS.ON_THE_WAY)
                    toast.success("Order marked as On the Way")
                  }}
                  className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
                >
                  Mark as On the Way
                </button>
              )}
              {normalizedStatus === DELIVERY_ORDER_STATUS.ON_THE_WAY && (
                <button
                  onClick={() => {
                    saveDeliveryOrderStatus(orderId, DELIVERY_ORDER_STATUS.DELIVERED)
                    setOrderStatus(DELIVERY_ORDER_STATUS.DELIVERED)
                    localStorage.removeItem('activeOrder')
                    window.dispatchEvent(new CustomEvent('activeOrderUpdated'))
                    toast.success("Order marked as Delivered!")
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
                >
                  Mark as Delivered
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* Status Bar */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-[#ff8100] px-4 py-4 z-[55] shadow-lg">
        <p className="text-white font-bold text-center">{orderData.statusMessage}</p>
        <p className="text-white/80 text-xs text-center">{orderData.statusDescription}</p>
      </div>
    </div>
  )
}
