import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react"
import { deliveryAPI } from "@/lib/api"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function CreateSupportTicket() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    category: "other",
    priority: "medium"
  })
  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required"
    } else if (formData.subject.trim().length < 3) {
      newErrors.subject = "Subject must be at least 3 characters"
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required"
    } else if (formData.description.trim().length < 10) {
      newErrors.description = "Description must be at least 10 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" })
    }
  }

  const handleCreateTicket = async () => {
    if (!validateForm()) {
      toast.error("Please fix the errors in the form")
      return
    }

    try {
      setCreating(true)

      // Prepare request data
      const requestData = {
        subject: formData.subject.trim(),
        description: formData.description.trim()
      }

      // Only include category and priority if they have valid values
      if (formData.category && formData.category !== '') {
        requestData.category = formData.category
      }
      if (formData.priority && formData.priority !== '') {
        requestData.priority = formData.priority
      }

      console.log('Sending ticket creation request:', requestData)

      const response = await deliveryAPI.createSupportTicket(requestData)

      if (response?.data?.success) {
        toast.success("Ticket created successfully!")
        navigate("/delivery/help/tickets", { replace: true })
      } else {
        toast.error(response?.data?.message || "Failed to create ticket")
      }
    } catch (error) {
      console.error("Error creating ticket:", error)
      console.error("Error response:", error?.response?.data)
      console.error("Request data:", {
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: formData.priority
      })

      // Show detailed error message
      let errorMessage = "Failed to create ticket"
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error?.message) {
        errorMessage = error.message
      }

      // If validation error, show field-specific errors
      if (error?.response?.data?.errors) {
        const validationErrors = error.response.data.errors
        const newErrors = {}

        // Handle array format: [{ field: 'subject', message: '...' }]
        if (Array.isArray(validationErrors)) {
          validationErrors.forEach(err => {
            if (err.field === 'subject') {
              newErrors.subject = err.message
            } else if (err.field === 'description') {
              newErrors.description = err.message
            }
          })
        } else {
          // Handle object format: { subject: '...', description: '...' }
          if (validationErrors.subject) {
            newErrors.subject = validationErrors.subject
          }
          if (validationErrors.description) {
            newErrors.description = validationErrors.description
          }
        }

        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors)
          errorMessage = "Please fix the validation errors"
        }
      }

      toast.error(errorMessage)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Create New Ticket</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Subject Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.subject}
              onChange={(e) => handleInputChange("subject", e.target.value)}
              placeholder="Enter ticket subject"
              maxLength={200}
              className={`w-full ${errors.subject ? "border-red-500" : ""}`}
            />
            {errors.subject && (
              <p className="text-xs text-red-500 mt-1">{errors.subject}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {formData.subject.length}/200 characters
            </p>
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-600 mb-2">
              Describe your issue in detail (minimum 10 characters)
            </p>
            <Textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Please provide as much detail as possible so we can help you faster..."
              rows={8}
              maxLength={2000}
              className={`w-full px-4 py-3 bg-white border-2 rounded-xl transition-all resize-none ${errors.description
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-200 focus:border-black focus:ring-black"
                }`}
            />
            {errors.description && (
              <p className="text-xs text-red-500 mt-1">{errors.description}</p>
            )}
            <p className="text-xs text-gray-500 mt-1.5">
              {formData.description.length}/2000 characters
            </p>
          </div>

          {/* Category and Priority Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <div className="relative">
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange("category", e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none cursor-pointer"
                >
                  <option value="other">Other</option>
                  <option value="payment">Payment</option>
                  <option value="account">Account</option>
                  <option value="technical">Technical</option>
                  <option value="order">Order</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <div className="relative">
                <select
                  value={formData.priority}
                  onChange={(e) => handleInputChange("priority", e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none cursor-pointer"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleCreateTicket}
              disabled={creating || !formData.subject.trim() || formData.description.trim().length < 10}
              className="w-full sm:w-auto px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Ticket"
              )}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-6 py-3 bg-white text-gray-700 border border-gray-300 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

