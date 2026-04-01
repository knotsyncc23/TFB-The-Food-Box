import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { setAuthData } from "@/lib/utils/auth"
import { registerFcmTokenForLoggedInUser } from "@/lib/notifications/fcmWeb"
import { authAPI } from "@/lib/api"
import { firebaseAuth, ensureFirebaseInitialized } from "@/lib/firebase"

const redirectToUserHome = () => {
  window.location.replace("/")
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState("loading") // "loading", "success", "error"
  const [error, setError] = useState("")
  const [provider, setProvider] = useState("")

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get provider from URL params
        const providerParam =
          searchParams.get("provider") ||
          (window.location.pathname.includes("/auth/apple/callback") ? "apple" : "google")
        setProvider(providerParam)

        // Get OAuth parameters from URL
        const code = searchParams.get("code")
        const errorParam = searchParams.get("error")
        const state = searchParams.get("state")

        // Check for OAuth errors
        if (errorParam) {
          setStatus("error")
          setError(
            errorParam === "access_denied"
              ? "You denied access to your account. Please try again."
              : "Authentication failed. Please try again."
          )
          return
        }

        // Complete Firebase redirect flows for Apple/Google when the provider
        // sends the browser to this callback route.
        try {
          const { getRedirectResult } = await import("firebase/auth")
          await ensureFirebaseInitialized()

          let firebaseUser = null

          if (firebaseAuth) {
            const result = await Promise.race([
              getRedirectResult(firebaseAuth),
              new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
            ])
            firebaseUser = result?.user || firebaseAuth.currentUser || null
          }

          if (firebaseUser) {
            const idToken = await firebaseUser.getIdToken(true)
            const response = await authAPI.firebaseSocialLogin(
              idToken,
              "user",
              providerParam,
            )
            const data = response?.data?.data || {}

            if (!data.accessToken || !data.user) {
              throw new Error("Invalid response from server while completing social login")
            }

            setAuthData("user", data.accessToken, data.user)
            window.dispatchEvent(new Event("userAuthChanged"))
            registerFcmTokenForLoggedInUser().catch(() => {})

            setStatus("success")
            setTimeout(() => {
              redirectToUserHome()
            }, 800)
            return
          }
        } catch (firebaseError) {
          console.error("Firebase callback completion failed:", firebaseError)
        }

        // Check for direct token from backend (Backend OAuth flow)
        const token = searchParams.get("token")
        const userStr = searchParams.get("user")

        if (token) {
          try {
            const user = userStr ? JSON.parse(userStr) : null

            // Save auth data
            setAuthData("user", token, user)

            // Notify app of auth change
            window.dispatchEvent(new Event("userAuthChanged"))

            // Register FCM token for push notifications
            registerFcmTokenForLoggedInUser().catch(() => {})

            setStatus("success")

            // Redirect to home after short delay
            setTimeout(() => {
              redirectToUserHome()
            }, 1000)
            return
          } catch (err) {
            console.error("Error processing token from URL:", err)
            throw new Error("Invalid user data received from server")
          }
        }

        // Do not fake a successful login if we have no real auth payload.
        if (!code) {
          setStatus("error")
          setError("Authentication did not return a valid session. Please try again.")
          return
        }

        // In a real app, exchange code for tokens
        // This is a simplified version
        setStatus("loading")

        // Simulate API call to exchange code for tokens
        const response = await fetch("/api/auth/oauth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            provider: providerParam,
            state,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to authenticate")
        }

        const data = await response.json()

        // Store auth tokens (in a real app, use secure storage)
        if (data.token) {
          localStorage.setItem("authToken", data.token)
        }
        if (data.user) {
          localStorage.setItem("userProfile", JSON.stringify(data.user))
        }

        setStatus("success")

        // Redirect to home
        setTimeout(() => {
          redirectToUserHome()
        }, 1500)
      } catch (err) {
        setStatus("error")
        setError(
          err.message || "An error occurred during authentication. Please try again."
        )
      }
    }

    handleAuthCallback()
  }, [navigate, searchParams])

  const handleRetry = () => {
    navigate("/user/auth/sign-in")
  }

  const handleGoHome = () => {
    navigate("/user")
  }

  return (
    <AnimatedPage className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50/30 via-white to-orange-50/20 dark:from-gray-900 dark:via-[#0a0a0a] dark:to-gray-900 p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
      <Card className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl shadow-xl dark:shadow-2xl border-0 md:border md:border-gray-200 dark:md:border-gray-800">
        <CardHeader className="text-center space-y-2 md:space-y-3 lg:space-y-4 p-6 md:p-8 lg:p-10">
          <CardTitle className="text-2xl md:text-3xl lg:text-4xl font-bold text-black dark:text-white">
            {status === "loading" && "Authenticating..."}
            {status === "success" && "Authentication Successful!"}
            {status === "error" && "Authentication Failed"}
          </CardTitle>
          <CardDescription className="text-base md:text-lg text-gray-600 dark:text-gray-400">
            {status === "loading" && `Signing you in with ${provider || "your account"}...`}
            {status === "success" && "You've been successfully signed in."}
            {status === "error" && "We couldn't complete the authentication process."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 md:space-y-8 p-6 md:p-8 lg:p-10 pt-0 md:pt-0 lg:pt-0">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-8 md:py-12 space-y-4 md:space-y-6">
              <Loader2 className="h-12 w-12 md:h-16 md:w-16 text-[#E23744] animate-spin" />
              <p className="text-sm md:text-base text-muted-foreground text-center">
                Please wait while we verify your credentials...
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center justify-center py-8 md:py-12 space-y-4 md:space-y-6">
              <div className="relative">
                <CheckCircle2 className="h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24 text-red-500 animate-in fade-in zoom-in duration-500" />
              </div>
              <div className="text-center space-y-2 md:space-y-3">
                <h3 className="text-xl md:text-2xl lg:text-3xl font-semibold text-red-600 dark:text-red-400">
                  Welcome!
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Redirecting you to the home page...
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center py-8 md:py-12 space-y-4 md:space-y-6">
              <div className="relative">
                <XCircle className="h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24 text-red-500 animate-in fade-in zoom-in duration-500" />
              </div>
              <div className="text-center space-y-2 md:space-y-3 w-full">
                <h3 className="text-xl md:text-2xl lg:text-3xl font-semibold text-red-600 dark:text-red-400">
                  Something went wrong
                </h3>
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 p-4 md:p-5 rounded-lg text-sm md:text-base text-red-700 dark:text-red-400 max-w-sm mx-auto border border-red-200 dark:border-red-800">
                    <AlertCircle className="h-4 w-4 md:h-5 md:w-5 mt-0.5 flex-shrink-0" />
                    <p className="text-left">{error}</p>
                  </div>
                )}
                <p className="text-sm md:text-base text-muted-foreground">
                  Please try signing in again or use a different method.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full pt-4 md:pt-6">
                <Button
                  variant="outline"
                  onClick={handleGoHome}
                  className="flex-1 h-11 md:h-12 text-base md:text-lg border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  Go Home
                </Button>
                <Button
                  onClick={handleRetry}
                  className="flex-1 h-11 md:h-12 text-base md:text-lg bg-[#E23744] hover:bg-[#d32f3d] text-white transition-all hover:shadow-lg active:scale-[0.98]"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {status === "loading" && (
            <div className="text-center text-xs md:text-sm text-muted-foreground pt-4 md:pt-6 border-t border-gray-200 dark:border-gray-800">
              <p>This may take a few seconds...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </AnimatedPage>
  )
}
