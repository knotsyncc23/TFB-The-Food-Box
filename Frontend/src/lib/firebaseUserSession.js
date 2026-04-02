import { useSyncExternalStore } from "react"
import { authAPI } from "@/lib/api"
import { ensureFirebaseInitialized, firebaseAuth, getFirebaseAuthConfig } from "@/lib/firebase"
import { getModuleToken, setAuthData } from "@/lib/utils/auth"

const PENDING_PROVIDER_KEY = "pendingSocialProvider"
const APPLE_REDIRECT_IN_PROGRESS_KEY = "appleRedirectInProgress"
const DEFAULT_RESTORE_TIMEOUT_MS = 4000
const IOS_SAFARI_RESTORE_TIMEOUT_MS = 2500

const listeners = new Set()

const state = {
  initialized: false,
  isRestoring: true,
  currentUser: null,
  redirectResultUser: null,
  lastError: null,
  pendingProvider: null,
  authDomain: "",
  hostname: "",
  domainMatches: null,
}

let startPromise = null
let unsubscribeAuthListener = null
let lastCompletedUid = null
let completionPromise = null
let restoreTimeoutId = null

const emit = () => {
  listeners.forEach((listener) => listener())
}

const setState = (partial) => {
  Object.assign(state, partial)
  emit()
}

const isIOSSafariBrowser = () => {
  if (typeof navigator === "undefined") return false

  const userAgent = navigator.userAgent || ""
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent)
  const isWebKit = /WebKit/i.test(userAgent)
  const isCriOS = /CriOS/i.test(userAgent)
  const isFxiOS = /FxiOS/i.test(userAgent)

  return isIOS && isWebKit && !isCriOS && !isFxiOS
}

const getRestoreTimeoutMs = () => (
  isIOSSafariBrowser() ? IOS_SAFARI_RESTORE_TIMEOUT_MS : DEFAULT_RESTORE_TIMEOUT_MS
)

const safeLocalGet = (key) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const safeLocalRemove = (key) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return
    window.localStorage.removeItem(key)
  } catch {}
}

const safeSessionGet = (key) => {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

const safeSessionRemove = (key) => {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return
    window.sessionStorage.removeItem(key)
  } catch {}
}

const getPendingProvider = () => {
  const stored = safeSessionGet(PENDING_PROVIDER_KEY) || safeLocalGet(PENDING_PROVIDER_KEY)
  if (!stored) return null

  try {
    const parsed = JSON.parse(stored)
    return typeof parsed?.provider === "string" ? parsed.provider : stored
  } catch {
    return stored
  }
}

const clearPendingProvider = () => {
  safeSessionRemove(PENDING_PROVIDER_KEY)
  safeSessionRemove(APPLE_REDIRECT_IN_PROGRESS_KEY)
  safeLocalRemove(PENDING_PROVIDER_KEY)
  safeLocalRemove(APPLE_REDIRECT_IN_PROGRESS_KEY)
}

const getProviderFromUser = (user) => {
  return (
    getPendingProvider() ||
    (user?.providerData || [])
      .find((provider) => ["google.com", "apple.com"].includes(provider?.providerId))
      ?.providerId?.replace(".com", "") ||
    null
  )
}

const shouldCompleteBackendLogin = (user) => {
  if (!user) return false
  if (getModuleToken("user")) return false

  const provider = getProviderFromUser(user)
  return provider === "google" || provider === "apple"
}

