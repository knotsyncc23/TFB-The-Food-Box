import { Link } from "react-router-dom"
import { ArrowLeft, AlertTriangle, Phone, Shield, Loader2 } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { toast } from "sonner"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function ReportSafetyEmergency() {
  const [report, setReport] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!report.trim()) {
      toast.error('Please describe the safety concern or emergency')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await api.post(API_ENDPOINTS.ADMIN.SAFETY_EMERGENCY_CREATE, {
        message: report.trim()
      })

      const ok =
        response?.data?.success === true ||
        response?.status === 201 ||
        response?.status === 200
      if (ok) {
        setIsSubmitted(true)
        setReport("")
        toast.success('Safety emergency report submitted successfully!')
        setTimeout(() => {
          setIsSubmitted(false)
        }, 5000)
      }
    } catch (error) {
      console.error('Error submitting safety emergency report:', error)
      if (error?.response?.status === 401) {
        toast.error('Please log in to submit a safety report.')
      } else {
        toast.error(error.response?.data?.message || 'Failed to submit safety emergency report. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 lg:mb-8">
          <Link to="/user/profile">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 p-0">
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 text-black dark:text-white" />
            </Button>
          </Link>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-black dark:text-white">Report a safety emergency</h1>
        </div>

        {/* Emergency Contact Card */}
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-xl shadow-sm mb-4 md:mb-5 lg:mb-6">
          <CardContent className="p-4 md:p-5 lg:p-6">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="bg-red-100 dark:bg-red-900/40 rounded-full p-2 md:p-3 mt-0.5">
                <Phone className="h-5 w-5 md:h-6 md:w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base md:text-lg lg:text-xl font-semibold text-red-900 dark:text-red-200 mb-1 md:mb-2">
                  Emergency Contact
                </h3>
                <p className="text-sm md:text-base text-red-700 dark:text-red-300 mb-3 md:mb-4">
                  For immediate emergencies, please call your local emergency services.
                </p>
                <a
                  href="tel:100"
                  className="text-red-600 dark:text-red-400 font-semibold text-base md:text-lg lg:text-xl hover:underline"
                >
                  Emergency: 100
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isSubmitted ? (
          <>
            {/* Info Card */}
            <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800 mb-4 md:mb-5 lg:mb-6">
              <CardContent className="p-4 md:p-5 lg:p-6">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2 md:p-3 mt-0.5">
                    <Shield className="h-5 w-5 md:h-6 md:w-6 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white mb-1 md:mb-2">
                      Safety is our priority
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
                      Report any safety concerns, incidents, or emergencies related to your order or delivery experience.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Form */}
            <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800 mb-4 md:mb-5 lg:mb-6">
              <CardContent className="p-4 md:p-5 lg:p-6">
                <label className="block text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3">
                  Describe the safety concern or emergency
                </label>
                <Textarea
                  placeholder="Please provide details about the safety issue..."
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  className="min-h-[150px] md:min-h-[200px] lg:min-h-[250px] w-full resize-y text-sm md:text-base leading-relaxed border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 dark:bg-[#111111] dark:text-white dark:placeholder:text-gray-400"
                  dir="ltr"
                  style={{
                    direction: 'ltr',
                    textAlign: 'left',
                    unicodeBidi: 'bidi-override',
                    width: '100%',
                    maxWidth: '100%',
                    padding: '12px 16px',
                    boxSizing: 'border-box',
                  }}
                />
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {report.length} characters
                </p>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!report.trim() || isSubmitting}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-sm md:text-base h-10 md:h-12 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Report Safety Issue'
              )}
            </Button>
          </>
        ) : (
          /* Success State */
          <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-md border-0 dark:border-gray-800 overflow-hidden">
            <CardContent className="p-6 md:p-8 lg:p-10 text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-5 lg:mb-6">
                <AlertTriangle className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 md:mb-3">Report Submitted</h2>
              <p className="text-sm md:text-base lg:text-lg text-gray-600 dark:text-gray-400 mb-3 md:mb-4">
                Your safety report has been submitted. Our team will review it immediately and take appropriate action.
              </p>
              <p className="text-xs md:text-sm text-red-600 dark:text-red-400 font-medium">
                If this is a life-threatening emergency, please call 100 immediately.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AnimatedPage>
  )
}

