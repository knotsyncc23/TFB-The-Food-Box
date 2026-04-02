import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { adminAPI } from "@/lib/api"
import { setAuthData, isModuleAuthenticated } from "@/lib/utils/auth"
import { loadBusinessSettings } from "@/lib/utils/businessSettings"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff } from "lucide-react"
import { DEFAULT_LOGO_PLACEHOLDER } from "@/lib/constants/defaultLogo"

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO_PLACEHOLDER)

  // Redirect to admin dashboard if already authenticated
  useEffect(() => {
    if (isModuleAuthenticated("admin")) {
      navigate("/admin", { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch business settings logo on mount
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const settings = await loadBusinessSettings()
        if (settings?.logo?.url) {
          setLogoUrl(settings.logo.url)
        }
      } catch (error) {
        // Silently fail and use default logo
        console.warn("Failed to load business settings logo:", error)
      }
    }
    fetchLogo()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Simple validation
    if (!email.trim() || !password) {
      setError("Email and password are required")
      setIsLoading(false)
      return
    }

    try {
      // Use admin-specific login endpoint
      const response = await adminAPI.login(email, password)
      const data = response?.data?.data || response?.data

      if (data.accessToken && data.admin) {
        // Store admin token and data
        setAuthData("admin", data.accessToken, data.admin)

        // Navigate to admin dashboard after successful login
        navigate("/admin", { replace: true })
      } else {
        throw new Error("Login failed. Please try again.")
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Login failed. Please check your credentials."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-neutral-50 via-gray-100 to-white relative">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-neutral-900/5 blur-3xl" />
        <div className="absolute right-[-80px] bottom-[-80px] h-72 w-72 rounded-full bg-gray-700/5 blur-3xl" />
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg bg-white/90 backdrop-blur border-neutral-200 shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex w-full items-center gap-4 sm:gap-5">
              <div className="flex h-14 w-28 shrink-0 items-center justify-center rounded-xl bg-gray-900/5 ring-1 ring-neutral-200">
                {logoUrl && logoUrl !== DEFAULT_LOGO_PLACEHOLDER && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-10 w-24 object-contain"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <CardTitle className="text-3xl leading-tight text-gray-900">Admin Login</CardTitle>
                <CardDescription className="text-base text-gray-600">
                  Sign in to access the admin dashboard.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium text-gray-900">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="off"
                  required
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-medium text-gray-900">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    required
                    className="h-12 pr-12 text-base [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-800"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>



              <Button
                type="submit"
                className="h-12 w-full bg-black text-white transition-colors hover:bg-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex-col items-start gap-2 text-sm text-gray-500">
            <span>Secure sign-in helps protect admin tools.</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

