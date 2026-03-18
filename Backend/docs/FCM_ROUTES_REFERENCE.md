# FCM Routes Reference (refFcm Token – Mobile & Web)

**Base URL:** `https://app.tifunbox.com/api`

All FCM-related routes and login endpoints used to obtain auth tokens before registering FCM (refFcm) tokens for mobile (`app` / `ios`) or web (`web`).

---

## 1. Login (get auth token for FCM registration)

### User
```
POST https://app.tifunbox.com/api/auth/login
Content-Type: application/json

{
  "email": "customer@gmail.com",
  "password": "password123",
  "role": "user"
}
```

### Restaurant
```
POST https://app.tifunbox.com/api/restaurant/auth/login
Content-Type: application/json

{
  "email": "restaurant@gmail.com",
  "password": "password123"
}
```

### Delivery
```
POST https://app.tifunbox.com/api/delivery/auth/login
Content-Type: application/json

{
  "email": "delivery@gmail.com",
  "password": "password123"
}
```

Use the returned access token in the `Authorization: Bearer <token>` header for FCM token registration and other protected routes.

---

## 2. Register FCM token (refFcm – mobile / web)

Use `platform: "web"` for web, or `"app"` / `"android"` / `"ios"` for mobile.  
Backend stores the token per platform (`fcmTokenWeb`, `fcmTokenAndroid` for app/android, `fcmTokenIos`).

**Note:** Backend expects the field name `fcmToken` (not `token`).

### User – Register FCM token
```
POST https://app.tifunbox.com/api/auth/fcm-token
Authorization: Bearer <user_access_token>
Content-Type: application/json

{
  "platform": "web",
  "fcmToken": "fcm_token_value_here"
}
```

### Restaurant – Register FCM token
```
POST https://app.tifunbox.com/api/restaurant/auth/fcm-token
Authorization: Bearer <restaurant_access_token>
Content-Type: application/json

{
  "platform": "web",
  "fcmToken": "fcm_token_value_here"
}
```

### Delivery – Register FCM token
```
POST https://app.tifunbox.com/api/delivery/auth/fcm-token
Authorization: Bearer <delivery_access_token>
Content-Type: application/json

{
  "platform": "web",
  "fcmToken": "fcm_token_value_here"
}
```

For mobile, use `"platform": "app"`, `"platform": "android"`, or `"platform": "ios"` in the same body.

---

## 3. Remove FCM token (e.g. on logout)

### User
```
DELETE https://app.tifunbox.com/api/auth/fcm-token
Authorization: Bearer <user_access_token>
Content-Type: application/json

{
  "platform": "web"
}
```

### Restaurant
```
DELETE https://app.tifunbox.com/api/restaurant/auth/fcm-token
Authorization: Bearer <restaurant_access_token>
Content-Type: application/json

{
  "platform": "web"
}
```

### Delivery
```
DELETE https://app.tifunbox.com/api/delivery/auth/fcm-token
Authorization: Bearer <delivery_access_token>
Content-Type: application/json

{
  "platform": "web"
}
```

Use `"platform": "app"`, `"platform": "android"`, or `"platform": "ios"` for mobile.

---

## Summary – FCM routes with refFcm token (mobile/web)

| Role      | Login URL                          | FCM register URL                     | FCM remove URL                        | Platform (refFcm)        |
|-----------|------------------------------------|--------------------------------------|---------------------------------------|--------------------------|
| User      | POST /api/auth/login               | POST /api/auth/fcm-token             | DELETE /api/auth/fcm-token             | web / app / android / ios |
| Restaurant| POST /api/restaurant/auth/login    | POST /api/restaurant/auth/fcm-token  | DELETE /api/restaurant/auth/fcm-token | web / app / android / ios |
| Delivery  | POST /api/delivery/auth/login      | POST /api/delivery/auth/fcm-token     | DELETE /api/delivery/auth/fcm-token   | web / app / android / ios |

**Platform values:**
- `web` – Web browser
- `app` – Mobile app (Android, preferred)
- `android` – Mobile app (Android, alias for app)
- `ios` – Mobile app (iOS)
