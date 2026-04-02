import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Search, Percent, ChevronDown, Check, X, Tag, Calendar, Edit, Trash2 } from "lucide-react"
import BottomNavOrders from "../components/BottomNavOrders"
import { restaurantAPI } from "@/lib/api"

export default function CreatePercentageDiscount() {
  const navigate = useNavigate()
  const { goalId, discountType } = useParams()
  
  // Menu data state
  const [menuItems, setMenuItems] = useState([])
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Selected items with discount percentage
  const [selectedItems, setSelectedItems] = useState({}) // { itemId: { item, discountPercentage, couponCode } }
  
  // Discount percentage modal
  const [discountModal, setDiscountModal] = useState({ open: false, itemId: null })
  const [percentageSearchQuery, setPercentageSearchQuery] = useState("")
  
  // Loading state for activating offer
  const [activatingOffer, setActivatingOffer] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState("dish") // "dish" or "running-offer"

  // Running offers state
  const [runningOffers, setRunningOffers] = useState([])
  const [loadingOffers, setLoadingOffers] = useState(false)
  
  // Coupons for dishes
  const [itemCoupons, setItemCoupons] = useState({}) // { itemId: [coupons] }
  const [loadingCoupons, setLoadingCoupons] = useState({}) // { itemId: true/false }

  // Make Offer Modal state
  const [makeOfferModal, setMakeOfferModal] = useState({ open: false, item: null, editingOffer: null })
  const [offerFormData, setOfferFormData] = useState({
    discountType: "percentage", // "percentage" or "flat"
    percentage: "",
    flatAmount: "", // For flat discount
    couponCode: "",
    startDate: "",
    endDate: "",
  })
  const [deletingOfferId, setDeletingOfferId] = useState(null)
  const [togglingOfferId, setTogglingOfferId] = useState(null)
  
  const percentageOptions = ["10", "20", "30", "40", "50", "60", "70", "80", "90"]

  // Generate coupon code based on discount percentage and item price
  const generateCouponCode = (discountValue, itemPrice, discountType = "percentage") => {
    const roundedPrice = Math.round(itemPrice / 10) * 10 // Round to nearest 10
    
    if (discountType === "flat") {
      // Format: FLATOFF{amount}ON{roundedPrice}
      // Example: FLATOFF50ON250 (₹50 off on ₹250)
      return `FLATOFF${discountValue}ON${roundedPrice}`
    } else {
      // Format: GETOFF{percentage}ON{roundedPrice}
      // Example: GETOFF10ON250 (10% off on ₹250)
      return `GETOFF${discountValue}ON${roundedPrice}`
    }
  }

  // Fetch menu items from backend
  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        setLoadingMenu(true)
        const response = await restaurantAPI.getMenu()
        
        if (response?.data?.success && response?.data?.data?.menu) {
          const sections = response.data.data.menu.sections || []
          
          // Extract all items from all sections and subsections
          const allItems = []
          sections.forEach(section => {
            // Direct items in section
            if (section.items && Array.isArray(section.items)) {
              section.items.forEach(item => {
                allItems.push({
                  ...item,
                  sectionName: section.name,
                  sectionId: section.id
                })
              })
            }
            
            // Items in subsections
            if (section.subsections && Array.isArray(section.subsections)) {
              section.subsections.forEach(subsection => {
                if (subsection.items && Array.isArray(subsection.items)) {
                  subsection.items.forEach(item => {
                    allItems.push({
                      ...item,
                      sectionName: section.name,
                      subsectionName: subsection.name,
                      sectionId: section.id,
                      subsectionId: subsection.id
                    })
                  })
                }
              })
            }
          })
          
          console.log(`[FRONTEND] Extracted ${allItems.length} menu items`)
          allItems.forEach((item, idx) => {
            console.log(`[FRONTEND] Menu item ${idx}: id=${item.id}, name=${item.name}`)
          })
          
          setMenuItems(allItems)
        }
      } catch (error) {
        console.error("Error fetching menu items:", error)
        setMenuItems([])
      } finally {
        setLoadingMenu(false)
      }
    }

    fetchMenuItems()
  }, [])

  // Fetch coupons for each menu item
  useEffect(() => {
    const fetchCouponsForItems = async () => {
      console.log(`[COUPONS] useEffect triggered, menuItems.length: ${menuItems.length}`)
      
      if (menuItems.length === 0) {
        console.log(`[COUPONS] No menu items, skipping coupon fetch`)
        return
  }

      console.log(`[COUPONS] Fetching coupons for ${menuItems.length} items`)
      console.log(`[COUPONS] Menu items:`, menuItems.map(item => ({ id: item.id, name: item.name })))
      
      const couponsMap = {}
      
      for (const item of menuItems) {
        if (!item.id) {
          console.log(`[COUPONS] ⚠️ Skipping item without id:`, item)
          continue
        }
        
        console.log(`[COUPONS] 🔍 Fetching coupons for itemId: "${item.id}", name: "${item.name}"`)
        
        try {
          const url = `/restaurant/offers/item/${item.id}/coupons`
          console.log(`[COUPONS] API URL: ${url}`)
          
          const response = await restaurantAPI.getCouponsByItemId(item.id)
          console.log(`[COUPONS] 📦 Full response:`, response)
          console.log(`[COUPONS] 📦 Response.data:`, response?.data)
          console.log(`[COUPONS] 📦 Response.data.data:`, response?.data?.data)
          console.log(`[COUPONS] 📦 Response.data.data.coupons:`, response?.data?.data?.coupons)
          
          if (response?.data?.success) {
            const coupons = response?.data?.data?.coupons || []
            couponsMap[item.id] = coupons
            console.log(`[COUPONS] ✅ Found ${coupons.length} coupons for itemId "${item.id}":`, coupons)
      } else {
            couponsMap[item.id] = []
            console.log(`[COUPONS] ❌ No coupons found for itemId "${item.id}". Response:`, response?.data)
          }
        } catch (error) {
          console.error(`[COUPONS] ❌ Error fetching coupons for item "${item.id}":`, error)
          console.error(`[COUPONS] Error response:`, error?.response)
          console.error(`[COUPONS] Error response.data:`, error?.response?.data)
          console.error(`[COUPONS] Error message:`, error?.message)
          couponsMap[item.id] = []
        }
      }
      
      console.log(`[COUPONS] 🎯 Final coupons map:`, couponsMap)
      console.log(`[COUPONS] 🎯 Setting itemCoupons state with ${Object.keys(couponsMap).length} items`)
      setItemCoupons(couponsMap)
    }
    
    fetchCouponsForItems()
  }, [menuItems])

  // Fetch running offers when "Running Offer" tab is active
  useEffect(() => {
    if (activeTab === "running-offer") {
      const fetchRunningOffers = async () => {
        try {
          setLoadingOffers(true)
          // Always fetch ALL offers (both percentage and flat-price) for running offers tab
          // Don't filter by discountType - show all offers regardless of status
          console.log(`[RUNNING-OFFERS] Fetching all offers...`)
          const response = await restaurantAPI.getOffers({})
          console.log(`[RUNNING-OFFERS] API Response:`, response?.data)
          
          if (response?.data?.success) {
            const offers = response.data.data.offers || []
            console.log(`[RUNNING-OFFERS] ✅ Fetched ${offers.length} offers`)
            console.log(`[RUNNING-OFFERS] Offer details:`, offers.map(o => ({
              id: o._id,
              discountType: o.discountType,
              status: o.status,
              itemsCount: o.items?.length || 0,
              couponCodes: o.items?.map(i => i.couponCode) || []
            })))
            setRunningOffers(offers)
          } else {
            console.error(`[RUNNING-OFFERS] ❌ API Error:`, response?.data)
            setRunningOffers([])
          }
        } catch (error) {
          console.error("[RUNNING-OFFERS] ❌ Error fetching running offers:", error)
          console.error("[RUNNING-OFFERS] Error details:", error?.response?.data || error?.message)
          setRunningOffers([])
        } finally {
          setLoadingOffers(false)
        }
      }
      fetchRunningOffers()
    }
  }, [activeTab])

  // Filter items based on search
  const filteredItems = menuItems.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Toggle item selection
  const toggleItemSelection = (item) => {
    setSelectedItems(prev => {
      const newSelected = { ...prev }
      if (newSelected[item.id]) {
        delete newSelected[item.id]
      } else {
        const defaultPercentage = "10"
        const couponCode = generateCouponCode(defaultPercentage, item.price || 0)
        newSelected[item.id] = {
          item,
          discountPercentage: defaultPercentage,
          couponCode: couponCode
        }
      }
      return newSelected
    })
  }

  // Update discount percentage for an item
  const updateDiscountPercentage = (itemId, percentage) => {
    setSelectedItems(prev => {
      if (prev[itemId]) {
        const item = prev[itemId].item
        const couponCode = generateCouponCode(percentage, item.price || 0)
        return {
          ...prev,
          [itemId]: {
            ...prev[itemId],
            discountPercentage: percentage,
            couponCode: couponCode
          }
        }
      }
      return prev
    })
  }

  // Open discount percentage modal
  const openDiscountModal = (itemId) => {
    setDiscountModal({ open: true, itemId })
    setPercentageSearchQuery("")
  }

  // Close discount modal
  const closeDiscountModal = () => {
    setDiscountModal({ open: false, itemId: null })
    setPercentageSearchQuery("")
  }

  // Handle discount selection
  const handleDiscountSelect = (percentage) => {
    if (discountModal.itemId) {
      updateDiscountPercentage(discountModal.itemId, percentage)
    }
    closeDiscountModal()
  }

  // Filter percentage options
  const filteredPercentages = percentageOptions.filter(opt => 
    opt.includes(percentageSearchQuery)
  )

  // Get current selected percentage
  const getCurrentPercentage = () => {
    if (!discountModal.itemId) return ""
    return selectedItems[discountModal.itemId]?.discountPercentage || ""
  }

  // Calculate discounted price
  const getDiscountedPrice = (item, discountPercentage) => {
    const price = item.price || 0
    const discount = parseFloat(discountPercentage) || 0
    const discountAmount = (price * discount) / 100
    return Math.round(price - discountAmount)
  }

  // Open Make Offer Modal
  const openMakeOfferModal = (item, editingOffer = null) => {
    if (editingOffer) {
      // Editing existing offer
      const offerItem = editingOffer.items?.[0]
      const startDate = editingOffer.startDate ? new Date(editingOffer.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      const endDate = editingOffer.endDate ? new Date(editingOffer.endDate).toISOString().split('T')[0] : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      // Convert "flat-price" to "flat" for frontend dropdown
      const offerDiscountType = editingOffer.discountType || "percentage"
      const frontendDiscountType = offerDiscountType === "flat-price" ? "flat" : offerDiscountType
      const discountValue = offerItem?.discountPercentage?.toString() || "10"
      const flatAmount = offerDiscountType === "flat-price" ? (offerItem?.originalPrice - offerItem?.discountedPrice)?.toString() || "" : ""
      
      setOfferFormData({
        discountType: frontendDiscountType,
        percentage: frontendDiscountType === "percentage" ? discountValue : "",
        flatAmount: flatAmount,
        couponCode: offerItem?.couponCode || "",
        startDate: startDate,
        endDate: endDate,
      })
      setMakeOfferModal({ open: true, item: item || offerItem, editingOffer })
    } else {
      // Creating new offer
      const defaultPercentage = "10"
      const defaultCouponCode = generateCouponCode(defaultPercentage, item.price || 0)
      const today = new Date().toISOString().split('T')[0]
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      setOfferFormData({
        discountType: "percentage",
        percentage: defaultPercentage,
        flatAmount: "",
        couponCode: defaultCouponCode,
        startDate: today,
        endDate: nextWeek,
      })
      setMakeOfferModal({ open: true, item, editingOffer: null })
    }
  }

  // Close Make Offer Modal
  const closeMakeOfferModal = () => {
    setMakeOfferModal({ open: false, item: null, editingOffer: null })
    setOfferFormData({
      discountType: "percentage",
      percentage: "",
      flatAmount: "",
      couponCode: "",
      startDate: "",
      endDate: "",
    })
  }

  // Handle form input changes
  const handleOfferFormChange = (field, value) => {
    if (field === "discountType") {
      // Reset discount values when type changes
      const itemPrice = makeOfferModal.item?.price || makeOfferModal.item?.originalPrice || 0
      if (value === "percentage") {
        const defaultPercentage = "10"
        const couponCode = generateCouponCode(defaultPercentage, itemPrice, "percentage")
        setOfferFormData(prev => ({
          ...prev,
          discountType: value,
          percentage: defaultPercentage,
          flatAmount: "",
          couponCode: couponCode
        }))
      } else {
        // Flat discount
        const defaultFlat = "50"
        const couponCode = generateCouponCode(defaultFlat, itemPrice, "flat")
        setOfferFormData(prev => ({
          ...prev,
          discountType: value,
          percentage: "",
          flatAmount: defaultFlat,
          couponCode: couponCode
        }))
      }
    } else if (field === "percentage" && makeOfferModal.item) {
      // Auto-generate coupon code when percentage changes
      const itemPrice = makeOfferModal.item.price || makeOfferModal.item.originalPrice || 0
      const couponCode = generateCouponCode(value, itemPrice, "percentage")
      setOfferFormData(prev => ({
        ...prev,
        percentage: value,
        couponCode: couponCode
      }))
    } else if (field === "flatAmount" && makeOfferModal.item) {
      // Auto-generate coupon code when flat amount changes
      const itemPrice = makeOfferModal.item.price || makeOfferModal.item.originalPrice || 0
      const couponCode = generateCouponCode(value, itemPrice, "flat")
      setOfferFormData(prev => ({
        ...prev,
        flatAmount: value,
        couponCode: couponCode
      }))
    } else {
      setOfferFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  // Calculate discounted price for flat discount
  const getFlatDiscountedPrice = (item, flatAmount) => {
    const price = item.price || item.originalPrice || 0
    const discount = parseFloat(flatAmount) || 0
    return Math.max(0, Math.round(price - discount))
  }

  // Handle single item offer activation/update
  const handleActivateSingleOffer = async () => {
    if (!makeOfferModal.item) return

    const { discountType: formDiscountType, percentage, flatAmount, couponCode, startDate, endDate } = offerFormData

    if (!couponCode || !startDate || !endDate) {
      alert("Please fill all fields")
      return
    }

    if (formDiscountType === "percentage") {
      if (!percentage || parseInt(percentage) < 0 || parseInt(percentage) > 100) {
        alert("Percentage must be between 0 and 100")
        return
      }
    } else {
      if (!flatAmount || parseFloat(flatAmount) < 0) {
        alert("Flat discount amount must be greater than 0")
        return
      }
      const itemPrice = makeOfferModal.item.price || makeOfferModal.item.originalPrice || 0
      if (parseFloat(flatAmount) > itemPrice) {
        alert("Flat discount cannot exceed item price")
        return
      }
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert("End date must be after start date")
      return
    }

    try {
      setActivatingOffer(true)

      const itemPrice = makeOfferModal.item.price || makeOfferModal.item.originalPrice || 0
      // Convert "flat" to "flat-price" for backend
      const finalDiscountType = formDiscountType === "percentage" ? "percentage" : "flat-price"
      const discountPercentage = formDiscountType === "percentage" 
        ? parseInt(percentage) 
        : Math.round((parseFloat(flatAmount) / itemPrice) * 100)
      const discountedPrice = formDiscountType === "percentage" 
        ? parseFloat(getDiscountedPrice(makeOfferModal.item, percentage))
        : parseFloat(getFlatDiscountedPrice(makeOfferModal.item, flatAmount))

      const offerData = {
        goalId: goalId || 'grow-customers',
        discountType: finalDiscountType,
        items: [{
          itemId: makeOfferModal.item.id || makeOfferModal.item.itemId,
          itemName: makeOfferModal.item.name || makeOfferModal.item.itemName,
          originalPrice: itemPrice,
          discountPercentage: discountPercentage,
          discountedPrice: discountedPrice,
          couponCode: couponCode,
          image: makeOfferModal.item.image || (makeOfferModal.item.images && makeOfferModal.item.images[0]) || '',
          isVeg: makeOfferModal.item.foodType === 'Veg' || makeOfferModal.item.isVeg === true,
        }],
        customerGroup: 'all',
        offerPreference: 'all',
        offerDays: 'all',
        targetMealtime: 'all',
        minOrderValue: 0,
        startDate: startDate,
        endDate: endDate,
        }
      
      console.log(`[OFFER-CREATE] Creating offer with data:`, {
        discountType: finalDiscountType,
        formDiscountType,
        couponCode,
        itemPrice,
        discountPercentage,
        discountedPrice
      })

      let response
      if (makeOfferModal.editingOffer) {
        // Update: Delete old offer and create new one
        await restaurantAPI.deleteOffer(makeOfferModal.editingOffer._id)
        response = await restaurantAPI.createOffer(offerData)
      } else {
        // Create new offer
        response = await restaurantAPI.createOffer(offerData)
      }

      if (response?.data?.success) {
        console.log(`[OFFER-CREATE] ✅ Offer created successfully:`, response?.data?.data?.offer)
        console.log(`[OFFER-CREATE] Offer discountType:`, response?.data?.data?.offer?.discountType)
        alert(makeOfferModal.editingOffer ? "Offer updated successfully!" : "Offer activated successfully!")
        closeMakeOfferModal()
        
        // Always refresh running offers, regardless of current tab
        console.log(`[OFFER-CREATE] Refreshing running offers...`)
        try {
          const refreshResponse = await restaurantAPI.getOffers({})
          console.log(`[OFFER-CREATE] Refresh response:`, refreshResponse?.data)
          if (refreshResponse?.data?.success) {
            const refreshedOffers = refreshResponse.data.data.offers || []
            console.log(`[OFFER-CREATE] ✅ Updated running offers: ${refreshedOffers.length} offers`)
            console.log(`[OFFER-CREATE] Offer types in refresh:`, refreshedOffers.map(o => o.discountType))
            setRunningOffers(refreshedOffers)
          }
        } catch (refreshError) {
          console.error(`[OFFER-CREATE] Error refreshing offers:`, refreshError)
        }
      } else {
        throw new Error(response?.data?.message || "Failed to save offer")
      }
    } catch (error) {
      console.error("Error saving offer:", error)
      alert(error?.response?.data?.message || error?.message || "Failed to save offer. Please try again.")
    } finally {
      setActivatingOffer(false)
    }
  }

  // Handle delete offer
  const handleDeleteOffer = async (offerId) => {
    if (!window.confirm("Are you sure you want to delete this offer?")) {
      return
    }

    try {
      setDeletingOfferId(offerId)
      const response = await restaurantAPI.deleteOffer(offerId)

      if (response?.data?.success) {
        alert("Offer deleted successfully!")
        // Refresh running offers - fetch ALL offers
        const refreshResponse = await restaurantAPI.getOffers({})
        if (refreshResponse?.data?.success) {
          setRunningOffers(refreshResponse.data.data.offers || [])
        }
      } else {
        throw new Error(response?.data?.message || "Failed to delete offer")
      }
    } catch (error) {
      console.error("Error deleting offer:", error)
      alert(error?.response?.data?.message || error?.message || "Failed to delete offer. Please try again.")
    } finally {
      setDeletingOfferId(null)
    }
  }

  // Handle toggle offer status (activate/deactivate)
  const handleToggleOfferStatus = async (offer) => {
    const newStatus = offer.status === 'active' ? 'paused' : 'active'
    const action = newStatus === 'active' ? 'activate' : 'deactivate'
    
    if (!window.confirm(`Are you sure you want to ${action} this offer?`)) {
      return
    }

    try {
      setTogglingOfferId(offer._id)
      const response = await restaurantAPI.updateOfferStatus(offer._id, newStatus)

      if (response?.data?.success) {
        alert(`Offer ${action}d successfully!`)
        // Refresh running offers - fetch ALL offers
        const refreshResponse = await restaurantAPI.getOffers({})
        if (refreshResponse?.data?.success) {
          setRunningOffers(refreshResponse.data.data.offers || [])
        }
      } else {
        throw new Error(response?.data?.message || `Failed to ${action} offer`)
      }
    } catch (error) {
      console.error(`Error ${action}ing offer:`, error)
      alert(error?.response?.data?.message || error?.message || `Failed to ${action} offer. Please try again.`)
    } finally {
      setTogglingOfferId(null)
  }
  }

  // Handle activate offer
  const handleActivateOffer = async () => {
    const selectedItemsArray = Object.values(selectedItems)
    if (selectedItemsArray.length === 0) {
      alert("Please select at least one item")
      return
    }

    // Validate all items have discount percentage
    const itemsWithoutDiscount = selectedItemsArray.filter(item => !item.discountPercentage || item.discountPercentage === "")
    if (itemsWithoutDiscount.length > 0) {
      alert("Please set discount percentage for all selected items")
      return
    }

    try {
      setActivatingOffer(true)

      // Prepare offer data
      const offerData = {
        goalId: goalId || 'grow-customers',
        discountType: discountType || 'percentage',
        items: selectedItemsArray.map(item => ({
          itemId: item.item.id,
          itemName: item.item.name,
          originalPrice: item.item.price,
          discountPercentage: parseInt(item.discountPercentage),
          discountedPrice: parseFloat(getDiscountedPrice(item.item, item.discountPercentage)),
          couponCode: item.couponCode,
          image: item.item.image || (item.item.images && item.item.images[0]) || '',
          isVeg: item.item.foodType === 'Veg',
        })),
        customerGroup: 'all',
        offerPreference: 'all',
        offerDays: 'all',
        targetMealtime: 'all',
        minOrderValue: 0,
      }

      // Call API to create and activate offer
      const response = await restaurantAPI.createOffer(offerData)

      if (response?.data?.success) {
        alert("Offer activated successfully!")
        navigate("/restaurant/hub-growth/create-offers")
      } else {
        throw new Error(response?.data?.message || "Failed to activate offer")
      }
    } catch (error) {
      console.error("Error activating offer:", error)
      alert(error?.response?.data?.message || error?.message || "Failed to activate offer. Please try again.")
    } finally {
      setActivatingOffer(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/restaurant/hub-growth/create-offers/${goalId}`)}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">
            {discountType === "percentage" ? "Create percentage discount" : "Create flat discount"}
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[57px] z-30 bg-white border-b border-gray-200">
        <div className="flex gap-1 px-4 py-2">
                  <button
            onClick={() => setActiveTab("dish")}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${
              activeTab === "dish"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Dish
          </button>
          <button
            onClick={() => setActiveTab("running-offer")}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${
              activeTab === "running-offer"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Running Offer
                  </button>
                </div>
                    </div>

      {/* Search Bar (only show in Dish tab) */}
      {activeTab === "dish" && (
        <div className="sticky top-[113px] z-20 bg-white px-4 py-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
              type="text"
              placeholder="Search food items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
                    </div>
                </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 py-6 overflow-y-auto">
        {activeTab === "dish" ? (
          loadingMenu ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-500 mt-4">Loading menu items...</p>
                    </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No items found</p>
                  </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              return (
                <motion.div
                  key={item.id}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white rounded-lg p-4 border-2 border-gray-200 transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Item Image */}
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={item.image || item.images?.[0] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null
                          e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"
                        }}
                      />
                      {/* Veg/Non-Veg Indicator */}
                      <div className="absolute top-1 left-1">
                        {/* Veg/Non-Veg Indicator (Veg = green, Non-Veg = red) */}
                        <div
                          className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                            item.foodType?.toLowerCase() === "veg"
                              ? "border-green-600 bg-white"
                              : "border-red-600 bg-white"
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full ${
                              item.foodType?.toLowerCase() === "veg" ? "bg-green-600" : "bg-red-600"
                            }`}
                          />
                    </div>
            </div>
          </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-gray-900 mb-1 line-clamp-1">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                              {item.description}
                            </p>
                          )}
              <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-900">
                              ₹{item.price || 0}
                            </span>
                </div>
              </div>
            </div>


                      {/* Make Offer Button */}
                      <div className="mt-2 flex justify-end">
                  <button
                          onClick={() => openMakeOfferModal(item)}
                          className="py-1.5 px-3 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                          <Tag className="w-3.5 h-3.5" />
                          Make Offer
                  </button>
                  </div>
                </div>
              </div>
                </motion.div>
              )
            })}
              </div>
        )
        ) : (
          loadingOffers ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-500 mt-4">Loading running offers...</p>
            </div>
          ) : runningOffers.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No running offers</p>
              <p className="text-sm text-gray-400 mt-2">Create your first offer from the Dish tab</p>
          </div>
          ) : (
            <div className="space-y-4">
              {runningOffers.map((offer) => (
                <motion.div
                  key={offer._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        offer.status === 'active' ? 'bg-red-500' : 
                        offer.status === 'paused' ? 'bg-orange-500' : 
                        'bg-gray-400'
                      }`}></div>
                      <span className={`text-xs font-medium ${
                        offer.status === 'active' ? 'text-red-600' : 
                        offer.status === 'paused' ? 'text-orange-600' : 
                        'text-gray-600'
                      }`}>
                        {offer.status === 'active' ? 'Active' : 
                         offer.status === 'paused' ? 'Paused' : 
                         offer.status || 'Inactive'}
                      </span>
                </div>
                  <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {new Date(offer.createdAt).toLocaleDateString()}
                      </span>
                      {/* Edit and Delete Icons */}
                    <button
                        onClick={() => {
                          const offerItem = offer.items?.[0]
                          if (offerItem) {
                            // Find the original menu item to edit
                            const menuItem = menuItems.find(item => item.id === offerItem.itemId) || {
                              id: offerItem.itemId,
                              name: offerItem.itemName,
                              price: offerItem.originalPrice,
                              image: offerItem.image,
                              foodType: offerItem.isVeg ? 'Veg' : 'Non-Veg',
                            }
                            openMakeOfferModal(menuItem, offer)
                          }
                        }}
                        className="p-1.5 rounded-full hover:bg-blue-50 text-blue-600 transition-colors"
                        title="Edit offer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteOffer(offer._id)}
                        disabled={deletingOfferId === offer._id}
                        className="p-1.5 rounded-full hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                        title="Delete offer"
                      >
                        {deletingOfferId === offer._id ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                  </button>
                    </div>
                </div>

                  {/* Toggle Button */}
                  <div className="mb-3 pt-2 border-t border-gray-200">
                      <button
                      onClick={() => handleToggleOfferStatus(offer)}
                      disabled={togglingOfferId === offer._id}
                      className={`w-full py-2 px-4 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 ${
                        offer.status === 'active'
                          ? "bg-orange-600 text-white hover:bg-orange-700"
                          : "bg-red-600 text-white hover:bg-red-700"
                      } disabled:opacity-50`}
                    >
                      {togglingOfferId === offer._id ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>{offer.status === 'active' ? 'Deactivating...' : 'Activating...'}</span>
                        </>
                      ) : (
                        <span>{offer.status === 'active' ? 'Deactivate Offer' : 'Activate Offer'}</span>
                      )}
                      </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        {offer.items?.length || 0} item{offer.items?.length !== 1 ? 's' : ''} on offer
                      </span>
                </div>

                    {offer.items && offer.items.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {offer.items.slice(0, 3).map((item, index) => (
                          <div key={index} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
                            <img
                              src={item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"}
                              alt={item.itemName}
                              className="w-12 h-12 rounded object-cover"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.itemName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-400 line-through">₹{item.originalPrice}</span>
                                <span className="text-xs font-semibold text-red-600">₹{item.discountedPrice}</span>
                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                                  {offer.discountType === "flat-price" 
                                    ? `₹${item.originalPrice - item.discountedPrice} OFF`
                                    : `${item.discountPercentage}% OFF`}
                                </span>
                  </div>
                </div>
                            <div className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {item.couponCode}
              </div>
            </div>
                        ))}
                        {offer.items.length > 3 && (
                          <p className="text-xs text-gray-500 text-center mt-2">
                            +{offer.items.length - 3} more item{offer.items.length - 3 !== 1 ? 's' : ''}
                          </p>
                        )}
          </div>
                    )}
        </div>
                </motion.div>
              ))}
      </div>
          )
        )}
      </div>


      {/* Discount Percentage Selection Modal */}
      <AnimatePresence>
        {discountModal.open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDiscountModal}
              className="fixed inset-0 bg-black/50 z-[9999]"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[9999] max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 text-center">
                  Select discount percentage
                </h2>
              </div>

              {/* Search Bar */}
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search percentage..."
                    value={percentageSearchQuery}
                    onChange={(e) => setPercentageSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* List of Options */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {filteredPercentages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No options found</div>
                ) : (
                  <div className="space-y-3">
                    {filteredPercentages.map((percentage) => {
                      const isSelected = getCurrentPercentage() === percentage
                      return (
                        <div
                          key={percentage}
                          onClick={() => handleDiscountSelect(percentage)}
                          className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {percentage}% discount
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDiscountSelect(percentage)
                              }}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-black border-black"
                                  : "bg-white border-gray-400"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-4 border-t border-gray-200">
                <button
                  onClick={closeDiscountModal}
                  className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
                    getCurrentPercentage()
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  disabled={!getCurrentPercentage()}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Make Offer Modal */}
      <AnimatePresence>
        {makeOfferModal.open && makeOfferModal.item && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMakeOfferModal}
              className="fixed inset-0 bg-black/50 z-[9999]"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[9999] max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  {makeOfferModal.editingOffer ? "Edit Offer" : "Make Offer"} - {makeOfferModal.item.name || makeOfferModal.item.itemName}
                </h2>
                <button
                  onClick={closeMakeOfferModal}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Discount Type Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Type
                  </label>
                  <select
                    value={offerFormData.discountType}
                    onChange={(e) => handleOfferFormChange("discountType", e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="percentage">Percentage Discount</option>
                    <option value="flat">Flat Discount</option>
                  </select>
                </div>

                {/* Percentage Discount */}
                {offerFormData.discountType === "percentage" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Discount Percentage (%)
                    </label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={offerFormData.percentage}
                        onChange={(e) => handleOfferFormChange("percentage", e.target.value)}
                        placeholder="Enter discount percentage"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {offerFormData.percentage && makeOfferModal.item && (
                      <p className="text-xs text-gray-500 mt-1">
                        Original: ₹{makeOfferModal.item.price || makeOfferModal.item.originalPrice} → Discounted: ₹{getDiscountedPrice(makeOfferModal.item, offerFormData.percentage)}
                      </p>
                    )}
                  </div>
                )}

                {/* Flat Discount */}
                {offerFormData.discountType === "flat" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Flat Discount Amount (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                      <input
                        type="number"
                        min="0"
                        max={makeOfferModal.item?.price || makeOfferModal.item?.originalPrice || 10000}
                        value={offerFormData.flatAmount}
                        onChange={(e) => handleOfferFormChange("flatAmount", e.target.value)}
                        placeholder="Enter flat discount amount"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {offerFormData.flatAmount && makeOfferModal.item && (
                      <p className="text-xs text-gray-500 mt-1">
                        Original: ₹{makeOfferModal.item.price || makeOfferModal.item.originalPrice} → Discounted: ₹{getFlatDiscountedPrice(makeOfferModal.item, offerFormData.flatAmount)}
                      </p>
                    )}
                  </div>
                )}

                {/* Coupon Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Coupon Code
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={offerFormData.couponCode}
                      onChange={(e) => handleOfferFormChange("couponCode", e.target.value)}
                      placeholder="Enter coupon code"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {offerFormData.discountType === "percentage" 
                      ? "Coupon code will be auto-generated based on percentage"
                      : "Coupon code will be auto-generated based on flat discount amount"}
                  </p>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      value={offerFormData.startDate}
                      onChange={(e) => handleOfferFormChange("startDate", e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      value={offerFormData.endDate}
                      onChange={(e) => handleOfferFormChange("endDate", e.target.value)}
                      min={offerFormData.startDate || new Date().toISOString().split('T')[0]}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-4 border-t border-gray-200">
                <button
                  onClick={handleActivateSingleOffer}
                  disabled={
                    activatingOffer || 
                    !offerFormData.couponCode || 
                    !offerFormData.startDate || 
                    !offerFormData.endDate ||
                    (offerFormData.discountType === "percentage" && !offerFormData.percentage) ||
                    (offerFormData.discountType === "flat" && !offerFormData.flatAmount)
                  }
                  className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
                    offerFormData.couponCode && 
                    offerFormData.startDate && 
                    offerFormData.endDate && 
                    ((offerFormData.discountType === "percentage" && offerFormData.percentage) || 
                     (offerFormData.discountType === "flat" && offerFormData.flatAmount)) &&
                    !activatingOffer
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {activatingOffer ? (makeOfferModal.editingOffer ? "Updating..." : "Activating...") : (makeOfferModal.editingOffer ? "Update Offer" : "Activate Offer")}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNavOrders />
    </div>
  )
}
