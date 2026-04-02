import { useState, useEffect, useCallback, useRef } from 'react'
import { zoneAPI } from '@/lib/api'

const MIN_MOVE_METERS_FOR_ZONE_API = 80

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Hook to detect and manage user's zone based on location
 * Automatically detects zone when location is available
 */
export function useZone(location) {
  const [zoneId, setZoneId] = useState(null)
  const [zoneStatus, setZoneStatus] = useState('loading') // 'loading' | 'IN_SERVICE' | 'OUT_OF_SERVICE'
  const [zone, setZone] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const prevCoordsRef = useRef({ latitude: null, longitude: null })

  // Detect zone when location is available
  const detectZone = useCallback(async (lat, lng) => {
    if (!lat || !lng) {
      setZoneStatus('OUT_OF_SERVICE')
      setZoneId(null)
      setZone(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const response = await zoneAPI.detectZone(lat, lng)
      
      if (response.data?.success) {
        const data = response.data.data
        
        if (data.status === 'IN_SERVICE' && data.zoneId) {
          setZoneId(data.zoneId)
          setZone(data.zone)
          setZoneStatus('IN_SERVICE')
          
          // Store in localStorage for persistence
          localStorage.setItem('userZoneId', data.zoneId)
          localStorage.setItem('userZone', JSON.stringify(data.zone))
        } else {
          // OUT_OF_SERVICE
          setZoneId(null)
          setZone(null)
          setZoneStatus('OUT_OF_SERVICE')
          localStorage.removeItem('userZoneId')
          localStorage.removeItem('userZone')
        }
      } else {
        throw new Error(response.data?.message || 'Failed to detect zone')
      }
    } catch (err) {
      console.error('Error detecting zone:', err)
      setError(err.response?.data?.message || err.message || 'Failed to detect zone')
      setZoneStatus('OUT_OF_SERVICE')
      setZoneId(null)
      setZone(null)
      localStorage.removeItem('userZoneId')
      localStorage.removeItem('userZone')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-detect zone when location changes
  useEffect(() => {
    const lat = location?.latitude
    const lng = location?.longitude

    const prev = prevCoordsRef.current
    const coordsChanged =
      !prev.latitude ||
      !prev.longitude ||
      haversineDistanceMeters(prev.latitude, prev.longitude, lat, lng) >=
        MIN_MOVE_METERS_FOR_ZONE_API

    if (lat && lng) {
      setZoneStatus('loading')
      // Only detect zone if coordinates changed significantly
      if (coordsChanged) {
        prevCoordsRef.current = { latitude: lat, longitude: lng }
        detectZone(lat, lng)
      }
    } else {
      // Try to use cached zone if location not available
      const cachedZoneId = localStorage.getItem('userZoneId')
      if (cachedZoneId) {
        const cachedZone = localStorage.getItem('userZone')
        setZoneId(cachedZoneId)
        setZone(cachedZone ? JSON.parse(cachedZone) : null)
        setZoneStatus('IN_SERVICE')
      } else {
        setZoneStatus('OUT_OF_SERVICE')
        setZoneId(null)
        setZone(null)
      }
    }
  }, [location?.latitude, location?.longitude, detectZone])

  // Manual refresh zone
  const refreshZone = useCallback(() => {
    const lat = location?.latitude
    const lng = location?.longitude
    if (lat && lng) {
      detectZone(lat, lng)
    }
  }, [location?.latitude, location?.longitude, detectZone])

  return {
    zoneId,
    zone,
    zoneStatus,
    loading,
    error,
    isInService: zoneStatus === 'IN_SERVICE',
    isOutOfService: zoneStatus === 'OUT_OF_SERVICE',
    refreshZone
  }
}
