/**
 * Flutter <-> Web bridge helper for Google Sign-In inside WebView.
 *
 * Expected Flutter handler:
 *   window.flutter_inappwebview.callHandler("nativeGoogleSignIn")
 * Should resolve to something like:
 *   { success: true, idToken: "..." }
 *
 * If the bridge is not present, we return a safe failure object.
 */

export function hasFlutterGoogleBridge() {
  return (
    typeof window !== "undefined" &&
    window.flutter_inappwebview &&
    typeof window.flutter_inappwebview.callHandler === "function"
  );
}

export async function nativeGoogleSignIn() {
  if (!hasFlutterGoogleBridge()) {
    return { success: false, reason: "no_flutter_bridge" };
  }

  try {
    // Call with no args for maximum Flutter compatibility.
    // Flutter should open Google sign-in and resolve with idToken.
    const result = await window.flutter_inappwebview.callHandler(
      "nativeGoogleSignIn",
    );
    return result || { success: false, reason: "empty_result" };
  } catch (error) {
    console.error("[FlutterGoogleAuthBridge] callHandler failed:", error);
    return { success: false, error };
  }
}

