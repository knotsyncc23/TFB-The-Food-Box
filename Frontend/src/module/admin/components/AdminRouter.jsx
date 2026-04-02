import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import AdminLayout from "./AdminLayout";
import Loader from "@/components/Loader";

const AdminHome = lazy(() => import("../pages/AdminHome"));
const PointOfSale = lazy(() => import("../pages/PointOfSale"));
const AdminProfile = lazy(() => import("../pages/AdminProfile"));
const AdminSettings = lazy(() => import("../pages/AdminSettings"));
const NewRefundRequests = lazy(() => import("../pages/refunds/NewRefundRequests"));
const FoodApproval = lazy(() => import("../pages/restaurant/FoodApproval"));
const OrdersPage = lazy(() => import("../pages/orders/OrdersPage"));
const OrderDetectDelivery = lazy(() => import("../pages/OrderDetectDelivery"));
const Category = lazy(() => import("../pages/categories/Category"));
const FeeSettings = lazy(() => import("../pages/fee-settings/FeeSettings"));
// Restaurant Management
const ZoneSetup = lazy(() => import("../pages/restaurant/ZoneSetup"));
const AddZone = lazy(() => import("../pages/restaurant/AddZone"));
const ViewZone = lazy(() => import("../pages/restaurant/ViewZone"));
const AllZonesMap = lazy(() => import("../pages/restaurant/AllZonesMap"));
const DeliveryBoyViewMap = lazy(() => import("../pages/restaurant/DeliveryBoyViewMap"));
const RestaurantsList = lazy(() => import("../pages/restaurant/RestaurantsList"));
const EditRestaurantDetails = lazy(() => import("../pages/restaurant/EditRestaurantDetails"));
const AddRestaurant = lazy(() => import("../pages/restaurant/AddRestaurant"));
const JoiningRequest = lazy(() => import("../pages/restaurant/JoiningRequest"));
const RestaurantCommission = lazy(() => import("../pages/restaurant/RestaurantCommission"));
const RestaurantComplaints = lazy(() => import("../pages/restaurant/RestaurantComplaints"));
const RestaurantsBulkImport = lazy(() => import("../pages/restaurant/RestaurantsBulkImport"));
const RestaurantsBulkExport = lazy(() => import("../pages/restaurant/RestaurantsBulkExport"));
// Food Management
const FoodsList = lazy(() => import("../pages/foods/FoodsList"));
const AddonsList = lazy(() => import("../pages/addons/AddonsList"));
// Promotions Management
const BasicCampaign = lazy(() => import("../pages/campaigns/BasicCampaign"));
const FoodCampaign = lazy(() => import("../pages/campaigns/FoodCampaign"));
const Coupons = lazy(() => import("../pages/Coupons"));
const Cashback = lazy(() => import("../pages/Cashback"));
const Banners = lazy(() => import("../pages/Banners"));
const PromotionalBanner = lazy(() => import("../pages/PromotionalBanner"));
const NewAdvertisement = lazy(() => import("../pages/advertisement/NewAdvertisement"));
const AdRequests = lazy(() => import("../pages/advertisement/AdRequests"));
const AdsList = lazy(() => import("../pages/advertisement/AdsList"));
const PushNotification = lazy(() => import("../pages/PushNotification"));
// Help & Support
const Chattings = lazy(() => import("../pages/Chattings"));
const ContactMessages = lazy(() => import("../pages/ContactMessages"));
const SafetyEmergencyReports = lazy(() => import("../pages/SafetyEmergencyReports"));
// Customer Management
const Customers = lazy(() => import("../pages/Customers"));
const AddFund = lazy(() => import("../pages/wallet/AddFund"));
const Bonus = lazy(() => import("../pages/wallet/Bonus"));
const LoyaltyPointReport = lazy(() => import("../pages/loyalty-point/Report"));
const SubscribedMailList = lazy(() => import("../pages/SubscribedMailList"));
// Deliveryman Management
const DeliveryBoyCommission = lazy(() => import("../pages/DeliveryBoyCommission"));
const DeliveryCashLimit = lazy(() => import("../pages/DeliveryCashLimit"));
const CashLimitSettlement = lazy(() => import("../pages/CashLimitSettlement"));
const DeliveryWithdrawal = lazy(() => import("../pages/DeliveryWithdrawal"));
const DeliveryBoyWallet = lazy(() => import("../pages/DeliveryBoyWallet"));
const DeliveryEmergencyHelp = lazy(() => import("../pages/DeliveryEmergencyHelp"));
const DeliverySupportTickets = lazy(() => import("../pages/DeliverySupportTickets"));
const JoinRequest = lazy(() => import("../pages/delivery-partners/JoinRequest"));
const AddDeliveryman = lazy(() => import("../pages/delivery-partners/AddDeliveryman"));
const DeliverymanList = lazy(() => import("../pages/delivery-partners/DeliverymanList"));
const DeliverymanReviews = lazy(() => import("../pages/delivery-partners/DeliverymanReviews"));
const DeliverymanBonus = lazy(() => import("../pages/delivery-partners/DeliverymanBonus"));
const EarningAddon = lazy(() => import("../pages/delivery-partners/EarningAddon"));
const EarningAddonHistory = lazy(() => import("../pages/delivery-partners/EarningAddonHistory"));
const DeliveryEarnings = lazy(() => import("../pages/delivery-partners/DeliveryEarnings"));
// Disbursement Management
const RestaurantDisbursement = lazy(() => import("../pages/RestaurantDisbursement"));
const DeliverymanDisbursement = lazy(() => import("../pages/DeliverymanDisbursement"));
// Report Management
const TransactionReport = lazy(() => import("../pages/reports/TransactionReport"));
const ExpenseReport = lazy(() => import("../pages/reports/ExpenseReport"));
const DisbursementReportRestaurants = lazy(() => import("../pages/reports/DisbursementReportRestaurants"));
const DisbursementReportDeliverymen = lazy(() => import("../pages/reports/DisbursementReportDeliverymen"));
const RegularOrderReport = lazy(() => import("../pages/reports/RegularOrderReport"));
const CampaignOrderReport = lazy(() => import("../pages/reports/CampaignOrderReport"));
const RestaurantReport = lazy(() => import("../pages/reports/RestaurantReport"));
const FeedbackExperienceReport = lazy(() => import("../pages/reports/FeedbackExperienceReport"));
const TaxReport = lazy(() => import("../pages/reports/TaxReport"));
const RestaurantVATReport = lazy(() => import("../pages/reports/RestaurantVATReport"));
// Transaction Management
const RestaurantWithdraws = lazy(() => import("../pages/transactions/RestaurantWithdraws"));
const WithdrawMethod = lazy(() => import("../pages/transactions/WithdrawMethod"));
// Employee Management
const EmployeeRole = lazy(() => import("../pages/employees/EmployeeRole"));
const AddEmployee = lazy(() => import("../pages/employees/AddEmployee"));
const EmployeeList = lazy(() => import("../pages/employees/EmployeeList"));
// Business Settings
const BusinessSetup = lazy(() => import("../pages/settings/BusinessSetup"));
const EmailTemplate = lazy(() => import("../pages/settings/EmailTemplate"));
const ThemeSettings = lazy(() => import("../pages/settings/ThemeSettings"));
const Gallery = lazy(() => import("../pages/settings/Gallery"));
const LoginSetup = lazy(() => import("../pages/settings/LoginSetup"));
const TermsAndCondition = lazy(() => import("../pages/settings/TermsAndCondition"));
const PrivacyPolicy = lazy(() => import("../pages/settings/PrivacyPolicy"));
const ContactUsPage = lazy(() => import("../pages/settings/ContactUs"));
const AboutUs = lazy(() => import("../pages/settings/AboutUs"));
const RefundPolicy = lazy(() => import("../pages/settings/RefundPolicy"));
const ShippingPolicy = lazy(() => import("../pages/settings/ShippingPolicy"));
const CancellationPolicy = lazy(() => import("../pages/settings/CancellationPolicy"));
const ReactRegistration = lazy(() => import("../pages/settings/ReactRegistration"));
// System Settings
const ThirdParty = lazy(() => import("../pages/system/ThirdParty"));
const FirebaseNotification = lazy(() => import("../pages/system/FirebaseNotification"));
const OfflinePaymentSetup = lazy(() => import("../pages/system/OfflinePaymentSetup"));
const JoinUsPageSetup = lazy(() => import("../pages/system/JoinUsPageSetup"));
const AnalyticsScript = lazy(() => import("../pages/system/AnalyticsScript"));
const AISetup = lazy(() => import("../pages/system/AISetup"));
const AppWebSettings = lazy(() => import("../pages/system/AppWebSettings"));
const NotificationChannels = lazy(() => import("../pages/system/NotificationChannels"));
const LandingPageSettings = lazy(() => import("../pages/system/LandingPageSettings"));
const PageMetaData = lazy(() => import("../pages/system/PageMetaData"));
const ReactSite = lazy(() => import("../pages/system/ReactSite"));
const CleanDatabase = lazy(() => import("../pages/system/CleanDatabase"));
const AddonActivation = lazy(() => import("../pages/system/AddonActivation"));
// ENV Setup (formerly System Addons)
const SystemAddons = lazy(() => import("../pages/system/SystemAddons"));
const LandingPageManagement = lazy(() => import("../pages/system/LandingPageManagement"));
const DiningManagement = lazy(() => import("../pages/system/DiningManagement"));
const DiningList = lazy(() => import("../pages/system/DiningList"));
const DiningCoupons = lazy(() => import("../pages/dining/DiningCoupons"));
const DiningEarnings = lazy(() => import("../pages/dining/DiningEarnings"));

