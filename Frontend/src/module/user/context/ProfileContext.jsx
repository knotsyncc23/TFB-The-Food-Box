import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import { authAPI, userAPI } from "@/lib/api"
import { getModuleToken } from "@/lib/utils/auth"

const ProfileContext = createContext(null)

const normalizeAddress = (address) => {
  if (!address) return address
  return {
    ...address,
    id: address.id || address._id || address.addressId || null,
  }
}

export function ProfileProvider({ children }) {
  const [userProfile, setUserProfile] = useState(() => {
    // user_user may be in localStorage (Remember me) or sessionStorage (session only)
    const userStr = localStorage.getItem("user_user") || sessionStorage.getItem("user_user")
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch (e) {
        console.error("Error parsing user_user:", e)
      }
    }
    const saved = localStorage.getItem("userProfile")
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error("Error parsing userProfile from localStorage:", e)
      }
    }

    // Default empty profile
    return null
  })

  const [loading, setLoading] = useState(true)

  const [addresses, setAddresses] = useState([])

  const [paymentMethods, setPaymentMethods] = useState(() => {
    const saved = localStorage.getItem("userPaymentMethods")
    return saved ? JSON.parse(saved) : [
      {
        id: "1",
        cardNumber: "1234",
        cardHolder: "John Doe",
        expiryMonth: "12",
        expiryYear: "2025",
        cvv: "123",
        isDefault: true,
        type: "visa",
      },
      {
        id: "2",
        cardNumber: "5678",
        cardHolder: "John Doe",
        expiryMonth: "12",
        expiryYear: "2026",
        cvv: "456",
        isDefault: false,
        type: "mastercard",
      },
    ]
  })

  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("userFavorites")
    return saved ? JSON.parse(saved) : []
  })

  // Collections state
  const [collections, setCollections] = useState(() => {
    const saved = localStorage.getItem("userCollections")
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error("Error parsing userCollections:", e)
      }
    }
    // Default collections
    return [
      { id: "bookmarks", name: "Bookmarks", items: [], isDefault: true }
    ]
  })

  // Dish favorites state - stored in localStorage for persistence
  const [dishFavorites, setDishFavorites] = useState(() => {
    const saved = localStorage.getItem("userDishFavorites")
    return saved ? JSON.parse(saved) : []
  })

  // VegMode state - stored in localStorage for persistence
  const [vegMode, setVegMode] = useState(() => {
    const saved = localStorage.getItem("userVegMode")
    // Default to false (OFF) when user first visits; respect saved preference after that
    return saved !== null ? saved === "true" : false
  })

  // Save to localStorage whenever userProfile, addresses or paymentMethods change
  useEffect(() => {
    localStorage.setItem("userProfile", JSON.stringify(userProfile))
  }, [userProfile])

  useEffect(() => {
    localStorage.setItem("userAddresses", JSON.stringify(addresses))
  }, [addresses])

  useEffect(() => {
    localStorage.setItem("userPaymentMethods", JSON.stringify(paymentMethods))
  }, [paymentMethods])

  useEffect(() => {
    localStorage.setItem("userFavorites", JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem("userCollections", JSON.stringify(collections))
  }, [collections])

  useEffect(() => {
    localStorage.setItem("userDishFavorites", JSON.stringify(dishFavorites))
  }, [dishFavorites])

  useEffect(() => {
    localStorage.setItem("userVegMode", vegMode.toString())
  }, [vegMode])

  // Fetch user profile and addresses from API on mount and when authentication changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      const isAuthenticated = !!getModuleToken("user")
      if (!isAuthenticated) {
        setUserProfile(null)
        setAddresses([])
        localStorage.removeItem("userProfile")
        localStorage.removeItem("appzeto_user_profile")
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Fetch user profile
        const response = await authAPI.getCurrentUser()
        const userData = response?.data?.data?.user || response?.data?.user || response?.data

        if (userData) {
          setUserProfile(userData)
          const userStr = JSON.stringify(userData)
          const isSession = !!sessionStorage.getItem("user_accessToken")
          if (isSession) {
            sessionStorage.setItem("user_user", userStr)
          } else {
            localStorage.setItem("user_user", userStr)
          }
          localStorage.setItem("userProfile", userStr)
        }

        // Fetch addresses
        try {
          const addressesResponse = await userAPI.getAddresses()
          const addressesData = addressesResponse?.data?.data?.addresses || addressesResponse?.data?.addresses || []
          const normalizedAddresses = addressesData.map(normalizeAddress)
          setAddresses(normalizedAddresses)
          localStorage.setItem("userAddresses", JSON.stringify(normalizedAddresses))
        } catch (addressError) {
          console.error("Error fetching addresses:", addressError)
          // Try to load from localStorage as fallback
          const saved = localStorage.getItem("userAddresses")
          if (saved) {
            try {
              setAddresses(JSON.parse(saved))
            } catch (e) {
              console.error("Error parsing saved addresses:", e)
            }
          }
        }
      } catch (error) {
        // Silently handle error - use existing profile from localStorage
        console.error("Error fetching user profile:", error)
        // Try to load from localStorage as fallback
        const saved = localStorage.getItem("userAddresses")
        if (saved) {
          try {
            setAddresses(JSON.parse(saved))
          } catch (e) {
            console.error("Error parsing saved addresses:", e)
          }
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()

    // Listen for auth changes
    const handleAuthChange = () => {
      fetchUserProfile()
    }

    window.addEventListener("userAuthChanged", handleAuthChange)

    return () => {
      window.removeEventListener("userAuthChanged", handleAuthChange)
    }
  }, [])

  // Address functions - memoized with useCallback
  const addAddress = useCallback(async (address) => {
    try {
      const response = await userAPI.addAddress(address)
      const newAddress = normalizeAddress(response?.data?.data?.address || response?.data?.address)

      if (newAddress) {
        setAddresses((prev) => {
          const updated = [...prev, newAddress]
          localStorage.setItem("userAddresses", JSON.stringify(updated))
          return updated
        })
        return newAddress
      }
    } catch (error) {
      console.error("Error adding address:", error)
      throw error
    }
  }, [])

  const updateAddress = useCallback(async (id, updatedAddress) => {
    try {
      const response = await userAPI.updateAddress(id, updatedAddress)
      const updatedAddr = normalizeAddress(response?.data?.data?.address || response?.data?.address)

      if (updatedAddr) {
        setAddresses((prev) => {
          const updated = prev.map((addr) => (String(addr.id) === String(id) ? updatedAddr : addr))
          localStorage.setItem("userAddresses", JSON.stringify(updated))
          return updated
        })
        return updatedAddr
      }
    } catch (error) {
      console.error("Error updating address:", error)
      throw error
    }
  }, [])

  const deleteAddress = useCallback(async (id) => {
    try {
      await userAPI.deleteAddress(id)
      setAddresses((prev) => {
        const newAddresses = prev.filter((addr) => String(addr.id) !== String(id))
        localStorage.setItem("userAddresses", JSON.stringify(newAddresses))
        return newAddresses
      })
    } catch (error) {
      console.error("Error deleting address:", error)
      throw error
    }
  }, [])

  const setDefaultAddress = useCallback((id) => {
    setAddresses((prev) =>
      prev.map((addr) => ({
        ...addr,
        isDefault: String(addr.id) === String(id),
      }))
    )
  }, [])

  const getDefaultAddress = useCallback(() => {
    return addresses.find((addr) => addr.isDefault) || addresses[0] || null
  }, [addresses])

  // Payment method functions - memoized with useCallback
  const addPaymentMethod = useCallback((payment) => {
    setPaymentMethods((prev) => {
      const newPayment = {
        ...payment,
        id: Date.now().toString(),
        isDefault: prev.length === 0 ? true : false,
      }
      return [...prev, newPayment]
    })
  }, [])

  const updatePaymentMethod = useCallback((id, updatedPayment) => {
    setPaymentMethods((prev) =>
      prev.map((pm) => (pm.id === id ? { ...pm, ...updatedPayment } : pm))
    )
  }, [])

  const deletePaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) => {
      const paymentToDelete = prev.find((pm) => pm.id === id)
      const newPayments = prev.filter((pm) => pm.id !== id)

      // If deleting default, set first remaining as default
      if (paymentToDelete?.isDefault && newPayments.length > 0) {
        newPayments[0].isDefault = true
      }

      return newPayments
    })
  }, [])

  const setDefaultPaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) =>
      prev.map((pm) => ({
        ...pm,
        isDefault: pm.id === id,
      }))
    )
  }, [])

  const getDefaultPaymentMethod = useCallback(() => {
    return paymentMethods.find((pm) => pm.isDefault) || paymentMethods[0] || null
  }, [paymentMethods])

  const getAddressById = useCallback((id) => {
    return addresses.find((addr) => String(addr.id) === String(id))
  }, [addresses])

  const getPaymentMethodById = useCallback((id) => {
    return paymentMethods.find((pm) => pm.id === id)
  }, [paymentMethods])

  // Favorites functions - memoized with useCallback
  const addFavorite = useCallback((restaurant) => {
    setFavorites((prev) => {
      if (!prev.find(fav => fav.slug === restaurant.slug)) {
        return [...prev, restaurant]
      }
      return prev
    })
  }, [])

  const removeFavorite = useCallback((slug) => {
    setFavorites((prev) => prev.filter(fav => fav.slug !== slug))
  }, [])

  const isFavorite = useCallback((slug) => {
    return favorites.some(fav => fav.slug === slug)
  }, [favorites])

  const getFavorites = useCallback(() => {
    return favorites
  }, [favorites])

  // Collection functions
  const addCollection = useCallback((name) => {
    const newCollection = {
      id: `collection-${Date.now()}`,
      name: name,
      items: [],
      isDefault: false
    }
    setCollections(prev => [...prev, newCollection])
    return newCollection
  }, [])

  const removeCollection = useCallback((id) => {
    setCollections(prev => prev.filter(c => c.id !== id || c.isDefault))
  }, [])

  const toggleItemInCollection = useCallback((item, collectionId) => {
    setCollections(prev => prev.map(col => {
      if (col.id === collectionId) {
        const isAlreadyIn = col.items.some(i => (i.slug && i.slug === item.slug) || (i.id && i.id === item.id))
        if (isAlreadyIn) {
          return {
            ...col,
            items: col.items.filter(i => !((i.slug && i.slug === item.slug) || (i.id && i.id === item.id)))
          }
        } else {
          return {
            ...col,
            items: [...col.items, item]
          }
        }
      }
      return col
    }))
  }, [])

  const isItemInCollection = useCallback((itemIdOrSlug, collectionId) => {
    const collection = collections.find(c => c.id === collectionId)
    if (!collection) return false
    return collection.items.some(i => i.slug === itemIdOrSlug || i.id === itemIdOrSlug)
  }, [collections])

  // Dish favorites functions - memoized with useCallback
  const addDishFavorite = useCallback((dish) => {
    setDishFavorites((prev) => {
      if (!prev.find(fav => fav.id === dish.id && fav.restaurantId === dish.restaurantId)) {
        return [...prev, dish]
      }
      return prev
    })
  }, [])

  const removeDishFavorite = useCallback((dishId, restaurantId) => {
    setDishFavorites((prev) =>
      prev.filter(fav => !(fav.id === dishId && fav.restaurantId === restaurantId))
    )
  }, [])

  const isDishFavorite = useCallback((dishId, restaurantId) => {
    return dishFavorites.some(fav => fav.id === dishId && fav.restaurantId === restaurantId)
  }, [dishFavorites])

  const getDishFavorites = useCallback(() => {
    return dishFavorites
  }, [dishFavorites])

  // User profile functions - memoized with useCallback
  const updateUserProfile = useCallback((updatedProfile) => {
    setUserProfile((prev) => ({ ...prev, ...updatedProfile }))
  }, [])

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      userProfile,
      loading,
      updateUserProfile,
      addresses,
      paymentMethods,
      favorites,
      vegMode,
      setVegMode,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      addPaymentMethod,
      updatePaymentMethod,
      deletePaymentMethod,
      setDefaultPaymentMethod,
      getDefaultPaymentMethod,
      getPaymentMethodById,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      dishFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
      collections,
      addCollection,
      removeCollection,
      toggleItemInCollection,
      isItemInCollection,
    }),
    [
      userProfile,
      loading,
      updateUserProfile,
      addresses,
      paymentMethods,
      favorites,
      dishFavorites,
      vegMode,
      setVegMode,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      addPaymentMethod,
      updatePaymentMethod,
      deletePaymentMethod,
      setDefaultPaymentMethod,
      getDefaultPaymentMethod,
      getPaymentMethodById,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
      collections,
      addCollection,
      removeCollection,
      toggleItemInCollection,
      isItemInCollection,
    ]
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) {
    // Return fallback values instead of throwing error
    // This prevents crashes when ProfileProvider is not available
    console.warn("useProfile called outside ProfileProvider - using fallback values")
    return {
      userProfile: null,
      loading: false,
      updateUserProfile: () => console.warn("ProfileProvider not available"),
      addresses: [],
      paymentMethods: [],
      favorites: [],
      addAddress: () => console.warn("ProfileProvider not available"),
      updateAddress: () => console.warn("ProfileProvider not available"),
      deleteAddress: () => console.warn("ProfileProvider not available"),
      setDefaultAddress: () => console.warn("ProfileProvider not available"),
      getDefaultAddress: () => null,
      getAddressById: () => null,
      addPaymentMethod: () => console.warn("ProfileProvider not available"),
      updatePaymentMethod: () => console.warn("ProfileProvider not available"),
      deletePaymentMethod: () => console.warn("ProfileProvider not available"),
      setDefaultPaymentMethod: () => console.warn("ProfileProvider not available"),
      getDefaultPaymentMethod: () => null,
      getPaymentMethodById: () => null,
      addFavorite: () => console.warn("ProfileProvider not available"),
      removeFavorite: () => console.warn("ProfileProvider not available"),
      isFavorite: () => false,
      getFavorites: () => [],
      dishFavorites: [],
      addDishFavorite: () => console.warn("ProfileProvider not available"),
      removeDishFavorite: () => console.warn("ProfileProvider not available"),
      isDishFavorite: () => false,
      getDishFavorites: () => [],
      collections: [{ id: "bookmarks", name: "Bookmarks", items: [], isDefault: true }],
      addCollection: () => console.warn("ProfileProvider not available"),
      removeCollection: () => console.warn("ProfileProvider not available"),
      toggleItemInCollection: () => console.warn("ProfileProvider not available"),
      isItemInCollection: () => false,
      vegMode: false,
      setVegMode: () => console.warn("ProfileProvider not available")
    }
  }
  return context
}

