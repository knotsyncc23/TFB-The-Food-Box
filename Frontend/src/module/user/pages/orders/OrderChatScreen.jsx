import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserOrderChat } from "../../hooks/useUserOrderChat";

function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function OrderChatScreen() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { loading, error, order, chatAllowed, messages, sendMessage } = useUserOrderChat(orderId, {
    enabled: !!orderId,
  });

  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text) => {
    const toSend = (text ?? inputValue)?.trim();
    if (!toSend || !chatAllowed || sending) return;

    setSending(true);
    const result = await sendMessage(toSend);
    setSending(false);

    if (result?.success) {
      setInputValue("");
      inputRef.current?.focus();
    }
  };

  const deliveryPartner = order?.deliveryPartnerId;
  const displayName =
    deliveryPartner?.name ||
    deliveryPartner?.fullName ||
    (deliveryPartner?.email ? deliveryPartner.email.split("@")[0] : "Delivery partner");

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-[#f6e9dc] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#ff8100] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-[#f6e9dc] flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-xl p-6 shadow-sm max-w-sm">
          <p className="text-gray-700 mb-4">{error}</p>
          <Button onClick={() => navigate(-1)} className="bg-[#ff8100] hover:bg-[#e67300] text-white">
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] flex flex-col">
      <div className="bg-white sticky top-0 z-50 rounded-b-3xl shadow-sm">
        <div className="px-4 py-2.5 md:py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#ff8100]/10 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-[#ff8100]" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <h1 className="text-sm md:text-base font-bold text-gray-900 truncate">Chat with {displayName}</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] md:text-xs text-[#ff8100] font-medium">Order #{order?.orderId || orderId}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    order?.status === "delivered" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {order?.status?.replace(/_/g, " ") || "Active"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!chatAllowed && order && (
        <div className="px-4 py-3">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-sm text-red-800">
            Chat closed. This order is no longer available for messaging.
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-24 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No messages yet.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg._id || `${msg.timestamp}-${msg.message?.slice(0, 8)}`}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2 ${
                msg.sender === "user"
                  ? "bg-[#ff8100] text-white rounded-br-md"
                  : "bg-white text-gray-900 shadow-sm rounded-bl-md"
              }`}
            >
              <p className="text-sm md:text-base break-words">{msg.message}</p>
              <p className={`text-[10px] mt-1 ${msg.sender === "user" ? "text-white/80" : "text-gray-500"}`}>
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {chatAllowed && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-30">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff8100]/50 focus:border-[#ff8100]"
              disabled={sending}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || sending}
              className="rounded-xl bg-[#ff8100] hover:bg-[#e67300] text-white px-4"
            >
              <Send className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
