import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Share2, ChevronLeft, ChevronRight, ChevronDown, Loader2 } from "lucide-react"
import { formatCurrency } from "../../restaurant/utils/currency"
import { useProgressStore } from "../store/progressStore"
import { deliveryAPI } from "@/lib/api"
import { toast } from "sonner"
import { shareContent } from "@/lib/utils/share"

export default function Earnings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("week")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showWeekPicker, setShowWeekPicker] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  // Get week range - defined early since it's used in generateDummyData
  const getWeekRange = (date) => {
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day
    startOfWeek.setDate(diff)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    
    return { start: startOfWeek, end: endOfWeek }
  }

  // Check if date is in the future
  const isFutureDate = (date) => {
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today
    return date > today
  }

  // Generate dummy data based on selected date
  const generateDummyData = (date, period) => {
    // Check if the date/period is in the future
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let isFuture = false
    if (period === 'day') {
      const checkDate = new Date(date)
      checkDate.setHours(0, 0, 0, 0)
      isFuture = checkDate > today
    } else if (period === 'week') {
      const weekRange = getWeekRange(date)
      isFuture = weekRange.end > today
    } else if (period === 'month') {
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      monthEnd.setHours(23, 59, 59, 999)
      isFuture = monthEnd > today
    }
    
    // Return zero data for future periods
    if (isFuture) {
      return {
        totalEarnings: 0,
        orders: 0,
        hours: 0,
        minutes: 0,
        orderEarning: 0,
        incentive: 0,
        otherEarnings: 0
      }
    }
    
    // Generate random but consistent data based on date
    const dateStr = date.toISOString().split('T')[0]
    const seed = dateStr.split('-').join('')
    const seedNum = parseInt(seed) % 10000

    // Different multipliers for different periods
    const multiplier = period === 'day' ? 1 : period === 'week' ? 7 : 30
    
    const orders = (seedNum % 20) * multiplier
    const hours = Math.floor((seedNum % 8) * multiplier / 2)
    const minutes = ((seedNum % 60) * multiplier) % 60
    
    const orderEarning = (seedNum % 500 + 100) * multiplier
    const incentive = (seedNum % 200 + 50) * multiplier
    const otherEarnings = (seedNum % 100 + 20) * multiplier
    const totalEarnings = orderEarning + incentive + otherEarnings

    return {
      totalEarnings,
      orders,
      hours,
      minutes,
      orderEarning,
      incentive,
      otherEarnings
    }
  }

  const [earningsData, setEarningsData] = useState({
    totalEarnings: 0,
    orders: 0,
    hours: 0,
    minutes: 0,
    orderEarning: 0,
    incentive: 0,
    otherEarnings: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [dailyEarningsData, setDailyEarningsData] = useState([])
  const [weeklyEarningsData, setWeeklyEarningsData] = useState([])

  const { updateTodayEarnings } = useProgressStore()

  // Fetch earnings from backend API
  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        setIsLoading(true)
        
        // Map activeTab to backend period format
        const periodMap = {
          'day': 'today',
          'week': 'week',
          'month': 'month',
          'all': 'all'
        }
        const period = periodMap[activeTab] || 'all'
        
        // If date is specified, pass it to backend
        const params = {
          period,
          page: 1,
          limit: 1000
        }
        
        // For week/month, pass the selected date
        if (activeTab === 'week' || activeTab === 'month' || activeTab === 'day') {
          params.date = selectedDate.toISOString()
        }
        
        const response = await deliveryAPI.getEarnings(params)
        
        if (response.data?.success && response.data?.data) {
          const data = response.data.data
          const summary = data.summary || {}
          
          // Set earnings data
          setEarningsData({
            totalEarnings: summary.totalEarnings || 0,
            orders: summary.totalOrders || 0,
            hours: summary.totalHours || 0,
            minutes: summary.totalMinutes || 0,
            orderEarning: summary.orderEarning || 0,
            incentive: summary.incentive || 0,
            otherEarnings: summary.otherEarnings || 0
          })
          
          // For week view, calculate daily breakdown
          if (activeTab === 'week' && data.earnings) {
            const weekRange = getWeekRange(selectedDate)
            const dailyBreakdown = []
            
            for (let i = 0; i < 7; i++) {
              const date = new Date(weekRange.start)
              date.setDate(weekRange.start.getDate() + i)
              
              // Find earnings for this date
              const dayEarnings = data.earnings.filter(e => {
                const eDate = new Date(e.deliveredAt || e.createdAt)
                return eDate.toDateString() === date.toDateString()
              })
              
              const dayTotal = dayEarnings.reduce((sum, e) => sum + (e.amount || 0), 0)
              const dayOrders = dayEarnings.length
              
              // Calculate time for this day
              let dayMinutes = 0
              dayEarnings.forEach(e => {
                // Try to get order time if available in description
                // Otherwise estimate based on order count
                dayMinutes += 30 // Average 30 minutes per order
              })
              
              dailyBreakdown.push({
                date,
                day: date.getDate(),
                earnings: dayTotal,
                orders: dayOrders,
                hours: Math.floor(dayMinutes / 60),
                minutes: dayMinutes % 60,
                isFuture: date > new Date()
              })
            }
            
            setDailyEarningsData(dailyBreakdown)
          }
          
          // For month view, calculate weekly breakdown
          if (activeTab === 'month' && data.earnings) {
            const year = selectedDate.getFullYear()
            const month = selectedDate.getMonth()
            const firstDay = new Date(year, month, 1)
            const lastDay = new Date(year, month + 1, 0)
            
            // Calculate weeks
            const weeklyBreakdown = []
            let currentWeekStart = new Date(firstDay)
            const firstDayOfWeek = firstDay.getDay()
            const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
            currentWeekStart.setDate(firstDay.getDate() - daysToMonday)
            
            let weekNumber = 1
            while (currentWeekStart <= lastDay) {
              const weekEnd = new Date(currentWeekStart)
              weekEnd.setDate(currentWeekStart.getDate() + 6)
              
              if (weekEnd >= firstDay && currentWeekStart <= lastDay) {
                // Find earnings for this week
                const weekEarnings = data.earnings.filter(e => {
                  const eDate = new Date(e.deliveredAt || e.createdAt)
                  return eDate >= currentWeekStart && eDate <= weekEnd
                })
                
                const weekTotal = weekEarnings.reduce((sum, e) => sum + (e.amount || 0), 0)
                const weekOrders = weekEarnings.length
                
                // Calculate time for this week
                let weekMinutes = weekOrders * 30 // Average 30 minutes per order
                
                weeklyBreakdown.push({
                  weekStart: new Date(currentWeekStart),
                  weekEnd: new Date(weekEnd),
                  weekNumber: weekNumber++,
                  earnings: weekTotal,
                  orders: weekOrders,
                  hours: Math.floor(weekMinutes / 60),
                  minutes: weekMinutes % 60,
                  isFuture: weekEnd > new Date()
                })
              }
              
              currentWeekStart.setDate(currentWeekStart.getDate() + 7)
            }
            
            setWeeklyEarningsData(weeklyBreakdown)
          }
          
          // Update store if viewing today's data
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const selectedDateNormalized = new Date(selectedDate)
          selectedDateNormalized.setHours(0, 0, 0, 0)
          
          if (activeTab === "day" && selectedDateNormalized.getTime() === today.getTime()) {
            updateTodayEarnings(summary.totalEarnings || 0)
          }
        } else {
          console.error('Failed to fetch earnings:', response.data)
          toast.error('Failed to fetch earnings')
          // Set zero data on error
          setEarningsData({
            totalEarnings: 0,
            orders: 0,
            hours: 0,
            minutes: 0,
            orderEarning: 0,
            incentive: 0,
            otherEarnings: 0
          })
        }
      } catch (error) {
        console.error('Error fetching earnings:', error)
        toast.error(error.response?.data?.message || 'Failed to fetch earnings')
        // Set zero data on error
        setEarningsData({
          totalEarnings: 0,
          orders: 0,
          hours: 0,
          minutes: 0,
          orderEarning: 0,
          incentive: 0,
          otherEarnings: 0
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchEarnings()
  }, [selectedDate, activeTab, updateTodayEarnings])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowDatePicker(false)
      setShowWeekPicker(false)
      setShowMonthPicker(false)
    }
    if (showDatePicker || showWeekPicker || showMonthPicker) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showDatePicker, showWeekPicker, showMonthPicker])

  // Format date for display
  const formatDateDisplay = (date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) {
      return "Today"
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    } else {
      const options = { day: 'numeric', month: 'long' }
      return date.toLocaleDateString('en-US', options)
    }
  }

  // Format date with day name
  const formatDateWithDay = (date) => {
    const options = { weekday: 'short', day: 'numeric', month: 'long' }
    return date.toLocaleDateString('en-US', options)
  }

  // Format month
  const formatMonth = (date) => {
    const options = { month: 'long', year: 'numeric' }
    return date.toLocaleDateString('en-US', options)
  }

  // Generate recent weeks list
  const generateRecentWeeks = () => {
    const weeks = []
    const today = new Date()
    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - (today.getDay() + i * 7))
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      weeks.push({ start: weekStart, end: weekEnd })
    }
    return weeks
  }

  // Generate recent months list
  const generateRecentMonths = () => {
    const months = []
    const today = new Date()
    for (let i = 0; i < 12; i++) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1)
      months.push(month)
    }
    return months
  }

  const recentWeeks = generateRecentWeeks()
  const recentMonths = generateRecentMonths()

  // Navigate dates
  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate)
    if (activeTab === "day") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1))
    } else if (activeTab === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7))
    } else if (activeTab === "month") {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1))
    }
    setSelectedDate(newDate)
  }

  // Format time
  const formatTime = (hours, minutes) => {
    const h = String(hours).padStart(2, '0')
    const m = String(minutes).padStart(2, '0')
    return `${h}:${m} hrs`
  }

  // Generate daily earnings data for the week
  const generateDailyEarnings = (weekStart) => {
    const dailyData = []
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      
      // Check if date is in the future
      const isFuture = date > today
      
      // Generate random but consistent data based on date (only for past/present dates)
      let earnings = 0
      let orders = 0
      let hours = 0
      let minutes = 0
      
      if (!isFuture) {
        const dateStr = date.toISOString().split('T')[0]
        const seed = dateStr.split('-').join('')
        const seedNum = parseInt(seed) % 10000
        
        earnings = (seedNum % 200) // Random earnings up to ₹200
        orders = earnings > 0 ? (seedNum % 5) + 1 : 0
        hours = earnings > 0 ? Math.floor((seedNum % 2)) : 0
        minutes = earnings > 0 ? (seedNum % 60) : 0
      }
      
      dailyData.push({
        date,
        day: date.getDate(),
        earnings,
        orders,
        hours,
        minutes,
        isFuture
      })
    }
    return dailyData
  }

  // Generate weekly earnings data for the month
  const generateWeeklyEarnings = (monthDate) => {
    const weeks = []
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today
    
    // Get first day of month
    const firstDay = new Date(year, month, 1)
    // Get last day of month
    const lastDay = new Date(year, month + 1, 0)
    
    // Find the first Monday of the month (or start from first day if it's a Monday)
    let currentWeekStart = new Date(firstDay)
    const firstDayOfWeek = firstDay.getDay()
    const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
    currentWeekStart.setDate(firstDay.getDate() - daysToMonday)
    
    // Generate data for each week that overlaps with the month
    while (currentWeekStart <= lastDay) {
      const weekEnd = new Date(currentWeekStart)
      weekEnd.setDate(currentWeekStart.getDate() + 6)
      
      // Only include weeks that have at least one day in the selected month
      if (weekEnd >= firstDay && currentWeekStart <= lastDay) {
        // Check if week is in the future
        const isFuture = weekEnd > today
        
        // Generate random but consistent data based on week start date (only for past/present weeks)
        let earnings = 0
        let orders = 0
        let hours = 0
        let minutes = 0
        
        if (!isFuture) {
          const dateStr = currentWeekStart.toISOString().split('T')[0]
          const seed = dateStr.split('-').join('')
          const seedNum = parseInt(seed) % 10000
          
          earnings = (seedNum % 1500) + 100 // Random earnings up to ₹1600
          orders = earnings > 0 ? (seedNum % 20) + 1 : 0
          hours = earnings > 0 ? Math.floor((seedNum % 10)) : 0
          minutes = earnings > 0 ? (seedNum % 60) : 0
        }
        
        weeks.push({
          weekStart: new Date(currentWeekStart),
          weekEnd: new Date(weekEnd),
          weekNumber: weeks.length + 1,
          earnings,
          orders,
          hours,
          minutes,
          isFuture
        })
      }
      
      // Move to next week
      currentWeekStart.setDate(currentWeekStart.getDate() + 7)
    }
    
    return weeks
  }

  // Get daily earnings for current week (only show when week tab is active)
  const weekRange = getWeekRange(selectedDate)
  const dailyEarnings = activeTab === "week" ? (dailyEarningsData.length > 0 ? dailyEarningsData : generateDailyEarnings(weekRange.start)) : []
  
  // Get weekly earnings for current month (only show when month tab is active)
  const weeklyEarnings = activeTab === "month" ? (weeklyEarningsData.length > 0 ? weeklyEarningsData : generateWeeklyEarnings(selectedDate)) : []
  
  // Calculate total orders and time for the week
  const weekTotalOrders = dailyEarnings.reduce((sum, day) => sum + day.orders, 0)
  const weekTotalMinutes = dailyEarnings.reduce((sum, day) => sum + (day.hours * 60) + day.minutes, 0)
  const weekTotalHours = Math.floor(weekTotalMinutes / 60)
  const weekTotalMinutesRemainder = weekTotalMinutes % 60
  
  // Calculate total orders and time for the month
  const monthTotalOrders = weeklyEarnings.reduce((sum, week) => sum + week.orders, 0)
  const monthTotalMinutes = weeklyEarnings.reduce((sum, week) => sum + (week.hours * 60) + week.minutes, 0)
  const monthTotalHours = Math.floor(monthTotalMinutes / 60)
  const monthTotalMinutesRemainder = monthTotalMinutes % 60
  
  // Find max earnings for bar chart scaling
  const maxDailyEarnings = dailyEarnings.length > 0 
    ? Math.max(...dailyEarnings.map(d => d.earnings), 1) 
    : 1
    
  const maxWeeklyEarnings = weeklyEarnings.length > 0 
    ? Math.max(...weeklyEarnings.map(w => w.earnings), 1) 
    : 1

  // Handle share
  const handleShare = async () => {
    try {
      const result = await shareContent({
        title: "My Earnings",
        text: `My earnings for ${formatDateDisplay(selectedDate)}: ${formatCurrency(earningsData.totalEarnings)}`,
      })

      if (result.method === "whatsapp") {
        toast.success("Opening share options")
      } else if (result.method === "clipboard") {
        toast.success("Earnings copied to clipboard")
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error("Failed to share earnings")
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-black" />
          <p className="text-gray-600">Loading earnings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-black text-white px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Earnings</h1>
        <button
          onClick={handleShare}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors flex items-center gap-1"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-black px-4 flex flex-col gap-2 border-b rounded-b-xl border-white">
      <div className="px-4 py-3 flex gap-2">
        <button
          onClick={() => {
            setActiveTab("day")
            setShowDatePicker(false)
            setShowWeekPicker(false)
            setShowMonthPicker(false)
          }}
          className={`flex-1 py-2 px-4 rounded-full border border-white font-medium transition-colors ${
            activeTab === "day"
              ? "bg-white text-black"
              : "bg-transparent text-white"
          }`}
        >
          Day
        </button>
        <button
          onClick={() => {
            setActiveTab("week")
            setShowDatePicker(false)
            setShowWeekPicker(false)
            setShowMonthPicker(false)
          }}
          className={`flex-1 py-2 px-4 rounded-full border border-white font-medium transition-colors ${
            activeTab === "week"
              ? "bg-white text-black"
              : "bg-transparent text-white"
          }`}
        >
          Week
        </button>
        <button
          onClick={() => {
            setActiveTab("month")
            setShowDatePicker(false)
            setShowWeekPicker(false)
            setShowMonthPicker(false)
          }}
          className={`flex-1 py-2 px-4 rounded-full border border-white font-medium transition-colors ${
            activeTab === "month"
              ? "bg-white text-black"
              : "bg-transparent text-white"
          }`}
        >
          Month
        </button>
        </div>
               {/* Earnings Card */}
        <div className="bg-white rounded-lg shadow-sm mb-4">
          {/* Date Selector and Navigation */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <button
              onClick={() => navigateDate("prev")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (activeTab === "day") setShowDatePicker(!showDatePicker)
                else if (activeTab === "week") setShowWeekPicker(!showWeekPicker)
                else if (activeTab === "month") setShowMonthPicker(!showMonthPicker)
              }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="text-sm font-medium text-gray-900">
                {activeTab === "day" 
                  ? `${formatDateDisplay(selectedDate)}: ${selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}`
                  : activeTab === "week"
                  ? `${getWeekRange(selectedDate).start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - ${getWeekRange(selectedDate).end.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`
                  : formatMonth(selectedDate)
                }
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${(showDatePicker || showWeekPicker || showMonthPicker) ? 'rotate-180' : ''}`} />
            </button>
            
            <button
              onClick={() => navigateDate("next")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Date/Week/Month Picker Dropdown */}
          {(showDatePicker || showWeekPicker || showMonthPicker) && (
            <div className="px-4 pb-4 max-h-60 overflow-y-auto">
              {showDatePicker && (
                <div className="space-y-2">
                  {Array.from({ length: 30 }, (_, i) => {
                    const date = new Date()
                    date.setDate(date.getDate() - i)
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedDate(date)
                          setShowDatePicker(false)
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors ${
                          date.toDateString() === selectedDate.toDateString() ? 'bg-gray-100 font-medium' : ''
                        }`}
                      >
                        {formatDateWithDay(date)}
                      </button>
                    )
                  })}
                </div>
              )}
              
              {showWeekPicker && (
                <div className="space-y-2">
                  {recentWeeks.map((week, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedDate(week.start)
                        setShowWeekPicker(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors ${
                        week.start.toDateString() === getWeekRange(selectedDate).start.toDateString() ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      {week.start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - {week.end.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                    </button>
                  ))}
                </div>
              )}
              
              {showMonthPicker && (
                <div className="space-y-2">
                  {recentMonths.map((month, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedDate(month)
                        setShowMonthPicker(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors ${
                        month.getMonth() === selectedDate.getMonth() && month.getFullYear() === selectedDate.getFullYear() ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      {formatMonth(month)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Total Earnings */}
          <div className="px-4 pb-4 text-center">
            <p className="text-5xl font-bold text-gray-900">
              {earningsData.totalEarnings === 0 ? '₹0' : `₹${Math.round(earningsData.totalEarnings)}`}
            </p>
          </div>

          {/* Statistics */}
          <div className="px-4 pb-4  pt-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-gray-900">{earningsData.orders} Orders</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-900">
                {formatTime(earningsData.hours, earningsData.minutes)}
              </p>
              <p className="text-sm text-gray-600">Time on order</p>
            </div>
          </div>
        </div>

      </div>

      {/* Main Content */}
      <div className="px-4 py-6">
 
        {/* Weekly Breakdown Chart (show for week tab) */}
        {activeTab === "week" && (
          <div className="bg-white rounded-lg shadow-sm mb-4">
            {/* Date Range Header */}
            <div className="px-4 pt-4 pb-3">
              <p className="text-sm font-medium text-gray-900">
                {weekRange.start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - {weekRange.end.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} {weekRange.start.getFullYear()}
              </p>
            </div>

            {/* Bar Chart */}
            <div className="px-4 pb-4">
              <div className="flex items-end justify-between gap-1 h-40">
                {dailyEarnings.map((day, index) => {
                  const barHeight = maxDailyEarnings > 0 ? (day.earnings / maxDailyEarnings) * 100 : 0
                  const hasEarnings = day.earnings > 0
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1.5">
                      {/* Earnings Label - Above bar */}
                      {hasEarnings && (
                        <span className="text-xs font-semibold text-gray-900">
                          ₹{Math.round(day.earnings)}
                        </span>
                      )}
                      
                      {/* Bar Container */}
                      <div className="w-full flex flex-col items-center justify-end relative" style={{ height: '120px' }}>
                        {hasEarnings ? (
                          <div
                            className="w-full bg-black rounded-t transition-all"
                            style={{
                              height: `${Math.max(barHeight, 5)}%`,
                              minHeight: '8px'
                            }}
                          />
                        ) : (
                          <div className="w-full bg-gray-100 rounded-t" style={{ height: '2px' }} />
                        )}
                      </div>
                      
                      {/* Day Label */}
                      <span className="text-xs text-gray-600 mt-1">
                        {day.day}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stats Below Chart */}
            <div className="px-4 pb-4 pt-2 flex items-center justify-between border-t border-gray-100">
              <div>
                <p className="text-2xl font-bold text-gray-900">{weekTotalOrders}</p>
                <p className="text-sm text-gray-600">Orders</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {String(weekTotalHours).padStart(2, '0')}:{String(weekTotalMinutesRemainder).padStart(2, '0')} hrs
                </p>
                <p className="text-sm text-gray-600">Time on order</p>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Weekly Breakdown Chart (show for month tab) */}
        {activeTab === "month" && (
          <div className="bg-white rounded-lg shadow-sm mb-4">
            {/* Month Header */}
            <div className="px-4 pt-4 pb-3">
              <p className="text-sm font-medium text-gray-900">
                {formatMonth(selectedDate)}
              </p>
            </div>

            {/* Bar Chart - Weeks */}
            <div className="px-4 pb-4">
              <div className="flex items-end justify-between gap-1 h-40">
                {weeklyEarnings.map((week, index) => {
                  const barHeight = maxWeeklyEarnings > 0 ? (week.earnings / maxWeeklyEarnings) * 100 : 0
                  const hasEarnings = week.earnings > 0
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1.5">
                      {/* Earnings Label - Above bar */}
                      {hasEarnings && (
                        <span className="text-xs font-semibold text-gray-900">
                          ₹{Math.round(week.earnings)}
                        </span>
                      )}
                      
                      {/* Bar Container */}
                      <div className="w-full flex flex-col items-center justify-end relative" style={{ height: '120px' }}>
                        {hasEarnings ? (
                          <div
                            className="w-full bg-black rounded-t transition-all"
                            style={{
                              height: `${Math.max(barHeight, 5)}%`,
                              minHeight: '8px'
                            }}
                          />
                        ) : (
                          <div className="w-full bg-gray-100 rounded-t" style={{ height: '2px' }} />
                        )}
                      </div>
                      
                      {/* Week Label */}
                      <span className="text-xs text-gray-600 mt-1">
                        W{week.weekNumber}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stats Below Chart */}
            <div className="px-4 pb-4 pt-2 flex items-center justify-between border-t border-gray-100">
              <div>
                <p className="text-2xl font-bold text-gray-900">{monthTotalOrders}</p>
                <p className="text-sm text-gray-600">Orders</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {String(monthTotalHours).padStart(2, '0')}:{String(monthTotalMinutesRemainder).padStart(2, '0')} hrs
                </p>
                <p className="text-sm text-gray-600">Time on order</p>
              </div>
            </div>
          </div>
        )}

          {/* Earnings Breakdown */}
        <div className="space-y-3">
          <div className="bg-white rounded-lg shadow-sm px-4 py-4 flex items-center justify-between">
            <span className="text-base text-gray-900">Order earning</span>
            <span className="text-base font-semibold text-gray-900">
              {earningsData.orderEarning === 0 ? '₹0' : `₹${Math.round(earningsData.orderEarning)}`}
            </span>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm px-4 py-4 flex items-center justify-between">
            <span className="text-base text-gray-900">Incentive</span>
            <span className="text-base font-semibold text-gray-900">
              {earningsData.incentive === 0 ? '₹0' : `₹${Math.round(earningsData.incentive)}`}
            </span>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm px-4 py-4 flex items-center justify-between">
            <span className="text-base text-gray-900">Other earnings</span>
            <span className="text-base font-semibold text-gray-900">
              {earningsData.otherEarnings === 0 ? '₹0' : `₹${Math.round(earningsData.otherEarnings)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

