import { useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import { ArrowLeft } from "lucide-react"
import { useCompanyName } from "@/lib/hooks/useCompanyName"

export default function TermsAndConditionsPage() {
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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Terms & Conditions</h1>
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
            <h2 className="text-2xl font-bold text-gray-900">Terms and Conditions</h2>
            <p className="text-sm text-gray-600">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h3>
              <p className="mb-3">
                By accessing and using the {companyName} restaurant management platform, you accept and agree to be bound
                by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use
                this service.
              </p>
              <p>
                These Terms and Conditions ("Terms") govern your access to and use of our services, including our website,
                mobile application, and any related services provided by {companyName}.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">2. Account Registration</h3>
              <p className="mb-2">To use our services, you must:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Create an account with accurate, current, and complete information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your password and identification</li>
                <li>Accept all responsibility for activities that occur under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Be at least 18 years old or have parental consent</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">3. Restaurant Services</h3>
              <p className="mb-2">As a restaurant partner, you agree to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Provide accurate menu information, pricing, and availability</li>
                <li>Maintain food quality and safety standards as per local regulations</li>
                <li>Process orders in a timely manner</li>
                <li>Handle customer complaints and refunds according to our policies</li>
                <li>Comply with all applicable food safety and health regulations</li>
                <li>Maintain proper licenses and permits required for food service</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">4. Payment Terms</h3>
              <p className="mb-2">Payment terms include:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Commission fees will be deducted from your earnings as per the agreed rate</li>
                <li>Payments will be processed according to the payment schedule</li>
                <li>You are responsible for all applicable taxes on your earnings</li>
                <li>We reserve the right to hold or delay payments in case of disputes or violations</li>
                <li>Refunds to customers will be processed according to our refund policy</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">5. Prohibited Activities</h3>
              <p className="mb-2">You agree not to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Use the service for any illegal purpose or in violation of any laws</li>
                <li>Post false, misleading, or fraudulent information</li>
                <li>Interfere with or disrupt the service or servers</li>
                <li>Attempt to gain unauthorized access to any portion of the service</li>
                <li>Engage in any activity that could harm our reputation or business</li>
                <li>Use automated systems to access the service without permission</li>
                <li>Violate any intellectual property rights</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">6. Intellectual Property</h3>
              <p>
                The service and its original content, features, and functionality are owned by {companyName} and are protected
                by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not
                reproduce, distribute, modify, or create derivative works of any material found on the service without our
                express written permission.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">7. Limitation of Liability</h3>
              <p className="mb-2">
                To the fullest extent permitted by applicable law, {companyName} shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages, including but not limited to:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Loss of profits, revenue, or business opportunities</li>
                <li>Loss of data or information</li>
                <li>Business interruption</li>
                <li>Personal injury or property damage</li>
              </ul>
              <p className="mt-3">
                Our total liability to you for all claims arising from or related to the use of our services shall not exceed
                the amount you paid to us in the twelve (12) months prior to the claim.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">8. Indemnification</h3>
              <p>
                You agree to defend, indemnify, and hold harmless {companyName} and its officers, directors, employees, and
                agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys'
                fees, arising out of or in any way connected with your access to or use of the service, your violation of
                these Terms, or your violation of any rights of another.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">9. Termination</h3>
              <p className="mb-2">We may terminate or suspend your account and access to the service immediately, without prior notice, if:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>You breach any of these Terms</li>
                <li>You engage in fraudulent or illegal activities</li>
                <li>You fail to comply with food safety regulations</li>
                <li>You provide false or misleading information</li>
                <li>We are required to do so by law</li>
              </ul>
              <p className="mt-3">
                Upon termination, your right to use the service will immediately cease. All provisions of these Terms that by
                their nature should survive termination shall survive termination.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">10. Dispute Resolution</h3>
              <p>
                Any disputes arising out of or relating to these Terms or the service shall be resolved through binding
                arbitration in accordance with the rules of the arbitration association. You agree to waive any right to a
                jury trial and to participate in a class action lawsuit.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">11. Changes to Terms</h3>
              <p>
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide
                at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be
                determined at our sole discretion. Your continued use of the service after any changes constitutes acceptance
                of the new Terms.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">12. Governing Law</h3>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which
                {companyName} operates, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">13. Contact Information</h3>
              <p>
                If you have any questions about these Terms and Conditions, please contact us at:
              </p>
              <p className="mt-2">
                <strong>Email:</strong> legal@tifunbox.com<br />
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

