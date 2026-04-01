export const normalizeCategoryFoodPreference = (value) => {
  if (!value) return "all"

  const normalized = String(value).trim().toLowerCase()

  if (normalized === "veg" || normalized === "vegetarian") {
    return "veg"
  }

  if (
    normalized === "non-veg" ||
    normalized === "non veg" ||
    normalized === "nonveg" ||
    normalized === "non_veg"
  ) {
    return "non-veg"
  }

  return "all"
}

export const shouldShowCategoryForVegMode = (category, vegMode) => {
  if (!vegMode) return true

  const foodPreference = normalizeCategoryFoodPreference(category?.foodPreference)
  return foodPreference !== "non-veg"
}

export const filterCategoriesByVegMode = (categories, vegMode) => {
  if (!Array.isArray(categories)) return []
  return categories.filter((category) => shouldShowCategoryForVegMode(category, vegMode))
}

export const getCategoryFoodPreferenceLabel = (value) => {
  const normalized = normalizeCategoryFoodPreference(value)

  if (normalized === "veg") return "Veg"
  if (normalized === "non-veg") return "Non-Veg"
  return "All"
}
