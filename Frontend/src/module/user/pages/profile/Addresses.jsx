import { Link } from "react-router-dom"
import { MapPin, Plus, ChevronRight } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useProfile } from "../../context/ProfileContext"
import { useLocationSelector } from "../../components/UserLayout"

export default function Addresses() {
  const { addresses } = useProfile()
  const { openLocationSelector } = useLocationSelector()

  const formatAddressLine = (addr) => {
    const parts = [addr.street, addr.additionalDetails, addr.city, addr.state, addr.zipCode].filter(Boolean)
    return parts.join(", ") || "—"
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="max-w-md md:max-w-2xl mx-auto px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-4">
          <Link to="/user/profile" className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronRight className="h-6 w-6 text-gray-600 dark:text-gray-400 rotate-180" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Saved addresses</h1>
          <div className="w-8" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Add and manage your delivery addresses. Choose one at checkout.
        </p>

        <Button
          onClick={openLocationSelector}
          className="w-full mb-4 bg-red-600 hover:bg-red-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add address
        </Button>

        {addresses.length === 0 ? (
          <Card className="bg-white dark:bg-[#1a1a1a] border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <MapPin className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No addresses yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Add your first delivery address to get started.
              </p>
              <Button
                onClick={openLocationSelector}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add address
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <Card
                key={addr.id || addr._id || addr.label}
                className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 shadow-sm"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">{addr.label}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                        {formatAddressLine(addr)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}
