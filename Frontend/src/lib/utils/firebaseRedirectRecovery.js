const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function resolveFirebaseRedirectUser(firebaseAuth, getRedirectResult, options = {}) {
  const {
    timeoutMs = 20000,
    pollIntervalMs = 500,
    shouldLog = false,
    logLabel = "FirebaseRedirect",
  } = options

  const startedAt = Date.now()
  let lastError = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await getRedirectResult(firebaseAuth)
      if (result?.user) {
        if (shouldLog) {
          console.log(`[${logLabel}] Resolved user from redirect result`, {
            uid: result.user.uid,
            email: result.user.email || null,
          })
        }
        return { user: result.user, source: "redirect-result" }
      }
    } catch (error) {
      lastError = error
      if (shouldLog) {
        console.log(`[${logLabel}] getRedirectResult retryable error`, {
          code: error?.code || null,
          message: error?.message || "Unknown error",
        })
      }
    }

    if (firebaseAuth?.currentUser) {
      if (shouldLog) {
        console.log(`[${logLabel}] Resolved user from currentUser`, {
          uid: firebaseAuth.currentUser.uid,
          email: firebaseAuth.currentUser.email || null,
        })
      }
      return { user: firebaseAuth.currentUser, source: "current-user" }
    }

    await sleep(pollIntervalMs)
  }

  return {
    user: null,
    source: null,
    error: lastError,
  }
}
