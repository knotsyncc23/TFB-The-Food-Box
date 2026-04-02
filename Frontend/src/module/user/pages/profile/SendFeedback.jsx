import { Link } from "react-router-dom"
import { ArrowLeft, PenSquare, Check, Loader2 } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { toast } from "sonner"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function SendFeedback() {
  const [feedback, setFeedback] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      toast.error('Please enter your feedback')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await api.post(API_ENDPOINTS.ADMIN.FEEDBACK_CREATE, {
        message: feedback.trim()
      })

      const ok =
        response?.data?.success === true ||
        response?.status === 201 ||
        response?.status === 200
      if (ok) {
        setIsSubmitted(true)
        setFeedback("")
        toast.success('Feedback submitted successfully!')
        setTimeout(() => {
          setIsSubmitted(false)
        }, 3000)
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      if (error?.response?.status === 401) {
        toast.error('Please log in to send feedback.')
      } else {
        toast.error(error.response?.data?.message || 'Failed to submit feedback. Please try again.')
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
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-black dark:text-white">Send feedback</h1>
        </div>

        {!isSubmitted ? (
          <>
            {/* Info Card */}
            <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800 mb-4 md:mb-5 lg:mb-6">
              <CardContent className="p-4 md:p-5 lg:p-6">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2 md:p-3 mt-0.5">
                    <PenSquare className="h-5 w-5 md:h-6 md:w-6 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white mb-1 md:mb-2">
                      We'd love to hear from you!
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
                      Your feedback helps us improve and serve you better. Share your thoughts, suggestions, or report any issues.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feedback Form */}
            <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800 mb-4 md:mb-5 lg:mb-6">
              <CardContent className="p-4 md:p-5 lg:p-6">
                <label className="block text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3">
                  Your feedback
                </label>
                <Textarea
                  placeholder="Tell us what you think..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="min-h-[250px] md:min-h-[350px] lg:min-h-[400px] w-full resize-y text-sm md:text-base leading-relaxed px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                  dir="ltr"
                  style={{
                    direction: 'ltr',
                    textAlign: 'left',
                    unicodeBidi: 'bidi-override',
                    width: '100%',
                    maxWidth: '100%'
                  }}
                />
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {feedback.length} characters
                </p>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!feedback.trim() || isSubmitting}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-sm md:text-base h-10 md:h-12 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Feedback'
              )}
            </Button>
          </>
        ) : (
          /* Success State */
          <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-md border-0 dark:border-gray-800 overflow-hidden">
            <CardContent className="p-6 md:p-8 lg:p-10 text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-5 lg:mb-6">
                <Check className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 md:mb-3">Thank You!</h2>
              <p className="text-sm md:text-base lg:text-lg text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
                Your feedback has been submitted successfully. We appreciate your input!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AnimatedPage>
  )
}

