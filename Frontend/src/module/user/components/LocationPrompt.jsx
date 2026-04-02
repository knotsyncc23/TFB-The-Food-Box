import { useEffect, useState, useRef } from "react"
import { MapPin, X } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLocation } from "../hooks/useLocation"

export default function LocationPrompt() {
  const { location, loading, permissionGranted, requestLocation } = useLocation()
  const [showPrompt, setShowPrompt] = useState(false)
  const cardRef = useRef(null)

  // Listen for explicit requests to show the prompt (e.g., from top bar or address selection)
  useEffect(() => {
    const handleShowPrompt = () => {
      if (!location) {
        setShowPrompt(true)
        document.body.style.overflow = "hidden"
        if (cardRef.current) {
          cardRef.current.style.opacity = '1'
          cardRef.current.style.transform = 'translateY(0)'
        }
      }
    }
    window.addEventListener('requestLocationPrompt', handleShowPrompt)
    return () => window.removeEventListener('requestLocationPrompt', handleShowPrompt)
  }, [location])

  // Close prompt when location is successfully obtained
  useEffect(() => {
    if (location && showPrompt) {
      const timer = setTimeout(() => {
        setShowPrompt(false)
        document.body.style.overflow = ""
        localStorage.setItem("locationPromptDismissed", "true")
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [location, showPrompt])

  const handleAllow = async () => {
    await requestLocation()
    // Wait a bit for location to be set
    setTimeout(() => {
      setShowPrompt(false)
      document.body.style.overflow = ""
      localStorage.setItem("locationPromptDismissed", "true")
    }, 500)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    document.body.style.overflow = ""
    localStorage.setItem("locationPromptDismissed", "true")
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  if (!showPrompt) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Card
        ref={cardRef}
        className="w-full max-w-md border-2 border-gray-200 shadow-2xl mx-auto my-auto"
      >
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[#671E1F]/10 flex items-center justify-center">
              <MapPin className="h-6 w-6 text-[#671E1F]" />
            </div>
            <div>
              <CardTitle>Enable Location Services</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Get faster delivery and better recommendations
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We use your location to show nearby restaurants and provide accurate
            delivery times. Your location data is stored locally and never
            shared.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleDismiss}
              variant="outline"
              className="flex-1"
            >
              Not Now
            </Button>
            <Button
              onClick={handleAllow}
              className="flex-1 bg-[#671E1F] hover:bg-[#238654] text-white"
              disabled={loading}
            >
              {loading ? "Getting location..." : "Allow Location"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

