import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Info, Search, ChevronDown, Plus, X, Check } from "lucide-react"
import BottomNavOrders from "../components/BottomNavOrders"
import { getAllFoods } from "../utils/foodManagement"

export default function CreatePercentageMenuDiscount() {
  const navigate = useNavigate()
  const allFoods = getAllFoods()

  const [discountCards, setDiscountCards] = useState([
    { id: 1, percentage: "", items: [] }
  ])
  const [isItemsPopupOpen, setIsItemsPopupOpen] = useState(false)
  const [isPercentagePopupOpen, setIsPercentagePopupOpen] = useState(false)
  const [currentCardId, setCurrentCardId] = useState(null)
  const [currentPercentageCardId, setCurrentPercentageCardId] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [percentageSearchQuery, setPercentageSearchQuery] = useState("")
  
  const percentageOptions = ["10", "20", "30", "40", "50", "60"]

  // Transform foods for display
  const transformedFoods = allFoods.map(food => ({
    ...food,
    price: food.price || 0,
    category: food.category || "Varieties",
    foodType: food.foodType || "Non-Veg",
  }))

  // Group foods by category
  const foodsByCategory = useMemo(() => {
    const grouped = {}
    transformedFoods.forEach(food => {
      const category = food.category || "Other"
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(food)
    })
    return grouped
  }, [transformedFoods])

  // Filter foods based on search
  const filteredFoodsByCategory = useMemo(() => {
    const filtered = {}
    Object.keys(foodsByCategory).forEach(category => {
      const filteredItems = foodsByCategory[category].filter(food =>
        food.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      if (filteredItems.length > 0) {
        filtered[category] = filteredItems
      }
    })
    return filtered
  }, [foodsByCategory, searchQuery])

  const handleAddCard = () => {
    const newId = Math.max(...discountCards.map(c => c.id), 0) + 1
    setDiscountCards([...discountCards, { id: newId, percentage: "", items: [] }])
  }

  const handleRemoveCard = (cardId) => {
    if (discountCards.length === 1) return // Keep at least one card
    setDiscountCards(discountCards.filter(c => c.id !== cardId))
  }

  const handlePercentageChange = (cardId, value) => {
    setDiscountCards(discountCards.map(card =>
      card.id === cardId ? { ...card, percentage: value } : card
    ))
  }

  const handleOpenPercentagePopup = (cardId) => {
    setCurrentPercentageCardId(cardId)
    setIsPercentagePopupOpen(true)
    setPercentageSearchQuery("")
  }

  const handleConfirmPercentage = () => {
    setIsPercentagePopupOpen(false)
    setCurrentPercentageCardId(null)
    setPercentageSearchQuery("")
  }

  const handleOpenItemsPopup = (cardId) => {
    setCurrentCardId(cardId)
    setIsItemsPopupOpen(true)
  }

  const getFilteredPercentageOptions = () => {
    if (!percentageSearchQuery.trim()) return percentageOptions
    return percentageOptions.filter(opt => opt.includes(percentageSearchQuery))
  }

  const handleItemToggle = (foodId) => {
    if (!currentCardId) return
    setDiscountCards(discountCards.map(card => {
      if (card.id === currentCardId) {
        const isSelected = card.items.includes(foodId)
        return {
          ...card,
          items: isSelected
            ? card.items.filter(id => id !== foodId)
            : [...card.items, foodId]
        }
      }
      return card
    }))
  }

  const handleConfirmItems = () => {
    setIsItemsPopupOpen(false)
    setCurrentCardId(null)
  }

  const isFormValid = discountCards.every(card => card.percentage && card.items.length > 0)

  const getSelectedItemsText = (cardId) => {
    const card = discountCards.find(c => c.id === cardId)
    if (!card || card.items.length === 0) return "Select items"
    if (card.items.length === 1) return "1 item selected"
    return `${card.items.length} items selected`
  }

  const getSelectedPercentageText = (cardId) => {
    const card = discountCards.find(c => c.id === cardId)
    if (!card || !card.percentage) return "Select any one"
    return `${card.percentage}%`
  }

  const getCurrentCard = () => {
    return discountCards.find(c => c.id === currentCardId)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/restaurant/hub-growth/create-offers/delight-customers")}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Percentage discount</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6">
        <h2 className="text-lg font-bold text-gray-900 tracking-wider mb-4">Offer setup</h2>
        
        <div className="space-y-4">
          {discountCards.map((card, index) => (
            <div key={card.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">Discount #{index + 1}</h3>
                {discountCards.length > 1 && (
                  <button
                    onClick={() => handleRemoveCard(card.id)}
                    className="p-1 rounded-full hover:bg-gray-100"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {/* Percentage discount */}
                <div>
                  <label className="text-sm font-medium text-gray-900 mb-2 block">Percentage discount</label>
                  <button
                    onClick={() => handleOpenPercentagePopup(card.id)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-left flex items-center justify-between text-sm text-gray-600"
                  >
                    <span>{getSelectedPercentageText(card.id)}</span>
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Items for discount */}
                <div>
                  <label className="text-sm font-medium text-gray-900 mb-2 block">Items for discount</label>
                  <button
                    onClick={() => handleOpenItemsPopup(card.id)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-left flex items-center justify-between text-sm text-gray-600"
                  >
                    <span>{getSelectedItemsText(card.id)}</span>
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add another value button */}
          <button
            onClick={handleAddCard}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add another value
          </button>
        </div>
      </div>

      {/* Bottom Button */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
        <button
          onClick={() => {
            if (!isFormValid) return
            navigate("/restaurant/hub-growth/create-offers/delight-customers/percentage/timings", {
              state: {
                discountCards,
                discountType: "percentage-menu",
              },
            })
          }}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
            isFormValid
              ? "bg-black text-white hover:bg-gray-900"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          disabled={!isFormValid}
        >
          Continue
        </button>
      </div>

      {/* Percentage Selection Popup */}
      <AnimatePresence>
        {isPercentagePopupOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPercentagePopupOpen(false)}
              className="fixed inset-0 bg-black/50 z-[9999]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[9999] max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 text-center">Select percentage discount</h2>
              </div>
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search percentage..."
                    value={percentageSearchQuery}
                    onChange={(e) => setPercentageSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {getFilteredPercentageOptions().length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No options found</div>
                ) : (
                  <div className="space-y-3">
                    {getFilteredPercentageOptions().map((option) => {
                      const currentCard = discountCards.find(c => c.id === currentPercentageCardId)
                      const isSelected = currentCard?.percentage === option
                      return (
                        <div
                          key={option}
                          onClick={() => handlePercentageChange(currentPercentageCardId, option)}
                          className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{option}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePercentageChange(currentPercentageCardId, option)
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
              <div className="px-4 py-4 border-t border-gray-200">
                <button
                  onClick={handleConfirmPercentage}
                  className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
                    discountCards.find(c => c.id === currentPercentageCardId)?.percentage
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  disabled={!discountCards.find(c => c.id === currentPercentageCardId)?.percentage}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Items Selection Popup */}
      <AnimatePresence>
        {isItemsPopupOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsItemsPopupOpen(false)}
              className="fixed inset-0 bg-black/50 z-[9999]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[9999] max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 text-center">Select items for discount</h2>
              </div>
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by item name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {Object.keys(filteredFoodsByCategory).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No items found</div>
                ) : (
                  <div className="space-y-6">
                    {Object.keys(filteredFoodsByCategory).map(category => (
                      <div key={category}>
                        <h3 className="text-xs font-bold text-gray-900 uppercase mb-3">{category}</h3>
                        <div className="space-y-3">
                          {filteredFoodsByCategory[category].map(food => {
                            const currentCard = getCurrentCard()
                            const isSelected = currentCard?.items.includes(food.id)
                            return (
                              <div key={food.id} className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-3 flex-1">
                                  <div
                                    className={`w-4 h-4 rounded border-2 shrink-0 ${
                                      food.foodType === "Veg"
                                        ? "bg-green-50 border-green-600"
                                        : "bg-red-50 border-red-600"
                                    }`}
                                  />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{food.name}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium text-gray-900">₹{food.price}</span>
                                  <button
                                    onClick={() => handleItemToggle(food.id)}
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-4 py-4 border-t border-gray-200">
                <button
                  onClick={handleConfirmItems}
                  className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
                    getCurrentCard()?.items.length > 0
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  disabled={!getCurrentCard() || getCurrentCard().items.length === 0}
                >
                  Confirm
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
