const buildStorageKey = (scope) => `hiddenOrders:${scope}`

export const getHiddenOrderIds = (scope) => {
  if (typeof window === "undefined" || !window.localStorage) return []

  try {
    const stored = window.localStorage.getItem(buildStorageKey(scope))
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error("Failed to read hidden orders from storage:", error)
    return []
  }
}

export const hideOrderId = (scope, orderId) => {
  if (!orderId || typeof window === "undefined" || !window.localStorage) return []

  try {
    const currentIds = getHiddenOrderIds(scope)
    const normalizedOrderId = String(orderId)

    if (currentIds.includes(normalizedOrderId)) {
      return currentIds
    }

    const nextIds = [...currentIds, normalizedOrderId]
    window.localStorage.setItem(buildStorageKey(scope), JSON.stringify(nextIds))
    return nextIds
  } catch (error) {
    console.error("Failed to save hidden order to storage:", error)
    return getHiddenOrderIds(scope)
  }
}