export default function AdminRouter() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Protected Routes - With Layout */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* Dashboard */}
          <Route index element={<AdminHome />} />


          <Route path="point-of-sale" element={<PointOfSale />} />

          {/* Profile */}
          <Route path="/profile" element={<AdminProfile />} />

          {/* Settings */}
          <Route path="/settings" element={<AdminSettings />} />

          {/* ORDER MANAGEMENT */}
          {/* Orders */}
          <Route path="orders/all" element={<OrdersPage statusKey="all" />} />
          <Route path="orders/pending" element={<OrdersPage statusKey="pending" />} />
          <Route path="orders/accepted" element={<OrdersPage statusKey="accepted" />} />
          <Route path="orders/processing" element={<OrdersPage statusKey="processing" />} />
          <Route path="orders/food-on-the-way" element={<OrdersPage statusKey="food-on-the-way" />} />
          <Route path="orders/delivered" element={<OrdersPage statusKey="delivered" />} />
          <Route path="orders/canceled" element={<OrdersPage statusKey="canceled" />} />
          <Route path="orders/restaurant-cancelled" element={<OrdersPage statusKey="restaurant-cancelled" />} />
          <Route path="orders/payment-failed" element={<OrdersPage statusKey="payment-failed" />} />
          <Route path="orders/refunded" element={<OrdersPage statusKey="refunded" />} />
          <Route path="orders/offline-payments" element={<OrdersPage statusKey="offline-payments" />} />
          <Route path="order-detect-delivery" element={<OrderDetectDelivery />} />
          {/* Order Refunds */}
          <Route path="order-refunds/new" element={<NewRefundRequests />} />

          {/* RESTAURANT MANAGEMENT */}
          <Route path="zone-setup" element={<ZoneSetup />} />
          <Route path="zone-setup/map" element={<AllZonesMap />} />
          <Route path="zone-setup/delivery-boy-view" element={<DeliveryBoyViewMap />} />
          <Route path="zone-setup/add" element={<AddZone />} />
          <Route path="zone-setup/edit/:id" element={<AddZone />} />
          <Route path="zone-setup/view/:id" element={<ViewZone />} />
          <Route path="food-approval" element={<FoodApproval />} />
          {/* Restaurants */}
          <Route path="restaurants" element={<RestaurantsList />} />
          <Route path="restaurants/edit-details" element={<EditRestaurantDetails />} />
          <Route path="restaurants/add" element={<AddRestaurant />} />
          <Route path="restaurants/edit/:id" element={<AddRestaurant />} />
          <Route path="restaurants/joining-request" element={<JoiningRequest />} />
          <Route path="restaurants/commission" element={<RestaurantCommission />} />
          <Route path="restaurants/complaints" element={<RestaurantComplaints />} />
          <Route path="restaurants/bulk-import" element={<RestaurantsBulkImport />} />
          <Route path="restaurants/bulk-export" element={<RestaurantsBulkExport />} />
          <Route path="dining-coupons" element={<DiningCoupons />} />
          <Route path="dining-earnings" element={<DiningEarnings />} />

          {/* FOOD MANAGEMENT */}
          {/* Categories */}
          <Route path="categories" element={<Category />} />
          {/* Fee Settings */}
          <Route path="fee-settings" element={<FeeSettings />} />
          {/* Foods */}
          <Route path="foods" element={<FoodsList />} />
          <Route path="food/list" element={<FoodsList />} />
          {/* Addons */}
          <Route path="addons" element={<AddonsList />} />

          {/* PROMOTIONS MANAGEMENT */}
          {/* Campaigns */}
          <Route path="campaigns/basic" element={<BasicCampaign />} />
          <Route path="campaigns/food" element={<FoodCampaign />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="cashback" element={<Cashback />} />
          <Route path="banners" element={<Banners />} />
          <Route path="promotional-banner" element={<PromotionalBanner />} />
          {/* Advertisement */}
          <Route path="advertisement/new" element={<NewAdvertisement />} />
          <Route path="advertisement/requests" element={<AdRequests />} />
          <Route path="advertisement" element={<AdsList />} />
          <Route path="push-notification" element={<PushNotification />} />

          {/* HELP & SUPPORT */}
          <Route path="chattings" element={<Chattings />} />
          <Route path="contact-messages" element={<ContactMessages />} />
          <Route path="safety-emergency-reports" element={<SafetyEmergencyReports />} />

          {/* CUSTOMER MANAGEMENT */}
          <Route path="customers" element={<Customers />} />
          {/* Wallet */}
          <Route path="wallet/add-fund" element={<AddFund />} />
          <Route path="wallet/bonus" element={<Bonus />} />
          {/* Loyalty Point */}
          <Route path="loyalty-point/report" element={<LoyaltyPointReport />} />
          <Route path="subscribed-mail-list" element={<SubscribedMailList />} />

          {/* DELIVERYMAN MANAGEMENT */}
          <Route path="delivery-boy-commission" element={<DeliveryBoyCommission />} />
          <Route path="delivery-cash-limit" element={<DeliveryCashLimit />} />
          <Route path="cash-limit-settlement" element={<CashLimitSettlement />} />
          <Route path="delivery-withdrawal" element={<DeliveryWithdrawal />} />
          <Route path="delivery-boy-wallet" element={<DeliveryBoyWallet />} />
          <Route path="delivery-emergency-help" element={<DeliveryEmergencyHelp />} />
          <Route path="delivery-support-tickets" element={<DeliverySupportTickets />} />
          {/* Delivery Partners */}
          <Route path="delivery-partners/join-request" element={<JoinRequest />} />
          <Route path="delivery-partners/add" element={<AddDeliveryman />} />
          <Route path="delivery-partners" element={<DeliverymanList />} />
          <Route path="delivery-partners/reviews" element={<DeliverymanReviews />} />
          <Route path="delivery-partners/bonus" element={<DeliverymanBonus />} />
          <Route path="delivery-partners/earning-addon" element={<EarningAddon />} />
          <Route path="delivery-partners/earning-addon-history" element={<EarningAddonHistory />} />
          <Route path="delivery-partners/earnings" element={<DeliveryEarnings />} />

          {/* DISBURSEMENT MANAGEMENT */}
          <Route path="restaurant-disbursement" element={<RestaurantDisbursement />} />
          <Route path="deliveryman-disbursement" element={<DeliverymanDisbursement />} />

          {/* REPORT MANAGEMENT */}
          <Route path="transaction-report" element={<TransactionReport />} />
          <Route path="expense-report" element={<ExpenseReport />} />
          {/* Disbursement Report */}
          <Route path="disbursement-report/restaurants" element={<DisbursementReportRestaurants />} />
          <Route path="disbursement-report/deliverymen" element={<DisbursementReportDeliverymen />} />
          {/* Order Report */}
          <Route path="order-report/regular" element={<RegularOrderReport />} />
          <Route path="order-report/campaign" element={<CampaignOrderReport />} />
          {/* Restaurant Report */}
          <Route path="restaurant-report" element={<RestaurantReport />} />
          {/* Customer Report */}
          <Route path="customer-report/feedback-experience" element={<FeedbackExperienceReport />} />
          <Route path="tax-report" element={<TaxReport />} />
          <Route path="restaurant-vat-report" element={<RestaurantVATReport />} />

          {/* TRANSACTION MANAGEMENT */}
          <Route path="restaurant-withdraws" element={<RestaurantWithdraws />} />
          <Route path="withdraw-method" element={<WithdrawMethod />} />

          {/* EMPLOYEE MANAGEMENT */}
          <Route path="employee-role" element={<EmployeeRole />} />
          {/* Employees */}
          <Route path="employees/add" element={<AddEmployee />} />
          <Route path="employees" element={<EmployeeList />} />

          {/* BUSINESS SETTINGS */}
          <Route path="business-setup" element={<BusinessSetup />} />
          <Route path="email-template" element={<EmailTemplate />} />
          <Route path="theme-settings" element={<ThemeSettings />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="login-setup" element={<LoginSetup />} />
          {/* Business Settings - FCM */}
          <Route path="business-settings/fcm-index" element={<FirebaseNotification />} />
          {/* Pages & Social Media */}
          <Route path="pages-social-media/terms" element={<TermsAndCondition />} />
          <Route path="pages-social-media/privacy" element={<PrivacyPolicy />} />
          <Route path="pages-social-media/contact-us" element={<ContactUsPage />} />
          <Route path="pages-social-media/about" element={<AboutUs />} />
          <Route path="pages-social-media/refund" element={<RefundPolicy />} />
          <Route path="pages-social-media/shipping" element={<ShippingPolicy />} />
          <Route path="pages-social-media/cancellation" element={<CancellationPolicy />} />
          <Route path="pages-social-media/react-registration" element={<ReactRegistration />} />

          {/* SYSTEM SETTINGS */}
          {/* 3rd Party & Configurations */}
          <Route path="3rd-party-configurations/party" element={<ThirdParty />} />
          <Route path="3rd-party-configurations/firebase" element={<FirebaseNotification />} />
          <Route path="3rd-party-configurations/offline-payment" element={<OfflinePaymentSetup />} />
          <Route path="3rd-party-configurations/join-us" element={<JoinUsPageSetup />} />
          <Route path="3rd-party-configurations/analytics" element={<AnalyticsScript />} />
          <Route path="3rd-party-configurations/ai" element={<AISetup />} />
          <Route path="app-web-settings" element={<AppWebSettings />} />
          <Route path="notification-channels" element={<NotificationChannels />} />
          {/* Landing Page Settings */}
          <Route path="landing-page-settings/admin" element={<LandingPageSettings type="admin" />} />
          <Route path="landing-page-settings/react" element={<LandingPageSettings type="react" />} />
          <Route path="page-meta-data" element={<PageMetaData />} />
          <Route path="react-site" element={<ReactSite />} />
          <Route path="clean-database" element={<CleanDatabase />} />
          <Route path="addon-activation" element={<AddonActivation />} />

          {/* ENV SETUP */}
          <Route path="system-addons" element={<SystemAddons />} />
          {/* HERO BANNER MANAGEMENT */}
          <Route path="hero-banner-management" element={<LandingPageManagement />} />
          {/* DINING MANAGEMENT */}
          <Route path="dining-management" element={<DiningManagement />} />
          <Route path="dining-list" element={<DiningList />} />
        </Route>

        {/* Redirect /admin to /admin/ */}

      </Routes >
    </Suspense>
  );
}
