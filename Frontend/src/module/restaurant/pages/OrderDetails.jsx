import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import Lenis from "lenis"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { restaurantAPI } from "@/lib/api"
import {
  ArrowLeft,
  Printer,
  FileText,
  Copy,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react"

// Mock order data - fallback for testing
const getMockOrderData = (orderId) => {
  // Match data from AllOrdersPage mock orders
  const orders = {
    "7593519447": {
      id: "7593519447",
      status: "REJECTED",
      date: "19 Dec",
      time: "06:35 AM",
      restaurant: "Kadhai Chammach Restaurant",
      address: "By Pass Road (South), Indore",
      customer: {
        name: "Aryan baghel",
        orderCount: 1,
        location: "Indore, Madhya Pradesh",
        distance: "5 kms"
      },
      items: [
        { name: "Egg Biryani", quantity: 1, price: 199, type: "Full" }
      ],
      billing: {
        itemSubtotal: 199,
        taxes: 0,
        total: 199,
        paymentStatus: "PAID"
      },
      reason: "Rejected by Restaurant: items were out of stock",
      timeline: [
        { event: "Order placed", timestamp: "19 Dec, 06:35 AM", status: "completed" },
        { event: "Rejected by manager", timestamp: "19 Dec, 06:37 AM", status: "rejected" }
      ]
    },
    "7591372071": {
      id: "7591372071",
      status: "REJECTED",
      date: "18 Dec",
      time: "04:04 AM",
      restaurant: "Kadhai Chammach Restaurant",
      address: "By Pass Road (South), Indore",
      customer: {
        name: "Mantavya katkoria",
        orderCount: 1,
        location: "Indore, Madhya Pradesh",
        distance: "5 kms"
      },
      items: [
        { name: "Egg Biryani", quantity: 1, price: 199 },
        { name: "Chicken Curry", quantity: 1, price: 39 }
      ],
      billing: {
        itemSubtotal: 238,
        taxes: 0,
        total: 238,
        paymentStatus: "PAID"
      },
      reason: "Rejected by Restaurant: items were out of stock",
      timeline: [
        { event: "Order placed", timestamp: "18 Dec, 04:04 AM", status: "completed" },
        { event: "Rejected by manager", timestamp: "18 Dec, 04:06 AM", status: "rejected" }
      ]
    },
    "7560307359": {
      id: "7560307359",
      status: "CANCELLED",
      date: "12 Dec",
      time: "04:27 AM",
      restaurant: "Kadhai Chammach Restaurant",
      address: "By Pass Road (South), Indore",
      customer: {
        name: "John Doe",
        orderCount: 1,
        location: "Indore, Madhya Pradesh",
        distance: "5 kms"
      },
      items: [
        { name: "Veg Biryani", quantity: 2, price: 150 }
      ],
      billing: {
        itemSubtotal: 300,
        taxes: 0,
        total: 300,
        paymentStatus: "PAID"
      },
      reason: "Cancelled by customer",
      timeline: [
        { event: "Order placed", timestamp: "12 Dec, 04:27 AM", status: "completed" },
        { event: "Cancelled by customer", timestamp: "12 Dec, 04:30 AM", status: "rejected" }
      ]
    }
  }

  return orders[orderId] || null
}

export default function OrderDetails() {
  const navigate = useNavigate()
  const { orderId } = useParams()

  // State for order data
  const [orderData, setOrderData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toast state
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  // Fetch order data from API
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await restaurantAPI.getOrderById(orderId)

        if (response.data?.success && response.data.data?.order) {
          const order = response.data.data.order
          const restaurantLocation = order.restaurantId?.location || {}
          const restaurantAddress = (
            order.restaurantId?.address ||
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
            ].filter(Boolean).join(", ")
          ) || "Address not available"

          const customerLocation = (
            order.address?.formattedAddress ||
            [
              order.address?.street,
              order.address?.area,
              order.address?.city,
              order.address?.state,
              order.address?.zipCode || order.address?.postalCode,
            ].filter(Boolean).join(", ")
          ) || "Location not available"

          // Transform API order data to match component structure
          const transformedOrder = {
            id: order.orderId || order._id,
            status: order.status?.toUpperCase() || 'PENDING',
            date: new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            time: new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            restaurant: order.restaurantName || order.restaurantId?.name || 'Restaurant',
            address: restaurantAddress,
            customer: {
              name: order.userId?.name || 'Customer',
              orderCount: 1,
              location: customerLocation,
              distance: 'N/A'
            },
            items: order.items?.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              type: item.isVeg ? 'Veg' : 'Non-Veg'
            })) || [],
            billing: {
              itemSubtotal: order.pricing?.subtotal || 0,
              taxes: order.pricing?.tax || 0,
              total: order.pricing?.total || 0,
              paymentStatus: order.payment?.status === 'completed' ? 'PAID' : 'PENDING'
            },
            reason: order.cancellationReason || '',
            note: order.note || '',
            sendCutlery: !!order.sendCutlery,
            timeline: [
              { event: 'Order placed', timestamp: new Date(order.createdAt).toLocaleString('en-GB'), status: 'completed' },
              ...(order.status === 'confirmed' ? [{ event: 'Order confirmed', timestamp: order.tracking?.confirmed?.timestamp ? new Date(order.tracking.confirmed.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(order.status === 'preparing' ? [{ event: 'Preparing', timestamp: order.tracking?.preparing?.timestamp ? new Date(order.tracking.preparing.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(order.status === 'ready' ? [{ event: 'Ready for pickup', timestamp: order.tracking?.ready?.timestamp ? new Date(order.tracking.ready.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(order.status === 'out_for_delivery' ? [{ event: 'Out for delivery', timestamp: order.tracking?.outForDelivery?.timestamp ? new Date(order.tracking.outForDelivery.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(order.status === 'delivered' ? [{ event: 'Delivered', timestamp: order.tracking?.delivered?.timestamp ? new Date(order.tracking.delivered.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(order.status === 'cancelled' ? [{ event: 'Cancelled', timestamp: order.cancelledAt ? new Date(order.cancelledAt).toLocaleString('en-GB') : '', status: 'rejected', reason: order.cancellationReason }] : [])
            ]
          }

          setOrderData(transformedOrder)
        } else {
          throw new Error('Order not found')
        }
      } catch (err) {
        console.error('Error fetching order:', err)
        setError(err.response?.data?.message || err.message || 'Failed to fetch order')

        // Try fallback to mock data for testing
        const mockData = getMockOrderData(orderId)
        if (mockData) {
          setOrderData(mockData)
          setError(null)
        }
      } finally {
        setLoading(false)
      }
    }

    if (orderId) {
      fetchOrder()
    }
  }, [orderId])

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  const handleCopyOrderId = () => {
    if (!orderData?.id) return
    navigator.clipboard.writeText(orderData.id)
    setToastMessage("Order ID copied to clipboard")
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }

  const handlePrintReceipt = async () => {
    try {
      setIsGeneratingPDF(true)
      setToastMessage("Generating receipt...")
      setShowToast(true)

      // Small delay to show the toast
      await new Promise(resolve => setTimeout(resolve, 300))

      // Check if orderData exists
      if (!orderData) {
        throw new Error("Order data not found")
      }

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let yPosition = 20

      // Header - Restaurant Name
      doc.setFontSize(18)
      doc.setFont("helvetica", "bold")
      doc.text(orderData.restaurant, pageWidth / 2, yPosition, { align: "center" })
      yPosition += 7

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text(orderData.address, pageWidth / 2, yPosition, { align: "center" })
      yPosition += 15

      // Order Receipt Title
      doc.setFontSize(16)
      doc.setFont("helvetica", "bold")
      doc.text("ORDER RECEIPT", pageWidth / 2, yPosition, { align: "center" })
      yPosition += 10

      // Horizontal line
      doc.setLineWidth(0.5)
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 10

      // Order Information
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("Order ID:", 15, yPosition)
      doc.setFont("helvetica", "normal")
      doc.text(String(orderData.id || "N/A"), 50, yPosition)
      yPosition += 7

      doc.setFont("helvetica", "bold")
      doc.text("Date & Time:", 15, yPosition)
      doc.setFont("helvetica", "normal")
      doc.text(`${orderData.date || "N/A"}, ${orderData.time || "N/A"}`, 50, yPosition)
      yPosition += 7

      doc.setFont("helvetica", "bold")
      doc.text("Status:", 15, yPosition)
      doc.setFont("helvetica", "normal")
      // Set color based on status
      if (orderData.status === "REJECTED" || orderData.status === "CANCELLED") {
        doc.setTextColor(220, 38, 38) // Red
      } else if (orderData.status === "DELIVERED") {
        doc.setTextColor(103, 30, 31)
      }
      doc.text(String(orderData.status || "N/A"), 50, yPosition)
      doc.setTextColor(0, 0, 0) // Reset to black
      yPosition += 10

      // Customer Details Section
      doc.setLineWidth(0.5)
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 8

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("CUSTOMER DETAILS", 15, yPosition)
      yPosition += 8

      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.text("Name:", 15, yPosition)
      doc.setFont("helvetica", "normal")
      doc.text(String(orderData.customer?.name || "Customer"), 50, yPosition)
      yPosition += 6

      doc.setFont("helvetica", "bold")
      doc.text("Location:", 15, yPosition)
      doc.setFont("helvetica", "normal")
      const customerLocationLines = doc.splitTextToSize(String(orderData.customer?.location || "Location not available"), pageWidth - 65)
      doc.text(customerLocationLines, 50, yPosition)
      yPosition += customerLocationLines.length * 5
      yPosition += 1

      doc.setFont("helvetica", "bold")
      doc.text("Distance:", 15, yPosition)
      doc.setFont("helvetica", "normal")
      doc.text(String(orderData.customer?.distance || "N/A"), 50, yPosition)
      yPosition += 10

      // Items Section
      doc.setLineWidth(0.5)
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 8

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("ITEM DETAILS", 15, yPosition)
      yPosition += 5

      // Items Table
      const itemsTableData = orderData.items.map(item => [
        `${item.quantity || 1}x`,
        String(item.name || "Item"),
        item.type || "-",
        `Rs. ${Number(item.price || 0).toFixed(2)}`
      ])

      // Use autoTable with the doc instance
      autoTable(doc, {
        startY: yPosition,
        head: [["Qty", "Item Name", "Type", "Price"]],
        body: itemsTableData,
        theme: "grid",
        headStyles: {
          fillColor: [55, 65, 81],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: "bold"
        },
        bodyStyles: {
          fontSize: 9
        },
        margin: { left: 15, right: 15 }
      })

      yPosition = doc.lastAutoTable.finalY + 10

      // Bill Details Section
      doc.setLineWidth(0.5)
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 8

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("BILL DETAILS", 15, yPosition)
      yPosition += 8

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text("Item Subtotal:", 15, yPosition)
      doc.text(`Rs. ${orderData.billing.itemSubtotal}`, pageWidth - 15, yPosition, { align: "right" })
      yPosition += 6

      doc.text("Taxes:", 15, yPosition)
      doc.text(`Rs. ${orderData.billing.taxes}`, pageWidth - 15, yPosition, { align: "right" })
      yPosition += 6

      // Dashed line for total
      doc.setLineDash([2, 2])
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 6
      doc.setLineDash([]) // Reset to solid line

      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.text("Total Bill:", 15, yPosition)
      doc.text(`Rs. ${orderData.billing.total}`, pageWidth - 15, yPosition, { align: "right" })
      yPosition += 6

      // Rejection/Cancellation Reason (if exists)
      if (orderData.reason) {
        doc.setLineWidth(0.5)
        doc.line(15, yPosition, pageWidth - 15, yPosition)
        yPosition += 8

        doc.setFontSize(11)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(220, 38, 38)
        doc.text("REASON:", 15, yPosition)
        yPosition += 6

        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        const reasonLines = doc.splitTextToSize(orderData.reason, pageWidth - 30)
        doc.text(reasonLines, 15, yPosition)
        yPosition += (reasonLines.length * 5) + 5
        doc.setTextColor(0, 0, 0)
      }

      // Order Timeline
      if (yPosition + 40 > doc.internal.pageSize.getHeight()) {
        doc.addPage()
        yPosition = 20
      }

      doc.setLineWidth(0.5)
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 8

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("ORDER TIMELINE", 15, yPosition)
      yPosition += 8

      orderData.timeline.forEach((event, index) => {
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")

        // Add status indicator
        if (event.status === "completed") {
          doc.setFillColor(103, 30, 31)
        } else if (event.status === "rejected") {
          doc.setFillColor(220, 38, 38)
        } else {
          doc.setFillColor(156, 163, 175)
        }
        doc.circle(18, yPosition - 1, 2, "F")

        doc.setTextColor(0, 0, 0)
        doc.text(event.event, 25, yPosition)
        yPosition += 5

        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(100, 100, 100)
        doc.text(event.timestamp, 25, yPosition)
        yPosition += 8
        doc.setTextColor(0, 0, 0)
      })

      // Footer
      yPosition = doc.internal.pageSize.getHeight() - 20
      doc.setFontSize(8)
      doc.setFont("helvetica", "italic")
      doc.setTextColor(100, 100, 100)
      doc.text("Thank you for your business!", pageWidth / 2, yPosition, { align: "center" })
      yPosition += 5
      doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: "center" })

      // Save the PDF
      doc.save(`Order_Receipt_${orderData.id}.pdf`)

      // Show success message
      setToastMessage("Receipt downloaded successfully!")
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
    } catch (error) {
      console.error("Error generating PDF:", error)
      console.error("Error details:", error.message, error.stack)
      setToastMessage(`Failed: ${error.message || "Unknown error"}`)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } finally {
      setIsGeneratingPDF(false)
    }

  }

  const getStatusColor = (status) => {
    switch (status) {
      case "REJECTED":
      case "CANCELLED":
        return "bg-red-700 text-white"
      case "DELIVERED":
        return "bg-red-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !orderData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/restaurant/orders')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  // No order data
  if (!orderData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">The order you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/restaurant/orders')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white  px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900">Order details</h1>
            <p className="text-xs text-gray-600 truncate">
              ID: {orderData.id}, {orderData.restaurant?.substring(0, 20) || 'Restaurant'}...
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintReceipt}
              disabled={isGeneratingPDF}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
              aria-label="Print"
            >
              {isGeneratingPDF ? (
                <svg className="animate-spin h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <Printer className="w-5 h-5 text-gray-900" />
              )}
            </button>
            <button
              onClick={handlePrintReceipt}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Receipt"
            >
              <FileText className="w-5 h-5 text-gray-900" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Order Summary Card */}
        <div className="bg-white rounded-lg p-4">
          {/* Status and Order ID Row */}
          <div className="flex items-start justify-between mb-3">
            <span className={`px-2.5 py-1 rounded text-xs font-bold ${getStatusColor(orderData.status)}`}>
              {orderData.status}
            </span>
            <span className="text-xs text-gray-500">{orderData.date}, {orderData.time}</span>
          </div>

          {/* Order ID */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base font-bold text-gray-900">ID: {orderData.id}</span>
            <button
              onClick={handleCopyOrderId}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Copy order ID"
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Restaurant Info */}
          <p className="text-sm text-gray-900 mb-3">
            {orderData.restaurant}, {orderData.address}
          </p>

          {/* Customer Note & Cutlery */}
          {(orderData.note || orderData.sendCutlery) && (
            <div className="space-y-2 mt-3 pt-3 border-t border-gray-200">
              {orderData.note && (
                <p className="text-sm text-gray-700"><span className="font-semibold">Customer note:</span> {orderData.note}</p>
              )}
              {orderData.sendCutlery && (
                <p className="text-sm text-gray-700"><span className="font-semibold">Cutlery:</span> Yes</p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200 my-3"></div>

          {/* Rejection Reason */}
          {orderData.reason && (
            <p className="text-sm text-red-600">{orderData.reason}</p>
          )}
        </div>

        {/* Customer Details Section */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Customer details</h2>

          {/* Customer Card */}
          <div className="bg-white rounded-lg p-4 gap-8 flex flex-col mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{orderData.customer.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{orderData.customer.orderCount} order with you</p>
              </div>

              <hr className="border-gray-200 my-3" />

            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-600" />
              <div className="flex-1">
                <p className="text-sm text-gray-900">{orderData.customer.location}</p>
              </div>
              {orderData.customer.distance && orderData.customer.distance !== 'N/A' && (
                <p className="text-sm text-gray-600">{orderData.customer.distance}</p>
              )}
            </div>
          </div>

        </div>

        {/* Item Details Section */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Item details</h2>

          {orderData.items.map((item, index) => (
            <div key={index} className="bg-white rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center mt-0.5">
                  <span className="text-red-600 text-xs">▲</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {item.quantity} x {item.name}
                      {item.selectedVariation?.variationName && (
                        <span className="block text-xs font-normal text-gray-500 mt-0.5">{item.selectedVariation.variationName}</span>
                      )}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">₹{item.price}</p>
                  </div>
                  {item.type && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Quantity</span>
                      <span>{item.type}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bill Details Section */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Bill details</h2>

          <div className="bg-white  rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">Item subtotal</span>
              <span className="text-sm text-gray-900">₹{orderData.billing.itemSubtotal}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">Taxes</span>
              <span className="text-sm text-gray-900">₹{orderData.billing.taxes}</span>
            </div>
            <div className="my-3"></div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Total bill</span>
              <span className="text-sm font-semibold text-gray-900">₹{orderData.billing.total}</span>
            </div>
          </div>
        </div>

        {/* Order Timeline Section */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Order timeline</h2>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>

              {/* Timeline Events */}
              <div className="space-y-4">
                {orderData.timeline.map((event, index) => (
                  <div key={index} className="relative flex items-start gap-3">
                    {/* Icon */}
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${event.status === "completed"
                      ? "bg-gray-900"
                      : event.status === "rejected"
                        ? "bg-red-600"
                        : "bg-gray-400"
                      }`}>
                      {event.status === "completed" ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : (
                        <XCircle className="w-4 h-4 text-white" />
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="flex-1 pt-1">
                      <p className="text-sm text-gray-900">{event.event}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{event.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 max-w-sm"
          >
            {isGeneratingPDF ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="text-sm font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
