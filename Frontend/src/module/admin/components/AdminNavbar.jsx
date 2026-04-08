import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  Bell,
  User,
  ChevronDown,
  UtensilsCrossed,
  LogOut,
  Settings,
  FileText,
  Package,
  Users,
  AlertCircle,
  ArrowRight,
  Loader2,
  Clock3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DEFAULT_LOGO_PLACEHOLDER } from "@/lib/constants/defaultLogo";
import { adminAPI } from "@/lib/api";
import { clearModuleAuth } from "@/lib/utils/auth";
import { getCachedSettings, loadBusinessSettings } from "@/lib/utils/businessSettings";
import { sidebarMenuData } from "../data/sidebarMenu";

const ADMIN_SEARCH_HISTORY_KEY = "admin_universal_search_history_v1";

const readRecentSearches = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(ADMIN_SEARCH_HISTORY_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((item) => typeof item === "string" && item.trim()) : [];
  } catch {
    return [];
  }
};

const storeRecentSearch = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return;

  const next = [normalized, ...readRecentSearches().filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 6);
  localStorage.setItem(ADMIN_SEARCH_HISTORY_KEY, JSON.stringify(next));
};

const buildSearchPath = (basePath, query) => {
  const normalized = String(query || "").trim();
  if (!normalized) return basePath;
  return `${basePath}?search=${encodeURIComponent(normalized)}`;
};

const normalizeEntityResults = (items, type, query) => {
  const safeItems = Array.isArray(items) ? items : [];

  return safeItems.map((item, index) => {
    if (type === "order") {
      return {
        id: item._id || item.id || item.orderId || `order-${index}`,
        type,
        title: item.orderId || item.id || "Order",
        subtitle: [item.customerName, item.restaurant].filter(Boolean).join(" • "),
        meta: item.status || item.paymentStatus || "Order",
        path: buildSearchPath("/admin/orders/all", item.orderId || query),
      };
    }

    if (type === "customer") {
      return {
        id: item._id || item.id || item.email || `customer-${index}`,
        type,
        title: item.name || "Customer",
        subtitle: [item.email, item.phone].filter(Boolean).join(" • "),
        meta: "Customer",
        path: buildSearchPath("/admin/customers", item.email || item.phone || item.name || query),
      };
    }

    if (type === "restaurant") {
      return {
        id: item._id || item.id || item.name || `restaurant-${index}`,
        type,
        title: item.name || "Restaurant",
        subtitle: [item.ownerName, item.phone || item.ownerPhone].filter(Boolean).join(" • "),
        meta: "Restaurant",
        path: buildSearchPath("/admin/restaurants", item.name || item.ownerName || query),
      };
    }

    if (type === "delivery") {
      return {
        id: item._id || item.id || item.email || `delivery-${index}`,
        type,
        title: item.name || "Delivery Partner",
        subtitle: [item.email, item.phone].filter(Boolean).join(" • "),
        meta: "Delivery",
        path: buildSearchPath("/admin/delivery-partners", item.name || item.phone || item.email || query),
      };
    }

    return null;
  }).filter(Boolean);
};

