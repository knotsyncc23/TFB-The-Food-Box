import { Suspense, lazy } from "react"
import { Routes, Route } from "react-router-dom"
import DeliveryLayout from "./DeliveryLayout"
import ProtectedRoute from "./ProtectedRoute"
import Loader from "@/components/Loader"

// Main pages (with layout)
const DeliveryHome = lazy(() => import("../pages/DeliveryHome"))
const Notifications = lazy(() => import("../pages/Notifications"))
const MyOrders = lazy(() => import("../pages/MyOrders"))
const PocketPage = lazy(() => import("../pages/PocketPage"))
const GigBooking = lazy(() => import("../pages/GigBooking"))
const PickupDirectionsPage = lazy(() => import("../pages/PickupDirectionsPage"))
const ProfilePage = lazy(() => import("../pages/ProfilePage"))
const ProfileDetails = lazy(() => import("../pages/ProfileDetails"))
const AcceptedOrderDetails = lazy(() => import("../pages/AcceptedOrderDetails"))
const MyAccount = lazy(() => import("../pages/MyAccount"))
const TransactionHistory = lazy(() => import("../pages/TransactionHistory"))
const EditProfile = lazy(() => import("../pages/EditProfile"))
const Settings = lazy(() => import("../pages/Settings"))
const Conversation = lazy(() => import("../pages/Conversation"))
const TermsAndConditions = lazy(() => import("../pages/TermsAndConditions"))
const PrivacyPolicy = lazy(() => import("../pages/PrivacyPolicy"))
const Payout = lazy(() => import("../pages/Payout"))
const DeductionStatement = lazy(() => import("../pages/DeductionStatement"))
const TipsStatement = lazy(() => import("../pages/TipsStatement"))
const PocketStatement = lazy(() => import("../pages/PocketStatement"))
const FuelPayment = lazy(() => import("../pages/FuelPayment"))
const LimitSettlement = lazy(() => import("../pages/LimitSettlement"))
const OffersPage = lazy(() => import("../pages/OffersPage"))
const UpdatesPage = lazy(() => import("../pages/UpdatesPage"))
const SupportTickets = lazy(() => import("../pages/SupportTickets"))
const CreateSupportTicket = lazy(() => import("../pages/CreateSupportTicket"))
const ViewSupportTicket = lazy(() => import("../pages/ViewSupportTicket"))
const ShowIdCard = lazy(() => import("../pages/ShowIdCard"))
const ChangeLanguage = lazy(() => import("../pages/ChangeLanguage"))
const SelectDropLocation = lazy(() => import("../pages/SelectDropLocation"))
const ReferAndEarn = lazy(() => import("../pages/ReferAndEarn"))
const YourReferrals = lazy(() => import("../pages/YourReferrals"))
const Earnings = lazy(() => import("../pages/Earnings"))
const TripHistory = lazy(() => import("../pages/TripHistory"))
const TimeOnOrders = lazy(() => import("../pages/TimeOnOrders"))
const PocketBalancePage = lazy(() => import("../pages/PocketBalance"))
const CustomerTipsBalancePage = lazy(() => import("../pages/CustomerTips"))
const PocketDetails = lazy(() => import("../pages/PocketDetails"))

export default function DeliveryRouter() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Public legal pages */}
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* Protected routes - require authentication */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DeliveryLayout showGig={true}>
                <DeliveryHome />
              </DeliveryLayout>
            </ProtectedRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <Notifications />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/notifications"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout showGig={true}>
                <MyOrders />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/orders"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout showGig={true} showPocket={true}>
                <PocketPage />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/requests"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout showGig={true}>
                <GigBooking />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/gig"
        />
        <Route
          element={
            <ProtectedRoute>
              <SelectDropLocation />
            </ProtectedRoute>
          }
          path="/select-drop-location"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <ReferAndEarn />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/refer-and-earn"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <YourReferrals />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/your-referrals"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout showGig={true}>
                <OffersPage />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/offers"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <PickupDirectionsPage />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/pickup-directions"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout showGig={true}>
                <ProfilePage />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/profile"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <ProfileDetails />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/profile/details"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <AcceptedOrderDetails />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/order/:orderId"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <MyAccount />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/account"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <Earnings />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/earnings"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <TripHistory />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/trip-history"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <TimeOnOrders />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/time-on-orders"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <TransactionHistory />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/transactions"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <Payout />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/payout"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <DeductionStatement />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/deduction-statement"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <CustomerTipsBalancePage />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/customer-tips-balance"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <PocketBalancePage />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/pocket-balance"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <TipsStatement />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/tips-statement"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <PocketStatement />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/pocket-statement"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <FuelPayment />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/fuel-payment"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <LimitSettlement />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/limit-settlement"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <PocketDetails />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/pocket-details"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <EditProfile />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/profile/edit"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <Settings />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/profile/settings"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <Conversation />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/profile/conversation"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <TermsAndConditions />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/profile/terms"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <PrivacyPolicy />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/profile/privacy"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout showGig={true}>
                <UpdatesPage />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/updates"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <SupportTickets />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/help/tickets"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <CreateSupportTicket />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/help/create-ticket"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <ViewSupportTicket />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/help/tickets/:id"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <ShowIdCard />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/help/id-card"
        />
        <Route
          element={
            <ProtectedRoute>
              <DeliveryLayout>
                <ChangeLanguage />
              </DeliveryLayout>
            </ProtectedRoute>
          }
          path="/help/language"
        />
      </Routes>
    </Suspense>
  )
}

