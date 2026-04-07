import { useState, useRef, useEffect, useMemo } from "react"
import { useNavigate, useParams, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Trash2,
  Check,
  ChevronDown,
  Edit as EditIcon,
  Plus,
  X,
  Camera,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Upload
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
// Removed getAllFoods and saveFood - now using menu API
import api from "@/lib/api"
import { restaurantAPI, uploadAPI } from "@/lib/api"
import { openCameraViaFlutter, hasFlutterCameraBridge } from "@/lib/utils/cameraBridge"
import { toast } from "sonner"

export default function ItemDetailsPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const isNewItem = id === "new"
  const groupId = location.state?.groupId
  const defaultCategory = location.state?.category || "Varieties"
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  // Initialize state with empty values - will be populated from API
  const [itemData, setItemData] = useState(null) // Store the full item data for saving
  const [itemName, setItemName] = useState("")
  const [category, setCategory] = useState(defaultCategory)
  const [subCategory, setSubCategory] = useState("")
  const [servesInfo, setServesInfo] = useState("")
  const [itemSizeQuantity, setItemSizeQuantity] = useState("")
  const [itemSizeUnit, setItemSizeUnit] = useState("piece")
  const [itemDescription, setItemDescription] = useState("")
  const [foodType, setFoodType] = useState("Non-Veg")
  const [basePrice, setBasePrice] = useState("0")
  const [preparationTime, setPreparationTime] = useState("")
  const [gst, setGst] = useState("5.0")
  const [isRecommended, setIsRecommended] = useState(false)
  const [isInStock, setIsInStock] = useState(true)
  const [weightPerServing, setWeightPerServing] = useState("")
  const [calorieCount, setCalorieCount] = useState("")
  const [proteinCount, setProteinCount] = useState("")
  const [carbohydrates, setCarbohydrates] = useState("")
  const [fatCount, setFatCount] = useState("")
  const [fibreCount, setFibreCount] = useState("")
  const [allergens, setAllergens] = useState("")
  const [showMoreNutrition, setShowMoreNutrition] = useState(false)
  const [selectedTags, setSelectedTags] = useState([])
  const [images, setImages] = useState([])
  const [imageFiles, setImageFiles] = useState(new Map()) // Track File objects by preview URL
  const [uploadingImages, setUploadingImages] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const [direction, setDirection] = useState(0)
  const carouselRef = useRef(null)
  const [isCategoryPopupOpen, setIsCategoryPopupOpen] = useState(false)
  const [isServesPopupOpen, setIsServesPopupOpen] = useState(false)
  const [isItemSizePopupOpen, setIsItemSizePopupOpen] = useState(false)
  const [isGstPopupOpen, setIsGstPopupOpen] = useState(false)
  const [isTagsPopupOpen, setIsTagsPopupOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingItem, setLoadingItem] = useState(false)
  const [variations, setVariations] = useState([]) // { id, name, price, stock }

  const maxNameLength = 70
  const maxDescriptionLength = 1000
  const descriptionLength = itemDescription.length
  const minDescriptionLength = 5
  const nameLength = itemName.length

  // When variants exist, base price should always reflect the lowest
  // variant price and should not be manually editable (per QA spec).
  const hasVariants = useMemo(
    () => Array.isArray(variations) && variations.length > 0,
    [variations],
  )

  const lowestVariantPrice = useMemo(() => {
    if (!hasVariants) return null
    const prices = variations
      .map((v) => {
        if (typeof v.price === "number") return v.price
        const parsed = parseFloat(v.price)
        return Number.isNaN(parsed) ? null : parsed
      })
      .filter((p) => typeof p === "number" && p >= 0)
    if (!prices.length) return null
    return Math.min(...prices)
  }, [hasVariants, variations])

  useEffect(() => {
    if (lowestVariantPrice != null) {
      setBasePrice(lowestVariantPrice.toString())
    }
  }, [lowestVariantPrice])

  // Fetch item data from menu API when editing
  useEffect(() => {
    const fetchItemData = async () => {
      // If itemData is already in location.state, use it
      if (location.state?.item) {
        const item = location.state.item
        // Store the full item data for saving
        setItemData(item)

        setItemName(item.name || "")
        setCategory(item.category || defaultCategory)
        setSubCategory(item.subCategory || item.category || "Starters")
        setServesInfo(item.servesInfo || "")
        setItemSizeQuantity(item.itemSizeQuantity || "")
        setItemSizeUnit(item.itemSizeUnit || "piece")
        setItemDescription(item.description || "")
        setFoodType(item.foodType === "Veg" ? "Veg" : (item.foodType === "Egg" ? "Egg" : "Non-Veg"))
        setBasePrice(item.price?.toString() || "0")
        setPreparationTime(item.preparationTime || "")
        setGst(item.gst?.toString() || "5.0")
        setIsRecommended(item.isRecommended || false)
        setIsInStock(item.isAvailable !== false)
        setSelectedTags(item.tags || [])
        setImages(item.images && item.images.length > 0 ? item.images.slice(0, 1) : (item.image ? [item.image] : []))
        setVariations(Array.isArray(item.variations) ? item.variations.map(v => ({
          id: v.id,
          name: v.name || "",
          price: v.price != null ? Number(v.price) : 0,
          stock: typeof v.stock === "number" ? v.stock : (v.stock === "Unlimited" ? "Unlimited" : Number(v.stock) || 0),
        })) : [])

        // Parse nutrition data
        if (item.nutrition && Array.isArray(item.nutrition)) {
          item.nutrition.forEach(nut => {
            if (typeof nut === 'string') {
              if (nut.includes('Weight per serving')) {
                const match = nut.match(/(\d+)\s*grams?/i)
                if (match) setWeightPerServing(match[1])
              } else if (nut.includes('Calorie count')) {
                const match = nut.match(/(\d+)\s*Kcal/i)
                if (match) setCalorieCount(match[1])
              } else if (nut.includes('Protein count')) {
                const match = nut.match(/(\d+)\s*mg/i)
                if (match) setProteinCount(match[1])
              } else if (nut.includes('Carbohydrates')) {
                const match = nut.match(/(\d+)\s*mg/i)
                if (match) setCarbohydrates(match[1])
              } else if (nut.includes('Fat count')) {
                const match = nut.match(/(\d+)\s*mg/i)
                if (match) setFatCount(match[1])
              } else if (nut.includes('Fibre count')) {
                const match = nut.match(/(\d+)\s*mg/i)
                if (match) setFibreCount(match[1])
              }
            }
          })
        }

        // Set allergens
        if (item.allergies && Array.isArray(item.allergies) && item.allergies.length > 0) {
          setAllergens(item.allergies.join(", "))
        }
        return
      }

      // If no item in location.state but we have an id, fetch from menu API
      if (!isNewItem && id) {
        try {
          setLoadingItem(true)
          const menuResponse = await restaurantAPI.getMenu()
          const menu = menuResponse.data?.data?.menu
          const sections = menu?.sections || []

          // Find the item across all sections
          let foundItem = null
          const searchId = String(id).trim()
          for (const section of sections) {
            // Check items in section
            const item = section.items?.find(i => {
              const itemId = String(i.id || i._id || '').trim()
              return itemId === searchId || itemId === id
            })
            if (item) {
              foundItem = item
              break
            }
            // Check items in subsections
            if (section.subsections) {
              for (const subsection of section.subsections) {
                const subItem = subsection.items?.find(i => {
                  const itemId = String(i.id || i._id || '').trim()
                  return itemId === searchId || itemId === id
                })
                if (subItem) {
                  foundItem = subItem
                  break
                }
              }
              if (foundItem) break
            }
          }

          if (foundItem) {
            // Store the full item data for saving
            setItemData(foundItem)

            setItemName(foundItem.name || "")
            setCategory(foundItem.category || defaultCategory)
            setSubCategory(foundItem.subCategory || foundItem.category || "Starters")
            setServesInfo(foundItem.servesInfo || "")
            setItemSizeQuantity(foundItem.itemSizeQuantity || "")
            setItemSizeUnit(foundItem.itemSizeUnit || "piece")
            setItemDescription(foundItem.description || "")
            setFoodType(foundItem.foodType === "Veg" ? "Veg" : (foundItem.foodType === "Egg" ? "Egg" : "Non-Veg"))
            setBasePrice(foundItem.price?.toString() || "0")
            setPreparationTime(foundItem.preparationTime || "")
            setGst(foundItem.gst?.toString() || "5.0")
            setIsRecommended(foundItem.isRecommended || false)
            setIsInStock(foundItem.isAvailable !== false)
            setSelectedTags(foundItem.tags || [])
            setImages(foundItem.images && foundItem.images.length > 0 ? foundItem.images.slice(0, 1) : (foundItem.image ? [foundItem.image] : []))
            setVariations(Array.isArray(foundItem.variations) ? foundItem.variations.map(v => ({
              id: v.id,
              name: v.name || "",
              price: v.price != null ? Number(v.price) : 0,
              stock: typeof v.stock === "number" ? v.stock : (v.stock === "Unlimited" ? "Unlimited" : Number(v.stock) || 0),
            })) : [])

            // Parse nutrition data
            if (foundItem.nutrition && Array.isArray(foundItem.nutrition)) {
              foundItem.nutrition.forEach(nut => {
                if (typeof nut === 'string') {
                  if (nut.includes('Weight per serving')) {
                    const match = nut.match(/(\d+)\s*grams?/i)
                    if (match) setWeightPerServing(match[1])
                  } else if (nut.includes('Calorie count')) {
                    const match = nut.match(/(\d+)\s*Kcal/i)
                    if (match) setCalorieCount(match[1])
                  } else if (nut.includes('Protein count')) {
                    const match = nut.match(/(\d+)\s*mg/i)
                    if (match) setProteinCount(match[1])
                  } else if (nut.includes('Carbohydrates')) {
                    const match = nut.match(/(\d+)\s*mg/i)
                    if (match) setCarbohydrates(match[1])
                  } else if (nut.includes('Fat count')) {
                    const match = nut.match(/(\d+)\s*mg/i)
                    if (match) setFatCount(match[1])
                  } else if (nut.includes('Fibre count')) {
                    const match = nut.match(/(\d+)\s*mg/i)
                    if (match) setFibreCount(match[1])
                  }
                }
              })
            }

            // Set allergens
            if (foundItem.allergies && Array.isArray(foundItem.allergies) && foundItem.allergies.length > 0) {
              setAllergens(foundItem.allergies.join(", "))
            }
          } else {
            toast.error("Item not found")
          }
        } catch (error) {
          console.error('Error fetching item data:', error)
          toast.error("Failed to load item data")
        } finally {
          setLoadingItem(false)
        }
      }
    }

    fetchItemData()
  }, [id, isNewItem, location.state, defaultCategory])

  // Admin-defined categories + menu section names (so picker is never empty when menu has sections)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true)
        const [catRes, menuRes] = await Promise.all([
          restaurantAPI.getCategories().catch(() => ({ data: {} })),
          restaurantAPI.getMenu().catch(() => ({ data: {} })),
        ])

        const fromAdmin = []
        if (catRes?.data?.success && Array.isArray(catRes?.data?.data?.categories)) {
          catRes.data.data.categories.forEach((cat) => {
            if (cat?.name) {
              fromAdmin.push({
                id: cat._id || cat.id,
                name: String(cat.name).trim(),
              })
            }
          })
        }

        const sections = menuRes?.data?.data?.menu?.sections || []
        const fromMenu = sections
          .filter((s) => s?.name && String(s.name).trim())
          .map((s) => ({
            id: s.id || s._id || `section-${s.name}`,
            name: String(s.name).trim(),
          }))

        const byName = new Map()
        for (const c of fromAdmin) {
          byName.set(c.name.toLowerCase(), c)
        }
        for (const c of fromMenu) {
          const k = c.name.toLowerCase()
          if (!byName.has(k)) byName.set(k, c)
        }

        setCategories([...byName.values()])
      } catch (error) {
        console.error("Error fetching restaurant categories:", error)
        setCategories([])
      } finally {
        setLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [])

  // Serves info options
  const servesOptions = [
    "Serves eg. 1-2 people",
    "Serves eg. 2-3 people",
    "Serves eg. 3-4 people",
    "Serves eg. 4-5 people",
    "Serves eg. 5-6 people",
  ]

  // Item size unit options
  const itemSizeUnits = [
    "slices",
    "kg",
    "litre",
    "ml",
    "serves",
    "cms",
    "piece"
  ]

  // Item tags organized by categories
  const itemTagsCategories = [
    {
      category: "Speciality",
      tags: ["Freshly Frosted", "Pre Frosted", "Chef's Special"]
    },
    {
      category: "Miscellaneous",
      tags: ["Gluten Free", "Sugar Free", "Jain"]
    },
    {
      category: "Dietary Restrictions",
      tags: ["Vegan"]
    }
  ]

  const maxImages = 1

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files)
    if (images.length >= maxImages) {
      toast.error("Maximum 1 image allowed. Remove the current image to add another.")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    // Validate file types
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Invalid file type. Please upload PNG, JPG, JPEG, or WEBP.`)
        return false
      }
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        toast.error(`${file.name}: File size exceeds 5MB limit.`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    // Only take the first valid file (max 1 image)
    const fileToAdd = validFiles[0]
    const previewUrl = URL.createObjectURL(fileToAdd)
    const newImageFilesMap = new Map(imageFiles)
    newImageFilesMap.set(previewUrl, fileToAdd)

    setImages([...images, previewUrl].slice(0, maxImages))
    setImageFiles(newImageFilesMap)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleImageDelete = (index) => {
    if (index < 0 || index >= images.length) return

    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return
    }

    const imageToDelete = images[index]
    const newImages = images.filter((_, i) => i !== index)
    const newImageFilesMap = new Map(imageFiles)

    // Remove the file mapping and revoke the blob URL if it's a preview (new upload)
    if (imageToDelete && imageToDelete.startsWith('blob:')) {
      newImageFilesMap.delete(imageToDelete)
      URL.revokeObjectURL(imageToDelete)
      console.log('Deleted preview image (blob URL):', imageToDelete)
    } else if (imageToDelete && (imageToDelete.startsWith('http://') || imageToDelete.startsWith('https://'))) {
      // For already uploaded images, we need to remove from imageFiles map if it exists
      // Find and remove the file entry if it exists
      for (const [previewUrl, file] of newImageFilesMap.entries()) {
        // This shouldn't happen for HTTP URLs, but just in case
        if (previewUrl === imageToDelete) {
          newImageFilesMap.delete(previewUrl)
          URL.revokeObjectURL(previewUrl)
        }
      }
      console.log('Deleted uploaded image (HTTP URL):', imageToDelete)
    }

    setImages(newImages)
    setImageFiles(newImageFilesMap)

    // Adjust current image index after deletion
    if (newImages.length === 0) {
      setCurrentImageIndex(0)
    } else if (currentImageIndex >= newImages.length) {
      setCurrentImageIndex(newImages.length - 1)
    } else if (currentImageIndex > index) {
      // If we deleted an image before the current one, no need to change index
      // If we deleted the current one or after, index stays the same (shows next image)
    }

    toast.success('Image deleted successfully')
    console.log(`Image deleted. Remaining images: ${newImages.length}`)
  }

  // Swipe handlers
  const minSwipeDistance = 50

  const onTouchStart = (e) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && images.length > 0) {
      setDirection(1)
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
    }
    if (isRightSwipe && images.length > 0) {
      setDirection(-1)
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
    }
  }

  const goToNext = () => {
    setDirection(1)
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const goToPrevious = () => {
    setDirection(-1)
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleCategorySelect = (catId, subCat) => {
    const selectedCategory = categories.find(c => c.id === catId)
    setCategory(selectedCategory.name)
    setSubCategory(subCat)
    setIsCategoryPopupOpen(false)
  }

  const handleServesSelect = (option) => {
    setServesInfo(option)
    setIsServesPopupOpen(false)
  }

  const handleItemSizeUnitSelect = (unit) => {
    setItemSizeUnit(unit)
    setIsItemSizePopupOpen(false)
  }

  const handleGstSelect = (gstValue) => {
    setGst(gstValue)
    setIsGstPopupOpen(false)
  }

  const handleTagToggle = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleSave = async () => {
    if (!itemName.trim()) {
      toast.error("Please enter an item name")
      return
    }

    if (!itemDescription.trim() || itemDescription.length < minDescriptionLength) {
      toast.error(`Please enter a description (min ${minDescriptionLength} characters)`)
      return
    }

    if (images.length === 0) {
      toast.error("Please add at least one image")
      return
    }

    if (!hasVariants && !(parseFloat(basePrice) > 0)) {
      toast.error("Please enter a base price greater than 0")
      return
    }

    try {
      setUploadingImages(true)

      // Upload new images to Cloudinary
      const uploadedImageUrls = []

      // Separate existing URLs (already uploaded) from new files (blob URLs)
      const existingImageUrls = images.filter(img =>
        typeof img === 'string' &&
        (img.startsWith('http://') || img.startsWith('https://')) &&
        !img.startsWith('blob:')
      )

      console.log('Images state:', images)
      console.log('Existing image URLs (already uploaded):', existingImageUrls)
      console.log('Image files map:', imageFiles)

      // Upload new File objects to Cloudinary (files that are blob URLs)
      const filesToUpload = Array.from(imageFiles.values())
      console.log('Files to upload:', filesToUpload.length, filesToUpload)

      if (filesToUpload.length > 0) {
        toast.info(`Uploading ${filesToUpload.length} image(s)...`)
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i]
          try {
            console.log(`Uploading image ${i + 1}/${filesToUpload.length}:`, file.name)
            const uploadResponse = await uploadAPI.uploadMedia(file, {
              folder: 'appzeto/restaurant/menu-items'
            })
            const imageUrl = uploadResponse?.data?.data?.url || uploadResponse?.data?.url
            if (imageUrl) {
              uploadedImageUrls.push(imageUrl)
              console.log(`Successfully uploaded image ${i + 1}:`, imageUrl)
            } else {
              console.error('Upload response:', uploadResponse)
              throw new Error("Failed to get uploaded image URL")
            }
          } catch (uploadError) {
            console.error(`Error uploading image ${i + 1} (${file.name}):`, uploadError)
            toast.error(`Failed to upload ${file.name}. Please try again.`)
            setUploadingImages(false)
            return
          }
        }
      }

      // Combine existing URLs and newly uploaded URLs (max 1 image)
      const allImageUrls = [
        ...existingImageUrls,
        ...uploadedImageUrls
      ].filter((url, index, self) =>
        url &&
        typeof url === 'string' &&
        url.trim() !== '' &&
        self.indexOf(url) === index // Remove duplicates
      ).slice(0, maxImages)

      // Debug: Log image URLs
      console.log('=== IMAGE UPLOAD SUMMARY ===')
      console.log('Existing image URLs:', existingImageUrls.length, existingImageUrls)
      console.log('Newly uploaded URLs:', uploadedImageUrls.length, uploadedImageUrls)
      console.log('Total image URLs to save:', allImageUrls.length, allImageUrls)
      console.log('==========================')

      // Get current menu
      const menuResponse = await restaurantAPI.getMenu()
      let menu = menuResponse.data?.data?.menu
      let sections = menu?.sections || []

      // Prepare item data according to menu model
      // For editing, use the existing ID; for new items, generate a new ID
      // Ensure we use the ID from itemData if available, otherwise use the URL param id
      let itemId
      if (isNewItem) {
        itemId = `item-${Date.now()}-${Math.random()}`
      } else {
        // Try to get ID from itemData first (most reliable), then from URL param
        itemId = itemData?.id || id
        if (!itemId) {
          console.warn('No item ID found, generating new one')
          itemId = `item-${Date.now()}-${Math.random()}`
        }
        // Ensure ID is a string
        itemId = String(itemId)
      }

      console.log('Item ID for save:', itemId, 'From itemData:', itemData?.id, 'From URL:', id)

      // If editing, remove item from its current location (in case category changed or it's in a subsection)
      if (!isNewItem && itemId) {
        const searchId = String(itemId).trim()
        const urlId = String(id || '').trim()
        let itemRemoved = false

        for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
          const section = sections[sectionIndex]

          // Check items in section
          if (section.items && Array.isArray(section.items)) {
            const itemIndex = section.items.findIndex(item => {
              const itemIdStr = String(item.id || item._id || '').trim()
              // Try multiple ID formats
              return itemIdStr === searchId || itemIdStr === urlId ||
                String(item.id) === String(itemId) || String(item.id) === String(id)
            })
            if (itemIndex !== -1) {
              section.items.splice(itemIndex, 1)
              itemRemoved = true
              console.log(`Removed item from section: ${section.name}, item ID was: ${section.items[itemIndex]?.id}`)
              break
            }
          }

          // Check items in subsections
          if (!itemRemoved && section.subsections && Array.isArray(section.subsections)) {
            for (let subIndex = 0; subIndex < section.subsections.length; subIndex++) {
              const subsection = section.subsections[subIndex]
              if (subsection.items && Array.isArray(subsection.items)) {
                const subItemIndex = subsection.items.findIndex(item => {
                  const itemIdStr = String(item.id || item._id || '').trim()
                  // Try multiple ID formats
                  return itemIdStr === searchId || itemIdStr === urlId ||
                    String(item.id) === String(itemId) || String(item.id) === String(id)
                })
                if (subItemIndex !== -1) {
                  subsection.items.splice(subItemIndex, 1)
                  itemRemoved = true
                  console.log(`Removed item from subsection: ${subsection.name} in section: ${section.name}`)
                  break
                }
              }
            }
            if (itemRemoved) break
          }
        }

        if (!itemRemoved && !isNewItem) {
          console.warn(`Item with ID ${itemId} (URL: ${id}) not found in menu for removal. It will be added as new.`)
        }
      }

      // Find or create the category section
      let targetSection = sections.find(s => s.name === category)
      if (!targetSection) {
        // Create new section for this category
        targetSection = {
          id: `section-${Date.now()}`,
          name: category,
          items: [],
          subsections: [],
          isEnabled: true,
          order: sections.length
        }
        sections.push(targetSection)
      }

      // Ensure items array exists
      if (!targetSection.items) {
        targetSection.items = []
      }

      // Prepare nutrition data as strings (as per menu model)
      const nutritionStrings = []

      // When no variants, base price 0 is replaced with minimum ₹1 for valid pricing
      const rawPrice = parseFloat(basePrice) || 0
      const effectivePrice = rawPrice

      // Prepare item data according to menu model
      const itemDataToSave = {
        id: String(itemId), // Ensure ID is a string
        name: itemName.trim(),
        nameArabic: "",
        image: allImageUrls.length > 0 ? allImageUrls[0] : "",
        images: allImageUrls.length > 0 ? allImageUrls : [], // Single image (max 1)
        category: category,
        rating: itemData?.rating || 0.0,
        reviews: itemData?.reviews || 0,
        price: effectivePrice,
        preparationTime: preparationTime || "",
        stock: "Unlimited",
        discount: null,
        originalPrice: null,
        foodType: foodType === "Egg" ? "Non-Veg" : foodType, // Menu model only supports Veg/Non-Veg
        availabilityTimeStart: "12:01 AM",
        availabilityTimeEnd: "11:57 PM",
        description: itemDescription.trim(),
        discountType: "Percent",
        discountAmount: 0.0,
        isAvailable: isInStock,
        isRecommended: isRecommended,
        variations: (variations || []).map(v => ({
          id: String(v.id),
          name: v.name || "",
          price: typeof v.price === "number" && !isNaN(v.price) ? v.price : Number(v.price) || 0,
          stock: v.stock === "Unlimited" ? "Unlimited" : (typeof v.stock === "number" ? v.stock : Number(v.stock) || 0),
        })),
        tags: [],
        nutrition: nutritionStrings,
        allergies: [],
        photoCount: allImageUrls.length,
        // Additional fields for complete item details
        subCategory: subCategory || "",
        servesInfo: "",
        itemSize: "",
        itemSizeQuantity: "",
        itemSizeUnit: "piece",
        gst: parseFloat(gst) || 0,
      }

      // Add or update item in target section
      // Since we already removed the item from its old location, we should always add it here
      // But check if it somehow still exists (shouldn't happen, but safety check)
      const existingItemIndex = targetSection.items.findIndex(item => {
        const itemIdStr = String(item.id || item._id || '').trim()
        return itemIdStr === String(itemId).trim()
      })

      if (existingItemIndex !== -1) {
        // Update existing item (shouldn't happen if removal worked, but handle it)
        console.log(`Updating existing item at index ${existingItemIndex} in section: ${targetSection.name}`)
        targetSection.items[existingItemIndex] = itemDataToSave
      } else {
        // Add new item (or re-add after removal)
        console.log(`Adding item to section: ${targetSection.name}`)
        targetSection.items.push(itemDataToSave)
      }

      // Update menu with new sections
      console.log('=== SAVING ITEM DATA ===')
      console.log('Item ID:', itemId, 'Is new item:', isNewItem)
      console.log('Item name:', itemDataToSave.name)
      console.log('Images array type:', Array.isArray(itemDataToSave.images) ? 'Array' : typeof itemDataToSave.images)
      console.log('Images array:', itemDataToSave.images)
      console.log('Images count:', itemDataToSave.images?.length)
      console.log('PhotoCount:', itemDataToSave.photoCount)
      console.log('Full itemDataToSave:', JSON.stringify(itemDataToSave, null, 2))

      // Verify sections structure
      console.log('Sections being sent:', sections.length, 'sections')
      const itemSection = sections.find(s => s.items?.some(item => item.id === itemId))
      if (itemSection) {
        const itemInSection = itemSection.items.find(item => item.id === itemId)
        if (itemInSection) {
          console.log('Item in section before API call - images:', itemInSection.images, 'count:', itemInSection.images?.length)
        }
      }

      const updateResponse = await restaurantAPI.updateMenu({ sections })

      if (updateResponse.data?.success) {
        const imageCount = allImageUrls.length
        toast.success(
          isNewItem
            ? `Item created successfully with ${imageCount} image(s)`
            : `Item updated successfully with ${imageCount} image(s)`
        )
        // Small delay to ensure backend has processed the update
        await new Promise(resolve => setTimeout(resolve, 300))
        // Navigate back to HubMenu with replace to prevent back navigation issues
        navigate("/restaurant/hub-menu", { replace: true })
        // Trigger a page refresh event
        window.dispatchEvent(new CustomEvent('foodsChanged'))
      } else {
        console.error('Update failed:', updateResponse.data)
        toast.error(updateResponse.data?.message || "Failed to save item")
      }
    } catch (error) {
      console.error('Error saving menu:', error)
      if (error.code === 'ERR_NETWORK') {
        toast.error('Network error. Please check if backend server is running and try again.')
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to save item. Please try again.")
      }
    } finally {
      setUploadingImages(false)
    }
  }

  const handleAddVariation = () => {
    const newId = Math.max(...variations.map(v => typeof v.id === "number" ? v.id : parseInt(v.id, 10) || 0), 0) + 1
    setVariations(prev => [...prev, { id: newId, name: "", price: 0, stock: 0 }])
  }

  const handleRemoveVariation = (variationId) => {
    setVariations(prev => prev.filter(v => v.id !== variationId))
  }

  const handleVariationChange = (variationId, field, value) => {
    setVariations(prev => prev.map(v =>
      v.id === variationId ? { ...v, [field]: value } : v
    ))
  }

  const handleDelete = () => {
    // Delete logic here
    console.log("Deleting item:", id)
    navigate(-1)
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <style>{`
        [data-slot="switch"][data-state="checked"] {
          background-color: #671E1F !important;
        }
        [data-slot="switch-thumb"][data-state="checked"] {
          background-color: #ffffff !important;
        }
      `}</style>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Item details</h1>
        </div>
      </div>


      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Image Carousel */}
        <div className="relative bg-white">
          {images.length > 0 ? (
            <div className="relative w-full h-80 overflow-hidden bg-gray-100">
              {/* Image container with swipe support */}
              <div
                ref={carouselRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                className="relative w-full h-full"
              >
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentImageIndex}
                    custom={direction}
                    initial={{ opacity: 0, x: direction > 0 ? 300 : -300 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction > 0 ? -300 : 300 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="absolute inset-0"
                  >
                    {images[currentImageIndex] ? (
                      <img
                        src={images[currentImageIndex]}
                        alt={`${itemName} - Image ${currentImageIndex + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </motion.div>
                </AnimatePresence>

                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevious}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all z-10"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-900" />
                    </button>
                    <button
                      onClick={goToNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all z-10"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-900" />
                    </button>
                  </>
                )}

                {/* Delete image button */}
                <button
                  onClick={() => handleImageDelete(currentImageIndex)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all z-10"
                >
                  <Trash2 className="w-5 h-5 text-gray-900" />
                </button>

                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full z-10">
                    <span className="text-white text-xs font-medium">
                      {currentImageIndex + 1} / {images.length}
                    </span>
                  </div>
                )}
              </div>

              {/* Carousel dots */}
              {images.length > 1 && (
                <div className="flex items-center justify-center gap-2 py-4 bg-white">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setDirection(index > currentImageIndex ? 1 : -1)
                        setCurrentImageIndex(index)
                      }}
                      className={`transition-all duration-300 rounded-full ${index === currentImageIndex
                          ? "w-8 h-2 bg-gray-900"
                          : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
                        }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="relative w-full h-80 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Camera className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">No images added yet</p>
                <p className="text-xs text-gray-500 mt-1">Tap the button below to add an image</p>
              </div>
            </div>
          )}

          {/* Add image - Camera and Gallery options */}
          <div className="px-4 py-4 bg-white border-t border-gray-100">
            {images.length < maxImages && (
              <div className="flex gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    handleImageAdd(e)
                    e.target.value = ""
                  }}
                  className="hidden"
                  id="image-gallery-upload"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    handleImageAdd(e)
                    e.target.value = ""
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (hasFlutterCameraBridge()) {
                      const { success, file } = await openCameraViaFlutter({
                        source: "gallery",
                      })
                      if (success && file) {
                        handleImageAdd({ target: { files: [file] } })
                      }
                      return
                    }
                    // Browser fallback
                    fileInputRef.current?.click()
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl text-sm font-semibold cursor-pointer hover:from-gray-800 hover:to-gray-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <Upload className="w-5 h-5" />
                  <span>Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (hasFlutterCameraBridge()) {
                      const { success, file } = await openCameraViaFlutter()
                      if (success && file) {
                        handleImageAdd({ target: { files: [file] } })
                      }
                    } else {
                      cameraInputRef.current?.click()
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl text-sm font-semibold cursor-pointer hover:from-gray-800 hover:to-gray-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <Camera className="w-5 h-5" />
                  <span>Camera</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Form Fields */}
        <div className="p-4 space-y-3">
          {/* Category Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Category
            </label>
            <button
              onClick={() => setIsCategoryPopupOpen(true)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm text-gray-900">
                {category}
              </span>
              <ChevronDown className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Item name
            </label>
            <div className="relative">
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                maxLength={maxNameLength}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter item name"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100">
                <EditIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="text-right mt-1">
              <span className="text-xs text-gray-500">
                {nameLength} / {maxNameLength}
              </span>
            </div>
          </div>


          {/* Item Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Item description
            </label>
            <div className="relative">
              <textarea
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                maxLength={maxDescriptionLength}
                rows={4}
                placeholder="Eg: Yummy veg paneer burger with a soft patty, veggies, cheese, and special sauce"
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <button className="absolute right-3 top-3 p-1 rounded-full hover:bg-gray-100">
                <EditIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xs ${descriptionLength < minDescriptionLength ? "text-red-500" : "text-gray-500"}`}>
                {descriptionLength < minDescriptionLength ? "Min 5 characters required" : ""}
              </span>
              <span className="text-xs text-gray-500">
                {descriptionLength} / {maxDescriptionLength}
              </span>
            </div>
            {/* Dietary Options */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setFoodType("Veg")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${foodType === "Veg"
                    ? "border-green-600 bg-green-50 border-2 text-green-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
              >
                {foodType === "Veg" && <Check className="w-4 h-4" />}
                <span>Veg</span>
              </button>
              <button
                onClick={() => setFoodType("Non-Veg")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${foodType === "Non-Veg"
                    ? "border-red-600 border-2 text-red-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
              >
                {foodType === "Non-Veg" && <Check className="w-4 h-4" />}
                <span>Non-Veg</span>
              </button>
              <button
                onClick={() => setFoodType("Egg")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${foodType === "Egg"
                    ? "border-yellow-600 border-2 text-yellow-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
              >
                {foodType === "Egg" && <Check className="w-4 h-4" />}
                <span>Egg</span>
              </button>
            </div>
          </div>

          {/* Item Price */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Item price
            </label>
            <div className="space-y-3">
              <div className="relative">
                <label className="block text-xs text-gray-600 mb-1">Base price</label>
                <div className="relative">
                  <input
                    type="text"
                    value={basePrice}
                    onChange={(e) => {
                      // When variants exist, base price is auto-derived from
                      // the lowest variant price – prevent manual edits.
                      if (hasVariants && lowestVariantPrice != null) {
                        return
                      }
                      let value = e.target.value
                        .replace(/[₹\s,]/g, "")
                        .replace(/[^0-9.]/g, "")
                      const parts = value.split(".")
                      // At most one decimal point
                      const oneDecimal =
                        parts.length > 2
                          ? parts[0] + "." + parts.slice(1).join("")
                          : value
                      value = oneDecimal
                      // Remove leading zeros (e.g. "011" -> "11", "00.5" -> "0.5"); allow "0" or "0."
                      if (value.length > 1 && value.startsWith("0") && !value.startsWith("0.")) {
                        value = value.replace(/^0+/, "") || "0"
                      }
                      setBasePrice(value)
                    }}
                    onFocus={(e) => {
                      // Remove rupee symbol when focused for easier editing
                      if (e.target.value.startsWith('₹')) {
                        e.target.value = e.target.value.replace(/₹\s*/g, '')
                      }
                    }}
                    placeholder="Enter price"
                    readOnly={hasVariants && lowestVariantPrice != null}
                    className={`w-full pl-8 pr-12 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      hasVariants && lowestVariantPrice != null
                        ? "bg-gray-100 cursor-not-allowed"
                        : "bg-gray-50"
                    }`}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">₹</span>
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100">
                    <EditIcon className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                {hasVariants && lowestVariantPrice != null && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Base price is automatically set to the lowest variant price.
                  </p>
                )}
                {!hasVariants && (parseFloat(basePrice) || 0) === 0 && (
                  <p className="mt-1 text-[11px] text-red-600">
                    Base price 0 will be saved as ₹1 (minimum price).
                  </p>
                )}
              </div>

              {/* Preparation Time */}
              <div className="relative">
                <label className="block text-xs text-gray-600 mb-1">Preparation Time</label>
                <div className="relative">
                  <select
                    value={preparationTime}
                    onChange={(e) => setPreparationTime(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                  >
                    <option value="">Select timing</option>
                    <option value="10-20 mins">10-20 mins</option>
                    <option value="20-25 mins">20-25 mins</option>
                    <option value="25-35 mins">25-35 mins</option>
                    <option value="35-45 mins">35-45 mins</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                </div>
              </div>
              {/* <div>
                <label className="block text-xs text-gray-600 mb-1">GST</label>
                <button
                  onClick={() => setIsGstPopupOpen(true)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-900">GST {gst}%</span>
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                </button>
              </div> */}
            </div>

          </div>

          {/* Variations (e.g. size, add-ons) */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-900">Variations</label>
              <button
                type="button"
                onClick={handleAddVariation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                Add variation
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Add options like size or add-ons with name, price and stock.</p>
            {variations.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No variations. Click “Add variation” to add options.</p>
            ) : (
              <div className="space-y-3">
                {variations.map((v) => (
                  <div key={v.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Option</span>
                      {variations.length >= 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariation(v.id)}
                          className="p-1 rounded text-red-500 hover:bg-red-50"
                          aria-label="Remove variation"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Name (e.g. Large, With cheese)"
                      value={v.name}
                      onChange={(e) => handleVariationChange(v.id, "name", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Price (₹)</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={v.price === "" || v.price === undefined ? "" : v.price}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === "" || val === "-" || val === ".") {
                              handleVariationChange(v.id, "price", "")
                            } else {
                              const num = parseFloat(val)
                              handleVariationChange(v.id, "price", isNaN(num) ? 0 : num)
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Stock</label>
                        <input
                          type="number"
                          min={0}
                          value={v.stock === "Unlimited" ? "" : v.stock}
                          onChange={(e) => {
                            const val = e.target.value
                            handleVariationChange(v.id, "stock", val === "" ? "Unlimited" : parseInt(val, 10) || 0)
                          }}
                          placeholder="Unlimited"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommend and In Stock */}
          <div className="flex items-center justify-between py-3 border-t border-gray-200">
            <button
              onClick={() => setIsRecommended(!isRecommended)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isRecommended
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              <ThumbsUp className="w-4 h-4" />
              <span>Recommend</span>
            </button>
            <div className="flex items-center gap-2">
              <Switch
                checked={isInStock}
                onCheckedChange={setIsInStock}
                className="data-[state=unchecked]:bg-gray-300"
              />
              <span className="text-sm text-gray-700">In stock</span>
            </div>
          </div>


        </div>
      </div>

      {/* Category Selection Popup */}
      <AnimatePresence>
        {isCategoryPopupOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryPopupOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Select category</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsCategoryPopupOpen(false)
                      navigate('/restaurant/menu-categories')
                    }}
                    className="p-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors flex items-center gap-1.5"
                    title="Add Category"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Add</span>
                  </button>
                  <button
                    onClick={() => setIsCategoryPopupOpen(false)}
                    className="p-1 rounded-full hover:bg-gray-100"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {loadingCategories ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <p className="text-sm text-gray-500">No categories available yet.</p>
                    <p className="text-xs text-gray-400">Tap the <strong>"+ Add"</strong> button above to create your first category from the admin panel.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.id, cat.name)}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${category === cat.name
                            ? "bg-gray-900 text-white"
                            : "bg-gray-50 text-gray-900 hover:bg-gray-100"
                          }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>


      {/* GST Popup */}
      {/* <AnimatePresence>
        {isGstPopupOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGstPopupOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[60vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Select GST</h2>
                <button
                  onClick={() => setIsGstPopupOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-2">
                  {gstOptions.map((gstValue) => (
                    <button
                      key={gstValue}
                      onClick={() => handleGstSelect(gstValue)}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        gst === gstValue
                          ? "bg-gray-900 text-white"
                          : "bg-gray-50 text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      {gstValue}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence> */}


      {/* Bottom Sticky Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200  z-40">
        <div className={`flex gap-3 px-4 py-4 ${isNewItem ? 'justify-end' : ''}`}>
          {!isNewItem && (
            <button
              onClick={handleDelete}
              className="flex-1 py-3 px-4 border border-black rounded-lg text-sm font-semibold text-black bg-white hover:bg-gray-50 transition-colors"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={uploadingImages}
            className={`${isNewItem ? 'w-full' : 'flex-1'} py-3 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${!uploadingImages
                ? "bg-black text-white hover:bg-black"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
          >
            {uploadingImages ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

