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
import { resolveFirebaseRedirectUser } from "@/lib/utils/firebaseRedirectRecovery"
import { appendAppleDebugLog, getAppleDebugLog } from "@/lib/utils/appleDebugLog"

const logAppleCallback = (message, details = null) => {
  appendAppleDebugLog(message, details)
  if (details) {
    console.log(`[AppleCallback] ${message}`, details)
    return
  }
  console.log(`[AppleCallback] ${message}`)
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const redirectToUserHome = () => {
    navigate("/", { replace: true })
  }
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState("loading") // "loading", "success", "error"
  const [error, setError] = useState("")
  const [provider, setProvider] = useState("")
  const [appleDebugEntries, setAppleDebugEntries] = useState(() => getAppleDebugLog())

  useEffect(() => {
    const syncAppleLogs = () => {
      setAppleDebugEntries(getAppleDebugLog())
    }

    const handleAuthCallback = async () => {
      try {
        syncAppleLogs()
        // Get provider from URL params
        const providerParam =
          searchParams.get("provider") ||
          (window.location.pathname.includes("apple") || searchParams.has("id_token") ? "apple" : "google")
        setProvider(providerParam)
        if (providerParam === "apple") {
          logAppleCallback("Callback handler started", {
            path: window.location.pathname,
            search: window.location.search,
          })
        }

        // Get OAuth parameters from URL
        const code = searchParams.get("code")
        const errorParam = searchParams.get("error")
        const state = searchParams.get("state")

        // Check for OAuth errors
        if (errorParam) {
          if (providerParam === "apple") {
            logAppleCallback("Apple callback returned OAuth error", {
              error: errorParam,
            })
          }
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
          let redirectSource = null

          if (firebaseAuth) {
            const redirectResolution = await resolveFirebaseRedirectUser(
              firebaseAuth,
              getRedirectResult,
              {
                timeoutMs: providerParam === "apple" ? 25000 : 12000,
                pollIntervalMs: 600,
                shouldLog: providerParam === "apple",
                logLabel: "AppleCallback",
              },
            )
            firebaseUser = redirectResolution?.user || null
            redirectSource = redirectResolution?.source || null
            if (providerParam === "apple") {
              logAppleCallback("Checked Firebase redirect result", {
                redirectSource,
                hasCurrentUser: !!firebaseAuth.currentUser,
                resolvedUser: !!firebaseUser,
                error: redirectResolution?.error?.message || null,
              })
            }
          }

          if (firebaseUser) {
            const idToken = await firebaseUser.getIdToken(true)
            if (providerParam === "apple") {
              logAppleCallback("Got Firebase user during Apple callback", {
                uid: firebaseUser.uid,
                email: firebaseUser.email || null,
                hasIdToken: !!idToken,
                idTokenLength: idToken?.length || 0,
              })
            }
            const response = await authAPI.firebaseSocialLogin(
              idToken,
              "user",
              providerParam,
            )
            const data = response?.data?.data || {}
            if (providerParam === "apple") {
              logAppleCallback("Backend social login finished", {
                hasAccessToken: !!data.accessToken,
                hasUser: !!data.user,
                role: data.user?.role || null,
              })
            }

            if (!data.accessToken || !data.user) {
              throw new Error("Invalid response from server while completing social login")
            }

            setAuthData("user", data.accessToken, data.user)
            if (providerParam === "apple") {
              logAppleCallback("Stored access token from Apple callback", {
                localToken: !!localStorage.getItem("user_accessToken"),
                sessionToken: !!sessionStorage.getItem("user_accessToken"),
              })
            }
            window.dispatchEvent(new Event("userAuthChanged"))
            registerFcmTokenForLoggedInUser().catch(() => {})

            setStatus("success")
            setTimeout(() => {
              if (providerParam === "apple") {
                logAppleCallback("Redirecting to home after Apple callback success")
                syncAppleLogs()
              }
              redirectToUserHome()
            }, 800)
            return
          }
        } catch (firebaseError) {
          console.error("Firebase callback completion failed:", firebaseError)
          if (providerParam === "apple") {
            logAppleCallback("Firebase callback completion failed", {
              message: firebaseError?.message || "Unknown error",
              code: firebaseError?.code || null,
            })
          }
        }

        // Check for direct token from backend (Backend OAuth flow)
        const token = searchParams.get("token")
        const userStr = searchParams.get("user")

        if (token) {
          try {
            const user = userStr ? JSON.parse(userStr) : null

            // Save auth data
            setAuthData("user", token, user)
            if (providerParam === "apple") {
              logAppleCallback("Stored token from direct backend callback", {
                hasUser: !!user,
                localToken: !!localStorage.getItem("user_accessToken"),
                sessionToken: !!sessionStorage.getItem("user_accessToken"),
              })
            }

            // Notify app of auth change
            window.dispatchEvent(new Event("userAuthChanged"))

            // Register FCM token for push notifications
            registerFcmTokenForLoggedInUser().catch(() => {})

            setStatus("success")

            // Redirect to home after short delay
            setTimeout(() => {
              if (providerParam === "apple") {
                logAppleCallback("Redirecting to home after direct Apple callback success")
                syncAppleLogs()
              }
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
          if (providerParam === "apple") {
            logAppleCallback("Apple callback ended without code or token", {
              search: window.location.search,
            })
          }
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
        if (provider === "apple" || window.location.pathname.includes("/auth/apple/callback")) {
          logAppleCallback("Unhandled callback error", {
            message: err?.message || "Unknown error",
          })
          syncAppleLogs()
        }
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
                {provider === "apple" && appleDebugEntries.length > 0 && (
                  <div className="mx-auto mt-4 max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-3 text-left dark:border-amber-900 dark:bg-amber-950/40">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                        Apple Debug
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAppleDebugEntries(getAppleDebugLog())}
                        className="h-auto px-2 py-1 text-[11px] text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                      >
                        Refresh
                      </Button>
                    </div>
                    <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                      {appleDebugEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-md bg-white/70 p-2 text-[11px] text-amber-950 dark:bg-black/20 dark:text-amber-100"
                        >
                          <p className="font-medium">{entry.message}</p>
                          {entry.details && (
                            <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-amber-800 dark:text-amber-200">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
