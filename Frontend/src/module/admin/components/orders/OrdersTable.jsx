import { useState, useMemo } from "react"
import { Eye, Download, ArrowUpDown, Loader2, Phone } from "lucide-react"

const getStatusColor = (orderStatus) => {
  const colors = {
    "Delivered": "bg-red-100 text-red-700",
    "Pending": "bg-blue-100 text-blue-700",
    "Scheduled": "bg-blue-100 text-blue-700",
    "Accepted": "bg-red-100 text-red-700",
    "Processing": "bg-orange-100 text-orange-700",
    "Food On The Way": "bg-yellow-100 text-yellow-700",
    "Canceled": "bg-rose-100 text-rose-700",
    "Cancelled by Restaurant": "bg-red-100 text-red-700",
    "Cancelled by User": "bg-orange-100 text-orange-700",
    "Payment Failed": "bg-red-100 text-red-700",
    "Refunded": "bg-sky-100 text-sky-700",
    "Dine In": "bg-indigo-100 text-indigo-700",
    "Offline Payments": "bg-slate-100 text-slate-700",
  }
  return colors[orderStatus] || "bg-slate-100 text-slate-700"
}

const getPaymentStatusColor = (paymentStatus) => {
  if (paymentStatus === "Paid") return "text-red-600"
  if (paymentStatus === "Unpaid" || paymentStatus === "Failed") return "text-red-600"
  if (paymentStatus === "COD") return "text-amber-600"
  return "text-slate-600"
}

