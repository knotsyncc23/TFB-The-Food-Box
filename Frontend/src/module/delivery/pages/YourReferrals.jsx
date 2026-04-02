import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Headphones, ArrowRight, Phone } from "lucide-react"
import { getCompanyNameAsync } from "@/lib/utils/businessSettings"

const STORAGE_KEY = "appzeto_food_referrals"

export default function YourReferrals() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("in-progress")
  const [referrals, setReferrals] = useState([])
  const [earnings, setEarnings] = useState(0)

  useEffect(() => {
    loadReferrals()
  }, [])

  const loadReferrals = () => {
    const storedReferrals = localStorage.getItem(STORAGE_KEY)
    if (storedReferrals) {
      try {
        const parsedReferrals = JSON.parse(storedReferrals)
        if (Array.isArray(parsedReferrals)) {
          setReferrals(parsedReferrals)
        }
      } catch (error) {
        console.error("Error parsing referrals from localStorage:", error)
      }
    }
  }

  // Filter referrals based on tab
  const inProgressReferrals = referrals.filter(ref => !ref.completed)
  const pastReferrals = referrals.filter(ref => ref.completed)

  const getInitials = (name) => {
    if (!name) return "?"
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const getRandomColor = (name) => {
    const colors = [
      "bg-purple-500",
      "bg-blue-500",
      "bg-red-500",
      "bg-yellow-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-red-500",
      "bg-red-800"
    ]
    const index = name ? name.charCodeAt(0) % colors.length : 0
    return colors[index]
  }

  const handleWhatsApp = async (mobile, name) => {
    const companyName = await getCompanyNameAsync()
    const message = `Hey ${name}! Join ${companyName} as a delivery partner and earn together!`
    const whatsappUrl = `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleCall = (mobile) => {
    window.location.href = `tel:${mobile}`
  }

  const getReferralPhone = (referral) => referral?.mobile || referral?.phone || referral?.mobileNumber || ""

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-black text-white px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Your referrals</h1>
        <button
          type="button"
          onClick={() => navigate("/delivery/help/tickets")}
          className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-gray-800 transition-colors"
        >
          <Headphones className="w-5 h-5" />
          <span className="text-sm">Help</span>
        </button>
      </div>

      {/* Earnings Card */}
      <div className="bg-white px-4 py-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-center text-sm text-gray-600 mb-2">Your referral earnings</p>
          <p className="text-center text-4xl font-bold text-gray-900">₹{earnings}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 flex gap-3">
        <button
          onClick={() => setActiveTab("in-progress")}
          className={`relative flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            activeTab === "in-progress"
              ? "bg-black text-white"
              : "bg-white text-gray-900 border border-gray-200"
          }`}
        >
          In progress ({inProgressReferrals.length})
        </button>
        <button
          onClick={() => setActiveTab("past")}
          className={`relative flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            activeTab === "past"
              ? "bg-black text-white"
              : "bg-white text-gray-900 border border-gray-200"
          }`}
        >
          Past
        </button>
      </div>

      {/* Referrals List */}
      <div className="px-4 py-6 space-y-4 pb-24">
        {activeTab === "in-progress" && (
          <>
            {inProgressReferrals.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No referrals in progress</p>
              </div>
            ) : (
              inProgressReferrals.map((referral, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 ${getRandomColor(referral.name)} rounded-full flex items-center justify-center text-white font-bold text-lg`}>
                        {getInitials(referral.name)}
                      </div>
                      <div>
                        <p className="text-base font-medium text-gray-900">{referral.name}</p>
                        <p className="text-sm text-gray-600">Central Indore</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-orange-600">Pending</span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Earn Upto Section */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <p className="text-base font-semibold text-gray-900 mb-2">Earn upto ₹6,000</p>
                    <div className="bg-yellow-100 rounded-lg p-3 flex items-start gap-2 mb-4">
                      <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-white">i</span>
                      </div>
                      <p className="text-sm text-gray-900 flex-1">
                        Tell {referral.name} to download Delivery Partner app
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleWhatsApp(getReferralPhone(referral), referral.name)}
                        className="flex-1 bg-white border border-gray-300 text-gray-900 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                        <span>Whatsapp</span>
                      </button>
                      <button
                        onClick={() => handleCall(getReferralPhone(referral))}
                        className="flex-1 bg-black text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                      >
                        <Phone className="w-5 h-5" />
                        <span>Call</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </>
        )}

        {activeTab === "past" && (
          <>
            {pastReferrals.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No past referrals</p>
              </div>
            ) : (
              pastReferrals.map((referral, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 ${getRandomColor(referral.name)} rounded-full flex items-center justify-center text-white font-bold text-lg`}>
                        {getInitials(referral.name)}
                      </div>
                      <div>
                        <p className="text-base font-medium text-gray-900">{referral.name}</p>
                        <p className="text-sm text-gray-600">Central Indore</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-red-600">Completed</span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}

