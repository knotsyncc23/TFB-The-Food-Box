// src/context/cart-context.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import VariantPickerModal from "../components/VariantPickerModal"
import ReplaceCartModal from "../components/ReplaceCartModal"

// Build cart item from (item, restaurant, variation?). Used for add-to-cart and variant flow.
function normalizeFoodType(value) {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, "-")
  if (!normalized) return null
  if (normalized === "veg") return "veg"
  if (normalized.includes("non-veg") || normalized.includes("nonveg") || normalized === "egg") return "non-veg"
  return null
}

function deriveCartItemIsVeg(item, variation = null) {
  const normalizedFoodType =
    normalizeFoodType(variation?.foodType) ||
    normalizeFoodType(item?.variationFoodType) ||
    normalizeFoodType(item?.foodType)

  if (normalizedFoodType === "veg") return true
  if (normalizedFoodType === "non-veg") return false
  if (item?.isVeg === true) return true
  if (item?.isVeg === false) return false
  return false
}

function normalizeExistingCartItem(item) {
  return {
    ...item,
    isVeg: deriveCartItemIsVeg(item),
    foodType: item?.foodType || null,
    variationFoodType: item?.variationFoodType || null,
  }
}

function buildCartItem(item, restaurant, variation = null) {
  const validRestaurantId = restaurant?.restaurantId || restaurant?._id || restaurant?.id
  const isVeg = deriveCartItemIsVeg(item, variation)
  const base = {
    id: String(item.itemId ?? item.id),
    name: item.name,
    price: variation != null && variation.price != null ? Number(variation.price) : Number(item.price ?? 0),
    image: item.image,
    restaurant: restaurant?.name ?? item.restaurant,
    restaurantId: validRestaurantId ?? item.restaurantId,
    description: item.description ?? "",
    originalPrice: item.originalPrice ?? item.price,
    isVeg,
    foodType: item.foodType || null,
    variationFoodType: variation?.foodType || item.variationFoodType || null,
    subCategory: item.subCategory || "",
  }
  if (variation) {
    base.selectedVariation = {
      variationId: String(variation.id),
      variationName: variation.name || "",
      price: variation.price != null ? Number(variation.price) : item.price,
    }
  }
  return base
}

// Default cart context value to prevent errors during initial render
const defaultCartContext = {
  _isProvider: false, // Flag to identify if this is from the actual provider
  cart: [],
  items: [],
  itemCount: 0,
  total: 0,
  lastAddEvent: null,
  lastRemoveEvent: null,
  addToCart: () => {
    console.warn('CartProvider not available - addToCart called');
  },
  removeFromCart: () => {
    console.warn('CartProvider not available - removeFromCart called');
  },
  updateQuantity: () => {
    console.warn('CartProvider not available - updateQuantity called');
  },
  getCartCount: () => 0,
  isInCart: () => false,
  getCartItem: () => null,
  clearCart: () => {
    console.warn('CartProvider not available - clearCart called');
  },
  cleanCartForRestaurant: () => {
    console.warn('CartProvider not available - cleanCartForRestaurant called');
  },
  openVariantPicker: () => {},
  closeVariantPicker: () => {},
  addItemOrAskVariant: () => {},
}

const CartContext = createContext(defaultCartContext)