const flattenAdminNavigation = () => {
  const items = [];

  const synonymMap = {
    "users": ["customers", "clients", "people"],
    "products": ["foods", "items", "menu", "dishes"],
    "revenue": ["transaction", "earnings", "gross", "income"],
    "earnings": ["revenue", "withdraw", "wallet"],
    "settings": ["business setup", "configuration", "theme", "pages"],
    "zones": ["location", "service area", "maps"],
    "notifications": ["bell", "push", "alerts"],
    "gst": ["tax", "tax report", "vat"],
    "tax": ["gst", "vat", "fees"],
  };

  sidebarMenuData.forEach((section) => {
    const sectionLabel = section.label.toLowerCase();
    
    if (section.type === "link") {
      const keywords = [sectionLabel];
      // Apply synonyms
      Object.entries(synonymMap).forEach(([syn, targets]) => {
        if (targets.some(t => sectionLabel.includes(t)) || sectionLabel.includes(syn)) {
          keywords.push(syn);
        }
      });

      items.push({
        label: section.label,
        path: section.path,
        section: "Quick Access",
        keywords,
      });
      return;
    }

    section.items?.forEach((item) => {
      const itemLabel = item.label.toLowerCase();
      const keywords = [itemLabel, sectionLabel];

      // Apply synonyms
      Object.entries(synonymMap).forEach(([syn, targets]) => {
        if (targets.some(t => itemLabel.includes(t) || sectionLabel.includes(t)) || 
            itemLabel.includes(syn) || sectionLabel.includes(syn)) {
          keywords.push(syn);
        }
      });

      if (item.type === "link") {
        items.push({
          label: item.label,
          path: item.path,
          section: section.label,
          keywords,
        });
        return;
      }

      item.subItems?.forEach((subItem) => {
        const subLabel = subItem.label.toLowerCase();
        const subKeywords = [...keywords, subLabel];

        // Apply synonyms to subItems too
        Object.entries(synonymMap).forEach(([syn, targets]) => {
          if (targets.some(t => subLabel.includes(t)) || subLabel.includes(syn)) {
            subKeywords.push(syn);
          }
        });

        items.push({
          label: subItem.label,
          path: subItem.path,
          section: `${section.label} / ${item.label}`,
          keywords: subKeywords,
        });
      });
    });
  });

  // Ensure the 4 specific Quick Action words always return their primary targets
  const quickActions = [
    { label: "Orders", path: "/admin/orders/all", section: "Quick Access", keywords: ["orders", "all orders"] },
    { label: "Users", path: "/admin/customers", section: "Quick Access", keywords: ["users", "customers", "clients"] },
    { label: "Products", path: "/admin/foods", section: "Quick Access", keywords: ["products", "foods", "items"] },
    { label: "Reports", path: "/admin/transaction-report", section: "Quick Access", keywords: ["reports", "transaction", "revenue"] },
  ];

  // Add them if they don't already exist or as high-priority matches
  quickActions.forEach(qa => {
    if (!items.find(i => i.path === qa.path)) {
      items.push(qa);
    }
  });

  return items;
};

