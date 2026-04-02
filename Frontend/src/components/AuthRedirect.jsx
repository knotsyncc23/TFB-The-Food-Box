import { Navigate } from "react-router-dom"
import { isModuleAuthenticated } from "@/lib/utils/auth"
import Loader from "@/components/Loader"
import { useFirebaseUserSession } from "@/lib/firebaseUserSession"

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

  if (module === "user" && firebaseUserSession.isRestoring) {
    return <Loader />
  }

  // Check if user is authenticated for this module
  const isAuthenticated = isModuleAuthenticated(module)

  // Define default home pages for each module
  const moduleHomePages = {
    user: "/",
    restaurant: "/restaurant",
    delivery: "/delivery",
    admin: "/admin",
  }

  // If authenticated, redirect to module home page
  if (isAuthenticated) {
    const homePath = redirectTo || moduleHomePages[module] || "/"
    return <Navigate to={homePath} replace />
  }

  // If not authenticated, show the auth page
  return <>{children}</>
}

