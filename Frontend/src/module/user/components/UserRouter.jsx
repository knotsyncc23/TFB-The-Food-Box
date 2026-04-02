import { Routes, Route } from "react-router-dom"
import ProtectedRoute from "@/components/ProtectedRoute"
import AuthRedirect from "@/components/AuthRedirect"
import UserLayout from "./UserLayout"
import { Suspense, lazy } from "react"
import Loader from "@/components/Loader"

// Lazy Loading Pages

// Home & Discovery
const Home = lazy(() => import("../pages/Home"))
const Dining = lazy(() => import("@/module/dining/pages/Dining"))
const DiningRestaurants = lazy(() => import("@/module/dining/pages/DiningRestaurants"))
const DiningCategory = lazy(() => import("@/module/dining/pages/DiningCategory"))
const DiningExplore50 = lazy(() => import("@/module/dining/pages/DiningExplore50"))
const DiningExploreNear = lazy(() => import("@/module/dining/pages/DiningExploreNear"))
const Coffee = lazy(() => import("../pages/Coffee"))
const Under250 = lazy(() => import("../pages/Under250"))
const CategoryPage = lazy(() => import("../pages/CategoryPage"))

const RestaurantDetails = lazy(() => import("../pages/restaurants/RestaurantDetails"))
const RestaurantInfoPage = lazy(() => import("../pages/restaurants/RestaurantInfoPage"))
const DiningRestaurantDetails = lazy(() => import("@/module/dining/pages/DiningRestaurantDetails"))
const TableBooking = lazy(() => import("@/module/dining/pages/TableBooking"))
const TableBookingConfirmation = lazy(() => import("@/module/dining/pages/TableBookingConfirmation"))
const TableBookingSuccess = lazy(() => import("@/module/dining/pages/TableBookingSuccess"))
const MyBookings = lazy(() => import("@/module/dining/pages/MyBookings"))
const SearchResults = lazy(() => import("../pages/SearchResults"))
const ProductDetail = lazy(() => import("../pages/ProductDetail"))

// Cart
const Cart = lazy(() => import("../pages/cart/Cart"))
const Checkout = lazy(() => import("../pages/cart/Checkout"))

// Orders
const Orders = lazy(() => import("../pages/orders/Orders"))
const OrderTracking = lazy(() => import("../pages/orders/OrderTracking"))
const OrderInvoice = lazy(() => import("../pages/orders/OrderInvoice"))
const UserOrderDetails = lazy(() => import("../pages/orders/UserOrderDetails"))
const OrderChatScreen = lazy(() => import("../pages/orders/OrderChatScreen"))

// Offers
const Offers = lazy(() => import("../pages/Offers"))

// Gourmet
const Gourmet = lazy(() => import("../pages/Gourmet"))

// Top 10
const Top10 = lazy(() => import("../pages/Top10"))

// Collections
const Collections = lazy(() => import("../pages/Collections"))
const CollectionDetail = lazy(() => import("../pages/CollectionDetail"))

// Gift Cards
const GiftCards = lazy(() => import("../pages/GiftCards"))
const GiftCardCheckout = lazy(() => import("../pages/GiftCardCheckout"))

// Profile
const Profile = lazy(() => import("../pages/profile/Profile"))
const EditProfile = lazy(() => import("../pages/profile/EditProfile"))
const Payments = lazy(() => import("../pages/profile/Payments"))
const AddPayment = lazy(() => import("../pages/profile/AddPayment"))
const EditPayment = lazy(() => import("../pages/profile/EditPayment"))
const Favorites = lazy(() => import("../pages/profile/Favorites"))
const Settings = lazy(() => import("../pages/profile/Settings"))
const Coupons = lazy(() => import("../pages/profile/Coupons"))
const RedeemGoldCoupon = lazy(() => import("../pages/profile/RedeemGoldCoupon"))
const About = lazy(() => import("../pages/profile/About"))
const Terms = lazy(() => import("../pages/profile/Terms"))
const Privacy = lazy(() => import("../pages/profile/Privacy"))
const ContactUs = lazy(() => import("../pages/profile/ContactUs"))
const ContentPolicy = lazy(() => import("../pages/profile/ContentPolicy"))
const Refund = lazy(() => import("../pages/profile/Refund"))
const Shipping = lazy(() => import("../pages/profile/Shipping"))
const Cancellation = lazy(() => import("../pages/profile/Cancellation"))
const SendFeedback = lazy(() => import("../pages/profile/SendFeedback"))
const ReportSafetyEmergency = lazy(() => import("../pages/profile/ReportSafetyEmergency"))
const Accessibility = lazy(() => import("../pages/profile/Accessibility"))
const Logout = lazy(() => import("../pages/profile/Logout"))
const Addresses = lazy(() => import("../pages/profile/Addresses"))

