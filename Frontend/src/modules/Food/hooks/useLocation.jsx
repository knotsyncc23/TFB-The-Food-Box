import { useSharedLocation } from "@food/context/LocationContext"

export function useLocation() {
  return useSharedLocation()
}
