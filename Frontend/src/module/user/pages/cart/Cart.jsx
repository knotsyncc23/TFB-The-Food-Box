import { useState, useEffect, useRef, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus, Minus, ArrowLeft, ChevronRight, Clock, MapPin, Phone, FileText, Utensils, Tag, Percent, Share2, ChevronUp, ChevronDown, X, Check, Settings, CreditCard, Wallet, Building2, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

import AnimatedPage from "../../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import { useCart } from "../../context/CartContext"
import { useProfile } from "../../context/ProfileContext"
import { useLocationSelector } from "../../components/UserLayout"
import { useOrders } from "../../context/OrdersContext"
import { useLocation as useUserLocation } from "../../hooks/useLocation"
import { useZone } from "../../hooks/useZone"
import { orderAPI, restaurantAPI, adminAPI, userAPI, API_ENDPOINTS } from "@/lib/api"
import { API_BASE_URL } from "@/lib/api/config"
import { initRazorpayPayment } from "@/lib/utils/razorpay"
import { toast } from "sonner"
import { getCompanyNameAsync } from "@/lib/utils/businessSettings"
import { shareContent } from "@/lib/utils/share"


// Removed hardcoded suggested items - now fetching approved addons from backend
// Coupons will be fetched from backend based on items in cart

/**
 * Format full address string from address object
 * @param {Object} address - Address object with street, additionalDetails, city, state, zipCode, or formattedAddress
 * @returns {String} Formatted address string
 */
const formatFullAddress = (address) => {
  if (!address) return ""

  // Priority 1: Use formattedAddress if available (for live location addresses)
  if (address.formattedAddress && address.formattedAddress !== "Select location") {
    return address.formattedAddress
  }

  // Priority 2: Build address from parts
  const addressParts = []
  if (address.street) addressParts.push(address.street)
  if (address.additionalDetails) addressParts.push(address.additionalDetails)
  if (address.city) addressParts.push(address.city)
  if (address.state) addressParts.push(address.state)
  if (address.zipCode) addressParts.push(address.zipCode)

  if (addressParts.length > 0) {
    return addressParts.join(', ')
  }

  // Priority 3: Use address field if available
  if (address.address && address.address !== "Select location") {
    return address.address
  }

  return ""
}

const normalizeFoodTypeValue = (value) => {
  if (typeof value !== "string") return null

  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, "-")
  if (!normalized) return null

  if (normalized === "veg") return "veg"
  if (normalized.includes("non-veg") || normalized.includes("nonveg") || normalized === "egg") {
    return "non-veg"
  }

  return null
}

const isCartItemVeg = (item) => {
  const explicitFoodTypes = [
    normalizeFoodTypeValue(item?.variationFoodType),
    normalizeFoodTypeValue(item?.foodType),
  ].filter(Boolean)

  if (explicitFoodTypes.includes("non-veg")) {
    return false
  }

  if (explicitFoodTypes.includes("veg")) {
    return true
  }

  if (item?.isVeg === false) return false
  if (item?.isVeg === true) return true

  // Default to non-veg when type is unknown so we don't incorrectly show a green badge.
  return false
}

const getAddonApprovalStatus = (addon) => {
  const status = String(addon?.approvalStatus || "").trim().toLowerCase()
  if (status === "approved" || status === "pending" || status === "rejected") return status
  if (addon?.isApproved === true) return "approved"
  if (addon?.approvedAt && !addon?.rejectedAt) return "approved"
  if (addon?.rejectedAt) return "rejected"
  return "pending"
}

const isAddonVeg = (addon) => {
  const explicitFoodType = normalizeFoodTypeValue(addon?.foodType)
  if (explicitFoodType === "veg") return true
  if (explicitFoodType === "non-veg") return false
  if (addon?.isVeg === true) return true
  if (addon?.isVeg === false) return false
  return true
}

