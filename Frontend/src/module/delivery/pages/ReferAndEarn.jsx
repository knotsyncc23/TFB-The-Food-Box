import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, ArrowRight, CheckCircle, Contact } from "lucide-react"
import BottomPopup from "../components/BottomPopup"
import { getCompanyNameAsync } from "@/lib/utils/businessSettings"
import { toast } from "sonner"

const STORAGE_KEY = "appzeto_food_referrals"

export default function ReferAndEarn() {
  const navigate = useNavigate()
  const [friendName, setFriendName] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [referralCount, setReferralCount] = useState(0)

  // Load referral count from localStorage on component mount
  useEffect(() => {
    const storedReferrals = localStorage.getItem(STORAGE_KEY)
    if (storedReferrals) {
      try {
        const referrals = JSON.parse(storedReferrals)
        setReferralCount(Array.isArray(referrals) ? referrals.length : 0)
      } catch (error) {
        console.error("Error parsing referrals from localStorage:", error)
        setReferralCount(0)
      }
    }
  }, [])

  // Validate mobile number (10 digits)
  const isValidMobile = /^\d{10}$/.test(mobileNumber)
  const isFormValid = friendName.trim().length > 0 && isValidMobile

  const handlePickContact = async () => {
    if (!navigator.contacts?.select) {
      toast.error("Contact picker is not available on this device")
      return
    }

    try {
      const [contact] = await navigator.contacts.select(["name", "tel"], { multiple: false })
      const pickedName = Array.isArray(contact?.name) ? contact.name[0] : contact?.name
      const pickedPhone = Array.isArray(contact?.tel) ? contact.tel[0] : contact?.tel

      if (pickedName) {
        setFriendName(String(pickedName).trim())
      }

      if (pickedPhone) {
        setMobileNumber(String(pickedPhone).replace(/\D/g, "").slice(-10))
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Error selecting contact:", error)
        toast.error("Could not read contact details")
      }
    }
  }

  const handleRefer = () => {
    if (isFormValid) {
      // Get existing referrals from localStorage
      const storedReferrals = localStorage.getItem(STORAGE_KEY)
      let referrals = []
      
      if (storedReferrals) {
        try {
          referrals = JSON.parse(storedReferrals)
          if (!Array.isArray(referrals)) {
            referrals = []
          }
        } catch (error) {
          console.error("Error parsing referrals from localStorage:", error)
          referrals = []
        }
      }

      // Add new referral
      const newReferral = {
        name: friendName.trim(),
        mobile: mobileNumber,
        phone: mobileNumber,
        mobileNumber,
        completed: false,
        timestamp: new Date().toISOString()
      }
      
      referrals.push(newReferral)
      
      // Save back to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(referrals))
      
      // Update count
      setReferralCount(referrals.length)
      
      // Show success popup
      setShowSuccessPopup(true)
    }
  }

  const handleWhatsAppShare = async () => {
    const companyName = await getCompanyNameAsync()
    const message = `Hey ${friendName}! Join ${companyName} as a delivery partner and earn together!`
    const whatsappUrl = `https://wa.me/${mobileNumber}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

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
        <h1 className="text-lg font-bold">Refer and earn</h1>
        <div className="w-9" aria-hidden />
      </div>

      {/* Black Background Section - Till below Active Referrals Card */}
      <div className="bg-black">
        <div className="px-4 py-6">
          {/* Active Referrals Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 mb-2">Active referrals</p>
              <p className="text-4xl font-bold text-gray-900">{referralCount}</p>
            </div>
            <button
              onClick={() => navigate("/delivery/your-referrals")}
              className="flex items-center justify-center pt-4 border-t border-gray-100 w-full hover:bg-gray-50 transition-colors rounded-b-lg"
            >
              <span className="text-sm text-center text-gray-600 mr-2">Your referral earnings</span>
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* White Content Section */}
      <div className="bg-white px-4 py-6 pb-24 space-y-6">
        {/* Earning Potential */}
        <div>
          <p className="text-2xl font-bold text-gray-900 mb-6">
            Earn upto ₹6,000 extra per referral
          </p>

          {/* Friend's Name Input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-700 mb-2">
              Enter your friend's name
            </label>
            <div className="relative">
              <input
                type="text"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                placeholder="Name"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ff8100] focus:border-transparent"
              />
              <button
                type="button"
                onClick={handlePickContact}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Pick from contacts"
              >
                <Contact className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Mobile Number Input */}
          <div className="mb-6">
            <label className="block text-sm text-gray-700 mb-2">
              Enter your friend's number
            </label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 10)
                setMobileNumber(value)
              }}
              placeholder="Mobile number"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ff8100] focus:border-transparent"
            />
          </div>
        </div>

        {/* Success Story Banner */}
        <div className="bg-yellow-100 rounded-lg p-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-white">₹</span>
          </div>
          <p className="text-sm text-gray-900 flex-1">
            Vijay Mourya from Indore has earned ₹6000 through referrals
          </p>
        </div>

        {/* Steps Section */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Follow 3 steps & win big</h2>
          <div className="relative">
            {/* Vertical Line - Connects all steps */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-black"></div>
            
            {/* Step 1 */}
            <div className="flex items-start gap-4 relative">
              <div className="flex flex-col items-center relative z-10">
                <div className="w-6 h-6 rounded-full border-6 border-black bg-white flex-shrink-0"></div>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-base text-gray-900 font-medium">Refer a friend</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4 relative mt-2">
              <div className="flex flex-col items-center relative z-10">
                <div className="w-6 h-6 rounded-full border-6 border-black bg-white flex-shrink-0"></div>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-base text-gray-900 font-medium">Your friend completes targets</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4 relative mt-2">
              <div className="flex flex-col items-center relative z-10">
                <div className="w-6 h-6 rounded-full border-6 border-black bg-white flex-shrink-0"></div>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-base text-gray-900 font-medium">You earn upto ₹6,000 bonus</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Refer Now Button - Fixed at bottom */}
      <div className="fixed bottom-0 z-50 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <button
          onClick={handleRefer}
          disabled={!isFormValid}
          className={`w-full py-4 rounded-lg font-semibold transition-all ${
            isFormValid
              ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Refer now
        </button>
      </div>

      {/* Success Popup */}
     
      <BottomPopup
        isOpen={showSuccessPopup}
        onClose={() => setShowSuccessPopup(false)}
        title=""
        showCloseButton={false}
        closeOnBackdropClick={true}
        maxHeight="auto"
      >
        <div className="py-6 flex flex-col items-center gap-4">
          {/* Success Icon */}
          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>

          {/* Success Message */}
          <p className="text-lg font-semibold text-gray-900 text-center">
            {friendName} referred successfully
          </p>

          {/* Share on WhatsApp Button */}
          <button
            onClick={handleWhatsAppShare}
            className="w-full bg-black text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            Share on WhatsApp
          </button>
        </div>
      </BottomPopup>
    </div>
  )
}

