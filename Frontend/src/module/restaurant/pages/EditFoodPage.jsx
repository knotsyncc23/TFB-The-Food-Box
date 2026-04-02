import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import {
  ArrowLeft,
  Home,
  ShoppingBag,
  Store,
  Wallet,
  Menu,
  X,
  Plus,
  Upload,
  Image as ImageIcon
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import BottomNavbar from "../components/BottomNavbar"
import MenuOverlay from "../components/MenuOverlay"
import { getFoodById, saveFood } from "../utils/foodManagement"
import { openCameraViaFlutter, hasFlutterCameraBridge } from "@/lib/utils/cameraBridge"
import { restaurantAPI } from "@/lib/api"
import { toast } from "sonner"

export default function EditFoodPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isNewFood = id === "new" || !id
  const [showMenu, setShowMenu] = useState(false)
  const [canEditMenu, setCanEditMenu] = useState(!isNewFood)

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadRestaurantStatus = async () => {
      if (!isNewFood) {
        setCanEditMenu(true)
        return
      }

      try {
        const res = await restaurantAPI.getCurrentRestaurant()
        const restaurant =
          res.data?.data?.restaurant || res.data?.restaurant || res.data?.data
        if (!isMounted) return

        const isVerified = !!restaurant?.approvedAt
        setCanEditMenu(isVerified)

        if (!isVerified) {
          toast.error("You cannot add items until your restaurant is verified by admin.")
          navigate("/restaurant/menu", { replace: true })
        }
      } catch (error) {
        if (!isMounted) return
        setCanEditMenu(false)
        toast.error("You cannot add items until your restaurant is verified by admin.")
        navigate("/restaurant/menu", { replace: true })
      }
    }

    loadRestaurantStatus()

    return () => {
      isMounted = false
    }
  }, [isNewFood, navigate])

  // Default form data for new food
  const defaultFormData = {
    name: "",
    nameArabic: "",
    image: "",
    price: 0.00,
    availabilityTimeStart: "12:01 AM",
    availabilityTimeEnd: "11:57 PM",
    description: "",
    category: "Varieties",
    foodType: "Non-Veg",
    discountType: "Percent",
    discountAmount: 0.0,
    discount: 0,
    isAvailable: true,
    isRecommended: false,
    variations: [],
    tags: [],
    nutrition: [],
    allergies: []
  }

  // Load food data from localStorage if editing
  const [formData, setFormData] = useState(() => {
    if (isNewFood) {
      return defaultFormData
    }
    // Load existing food data
    const existingFood = getFoodById(id)
    if (existingFood) {
      return {
        ...defaultFormData,
        ...existingFood,
        // Ensure all fields are present
        nameArabic: existingFood.nameArabic || "",
        availabilityTimeStart: existingFood.availabilityTimeStart || "12:01 AM",
        availabilityTimeEnd: existingFood.availabilityTimeEnd || "11:57 PM",
        description: existingFood.description || "",
        discountType: existingFood.discountType || "Percent",
        discountAmount: existingFood.discountAmount || 0.0,
        variations: existingFood.variations || [],
        tags: existingFood.tags || [],
        nutrition: existingFood.nutrition || [],
        allergies: existingFood.allergies || []
      }
    }
    return defaultFormData
  })

  // Reload food data when id changes
  useEffect(() => {
    if (!isNewFood && id) {
      const existingFood = getFoodById(id)
      if (existingFood) {
        setFormData({
          ...defaultFormData,
          ...existingFood,
          nameArabic: existingFood.nameArabic || "",
          availabilityTimeStart: existingFood.availabilityTimeStart || "12:01 AM",
          availabilityTimeEnd: existingFood.availabilityTimeEnd || "11:57 PM",
          description: existingFood.description || "",
          discountType: existingFood.discountType || "Percent",
          discountAmount: existingFood.discountAmount || 0.0,
          variations: existingFood.variations || [],
          tags: existingFood.tags || [],
          nutrition: existingFood.nutrition || [],
          allergies: existingFood.allergies || []
        })
      }
    }
  }, [id, isNewFood])

  const [newTag, setNewTag] = useState("")
  const [newNutrition, setNewNutrition] = useState("")
  const [newAllergy, setNewAllergy] = useState("")

  const handleInputChange = (field, value) => {
    if (!canEditMenu && isNewFood) return
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleVariationChange = (id, field, value) => {
    if (!canEditMenu && isNewFood) return
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.map(v =>
        v.id === id ? { ...v, [field]: value } : v
      )
    }))
  }

  const handleAddVariation = () => {
    if (!canEditMenu && isNewFood) return
    const newId = Math.max(...formData.variations.map(v => v.id), 0) + 1
    setFormData(prev => ({
      ...prev,
      variations: [...prev.variations, { id: newId, name: "", price: 0, stock: 0 }]
    }))
  }

  const handleRemoveVariation = (id) => {
    if (!canEditMenu && isNewFood) return
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.filter(v => v.id !== id)
    }))
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  const handleAddNutrition = () => {
    if (newNutrition.trim() && !formData.nutrition.includes(newNutrition.trim())) {
      setFormData(prev => ({
        ...prev,
        nutrition: [...prev.nutrition, newNutrition.trim()]
      }))
      setNewNutrition("")
    }
  }

  const handleRemoveNutrition = (item) => {
    setFormData(prev => ({
      ...prev,
      nutrition: prev.nutrition.filter(n => n !== item)
    }))
  }

  const handleAddAllergy = () => {
    if (newAllergy.trim() && !formData.allergies.includes(newAllergy.trim())) {
      setFormData(prev => ({
        ...prev,
        allergies: [...prev.allergies, newAllergy.trim()]
      }))
      setNewAllergy("")
    }
  }

  const handleRemoveAllergy = (allergy) => {
    setFormData(prev => ({
      ...prev,
      allergies: prev.allergies.filter(a => a !== allergy)
    }))
  }

  const handleImageUpload = (field, file) => {
    if (!canEditMenu && isNewFood) return
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          [field]: reader.result
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!canEditMenu && isNewFood) {
      toast.error("You cannot add items until your restaurant is verified by admin.")
      navigate("/restaurant/menu", { replace: true })
      return
    }

    // Validate required fields
    if (!formData.name || !formData.image || formData.price <= 0 || !formData.description) {
      alert("Please fill in all required fields (Name, Image, Price, Description)")
      return
    }

    // Prepare food data for saving (normalize variation price: empty string -> 0)
    const foodDataToSave = {
      ...formData,
      variations: (formData.variations || []).map(v => ({
        ...v,
        price: typeof v.price === "number" && !isNaN(v.price) ? v.price : Number(v.price) || 0
      })),
      // Calculate discount display string if discount exists
      discount: formData.discountAmount > 0
        ? (formData.discountType === "Percent"
          ? `${formData.discountAmount}% OFF`
          : formData.discountAmount)
        : null,
      // Calculate originalPrice if discount exists
      originalPrice: formData.discountAmount > 0 && formData.discountType === "Percent"
        ? formData.price / (1 - formData.discountAmount / 100)
        : null
    }

    // Save food to localStorage
    const savedFood = saveFood(foodDataToSave)

    if (savedFood) {
      // Navigate to food details page
      navigate(`/restaurant/food/${savedFood.id}`)
    } else {
      alert("Error saving food. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate(isNewFood ? "/restaurant/food/all" : `/restaurant/food/${id}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Edit Food</h1>
        </div>
      </div>

      {/* Content - Scrollable */}
      <form id="edit-food-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto pb-32 md:pb-6">
        <div className="px-4 py-6 space-y-4">
          {/* Food Image */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Food Image</h2>
              <div className="flex justify-center">
                <div className="relative">
                  <img
                    src={formData.image}
                    alt={formData.name}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-lg object-cover"
                  />
                  <label
                    className="absolute bottom-0 right-0 bg-[#ff8100] text-white p-2 rounded-full cursor-pointer hover:bg-[#e67300]"
                    onClick={async (e) => {
                      if (hasFlutterCameraBridge()) {
                        e.preventDefault()
                        const { success, file } = await openCameraViaFlutter()
                        if (success && file) handleImageUpload("image", file)
                      }
                    }}
                  >
                    <Upload className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload("image", e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Food Name (English)
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Food Name (Arabic)
                  </label>
                  <input
                    type="text"
                    value={formData.nameArabic}
                    onChange={(e) => handleInputChange("nameArabic", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none resize-none"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* General Info */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">General Info</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange("category", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  >
                    <option value="Varieties">Varieties</option>
                    <option value="Appetizers">Appetizers</option>
                    <option value="Main Course">Main Course</option>
                    <option value="Desserts">Desserts</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Food Type
                  </label>
                  <select
                    value={formData.foodType}
                    onChange={(e) => handleInputChange("foodType", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  >
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Vegan">Vegan</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Information */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Price Information</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => handleInputChange("price", parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Type
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => handleInputChange("discountType", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  >
                    <option value="Percent">Percent</option>
                    <option value="Fixed">Fixed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Amount
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.discountAmount}
                    onChange={(e) => handleInputChange("discountAmount", parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Availability */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Availability</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm md:text-base font-medium text-gray-900">Available</span>
                  <button
                    type="button"
                    onClick={() => handleInputChange("isAvailable", !formData.isAvailable)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isAvailable ? 'bg-[#ff8100]' : 'bg-gray-300'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isAvailable ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm md:text-base font-medium text-gray-900">Recommended</span>
                  <button
                    type="button"
                    onClick={() => handleInputChange("isRecommended", !formData.isRecommended)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isRecommended ? 'bg-[#ff8100]' : 'bg-gray-300'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isRecommended ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Available From
                    </label>
                    <input
                      type="text"
                      value={formData.availabilityTimeStart}
                      onChange={(e) => handleInputChange("availabilityTimeStart", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                      placeholder="12:01 AM"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Available To
                    </label>
                    <input
                      type="text"
                      value={formData.availabilityTimeEnd}
                      onChange={(e) => handleInputChange("availabilityTimeEnd", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                      placeholder="11:57 PM"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variations */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base md:text-lg font-semibold text-gray-900">Variations</h2>
                <button
                  type="button"
                  onClick={handleAddVariation}
                  className="text-[#ff8100] hover:text-[#e67300] flex items-center gap-1 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Variation
                </button>
              </div>

              <div className="space-y-4">
                {formData.variations.map((variation) => (
                  <div key={variation.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Variation {variation.id}</span>
                      {formData.variations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariation(variation.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Name</label>
                      <input
                        type="text"
                        value={variation.name}
                        onChange={(e) => handleVariationChange(variation.id, "name", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Price (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={variation.price === "" || variation.price === undefined ? "" : variation.price}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "" || v === "-" || v === ".") {
                              handleVariationChange(variation.id, "price", "");
                            } else {
                              const num = parseFloat(v);
                              handleVariationChange(variation.id, "price", isNaN(num) ? 0 : num);
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Stock</label>
                        <input
                          type="number"
                          value={variation.stock}
                          onChange={(e) => handleVariationChange(variation.id, "stock", parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Tags</h2>

              <div className="flex flex-wrap gap-2 mb-4">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full flex items-center gap-2"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Add tag"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-[#ff8100] text-white rounded-lg hover:bg-[#e67300] text-sm font-medium"
                >
                  Add
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Nutrition */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Nutrition</h2>

              <div className="flex flex-wrap gap-2 mb-4">
                {formData.nutrition.map((item, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full flex items-center gap-2"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => handleRemoveNutrition(item)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNutrition}
                  onChange={(e) => setNewNutrition(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNutrition())}
                  placeholder="Add nutrition"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddNutrition}
                  className="px-4 py-2 bg-[#ff8100] text-white rounded-lg hover:bg-[#e67300] text-sm font-medium"
                >
                  Add
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Allergies */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Allergies</h2>

              <div className="flex flex-wrap gap-2 mb-4">
                {formData.allergies.map((allergy, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full flex items-center gap-2"
                  >
                    {allergy}
                    <button
                      type="button"
                      onClick={() => handleRemoveAllergy(allergy)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAllergy())}
                  placeholder="Add allergy"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddAllergy}
                  className="px-4 py-2 bg-[#ff8100] text-white rounded-lg hover:bg-[#e67300] text-sm font-medium"
                >
                  Add
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 md:relative md:border-0 md:shadow-none">
        <div className="px-4 py-3 md:max-w-4xl md:mx-auto">
          <Button
            type="submit"
            form="edit-food-form"
            className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg text-base md:text-lg"
          >
            Update
          </Button>
        </div>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />

      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
    </div>
  )
}

