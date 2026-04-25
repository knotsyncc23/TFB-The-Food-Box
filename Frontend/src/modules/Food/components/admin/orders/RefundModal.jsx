import { useState, useEffect } from "react"
import { Wallet, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"

export default function RefundModal({ isOpen, onOpenChange, order, onConfirm, isProcessing }) {
  const [refundAmount, setRefundAmount] = useState("")
  const [error, setError] = useState("")

  // Set default refund amount when order changes
  useEffect(() => {
    if (order && isOpen) {
      const defaultAmount = order.totalAmount || 0
      setRefundAmount(defaultAmount.toString())
      setError("")
    }
  }, [order, isOpen])

  const handleAmountChange = (e) => {
    const value = e.target.value
    // Allow only numbers and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setRefundAmount(value)
      setError("")
    }
  }

  const handleConfirm = () => {
    const amount = parseFloat(refundAmount)
    const maxAmount = order?.totalAmount || 0

    if (!refundAmount || refundAmount.trim() === "") {
      setError("Refund à¤°à¤¾à¤¶à¤¿ à¤¡à¤¾à¤²à¤¨à¤¾ à¤…à¤¨à¤¿à¤µà¤¾à¤°à¥à¤¯ à¤¹à¥ˆ")
      return
    }

    if (isNaN(amount) || amount <= 0) {
      setError("à¤•à¥ƒà¤ªà¤¯à¤¾ à¤¸à¤¹à¥€ à¤°à¤¾à¤¶à¤¿ à¤¡à¤¾à¤²à¥‡à¤‚")
      return
    }

    if (amount > maxAmount) {
      setError(`Refund à¤°à¤¾à¤¶à¤¿ à¤•à¥à¤² à¤°à¤¾à¤¶à¤¿ (â‚¹${maxAmount.toFixed(2)}) à¤¸à¥‡ à¤…à¤§à¤¿à¤• à¤¨à¤¹à¥€à¤‚ à¤¹à¥‹ à¤¸à¤•à¤¤à¥€`)
      return
    }

    onConfirm(amount)
  }

  const handleClose = () => {
    if (!isProcessing) {
      setRefundAmount("")
      setError("")
      onOpenChange(false)
    }
  }

  if (!order) return null

  const maxAmount = order.totalAmount || 0

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Wallet className="w-5 h-5 text-purple-600" />
            Wallet Refund
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Order ID: <span className="font-semibold">{order.orderId}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Refund Amount (?)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                ?
              </span>
              <input
                type="text"
                value={refundAmount}
                onChange={handleAmountChange}
                placeholder="0.00"
                disabled={isProcessing}
                className={`w-full pl-8 pr-4 py-2.5 border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  error
                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                    : "border-slate-300 focus:border-purple-500 focus:ring-purple-200"
                } ${isProcessing ? "bg-slate-100 cursor-not-allowed" : "bg-white"}`}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
            <p className="text-xs text-slate-500">
              Maximum refundable amount: â‚¹{maxAmount.toFixed(2)}
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-purple-800">
              <span className="font-semibold">Note:</span> à¤¯à¤¹ à¤ªà¥ˆà¤¸à¤¾ à¤—à¥à¤°à¤¾à¤¹à¤• à¤•à¥‡ à¤µà¥‰à¤²à¥‡à¤Ÿ à¤®à¥‡à¤‚ à¤•à¥à¤°à¥‡à¤¡à¤¿à¤Ÿ à¤¹à¥‹ à¤œà¤¾à¤à¤—à¤¾ à¤”à¤° à¤‘à¤°à¥à¤¡à¤° à¤•à¤¾ à¤¸à¥à¤Ÿà¥‡à¤Ÿà¤¸ "Refunded" à¤¹à¥‹ à¤œà¤¾à¤à¤—à¤¾à¥¤
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || !refundAmount || parseFloat(refundAmount) <= 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isProcessing ? "Processing..." : "Refund"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
