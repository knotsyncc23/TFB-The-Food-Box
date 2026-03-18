/* eslint-env serviceworker */
/* global firebase, importScripts */
// FCM service worker - must stay in public/ and use importScripts (no ES modules)
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

    if (firebaseConfig.projectId && firebaseConfig.appId) {
      if (!firebase.apps?.length) {
        firebase.initializeApp(firebaseConfig);
      }
      firebase.messaging().setBackgroundMessageHandler((payload) => {
        const title = payload.notification?.title || "Notification";
        const options = {
          body: payload.notification?.body || "",
          icon: payload.notification?.icon || "/favicon.ico",
        };
        return self.registration.showNotification(title, options);
      });
    }
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

async function initFirebase() {
  try {
    const res = await fetch("/firebase-config.json");
    if (res.ok) {
      const data = await res.json();
      firebaseConfig.apiKey = data.apiKey || "";
      firebaseConfig.authDomain = data.authDomain || "";
      firebaseConfig.projectId = data.projectId || "";
      firebaseConfig.storageBucket = data.storageBucket || "";
      firebaseConfig.messagingSenderId = data.messagingSenderId || "";
      firebaseConfig.appId = data.appId || "";
    }
  } catch {
    // Ignore config fetch failure
  }
  if (firebaseConfig.projectId && firebaseConfig.appId) {
    firebase.initializeApp(firebaseConfig);
    firebase.messaging().setBackgroundMessageHandler((payload) => {
      const title = payload.notification?.title || "Notification";
      const options = {
        body: payload.notification?.body || "",
        icon: payload.notification?.icon || "/favicon.ico",
      };
      return self.registration.showNotification(title, options);
    });
  }
}

initFirebase();