const completeBackendLoginFromFirebaseUser = async (user, source) => {
  if (!user || !shouldCompleteBackendLogin(user)) return

  const provider = getProviderFromUser(user)
  if (!provider) return

  if (completionPromise) {
    await completionPromise
    return
  }

  if (lastCompletedUid === user.uid && getModuleToken("user")) {
    return
  }

  completionPromise = (async () => {
    console.log("[FirebaseUserSession] Completing backend login from Firebase user", {
      source,
      provider,
      uid: user.uid,
      email: user.email || null,
    })

    const idToken = await user.getIdToken(true)
    const response = await authAPI.firebaseSocialLogin(idToken, "user", provider)
    const payload = response?.data?.data || {}

    if (!payload.accessToken || !payload.user) {
      throw new Error("Firebase social login did not return a valid app session")
    }

    setAuthData("user", payload.accessToken, payload.user)
    clearPendingProvider()
    lastCompletedUid = user.uid
    window.dispatchEvent(new Event("userAuthChanged"))

    if (window.location.hash || window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    console.log("[FirebaseUserSession] Stored restored app session", {
      source,
      provider,
      uid: user.uid,
      hasUserToken: !!getModuleToken("user"),
    })
  })()

  try {
    await completionPromise
  } finally {
    completionPromise = null
  }
}

export function getFirebaseUserSessionSnapshot() {
  return state
}

export function subscribeFirebaseUserSession(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useFirebaseUserSession() {
  return useSyncExternalStore(
    subscribeFirebaseUserSession,
    getFirebaseUserSessionSnapshot,
    getFirebaseUserSessionSnapshot,
  )
}

export async function startFirebaseUserSessionBootstrap() {
  if (startPromise) return startPromise

  startPromise = (async () => {
    if (restoreTimeoutId) {
      clearTimeout(restoreTimeoutId)
      restoreTimeoutId = null
    }

    setState({
      initialized: false,
      isRestoring: true,
      pendingProvider: getPendingProvider(),
      lastError: null,
    })

    const restoreTimeoutMs = getRestoreTimeoutMs()

    console.log("[FirebaseUserSession] Starting bootstrap", {
      path: window.location.pathname,
      search: window.location.search,
      pendingProvider: getPendingProvider(),
      redirectInProgress:
        safeSessionGet(APPLE_REDIRECT_IN_PROGRESS_KEY) === "true" ||
        safeLocalGet(APPLE_REDIRECT_IN_PROGRESS_KEY) === "true",
      restoreTimeoutMs,
      isIOSSafari: isIOSSafariBrowser(),
    })

    restoreTimeoutId = window.setTimeout(() => {
      console.warn("[FirebaseUserSession] Restore bootstrap timed out; allowing app to continue", {
        pendingProvider: getPendingProvider(),
        hasCurrentUser: !!firebaseAuth?.currentUser,
      })
      setState({
        initialized: true,
        isRestoring: false,
      })
      restoreTimeoutId = null
    }, restoreTimeoutMs)

    await ensureFirebaseInitialized()

    const { authDomain } = getFirebaseAuthConfig()
    const hostname = typeof window !== "undefined" ? window.location.hostname : ""
    const domainMatches = authDomain ? authDomain === hostname : null

    setState({
      authDomain,
      hostname,
      domainMatches,
      pendingProvider: getPendingProvider(),
    })

    console.log("[FirebaseUserSession] Firebase domain check", {
      authDomain,
      hostname,
      domainMatches,
    })

    if (!firebaseAuth) {
      setState({
        initialized: true,
        isRestoring: false,
      })
      return
    }

    const { browserLocalPersistence, getRedirectResult, onAuthStateChanged, setPersistence } =
      await import("firebase/auth")

    try {
      await setPersistence(firebaseAuth, browserLocalPersistence)
      console.log("[FirebaseUserSession] Confirmed browserLocalPersistence before restore")
    } catch (error) {
      console.warn("[FirebaseUserSession] Failed to confirm browserLocalPersistence", {
        message: error?.message || "Unknown error",
      })
    }

    if (!unsubscribeAuthListener) {
      unsubscribeAuthListener = onAuthStateChanged(firebaseAuth, async (user) => {
        console.log("[FirebaseUserSession] onAuthStateChanged", {
          uid: user?.uid || null,
          email: user?.email || null,
          pendingProvider: getPendingProvider(),
        })

        setState({
          currentUser: user || null,
          pendingProvider: getPendingProvider(),
        })

        console.log("[FirebaseUserSession] Auth state applied", {
          isRestoring: state.isRestoring,
          hasUser: !!user,
          hasUserToken: !!getModuleToken("user"),
        })

        if (!user) return

        try {
          await completeBackendLoginFromFirebaseUser(user, "auth-state-changed")
        } catch (error) {
          console.error("[FirebaseUserSession] Failed completing backend login from auth state", error)
          setState({
            lastError: error,
          })
        }
      })
    }

    try {
      console.log("[FirebaseUserSession] Checking redirect result after app load", {
        href: window.location.href,
        pendingProvider: getPendingProvider(),
      })

      const redirectResult = await getRedirectResult(firebaseAuth)
      console.log("[FirebaseUserSession] getRedirectResult completed", {
        hasUser: !!redirectResult?.user,
        providerId: redirectResult?.providerId || null,
        user: redirectResult?.user
          ? {
              uid: redirectResult.user.uid,
              email: redirectResult.user.email || null,
            }
          : null,
      })

      setState({
        redirectResultUser: redirectResult?.user || null,
        currentUser: redirectResult?.user || firebaseAuth.currentUser || null,
      })

      if (redirectResult?.user) {
        await completeBackendLoginFromFirebaseUser(redirectResult.user, "redirect-result")
      } else if (firebaseAuth.currentUser) {
        await completeBackendLoginFromFirebaseUser(firebaseAuth.currentUser, "current-user")
      }
    } catch (error) {
      console.error("[FirebaseUserSession] getRedirectResult failed", error)
      setState({
        lastError: error,
      })
    } finally {
      if (restoreTimeoutId) {
        clearTimeout(restoreTimeoutId)
        restoreTimeoutId = null
      }
      setState({
        initialized: true,
        isRestoring: false,
        pendingProvider: getPendingProvider(),
      })
      console.log("[FirebaseUserSession] Bootstrap resolved", {
        isRestoring: false,
        hasCurrentUser: !!(state.currentUser || firebaseAuth?.currentUser),
        hasRedirectUser: !!state.redirectResultUser,
        hasUserToken: !!getModuleToken("user"),
        pendingProvider: getPendingProvider(),
      })
    }
  })()

  return startPromise
}
