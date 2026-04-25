import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ChevronDown, Search, Mic, Bell, CheckCircle2, Tag, Gift, AlertCircle, Clock, BellOff, X, IndianRupee } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@food/components/ui/popover";
import { Badge } from "@food/components/ui/badge";
import { Avatar, AvatarFallback } from "@food/components/ui/avatar";
import foodIcon from "@food/assets/category-icons/food.png";
import quickIcon from "@food/assets/category-icons/quick.png";
import taxiIcon from "@food/assets/category-icons/taxi.png";
import hotelIcon from "@food/assets/category-icons/hotel.png";
import useNotificationInbox from "@food/hooks/useNotificationInbox";

const ICON_MAP = {
  CheckCircle2,
  Tag,
  Gift,
  AlertCircle
};

export default function HomeHeader({
  activeTab,
  setActiveTab,
  location,
  savedAddressText,
  handleLocationClick,
  handleSearchFocus,
  placeholderIndex,
  placeholders,
  vegMode = false,
  handleVegModeChange
}) {
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('food_user_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const {
    items: broadcastNotifications,
    unreadCount: broadcastUnreadCount,
    dismiss: dismissBroadcastNotification,
  } = useNotificationInbox("user", { limit: 20 });

  useEffect(() => {
    const syncNotifications = () => {
      const saved = localStorage.getItem('food_user_notifications');
      setNotifications(saved ? JSON.parse(saved) : []);
    };

    window.addEventListener('notificationsUpdated', syncNotifications);

    return () => window.removeEventListener('notificationsUpdated', syncNotifications);
  }, []);

  const mergedNotifications = useMemo(() => {
    const localItems = Array.isArray(notifications)
      ? notifications.map((item) => ({ ...item, source: "local" }))
      : [];
    const broadcastItems = (broadcastNotifications || []).map((item) => ({
      ...item,
      source: "broadcast",
      time: item.createdAt
        ? new Date(item.createdAt).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        : "Just now",
      type: "broadcast",
      icon: "Bell",
      iconColor: "text-blue-600",
    }));

    return [...broadcastItems, ...localItems].sort(
      (a, b) =>
        new Date(b.createdAt || b.timestamp || 0).getTime() -
        new Date(a.createdAt || a.timestamp || 0).getTime()
    );
  }, [broadcastNotifications, notifications]);

  const unreadCount = notifications.filter(n => !n.read).length + broadcastUnreadCount;

  const handleDeleteNotification = (id, source = "local") => {
    if (source === "broadcast") {
      dismissBroadcastNotification(id);
      return;
    }
    setNotifications((prev) => {
      const next = prev.filter((notification) => notification.id !== id);
      localStorage.setItem('food_user_notifications', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { count: next.filter((n) => !n.read).length } }));
      return next;
    });
  };

  return (
    <div className="relative pt-2 pb-0 px-4 transition-all duration-700 overflow-hidden bg-transparent shadow-none">
      {/* Subtle Artistic Glows - Adds depth without being 'boring' */}
      <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-[#7e3866]/5 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-[#48c479]/5 blur-[80px] rounded-full pointer-events-none" />

      {/* Main Header Content */}
      <div className="relative z-10 space-y-2.5">
        {/* Row 1: Location, Toggle, and Notifications */}
        <div className="flex items-center justify-between gap-3">
          {/* Location Selector */}
          <div
            className="flex items-center gap-2 cursor-pointer group min-w-0 flex-1"
            onClick={handleLocationClick}
          >
            <div className="bg-white/10 p-1 rounded-lg group-active:scale-95 transition-all">
              <MapPin className="h-3.5 w-3.5 text-white/90 fill-white/20" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[13px] font-black text-white truncate">
                  {(() => {
                    const topStr = location?.area || location?.mainTitle || (location?.address?.split(',')[0]) || "Select Location";
                    // If it looks like a latitude/longitude number, show "Current Location"
                    if (/^-?\d+(\.\d+)?$/.test(topStr.trim())) {
                      return "Current Location";
                    }
                    return topStr;
                  })()}
                </span>
                <ChevronDown className="h-3 w-3 text-white/70" />
              </div>
              <span className="text-[10px] font-medium text-white/80 truncate leading-tight mt-0.5">
                {(() => {
                  const addr = location?.address || savedAddressText || "";
                  const city = location?.city || "Indore";
                  const area = location?.area || "";
                  
                  let displayAddr = addr;
                  if (city) {
                    displayAddr = displayAddr.replace(new RegExp(`,?\\s*${city}\\s*`, 'gi'), '').trim();
                  }
                  if (area && area.length > 3) {
                    displayAddr = displayAddr.replace(new RegExp(`^${area},?\\s*`, 'i'), '').trim();
                  }
                  
                  // Check if it's just coordinates or essentially empty
                  if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(addr.trim()) || /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(displayAddr.trim())) {
                    return "Pinpoint location";
                  }
                  if (!displayAddr || displayAddr === ",") {
                    return "Pinpoint location"; // Fallback instead of saying "Base address" if it gets empty
                  }
                  return displayAddr;
                })()}
              </span>
              <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] leading-tight mt-1">
                {location?.city || "Indore"}
              </span>
            </div>
          </div>

          {/* Right Actions: Veg Toggle & Bell */}
          <div className="flex items-center gap-2.5">
            {/* Pure Veg Toggle */}
            <div 
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-all duration-300 ${vegMode ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/5'}`}
              onClick={() => handleVegModeChange?.(!vegMode)}
            >
              <div className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-colors ${vegMode ? 'border-white bg-white' : 'border-white/30'}`}>
                {vegMode && <div className="w-1 h-1 rounded-full bg-[#00b09b]" />}
              </div>
              <span className={`text-[8px] font-black uppercase tracking-tight ${vegMode ? 'text-white' : 'text-white/60'}`}>Veg</span>
            </div>
 
            <Popover>
              <PopoverTrigger asChild>
                <div className="h-8 w-8 relative flex items-center justify-center rounded-full bg-white/10 border border-white/10 cursor-pointer active:scale-90 transition-all">
                  <Bell className="h-4 w-4 text-white/90" />
                  {unreadCount > 0 && (
                    <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full border animate-pulse ${vegMode ? 'bg-orange-400 border-[#00b09b]' : 'bg-orange-400 border-[#7e3866]'}`} />
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 overflow-hidden border-none shadow-2xl rounded-2xl mt-2" align="end">
                <div className="bg-white dark:bg-gray-900">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      Notifications
                      {unreadCount > 0 && (
                        <Badge variant="secondary" className="bg-orange-100 text-[#7e3866] border-none text-[10px] h-4">
                          {unreadCount} New
                        </Badge>
                      )}
                    </h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {mergedNotifications.length > 0 ? (
                      mergedNotifications.slice(0, 5).map((notif) => {
                        const Icon = ICON_MAP[notif.icon] || Bell;
                        return (
                          <div key={notif.id} className="p-4 flex items-start gap-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 transition-colors">
                            <div className="mt-1 p-2 rounded-full bg-gray-100 text-[#7e3866]">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{notif.title}</p>
                               <p className="text-xs text-gray-500 line-clamp-1">{notif.message}</p>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center gap-2">
                        <BellOff className="h-10 w-10 text-gray-200" />
                        <p className="text-xs text-gray-400 font-medium">All caught up!</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 text-center">
                    <Link to="/food/user/notifications" className="text-xs font-bold text-gray-400">View All</Link>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div
          className="relative bg-white rounded-2xl flex items-center px-4 py-3 shadow-lg border border-black/5 cursor-pointer active:scale-[0.98] transition-all duration-300 max-w-[95%] mx-auto"
          onClick={handleSearchFocus}
        >
          <Search className="h-4.5 w-4.5 text-[#7e3866] mr-2 shrink-0" strokeWidth={3} />
          
          <div className="flex-1 overflow-hidden relative h-5">
            <AnimatePresence mode="wait">
              <motion.span
                key={placeholderIndex}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 text-sm font-bold text-gray-400 truncate flex items-center"
              >
                {placeholders?.[placeholderIndex] || 'Search'}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 pl-2">
            <div className="h-4 w-[1px] bg-gray-100" />
            <Mic className="h-4.5 w-4.5 text-[#7e3866]" />
          </div>
        </div>
      </div>
    </div>
  );
}
