import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api/config';
import { deliveryAPI } from '@/lib/api';
import { addDeliveryNotification } from '../utils/deliveryNotifications';
import alertSound from '@/assets/audio/alert.mp3';
import originalSound from '@/assets/audio/original.mp3';
import { toast } from 'sonner';

export const useDeliveryNotifications = ({ approvalOnly = false, suppressApproval = false } = {}) => {
  // CRITICAL: All hooks must be called unconditionally and in the same order every render
  // Order: useRef -> useState -> useEffect -> useCallback
  
  // Step 1: All refs first (unconditional)
  const socketRef = useRef(null);
  const audioRef = useRef(null);
  const newOrderRef = useRef(null);
  const lastKnownStatusRef = useRef(null);

  // Step 2: All state hooks (unconditional)
  const [newOrder, setNewOrder] = useState(null);
  const [orderReady, setOrderReady] = useState(null);
  const [bonusNotification, setBonusNotification] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deliveryPartnerId, setDeliveryPartnerId] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState(null);

  // Step 3: All callbacks before effects (unconditional)
  // Track user interaction for autoplay policy
  const userInteractedRef = useRef(false);
  
  const playNotificationSound = useCallback(() => {
    try {
      // Get current selected sound preference from localStorage
      const selectedSound = localStorage.getItem('delivery_alert_sound') || 'zomato_tone';
      const soundFile = selectedSound === 'original' ? originalSound : alertSound;
      
      // Update audio source if preference changed or initialize if not exists
      if (audioRef.current) {
        const currentSrc = audioRef.current.src;
        const newSrc = soundFile;
        // Check if source needs to be updated
        if (!currentSrc.includes(newSrc.split('/').pop())) {
          audioRef.current.pause();
          audioRef.current.src = newSrc;
          audioRef.current.load();
          console.log('🔊 Audio source updated to:', selectedSound === 'original' ? 'Original' : 'Zomato Tone');
        }
      } else {
        // Initialize audio if not exists
        audioRef.current = new Audio(soundFile);
        audioRef.current.volume = 0.7;
      }
      
      if (audioRef.current) {
        // Only play if user has interacted with the page (browser autoplay policy)
        if (!userInteractedRef.current) {
          console.log('🔇 Audio playback skipped - user has not interacted with page yet');
          return;
        }
        
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(error => {
          // Don't log autoplay policy errors as they're expected
          if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
            console.warn('Error playing notification sound:', error);
          }
        });
      }
    } catch (error) {
      // Don't log autoplay policy errors
      if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
        console.warn('Error playing sound:', error);
      }
    }
  }, []);

  // Step 4: All effects (unconditional hook calls, conditional logic inside)
  // Track user interaction for autoplay policy
  useEffect(() => {
    const handleUserInteraction = () => {
      userInteractedRef.current = true;
      // Remove listeners after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
    
    // Listen for user interaction
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);
  
  // Initialize audio on mount - use selected preference from localStorage
  useEffect(() => {
    // Get selected alert sound preference from localStorage
    const selectedSound = localStorage.getItem('delivery_alert_sound') || 'zomato_tone';
    const soundFile = selectedSound === 'original' ? originalSound : alertSound;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(soundFile);
      audioRef.current.volume = 0.7;
      console.log('🔊 Audio initialized with:', selectedSound === 'original' ? 'Original' : 'Zomato Tone');
    } else {
      // Update audio source if preference changed
      const currentSrc = audioRef.current.src;
      const newSrc = soundFile;
      if (!currentSrc.includes(newSrc.split('/').pop())) {
        audioRef.current.pause();
        audioRef.current.src = newSrc;
        audioRef.current.load();
        console.log('🔊 Audio updated to:', selectedSound === 'original' ? 'Original' : 'Zomato Tone');
      }
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []); // Note: This runs once on mount. To update dynamically, we'd need to listen to storage events

  // Fetch delivery partner ID
  useEffect(() => {
    const fetchDeliveryPartnerId = async () => {
      try {
        const response = await deliveryAPI.getCurrentDelivery();
        if (response.data?.success && response.data.data) {
          const deliveryPartner = response.data.data.user || response.data.data.deliveryPartner;
          if (deliveryPartner) {
            const id = deliveryPartner.id?.toString() || 
                      deliveryPartner._id?.toString() || 
                      deliveryPartner.deliveryId;
            if (id) {
              setDeliveryPartnerId(id);
              setDeliveryStatus(deliveryPartner.status?.toLowerCase?.() || null);
              console.log('✅ Delivery Partner ID fetched:', id);
            } else {
              console.warn('⚠️ Could not extract delivery partner ID from response');
            }
          } else {
            console.warn('⚠️ No delivery partner data in API response');
          }
        } else {
          console.warn('⚠️ Could not fetch delivery partner ID from API');
        }
      } catch (error) {
        console.error('Error fetching delivery partner:', error);
      }
    };
    fetchDeliveryPartnerId();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const handleStatusRefresh = async (showApprovalToast = false) => {
      try {
        const response = await deliveryAPI.getCurrentDelivery();
        if (!isMounted || !response.data?.success || !response.data.data) return;

        const deliveryPartner = response.data.data.user || response.data.data.deliveryPartner;
        const latestStatus = deliveryPartner?.status?.toLowerCase?.() || null;
        if (!latestStatus) return;

        const previousStatus = lastKnownStatusRef.current;
        lastKnownStatusRef.current = latestStatus;
        setDeliveryStatus(latestStatus);

        if (
          showApprovalToast &&
          ['approved', 'active'].includes(latestStatus) &&
          previousStatus &&
          previousStatus !== latestStatus &&
          !['approved', 'active'].includes(previousStatus)
        ) {
          addDeliveryNotification({
            type: 'account',
            title: 'Account approved',
            message: 'Your delivery account has been approved. You can start receiving orders now.',
            createdAt: new Date().toISOString(),
            read: false,
          });
          playNotificationSound();
          toast.success('Your delivery account is approved now.');
          window.dispatchEvent(new Event('deliveryProfileRefresh'));
        }
      } catch (error) {
        if (error?.response?.status !== 401) {
          console.warn('Unable to refresh delivery approval status:', error?.message || error);
        }
      }
    };

    handleStatusRefresh(false);
    const interval = window.setInterval(() => {
      handleStatusRefresh(true);
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [playNotificationSound]);

  // Socket connection effect
  useEffect(() => {
    if (!deliveryPartnerId) {
      console.log('⏳ Waiting for deliveryPartnerId...');
      return;
    }

    // Normalize backend URL - use simpler, more robust approach
    let backendUrl = API_BASE_URL;
    
    // Step 1: Extract protocol and hostname using URL parsing if possible
    try {
      const urlObj = new URL(backendUrl);
      // Remove /api from pathname
      let pathname = urlObj.pathname.replace(/^\/api\/?$/, '');
      // Reconstruct clean URL
      backendUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ''}${pathname}`;
    } catch (e) {
      // If URL parsing fails, use regex-based normalization
      // Remove /api suffix first
      backendUrl = backendUrl.replace(/\/api\/?$/, '');
      backendUrl = backendUrl.replace(/\/+$/, ''); // Remove trailing slashes
      
      // Normalize protocol - ensure exactly two slashes after protocol
      // Fix patterns: https:/, https:///, https://https://
      if (backendUrl.startsWith('https:') || backendUrl.startsWith('http:')) {
        // Extract protocol
        const protocolMatch = backendUrl.match(/^(https?):/i);
        if (protocolMatch) {
          const protocol = protocolMatch[1].toLowerCase();
          // Remove everything up to and including the first valid domain part
          const afterProtocol = backendUrl.substring(protocol.length + 1);
          // Remove leading slashes
          const cleanPath = afterProtocol.replace(/^\/+/, '');
          // Reconstruct with exactly two slashes
          backendUrl = `${protocol}://${cleanPath}`;
        }
      }
    }
    
    // Final cleanup: ensure exactly two slashes after protocol
    backendUrl = backendUrl.replace(/^(https?):\/+/gi, '$1://');
    backendUrl = backendUrl.replace(/\/+$/, ''); // Remove trailing slashes
    
    const socketUrl = `${backendUrl}/delivery`;
    
    console.log('🔌 Attempting to connect to Delivery Socket.IO:', socketUrl);
    console.log('🔌 Backend URL:', backendUrl);
    console.log('🔌 API_BASE_URL:', API_BASE_URL);
    console.log('🔌 Delivery Partner ID:', deliveryPartnerId);
    console.log('🔌 Environment:', import.meta.env.MODE);
    
    // Warn if trying to connect to localhost in production
    if (import.meta.env.MODE === 'production' && backendUrl.includes('localhost')) {
      console.error('❌ CRITICAL: Trying to connect Socket.IO to localhost in production!');
      console.error('💡 This means VITE_API_BASE_URL was not set during build time');
      console.error('💡 Current socketUrl:', socketUrl);
      console.error('💡 Current API_BASE_URL:', API_BASE_URL);
      console.error('💡 Fix: Rebuild frontend with: VITE_API_BASE_URL=https://your-backend-domain.com/api npm run build');
      console.error('💡 Note: Vite environment variables are embedded at BUILD TIME, not runtime');
      console.error('💡 You must rebuild and redeploy the frontend with correct VITE_API_BASE_URL');
      
      // Don't try to connect to localhost in production - it will fail
      setIsConnected(false);
      return;
    }
    
    // Validate backend URL format
    if (!backendUrl || !backendUrl.startsWith('http')) {
      console.error('❌ CRITICAL: Invalid backend URL format:', backendUrl);
      console.error('💡 API_BASE_URL:', API_BASE_URL);
      console.error('💡 Expected format: https://your-domain.com or http://localhost:5000');
      return; // Don't try to connect with invalid URL
    }
    
    // Validate socket URL format
    try {
      new URL(socketUrl); // This will throw if URL is invalid
    } catch (urlError) {
      console.error('❌ CRITICAL: Invalid Socket.IO URL:', socketUrl);
      console.error('💡 URL validation error:', urlError.message);
      console.error('💡 Backend URL:', backendUrl);
      console.error('💡 API_BASE_URL:', API_BASE_URL);
      return; // Don't try to connect with invalid URL
    }

    socketRef.current = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling'], // Start with polling only
      upgrade: false, // Disable WebSocket upgrade to prevent WebSocket connection errors
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      forceNew: false,
      autoConnect: true,
      auth: {
        token: localStorage.getItem('delivery_accessToken') || localStorage.getItem('accessToken')
      }
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Delivery Socket connected, deliveryPartnerId:', deliveryPartnerId);
      setIsConnected(true);
      
      if (deliveryPartnerId) {
        console.log('📢 Joining delivery room with ID:', deliveryPartnerId);
        socketRef.current.emit('join-delivery', deliveryPartnerId);
      }
    });

    socketRef.current.on('delivery-room-joined', (data) => {
      console.log('✅ Delivery room joined successfully:', data);
    });

    socketRef.current.on('connect_error', (error) => {
      // Only log if it's not a network/polling/websocket error (backend might be down or WebSocket not available)
      // Socket.IO will automatically retry connection and fall back to polling
      const isTransportError = error.type === 'TransportError' || 
                               error.message === 'xhr poll error' ||
                               error.message?.includes('WebSocket') ||
                               error.message?.includes('websocket') ||
                               error.description === 0; // WebSocket upgrade failures
      
      if (!isTransportError) {
        console.error('❌ Delivery Socket connection error:', error);
      } else {
        // Silently handle transport errors - backend might not be running or WebSocket not available
        // Socket.IO will automatically retry with exponential backoff and fall back to polling
        // Only log in development for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('⏳ Delivery Socket: WebSocket upgrade failed, using polling fallback');
        }
      }
      setIsConnected(false);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ Delivery Socket disconnected:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        socketRef.current.connect();
      }
    });

    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      
      if (deliveryPartnerId) {
        socketRef.current.emit('join-delivery', deliveryPartnerId);
      }
    });

    if (!approvalOnly) {
      socketRef.current.on('new_order', (orderData) => {
        if (!['active', 'approved'].includes(deliveryStatus || '')) {
          console.log('Ignoring new order notification for unverified delivery partner:', deliveryStatus);
          return;
        }
        console.log('📦 New order received via socket:', orderData);
        setNewOrder(orderData);
        playNotificationSound();
      });

      // New order available for ALL delivery boys - show in UI so it appears in available orders list in real time
      socketRef.current.on('new_order_available', (orderData) => {
        if (!['active', 'approved'].includes(deliveryStatus || '')) {
          console.log('Ignoring available-order notification for unverified delivery partner:', deliveryStatus);
          return;
        }
        console.log('📦 New order available (showing in UI):', orderData?.orderId || orderData?.orderMongoId, 'phase:', orderData?.phase);
        setNewOrder(orderData);
        playNotificationSound();
      });

      // When another delivery boy accepts an order, remove it from our available list immediately
      socketRef.current.on('order_accepted', (payload) => {
        const current = newOrderRef.current;
        if (!current) return;
        const match = (payload.orderId && (payload.orderId === current.orderId || payload.orderId === current.orderMongoId)) ||
          (payload.mongoId && (payload.mongoId === current.orderMongoId || payload.mongoId === current.mongoId || payload.mongoId === current._id));
        if (match) {
          console.log('📦 Order was accepted by another delivery partner, removing from list:', payload.orderId || payload.mongoId);
          setNewOrder(null);
        }
      });

      socketRef.current.on('play_notification_sound', (data) => {
        console.log('🔔 Sound notification:', data);
        playNotificationSound();
      });

      socketRef.current.on('order_ready', (orderData) => {
        console.log('✅ Order ready notification received via socket:', orderData);
        setOrderReady(orderData);
        playNotificationSound();
      });
    }

    if (!suppressApproval) {
      socketRef.current.on('delivery_partner_approved', (payload) => {
      console.log('✅ Delivery approval event received:', payload);
      setDeliveryStatus('approved');
      lastKnownStatusRef.current = 'approved';
      addDeliveryNotification({
        type: 'account',
        title: payload?.title || 'Account approved',
        message: payload?.message || 'Your delivery account has been approved. You can start receiving orders now.',
        createdAt: new Date().toISOString(),
        read: false,
      });
      playNotificationSound();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(payload?.title || 'Account approved', {
            body: payload?.message || 'Your delivery account has been approved. You can start receiving orders now.',
            icon: '/favicon.ico',
            tag: `delivery-approved-${payload?.mongoId || payload?.deliveryId || 'account'}`,
          });
        } catch (notificationError) {
          console.warn('Unable to show browser approval notification:', notificationError);
        }
      }
      toast.success('Your delivery account is approved now.');
      window.dispatchEvent(new Event('deliveryProfileRefresh'));
      });
    }

    socketRef.current.on('delivery_bonus', (bonusData) => {
      const amount = Number(bonusData?.amount || 0);
      const notification = addDeliveryNotification({
        type: 'bonus',
        title: bonusData?.title || 'Bonus added',
        message: bonusData?.body || `You received a bonus of Rs. ${amount.toFixed(2)}`,
        amount,
        reference: bonusData?.reference || null,
        transactionId: bonusData?.transactionId || null,
        createdAt: bonusData?.createdAt || new Date().toISOString(),
        read: false,
      });

      setBonusNotification(notification);
      playNotificationSound();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [approvalOnly, deliveryPartnerId, deliveryStatus, playNotificationSound, suppressApproval]);

  // Keep ref in sync so order_accepted listener can see current newOrder
  useEffect(() => {
    newOrderRef.current = newOrder;
  }, [newOrder]);

  // Helper functions
  const clearNewOrder = () => {
    setNewOrder(null);
  };

  const clearOrderReady = () => {
    setOrderReady(null);
  };

  const clearBonusNotification = () => {
    setBonusNotification(null);
  };

  return {
    newOrder,
    clearNewOrder,
    orderReady,
    clearOrderReady,
    bonusNotification,
    clearBonusNotification,
    isConnected,
    playNotificationSound
  };
};




