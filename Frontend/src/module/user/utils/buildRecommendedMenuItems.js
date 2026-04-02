/**
 * Items for "Recommended for you" — only dishes the restaurant marked isRecommended.
 */
export function buildRecommendedMenuItems(rawSections) {
  const picked = []
  const seen = new Set()

  const itemKey = (item) => String(item?.id ?? "")
  const isListedAvailable = (item) => {
    if (!item) return false
    const v = item.isAvailable
    if (v === false || v === "false" || v === "False" || v === 0 || v === "0")
      return false
    return true
  }

  const push = (item) => {
    if (!isListedAvailable(item) || item.isRecommended !== true) return
    const k = itemKey(item)
    if (!k || seen.has(k)) return
    seen.add(k)
    picked.push(item)
  }

  for (const sec of rawSections || []) {
    for (const item of sec.items || []) push(item)
    for (const sub of sec.subsections || []) {
      for (const item of sub.items || []) push(item)
    }
  }

  return picked
}
