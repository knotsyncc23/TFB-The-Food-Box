import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { ArrowLeft, Mail, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import AnimatedPage from "../../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function ContactUs() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [pageData, setPageData] = useState({
    title: 'Contact Us',
    content: '<p>Loading...</p>'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await api.get(API_ENDPOINTS.ADMIN.CONTACT_US_PUBLIC)
      if (response.data.success) {
        setPageData(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching contact page:', error)
      setPageData({
        title: 'Contact Us',
        content: '<p>Unable to load contact information at the moment. Please try again later.</p>'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0a0a] dark:to-[#1a1a1a]">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600 dark:text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0a0a] dark:to-[#1a1a1a]">
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 p-0 hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-gray-900 dark:text-white" />
          </Button>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">Contact Us</h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-6 md:p-8 lg:p-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <Mail className="h-6 w-6 md:h-7 md:w-7 text-red-600 dark:text-red-400" />
            {pageData.title}
          </h2>
          <div
            className="prose prose-slate dark:prose-invert max-w-none
              prose-headings:text-gray-900 dark:prose-headings:text-white
              prose-p:text-gray-700 dark:prose-p:text-gray-300
              prose-strong:text-gray-900 dark:prose-strong:text-white
              prose-ul:text-gray-700 dark:prose-ul:text-gray-300
              prose-ol:text-gray-700 dark:prose-ol:text-gray-300
              prose-li:text-gray-700 dark:prose-li:text-gray-300
              prose-a:text-red-600 dark:prose-a:text-red-400
              prose-a:no-underline hover:prose-a:underline
              leading-relaxed"
            dangerouslySetInnerHTML={{ __html: pageData.content }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-center mt-8 mb-4"
        >
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </motion.div>
      </div>
    </AnimatedPage>
  )
}
