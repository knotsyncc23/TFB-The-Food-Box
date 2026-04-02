import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { X, Search, Clock, Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { restaurantAPI } from "@/lib/api"
import { foodImages } from "@/constants/images"
import { toast } from "sonner"

const SEARCH_HISTORY_KEY = "user_search_history_v1"
const MAX_HISTORY_ITEMS = 10

export default function SearchOverlay({ isOpen, onClose, searchValue, onSearchChange }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)
  const [allFoods, setAllFoods] = useState([])
  const [filteredFoods, setFilteredFoods] = useState([])
  const [recentSearches, setRecentSearches] = useState([])
  const [loadingFoods, setLoadingFoods] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [micSupported, setMicSupported] = useState(false)

  // Check if browser supports speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setMicSupported(!!SpeechRecognition)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  // Load recent searches from localStorage when overlay opens
  useEffect(() => {
    if (!isOpen) return
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .filter((item) => typeof item === "string" && item.trim().length > 0)
            .slice(0, MAX_HISTORY_ITEMS)
          setRecentSearches(cleaned)
        }
      }
    } catch (error) {
      console.warn("Failed to load search history:", error)
    }
  }, [isOpen])

  // Load restaurants + menu dishes so search matches food names
  useEffect(() => {
    if (!isOpen || allFoods.length > 0 || loadingFoods) return

    const loadFoods = async () => {
      try {
        setLoadingFoods(true)
        const response = await restaurantAPI.getRestaurants({ limit: 50 })
        const restaurants = response?.data?.data?.restaurants || []

        const restaurantSlug = (r) =>
          r.slug || (r.name || "").toLowerCase().trim().replace(/\s+/g, "-")

        const getRestaurantImage = (r) => {
          const cover = r.coverImages && r.coverImages.length > 0 ? r.coverImages.map((img) => img.url || img).filter(Boolean) : []
          const menu = r.menuImages && r.menuImages.length > 0 ? r.menuImages.map((img) => img.url || img).filter(Boolean) : []
          const first = cover[0] || menu[0] || r.profileImage?.url
          return first || foodImages[0]
        }

        // 1) Restaurant entries (searchable by name, cuisine, featuredDish)
        const restaurantEntries = restaurants
          .map((restaurant, index) => {
            const name = restaurant.name || restaurant.featuredDish
            if (!name) return null
            const cuisineStr = Array.isArray(restaurant.cuisines) && restaurant.cuisines.length > 0
              ? restaurant.cuisines.join(" ").toLowerCase()
              : ""
            return {
              id: `restaurant-${restaurant.restaurantId || restaurant._id || index}`,
              name,
              image: getRestaurantImage(restaurant),
              restaurantSlug: restaurantSlug(restaurant),
              featuredDish: restaurant.featuredDish || null,
              cuisine: cuisineStr,
              isDish: false,
            }
          })
          .filter(Boolean)

        // 2) Flatten menu items from first N restaurants so "food" search works
        const MAX_RESTAURANTS_FOR_MENU = 20
        const dishEntries = []
        const restToFetch = restaurants.slice(0, MAX_RESTAURANTS_FOR_MENU)

        await Promise.all(
          restToFetch.map(async (restaurant) => {
            try {
              const id = restaurant._id || restaurant.restaurantId
              if (!id) return
              const menuRes = await restaurantAPI.getMenuByRestaurantId(id)
              const menu = menuRes?.data?.data?.menu || menuRes?.data?.menu
              if (!menu || !menu.sections || !Array.isArray(menu.sections)) return

              const slug = restaurantSlug(restaurant)
              const restImage = getRestaurantImage(restaurant)

              menu.sections.forEach((section) => {
                const items = section.items || []
                items.forEach((item) => {
                  if (item.name && item.name.trim()) {
                    dishEntries.push({
                      id: `dish-${id}-${item.id || item.name}`,
                      name: item.name.trim(),
                      image: item.image || item.images?.[0] || restImage,
                      restaurantSlug: slug,
                      featuredDish: null,
                      cuisine: "",
                      isDish: true,
                    })
                  }
                })
                const subsections = section.subsections || []
                subsections.forEach((sub) => {
                  const subItems = sub.items || []
                  subItems.forEach((item) => {
                    if (item.name && item.name.trim()) {
                      dishEntries.push({
                        id: `dish-${id}-${item.id || item.name}`,
                        name: item.name.trim(),
                        image: item.image || item.images?.[0] || restImage,
                        restaurantSlug: slug,
                        featuredDish: null,
                        cuisine: "",
                        isDish: true,
                      })
                    }
                  })
                })
              })
            } catch (err) {
              // ignore per-restaurant menu fetch errors
            }
          })
        )

        const combined = [...restaurantEntries, ...dishEntries]
        setAllFoods(combined)
        setFilteredFoods(combined)
      } catch (error) {
        console.error("Error loading search suggestions:", error)
        setAllFoods([])
        setFilteredFoods([])
      } finally {
        setLoadingFoods(false)
      }
    }

    loadFoods()
  }, [isOpen, allFoods.length, loadingFoods])

  // Filter foods based on search input (name, cuisine, featured dish)
  // When search is empty, "Popular restaurants around you" shows only restaurants (no dishes)
  useEffect(() => {
    if (!allFoods || allFoods.length === 0) {
      setFilteredFoods([])
      return
    }

    if (searchValue.trim() === "") {
      const onlyRestaurants = allFoods.filter((food) => !food.isDish)
      setFilteredFoods(onlyRestaurants)
    } else {
      const query = searchValue.toLowerCase().trim()
      const filtered = allFoods.filter((food) => {
        const nameMatch = (food.name || "").toLowerCase().includes(query)
        const cuisineMatch = (food.cuisine || "").includes(query)
        const dishMatch = (food.featuredDish || "").toLowerCase().includes(query)
        return nameMatch || cuisineMatch || dishMatch
      })
      setFilteredFoods(filtered)
    }
  }, [searchValue, allFoods])

  const saveSearchToHistory = (term) => {
    const value = term.trim()
    if (!value) return

    setRecentSearches((prev) => {
      const existing = prev.filter(
        (item) => item.toLowerCase() !== value.toLowerCase()
      )
      const updated = [value, ...existing].slice(0, MAX_HISTORY_ITEMS)
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
      } catch (error) {
        console.warn("Failed to save search history:", error)
      }
      return updated
    })
  }

  const clearRecentSearches = () => {
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY)
    } catch (error) {
      console.warn("Failed to clear search history:", error)
    }
    setRecentSearches([])
  }

  const handleSuggestionClick = (suggestion) => {
    onSearchChange(suggestion)
    saveSearchToHistory(suggestion)
    inputRef.current?.focus()
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchValue.trim()) {
      saveSearchToHistory(searchValue.trim())
      navigate(`/user/search?q=${encodeURIComponent(searchValue.trim())}`)
      onClose()
      onSearchChange("")
    }
  }

  const handleFoodClick = (food) => {
    saveSearchToHistory(food.name)

    if (food.restaurantSlug) {
      // Go directly to the restaurant menu page with a dish search query
      navigate(
        `/user/restaurants/${food.restaurantSlug}?q=${encodeURIComponent(
          food.name,
        )}`,
      )
    } else {
      // Fallback: use generic search results page
      navigate(`/user/search?q=${encodeURIComponent(food.name)}`)
    }

    onClose()
    onSearchChange("")
  }

  const handleMicClick = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-IN"

    recognition.onstart = () => setIsListening(true)

    recognition.onend = () => setIsListening(false)

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() || ""
      if (transcript) {
        onSearchChange(transcript)
      }
    }

    recognition.onerror = (event) => {
      setIsListening(false)
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied. Allow microphone in browser settings.")
      } else if (event.error === "no-speech") {
        toast.message("No speech detected. Try again.")
      } else if (event.error === "network") {
        toast.error("Voice search needs a network connection.")
      } else {
        console.warn("Speech recognition error:", event.error)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      setIsListening(false)
      console.warn("Speech recognition start failed:", err)
      toast.error("Could not start voice search. Try typing instead.")
    }
  }

  if (!isOpen) return null

  const hasQuery = searchValue.trim() !== ""
  const topMatches = hasQuery ? filteredFoods.slice(0, 4) : []

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#0a0a0a]"
      style={{
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      {/* Header with Search Bar */}
      <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground dark:text-gray-400 z-10 pointer-events-none" />
              <Input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search for food, restaurants..."
                className={`pl-12 h-12 w-full bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-gray-800 focus:border-primary-orange dark:focus:border-primary-orange rounded-full text-lg dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 ${micSupported ? "pr-12" : "pr-4"}`}
              />
              {micSupported && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleMicClick}
                  disabled={isListening}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-primary-orange disabled:opacity-70"
                  aria-label={isListening ? "Stop listening" : "Search by voice"}
                >
                  {isListening ? (
                    <MicOff className="h-5 w-5 text-red-500" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              )}
            </div>
            <Button
              type="submit"
              variant="default"
              className="h-12 shrink-0 rounded-full bg-primary-orange hover:bg-primary-orange/90 text-white px-4 sm:px-5 disabled:opacity-50"
              disabled={!searchValue.trim()}
              aria-label="Run search"
            >
              Search
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
            >
              <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </Button>
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 scrollbar-hide bg-white dark:bg-[#0a0a0a]">
        {/* Suggestions Row / Top matches */}
        <div
          className="mb-6"
          style={{
            animation: 'slideDown 0.3s ease-out 0.1s both'
          }}
        >
          {hasQuery ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary-orange" />
                  Matching dishes & restaurants
                </h3>
              </div>
              {topMatches.length > 0 ? (
                <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-800 max-w-xl">
                  {topMatches.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => handleFoodClick(food)}
                      className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-900/60 text-left"
                    >
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                        {food.image ? (
                          <img
                            src={food.image}
                            alt={food.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs text-gray-400">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {food.name}
                        </p>
                        <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                          {food.isDish
                            ? food.restaurantName || 'Dish'
                            : food.cuisine || 'Restaurant'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  No matches found. Try a different name.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary-orange" />
                  Recent Searches
                </h3>
                {recentSearches.length > 0 && (
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    className="text-[11px] sm:text-xs font-medium text-gray-500 hover:text-red-500 underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              {recentSearches.length > 0 ? (
                <div className="flex gap-2 sm:gap-3 flex-wrap">
                  {recentSearches.map((suggestion, index) => (
                    <button
                      key={`${suggestion}-${index}`}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700 text-gray-700 dark:text-gray-300 hover:text-primary-orange dark:hover:text-orange-400 transition-all duration-200 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md"
                      style={{
                        animation: `scaleIn 0.3s ease-out ${0.1 + index * 0.02}s both`
                      }}
                    >
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-primary-orange flex-shrink-0" />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Start searching to build your recent history.
                </p>
              )}
            </>
          )}
        </div>

        {/* Food Grid - only when there is no active query */}
        {/* When there is no query we just show recent searches, no extra helper text or grid */}
      </div>
      <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
    </div>
  )
}

