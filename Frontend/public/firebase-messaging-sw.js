/* global firebase, importScripts */
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

let backgroundHandlerAttached = false;

function attachBackgroundHandler() {
  if (backgroundHandlerAttached) return;
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    showNotificationFromPayload(payload);
  });
  backgroundHandlerAttached = true;
}

function showNotificationFromPayload(payload) {
  // If FCM includes a `notification` payload, the platform often displays it — avoid double notifications (bakalacart pattern)
  if (payload?.notification) {
    return undefined;
  }

  const title = payload?.data?.title || "The Food Box";
  const body = payload?.data?.body || "";
  const icon = payload?.data?.icon || "/favicon.ico";
  const tag = payload?.data?.tag || payload?.data?.orderId || "tfb-notification";

  return self.registration.showNotification(title, {
    body,
    icon,
    badge: "/favicon.ico",
    tag,
    data: payload?.data || {},
    requireInteraction: false,
    vibrate: [200, 100, 200],
  });
}

function tryInitFromConfig() {
  if (!firebaseConfig.projectId || !firebaseConfig.appId) return false;
  if (!firebase.apps?.length) {
    firebase.initializeApp(firebaseConfig);
  }
  attachBackgroundHandler();
  return true;
}

self.addEventListener("message", (event) => {
  try {
    const data = event?.data;
    if (data?.type !== "FIREBASE_CONFIG") return;
    const cfg = data?.payload || {};
    firebaseConfig.apiKey = cfg.apiKey || firebaseConfig.apiKey;
    firebaseConfig.authDomain = cfg.authDomain || firebaseConfig.authDomain;
    firebaseConfig.projectId = cfg.projectId || firebaseConfig.projectId;
    firebaseConfig.storageBucket = cfg.storageBucket || firebaseConfig.storageBucket;
    firebaseConfig.messagingSenderId =
      cfg.messagingSenderId || firebaseConfig.messagingSenderId;
    firebaseConfig.appId = cfg.appId || firebaseConfig.appId;
    tryInitFromConfig();
  } catch {
    // ignore
  }
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function loadConfigFromApi() {
  try {
    const response = await fetch("/api/env/public", { cache: "no-store" });
    if (!response.ok) return false;
    const json = await response.json();
    const cfg = json?.data || {};
    firebaseConfig.apiKey = cfg.FIREBASE_API_KEY || "";
    firebaseConfig.authDomain = cfg.FIREBASE_AUTH_DOMAIN || "";
    firebaseConfig.projectId = cfg.FIREBASE_PROJECT_ID || "";
    firebaseConfig.storageBucket = cfg.FIREBASE_STORAGE_BUCKET || "";
    firebaseConfig.messagingSenderId = cfg.FIREBASE_MESSAGING_SENDER_ID || "";
    firebaseConfig.appId = cfg.FIREBASE_APP_ID || "";
    return true;
  } catch {
    return false;
  }
}

async function loadConfigFromStaticFile() {
  try {
    const response = await fetch("/firebase-config.json", { cache: "no-store" });
    if (!response.ok) return false;
    const data = await response.json();
    firebaseConfig.apiKey = data.apiKey || firebaseConfig.apiKey;
    firebaseConfig.authDomain = data.authDomain || firebaseConfig.authDomain;
    firebaseConfig.projectId = data.projectId || firebaseConfig.projectId;
    firebaseConfig.storageBucket = data.storageBucket || firebaseConfig.storageBucket;
    firebaseConfig.messagingSenderId =
      data.messagingSenderId || firebaseConfig.messagingSenderId;
    firebaseConfig.appId = data.appId || firebaseConfig.appId;
    return true;
  } catch {
    return false;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.link || data.click_action || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});

(async function bootstrap() {
  await loadConfigFromApi();
  if (!tryInitFromConfig()) {
    await loadConfigFromStaticFile();
    tryInitFromConfig();
  }
})();