export default function AdminNavbar({ onMenuClick }) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminData, setAdminData] = useState(null);
  const [businessSettings, setBusinessSettings] = useState(null);
  const [recentSearches, setRecentSearches] = useState(() => readRecentSearches());
  const [liveResults, setLiveResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);
  const navigationResults = useMemo(() => {
    return flattenAdminNavigation().filter((item) => {
      if (!searchQuery.trim()) return false;

      const query = searchQuery.toLowerCase().trim();
      return (
        item.label.toLowerCase().includes(query) ||
        item.section.toLowerCase().includes(query) ||
        item.path.toLowerCase().includes(query) ||
        item.keywords?.some((k) => k.includes(query))
      );
    }).map((item, index) => ({
      id: `nav-${index}-${item.path}`,
      type: "navigation",
      title: item.label,
      subtitle: item.path,
      meta: item.section,
      path: item.path,
    }));
  }, [searchQuery]);

  const searchResults = useMemo(() => {
    const seen = new Set();
    return [...liveResults, ...navigationResults].filter((item) => {
      const key = `${item.type}-${item.title}-${item.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [liveResults, navigationResults]);

  const handleSearchNavigate = (path, term = searchQuery) => {
    if (term.trim()) {
      storeRecentSearch(term);
      setRecentSearches(readRecentSearches());
    }
    setSearchOpen(false);
    navigate(path);
  };

  // Load admin data from localStorage
  useEffect(() => {
    const loadAdminData = () => {
      try {
        const adminUserStr = localStorage.getItem('admin_user');
        if (adminUserStr) {
          const adminUser = JSON.parse(adminUserStr);
          setAdminData(adminUser);
        }
      } catch (error) {
        console.error('Error loading admin data:', error);
      }
    };

    loadAdminData();

    // Listen for auth changes
    const handleAuthChange = () => {
      loadAdminData();
    };
    window.addEventListener('adminAuthChanged', handleAuthChange);

    return () => {
      window.removeEventListener('adminAuthChanged', handleAuthChange);
    };
  }, []);

  // Load business settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await loadBusinessSettings();
        if (settings) {
          setBusinessSettings(settings);
        } else {
          // Try to get from cache
          const cached = getCachedSettings();
          if (cached) {
            setBusinessSettings(cached);
          }
        }
      } catch (error) {
        console.warn('Error loading business settings in navbar:', error);
      }
    };

    loadSettings();

    // Listen for business settings updates
    const handleSettingsUpdate = () => {
      loadSettings();
    };
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
    };
  }, []);

  // Keyboard shortcut for search (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  // Focus search input when modal opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    setRecentSearches(readRecentSearches());
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) {
      setLiveResults([]);
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const [ordersRes, customersRes, restaurantsRes, deliveryRes] = await Promise.allSettled([
          adminAPI.getOrders({ page: 1, limit: 5, search: trimmedQuery }),
          adminAPI.getUsers({ offset: 0, limit: 5, search: trimmedQuery }),
          adminAPI.getRestaurants({ page: 1, limit: 5, search: trimmedQuery }),
          adminAPI.getDeliveryPartners({ page: 1, limit: 5, search: trimmedQuery }),
        ]);

        if (isCancelled) return;

        const nextResults = [
          ...(ordersRes.status === "fulfilled" ? normalizeEntityResults(ordersRes.value?.data?.data?.orders, "order", trimmedQuery) : []),
          ...(customersRes.status === "fulfilled" ? normalizeEntityResults(customersRes.value?.data?.data?.users, "customer", trimmedQuery) : []),
          ...(restaurantsRes.status === "fulfilled" ? normalizeEntityResults(restaurantsRes.value?.data?.data?.restaurants, "restaurant", trimmedQuery) : []),
          ...(deliveryRes.status === "fulfilled" ? normalizeEntityResults(deliveryRes.value?.data?.data?.deliveryPartners, "delivery", trimmedQuery) : []),
        ];

        setLiveResults(nextResults);
      } catch (error) {
        if (!isCancelled) {
          console.error("Admin universal search failed:", error);
          setLiveResults([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchOpen, searchQuery]);

  // Handle logout
  const handleLogout = async () => {
    try {
      // Call backend logout API to clear refresh token cookie
      try {
        await adminAPI.logout();
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        console.warn("Logout API call failed, continuing with local cleanup:", apiError);
      }

      // Clear admin authentication data from localStorage
      clearModuleAuth('admin');
      localStorage.removeItem('admin_accessToken');
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_user');

      // Clear sessionStorage if any
      sessionStorage.removeItem('adminAuthData');

      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event('adminAuthChanged'));

      // Navigate to admin login page
      navigate('/admin/login', { replace: true });
    } catch (error) {
      // Even if there's an error, we should still clear local data and logout
      console.error("Error during logout:", error);

      // Clear local data anyway
      clearModuleAuth('admin');
      localStorage.removeItem('admin_accessToken');
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_user');
      sessionStorage.removeItem('adminAuthData');
      window.dispatchEvent(new Event('adminAuthChanged'));

      // Navigate to login
      navigate('/admin/login', { replace: true });
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left: Logo and Mobile Menu */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-md text-neutral-700 hover:bg-neutral-100 hover:text-black transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-24 h-12 rounded-lg bg-white flex items-center justify-center ring-neutral-200">
                {businessSettings?.logo?.url ? (
                  <img
                    src={businessSettings.logo.url}
                    alt={businessSettings.companyName || "Company"}
                    className="w-24 h-10 object-contain"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : businessSettings?.companyName ? (
                  <span className="text-sm font-semibold text-neutral-700 px-2 truncate">
                    {businessSettings.companyName}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 flex justify-center max-w-md mx-8">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-100 text-neutral-600 cursor-pointer hover:bg-neutral-200 transition-colors w-full border border-neutral-200"
            >
              <Search className="w-4 h-4 text-neutral-700" />
              <span className="text-sm flex-1 text-left text-neutral-700">Search</span>
              <span className="text-xs px-2 py-0.5 rounded bg-white text-neutral-600 border border-neutral-200">
                Ctrl+K
              </span>
            </button>
          </div>

          {/* Right: Notifications and User Profile */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-72 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 text-neutral-900"
              >
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-neutral-100 focus:bg-neutral-100"
                  onClick={() => navigate("/admin/push-notification")}
                >
                  <Bell className="mr-2 w-4 h-4" />
                  <span>Push notifications</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-neutral-100 focus:bg-neutral-100"
                  onClick={() => navigate("/admin/notification-channels")}
                >
                  <Settings className="mr-2 w-4 h-4" />
                  <span>Notification channels</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 pl-3 border-l border-neutral-200 cursor-pointer hover:bg-neutral-100 rounded-md px-2 py-1 transition-colors">

                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-neutral-900">
                      {adminData?.name || "Admin User"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {adminData?.email
                        ? (() => {
                          const [local = "", domain = ""] = String(adminData.email).split("@");
                          if (!local || !domain) return adminData.email;
                          const maskedCount = Math.max(0, Math.min(local.length - 1, 5));
                          const firstChar = local.slice(0, 1);
                          return `${firstChar}${"*".repeat(maskedCount)}@${domain}`;
                        })()
                        : "admin@example.com"}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-700 hidden md:block" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 text-neutral-900 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              >
                <div className="p-4 border-b border-neutral-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-300">
                      {adminData?.profileImage ? (
                        <img
                          src={adminData.profileImage && adminData.profileImage.trim() ? adminData.profileImage : undefined}
                          alt={adminData.name || "Admin"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-semibold text-neutral-600">
                          {adminData?.name
                            ? adminData.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .substring(0, 2)
                            : "AD"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {adminData?.name || "Admin User"}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {adminData?.email
                          ? (() => {
                            const [local = "", domain = ""] = String(adminData.email).split("@");
                            if (!local || !domain) return adminData.email;
                            const maskedCount = Math.max(0, Math.min(local.length - 1, 5));
                            const firstChar = local.slice(0, 1);
                            return `${firstChar}${"*".repeat(maskedCount)}@${domain}`;
                          })()
                          : "admin@example.com"}
                      </p>
                    </div>
                  </div>
                </div>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-neutral-100 focus:bg-neutral-100"
                    onClick={() => navigate("/admin/profile")}
                  >
                    <User className="mr-2 w-4 h-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-neutral-100 focus:bg-neutral-100"
                    onClick={() => navigate("/admin/settings")}
                  >
                    <Settings className="mr-2 w-4 h-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 hover:bg-red-50 focus:bg-red-50"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 w-4 h-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl p-0 bg-white opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 ease-in-out data-[state=open]:scale-100 data-[state=closed]:scale-100 border border-neutral-200">
          <DialogHeader className="p-6 pb-4 border-b border-neutral-200">
            <DialogTitle className="text-xl font-semibold text-neutral-900">
              Universal Search
            </DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search orders, users, products, reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-3 text-base border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-500 focus:border-black focus:ring-black"
              />
            </div>

            {searchQuery.trim() === "" ? (
              <div className="space-y-4">
                <div className="text-sm text-neutral-500 mb-4">Quick Actions</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Package, label: "Orders", path: "/admin/orders/all" },
                    { icon: Users, label: "Users", path: "/admin/customers" },
                    { icon: UtensilsCrossed, label: "Products", path: "/admin/foods" },
                    { icon: FileText, label: "Reports", path: "/admin/transaction-report" },
                  ].map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        handleSearchNavigate(action.path, action.label);
                      }}
                      className="flex items-center gap-3 p-4 rounded-lg border border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 transition-all group"
                    >
                      <div className="p-2 rounded-md bg-black text-white group-hover:scale-110 transition-transform">
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-neutral-900">{action.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-neutral-200">
                  <p className="text-xs text-neutral-500 mb-2">Recent Searches</p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.length === 0 ? (
                      <span className="text-xs text-neutral-400">Your recent admin searches will appear here.</span>
                    ) : recentSearches.map((term, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSearchQuery(term)}
                        className="px-3 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 rounded-full text-neutral-700 transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {isSearching && (
                  <div className="flex items-center gap-2 text-sm text-neutral-500 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching admin data...</span>
                  </div>
                )}
                {searchResults.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                    <p className="text-sm text-neutral-500">No results found for "{searchQuery}"</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-neutral-600 mb-3">
                      {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
                    </div>
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleSearchNavigate(result.path, searchQuery);
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-lg border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all text-left"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-neutral-900">{result.title}</p>
                            <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded">
                              {result.meta}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 mt-1">{result.subtitle}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {result.type !== "navigation" && (
                            <Clock3 className="w-4 h-4 text-neutral-300" />
                          )}
                          <ArrowRight className="w-4 h-4 text-neutral-400" />
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
