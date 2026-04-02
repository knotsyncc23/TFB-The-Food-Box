import { useEffect, useSyncExternalStore } from "react"
import { Navigate } from "react-router-dom"
import { isModuleAuthenticated } from "@/lib/utils/auth"
import Loader from "@/components/Loader"
import { useFirebaseUserSession } from "@/lib/firebaseUserSession"

const subscribeToAuthChanges = (listener) => {
  const events = ["storage", "userAuthChanged", "userLogout"]
  events.forEach((eventName) => window.addEventListener(eventName, listener))

  return () => {
    events.forEach((eventName) => window.removeEventListener(eventName, listener))
  }
}

const getAuthSnapshot = (module) => isModuleAuthenticated(module)

/**
 * AuthRedirect Component
 * Redirects authenticated users away from auth pages to their module's home page
 * Only shows auth pages to unauthenticated users
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Auth page component to render if not authenticated
 * @param {string} props.module - Module name (user, restaurant, delivery, admin)
 * @param {string} props.redirectTo - Path to redirect to if authenticated (optional, defaults to module home)
 */
export default function AuthRedirect({ children, module, redirectTo = null }) {
  const firebaseUserSession = useFirebaseUserSession()
  const isAuthenticated = useSyncExternalStore(
    subscribeToAuthChanges,
    () => getAuthSnapshot(module),
    () => getAuthSnapshot(module),
  )

  const shouldWaitForFirebaseRestore =
    module === "user" &&
    !isAuthenticated &&
    firebaseUserSession.isRestoring &&
    !!(
      firebaseUserSession.pendingProvider ||
      firebaseUserSession.currentUser ||
      firebaseUserSession.redirectResultUser
    )

  // Define default home pages for each module
  const moduleHomePages = {
    user: "/",
    restaurant: "/restaurant",
    delivery: "/delivery",
    admin: "/admin",
  }

  useEffect(() => {
    console.log("[AuthRedirect] State update", {
      module,
      isAuthenticated,
      isRestoring: firebaseUserSession.isRestoring,
      hasCurrentUser: !!firebaseUserSession.currentUser,
      hasRedirectUser: !!firebaseUserSession.redirectResultUser,
      loadingScreen: shouldWaitForFirebaseRestore,
    })
  }, [
    firebaseUserSession.currentUser,
    firebaseUserSession.isRestoring,
    firebaseUserSession.redirectResultUser,
    isAuthenticated,
    module,
    shouldWaitForFirebaseRestore,
  ])

  if (shouldWaitForFirebaseRestore) {
    return <Loader />
  }

  if (isAuthenticated) {
    const homePath = redirectTo || moduleHomePages[module] || "/"
    console.log("[AuthRedirect] Redirecting authenticated user", {
      module,
      homePath,
      isRestoring: firebaseUserSession.isRestoring,
    })
    return <Navigate to={homePath} replace />
  }

  return <>{children}</>
}