export default function OrdersTable({ orders, visibleColumns, onViewOrder, onPrintOrder, onRefund }) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.ceil(orders.length / itemsPerPage)

  const effectivePage = Math.min(currentPage, Math.max(totalPages, 1))

  const paginatedOrders = useMemo(() => {
    const start = (effectivePage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return orders.slice(start, end)
  }, [orders, effectivePage])

  const formatRestaurantName = (name) => {
    if (name === "Cafe Monarch") return "Café Monarch"
    return name
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-md">
              <span className="text-5xl text-orange-500 font-bold">!</span>
            </div>
          </div>
          <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
          <p className="text-sm text-slate-500">There are no orders matching your criteria</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full max-w-full">
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
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
              {visibleColumns.orderId && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.orderDate && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.customer && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Customer Information</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.restaurant && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Restaurant</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.foodItems && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span>Food Items</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.totalAmount && (
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2">
                    <span>Total Amount</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {(visibleColumns.paymentType !== false) && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Payment Type</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {(visibleColumns.paymentCollectionStatus !== false) && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Payment Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.orderStatus && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.actions && (
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {paginatedOrders.map((order, index) => (
              <tr
                key={order.orderId}
                className="hover:bg-slate-50 transition-colors"
              >
                {visibleColumns.si && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">{(effectivePage - 1) * itemsPerPage + index + 1}</span>
                  </td>
                )}
                {visibleColumns.orderId && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-900">{order.orderId}</span>
                  </td>
                )}
                {visibleColumns.orderDate && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">{order.date}, {order.time}</span>
                  </td>
                )}
                {visibleColumns.customer && (
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">{order.customerName}</span>
                      <span className="text-xs text-slate-500 mt-0.5">{order.customerPhone}</span>
                    </div>
                  </td>
                )}
                {visibleColumns.restaurant && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">{formatRestaurantName(order.restaurant)}</span>
                  </td>
                )}
                {visibleColumns.foodItems && (
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2 min-w-[200px] max-w-md">
                      {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                        order.items.map((item, idx) => (
                          <div key={idx || item.itemId || idx} className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded min-w-[2.5rem] text-center">
                              {item.quantity || 1}x
                            </span>
                            <span className="text-slate-800 font-medium flex-1">
                              {item.name || 'Unknown Item'}
                            </span>
                            {item.price && (
                              <span className="text-xs text-slate-500">
                                ₹{item.price}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400 italic">No items found</span>
                      )}
                    </div>
                  </td>
                )}
                {visibleColumns.totalAmount && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-slate-900">
                      ₹{order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`text-xs mt-0.5 ${getPaymentStatusColor(order.paymentStatus)}`}>
                      {order.paymentStatus}
                    </div>
                  </td>
                )}
                {(visibleColumns.paymentType !== false) && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      // Determine payment type display
                      let paymentTypeDisplay = order.paymentType;

                      if (!paymentTypeDisplay) {
                        const paymentMethod = order.payment?.method || order.paymentMethod;
                        if (paymentMethod === 'cash' || paymentMethod === 'cod') {
                          paymentTypeDisplay = 'Cash on Delivery';
                        } else if (paymentMethod === 'wallet') {
                          paymentTypeDisplay = 'Wallet';
                        } else {
                          paymentTypeDisplay = 'Online';
                        }
                      }

                      // Override if payment method is wallet but paymentType is not set correctly
                      const paymentMethod = order.payment?.method || order.paymentMethod;
                      if (paymentMethod === 'wallet' && paymentTypeDisplay !== 'Wallet') {
                        paymentTypeDisplay = 'Wallet';
                      }

                      const isCod = paymentTypeDisplay === 'Cash on Delivery';
                      const isWallet = paymentTypeDisplay === 'Wallet';

                      return (
                        <span className={`text-sm font-medium ${isCod ? 'text-amber-600' :
                          isWallet ? 'text-purple-600' :
                            'text-red-600'
                          }`}>
                          {paymentTypeDisplay}
                        </span>
                      );
                    })()}
                  </td>
                )}
                {(visibleColumns.paymentCollectionStatus !== false) && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const isCod = order.paymentType === 'Cash on Delivery' || order.payment?.method === 'cash' || order.payment?.method === 'cod'
                      const status = order.paymentCollectionStatus ?? (isCod ? 'Not Collected' : 'Collected')
                      return (
                        <span className={`text-sm font-medium ${status === 'Collected' ? 'text-red-600' : 'text-amber-600'}`}>
                          {status}
                        </span>
                      )
                    })()}
                  </td>
                )}
                {visibleColumns.orderStatus && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                        <span className="text-xs text-slate-500">{order.deliveryType}</span>
                      </div>
                      {order.cancellationReason && (
                        <div className="text-xs text-red-600 mt-1">
                          <span className="font-medium">
                            {order.cancelledBy === 'user' ? 'Cancelled by User - ' :
                              order.cancelledBy === 'restaurant' ? 'Cancelled by Restaurant - ' :
                                'Reason: '}
                          </span>
                          {order.cancellationReason}
                        </div>
                      )}
                    </div>
                  </td>
                )}
                {visibleColumns.actions && (
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onViewOrder(order)}
                        className="p-1.5 rounded text-orange-600 hover:bg-orange-50 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {order.customerPhone && (
                        <button
                          onClick={() => window.open(`tel:${order.customerPhone}`, '_self')}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                          title={`Call Customer: ${order.customerPhone}`}
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onPrintOrder(order)}
                        className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Download Order"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {/* Show Refund button or Refunded status for cancelled orders with Online/Wallet payment (restaurant or user cancelled) */}
                      {(() => {
                        // Check if order is cancelled by restaurant or user
                        const isCancelled = order.orderStatus === "Cancelled by Restaurant" ||
                          order.orderStatus === "Cancelled" ||
                          order.orderStatus === "Cancelled by User" ||
                          (order.status === "cancelled" && (order.cancelledBy === "user" || order.cancelledBy === "restaurant"));

                        // Check if payment type is Online or Wallet (not Cash on Delivery)
                        const paymentMethod = order.payment?.method || order.paymentMethod;
                        const isOnlinePayment = order.paymentType === "Online" ||
                          (order.paymentType !== "Cash on Delivery" &&
                            order.payment?.method !== "cash" &&
                            order.payment?.method !== "cod" &&
                            (order.paymentMethod === "razorpay" ||
                              order.paymentMethod === "online" ||
                              order.payment?.paymentMethod === "razorpay" ||
                              order.payment?.method === "razorpay" ||
                              order.payment?.method === "online"));

                        const isWalletPayment = order.paymentType === "Wallet" || paymentMethod === "wallet";

                        return isCancelled && (isOnlinePayment || isWalletPayment);
                      })() && (
                          <>
                            {order.refundStatus === 'processed' || order.refundStatus === 'initiated' ? (
                              <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 cursor-default">
                                {order.paymentType === "Wallet" || order.payment?.method === "wallet"
                                  ? "Wallet Refunded"
                                  : "Refunded"}
                              </span>
                            ) : onRefund ? (
                              <button
                                onClick={() => onRefund(order)}
                                className={`px-3 py-1.5 rounded-md text-white text-xs font-medium hover:opacity-90 transition-colors shadow-sm flex items-center gap-1.5 ${order.paymentType === "Wallet" || order.payment?.method === "wallet"
                                  ? "bg-purple-600 hover:bg-purple-700"
                                  : "bg-blue-600 hover:bg-blue-700"
                                  }`}
                                title={order.paymentType === "Wallet" || order.payment?.method === "wallet"
                                  ? "Process Wallet Refund (Add to user wallet)"
                                  : "Process Refund via Razorpay"}
                              >
                                <span className="text-sm">₹</span>
                                <span>Refund</span>
                              </button>
                            ) : null}
                          </>
                        )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing <span className="font-semibold">{(effectivePage - 1) * itemsPerPage + 1}</span> to{" "}
            <span className="font-semibold">{Math.min(effectivePage * itemsPerPage, orders.length)}</span> of{" "}
            <span className="font-semibold">{orders.length}</span> orders
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={effectivePage === 1}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (effectivePage <= 3) {
                  pageNum = i + 1
                } else if (effectivePage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = effectivePage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${effectivePage === pageNum
                      ? "bg-red-500 text-white shadow-md"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={effectivePage === totalPages}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