export default function Cart() {
  const navigate = useNavigate()

  // Defensive check: Ensure CartProvider is available
  let cartContext;
  try {
    cartContext = useCart();
  } catch (error) {
    console.error('❌ CartProvider not found. Make sure Cart component is rendered within UserLayout.');
    // Return early with error message
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Cart Error</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Cart functionality is not available. Please refresh the page.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const { cart, updateQuantity, addToCart, getCartCount, clearCart, cleanCartForRestaurant } = cartContext;
  const { getDefaultAddress, getDefaultPaymentMethod, addresses, paymentMethods, userProfile } = useProfile()
  const { createOrder } = useOrders()
  const { openLocationSelector } = useLocationSelector()
  const { location: currentLocation } = useUserLocation() // Get live location address
  const { zoneId } = useZone(currentLocation) // Get user's zone

  const [showCoupons, setShowCoupons] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponCode, setCouponCode] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("razorpay") // razorpay | cash | wallet
  const [walletBalance, setWalletBalance] = useState(0)
  const [isLoadingWallet, setIsLoadingWallet] = useState(false)
  const [deliveryFleet] = useState("standard")
  const [note, setNote] = useState("")
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [sendCutlery, setSendCutlery] = useState(true)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [showBillDetails, setShowBillDetails] = useState(false)
  const billDetailsRef = useRef(null)
  const [showPlacingOrder, setShowPlacingOrder] = useState(false)
  const [orderProgress, setOrderProgress] = useState(0)
  const [showOrderSuccess, setShowOrderSuccess] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState(null)
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [contactName, setContactName] = useState(userProfile?.name || "")
  const [contactPhoneInput, setContactPhoneInput] = useState(userProfile?.phone || "")

  // Restaurant and pricing state
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(false)
  const [pricing, setPricing] = useState(null)
  const [loadingPricing, setLoadingPricing] = useState(false)

  // Addons state
  const [addons, setAddons] = useState([])
  const [loadingAddons, setLoadingAddons] = useState(false)

  // Coupons state - fetched from backend
  const [availableCoupons, setAvailableCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)

  // Fee settings from database (used as fallback if pricing not available)
  const [feeSettings, setFeeSettings] = useState({
    deliveryFee: 25,
    freeDeliveryThreshold: 149,
    platformFee: 5,
    gstRate: 5,
  })
  const [showAddressPicker, setShowAddressPicker] = useState(false)
  const [selectedAddressType, setSelectedAddressType] = useState(null)


  const cartCount = getCartCount()
  const savedAddress = getDefaultAddress()
  // Priority: Use live location if available, otherwise use saved address
  const defaultAddress = currentLocation?.formattedAddress && currentLocation.formattedAddress !== "Select location"
    ? {
      ...savedAddress,
      formattedAddress: currentLocation.formattedAddress,
      address: currentLocation.address || currentLocation.formattedAddress,
      street: currentLocation.street || currentLocation.address,
      city: currentLocation.city,
      state: currentLocation.state,
      zipCode: currentLocation.postalCode,
      area: currentLocation.area,
      location: currentLocation.latitude && currentLocation.longitude ? {
        coordinates: [currentLocation.longitude, currentLocation.latitude]
      } : savedAddress?.location
    }
    : savedAddress
  const defaultPayment = getDefaultPaymentMethod()

  // Get restaurant ID from cart or restaurant data
  // Priority: restaurantData > cart[0].restaurantId
  // DO NOT use cart[0].restaurant as slug fallback - it creates wrong slugs
  const restaurantId = cart.length > 0
    ? (restaurantData?._id || restaurantData?.restaurantId || cart[0]?.restaurantId || null)
    : null

  // Stable restaurant ID for addons fetch (memoized to prevent dependency array issues)
  // Prefer restaurantData IDs (more reliable) over slug from cart
  const restaurantIdForAddons = useMemo(() => {
    // Only use restaurantData if it's loaded, otherwise wait
    if (restaurantData) {
      return restaurantData._id || restaurantData.restaurantId || null
    }
    // If restaurantData is not loaded yet, return null to wait
    return null
  }, [restaurantData])

  // Keep local contact details in sync with profile when it changes,
  // but edits made here are ONLY for this checkout view (not saved to profile).
  useEffect(() => {
    setContactName(userProfile?.name || "")
    setContactPhoneInput(userProfile?.phone || "")
  }, [userProfile?.name, userProfile?.phone])

  // Sync selected address type from saved default address (for initial render / refresh)
  useEffect(() => {
    const baseAddress = savedAddress
    const serverType = baseAddress?.type || baseAddress?.label || null
    if (serverType && serverType !== selectedAddressType) {
      setSelectedAddressType(serverType)
    }
  }, [savedAddress, selectedAddressType])

  // Lock body scroll and scroll to top when any full-screen modal opens
  useEffect(() => {
    if (showPlacingOrder || showOrderSuccess) {
      // Lock body scroll
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = `-${window.scrollY}px`

      // Scroll window to top
      window.scrollTo({ top: 0, behavior: 'instant' })
    } else {
      // Restore body scroll
      const scrollY = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1)
      }
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
    }
  }, [showPlacingOrder, showOrderSuccess])

  // Scroll to bill details when shown
  useEffect(() => {
    if (showBillDetails && billDetailsRef.current) {
      setTimeout(() => {
        billDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showBillDetails]);

  // Fetch restaurant data when cart has items
  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (cart.length === 0) {
        setRestaurantData(null)
        return
      }

      // If we already have restaurantData, don't fetch again
      if (restaurantData) {
        return
      }

      setLoadingRestaurant(true)

      // Strategy 1: Try using restaurantId from cart if available
      if (cart[0]?.restaurantId) {
        try {
          const cartRestaurantId = cart[0].restaurantId;
          const cartRestaurantName = cart[0].restaurant;

          console.log("🔄 Fetching restaurant data by restaurantId from cart:", cartRestaurantId)
          const response = await restaurantAPI.getRestaurantById(cartRestaurantId)
          const data = response?.data?.data?.restaurant || response?.data?.restaurant

          if (data) {
            // CRITICAL: Validate that fetched restaurant matches cart items
            const fetchedRestaurantId = data.restaurantId || data._id?.toString();
            const fetchedRestaurantName = data.name;

            // Check if restaurantId matches
            const restaurantIdMatches =
              fetchedRestaurantId === cartRestaurantId ||
              data._id?.toString() === cartRestaurantId ||
              data.restaurantId === cartRestaurantId;

            // Check if restaurant name matches (if available in cart)
            const restaurantNameMatches =
              !cartRestaurantName ||
              fetchedRestaurantName?.toLowerCase().trim() === cartRestaurantName.toLowerCase().trim();

            if (!restaurantIdMatches) {
              console.error('❌ CRITICAL: Fetched restaurant ID does not match cart restaurantId!', {
                cartRestaurantId: cartRestaurantId,
                fetchedRestaurantId: fetchedRestaurantId,
                fetched_id: data._id?.toString(),
                fetched_restaurantId: data.restaurantId,
                cartRestaurantName: cartRestaurantName,
                fetchedRestaurantName: fetchedRestaurantName
              });
              // Don't set restaurantData if IDs don't match - this prevents wrong restaurant assignment
              setLoadingRestaurant(false);
              return;
            }

            if (!restaurantNameMatches) {
              console.warn('⚠️ WARNING: Restaurant name mismatch:', {
                cartRestaurantName: cartRestaurantName,
                fetchedRestaurantName: fetchedRestaurantName
              });
              // Still proceed but log warning
            }

            console.log("✅ Restaurant data loaded from cart restaurantId:", {
              _id: data._id,
              restaurantId: data.restaurantId,
              name: data.name,
              cartRestaurantId: cartRestaurantId,
              cartRestaurantName: cartRestaurantName
            })
            setRestaurantData(data)
            setLoadingRestaurant(false)
            return
          }
        } catch (error) {
          console.warn("⚠️ Failed to fetch by cart restaurantId, trying fallback...", error)
        }
      }

      // Strategy 2: If no restaurantId in cart, search by restaurant name
      if (cart[0]?.restaurant && !restaurantData) {
        try {
          console.log("🔍 Searching restaurant by name:", cart[0].restaurant)
          const searchResponse = await restaurantAPI.getRestaurants({ limit: 100 })
          const restaurants = searchResponse?.data?.data?.restaurants || searchResponse?.data?.data || []
          console.log("📋 Fetched", restaurants.length, "restaurants for name search")

          // Try exact match first
          let matchingRestaurant = restaurants.find(r =>
            r.name?.toLowerCase().trim() === cart[0].restaurant?.toLowerCase().trim()
          )

          // If no exact match, try partial match
          if (!matchingRestaurant) {
            console.log("🔍 No exact match, trying partial match...")
            matchingRestaurant = restaurants.find(r =>
              r.name?.toLowerCase().includes(cart[0].restaurant?.toLowerCase().trim()) ||
              cart[0].restaurant?.toLowerCase().trim().includes(r.name?.toLowerCase())
            )
          }

          if (matchingRestaurant) {
            // CRITICAL: Validate that the found restaurant matches cart items
            const cartRestaurantName = cart[0]?.restaurant?.toLowerCase().trim();
            const foundRestaurantName = matchingRestaurant.name?.toLowerCase().trim();

            if (cartRestaurantName && foundRestaurantName && cartRestaurantName !== foundRestaurantName) {
              console.error("❌ CRITICAL: Restaurant name mismatch!", {
                cartRestaurantName: cart[0]?.restaurant,
                foundRestaurantName: matchingRestaurant.name,
                cartRestaurantId: cart[0]?.restaurantId,
                foundRestaurantId: matchingRestaurant.restaurantId || matchingRestaurant._id
              });
              // Don't set restaurantData if names don't match - this prevents wrong restaurant assignment
              setLoadingRestaurant(false);
              return;
            }

            console.log("✅ Found restaurant by name:", {
              name: matchingRestaurant.name,
              _id: matchingRestaurant._id,
              restaurantId: matchingRestaurant.restaurantId,
              slug: matchingRestaurant.slug,
              cartRestaurantName: cart[0]?.restaurant
            })
            setRestaurantData(matchingRestaurant)
            setLoadingRestaurant(false)
            return
          } else {
            console.warn("⚠️ Restaurant not found even by name search. Searched in", restaurants.length, "restaurants")
            if (restaurants.length > 0) {
              console.log("📋 Available restaurant names:", restaurants.map(r => r.name).slice(0, 10))
            }
          }
        } catch (searchError) {
          console.warn("⚠️ Error searching restaurants by name:", searchError)
        }
      }

      // If all strategies fail, set to null
      setRestaurantData(null)
      setLoadingRestaurant(false)
    }

    fetchRestaurantData()
  }, [cart.length, cart[0]?.restaurantId, cart[0]?.restaurant])

  // Fetch approved addons for the restaurant
  useEffect(() => {
    const fetchAddonsWithId = async (idToUse) => {

      console.log("🔍 Addons fetch - Using ID:", {
        restaurantData: restaurantData ? {
          _id: restaurantData._id,
          restaurantId: restaurantData.restaurantId,
          name: restaurantData.name
        } : 'Not loaded',
        cartRestaurantId: restaurantId,
        idToUse: idToUse
      })

      // Convert to string for validation
      const idString = String(idToUse)
      console.log("🔍 Restaurant ID string:", idString, "Type:", typeof idString, "Length:", idString.length)

      // Validate ID format (should be ObjectId or restaurantId format)
      const isValidIdFormat = /^[a-zA-Z0-9\-_]+$/.test(idString) && idString.length >= 3

      if (!isValidIdFormat) {
        console.warn("⚠️ Restaurant ID format invalid:", idString)
        setAddons([])
        return
      }

      try {
        setLoadingAddons(true)
        console.log("🚀 Fetching addons for restaurant ID:", idString)
        const response = await restaurantAPI.getAddonsByRestaurantId(idString)
        console.log("✅ Addons API response received:", response?.data)
        console.log("📦 Response structure:", {
          success: response?.data?.success,
          data: response?.data?.data,
          addons: response?.data?.data?.addons,
          directAddons: response?.data?.addons
        })

        const data = response?.data?.data?.addons || response?.data?.addons || []
        console.log("📊 Fetched addons count:", data.length)
        console.log("📋 Fetched addons data:", JSON.stringify(data, null, 2))
        const approvedAddons = data.filter((addon) => getAddonApprovalStatus(addon) === "approved")

        if (approvedAddons.length === 0) {
          console.warn("⚠️ No addons returned from API. Response:", response?.data)
        } else {
          console.log("✅ Successfully fetched", approvedAddons.length, "approved addons:", approvedAddons.map(a => a.name))
        }

        setAddons(approvedAddons)
      } catch (error) {
        // Log error for debugging
        console.error("❌ Addons fetch error:", {
          code: error.code,
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
          data: error.response?.data
        })
        // Silently handle network errors and 404 errors
        // Network errors (ERR_NETWORK) happen when backend is not running - this is OK for development
        // 404 errors mean restaurant might not have addons or restaurant not found - also OK
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error("Error fetching addons:", error)
        }
        // Continue with cart even if addons fetch fails
        setAddons([])
      } finally {
        setLoadingAddons(false)
      }
    }

    const fetchAddons = async () => {
      if (cart.length === 0) {
        setAddons([])
        return
      }

      // Wait for restaurantData to be loaded (including fallback search)
      if (loadingRestaurant) {
        console.log("⏳ Waiting for restaurantData to load (including fallback search)...")
        return
      }

      // Must have restaurantData to fetch addons
      if (!restaurantData) {
        console.warn("⚠️ No restaurantData available for addons fetch")
        setAddons([])
        return
      }

      // Use restaurantData ID (most reliable)
      const idToUse = restaurantData._id || restaurantData.restaurantId
      if (!idToUse) {
        console.warn("⚠️ No valid restaurant ID in restaurantData")
        setAddons([])
        return
      }

      console.log("✅ Using restaurantData ID for addons:", idToUse)
      fetchAddonsWithId(idToUse)
    }

    fetchAddons()
  }, [restaurantData, cart.length, loadingRestaurant])

  // Fetch coupons for items in cart
  useEffect(() => {
    const fetchCouponsForCartItems = async () => {
      if (cart.length === 0 || !restaurantId) {
        setAvailableCoupons([])
        return
      }

      console.log(`[CART-COUPONS] Fetching coupons for ${cart.length} items in cart`)
      setLoadingCoupons(true)

      const allCoupons = []
      const uniqueCouponCodes = new Set()

      // Fetch coupons for each item in cart
      for (const cartItem of cart) {
        if (!cartItem.id) {
          console.log(`[CART-COUPONS] Skipping item without id:`, cartItem)
          continue
        }

        try {
          console.log(`[CART-COUPONS] Fetching coupons for itemId: ${cartItem.id}, name: ${cartItem.name}`)
          const response = await restaurantAPI.getCouponsByItemIdPublic(restaurantId, cartItem.id)

          if (response?.data?.success && response?.data?.data?.coupons) {
            const coupons = response.data.data.coupons
            console.log(`[CART-COUPONS] Found ${coupons.length} coupons for item ${cartItem.id}`)

            // Add coupons, avoiding duplicates
            coupons.forEach(coupon => {
              if (!uniqueCouponCodes.has(coupon.couponCode)) {
                uniqueCouponCodes.add(coupon.couponCode)
                // Convert backend coupon format to frontend format
                allCoupons.push({
                  code: coupon.couponCode,
                  discount: coupon.originalPrice - coupon.discountedPrice,
                  discountPercentage: coupon.discountPercentage,
                  minOrder: coupon.minOrderValue || 0,
                  description: `Save ₹${coupon.originalPrice - coupon.discountedPrice} with '${coupon.couponCode}'`,
                  originalPrice: coupon.originalPrice,
                  discountedPrice: coupon.discountedPrice,
                  itemId: cartItem.id,
                  itemName: cartItem.name,
                })
              }
            })
          }
        } catch (error) {
          console.error(`[CART-COUPONS] Error fetching coupons for item ${cartItem.id}:`, error)
        }
      }

      console.log(`[CART-COUPONS] Total unique coupons found: ${allCoupons.length}`, allCoupons)
      setAvailableCoupons(allCoupons)
      setLoadingCoupons(false)
    }

    fetchCouponsForCartItems()
  }, [cart, restaurantId])

  // Calculate pricing from backend whenever cart, address, or coupon changes
  useEffect(() => {
    const calculatePricing = async () => {
      if (cart.length === 0 || !defaultAddress) {
        setPricing(null)
        return
      }

      try {
        setLoadingPricing(true)
        const items = cart.map(item => {
          const foodType = item.foodType || item.variationFoodType
          const isVeg = isCartItemVeg(item)

          return {
            itemId: item.id,
            name: item.name,
            price: item.price, // Price should already be in INR
            quantity: item.quantity || 1,
            image: item.image,
            description: item.description,
            isVeg,
            foodType: foodType || null,
          }
        })

        const response = await orderAPI.calculateOrder({
          items,
          restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || null,
          deliveryAddress: defaultAddress,
          couponCode: appliedCoupon?.code || couponCode || null,
          deliveryFleet: deliveryFleet || 'standard'
        })

        if (response?.data?.success && response?.data?.data?.pricing) {
          setPricing(response.data.data.pricing)

          // Update applied coupon if backend returns one
          if (response.data.data.pricing.appliedCoupon && !appliedCoupon) {
            const coupon = availableCoupons.find(c => c.code === response.data.data.pricing.appliedCoupon.code)
            if (coupon) {
              setAppliedCoupon(coupon)
            }
          }
        }
      } catch (error) {
        // Network errors or 404 errors - silently handle, fallback to frontend calculation
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error("Error calculating pricing:", error)
        }
        // Fallback to frontend calculation if backend fails
        setPricing(null)
      } finally {
        setLoadingPricing(false)
      }
    }

    calculatePricing()
  }, [cart, defaultAddress, appliedCoupon, couponCode, deliveryFleet, restaurantId])

  // Fetch wallet balance
  useEffect(() => {
    const fetchWalletBalance = async () => {
      try {
        setIsLoadingWallet(true)
        const response = await userAPI.getWallet()
        if (response?.data?.success && response?.data?.data?.wallet) {
          setWalletBalance(response.data.data.wallet.balance || 0)
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error)
        setWalletBalance(0)
      } finally {
        setIsLoadingWallet(false)
      }
    }
    fetchWalletBalance()
  }, [])

  // Fetch fee settings on mount
  useEffect(() => {
    const fetchFeeSettings = async () => {
      try {
        const response = await adminAPI.getPublicFeeSettings()
        if (response.data.success && response.data.data.feeSettings) {
          setFeeSettings({
            deliveryFee: response.data.data.feeSettings.deliveryFee || 25,
            freeDeliveryThreshold: response.data.data.feeSettings.freeDeliveryThreshold || 149,
            platformFee: response.data.data.feeSettings.platformFee || 5,
            gstRate: response.data.data.feeSettings.gstRate || 5,
          })
        }
      } catch (error) {
        console.error('Error fetching fee settings:', error)
        // Keep default values on error
      }
    }
    fetchFeeSettings()
  }, [])

  // Use backend pricing if available, otherwise fallback to local settings.
  // Keep GST aligned with backend logic: tax applies on subtotal after discount.
  const computedSubtotal = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
  const subtotal = pricing?.subtotal ?? computedSubtotal
  const discount = pricing?.discount ?? (appliedCoupon ? Math.min(appliedCoupon.discount, subtotal * 0.5) : 0)
  const taxableSubtotal = Math.max(subtotal - discount, 0)
  const deliveryFee = pricing?.deliveryFee ?? (subtotal >= feeSettings.freeDeliveryThreshold || appliedCoupon?.freeDelivery ? 0 : feeSettings.deliveryFee)
  const platformFee = pricing?.platformFee ?? feeSettings.platformFee
  const gstCharges = pricing?.tax ?? pricing?.breakdown?.gst ?? Math.round(taxableSubtotal * (feeSettings.gstRate / 100))
  const totalBeforeDiscount = taxableSubtotal + deliveryFee + platformFee + gstCharges
  const total = pricing?.total ?? totalBeforeDiscount
  const savings = pricing?.savings ?? (discount + (subtotal > 500 ? 32 : 0))

  // Restaurant name from data or cart
  const restaurantName = restaurantData?.name || cart[0]?.restaurant || "Restaurant"

  // Handler to select address by label (used in address picker list to switch location)
  const handleSelectAddressByLabel = async (label) => {
    try {
      // Find address with matching label
      const address = addresses.find(addr => addr.label === label)

      if (!address) {
        toast.error(`No ${label} address found. Please add an address first.`)
        return
      }

      // Get coordinates from address location
      const coordinates = address.location?.coordinates || []
      const longitude = coordinates[0]
      const latitude = coordinates[1]

      if (!latitude || !longitude) {
        toast.error(`Invalid coordinates for ${label} address`)
        return
      }

      // Update location in backend
      await userAPI.updateLocation({
        latitude,
        longitude,
        address: `${address.street}, ${address.city}`,
        city: address.city,
        state: address.state,
        area: address.additionalDetails || "",
        formattedAddress: address.additionalDetails
          ? `${address.additionalDetails}, ${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`
          : `${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`
      })

      // Update the location in localStorage and for useLocation
      const formattedAddressStr = address.additionalDetails
        ? `${address.additionalDetails}, ${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`
        : `${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`
      const locationData = {
        selectionMode: "manual",
        addressId: address.id || address._id || null,
        city: address.city,
        state: address.state,
        street: address.street,
        address: `${address.street}, ${address.city}`,
        area: address.additionalDetails || "",
        zipCode: address.zipCode,
        latitude,
        longitude,
        formattedAddress: formattedAddressStr,
        location: { type: "Point", coordinates: [longitude, latitude] },
      }
      localStorage.setItem("userLocation", JSON.stringify(locationData))
      localStorage.setItem("userLocationMode", "manual")
      localStorage.removeItem("userZoneId")
      localStorage.removeItem("userZone")

      // Notify useLocation so cart UI updates without full reload
      window.dispatchEvent(new CustomEvent("userLocationUpdated", { detail: locationData }))

      toast.success(`${label} address selected!`)
    } catch (error) {
      console.error(`Error selecting ${label} address:`, error)
      const message = error.response?.data?.message || error.response?.data?.error || error.message
      toast.error(message || `Failed to update address. Please try again.`)
    }
  }

  // Handler to update address type (Home, Office, Other) just for this cart/session.
  // No backend update is performed to avoid route/404 errors; this is purely UI state.
  const handleAddressTypeChange = (nextType) => {
    const baseAddress = savedAddress
    const currentType = selectedAddressType || baseAddress?.type || baseAddress?.label || null
    if (!nextType || currentType === nextType) {
      // No change
      return
    }

    // If there is NO saved address with this label (e.g. "Office"),
    // open the add-address flow pre-configured for that label.
    const hasAddressForType = addresses?.some(
      (addr) => addr.label === nextType,
    )

    if (!hasAddressForType) {
      setSelectedAddressType(nextType)
      try {
        localStorage.setItem("preferredAddressLabel", nextType)
        // When opened from Cart, ensure we come back to Cart after closing
        localStorage.setItem("locationReturnPath", "/user/cart")
      } catch {
        // ignore storage errors
      }
      openLocationSelector()
      return
    }

    setSelectedAddressType(nextType)
    try {
      localStorage.setItem("lastAddressType", nextType)
    } catch {
      // ignore storage errors
    }
  }

  const handleApplyCoupon = async (coupon) => {
    if (subtotal >= coupon.minOrder) {
      setAppliedCoupon(coupon)
      setCouponCode(coupon.code)
      setShowCoupons(false)

      // Recalculate pricing with new coupon
      if (cart.length > 0 && defaultAddress) {
        try {
          const items = cart.map(item => ({
            itemId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            image: item.image,
            description: item.description,
            isVeg: isCartItemVeg(item)
          }))

          const response = await orderAPI.calculateOrder({
            items,
            restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || null,
            deliveryAddress: defaultAddress,
            couponCode: coupon.code,
            deliveryFleet: deliveryFleet || 'standard'
          })

          if (response?.data?.success && response?.data?.data?.pricing) {
            setPricing(response.data.data.pricing)
          }
        } catch (error) {
          console.error("Error recalculating pricing:", error)
        }
      }
    }
  }


  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null)
    setCouponCode("")

    // Recalculate pricing without coupon
    if (cart.length > 0 && defaultAddress) {
        try {
          const items = cart.map(item => ({
            itemId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            image: item.image,
            description: item.description,
            isVeg: isCartItemVeg(item)
          }))

        const response = await orderAPI.calculateOrder({
          items,
          restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || null,
          deliveryAddress: defaultAddress,
          couponCode: null,
          deliveryFleet: deliveryFleet || 'standard'
        })

        if (response?.data?.success && response?.data?.data?.pricing) {
          setPricing(response.data.data.pricing)
        }
      } catch (error) {
        console.error("Error recalculating pricing:", error)
      }
    }
  }


  const handlePlaceOrder = async () => {
    if (isPlacingOrder) return

    if (!defaultAddress || 
        defaultAddress.formattedAddress === "Select location" || 
        defaultAddress.address === "Select location" || 
        defaultAddress.city === "Current Location" ||
        (!defaultAddress.street && !defaultAddress.formattedAddress && !defaultAddress.address)) {
      toast.error("Please add a valid delivery address before placing your order")
      return
    }

    if (cart.length === 0) {
      alert("Your cart is empty")
      return
    }

    setIsPlacingOrder(true)

    // Use API_BASE_URL from config (supports both dev and production)

    try {
      console.log("🛒 Starting order placement process...")
      console.log("📦 Cart items:", cart.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, price: item.price })))
      console.log("💰 Applied coupon:", appliedCoupon?.code || "None")
      console.log("📍 Delivery address:", defaultAddress?.label || defaultAddress?.city)

      // Ensure couponCode is included in pricing
      const orderPricing = pricing || {
        subtotal,
        deliveryFee,
        tax: gstCharges,
        platformFee,
        discount,
        total,
        couponCode: appliedCoupon?.code || null
      };

      // Add couponCode if not present but coupon is applied
      if (!orderPricing.couponCode && appliedCoupon?.code) {
        orderPricing.couponCode = appliedCoupon.code;
      }

      // Include all cart items (main items + addons)
      // Note: Addons are added as separate cart items when user clicks the + button
      const orderItems = cart.map(item => ({
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image || "",
        description: item.description || "",
        isVeg: isCartItemVeg(item),
        subCategory: item.subCategory || "",
        ...(item.selectedVariation && {
          selectedVariation: {
            variationId: item.selectedVariation.variationId,
            variationName: item.selectedVariation.variationName,
            price: item.selectedVariation.price,
          },
        }),
      }))

      console.log("📋 Order items to send:", orderItems)
      console.log("💵 Order pricing:", orderPricing)

      // Check API base URL before making request (for debugging)
      const fullUrl = `${API_BASE_URL}${API_ENDPOINTS.ORDER.CREATE}`;
      console.log("🌐 Making request to:", fullUrl)
      console.log("🔑 Authentication token present:", !!localStorage.getItem('accessToken') || !!localStorage.getItem('user_accessToken'))

      // CRITICAL: Validate restaurant ID before placing order
      // Ensure we're using the correct restaurant from restaurantData (most reliable)
      const finalRestaurantId = restaurantData?.restaurantId || restaurantData?._id || null;
      const finalRestaurantName = restaurantData?.name || null;

      if (!finalRestaurantId) {
        console.error('❌ CRITICAL: Cannot place order - Restaurant ID is missing!');
        console.error('📋 Debug info:', {
          restaurantData: restaurantData ? {
            _id: restaurantData._id,
            restaurantId: restaurantData.restaurantId,
            name: restaurantData.name
          } : 'Not loaded',
          cartRestaurantId: restaurantId,
          cartRestaurantName: cart[0]?.restaurant,
          cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            restaurant: item.restaurant,
            restaurantId: item.restaurantId
          }))
        });
        alert('Error: Restaurant information is missing. Please refresh the page and try again.');
        setIsPlacingOrder(false);
        return;
      }

      // CRITICAL: Validate that ALL cart items belong to the SAME restaurant
      const cartRestaurantIds = cart
        .map(item => item.restaurantId)
        .filter(Boolean)
        .map(id => String(id).trim()); // Normalize to string and trim

      const cartRestaurantNames = cart
        .map(item => item.restaurant)
        .filter(Boolean)
        .map(name => name.trim().toLowerCase()); // Normalize names

      // Get unique values (after normalization)
      const uniqueRestaurantIds = [...new Set(cartRestaurantIds)];
      const uniqueRestaurantNames = [...new Set(cartRestaurantNames)];

      // Check if cart has items from multiple restaurants
      // Note: If restaurant names match, allow even if IDs differ (same restaurant, different ID format)
      if (uniqueRestaurantNames.length > 1) {
        // Different restaurant names = definitely different restaurants
        console.error('❌ CRITICAL ERROR: Cart contains items from multiple restaurants!', {
          restaurantIds: uniqueRestaurantIds,
          restaurantNames: uniqueRestaurantNames,
          cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            restaurant: item.restaurant,
            restaurantId: item.restaurantId
          }))
        });

        // Automatically clean cart to keep items from the restaurant matching restaurantData
        if (finalRestaurantId && finalRestaurantName) {
          console.log('🧹 Auto-cleaning cart to keep items from:', finalRestaurantName);
          cleanCartForRestaurant(finalRestaurantId, finalRestaurantName);
          toast.error('Cart contained items from different restaurants. Items from other restaurants have been removed.');
        } else {
          // If restaurantData is not available, keep items from first restaurant in cart
          const firstRestaurantId = cart[0]?.restaurantId;
          const firstRestaurantName = cart[0]?.restaurant;
          if (firstRestaurantId && firstRestaurantName) {
            console.log('🧹 Auto-cleaning cart to keep items from first restaurant:', firstRestaurantName);
            cleanCartForRestaurant(firstRestaurantId, firstRestaurantName);
            toast.error('Cart contained items from different restaurants. Items from other restaurants have been removed.');
          } else {
            toast.error('Cart contains items from different restaurants. Please clear cart and try again.');
          }
        }

        setIsPlacingOrder(false);
        return;
      }

      // If restaurant names match but IDs differ, that's OK (same restaurant, different ID format)
      // But log a warning in development
      if (uniqueRestaurantIds.length > 1 && uniqueRestaurantNames.length === 1) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Cart items have different restaurant IDs but same name. This is OK if IDs are in different formats.', {
            restaurantIds: uniqueRestaurantIds,
            restaurantName: uniqueRestaurantNames[0]
          });
        }
      }

      // Validate that cart items' restaurantId matches the restaurantData
      if (cartRestaurantIds.length > 0) {
        const cartRestaurantId = cartRestaurantIds[0];

        // Check if cart restaurantId matches restaurantData
        const restaurantIdMatches =
          cartRestaurantId === finalRestaurantId ||
          cartRestaurantId === restaurantData?._id?.toString() ||
          cartRestaurantId === restaurantData?.restaurantId;

        if (!restaurantIdMatches) {
          console.error('❌ CRITICAL ERROR: Cart restaurantId does not match restaurantData!', {
            cartRestaurantId: cartRestaurantId,
            finalRestaurantId: finalRestaurantId,
            restaurantDataId: restaurantData?._id?.toString(),
            restaurantDataRestaurantId: restaurantData?.restaurantId,
            restaurantDataName: restaurantData?.name,
            cartRestaurantName: cartRestaurantNames[0]
          });
          alert(`Error: Cart items belong to "${cartRestaurantNames[0] || 'Unknown Restaurant'}" but restaurant data doesn't match. Please refresh the page and try again.`);
          setIsPlacingOrder(false);
          return;
        }
      }

      // Validate restaurant name matches
      if (cartRestaurantNames.length > 0 && finalRestaurantName) {
        const cartRestaurantName = cartRestaurantNames[0];
        if (cartRestaurantName.toLowerCase().trim() !== finalRestaurantName.toLowerCase().trim()) {
          console.error('❌ CRITICAL ERROR: Restaurant name mismatch!', {
            cartRestaurantName: cartRestaurantName,
            finalRestaurantName: finalRestaurantName
          });
          alert(`Error: Cart items belong to "${cartRestaurantName}" but restaurant data shows "${finalRestaurantName}". Please refresh the page and try again.`);
          setIsPlacingOrder(false);
          return;
        }
      }

      // Log order details for debugging
      console.log('✅ Order validation passed - Placing order with restaurant:', {
        restaurantId: finalRestaurantId,
        restaurantName: finalRestaurantName,
        restaurantDataId: restaurantData?._id,
        restaurantDataRestaurantId: restaurantData?.restaurantId,
        cartRestaurantId: cartRestaurantIds[0],
        cartRestaurantName: cartRestaurantNames[0],
        cartItemCount: cart.length
      });

      // FINAL VALIDATION: Double-check restaurantId before sending to backend
      const cartRestaurantId = cart[0]?.restaurantId;
      if (cartRestaurantId && cartRestaurantId !== finalRestaurantId &&
        cartRestaurantId !== restaurantData?._id?.toString() &&
        cartRestaurantId !== restaurantData?.restaurantId) {
        console.error('❌ CRITICAL: Final validation failed - restaurantId mismatch!', {
          cartRestaurantId: cartRestaurantId,
          finalRestaurantId: finalRestaurantId,
          restaurantDataId: restaurantData?._id?.toString(),
          restaurantDataRestaurantId: restaurantData?.restaurantId,
          cartRestaurantName: cart[0]?.restaurant,
          finalRestaurantName: finalRestaurantName
        });
        alert('Error: Restaurant information mismatch detected. Please refresh the page and try again.');
        setIsPlacingOrder(false);
        return;
      }

      const orderPayload = {
        items: orderItems,
        address: defaultAddress,
        restaurantId: finalRestaurantId,
        restaurantName: finalRestaurantName,
        pricing: orderPricing,
        deliveryFleet: deliveryFleet || 'standard',
        note: note || "",
        sendCutlery: sendCutlery !== false,
        paymentMethod: selectedPaymentMethod,
        zoneId: zoneId // CRITICAL: Pass zoneId for strict zone validation
      };
      // Log final order details (including paymentMethod for COD debugging)
      console.log('📤 FINAL: Sending order to backend with:', {
        restaurantId: finalRestaurantId,
        restaurantName: finalRestaurantName,
        itemCount: orderItems.length,
        totalAmount: orderPricing.total,
        paymentMethod: orderPayload.paymentMethod
      });

      // Check wallet balance if wallet payment selected
      if (selectedPaymentMethod === "wallet" && walletBalance < total) {
        toast.error(`Insufficient wallet balance. Required: ₹${total.toFixed(0)}, Available: ₹${walletBalance.toFixed(0)}`)
        setIsPlacingOrder(false)
        return
      }

      // Create order in backend
      const orderResponse = await orderAPI.createOrder(orderPayload)

      console.log("✅ Order created successfully:", orderResponse.data)

      const { order, razorpay } = orderResponse.data.data

      // Cash flow: order placed without online payment
      if (selectedPaymentMethod === "cash") {
        toast.success("Order placed with Cash on Delivery")
        setPlacedOrderId(order?.orderId || order?.id || null)
        setShowOrderSuccess(true)
        clearCart()
        setIsPlacingOrder(false)
        return
      }

      // Wallet flow: order placed with wallet payment (already processed in backend)
      if (selectedPaymentMethod === "wallet") {
        toast.success("Order placed with Wallet payment")
        setPlacedOrderId(order?.orderId || order?.id || null)
        setShowOrderSuccess(true)
        clearCart()
        setIsPlacingOrder(false)
        // Refresh wallet balance
        try {
          const walletResponse = await userAPI.getWallet()
          if (walletResponse?.data?.success && walletResponse?.data?.data?.wallet) {
            setWalletBalance(walletResponse.data.data.wallet.balance || 0)
          }
        } catch (error) {
          console.error("Error refreshing wallet balance:", error)
        }
        return
      }

      if (!razorpay || !razorpay.orderId || !razorpay.key) {
        console.error("❌ Razorpay initialization failed:", { razorpay, order })
        throw new Error(razorpay ? "Razorpay payment gateway is not configured. Please contact support." : "Failed to initialize payment")
      }

      console.log("💳 Razorpay order created:", {
        orderId: razorpay.orderId,
        amount: razorpay.amount,
        currency: razorpay.currency,
        keyPresent: !!razorpay.key
      })

      // Get user info for Razorpay prefill
      const userInfo = userProfile || {}
      const userPhone = userInfo.phone || defaultAddress?.phone || ""
      const userEmail = userInfo.email || ""
      const userName = userInfo.name || ""

      // Format phone number (remove non-digits, take last 10 digits)
      const formattedPhone = userPhone.replace(/\D/g, "").slice(-10)

      console.log("👤 User info for payment:", {
        name: userName,
        email: userEmail,
        phone: formattedPhone
      })

      // Get company name for Razorpay
      const companyName = await getCompanyNameAsync()

      // Initialize Razorpay payment
      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount, // Already in paise from backend
        currency: razorpay.currency || 'INR',
        order_id: razorpay.orderId,
        name: companyName,
        description: `Order ${order.orderId} - ₹${(razorpay.amount / 100).toFixed(2)}`,
        prefill: {
          name: userName,
          email: userEmail,
          contact: formattedPhone
        },
        notes: {
          orderId: order.orderId,
          userId: userInfo.id || "",
          restaurantId: restaurantId || "unknown"
        },
        handler: async (response) => {
          try {
            console.log("✅ Payment successful, verifying...", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id
            })

            // Verify payment with backend
            const verifyResponse = await orderAPI.verifyPayment({
              orderId: order.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })

            console.log("✅ Payment verification response:", verifyResponse.data)

            if (verifyResponse.data.success) {
              // Payment successful
              console.log("🎉 Order placed successfully:", {
                orderId: order.orderId,
                paymentId: verifyResponse.data.data?.payment?.paymentId
              })
              setPlacedOrderId(order.orderId)
              setShowOrderSuccess(true)
              clearCart()
              setIsPlacingOrder(false)
            } else {
              throw new Error(verifyResponse.data.message || "Payment verification failed")
            }
          } catch (error) {
            console.error("❌ Payment verification error:", error)
            const errorMessage = error?.response?.data?.message || error?.message || "Payment verification failed. Please contact support."
            alert(errorMessage)
            setIsPlacingOrder(false)
          }
        },
        onError: (error) => {
          console.error("❌ Razorpay payment error:", error)
          // Don't show alert for user cancellation
          if (error?.code !== 'PAYMENT_CANCELLED' && error?.message !== 'PAYMENT_CANCELLED') {
            const errorMessage = error?.description || error?.message || "Payment failed. Please try again."
            alert(errorMessage)
          }
          setIsPlacingOrder(false)
        },
        onClose: () => {
          console.log("⚠️ Payment modal closed by user")
          setIsPlacingOrder(false)
        }
      })
    } catch (error) {
      console.error("❌ Order creation error:", error)

      let errorMessage = "Failed to create order. Please try again."

      // Handle network errors
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        const backendUrl = API_BASE_URL.replace('/api', '');
        errorMessage = `Network Error: Cannot connect to backend server.\n\n` +
          `Expected backend URL: ${backendUrl}\n\n` +
          `Please check:\n` +
          `1. Backend server is running\n` +
          `2. Backend is accessible at ${backendUrl}\n` +
          `3. Check browser console (F12) for more details\n\n` +
          `If backend is not running, start it with:\n` +
          `cd appzetofood/backend && npm start`

        console.error("🔴 Network Error Details:", {
          code: error.code,
          message: error.message,
          config: {
            url: error.config?.url,
            baseURL: error.config?.baseURL,
            fullUrl: error.config?.baseURL + error.config?.url,
            method: error.config?.method
          },
          backendUrl: backendUrl,
          apiBaseUrl: API_BASE_URL
        })

        // Try to test backend connectivity
        try {
          fetch(backendUrl + '/health', { method: 'GET', signal: AbortSignal.timeout(5000) })
            .then(response => {
              if (response.ok) {
                console.log("✅ Backend health check passed - server is running")
              } else {
                console.warn("⚠️ Backend health check returned:", response.status)
              }
            })
            .catch(fetchError => {
              console.error("❌ Backend health check failed:", fetchError.message)
              console.error("💡 Make sure backend server is running at:", backendUrl)
            })
        } catch (fetchTestError) {
          console.error("❌ Could not test backend connectivity:", fetchTestError.message)
        }
      }
      // Handle timeout errors
      else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = "Request timed out. The server is taking too long to respond. Please try again."
      }
      // Handle other axios errors
      else if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`
      }
      // Handle other errors
      else if (error.message) {
        errorMessage = error.message
      }

      alert(errorMessage)
      setIsPlacingOrder(false)
    }
  }

  const handleGoToOrders = () => {
    setShowOrderSuccess(false)
    navigate(`/user/orders/${placedOrderId}?confirmed=true`)
  }

  // Empty cart state - but don't show if order success or placing order modal is active
  if (cart.length === 0 && !showOrderSuccess && !showPlacingOrder) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-10">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-gray-800 dark:text-white">Cart</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Utensils className="h-10 w-10 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Your cart is empty</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">Add items from a restaurant to start a new order</p>
          <Link to="/">
            <Button className="bg-primary-orange hover:opacity-90 text-white">Browse Restaurants</Button>
          </Link>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <div className="relative min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* Header - Sticky at top */}
      <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-20 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{restaurantName}</p>
                <p className="text-sm md:text-base font-medium text-gray-800 dark:text-white truncate">
                  {restaurantData?.estimatedDeliveryTime || "10-15 mins"} to <span className="font-semibold">Location</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-1 text-xs md:text-sm">{defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || defaultAddress?.city || "Select address") : "Select address"}</span>
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0"
              onClick={async () => {
                try {
                  const companyName = await getCompanyNameAsync()
                  const text = `${restaurantName} on ${companyName} – ${cart.length} item(s). Order from the app.`
                  const restaurantSlug =
                    restaurantData?.slug ||
                    restaurantData?.name?.toLowerCase().replace(/\s+/g, "-") ||
                    restaurantId
                  const url = restaurantSlug
                    ? `${window.location.origin}/user/restaurants/${restaurantSlug}`
                    : window.location.href
                  const result = await shareContent({ title: restaurantName, text, url })
                  if (result.method === "native") {
                    toast.success("Shared")
                  } else if (result.method === "whatsapp") {
                    toast.success("Opening share options")
                  } else if (result.method === "clipboard") {
                    toast.success("Share text copied")
                  }
                } catch (e) {
                  if (e?.name !== "AbortError") toast.error("Share failed")
                }
              }}
            >
              <Share2 className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-32">
        {/* Savings Banner */}
        {savings > 0 && (
          <div className="bg-blue-100 dark:bg-blue-900/20 px-4 md:px-6 py-2 md:py-3 flex-shrink-0">
            <div className="max-w-7xl mx-auto">
              <p className="text-sm md:text-base font-medium text-blue-800 dark:text-blue-200">
                🎉 You saved ₹{savings} on this order
              </p>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 px-4 md:px-6 py-4 md:py-6">
            {/* Left Column - Cart Items and Details */}
            <div className="lg:col-span-2 space-y-2 md:space-y-4">
              {/* Cart Items */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <div className="space-y-3 md:space-y-4">
                  {cart.map((item) => {
                    const lineKey = item.selectedVariation?.variationId ? `${item.id}_${item.selectedVariation.variationId}` : item.id
                    const isVegItem = isCartItemVeg(item)
                    return (
                      <div key={lineKey} className="flex items-start gap-3 md:gap-4">
                        {/* Veg/Non-veg indicator (Veg = green, Non-Veg = red) */}
                        <div
                          className={`w-4 h-4 md:w-5 md:h-5 border-2 ${
                            isVegItem ? "border-green-600" : "border-red-600"
                          } flex items-center justify-center mt-1 flex-shrink-0`}
                        >
                          <div
                            className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${
                              isVegItem ? "bg-green-600" : "bg-red-600"
                            }`}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200 leading-tight">{item.name}</p>
                          {item.selectedVariation?.variationName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.selectedVariation.variationName}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const slug = restaurantData?.slug || restaurantData?.name?.toLowerCase().replace(/\s+/g, "-") || restaurantId
                              if (slug) navigate(`/user/restaurants/${slug}`)
                              else toast.error("Restaurant not found")
                            }}
                            className="text-xs md:text-sm text-blue-600 dark:text-blue-400 font-medium flex items-center gap-0.5 mt-0.5 hover:underline"
                          >
                            Edit <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3 md:gap-4">
                          {/* Quantity controls */}
                          <div className="flex items-center border border-red-600 dark:border-red-500 rounded">
                            <button
                              className="px-2 md:px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => updateQuantity(item.id, item.quantity - 1, null, null, item.selectedVariation?.variationId)}
                            >
                              <Minus className="h-3 w-3 md:h-4 md:w-4" />
                            </button>
                            <span className="px-2 md:px-3 text-sm md:text-base font-semibold text-red-600 dark:text-red-400 min-w-[20px] md:min-w-[24px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              className="px-2 md:px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => updateQuantity(item.id, item.quantity + 1, null, null, item.selectedVariation?.variationId)}
                            >
                              <Plus className="h-3 w-3 md:h-4 md:w-4" />
                            </button>
                          </div>

                          <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200 min-w-[50px] md:min-w-[70px] text-right">
                            ₹{((item.price || 0) * (item.quantity || 1)).toFixed(0)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Add more items */}
                <button
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2 mt-4 md:mt-6 text-red-600 dark:text-red-400"
                >
                  <Plus className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="text-sm md:text-base font-medium">Add more items</span>
                </button>
              </div>


              {/* Note & Cutlery */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl flex flex-col sm:flex-row gap-2 md:gap-3">
                <button
                  onClick={() => setShowNoteInput(!showNoteInput)}
                  className="flex-1 flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl text-sm md:text-base text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <FileText className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="truncate">{note || "Add a note for the restaurant"}</span>
                </button>
                <button
                  onClick={() => setSendCutlery(!sendCutlery)}
                  className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border rounded-lg md:rounded-xl text-sm md:text-base ${sendCutlery ? 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300' : 'border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'}`}
                >
                  <Utensils className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="whitespace-nowrap">{sendCutlery ? "Don't send cutlery" : "No cutlery"}</span>
                </button>
              </div>

              {/* Note Input */}
              {showNoteInput && (
                <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add cooking instructions, allergies, etc."
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl p-3 md:p-4 text-sm md:text-base resize-none h-20 md:h-24 focus:outline-none focus:border-red-600 dark:focus:border-red-500 bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              {/* Complete your meal section - Approved Addons */}
              {addons.length > 0 && (
                <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                  <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                      <span className="text-xs md:text-base">🍽️</span>
                    </div>
                    <span className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">Complete your meal with</span>
                  </div>
                  {loadingAddons ? (
                    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex-shrink-0 w-28 md:w-36 animate-pulse">
                          <div className="w-full h-28 md:h-36 bg-gray-200 dark:bg-gray-700 rounded-lg md:rounded-xl" />
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mt-1 w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {addons.map((addon) => {
                        const addonIsVeg = isAddonVeg(addon)
                        return (
                        <div key={addon.id} className="flex-shrink-0 w-28 md:w-36">
                          <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg md:rounded-xl overflow-hidden">
                            <img
                              src={addon.image || (addon.images && addon.images[0]) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"}
                              alt={addon.name}
                              className="w-full h-28 md:h-36 object-cover rounded-lg md:rounded-xl"
                              onError={(e) => {
                                e.target.onerror = null
                                e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"
                              }}
                            />
                            <div className="absolute top-1 md:top-2 left-1 md:left-2">
                              <div className={`w-3.5 h-3.5 md:w-4 md:h-4 bg-white border flex items-center justify-center rounded ${
                                addonIsVeg ? "border-green-600" : "border-red-600"
                              }`}>
                                <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${
                                  addonIsVeg ? "bg-green-600" : "bg-red-600"
                                }`} />
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                // Use restaurant info from existing cart items to ensure format consistency
                                const cartRestaurantId = cart[0]?.restaurantId || restaurantId;
                                const cartRestaurantName = cart[0]?.restaurant || restaurantName;

                                if (!cartRestaurantId || !cartRestaurantName) {
                                  console.error('❌ Cannot add addon: Missing restaurant information', {
                                    cartRestaurantId,
                                    cartRestaurantName,
                                    restaurantId,
                                    restaurantName,
                                    cartItem: cart[0]
                                  });
                                  toast.error('Restaurant information is missing. Please refresh the page.');
                                  return;
                                }

                                addToCart({
                                  id: addon.id,
                                  name: addon.name,
                                  price: addon.price,
                                  image: addon.image || (addon.images && addon.images[0]) || "",
                                  description: addon.description || "",
                                  isVeg: addonIsVeg,
                                  foodType: addon?.foodType || (addonIsVeg ? "Veg" : "Non-Veg"),
                                  restaurant: cartRestaurantName,
                                  restaurantId: cartRestaurantId
                                });
                              }}
                              className="absolute bottom-1 md:bottom-2 right-1 md:right-2 w-6 h-6 md:w-7 md:h-7 bg-white border border-red-600 rounded flex items-center justify-center shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-600" />
                            </button>
                          </div>
                          <p className="text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200 mt-1.5 md:mt-2 line-clamp-2 leading-tight">{addon.name}</p>
                          {addon.description && (
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{addon.description}</p>
                          )}
                          <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 font-semibold mt-0.5">₹{addon.price}</p>
                        </div>
                      )})}
                    </div>
                  )}
                </div>
              )}

              {/* Coupon Section */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg md:rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <Tag className="h-4 w-4 md:h-5 md:w-5 text-red-600 dark:text-red-400" />
                      <div>
                        <p className="text-sm md:text-base font-medium text-red-700 dark:text-red-300">'{appliedCoupon.code}' applied</p>
                        <p className="text-xs md:text-sm text-red-600 dark:text-red-400">You saved ₹{discount}</p>
                      </div>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">Remove</button>
                  </div>
                ) : loadingCoupons ? (
                  <div className="flex items-center gap-2 md:gap-3">
                    <Percent className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Loading coupons...</p>
                  </div>
                ) : availableCoupons.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 md:gap-3">
                        <Percent className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-400" />
                        <div>
                          <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">
                            Save ₹{availableCoupons[0].discount} with '{availableCoupons[0].code}'
                          </p>
                          {availableCoupons.length > 1 && (
                            <button onClick={() => setShowCoupons(!showCoupons)} className="text-xs md:text-sm text-blue-600 dark:text-blue-400 font-medium">
                              View all coupons →
                            </button>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 md:h-8 text-xs md:text-sm border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => handleApplyCoupon(availableCoupons[0])}
                        disabled={subtotal < availableCoupons[0].minOrder}
                      >
                        {subtotal < availableCoupons[0].minOrder ? `Min ₹${availableCoupons[0].minOrder}` : 'APPLY'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 md:gap-3">
                    <Percent className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">No coupons available</p>
                  </div>
                )}

                {/* Coupons List */}
                {showCoupons && !appliedCoupon && availableCoupons.length > 0 && (
                  <div className="mt-3 md:mt-4 space-y-2 md:space-y-3 border-t dark:border-gray-700 pt-3 md:pt-4">
                    {availableCoupons.map((coupon) => (
                      <div key={coupon.code} className="flex items-center justify-between py-2 md:py-3 border-b border-dashed dark:border-gray-700 last:border-0">
                        <div>
                          <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">{coupon.code}</p>
                          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{coupon.description}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 md:h-7 text-xs md:text-sm border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleApplyCoupon(coupon)}
                          disabled={subtotal < coupon.minOrder}
                        >
                          {subtotal < coupon.minOrder ? `Min ₹${coupon.minOrder}` : 'APPLY'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery Time */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <div className="flex items-center gap-3 md:gap-4">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm md:text-base text-gray-800 dark:text-gray-200">Delivery in <span className="font-semibold">{restaurantData?.estimatedDeliveryTime || "10-15 mins"}</span></p>
                  </div>
                </div>
              </div>

              {/* Delivery Address - tap to open address picker */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <button
                  type="button"
                  onClick={() => setShowAddressPicker(true)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                    <MapPin className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm md:text-base text-gray-800 dark:text-gray-200">
                        Delivery at <span className="font-semibold">Location</span>
                        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(tap to update)</span>
                      </p>
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Add delivery address") : "Add delivery address"}
                      </p>
                      {/* Address type selector: Home, Office, Other */}
                      <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        {["Home", "Office", "Other"].map((label) => {
                          const isActive = selectedAddressType === label
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleAddressTypeChange(label)
                              }}
                              className={`text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 rounded-md border transition-colors ${
                                isActive
                                  ? 'border-red-600 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 bg-white dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-400 flex-shrink-0" />
                </button>
              </div>

              {/* Address picker modal - open when user taps "Delivery at Location" */}
              <AnimatePresence>
                {showAddressPicker && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/50 z-[100]"
                      onClick={() => setShowAddressPicker(false)}
                    />
                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 30, stiffness: 300 }}
                      className="fixed inset-x-0 bottom-0 z-[101] bg-white dark:bg-[#1a1a1a] rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col"
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Change delivery address</h3>
                        <button
                          type="button"
                          onClick={() => setShowAddressPicker(false)}
                          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                          aria-label="Close"
                        >
                          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </button>
                      </div>
                      <div className="overflow-y-auto flex-1 p-4 space-y-2">
                        {addresses.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No saved addresses. Add one to continue.</p>
                        ) : (
                          addresses.map((addr) => {
                            const line = [addr.street, addr.additionalDetails, addr.city, addr.state, addr.zipCode].filter(Boolean).join(", ")
                            return (
                              <button
                                key={addr.id || addr.label}
                                type="button"
                                onClick={() => {
                                  handleSelectAddressByLabel(addr.label)
                                  setShowAddressPicker(false)
                                }}
                                className="w-full flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left transition-colors"
                              >
                                <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 dark:text-white">{addr.label}</p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{line || "—"}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                              </button>
                            )
                          })
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setShowAddressPicker(false)
                            try {
                              localStorage.setItem("locationReturnPath", "/user/cart")
                            } catch {
                              // ignore storage errors
                            }
                            // Defer so address picker can close before opening location selector (avoids stacking/focus issues)
                            setTimeout(() => {
                              openLocationSelector()
                            }, 0)
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-left"
                        >
                          <Plus className="h-5 w-5" />
                          <span className="text-sm font-medium">Add new address</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Contact */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                {!isEditingContact ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingContact(true)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3 md:gap-4">
                      <Phone className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                      <p className="text-sm md:text-base text-gray-800 dark:text-gray-200">
                        {contactName || userProfile?.name || "Your Name"},{" "}
                        <span className="font-medium">
                          {contactPhoneInput || userProfile?.phone || "+91-XXXXXXXXXX"}
                        </span>
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                  </button>
                ) : (
                  <form
                    className="flex flex-col gap-3 md:gap-4"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const nameTrimmed = (contactName || "").trim()
                      const trimmed = (contactPhoneInput || "").replace(/\D/g, "")
                      if (!nameTrimmed) {
                        toast.error("Please enter a contact name.")
                        return
                      }
                      if (!trimmed || trimmed.length < 6) {
                        toast.error("Please enter a valid phone number.")
                        return
                      }
                      const maxLen = 10
                      const normalized = trimmed.slice(0, maxLen)

                      // Locally update contact info just for this order view
                      setContactName(nameTrimmed)
                      setContactPhoneInput(normalized)
                      setIsEditingContact(false)
                      toast.success("Contact details updated for this order.")
                    }}
                  >
                    <div className="flex items-center gap-3 md:gap-4">
                      <Phone className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">
                          Update contact name and number for this order
                        </p>
                        <input
                          type="text"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          className="mb-2 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f0f0f] px-3 py-2 text-sm md:text-base text-gray-900 dark:text-gray-100 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          placeholder="Contact name"
                        />
                        <input
                          type="tel"
                          value={contactPhoneInput}
                          onChange={(e) =>
                            setContactPhoneInput(
                              e.target.value.replace(/\D/g, "").slice(0, 10),
                            )
                          }
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f0f0f] px-3 py-2 text-sm md:text-base text-gray-900 dark:text-gray-100 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          placeholder="+91XXXXXXXXXX"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingContact(false)
                          setContactName(userProfile?.name || "")
                          setContactPhoneInput(userProfile?.phone || "")
                        }}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs md:text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs md:text-sm font-semibold text-white hover:bg-red-700"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Bill Details - hidden on desktop when right-column Order Summary is shown */}
              <div ref={billDetailsRef} className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl lg:hidden">
                <button
                  onClick={() => setShowBillDetails(!showBillDetails)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <FileText className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                    <div className="text-left">
                      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                        <span className="text-sm md:text-base text-gray-800 dark:text-gray-200">Total Bill</span>
                        <span className="text-sm md:text-base text-gray-400 dark:text-gray-500 line-through">₹{totalBeforeDiscount.toFixed(0)}</span>
                        <span className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">₹{total.toFixed(0)}</span>
                        {savings > 0 && (
                          <span className="text-xs md:text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-1.5 md:px-2 py-0.5 rounded font-medium">You saved ₹{savings}</span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Incl. taxes</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                </button>

                {showBillDetails && (
                  <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-dashed dark:border-gray-700 space-y-2 md:space-y-3">
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Item Total</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Delivery charges</span>
                      <span className={deliveryFee === 0 ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}>
                        {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{platformFee}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">GST</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{gstCharges}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm md:text-base text-red-600 dark:text-red-400">
                        <span>Coupon Discount</span>
                        <span>-₹{discount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm md:text-base font-semibold pt-2 md:pt-3 border-t dark:border-gray-700">
                      <span>To Pay</span>
                      <span>₹{total.toFixed(0)}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column - Order Summary (Desktop only; on mobile we show Bill Details in left column) */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="lg:sticky lg:top-24 space-y-4 md:space-y-6">
                {/* Bill Summary Card */}
                <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-4 md:py-5 rounded-lg md:rounded-xl border border-gray-200 dark:border-gray-700">
                  <h3 className="text-base md:text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 md:mb-4">Order Summary</h3>
                  <div className="space-y-2 md:space-y-3">
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Item Total</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Delivery charges</span>
                      <span className={deliveryFee === 0 ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}>
                        {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{platformFee}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">GST</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{gstCharges}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm md:text-base text-red-600 dark:text-red-400">
                        <span>Discount</span>
                        <span>-₹{discount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base md:text-lg font-bold pt-3 md:pt-4 border-t dark:border-gray-700">
                      <span>Total</span>
                      <span className="text-red-600 dark:text-red-400">₹{total.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacing between bill content and sticky footer */}
      <div className="h-4 md:h-6 flex-shrink-0" aria-hidden />

      {/* Bottom Sticky - Place Order */}
      <div className="bg-white dark:bg-[#1a1a1a] border-t dark:border-gray-800 shadow-lg z-30 flex-shrink-0 fixed bottom-0 left-0 right-0">
        <div className="max-w-7xl mx-auto">
          <div className="px-4 md:px-6 py-3 md:py-4">
            <div className="w-full max-w-md md:max-w-lg mx-auto">
              {/* Pay Using */}
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  <div className="leading-tight">
                    <p className="text-[11px] md:text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      PAY USING
                    </p>
                    <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">
                      {selectedPaymentMethod === "razorpay"
                        ? "Razorpay"
                        : selectedPaymentMethod === "wallet"
                          ? "Wallet"
                          : "Cash on Delivery"}
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="appearance-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 pr-9 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  >
                    <option value="razorpay">Razorpay</option>
                    <option value="wallet">Wallet {walletBalance > 0 ? `(₹${walletBalance.toFixed(0)})` : ''}</option>
                    <option value="cash">COD</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                </div>
              </div>

              <Button
                size="lg"
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || (selectedPaymentMethod === "wallet" && walletBalance < total)}
                className="w-full bg-[#671E1F] hover:bg-[#238654] dark:bg-[#671E1F] dark:hover:bg-[#238654] text-white px-6 md:px-10 h-14 md:h-16 rounded-lg md:rounded-xl text-base md:text-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(selectedPaymentMethod === "razorpay" || selectedPaymentMethod === "wallet") && (
                  <div className="text-left mr-3 md:mr-4">
                    <p className="text-sm md:text-base opacity-90">₹{total.toFixed(0)}</p>
                    <p className="text-xs md:text-sm opacity-75">TOTAL</p>
                  </div>
                )}
                <span className="font-bold text-base md:text-lg">
                  {isPlacingOrder
                    ? "Processing..."
                    : selectedPaymentMethod === "razorpay"
                      ? "Select Payment"
                      : selectedPaymentMethod === "wallet"
                        ? walletBalance >= total
                          ? "Place Order"
                          : "Insufficient Balance"
                        : "Place Order"}
                </span>
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Placing Order Modal */}
      {showPlacingOrder && (
        <div className="fixed inset-0 z-[60] h-screen w-screen overflow-hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ animation: 'slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="px-6 py-8">
              {/* Title */}
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Placing your order</h2>

              {/* Payment Info */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-white shadow-sm">
                  <CreditCard className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedPaymentMethod === "razorpay"
                      ? `Pay ₹${total.toFixed(2)} online (Razorpay)`
                      : selectedPaymentMethod === "wallet"
                        ? `Pay ₹${total.toFixed(2)} from Wallet`
                        : `Pay on delivery (COD)`}
                  </p>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50">
                  <svg className="w-7 h-7 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path d="M9 22V12h6v10" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">Delivering to Location</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Address") : "Add address"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {defaultAddress ? (formatFullAddress(defaultAddress) || "Address") : "Address"}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative mb-6">
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-100 ease-linear"
                    style={{
                      width: `${orderProgress}%`,
                      boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)'
                    }}
                  />
                </div>
                {/* Animated shimmer effect */}
                <div
                  className="absolute inset-0 h-2.5 rounded-full overflow-hidden pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                    animation: 'shimmer 1.5s infinite',
                    width: `${orderProgress}%`
                  }}
                />
              </div>

              {/* Cancel Button */}
              <button
                onClick={() => {
                  setShowPlacingOrder(false)
                  setIsPlacingOrder(false)
                }}
                className="w-full text-right"
              >
                <span className="text-red-600 font-semibold text-base hover:text-red-700 transition-colors">
                  CANCEL
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Success Celebration Page */}
      {showOrderSuccess && (
        <div
          className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center h-screen w-screen overflow-hidden"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          {/* Confetti Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Animated confetti pieces */}
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  backgroundColor: ['#671E1F', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
                  animation: `confettiFall ${2 + Math.random() * 2}s linear ${Math.random() * 2}s infinite`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>

          {/* Success Content */}
          <div className="relative z-10 flex flex-col items-center px-6">
            {/* Success Tick Circle */}
            <div
              className="relative mb-8"
              style={{ animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both' }}
            >
              {/* Outer ring animation */}
              <div
                className="absolute inset-0 w-32 h-32 rounded-full border-4 border-red-500"
                style={{
                  animation: 'ringPulse 1.5s ease-out infinite',
                  opacity: 0.3
                }}
              />
              {/* Main circle */}
              <div className="w-32 h-32 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-2xl">
                <svg
                  className="w-16 h-16 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: 'checkDraw 0.5s ease-out 0.5s both' }}
                >
                  <path d="M5 12l5 5L19 7" className="check-path" />
                </svg>
              </div>
              {/* Sparkles */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    top: '50%',
                    left: '50%',
                    animation: `sparkle 0.6s ease-out ${0.3 + i * 0.1}s both`,
                    transform: `rotate(${i * 60}deg) translateY(-80px)`,
                  }}
                />
              ))}
            </div>

            {/* Location Info */}
            <div
              className="text-center"
              style={{ animation: 'slideUp 0.5s ease-out 0.6s both' }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-5 h-5 text-red-500">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {defaultAddress?.city || "Your Location"}
                </h2>
              </div>
              <p className="text-gray-500 text-base">
                {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Delivery Address") : "Delivery Address"}
              </p>
            </div>

            {/* Order Placed Message */}
            <div
              className="mt-12 text-center"
              style={{ animation: 'slideUp 0.5s ease-out 0.8s both' }}
            >
              <h3 className="text-3xl font-bold text-red-600 mb-2">Order Placed!</h3>
              <p className="text-gray-600">Your delicious food is on its way</p>
            </div>

            {/* Action Button */}
            <button
              onClick={handleGoToOrders}
              className="mt-10 bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-12 rounded-xl shadow-lg transition-all hover:shadow-xl hover:scale-105"
              style={{ animation: 'slideUp 0.5s ease-out 1s both' }}
            >
              Track Your Order
            </button>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeInBackdrop {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUpBannerSmooth {
          from {
            transform: translateY(100%) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes slideUpBanner {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes shimmerBanner {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes scaleInBounce {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes pulseRing {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.4);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        @keyframes checkMarkDraw {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }
        @keyframes slideUpFull {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes slideUpModal {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes checkDraw {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
          }
        }
        @keyframes ringPulse {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.3);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        @keyframes sparkle {
          0% {
            transform: rotate(var(--rotation, 0deg)) translateY(0) scale(0);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--rotation, 0deg)) translateY(-80px) scale(1);
            opacity: 0;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes confettiFall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-slideUpFull {
          animation: slideUpFull 0.3s ease-out;
        }
        .check-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 0;
        }
      `}</style>
    </div>
  )
}
