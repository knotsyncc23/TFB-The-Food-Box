import { useState, useMemo, useRef, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, Menu, ChevronDown, Calendar, Download, ArrowRight, FileText, Wallet, X } from "lucide-react"
import BottomNavOrders from "../components/BottomNavOrders"
import { restaurantAPI } from "@/lib/api"

export default function HubFinance() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get("tab")
    return tabParam === "invoices" ? "invoices" : "payouts"
  })
  const [selectedDateRange, setSelectedDateRange] = useState("14 Nov - 14 Dec'25")
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [showDateRangePicker, setShowDateRangePicker] = useState(false)
  const downloadMenuRef = useRef(null)
  const dateRangePickerRef = useRef(null)
  const [financeData, setFinanceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pastCyclesData, setPastCyclesData] = useState(null)
  const [loadingPastCycles, setLoadingPastCycles] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(true)
const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
const [withdrawalAmount, setWithdrawalAmount] = useState('')
const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false)

  const fetchFinanceData = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getFinance()
      if (response.data?.success && response.data?.data) {
        setFinanceData(response.data.data)
        console.log('âœ… Finance data fetched:', response.data.data)
        console.log('ðŸ“¦ Current cycle orders:', response.data.data?.currentCycle?.orders)
        console.log('ðŸ“Š Current cycle totalOrders:', response.data.data?.currentCycle?.totalOrders)
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('âŒ Error fetching finance data:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  // Fetch finance data on mount
  useEffect(() => {
    const fetchFinanceData = async () => {
      try {
        setLoading(true)
        const response = await restaurantAPI.getFinance()
        if (response.data?.success && response.data?.data) {
          setFinanceData(response.data.data)
          console.log('✅ Finance data fetched:', response.data.data)
          console.log('📦 Current cycle orders:', response.data.data?.currentCycle?.orders)
          console.log('📊 Current cycle totalOrders:', response.data.data?.currentCycle?.totalOrders)
        }
      } catch (error) {
        // Suppress 401 errors as they're handled by axios interceptor (token refresh/redirect)
        if (error.response?.status !== 401) {
          console.error('❌ Error fetching finance data:', error)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchFinanceData()
  }, [])

  useEffect(() => {
    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        fetchFinanceData()
      }
    }

    window.addEventListener("focus", fetchFinanceData)
    document.addEventListener("visibilitychange", handleVisibilityRefresh)

    return () => {
      window.removeEventListener("focus", fetchFinanceData)
      document.removeEventListener("visibilitychange", handleVisibilityRefresh)
    }
  }, [])

  // Fetch restaurant data for header display
  useEffect(() => {
    // Use restaurant data from financeData if available, otherwise fetch separately
    if (financeData?.restaurant) {
      setRestaurantData(financeData.restaurant)
    } else {
      const fetchRestaurantData = async () => {
        try {
          const response = await restaurantAPI.getRestaurantByOwner()
          const data = response?.data?.data?.restaurant || response?.data?.restaurant || response?.data?.data
          if (data) {
            setRestaurantData({
              name: data.name,
              restaurantId: data.restaurantId || data._id,
              address: data.location?.address || data.location?.formattedAddress || data.address || ''
            })
          }
        } catch (error) {
          // Suppress 401 errors as they're handled by axios interceptor
          if (error.response?.status !== 401) {
            console.error('❌ Error fetching restaurant data:', error)
          }
        }
      }
      fetchRestaurantData()
    }
  }, [financeData])

  // Format restaurant ID to REST###### format (e.g., REST005678)
  const formatRestaurantId = (restaurantId) => {
    if (!restaurantId) return ''
    
    // Extract numeric part from the end (e.g., "REST-1768762345335-5678" -> "5678")
    const strId = String(restaurantId)
    const numericMatch = strId.match(/(\d+)$/)
    
    if (numericMatch) {
      const numericPart = numericMatch[1]
      // Take last 6 digits and pad with zeros if needed
      const lastDigits = numericPart.slice(-6).padStart(6, '0')
      return `REST${lastDigits}`
    }
    
    // Fallback: if no numeric part found, use original
    return strId
  }

  // Get current cycle dates from API response or use default
  const currentCycleDates = useMemo(() => {
    if (financeData?.currentCycle) {
      return {
        start: financeData.currentCycle.start.day,
        end: financeData.currentCycle.end.day,
        month: financeData.currentCycle.start.month,
        year: financeData.currentCycle.start.year
      }
    }
    return {
      start: "15",
      end: "21",
      month: "Dec",
      year: "25"
    }
  }, [financeData])

  const handleViewDetails = () => {
    navigate("/restaurant/finance-details")
  }

  // Parse date range string to extract start and end dates
  const parseDateRange = (dateRangeStr) => {
    // Format: "14 Nov - 14 Dec'25"
    try {
      const parts = dateRangeStr.split(' - ')
      if (parts.length !== 2) return null
      
      const startStr = parts[0].trim() // "14 Nov"
      const endStr = parts[1].trim().replace("'", " ") // "14 Dec 25"
      
      const currentYear = new Date().getFullYear()
      const startParts = startStr.split(' ')
      const endParts = endStr.split(' ')
      
      if (startParts.length < 2 || endParts.length < 2) return null
      
      const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      }
      
      const startDay = parseInt(startParts[0])
      const startMonth = monthMap[startParts[1]]
      const endDay = parseInt(endParts[0])
      const endMonth = monthMap[endParts[1]]
      const year = endParts.length > 2 ? parseInt('20' + endParts[2]) : currentYear
      
      // Validate month values
      if (startMonth === undefined || endMonth === undefined || isNaN(startDay) || isNaN(endDay)) {
        console.error('Invalid date components:', { startMonth, endMonth, startDay, endDay, dateRangeStr })
        return null
      }
      
      const startDate = new Date(year, startMonth, startDay)
      const endDate = new Date(year, endMonth, endDay)
      
      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('Invalid date values:', { startDate, endDate, dateRangeStr })
        return null
      }
      
      return { startDate, endDate }
    } catch (error) {
      console.error('Error parsing date range:', error)
      return null
    }
  }

  // Fetch past cycles data when date range changes
  const fetchPastCyclesData = async (startDate, endDate) => {
    if (!startDate || !endDate) {
      setPastCyclesData(null)
      return
    }

    try {
      setLoadingPastCycles(true)
      // Validate dates and format as ISO strings
      const startDateObj = startDate instanceof Date ? startDate : new Date(startDate)
      const endDateObj = endDate instanceof Date ? endDate : new Date(endDate)
      
      // Check if dates are valid
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        console.error('Invalid date values:', { startDate, endDate })
        setPastCyclesData(null)
        return
      }
      
      const startDateISO = startDateObj.toISOString().split('T')[0]
      const endDateISO = endDateObj.toISOString().split('T')[0]
      
      const response = await restaurantAPI.getFinance({
        startDate: startDateISO,
        endDate: endDateISO
      })
      if (response.data?.success && response.data?.data?.pastCycles) {
        setPastCyclesData(response.data.data.pastCycles)
        console.log('✅ Past cycles data fetched:', response.data.data.pastCycles)
        console.log('📦 Orders array:', response.data.data.pastCycles?.orders)
        console.log('📊 Total orders:', response.data.data.pastCycles?.totalOrders)
      } else {
        setPastCyclesData(null)
      }
    } catch (error) {
      // Suppress 401 errors as they're handled by axios interceptor (token refresh/redirect)
      if (error.response?.status !== 401) {
        console.error('❌ Error fetching past cycles data:', error)
      }
      setPastCyclesData(null)
    } finally {
      setLoadingPastCycles(false)
    }
  }

  // Fetch past cycles data on mount and when date range changes
  useEffect(() => {
    const dateRange = parseDateRange(selectedDateRange)
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      fetchPastCyclesData(dateRange.startDate, dateRange.endDate)
    } else {
      // If date range is invalid, don't fetch
      setPastCyclesData(null)
    }
  }, [selectedDateRange])


  // Prepare report data from real finance data
  const getReportData = () => {
    const restaurantName = financeData?.restaurant?.name || "Restaurant"
    const restaurantId = financeData?.restaurant?.restaurantId || "N/A"
    const currentCycle = financeData?.currentCycle || {}
    
    // Get all orders (current cycle + past cycles)
    const allOrders = []
    
    // Add current cycle orders
    if (financeData?.currentCycle?.orders && financeData.currentCycle.orders.length > 0) {
      financeData.currentCycle.orders.forEach(order => {
        allOrders.push({
          ...order,
          cycle: 'Current Cycle'
        })
      })
    }
    
    // Add past cycles orders
    if (pastCyclesData?.orders && pastCyclesData.orders.length > 0) {
      pastCyclesData.orders.forEach(order => {
        allOrders.push({
          ...order,
          cycle: 'Past Cycle'
        })
      })
    }
    
    return {
      restaurantName,
      restaurantId,
      dateRange: selectedDateRange,
      currentCycle: {
        start: currentCycleDates.start,
        end: currentCycleDates.end,
        month: currentCycleDates.month,
        year: currentCycleDates.year,
        estimatedPayout: `₹${(currentCycle.estimatedPayout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        orders: currentCycle.totalOrders || 0,
        payoutDate: currentCycle.payoutDate ? new Date(currentCycle.payoutDate).toLocaleDateString('en-IN') : "-"
      },
      pastCycles: pastCyclesData,
      allOrders: allOrders
    }
  }

  // Generate HTML content for the report
  const generateHTMLContent = (reportData) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Finance Report - ${reportData.dateRange}</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #000;
          }
          .header p {
            margin: 5px 0;
            font-size: 12px;
            color: #666;
          }
          .section {
            margin-bottom: 25px;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #000;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px dashed #ccc;
          }
          .info-label {
            font-weight: 600;
            color: #333;
          }
          .info-value {
            color: #000;
            font-weight: 600;
          }
          .current-cycle {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .payout-amount {
            font-size: 32px;
            font-weight: bold;
            color: #000;
            margin: 10px 0;
          }
          .orders-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .orders-table th {
            background-color: #f5f5f5;
            padding: 10px;
            text-align: left;
            border: 1px solid #ddd;
            font-weight: bold;
            font-size: 11px;
          }
          .orders-table td {
            padding: 8px;
            border: 1px solid #ddd;
            font-size: 11px;
          }
          .orders-table tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ccc;
            text-align: center;
            font-size: 11px;
            color: #666;
          }
          @media print {
            body { margin: 0; }
            .current-cycle { page-break-inside: avoid; }
            .orders-table { page-break-inside: auto; }
            .orders-table tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Finance Report</h1>
          <p>${reportData.restaurantName}</p>
          <p>ID: ${reportData.restaurantId}</p>
          <p>Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>

        <div class="section">
          <div class="section-title">Current Cycle</div>
          <div class="current-cycle">
            <p style="font-size: 12px; color: #666; margin: 0 0 5px 0;">
              Est. payout (${reportData.currentCycle.start} - ${reportData.currentCycle.end} ${reportData.currentCycle.month})
            </p>
            <div class="payout-amount">${reportData.currentCycle.estimatedPayout}</div>
            <p style="font-size: 14px; color: #666; margin: 5px 0;">${reportData.currentCycle.orders} orders</p>
            <div class="info-row">
              <div>
                <p class="info-label" style="font-size: 11px; margin: 5px 0;">Payout for</p>
                <p style="margin: 0; font-weight: 600;">${reportData.currentCycle.start} - ${reportData.currentCycle.end} ${reportData.currentCycle.month}'${reportData.currentCycle.year}</p>
              </div>
              <div style="text-align: right;">
                <p class="info-label" style="font-size: 11px; margin: 5px 0;">Payout date</p>
                <p style="margin: 0; font-weight: 600;">${reportData.currentCycle.payoutDate}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Detailed Order Wise Report</div>
          ${reportData.allOrders && reportData.allOrders.length > 0 ? `
            <table class="orders-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Order ID</th>
                  <th>Order Date</th>
                  <th>Food Items</th>
                  <th>Item Qty</th>
                  <th>Order Amount</th>
                  <th>Restaurant Earning/Profit</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.allOrders.map(order => {
                  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : (order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-IN') : 'N/A')
                  const foodItems = order.foodNames || (order.items && order.items.map(item => item.name).join(', ')) || 'N/A'
                  const itemQuantities = order.items ? order.items.map(item => (item.quantity || 1).toString()).join(', ') : 'N/A'
                  const orderAmount = order.totalAmount || order.orderTotal || order.amount || 0
                  const earning = order.payout || order.restaurantEarning || 0
                  
                  return `
                    <tr>
                      <td>${order.cycle || 'N/A'}</td>
                      <td>${order.orderId || 'N/A'}</td>
                      <td>${orderDate}</td>
                      <td>${foodItems}</td>
                      <td>${itemQuantities}</td>
                      <td>₹${orderAmount.toFixed(2)}</td>
                      <td>₹${earning.toFixed(2)}</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background-color: #e8f5e9; font-weight: bold;">
                  <td colspan="5" style="text-align: right;">Total Earnings:</td>
                  <td colspan="2">₹${reportData.allOrders.reduce((sum, order) => sum + (order.payout || order.restaurantEarning || 0), 0).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          ` : `
          <div class="info-row">
            <span class="info-label">Status:</span>
              <span class="info-value">No orders available</span>
          </div>
          `}
        </div>

        <div class="footer">
          <p>This is an auto-generated report. For detailed information, please visit the Finance section.</p>
          <p>Total Orders: ${reportData.allOrders?.length || 0} | Total Earnings: ₹${reportData.allOrders?.reduce((sum, order) => sum + (order.payout || order.restaurantEarning || 0), 0).toFixed(2) || '0.00'}</p>
        </div>
      </body>
      </html>
    `
  }

  // Download PDF report - Direct download without print dialog
  const downloadPDF = async () => {
    try {
      setShowDownloadMenu(false)
      
    const reportData = getReportData()
    const htmlContent = generateHTMLContent(reportData)
    
      console.log('📄 Generating PDF...')
      
      // Create a temporary hidden iframe to render HTML properly
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.left = '-9999px'
      iframe.style.top = '0'
      iframe.style.width = '210mm'
      iframe.style.height = '297mm'
      iframe.style.border = 'none'
      document.body.appendChild(iframe)
      
      // Write HTML to iframe
      iframe.contentDocument.open()
      iframe.contentDocument.write(htmlContent)
      iframe.contentDocument.close()
      
      // Wait for iframe content to load
      await new Promise((resolve) => {
        if (iframe.contentDocument.readyState === 'complete') {
          resolve()
        } else {
          iframe.contentWindow.onload = resolve
          setTimeout(resolve, 1000) // Fallback timeout
        }
      })
      
      // Wait a bit more for styles to apply
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Import html2canvas and jsPDF dynamically
      console.log('📦 Loading libraries...')
      const html2canvas = (await import('html2canvas')).default
      const { default: jsPDF } = await import('jspdf')
    
      // Get the body element from iframe
      const iframeBody = iframe.contentDocument.body
      
      console.log('🎨 Converting to canvas...')
      // Convert HTML to canvas
      const canvas = await html2canvas(iframeBody, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: iframeBody.scrollWidth,
        height: iframeBody.scrollHeight
      })
      
      console.log('✅ Canvas created:', canvas.width, 'x', canvas.height)
      
      // Remove temporary iframe
      document.body.removeChild(iframe)
    
      // Calculate PDF dimensions
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      console.log('📐 PDF dimensions:', imgWidth, 'x', imgHeight, 'mm')
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      let heightLeft = imgHeight
      let position = 0
      
      // Add first page
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      // Add additional pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      // Download PDF
      const fileName = `finance-report-${reportData.dateRange.replace(/\s+/g, '-').replace(/'/g, '')}_${new Date().toISOString().split("T")[0]}.pdf`
      console.log('💾 Downloading PDF:', fileName)
      pdf.save(fileName)
      console.log('✅ PDF downloaded successfully!')
    } catch (error) {
      console.error('❌ Error downloading PDF:', error)
      console.error('Error details:', error.stack)
      alert(`Failed to download PDF: ${error.message}. Please check console for details.`)
    setShowDownloadMenu(false)
    }
  }

  // Close download menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target)) {
        setShowDownloadMenu(false)
      }
    }
    
    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDownloadMenu])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Navbar */}
      <div className="sticky bg-white top-0 z-40 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-lg font-bold text-gray-900 truncate">
                  {restaurantData?.name || financeData?.restaurant?.name || "Restaurant"}
                </p>
                <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0" />
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {(() => {
                  const restaurantId = restaurantData?.restaurantId || financeData?.restaurant?.restaurantId
                  const address = restaurantData?.address || financeData?.restaurant?.address || ''
                  const parts = []
                  if (restaurantId) {
                    const formattedId = formatRestaurantId(restaurantId)
                    parts.push(`ID: ${formattedId}`)
                  }
                  if (address) {
                    const shortAddress = address.length > 40 ? address.substring(0, 40) + '...' : address
                    parts.push(shortAddress)
                  }
                  return parts.length > 0 ? parts.join(' • ') : 'Loading...'
                })()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => navigate("/restaurant/withdrawal-history")}
              title="Withdrawal History"
            >
              <Wallet className="w-5 h-5 text-gray-700" />
            </button>
            <button
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => navigate("/restaurant/notifications")}
            >
              <Bell className="w-5 h-5 text-gray-700" />
            </button>
            <button
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => navigate("/restaurant/explore")}
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("payouts")}
            className={`flex-1 py-3 px-4 rounded-full font-medium text-sm transition-colors ${
              activeTab === "payouts"
                ? "bg-black text-white"
                : "bg-white text-gray-600 border border-gray-300"
            }`}
          >
            Payouts
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className={`flex-1 py-3 px-4 rounded-full font-medium text-sm transition-colors ${
              activeTab === "invoices"
                ? "bg-black text-white"
                : "bg-white text-gray-600 border border-gray-300"
            }`}
          >
            Invoices & Taxes
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {activeTab === "payouts" && (
          <div className="space-y-6">
            {/* Available balance (single source of truth – same as withdrawal) */}
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-3">Available balance</h2>
              <div className="bg-white rounded-lg p-4">
                {loading ? (
                  <div className="py-8 text-center text-gray-500">Loading...</div>
                ) : (
                  <>
                    <p className="text-4xl font-bold text-gray-900 mb-2">
                      ₹{(financeData?.availableBalance ?? financeData?.currentCycle?.estimatedPayout ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      {financeData?.currentCycle?.totalOrders ?? 0} {financeData?.currentCycle?.totalOrders === 1 ? 'order' : 'orders'} this cycle
                    </p>
                    {((financeData?.availableBalance ?? financeData?.currentCycle?.estimatedPayout) ?? 0) > 0 && (
                      <button
                        onClick={() => setShowWithdrawalModal(true)}
                        className="w-full bg-black text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors mt-4"
                      >
                        <Wallet className="h-5 w-5" />
                        Withdraw
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Past cycles */}
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-3">Past cycles</h2>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative" ref={dateRangePickerRef}>
                    <button 
                      onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                      className="w-full bg-white rounded-lg px-4 py-3 flex items-center justify-between border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
                    >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">{selectedDateRange}</span>
                    </div>
                      <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showDateRangePicker ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Date Range Picker Dropdown */}
                    <AnimatePresence>
                      {showDateRangePicker && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                        >
                          <div className="p-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Date Range</h3>
                            <div className="space-y-2">
                              {(() => {
                                const getDateRanges = () => {
                                  const today = new Date()
                                  today.setHours(23, 59, 59, 999)
                                  
                                  // Last 7 days
                                  const last7DaysStart = new Date(today)
                                  last7DaysStart.setDate(today.getDate() - 7)
                                  last7DaysStart.setHours(0, 0, 0, 0)
                                  
                                  // Last 30 days
                                  const last30DaysStart = new Date(today)
                                  last30DaysStart.setDate(today.getDate() - 30)
                                  last30DaysStart.setHours(0, 0, 0, 0)
                                  
                                  // This week (Monday to Sunday)
                                  const currentDay = today.getDay()
                                  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1
                                  const thisWeekStart = new Date(today)
                                  thisWeekStart.setDate(today.getDate() - daysFromMonday)
                                  thisWeekStart.setHours(0, 0, 0, 0)
                                  const thisWeekEnd = new Date(thisWeekStart)
                                  thisWeekEnd.setDate(thisWeekStart.getDate() + 6)
                                  thisWeekEnd.setHours(23, 59, 59, 999)
                                  
                                  // Last week
                                  const lastWeekStart = new Date(thisWeekStart)
                                  lastWeekStart.setDate(thisWeekStart.getDate() - 7)
                                  const lastWeekEnd = new Date(thisWeekEnd)
                                  lastWeekEnd.setDate(thisWeekEnd.getDate() - 7)
                                  
                                  // This month
                                  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
                                  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
                                  
                                  // Last month
                                  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
                                  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)
                                  
                                  return {
                                    today,
                                    last7DaysStart,
                                    last30DaysStart,
                                    thisWeekStart,
                                    thisWeekEnd,
                                    lastWeekStart,
                                    lastWeekEnd,
                                    thisMonthStart,
                                    thisMonthEnd,
                                    lastMonthStart,
                                    lastMonthEnd
                                  }
                                }
                                
                                const formatDateForDisplay = (date) => {
                                  const day = date.getDate()
                                  const month = date.toLocaleString('en-US', { month: 'short' })
                                  const year = date.getFullYear().toString().slice(-2)
                                  return `${day} ${month}'${year}`
                                }
                                
                                const formatDateRange = (start, end) => {
                                  return `${formatDateForDisplay(start)} - ${formatDateForDisplay(end)}`
                                }
                                
                                const ranges = getDateRanges()
                                const dateOptions = [
                                  { 
                                    label: "Last 7 days", 
                                    range: formatDateRange(ranges.last7DaysStart, ranges.today),
                                    startDate: ranges.last7DaysStart,
                                    endDate: ranges.today
                                  },
                                  { 
                                    label: "Last 30 days", 
                                    range: formatDateRange(ranges.last30DaysStart, ranges.today),
                                    startDate: ranges.last30DaysStart,
                                    endDate: ranges.today
                                  },
                                  { 
                                    label: "This week", 
                                    range: formatDateRange(ranges.thisWeekStart, ranges.thisWeekEnd),
                                    startDate: ranges.thisWeekStart,
                                    endDate: ranges.thisWeekEnd
                                  },
                                  { 
                                    label: "Last week", 
                                    range: formatDateRange(ranges.lastWeekStart, ranges.lastWeekEnd),
                                    startDate: ranges.lastWeekStart,
                                    endDate: ranges.lastWeekEnd
                                  },
                                  { 
                                    label: "This month", 
                                    range: formatDateRange(ranges.thisMonthStart, ranges.thisMonthEnd),
                                    startDate: ranges.thisMonthStart,
                                    endDate: ranges.thisMonthEnd
                                  },
                                  { 
                                    label: "Last month", 
                                    range: formatDateRange(ranges.lastMonthStart, ranges.lastMonthEnd),
                                    startDate: ranges.lastMonthStart,
                                    endDate: ranges.lastMonthEnd
                                  }
                                ]
                                
                                return dateOptions.map((option, index) => (
                                  <button
                                    key={index}
                                    onClick={() => {
                                      setSelectedDateRange(option.range)
                                      setShowDateRangePicker(false)
                                      // Fetch data for selected range
                                      fetchPastCyclesData(option.startDate, option.endDate)
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-sm"
                                  >
                                    <div className="font-medium text-gray-900">{option.label}</div>
                                    <div className="text-xs text-gray-500">{option.range}</div>
                  </button>
                                ))
                              })()}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="relative" ref={downloadMenuRef}>
                    <button 
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      className="bg-black text-white rounded-lg px-4 py-3 flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm font-medium">Get report</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    
                    <AnimatePresence>
                      {showDownloadMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50 min-w-[180px]"
                        >
                          <button
                            onClick={downloadPDF}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center">
                              <FileText className="w-4 h-4 text-red-600" />
                            </div>
                            <span>Download PDF</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                {loadingPastCycles ? (
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 text-center">Loading past cycles...</p>
                  </div>
                ) : (
                  <>
                    {/* Show past cycles orders if available */}
                    {pastCyclesData && pastCyclesData.orders && pastCyclesData.orders.length > 0 && (
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        {pastCyclesData.orders.slice().reverse().map((order, index) => {
                          const isDining = order.source === 'dining'
                          return (
                          <div key={order.orderId || order._id || index} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900 mb-1">
                                  {isDining ? (
                                    <>Dining <span className="text-gray-500 font-normal">#{order.orderId || 'N/A'}</span></>
                                  ) : (
                                    <>Order ID: {order.orderId || 'N/A'}</>
                                  )}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {isDining ? 'Table booking' : (order.foodNames || (order.items && order.items.map(item => item.name).join(', ')) || 'N/A')}
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm font-bold text-gray-900">
                                  ₹{(order.payout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Earning
                                </p>
                              </div>
                            </div>
                          </div>
                          )
                        })}
                      </div>
                    )}
                    {/* Show current cycle orders if past cycles data is not available or has no orders */}
                    {(!pastCyclesData || !pastCyclesData.orders || pastCyclesData.orders.length === 0) && !loadingPastCycles && financeData?.currentCycle?.orders && financeData.currentCycle.orders.length > 0 && (
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        {financeData.currentCycle.orders.slice().reverse().map((order, index) => {
                          const isDining = order.source === 'dining'
                          return (
                          <div key={order.orderId || order._id || index} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900 mb-1">
                                  {isDining ? (
                                    <>Dining <span className="text-gray-500 font-normal">#{order.orderId || 'N/A'}</span></>
                                  ) : (
                                    <>Order ID: {order.orderId || 'N/A'}</>
                                  )}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {isDining ? 'Table booking' : (order.foodNames || (order.items && order.items.map(item => item.name).join(', ')) || 'N/A')}
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm font-bold text-gray-900">
                                  ₹{(order.payout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Earning
                                </p>
                              </div>
                            </div>
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "invoices" && (
          <div className=" rounded-lg p-4">
            <p className="text-sm text-gray-600 text-center py-8">
              Invoices & Taxes content will be displayed here
            </p>
          </div>
        )}
      </div>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {showWithdrawalModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowWithdrawalModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Withdraw Amount</h2>
                  <button
                    onClick={() => {
                      setShowWithdrawalModal(false)
                      setWithdrawalAmount('')
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Available Balance: <span className="font-semibold text-gray-900">₹{(financeData?.availableBalance ?? financeData?.currentCycle?.estimatedPayout ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </p>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Amount to Withdraw
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max={financeData?.availableBalance ?? financeData?.currentCycle?.estimatedPayout ?? 0}
                    step="0.01"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  />
                  {withdrawalAmount && parseFloat(withdrawalAmount) > (financeData?.availableBalance ?? financeData?.currentCycle?.estimatedPayout ?? 0) && (
                    <p className="text-sm text-red-600 mt-1">Amount cannot exceed available balance</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowWithdrawalModal(false)
                      setWithdrawalAmount('')
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const amount = parseFloat(withdrawalAmount)
                      if (!amount || amount <= 0) {
                        alert('Please enter a valid amount')
                        return
                      }
                      const maxWithdrawable = (financeData?.availableBalance ?? financeData?.currentCycle?.estimatedPayout ?? 0)
                      if (amount > maxWithdrawable) {
                        alert('Amount cannot exceed available balance')
                        return
                      }
                      
                      try {
                        setSubmittingWithdrawal(true)
                        const response = await restaurantAPI.createWithdrawalRequest(amount)
                        if (response.data?.success) {
                          alert('Withdrawal request submitted successfully!')
                          setShowWithdrawalModal(false)
                          setWithdrawalAmount('')
                          // Refresh finance data
                          const financeResponse = await restaurantAPI.getFinance()
                          if (financeResponse.data?.success && financeResponse.data?.data) {
                            setFinanceData(financeResponse.data.data)
                          }
                        } else {
                          alert(response.data?.message || 'Failed to submit withdrawal request')
                        }
                      } catch (error) {
                        console.error('Error submitting withdrawal request:', error)
                        alert(error.response?.data?.message || 'Failed to submit withdrawal request. Please try again.')
                      } finally {
                        setSubmittingWithdrawal(false)
                      }
                    }}
                    disabled={submittingWithdrawal || !withdrawalAmount || parseFloat(withdrawalAmount) <= 0 || parseFloat(withdrawalAmount) > (financeData?.availableBalance ?? financeData?.currentCycle?.estimatedPayout ?? 0)}
                    className="flex-1 px-4 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {submittingWithdrawal ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNavOrders />
    </div>
  )
}