// Auth
const SignIn = lazy(() => import("../pages/auth/SignIn"))
const OTP = lazy(() => import("../pages/auth/OTP"))
const AuthCallback = lazy(() => import("../pages/auth/AuthCallback"))

// Help
const Help = lazy(() => import("../pages/help/Help"))
const OrderHelp = lazy(() => import("../pages/help/OrderHelp"))

// Notifications
const Notifications = lazy(() => import("../pages/Notifications"))

// Wallet
const Wallet = lazy(() => import("../pages/Wallet"))

// Complaints
const SubmitComplaint = lazy(() => import("../pages/complaints/SubmitComplaint"))

export default function UserRouter() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<UserLayout />}>
          {/* Home & Discovery */}
          <Route path="/" element={<Home />} />
          <Route path="/dining" element={<Dining />} />
          <Route path="/dining/restaurants" element={<DiningRestaurants />} />
          <Route path="/dining/:category" element={<DiningCategory />} />
          <Route path="/dining/explore/upto50" element={<DiningExplore50 />} />
          <Route path="/dining/explore/near-rated" element={<DiningExploreNear />} />
          <Route path="/dining/coffee" element={<Coffee />} />
          <Route path="/dining/:diningType/:slug" element={<DiningRestaurantDetails />} />
          <Route path="/dining/book/:slug" element={<TableBooking />} />
          <Route
            path="/dining/book-confirmation"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <TableBookingConfirmation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dining/book-success"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <TableBookingSuccess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <MyBookings />
              </ProtectedRoute>
            }
          />
          <Route path="/under-250" element={<Under250 />} />
          <Route path="/category/:category" element={<CategoryPage />} />

          <Route path="/restaurants/:slug/info" element={<RestaurantInfoPage />} />
          <Route path="/restaurants/:slug" element={<RestaurantDetails />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/product/:id" element={<ProductDetail />} />

          {/* Cart - Protected */}
          <Route
            path="/cart"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Cart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cart/checkout"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Checkout />
              </ProtectedRoute>
            }
          />

          {/* Orders - Protected */}
          <Route
            path="/orders"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:orderId"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <OrderTracking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:orderId/chat"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <OrderChatScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:orderId/invoice"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <OrderInvoice />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:orderId/details"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <UserOrderDetails />
              </ProtectedRoute>
            }
          />

          {/* Offers */}
          <Route path="/offers" element={<Offers />} />

          {/* Gourmet */}
          <Route path="/gourmet" element={<Gourmet />} />

          {/* Top 10 */}
          <Route path="/top-10" element={<Top10 />} />

          {/* Collections */}
          <Route path="/collections" element={<Collections />} />
          <Route
            path="/collections/:id"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <CollectionDetail />
              </ProtectedRoute>
            }
          />

          {/* Gift Cards */}
          <Route path="/gift-card" element={<GiftCards />} />
          <Route
            path="/gift-card/checkout"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <GiftCardCheckout />
              </ProtectedRoute>
            }
          />

          {/* Profile - Protected */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <EditProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/addresses"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Addresses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/payments"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Payments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/payments/new"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <AddPayment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/payments/:id/edit"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <EditPayment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/favorites"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Favorites />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/settings"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/coupons"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Coupons />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/redeem-gold-coupon"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <RedeemGoldCoupon />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/about"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <About />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/terms"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Terms />
              </ProtectedRoute>
            }
          />
          <Route path="/profile/privacy" element={<Privacy />} />
          <Route path="/profile/contact-us" element={<ContactUs />} />
          <Route
            path="/profile/refund"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Refund />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/shipping"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Shipping />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/cancellation"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Cancellation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/send-feedback"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <SendFeedback />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/report-safety-emergency"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <ReportSafetyEmergency />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/accessibility"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Accessibility />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/logout"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Logout />
              </ProtectedRoute>
            }
          />

          {/* Public legal pages (no login required) */}
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/content-policy" element={<ContentPolicy />} />

          {/* Auth */}
          <Route path="/auth/sign-in" element={<AuthRedirect module="user"><SignIn /></AuthRedirect>} />
          <Route path="/auth/otp" element={<AuthRedirect module="user"><OTP /></AuthRedirect>} />
          <Route path="/auth/apple/callback" element={<AuthCallback />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/callback" element={<AuthCallback />} />

          {/* Help */}
          <Route path="/help" element={<Help />} />
          <Route path="/help/orders/:orderId" element={<OrderHelp />} />

          {/* Notifications - Protected */}
          <Route
            path="/notifications"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Notifications />
              </ProtectedRoute>
            }
          />

          {/* Wallet - Protected */}
          <Route
            path="/wallet"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <Wallet />
              </ProtectedRoute>
            }
          />

          {/* Complaints - Protected */}
          <Route
            path="/complaints/submit/:orderId"
            element={
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/sign-in">
                <SubmitComplaint />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  )
}

