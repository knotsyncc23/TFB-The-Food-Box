import { useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import { ArrowLeft } from "lucide-react"
import { useCompanyName } from "@/lib/hooks/useCompanyName"

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()
  const companyName = useCompanyName()

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Privacy Policy</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6"
        >
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Privacy Policy</h2>
            <p className="text-sm text-gray-600">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Introduction</h3>
              <p className="mb-3">
                Welcome to {companyName}. We are committed to protecting your personal information and your right to privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our
                restaurant management platform and services.
              </p>
              <p>
                Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy,
                please do not access or use our services.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">2. Information We Collect</h3>
              <p className="mb-2">We collect information that you provide directly to us, including:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Account information (name, email address, phone number, password)</li>
                <li>Restaurant details (name, address, cuisine type, operating hours)</li>
                <li>Payment information (billing address, payment method details)</li>
                <li>Order and transaction history</li>
                <li>Customer reviews and ratings</li>
                <li>Communication data (messages, customer inquiries)</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">3. How We Use Your Information</h3>
              <p className="mb-2">We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Process and manage your orders and transactions</li>
                <li>Send you technical notices, updates, and support messages</li>
                <li>Respond to your comments, questions, and requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
                <li>Detect, prevent, and address technical issues and fraudulent activities</li>
                <li>Personalize and improve your experience</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">4. Information Sharing and Disclosure</h3>
              <p className="mb-2">We may share your information in the following situations:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>With Service Providers:</strong> We may share your information with third-party vendors who perform services on our behalf</li>
                <li><strong>For Business Transfers:</strong> We may share or transfer your information in connection with any merger, sale of assets, or acquisition</li>
                <li><strong>With Your Consent:</strong> We may disclose your information for any other purpose with your consent</li>
                <li><strong>For Legal Reasons:</strong> We may disclose information if required by law or in response to valid requests by public authorities</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">5. Data Security</h3>
              <p>
                We implement appropriate technical and organizational security measures to protect your personal information.
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive
                to use commercially acceptable means to protect your information, we cannot guarantee its absolute security.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">6. Your Privacy Rights</h3>
              <p className="mb-2">Depending on your location, you may have the following rights:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Access and receive a copy of your personal data</li>
                <li>Rectify inaccurate or incomplete data</li>
                <li>Request deletion of your personal data</li>
                <li>Object to processing of your personal data</li>
                <li>Request restriction of processing your personal data</li>
                <li>Data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">7. Cookies and Tracking Technologies</h3>
              <p>
                We use cookies and similar tracking technologies to track activity on our platform and hold certain information.
                You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you
                do not accept cookies, you may not be able to use some portions of our service.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">8. Children's Privacy</h3>
              <p>
                Our services are not intended for individuals under the age of 18. We do not knowingly collect personal
                information from children. If you become aware that a child has provided us with personal information,
                please contact us, and we will take steps to delete such information.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">9. Changes to This Privacy Policy</h3>
              <p>
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new
                Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy
                Policy periodically for any changes.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">10. Contact Us</h3>
              <p>
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <p className="mt-2">
                <strong>Email:</strong> privacy@tifunbox.com<br />
                <strong>Phone:</strong> +91 (555) 123-4567<br />
                <strong>Address:</strong> India
              </p>
            </section>
          </div>
        </motion.div>
      </div>

    </div>
  )
}

