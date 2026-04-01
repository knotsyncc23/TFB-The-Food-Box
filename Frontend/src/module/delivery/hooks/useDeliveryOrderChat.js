import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { deliveryAPI } from '@/lib/api';
import { API_BASE_URL } from '@/lib/api/config.js';

const backendUrl = API_BASE_URL?.replace('/api', '') || 'http://localhost:5000';

export const QUICK_MESSAGES = [
  'I am near your location',
  'Please come outside',
  'Order picked up',
  'Reached restaurant',
  'Delivered successfully'
];

/**
 * Hook for delivery partner order chat.
 */
export function useDeliveryOrderChat(orderId, options = {}) {
  const { enabled = true } = options;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [chatAllowed, setChatAllowed] = useState(false);
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);

  const buildIncomingMessage = useCallback(
    (payload) => ({
      _id: payload._id,
      sender: payload.sender,
      message: payload.message,
      timestamp: payload.timestamp,
    }),
    []
  );

  const isMatchingMessage = useCallback((left, right) => {
    if (!left || !right) return false;
    if (
      left.sender !== right.sender ||
      (left.message || "").trim() !== (right.message || "").trim()
    ) {
      return false;
    }

    const leftTime = new Date(left.timestamp).getTime();
    const rightTime = new Date(right.timestamp).getTime();

    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return false;
    }

    return Math.abs(leftTime - rightTime) < 10000;
  }, []);

  const fetchChat = useCallback(async () => {
    if (!orderId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await deliveryAPI.getOrderChat(orderId);
      const data = res?.data?.data;
      if (!data) {
        setChatAllowed(false);
        setMessages([]);
        setOrder(null);
        return;
      }
      setOrder(data.order);
      setChatAllowed(!!data.chatAllowed);
      setMessages(Array.isArray(data.chat?.messages) ? data.chat.messages : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load chat');
      setMessages([]);
      setChatAllowed(false);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, enabled]);

  useEffect(() => {
    fetchChat();
  }, [fetchChat]);

  useEffect(() => {
    if (!orderId || !enabled) return undefined;

    const interval = window.setInterval(() => {
      fetchChat();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [orderId, enabled, fetchChat]);

  useEffect(() => {
    if (!orderId || !enabled) return;
    const socket = io(backendUrl, { transports: ['websocket', 'polling'], path: '/socket.io/' });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-order-chat', orderId);
    });

    socket.on('chat_message', (payload) => {
      if (!payload || (payload.orderMongoId !== orderId && payload.orderId !== orderId)) return;
      setMessages((prev) => {
        const incomingMessage = buildIncomingMessage(payload);
        const exactIndex = payload._id
          ? prev.findIndex((m) => String(m._id) === String(payload._id))
          : -1;

        if (exactIndex !== -1) return prev;

        const optimisticIndex = prev.findIndex(
          (m) => m._optimistic && isMatchingMessage(m, incomingMessage)
        );

        if (optimisticIndex !== -1) {
          return prev.map((message, index) =>
            index === optimisticIndex ? incomingMessage : message
          );
        }

        if (prev.some((m) => isMatchingMessage(m, incomingMessage))) {
          return prev;
        }

        return [...prev, incomingMessage];
      });
    });

    return () => {
      socket.emit('leave-order-chat', orderId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [orderId, enabled]);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text?.trim();
      if (!trimmed || !orderId || !chatAllowed) return { success: false };

      // Optimistic UI update: show message instantly for delivery partner
      const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticMessage = {
        _id: tempId,
        sender: "delivery",
        message: trimmed,
        timestamp: new Date().toISOString(),
        _optimistic: true,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        await deliveryAPI.sendOrderChatMessage(orderId, trimmed);
        // Real message will arrive via socket; duplicate guard will keep only one copy
        return { success: true };
      } catch (err) {
        // Roll back optimistic message on failure
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
        return {
          success: false,
          error: err?.response?.data?.message || err?.message,
        };
      }
    },
    [orderId, chatAllowed]
  );

  return { loading, error, order, chatAllowed, messages, sendMessage, refetch: fetchChat };
}
