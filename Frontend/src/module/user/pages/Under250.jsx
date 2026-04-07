import { Link, useNavigate } from "react-router-dom"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Star, Clock, MapPin, ArrowDownUp, Timer, ArrowRight, ChevronDown, Bookmark, Share2, Plus, Minus, X, UtensilsCrossed } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import AnimatedPage from "../components/AnimatedPage"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLocationSelector } from "../components/UserLayout"
import { useLocation } from "../hooks/useLocation"
import { useZone } from "../hooks/useZone"
import { useCart } from "../context/CartContext"
import PageNavbar from "../components/PageNavbar"
import { foodImages } from "@/constants/images"
import offerImage from "@/assets/offerimage.png"
import AddToCartAnimation from "../components/AddToCartAnimation"
import OptimizedImage from "@/components/OptimizedImage"
import api from "@/lib/api"
import { restaurantAPI } from "@/lib/api"
import { isModuleAuthenticated } from "@/lib/utils/auth"
import { useProfile } from "../context/ProfileContext"
import { filterCategoriesByVegMode } from "@/lib/utils/categoryDietary"
import { shareContent } from "@/lib/utils/share"

export default function Under250() {
  const { vegMode } = useProfile()
  const { location } = useLocation()
  const { zoneId, zoneStatus, isInService, isOutOfService } = useZone(location)
  const navigate = useNavigate()
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart, openVariantPicker } = useCart()
  const [activeCategory, setActiveCategory] = useState(null)
  const [showSortPopup, setShowSortPopup] = useState(false)
  const [selectedSort, setSelectedSort] = useState(null)
  const [under30MinsFilter, setUnder30MinsFilter] = useState(false)
  const [showItemDetail, setShowItemDetail] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [quantities, setQuantities] = useState({})
  const [bookmarkedItems, setBookmarkedItems] = useState(new Set())
  const [viewCartButtonBottom, setViewCartButtonBottom] = useState("bottom-20")
  const lastScrollY = useRef(0)
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [bannerImage, setBannerImage] = useState(null)
  const [loadingBanner, setLoadingBanner] = useState(true)
  const [under250Restaurants, setUnder250Restaurants] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [showAllCategoriesModal, setShowAllCategoriesModal] = useState(false)

  const sortOptions = [
    { id: null, label: 'Relevance' },
    { id: 'rating-high', label: 'Rating: Low to High' },
    { id: 'delivery-time-low', label: 'Delivery Time: Low to High' },
    { id: 'distance-low', label: 'Distance: Low to High' },
  ]

  const handleClearAll = () => {
    setSelectedSort(null)
  }

  const handleApply = () => {
    setShowSortPopup(false)
  }

  // Helper function to parse delivery time (e.g., "12-15 mins" -> 12 or average)
  const parseDeliveryTime = (deliveryTime) => {
    if (!deliveryTime) return 999 // Default high value for sorting
    const match = deliveryTime.match(/(\d+)/)
    if (match) {
      return parseInt(match[1])
    }
    // Try to find range (e.g., "12-15 mins")
    const rangeMatch = deliveryTime.match(/(\d+)\s*-\s*(\d+)/)
    if (rangeMatch) {
      return (parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2 // Average
    }
    return 999
  }

  // Helper function to parse distance (e.g., "0.4 km" -> 0.4)
  const parseDistance = (distance) => {
    if (!distance) return 999 // Default high value for sorting
    const match = distance.match(/(\d+\.?\d*)/)
    if (match) {
      return parseFloat(match[1])
    }
    return 999
  }

  // Flatten all dishes and apply sorting/filters at dish level
  const sortedAndFilteredDishes = useMemo(() => {
    const allDishes = []

    under250Restaurants.forEach((restaurant) => {
      const restaurantName = restaurant.name
      const restaurantSlug = restaurant.slug || restaurant.name?.toLowerCase().replace(/\s+/g, "-")
      const restaurantId = restaurant.restaurantId || restaurant.id
      const deliveryTime = restaurant.deliveryTime
      const distance = restaurant.distance
      const rating = restaurant.rating || 0

      ;(restaurant.menuItems || []).forEach((item) => {
        allDishes.push({
          ...item,
          restaurantName,
          restaurantSlug,
          restaurantId,
          deliveryTime,
          distance,
          rating,
        })
      })
    })

    let filtered = [...allDishes]

    // Apply "Under 30 mins" filter based on restaurant delivery time
    if (under30MinsFilter) {
      filtered = filtered.filter((dish) => {
        const time = parseDeliveryTime(dish.deliveryTime)
        return time <= 30
      })
    }

    // Apply sorting at dish level
    if (selectedSort === "rating-high") {
      // Despite the id name, this option now means Rating: Low to High
      filtered.sort((a, b) => {
        const ratingA = a.rating || 0
        const ratingB = b.rating || 0
        if (ratingA !== ratingB) return ratingA - ratingB
        // Secondary sort by price (cheaper first)
        return (a.price || 0) - (b.price || 0)
      })
    } else if (selectedSort === "delivery-time-low") {
      filtered.sort((a, b) => {
        const timeA = parseDeliveryTime(a.deliveryTime)
        const timeB = parseDeliveryTime(b.deliveryTime)
        if (timeA !== timeB) return timeA - timeB
        // Secondary sort by rating
        return (b.rating || 0) - (a.rating || 0)
      })
    } else if (selectedSort === "distance-low") {
      filtered.sort((a, b) => {
        const distA = parseDistance(a.distance)
        const distB = parseDistance(b.distance)
        if (distA !== distB) return distA - distB
        // Secondary sort by rating
        return (b.rating || 0) - (a.rating || 0)
      })
    }

    return filtered
  }, [under250Restaurants, selectedSort, under30MinsFilter])

  // Fetch under 250 banners from API
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoadingBanner(true)
        const response = await api.get('/hero-banners/under-250/public')
        if (response.data.success && response.data.data.banners && response.data.data.banners.length > 0) {
          // Use the first banner
          setBannerImage(response.data.data.banners[0])
        } else {
          setBannerImage(null)
        }
      } catch (error) {
        console.error('Error fetching under 250 banners:', error)
        setBannerImage(null)
      } finally {
        setLoadingBanner(false)
      }
    }

    fetchBanners()
  }, [])

  // Fetch restaurants with dishes under ₹250 from backend
  useEffect(() => {
    const fetchRestaurantsUnder250 = async () => {
      try {
        setLoadingRestaurants(true)
        setUnder250Restaurants([])
        const params = {}
        if (location?.latitude != null && location?.longitude != null) {
          params.latitude = location.latitude
          params.longitude = location.longitude
        }
        if (zoneId) {
          params.zoneId = zoneId
        }
        const response = await restaurantAPI.getRestaurantsUnder250(params)
        if (response.data.success && response.data.data.restaurants) {
          setUnder250Restaurants(response.data.data.restaurants)
        } else {
          setUnder250Restaurants([])
        }
      } catch (error) {
        console.error('Error fetching restaurants under 250:', error)
        setUnder250Restaurants([])
      } finally {
        setLoadingRestaurants(false)
      }
    }

    fetchRestaurantsUnder250()
  }, [zoneId, isOutOfService, location?.latitude, location?.longitude])

  // Fetch categories from admin API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true)
        const response = await api.get('/categories/public')
        if (response.data.success && response.data.data.categories) {
          const adminCategories = filterCategoriesByVegMode(response.data.data.categories, vegMode).map(cat => ({
            id: cat.id,
            name: cat.name,
            image: cat.image || foodImages[0], // Fallback to default image if not provided
            slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
            foodPreference: cat.foodPreference || "all",
          }))
          setCategories(adminCategories)
        } else {
          // Fallback to default categories if API fails
          const defaultCategories = [
            { id: 1, name: "Biryani", image: foodImages[0] },
            { id: 2, name: "Cake", image: foodImages[1] },
            { id: 3, name: "Chhole Bhature", image: foodImages[2] },
            { id: 4, name: "Chicken Tanduri", image: foodImages[3] },
          ]
          setCategories(defaultCategories)
        }
      } catch (error) {
        console.error('Error fetching categories:', error)
        // Fallback to default categories on error
        const defaultCategories = [
          { id: 1, name: "Biryani", image: foodImages[0] },
          { id: 2, name: "Cake", image: foodImages[1] },
          { id: 3, name: "Chhole Bhature", image: foodImages[2] },
        ]
        setCategories(defaultCategories)
      } finally {
        setLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [vegMode])

  // Sync quantities from cart (sum by base item id so variants of same dish show total)
  useEffect(() => {
    const cartQuantities = {}
    cart.forEach((item) => {
      cartQuantities[item.id] = (cartQuantities[item.id] || 0) + (item.quantity || 0)
    })
    setQuantities(cartQuantities)
  }, [cart])

  // Scroll detection for view cart button positioning
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollDifference = Math.abs(currentScrollY - lastScrollY.current)

      // Only update if scroll difference is significant (avoid flickering)
      if (scrollDifference < 5) {
        return
      }

      // Scroll down -> bottom-0, Scroll up -> bottom-20
      if (currentScrollY > lastScrollY.current) {
        // Scrolling down
        setViewCartButtonBottom("bottom-0")
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up
        setViewCartButtonBottom("bottom-20")
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Helper function to update item quantity in bothlocal state and cart
  const updateItemQuantity = (item, newQuantity, event = null, restaurantName = null) => {
    // Check authentication
    if (!isModuleAuthenticated('user')) {
      toast.error("Please login to add items to cart")
      navigate('/user/auth/sign-in', { state: { from: location.pathname } })
      return
    }

    // CRITICAL: Check if user is in service zone
    if (isOutOfService) {
      toast.error('You are outside the service zone. Please select a location within the service area.')
      return
    }

    // If item has variations and we're adding, show variant picker (same on every page)
    const restaurantForPicker = { name: restaurantName || item.restaurant || item.restaurantName || "Under 250", restaurantId: item.restaurantId }
    if (item.variations?.length && newQuantity > (quantities[item.id] || 0)) {
      openVariantPicker(item, restaurantForPicker)
      return
    }

    // Update local state
    setQuantities((prev) => ({
      ...prev,
      [item.id]: newQuantity,
    }))

    // Find restaurant name from the item or use provided parameter
    const restaurant = restaurantName || item.restaurant || "Under 250"

    // Prepare cart item with all required properties
    const cartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      restaurant: restaurant,
      restaurantId: item.restaurantId,
      description: item.description || "",
      originalPrice: item.originalPrice || item.price,
      foodType: item.foodType || null,
      isVeg: item.foodType === "Veg" ? true : item.foodType === "Non-Veg" ? false : item.isVeg,
    }

    // Get source position for animation from event target
    let sourcePosition = null
    if (event) {
      let buttonElement = event.currentTarget
      if (!buttonElement && event.target) {
        buttonElement = event.target.closest('button') || event.target
      }

      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect()
        const scrollX = window.pageXOffset || window.scrollX || 0
        const scrollY = window.pageYOffset || window.scrollY || 0

        sourcePosition = {
          viewportX: rect.left + rect.width / 2,
          viewportY: rect.top + rect.height / 2,
          scrollX: scrollX,
          scrollY: scrollY,
          itemId: item.id,
        }
      }
    }

    // Update cart context
    if (newQuantity <= 0) {
      const productInfo = {
        id: item.id,
        name: item.name,
        imageUrl: item.image,
      }
      removeFromCart(item.id, sourcePosition, productInfo)
    } else {
      const existingCartItem = getCartItem(item.id)
      if (existingCartItem) {
        const productInfo = {
          id: item.id,
          name: item.name,
          imageUrl: item.image,
        }

        if (newQuantity > existingCartItem.quantity && sourcePosition) {
          addToCart(cartItem, sourcePosition)
          if (newQuantity > existingCartItem.quantity + 1) {
            updateQuantity(item.id, newQuantity)
          }
        } else if (newQuantity < existingCartItem.quantity && sourcePosition) {
          updateQuantity(item.id, newQuantity, sourcePosition, productInfo)
        } else {
          updateQuantity(item.id, newQuantity)
        }
      } else {
        addToCart(cartItem, sourcePosition)
        if (newQuantity > 1) {
          updateQuantity(item.id, newQuantity)
        }
      }
    }
  }

  const handleItemClick = (item, restaurant) => {
    // Add restaurant info to item for display
    const itemWithRestaurant = {
      ...item,
      restaurant: restaurant.name,
      description: item.description || `${item.name} from ${restaurant.name}`,
      customisable: item.customisable || false,
      notEligibleForCoupons: item.notEligibleForCoupons || false,
    }
    setSelectedItem(itemWithRestaurant)
    setShowItemDetail(true)
  }

  const handleBookmarkClick = (itemId) => {
    setBookmarkedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const handleShareItem = async (item, event) => {
    event?.stopPropagation?.()

    const restaurantSlug =
      item.restaurantSlug ||
      item.restaurantName?.toLowerCase().replace(/\s+/g, "-") ||
      item.restaurant?.toLowerCase().replace(/\s+/g, "-")
    const restaurantUrl = restaurantSlug
      ? `${window.location.origin}/user/restaurants/${restaurantSlug}`
      : window.location.href

    try {
      const result = await shareContent({
        title: item.name || "Under 250 item",
        text: `${item.name || "Item"} from ${item.restaurantName || item.restaurant || "Under 250"}${item.price ? ` for Rs. ${Math.round(item.price)}` : ""}`,
        url: restaurantUrl,
      })

      if (result.method === "clipboard") {
        toast.success("Share link copied")
      } else if (result.method === "whatsapp") {
        toast.success("Opening share")
      } else if (result.method !== "cancelled") {
        toast.success("Shared successfully")
      }
    } catch (error) {
      console.error("Failed to share under 250 item:", error)
      toast.error("Failed to share")
    }
  }

  // Check if should show grayscale (only when user is out of service)
  const shouldShowGrayscale = isOutOfService

  return (

    <div className={`relative min-h-screen bg-white dark:bg-[#0a0a0a] ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
      {/* Banner Section with Navbar */}
      <div className="relative w-full overflow-hidden min-h-[39vh] lg:min-h-[50vh] md:pt-16">
        {/* Banner Image */}
        {bannerImage && (
          <div className="absolute top-0 left-0 right-0 bottom-0 z-0">
            <OptimizedImage
              src={bannerImage}
              alt="Under 250 Banner"
              className="w-full h-full"
              objectFit="cover"
              priority={true}
              sizes="100vw"
            />
          </div>
        )}
        {!bannerImage && !loadingBanner && (
          <div className="absolute top-0 left-0 right-0 bottom-0 z-0 bg-gradient-to-br from-red-100 to-blue-100 dark:from-red-900 dark:to-blue-900" />
        )}

        {/* Navbar (without profile avatar on this page) */}
        <div className="relative z-20 pt-2 sm:pt-3 lg:pt-4">
          <PageNavbar textColor="white" zIndex={20} showProfile={false} />
        </div>
      </div>

      {/* Content Section */}
      <div className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 space-y-0 pt-2 sm:pt-3 md:pt-4 lg:pt-6 pb-24 md:pb-28 lg:pb-32">

        {/* Sticky Header: Categories and Filters */}
        <div className="sticky top-0 md:top-16 z-30 bg-white dark:bg-[#0a0a0a] -mx-3 px-3 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 xl:-mx-12 xl:px-12 shadow-sm transition-all duration-300">
          <section className="pb-1">
            <div
              className="flex gap-3 sm:gap-4 md:gap-5 lg:gap-6 overflow-x-auto md:overflow-x-hidden md:flex-wrap md:justify-center scrollbar-hide scroll-smooth px-2 sm:px-3 pt-0.5 pb-2 sm:pt-1 sm:pb-2 md:pt-1 md:pb-2"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                touchAction: "pan-x pan-y pinch-zoom",
              }}
            >
              {/* All Button */}
              <div className="flex-shrink-0">
                <Link to="/under-250" onClick={() => setActiveCategory(null)}>
                  <motion.div
                    className="flex flex-col items-center gap-2 w-[62px] sm:w-24 md:w-28 cursor-pointer"
                    whileHover={{ scale: 1.1, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden shadow-md transition-all">
                      <OptimizedImage
                        src={offerImage}
                        alt="All"
                        className="w-full h-full bg-white rounded-full"
                        objectFit="cover"
                        sizes="(max-width: 640px) 62px, (max-width: 768px) 96px, 112px"
                        placeholder="blur"
                      />
                    </div>
                    <span className="text-xs sm:text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 text-center pb-1">
                      All
                    </span>
                  </motion.div>
                </Link>
              </div>
              {categories.slice(0, 6).map((category, index) => {
                const isActive = activeCategory === category.id
                const categorySlug = category.slug || category.name.toLowerCase().replace(/\s+/g, '-')
                return (
                  <div key={category.id} className="flex-shrink-0">
                    <Link to={`/user/category/${categorySlug}`}>
                      <motion.div
                        className="flex flex-col items-center gap-2 w-[62px] sm:w-24 md:w-28"
                        onClick={() => setActiveCategory(category.id)}
                        whileHover={{ scale: 1.1, y: -4 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <div className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden shadow-md transition-all">
                          <OptimizedImage
                            src={category.image}
                            alt={category.name}
                            className="w-full h-full bg-white rounded-full"
                            objectFit="cover"
                            sizes="(max-width: 640px) 62px, (max-width: 768px) 96px, 112px"
                            placeholder="blur"
                          />
                        </div>
                        <span className={`text-xs sm:text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 text-center pb-1 ${isActive ? 'border-b-2 border-red-600' : ''}`}>
                          {category.name.length > 7 ? `${category.name.slice(0, 7)}...` : category.name}
                        </span>
                      </motion.div>
                    </Link>
                  </div>
                )
              })}
              {categories.length > 6 && (
                <div className="flex-shrink-0">
                  <motion.div
                    className="flex flex-col items-center gap-2 w-[62px] sm:w-24 md:w-28 cursor-pointer"
                    whileHover={{ scale: 1.1, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    onClick={() => setShowAllCategoriesModal(true)}
                  >
                    <div className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden shadow-md transition-all bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <UtensilsCrossed className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-xs sm:text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 text-center pb-1">
                      See all
                    </span>
                  </motion.div>
                </div>
              )}
            </div>
          </section>

          <section className="py-2 sm:py-2 md:py-2.5 border-t dark:border-gray-800/50">
            <div className="flex items-center gap-2 md:gap-3">
              <Button
                variant="outline"
                onClick={() => setShowSortPopup(true)}
                className="h-8 sm:h-9 md:h-10 px-3 sm:px-4 md:px-5 rounded-md flex items-center gap-2 whitespace-nowrap flex-shrink-0 font-medium transition-all bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm md:text-base"
              >
                <ArrowDownUp className="h-4 w-4 md:h-5 md:w-5 rotate-90" />
                <span className="text-sm md:text-base font-medium">
                  {selectedSort ? sortOptions.find(opt => opt.id === selectedSort)?.label : 'Sort'}
                </span>
                <ChevronDown className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setUnder30MinsFilter(!under30MinsFilter)}
                className={`h-8 sm:h-9 md:h-10 px-3 sm:px-4 md:px-5 rounded-md flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 font-medium transition-all text-sm md:text-base ${under30MinsFilter
                  ? 'bg-red-600 text-white border border-red-600 hover:bg-red-600/90'
                  : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
              >
                <Timer className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                <span className="text-xs sm:text-sm md:text-base font-medium">Under 30 mins</span>
              </Button>
            </div>
          </section>
        </div>


        {/* Dish list (flattened across restaurants) */}
        {loadingRestaurants ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500 dark:text-gray-400">Loading dishes...</div>
          </div>
        ) : sortedAndFilteredDishes.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500 dark:text-gray-400">
              {under250Restaurants.length === 0
                ? "No dishes under ₹250 found."
                : "No dishes match the selected filters."}
            </div>
          </div>
        ) : (
          <section className="pt-3 sm:pt-4 md:pt-5 lg:pt-6">
            <div className="grid gap-3 sm:gap-4 md:gap-5 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedAndFilteredDishes.map((item, itemIndex) => {
                const quantity = quantities[item.id] || 0
                const isBookmarked = bookmarkedItems.has(item.id)
                return (
                  <motion.div
                    key={item.id}
                    className="w-full bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden cursor-pointer"
                    onClick={() => handleItemClick(item, { name: item.restaurantName || "Under 250" })}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.4, delay: itemIndex * 0.05 }}
                    whileHover={{ y: -8, scale: 1.02 }}
                  >
                    {/* Item Row: left details, right image with floating ADD/qty pill */}
                    <div className="flex gap-4 p-4 md:p-5 lg:p-6">
                      {/* Left Side - Details */}
                      <div className="flex-1 min-w-0">
                        {/* Veg indicator + name */}
                        <div className="flex items-center gap-2 mb-1">
                          {item.isVeg ? (
                            <div className="w-4 h-4 border-2 border-green-600 flex items-center justify-center rounded-sm flex-shrink-0">
                              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                            </div>
                          ) : (
                            <div className="w-4 h-4 border-2 border-orange-600 flex items-center justify-center rounded-sm flex-shrink-0">
                              <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                            </div>
                          )}
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base lg:text-lg line-clamp-1">
                            {item.name}
                          </h3>
                        </div>

                        {/* Price + time pill */}
                        <div className="flex items-center gap-3 mt-1 text-xs sm:text-sm">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            ₹{Math.round(item.price)}
                          </p>
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            <Clock className="h-3 w-3" strokeWidth={1.5} />
                            <span className="text-[11px] sm:text-xs font-medium">
                              {item.deliveryTime || "20-25 mins"}
                            </span>
                          </div>
                        </div>

                        {/* Restaurant name */}
                        {item.restaurantName && (
                          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                            {item.restaurantName}
                          </p>
                        )}

                        {/* Description */}
                        {item.description && (
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        {/* Bookmark & Share */}
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111] hover:bg-gray-100 dark:hover:bg-gray-800"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleBookmarkClick(item.id)
                            }}
                          >
                            <Bookmark
                              className={`h-4 w-4 ${isBookmarked ? "fill-gray-800 dark:fill-gray-200 text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"
                                }`}
                              strokeWidth={2}
                            />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111] hover:bg-gray-100 dark:hover:bg-gray-800"
                            onClick={(e) => {
                              handleShareItem(item, e)
                            }}
                          >
                            <Share2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </Button>
                        </div>
                      </div>

                      {/* Right Side - Image and ADD/qty pill */}
                      <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0">
                        {item.image ? (
                          <OptimizedImage
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full rounded-2xl"
                            objectFit="cover"
                            sizes="128px"
                            placeholder="blur"
                            priority={itemIndex < 4}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                            <span className="text-xs text-gray-400">No image</span>
                          </div>
                        )}

                        {quantity > 0 && !shouldShowGrayscale ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white dark:bg-[#111] font-bold px-4 py-1.5 rounded-lg flex items-center gap-2 text-red-600"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                updateItemQuantity(
                                  item,
                                  Math.max(0, quantity - 1),
                                  e,
                                  item.restaurantName,
                                )
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="text-sm">{quantity}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                updateItemQuantity(
                                  item,
                                  quantity + 1,
                                  e,
                                  item.restaurantName,
                                )
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Plus size={14} className="stroke-[3px]" />
                            </button>
                          </motion.div>
                        ) : (
                          <motion.button
                            initial={false}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!shouldShowGrayscale) {
                                updateItemQuantity(item, 1, e, item.restaurantName)
                              }
                            }}
                            disabled={shouldShowGrayscale}
                            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white dark:bg-[#111] font-bold px-6 py-1.5 rounded-lg flex items-center gap-1 ${shouldShowGrayscale
                              ? 'text-gray-400 cursor-not-allowed opacity-50'
                              : 'text-red-600 hover:bg-red-50'
                              }`}
                          >
                            ADD <Plus size={14} className="stroke-[3px]" />
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {/* Sort Popup - Bottom Sheet */}
      <AnimatePresence>
        {showSortPopup && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowSortPopup(false)}
              className="fixed inset-0 bg-black/50 z-100"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30
              }}
              className="fixed bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-lg lg:max-w-2xl bg-white dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl z-[110] max-h-[60vh] md:max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 md:px-6 py-4 md:py-5 border-b dark:border-gray-800">
                <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Sort By</h2>
                <button
                  onClick={handleClearAll}
                  className="text-red-600 dark:text-red-400 font-medium text-sm md:text-base"
                >
                  Clear all
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6">
                <div className="flex flex-col gap-3 md:gap-4">
                  {sortOptions.map((option) => (
                    <button
                      key={option.id || 'relevance'}
                      onClick={() => setSelectedSort(option.id)}
                      className={`px-4 md:px-5 lg:px-6 py-3 md:py-4 rounded-xl border text-left transition-colors ${selectedSort === option.id
                        ? 'border-red-600 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-gray-800 hover:border-red-600'
                        }`}
                    >
                      <span className={`text-sm md:text-base lg:text-lg font-medium ${selectedSort === option.id ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 md:gap-6 px-4 md:px-6 py-4 md:py-5 border-t dark:border-gray-800 bg-white dark:bg-[#1a1a1a]">
                <button
                  onClick={() => setShowSortPopup(false)}
                  className="flex-1 py-3 md:py-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-sm md:text-base"
                >
                  Close
                </button>
                <button
                  onClick={handleApply}
                  className={`flex-1 py-3 md:py-4 font-semibold rounded-xl transition-colors text-sm md:text-base ${selectedSort
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Item Detail Popup */}
      <AnimatePresence>
        {showItemDetail && selectedItem && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/40 z-[9999]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowItemDetail(false)}
            />

            {/* Item Detail Bottom Sheet */}
            <motion.div
              className="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-2xl lg:max-w-4xl xl:max-w-5xl z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl max-h-[90vh] md:max-h-[85vh] flex flex-col"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.15, type: "spring", damping: 30, stiffness: 400 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button - Top Center Above Popup with 4px gap */}
              <div className="absolute -top-[44px] left-1/2 -translate-x-1/2 z-[10001]">
                <motion.button
                  onClick={() => setShowItemDetail(false)}
                  className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors shadow-lg"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </motion.button>
              </div>

              {/* Image Section */}
              <div className="relative w-full h-64 md:h-80 lg:h-96 xl:h-[500px] overflow-hidden rounded-t-3xl">
                <OptimizedImage
                  src={selectedItem.image}
                  alt={selectedItem.name}
                  className="w-full h-full"
                  objectFit="cover"
                  sizes="100vw"
                  priority={true}
                  placeholder="blur"
                />
                {/* Bookmark and Share Icons Overlay */}
                <div className="absolute bottom-4 right-4 flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBookmarkClick(selectedItem.id)
                    }}
                    className={`h-10 w-10 rounded-full border flex items-center justify-center transition-all duration-300 ${bookmarkedItems.has(selectedItem.id)
                      ? "border-red-500 bg-red-50 text-red-500"
                      : "border-white bg-white/90 text-gray-600 hover:bg-white"
                      }`}
                  >
                    <Bookmark
                      className={`h-5 w-5 transition-all duration-300 ${bookmarkedItems.has(selectedItem.id) ? "fill-red-500" : ""
                        }`}
                    />
                  </button>
                  <button
                    onClick={(e) => handleShareItem(selectedItem, e)}
                    className="h-10 w-10 rounded-full border border-white bg-white/90 text-gray-600 hover:bg-white flex items-center justify-center transition-colors"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content Section */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 xl:px-10 py-4 md:py-6 lg:py-8">
                {/* Item Name and Indicator */}
                <div className="flex items-start justify-between mb-3 md:mb-4 lg:mb-6">
                  <div className="flex items-center gap-2 md:gap-3 flex-1">
                    {selectedItem.isVeg && (
                      <div className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 rounded border-2 border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                        <div className="h-2.5 w-2.5 md:h-3 md:w-3 lg:h-3.5 lg:w-3.5 rounded-full bg-green-600 dark:bg-green-500" />
                      </div>
                    )}
                    <h2 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 dark:text-white">
                      {selectedItem.name}
                    </h2>
                  </div>
                  {/* Bookmark and Share Icons (Desktop) */}
                  <div className="hidden md:flex items-center gap-2 lg:gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBookmarkClick(selectedItem.id)
                      }}
                      className={`h-8 w-8 lg:h-10 lg:w-10 rounded-full border flex items-center justify-center transition-all duration-300 ${bookmarkedItems.has(selectedItem.id)
                        ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
                        : "border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        }`}
                    >
                      <Bookmark
                        className={`h-4 w-4 lg:h-5 lg:w-5 transition-all duration-300 ${bookmarkedItems.has(selectedItem.id) ? "fill-red-500 dark:fill-red-400" : ""
                          }`}
                      />
                    </button>
                    <button
                      onClick={(e) => handleShareItem(selectedItem, e)}
                      className="h-8 w-8 lg:h-10 lg:w-10 rounded-full border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center transition-colors"
                    >
                      <Share2 className="h-4 w-4 lg:h-5 lg:w-5" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm md:text-base lg:text-lg text-gray-600 dark:text-gray-400 mb-4 md:mb-6 lg:mb-8 leading-relaxed">
                  {selectedItem.description || `${selectedItem.name} from ${selectedItem.restaurant || 'Under 250'}`}
                </p>

                {/* Highly Reordered Progress Bar */}
                {selectedItem.customisable && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 h-0.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: '50%' }} />
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                      highly reordered
                    </span>
                  </div>
                )}

                {/* Not Eligible for Coupons */}
                {selectedItem.notEligibleForCoupons && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-4">
                    NOT ELIGIBLE FOR COUPONS
                  </p>
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="border-t dark:border-gray-800 border-gray-200 px-4 md:px-6 lg:px-8 xl:px-10 py-4 md:py-5 lg:py-6 bg-white dark:bg-[#1a1a1a]">
                <div className="flex items-center gap-4 md:gap-5 lg:gap-6">
                  {/* Quantity Selector */}
                  <div className={`flex items-center gap-3 md:gap-4 lg:gap-5 border-2 rounded-lg md:rounded-xl px-3 md:px-4 lg:px-5 h-[44px] md:h-[50px] lg:h-[56px] ${shouldShowGrayscale
                    ? 'border-gray-300 dark:border-gray-700 opacity-50'
                    : 'border-gray-300 dark:border-gray-700'
                    }`}>
                    <button
                      onClick={(e) => {
                        if (!shouldShowGrayscale) {
                          updateItemQuantity(selectedItem, Math.max(0, (quantities[selectedItem.id] || 0) - 1), e)
                        }
                      }}
                      disabled={(quantities[selectedItem.id] || 0) === 0 || shouldShowGrayscale}
                      className={`${shouldShowGrayscale
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed'
                        }`}
                    >
                      <Minus className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
                    </button>
                    <span className={`text-lg md:text-xl lg:text-2xl font-semibold min-w-[2rem] md:min-w-[2.5rem] lg:min-w-[3rem] text-center ${shouldShowGrayscale
                      ? 'text-gray-400 dark:text-gray-600'
                      : 'text-gray-900 dark:text-white'
                      }`}>
                      {quantities[selectedItem.id] || 0}
                    </span>
                    <button
                      onClick={(e) => {
                        if (!shouldShowGrayscale) {
                          updateItemQuantity(selectedItem, (quantities[selectedItem.id] || 0) + 1, e)
                        }
                      }}
                      disabled={shouldShowGrayscale}
                      className={shouldShowGrayscale
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }
                    >
                      <Plus className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
                    </button>
                  </div>

                  {/* Add Item Button */}
                  <Button
                    className={`flex-1 h-[44px] md:h-[50px] lg:h-[56px] rounded-lg md:rounded-xl font-semibold flex items-center justify-center gap-2 text-sm md:text-base lg:text-lg ${shouldShowGrayscale
                      ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-[#671E1F] hover:bg-[#238654] dark:bg-[#671E1F] dark:hover:bg-[#238654] text-white'
                      }`}
                    onClick={(e) => {
                      if (!shouldShowGrayscale) {
                        updateItemQuantity(selectedItem, (quantities[selectedItem.id] || 0) + 1, e)
                        setShowItemDetail(false)
                      }
                    }}
                    disabled={shouldShowGrayscale}
                  >
                    <span>Add item</span>
                    <div className="flex items-center gap-1 md:gap-2">
                      {selectedItem.originalPrice && selectedItem.originalPrice > selectedItem.price && (
                        <span className="text-sm md:text-base lg:text-lg line-through text-red-200">
                          ₹{Math.round(selectedItem.originalPrice)}
                        </span>
                      )}
                      <span className="text-base md:text-lg lg:text-xl font-bold">
                        ₹{Math.round(selectedItem.price)}
                      </span>
                    </div>
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add to Cart Animation */}
      <AddToCartAnimation dynamicBottom={viewCartButtonBottom} />

      {/* All Categories Modal */}
      <AnimatePresence>
        {showAllCategoriesModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowAllCategoriesModal(false)}
              className="fixed inset-0 bg-black/40 z-[9998] backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 top-12 sm:top-16 md:top-20 z-[9999] bg-white dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  All Categories
                </h2>
                <button
                  onClick={() => setShowAllCategoriesModal(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {categories.map((category) => {
                    const categorySlug = category.slug || category.name.toLowerCase().replace(/\s+/g, '-')
                    return (
                      <Link
                        key={category.id}
                        to={`/user/category/${categorySlug}`}
                        onClick={() => setShowAllCategoriesModal(false)}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden shadow-md">
                          <OptimizedImage
                            src={category.image}
                            alt={category.name}
                            className="w-full h-full bg-white rounded-full"
                            objectFit="cover"
                          />
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 text-center">
                          {category.name}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
