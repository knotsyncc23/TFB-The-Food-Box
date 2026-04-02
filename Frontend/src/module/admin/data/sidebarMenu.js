// Sidebar menu structure with all items
export const sidebarMenuData = [
  {
    type: "link",
    label: "Dashboard",
    path: "/admin",
    icon: "LayoutDashboard",
  },
  {
    type: "link",
    label: "Point of Sale",
    path: "/admin/point-of-sale",
    icon: "CreditCard",
  },
  {
    type: "section",
    label: "FOOD MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Food Approval",
        path: "/admin/food-approval",
        icon: "CheckCircle2",
      },
      {
        type: "expandable",
        label: "Foods",
        icon: "Utensils",
        subItems: [
          { label: "Restaurant Foods List", path: "/admin/foods" },
          { label: "Restaurant Addons List", path: "/admin/addons" },
        ],
      },
      {
        type: "expandable",
        label: "Categories",
        icon: "FolderTree",
        subItems: [{ label: "Category", path: "/admin/categories" }],
      },
    ],
  },
  {
    type: "section",
    label: "RESTAURANT MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Zone Setup",
        path: "/admin/zone-setup",
        icon: "MapPin",
      },
      {
        type: "expandable",
        label: "Restaurants",
        icon: "UtensilsCrossed",
        subItems: [
          { label: "Restaurants List", path: "/admin/restaurants" },
          { label: "Edit Restaurant Details", path: "/admin/restaurants/edit-details" },
          {
            label: "New Joining Request",
            path: "/admin/restaurants/joining-request",
          },
          {
            label: "Restaurant Commission",
            path: "/admin/restaurants/commission",
          },
          {
            label: "Restaurant Complaints",
            path: "/admin/restaurants/complaints",
          },
          { label: "Dining Coupons", path: "/admin/dining-coupons" },
          { label: "Dining Earnings", path: "/admin/dining-earnings" },
        ],
      },
    ],
  },

  {
    type: "section",
    label: "ORDER MANAGEMENT",
    items: [
      {
        type: "expandable",
        label: "Orders",
        icon: "FileText",
        subItems: [
          { label: "All", path: "/admin/orders/all" },
          { label: "Pending", path: "/admin/orders/pending" },
          { label: "Accepted", path: "/admin/orders/accepted" },
          { label: "Processing", path: "/admin/orders/processing" },
          { label: "Food On The Way", path: "/admin/orders/food-on-the-way" },
          { label: "Delivered", path: "/admin/orders/delivered" },
          { label: "Cancelled", path: "/admin/orders/canceled" },
          {
            label: "Restaurant cancelled",
            path: "/admin/orders/restaurant-cancelled",
          },
          { label: "Payment Failed", path: "/admin/orders/payment-failed" },
          { label: "Refunded", path: "/admin/orders/refunded" },
          { label: "Offline Payments", path: "/admin/orders/offline-payments" },
        ],
      },
      {
        type: "link",
        label: "Order Detect Delivery",
        path: "/admin/order-detect-delivery",
        icon: "Truck",
      },
    ],
  },
  {
    type: "section",
    label: "PROMOTIONS MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Restaurant Coupons & Offers",
        path: "/admin/coupons",
        icon: "Gift",
      },

      {
        type: "link",
        label: "Push Notification",
        path: "/admin/push-notification",
        icon: "Bell",
      },
    ],
  },

  {
    type: "section",
    label: "CUSTOMER MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Customers",
        path: "/admin/customers",
        icon: "Users",
      },
    ],
  },
  {
    type: "section",
    label: "DELIVERYMAN MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Delivery Cash Limit",
        path: "/admin/delivery-cash-limit",
        icon: "IndianRupee",
      },
      {
        type: "link",
        label: "Delivery & Platform Fee",
        path: "/admin/fee-settings",
        icon: "IndianRupee",
      },
      {
        type: "link",
        label: "Cash limit settlement",
        path: "/admin/cash-limit-settlement",
        icon: "Receipt",
      },
      {
        type: "link",
        label: "Delivery Withdrawal",
        path: "/admin/delivery-withdrawal",
        icon: "Wallet",
      },
      {
        type: "link",
        label: "Delivery boy Wallet",
        path: "/admin/delivery-boy-wallet",
        icon: "PiggyBank",
      },
      {
        type: "link",
        label: "Delivery Boy Commission",
        path: "/admin/delivery-boy-commission",
        icon: "IndianRupee",
      },
      {
        type: "link",
        label: "Delivery Emergency Help",
        path: "/admin/delivery-emergency-help",
        icon: "Phone",
      },
      {
        type: "link",
        label: "Delivery Support Tickets",
        path: "/admin/delivery-support-tickets",
        icon: "MessageSquare",
      },
      {
        type: "expandable",
        label: "Deliveryman",
        icon: "Package",
        subItems: [
          {
            label: "New Join Request",
            path: "/admin/delivery-partners/join-request",
          },
          { label: "Deliveryman List", path: "/admin/delivery-partners" },
          {
            label: "Deliveryman Reviews",
            path: "/admin/delivery-partners/reviews",
          },
          { label: "Bonus", path: "/admin/delivery-partners/bonus" },
          {
            label: "Earning Addon",
            path: "/admin/delivery-partners/earning-addon",
          },
          {
            label: "Earning Addon History",
            path: "/admin/delivery-partners/earning-addon-history",
          },
          {
            label: "Delivery Earning",
            path: "/admin/delivery-partners/earnings",
          },
        ],
      },
    ],
  },

  {
    type: "section",
    label: "HELP & SUPPORT",
    items: [
      {
        type: "link",
        label: "User Feedback",
        path: "/admin/contact-messages",
        icon: "Mail",
      },
      {
        type: "link",
        label: "Safety Emergency Reports",
        path: "/admin/safety-emergency-reports",
        icon: "AlertTriangle",
      },
    ],
  },

  {
    type: "section",
    label: "REPORT MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Transaction Report",
        path: "/admin/transaction-report",
        icon: "FileText",
      },
      {
        type: "link",
        label: "Order Report",
        path: "/admin/order-report/regular",
        icon: "FileText",
      },
      {
        type: "expandable",
        label: "Restaurant Report",
        icon: "FileText",
        subItems: [
          { label: "Restaurant Report", path: "/admin/restaurant-report" },
        ],
      },
      {
        type: "expandable",
        label: "Customer Report",
        icon: "FileText",
        subItems: [
          {
            label: "Feedback Experience",
            path: "/admin/customer-report/feedback-experience",
          },
        ],
      },
    ],
  },
  {
    type: "section",
    label: "TRANSACTION MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Restaurant Withdraws",
        path: "/admin/restaurant-withdraws",
        icon: "CreditCard",
      },
    ],
  },
  {
    type: "section",
    label: "BANNER SETTINGS",
    items: [
      {
        type: "link",
        label: "Landing Page Management",
        path: "/admin/hero-banner-management",
        icon: "Image",
      },
    ],
  },
  {
    type: "section",
    label: "DINING MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Dining Banners",
        path: "/admin/dining-management",
        icon: "UtensilsCrossed",
      },
      {
        type: "link",
        label: "Dining List",
        path: "/admin/dining-list",
        icon: "FileText",
      },
    ],
  },
  {
    type: "section",
    label: "BUSINESS SETTINGS",
    items: [
      {
        type: "link",
        label: "Business Setup",
        path: "/admin/business-setup",
        icon: "Settings",
      },
      {
        type: "expandable",
        label: "Pages & Social Media",
        icon: "Link",
        subItems: [
          {
            label: "Terms And Condition",
            path: "/admin/pages-social-media/terms",
          },
          {
            label: "Privacy Policy",
            path: "/admin/pages-social-media/privacy",
          },
          { label: "Contact Us", path: "/admin/pages-social-media/contact-us" },
          { label: "About Us", path: "/admin/pages-social-media/about" },
          { label: "Refund Policy", path: "/admin/pages-social-media/refund" },
          {
            label: "Shipping Policy",
            path: "/admin/pages-social-media/shipping",
          },
          {
            label: "Cancellation Policy",
            path: "/admin/pages-social-media/cancellation",
          },
        ],
      },
    ],
  },

  {
    type: "section",
    label: "SYSTEM ENV",
    items: [
      {
        type: "link",
        label: "ENV Setup",
        path: "/admin/system-addons",
        icon: "Plus",
      },
    ],
  },
];