export function CartProvider({ children }) {
  // Safe init (works with SSR and bad JSON)
  const [cart, setCart] = useState(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem("cart")
      return saved ? JSON.parse(saved).map(normalizeExistingCartItem) : []
    } catch {
      return []
    }
  })

  // Track last add event for animation
  const [lastAddEvent, setLastAddEvent] = useState(null)
  // Track last remove event for animation
  const [lastRemoveEvent, setLastRemoveEvent] = useState(null)

  // Global variant picker: show "Choose option" on any page when item has variations
  const [variantPicker, setVariantPicker] = useState({ item: null, restaurant: null })

  // Replace cart modal: when user adds from different restaurant, show confirm dialog
  const [replaceCartPending, setReplaceCartPending] = useState(null)

  const openVariantPicker = useCallback((item, restaurant) => {
    if (item?.variations?.length) {
      setVariantPicker({ item: { ...item, id: item.itemId ?? item.id }, restaurant: restaurant || null })
    }
  }, [])

  const closeVariantPicker = useCallback(() => {
    setVariantPicker({ item: null, restaurant: null })
  }, [])

  const addItemWithVariant = useCallback((item, variation, restaurant, event = null) => {
    const r = restaurant || (item?.restaurant ? { name: item.restaurant, restaurantId: item.restaurantId } : null)
    if (!r?.name && !item?.restaurant) {
      toast.error("Restaurant information missing.")
      return
    }
    const cartItem = buildCartItem(item, r, variation)
    let sourcePosition = null
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect()
      sourcePosition = {
        viewportX: rect.left + rect.width / 2,
        viewportY: rect.top + rect.height / 2,
        scrollX: window.pageXOffset || 0,
        scrollY: window.pageYOffset || 0,
        itemId: cartItem.id,
      }
    }
    try {
      addToCart(cartItem, sourcePosition)
      closeVariantPicker()
      toast.success("Added to cart")
    } catch (err) {
      toast.error(err.message || "Could not add to cart")
    }
  }, [])

  const addItemOrAskVariant = useCallback((item, restaurant, event = null) => {
    const hasVariations = item?.variations && item.variations.length > 0
    if (hasVariations) {
      openVariantPicker(item, restaurant)
      return
    }
    const r = restaurant || { name: item.restaurant, restaurantId: item.restaurantId }
    if (!r?.name && !item.restaurant) {
      toast.error("Restaurant information missing.")
      return
    }
    const cartItem = buildCartItem(item, r, null)
    let sourcePosition = null
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect()
      sourcePosition = {
        viewportX: rect.left + rect.width / 2,
        viewportY: rect.top + rect.height / 2,
        scrollX: window.pageXOffset || 0,
        scrollY: window.pageYOffset || 0,
        itemId: cartItem.id,
      }
    }
    try {
      addToCart(cartItem, sourcePosition)
      toast.success("Added to cart")
    } catch (err) {
      toast.error(err.message || "Could not add to cart")
    }
  }, [])

  // Persist to localStorage whenever cart changes
  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(cart))
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [cart])

  useEffect(() => {
    setCart((prev) => {
      const normalized = prev.map(normalizeExistingCartItem)
      const changed = normalized.some((item, index) => item.isVeg !== prev[index]?.isVeg)
      return changed ? normalized : prev
    })
  }, [])

  // Clear cart when user logs out so new account gets empty cart
  useEffect(() => {
    const onLogout = () => setCart([])
    window.addEventListener("userLogout", onLogout)
    return () => window.removeEventListener("userLogout", onLogout)
  }, [])

  // Clear cart when user signs in or signs up (new or different account) so cart is always empty for the current user
  useEffect(() => {
    const onAuthChanged = () => setCart([])
    window.addEventListener("userAuthChanged", onAuthChanged)
    return () => window.removeEventListener("userAuthChanged", onAuthChanged)
  }, [])

  const addToCart = (item, sourcePosition = null) => {
    // Check restaurant mismatch BEFORE setCart (to show Replace modal instead of throwing)
    if (cart.length > 0) {
      const firstItemRestaurantName = cart[0]?.restaurant;
      const newItemRestaurantName = item?.restaurant;
      const firstItemRestaurantId = cart[0]?.restaurantId;
      const newItemRestaurantId = item?.restaurantId;

      const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
      const firstRestaurantNameNormalized = normalizeName(firstItemRestaurantName);
      const newRestaurantNameNormalized = normalizeName(newItemRestaurantName);

      const isDifferentRestaurant =
        (firstRestaurantNameNormalized && newRestaurantNameNormalized && firstRestaurantNameNormalized !== newRestaurantNameNormalized) ||
        ((!firstRestaurantNameNormalized || !newRestaurantNameNormalized) && firstItemRestaurantId && newItemRestaurantId && String(firstItemRestaurantId) !== String(newItemRestaurantId));

      if (isDifferentRestaurant) {
        closeVariantPicker();
        setReplaceCartPending({
          cartRestaurantName: firstItemRestaurantName || 'another restaurant',
          newRestaurantName: newItemRestaurantName || 'this restaurant',
          item: { ...item, quantity: 1 },
          sourcePosition,
        });
        return;
      }
    }

    setCart((prev) => {
      // Same line = same item id + same variant (both no variant or same variationId)
      const lineKey = (i) => (i.selectedVariation?.variationId ? `${i.id}_${i.selectedVariation.variationId}` : i.id)
      const itemLineKey = lineKey(item)
      const existing = prev.find((i) => lineKey(i) === itemLineKey)
      if (existing) {
        // Set last add event for animation when incrementing existing item
        if (sourcePosition) {
          setLastAddEvent({
            product: {
              id: item.id,
              name: item.name,
              imageUrl: item.image || item.imageUrl,
            },
            sourcePosition,
          })
          // Clear after animation completes (increased delay)
          setTimeout(() => setLastAddEvent(null), 1500)
        }
        return prev.map((i) =>
          lineKey(i) === itemLineKey ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      
      // Validate item has required restaurant info
      if (!item.restaurantId && !item.restaurant) {
        console.error('❌ Cannot add item: Missing restaurant information!', item);
        throw new Error('Item is missing restaurant information. Please refresh the page.');
      }
      
      const newItem = { ...item, quantity: 1 }
      
      // Set last add event for animation if sourcePosition is provided
      if (sourcePosition) {
        setLastAddEvent({
          product: {
            id: item.id,
            name: item.name,
            imageUrl: item.image || item.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes (increased delay to allow full animation)
        setTimeout(() => setLastAddEvent(null), 1500)
      }
      
      return [...prev, newItem]
    })
  }

  const removeFromCart = (itemId, sourcePosition = null, productInfo = null, variationId = null) => {
    setCart((prev) => {
      const lineKey = (i) => (i.selectedVariation?.variationId ? `${i.id}_${i.selectedVariation.variationId}` : i.id)
      const targetKey = variationId != null ? `${itemId}_${variationId}` : itemId
      const itemToRemove = prev.find((i) => lineKey(i) === targetKey)
      if (itemToRemove && sourcePosition && productInfo) {
        // Set last remove event for animation
        setLastRemoveEvent({
          product: {
            id: productInfo.id || itemToRemove.id,
            name: productInfo.name || itemToRemove.name,
            imageUrl: productInfo.imageUrl || productInfo.image || itemToRemove.image || itemToRemove.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes
        setTimeout(() => setLastRemoveEvent(null), 1500)
      }
      return prev.filter((i) => lineKey(i) !== targetKey)
    })
  }

  const updateQuantity = (itemId, quantity, sourcePosition = null, productInfo = null, variationId = null) => {
    const targetKey = variationId != null ? `${itemId}_${variationId}` : itemId
    const lineKey = (i) => (i.selectedVariation?.variationId ? `${i.id}_${i.selectedVariation.variationId}` : i.id)
    if (quantity <= 0) {
      setCart((prev) => {
        const itemToRemove = prev.find((i) => lineKey(i) === targetKey)
        if (itemToRemove && sourcePosition && productInfo) {
          setLastRemoveEvent({
            product: {
              id: productInfo.id || itemToRemove.id,
              name: productInfo.name || itemToRemove.name,
              imageUrl: productInfo.imageUrl || productInfo.image || itemToRemove.image || itemToRemove.imageUrl,
            },
            sourcePosition,
          })
          setTimeout(() => setLastRemoveEvent(null), 1500)
        }
        return prev.filter((i) => lineKey(i) !== targetKey)
      })
      return
    }
    setCart((prev) => {
      const existingItem = prev.find((i) => lineKey(i) === targetKey)
      if (existingItem && quantity < existingItem.quantity && sourcePosition && productInfo) {
        setLastRemoveEvent({
          product: {
            id: productInfo.id || existingItem.id,
            name: productInfo.name || existingItem.name,
            imageUrl: productInfo.imageUrl || productInfo.image || existingItem.image || existingItem.imageUrl,
          },
          sourcePosition,
        })
        setTimeout(() => setLastRemoveEvent(null), 1500)
      }
      return prev.map((i) => (lineKey(i) === targetKey ? { ...i, quantity } : i))
    })
  }

  const getCartCount = () =>
    cart.reduce((total, item) => total + (item.quantity || 0), 0)

  const isInCart = (itemId, variationId = null) => {
    const targetKey = variationId != null ? `${itemId}_${variationId}` : itemId
    const lineKey = (i) => (i.selectedVariation?.variationId ? `${i.id}_${i.selectedVariation.variationId}` : i.id)
    return cart.some((i) => lineKey(i) === targetKey)
  }

  const getCartItem = (itemId, variationId = null) => {
    const targetKey = variationId != null ? `${itemId}_${variationId}` : itemId
    const lineKey = (i) => (i.selectedVariation?.variationId ? `${i.id}_${i.selectedVariation.variationId}` : i.id)
    return cart.find((i) => lineKey(i) === targetKey)
  }

  const clearCart = () => setCart([])

  const confirmReplaceCart = useCallback(() => {
    if (!replaceCartPending) return
    const { item, sourcePosition } = replaceCartPending
    setReplaceCartPending(null)
    closeVariantPicker()
    setCart([item])
    if (sourcePosition) {
      setLastAddEvent({
        product: { id: item.id, name: item.name, imageUrl: item.image || item.imageUrl },
        sourcePosition,
      })
      setTimeout(() => setLastAddEvent(null), 1500)
    }
    toast.success("Added to cart")
  }, [replaceCartPending])

  const cancelReplaceCart = useCallback(() => {
    setReplaceCartPending(null)
  }, [])

  // Clean cart to remove items from different restaurants
  // Keeps only items from the specified restaurant
  const cleanCartForRestaurant = (restaurantId, restaurantName) => {
    setCart((prev) => {
      if (prev.length === 0) return prev;
      
      // Normalize restaurant name for comparison
      const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
      const targetRestaurantNameNormalized = normalizeName(restaurantName);
      
      // Filter cart to keep only items from the target restaurant
      const cleanedCart = prev.filter((item) => {
        const itemRestaurantId = item?.restaurantId;
        const itemRestaurantName = item?.restaurant;
        const itemRestaurantNameNormalized = normalizeName(itemRestaurantName);
        
        // Check by restaurant name first (more reliable)
        if (targetRestaurantNameNormalized && itemRestaurantNameNormalized) {
          return itemRestaurantNameNormalized === targetRestaurantNameNormalized;
        }
        // Fallback to ID comparison
        if (restaurantId && itemRestaurantId) {
          return itemRestaurantId === restaurantId || 
                 itemRestaurantId === restaurantId.toString() ||
                 itemRestaurantId.toString() === restaurantId;
        }
        // If no match, remove item
        return false;
      });
      
      if (cleanedCart.length !== prev.length) {
        console.warn('🧹 Cleaned cart: Removed items from different restaurants', {
          before: prev.length,
          after: cleanedCart.length,
          removed: prev.length - cleanedCart.length
        });
      }
      
      return cleanedCart;
    });
  }

  // Validate and clean cart on mount/load to prevent multiple restaurant items
  // This runs only once on initial load to clean up any corrupted cart data from localStorage
  useEffect(() => {
    if (cart.length === 0) return;
    
    // Get unique restaurant IDs and names
    const restaurantIds = cart.map(item => item.restaurantId).filter(Boolean);
    const restaurantNames = cart.map(item => item.restaurant).filter(Boolean);
    const uniqueRestaurantIds = [...new Set(restaurantIds)];
    const uniqueRestaurantNames = [...new Set(restaurantNames)];
    
    // Normalize restaurant names for comparison
    const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
    const uniqueRestaurantNamesNormalized = uniqueRestaurantNames.map(normalizeName);
    const uniqueRestaurantNamesSet = new Set(uniqueRestaurantNamesNormalized);
    
    // Check if cart has items from multiple restaurants
    if (uniqueRestaurantIds.length > 1 || uniqueRestaurantNamesSet.size > 1) {
      console.warn('⚠️ Cart contains items from multiple restaurants. Cleaning cart...', {
        restaurantIds: uniqueRestaurantIds,
        restaurantNames: uniqueRestaurantNames
      });
      
      // Keep items from the first restaurant (most recent or first in cart)
      const firstRestaurantId = uniqueRestaurantIds[0];
      const firstRestaurantName = uniqueRestaurantNames[0];
      
      setCart((prev) => {
        const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
        const firstRestaurantNameNormalized = normalizeName(firstRestaurantName);
        
        return prev.filter((item) => {
          const itemRestaurantId = item?.restaurantId;
          const itemRestaurantName = item?.restaurant;
          const itemRestaurantNameNormalized = normalizeName(itemRestaurantName);
          
          // Check by restaurant name first
          if (firstRestaurantNameNormalized && itemRestaurantNameNormalized) {
            return itemRestaurantNameNormalized === firstRestaurantNameNormalized;
          }
          // Fallback to ID comparison
          if (firstRestaurantId && itemRestaurantId) {
            return itemRestaurantId === firstRestaurantId || 
                   itemRestaurantId === firstRestaurantId.toString() ||
                   itemRestaurantId.toString() === firstRestaurantId;
          }
          return false;
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount to clean up localStorage data

  // Transform cart to match AddToCartAnimation expected structure
  const cartForAnimation = useMemo(() => {
    const items = cart.map(item => ({
      product: {
        id: item.id,
        name: item.name,
        imageUrl: item.image || item.imageUrl,
      },
      quantity: item.quantity || 1,
    }))
    
    const itemCount = cart.reduce((total, item) => total + (item.quantity || 0), 0)
    const total = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0)
    
    return {
      items,
      itemCount,
      total,
    }
  }, [cart])

  const value = useMemo(
    () => ({
      _isProvider: true, // Flag to identify this is from the actual provider
      // Keep original cart array for backward compatibility
      cart,
      // Add animation-compatible structure
      items: cartForAnimation.items,
      itemCount: cartForAnimation.itemCount,
      total: cartForAnimation.total,
      lastAddEvent,
      lastRemoveEvent,
      addToCart,
      removeFromCart,
      updateQuantity,
      getCartCount,
      isInCart,
      getCartItem,
      clearCart,
      cleanCartForRestaurant,
      openVariantPicker,
      closeVariantPicker,
      addItemOrAskVariant,
      addItemWithVariant,
    }),
    [cart, cartForAnimation, lastAddEvent, lastRemoveEvent]
  )

  return (
    <CartContext.Provider value={value}>
      {children}
      {variantPicker.item && (
        <VariantPickerModal
          item={variantPicker.item}
          onSelectVariation={(variation, e) => addItemWithVariant(variantPicker.item, variation, variantPicker.restaurant, e)}
          onClose={closeVariantPicker}
        />
      )}
      <ReplaceCartModal
        isOpen={!!replaceCartPending}
        cartRestaurantName={replaceCartPending?.cartRestaurantName}
        newRestaurantName={replaceCartPending?.newRestaurantName}
        onReplace={confirmReplaceCart}
        onCancel={cancelReplaceCart}
      />
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  // Check if context is from the actual provider by checking the _isProvider flag
  if (!context || context._isProvider !== true) {
    // In development, log a warning but don't throw to prevent crashes
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ useCart called outside CartProvider. Using default values.');
      console.warn('💡 Make sure the component is rendered inside UserLayout which provides CartProvider.');
    }
    // Return default context instead of throwing
    return defaultCartContext
  }
  return context
}
