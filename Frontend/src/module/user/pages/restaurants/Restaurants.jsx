import { Link } from "react-router-dom"

import { ArrowLeft, Clock, MapPin, Heart, Star } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import Footer from "../../components/Footer"
import ScrollReveal from "../../components/ScrollReveal"
import TextReveal from "../../components/TextReveal"
import { Card, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useProfile } from "../../context/ProfileContext"

// All restaurants data - same as Home page
const restaurants = [
  {
    id: 1,
    name: "Golden Dragon",
    cuisine: "Chinese",
    rating: 4.8,
    deliveryTime: "25-30 min",
    distance: "1.2 km",
    image: "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800&h=600&fit=crop",
    priceRange: "$$",
  },
  {
    id: 2,
    name: "Burger Paradise",
    cuisine: "American",
    rating: 4.6,
    deliveryTime: "20-25 min",
    distance: "0.8 km",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop",
    priceRange: "$",
  },
  {
    id: 3,
    name: "Sushi Master",
    cuisine: "Japanese",
    rating: 4.9,
    deliveryTime: "30-35 min",
    distance: "2.1 km",
    image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&h=600&fit=crop",
    priceRange: "$$$",
  },
  {
    id: 4,
    name: "Pizza Corner",
    cuisine: "Italian",
    rating: 4.7,
    deliveryTime: "15-20 min",
    distance: "0.5 km",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&h=600&fit=crop",
    priceRange: "$$",
  },
  {
    id: 5,
    name: "Taco Fiesta",
    cuisine: "Mexican",
    rating: 4.5,
    deliveryTime: "20-25 min",
    distance: "1.5 km",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&h=600&fit=crop",
    priceRange: "$",
  },
  {
    id: 6,
    name: "Fresh Salad Bar",
    cuisine: "Healthy",
    rating: 4.4,
    deliveryTime: "15-20 min",
    distance: "0.9 km",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop",
    priceRange: "$$",
  },
]

export default function Restaurants() {
  const { addFavorite, removeFavorite, isFavorite } = useProfile()

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 dark:from-[#0a0a0a] via-white dark:via-[#0a0a0a] to-orange-50/20 dark:to-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-4 sm:py-6 md:py-8 lg:py-10 space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <ScrollReveal>
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 mb-4 lg:mb-6">
            <Link to="/user">
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-gray-900 dark:text-gray-100" />
                </Button>
            </Link>
            <TextReveal className="flex items-center gap-2 sm:gap-3 lg:gap-4">
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 dark:text-white">
                All Restaurants
              </h1>
            </TextReveal>
          </div>
        </ScrollReveal>

        {/* Restaurants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 xl:gap-6 pt-2 sm:pt-3 lg:pt-4">
          {restaurants.map((restaurant, index) => {
            const restaurantSlug = restaurant.name.toLowerCase().replace(/\s+/g, "-")
            const favorite = isFavorite(restaurantSlug)

            const handleToggleFavorite = (e) => {
              e.preventDefault()
              e.stopPropagation()
              if (favorite) {
                removeFavorite(restaurantSlug)
              } else {
                addFavorite({
                  slug: restaurantSlug,
                  name: restaurant.name,
                  cuisine: restaurant.cuisine,
                  rating: restaurant.rating,
                  deliveryTime: restaurant.deliveryTime,
                  distance: restaurant.distance,
                  priceRange: restaurant.priceRange,
                  image: restaurant.image
                })
              }
            }

            return (
              <ScrollReveal key={restaurant.id} delay={index * 0.1}>
                <Link to={`/user/restaurants/${restaurantSlug}`} className="h-full flex">
                  <Card className="overflow-hidden cursor-pointer border border-gray-200 dark:border-gray-800 group bg-white dark:bg-[#1a1a1a] hover:shadow-lg dark:hover:shadow-xl dark:hover:shadow-gray-900/50 pb-1 sm:pb-2 lg:pb-3 flex flex-col h-full w-full transition-all duration-300">
                    <div className="flex flex-row min-h-[120px] sm:min-h-[140px] md:min-h-[160px] lg:min-h-[180px] flex-1">
                      {/* Left Side - Content */}
                      <CardContent className="flex-1 flex flex-col justify-between p-3 sm:p-4 md:p-5 lg:p-6 min-w-0 overflow-hidden">
                        <div className="flex-1 flex flex-col justify-between gap-2">
                          <div className="flex-shrink-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0 pr-2">
                                <CardTitle className="text-base sm:text-lg md:text-xl mb-1 line-clamp-2 text-gray-900 dark:text-white">
                                  {restaurant.name}
                                </CardTitle>
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium mb-2 line-clamp-1">
                                  {restaurant.cuisine}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {typeof restaurant.rating === "number" && restaurant.rating > 0 ? (
                                    <div className="flex items-center gap-1 bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                                      <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-white text-white" />
                                      <span className="font-bold text-xs sm:text-sm">
                                        {restaurant.rating.toFixed(1)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                                      <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400 dark:text-gray-500" />
                                      <span className="font-semibold text-[11px] sm:text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                        New
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex-shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${favorite ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
                                  }`}
                                onClick={handleToggleFavorite}
                              >
                                <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${favorite ? "fill-red-500 dark:fill-red-400" : ""}`} />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                <span className="font-medium whitespace-nowrap">{restaurant.deliveryTime}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                <span className="font-medium whitespace-nowrap">{restaurant.distance}</span>
                              </div>
                            </div>
                            <Button className="bg-primary-orange hover:opacity-90 dark:hover:opacity-80 text-white text-xs sm:text-sm h-7 sm:h-8 px-3 sm:px-4 flex-shrink-0 transition-opacity">
                              Order Now
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                      
                      {/* Right Side - Image */}
                      <div className="w-36 sm:w-44 md:w-56 lg:w-64 xl:w-72 flex-shrink-0 relative overflow-hidden group/image">
                        <img
                          src={restaurant.image}
                          alt={restaurant.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-l from-black/20 dark:from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </Card>
                </Link>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
      <Footer />
    </AnimatedPage>
  )
}

