import { useMemo, useState } from "react"
import { Search, Info, Settings } from "lucide-react"
import { toast } from "sonner"
import { conversationsDummy } from "../data/conversationsDummy"

export default function Chattings() {
  const [activeTab, setActiveTab] = useState("customer")
  const [searchQuery, setSearchQuery] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const [messages, setMessages] = useState({})
  const [selectedConversation, setSelectedConversation] = useState(null)

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const source = Array.isArray(conversationsDummy) ? conversationsDummy : []
    return source
      .filter((conversation) => {
        const type = (conversation.type || "customer").toLowerCase()
        return type === activeTab
      })
      .filter((conversation) => {
        if (!query) return true
        const name = (conversation.name || "").toLowerCase()
        const phone = (conversation.phone || "").toLowerCase()
        const lastMessage = (conversation.lastMessage || "").toLowerCase()
        return name.includes(query) || phone.includes(query) || lastMessage.includes(query)
      })
  }, [activeTab, searchQuery])

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation) return

    const convId = selectedConversation.id
    const newMessage = {
      id: Date.now(),
      text: messageInput,
      timestamp: "Just now",
      sender: "admin"
    }

    setMessages(prev => ({
      ...prev,
      [convId]: [...(prev[convId] || []), newMessage]
    }))
    setMessageInput("")
    toast.success("Message sent")
  }

  const handleProfileClick = (conv) => {
    toast.info(`Viewing profile for ${conv.name}`)
    // In a real app, this would navigate to a profile page
  }

  const handleSettingsClick = () => {
    toast.info("Opening chat settings")
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 h-[calc(100vh-8rem)]">
            {/* Left Panel - Conversation List */}
            <div className="border-r border-slate-200 flex flex-col">
              <div className="p-6 border-b border-slate-200">
                <h1 className="text-2xl font-bold text-slate-900 mb-4">Conversation List</h1>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search by name or phone"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200">
                  <button
                    onClick={() => setActiveTab("customer")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "customer"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Customer
                  </button>
                  <button
                    onClick={() => setActiveTab("restaurant")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "restaurant"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Restaurant
                  </button>
                </div>
              </div>

              {/* Conversation List */}
              <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-6">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <Info className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">No conversations found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredConversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        onClick={() => setSelectedConversation(conversation)}
                        className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${selectedConversation?.id === conversation.id ? "bg-blue-50" : ""
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProfileClick(conversation);
                            }}
                            className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all"
                          >
                            {conversation.avatar ? (
                              <img
                                src={conversation.avatar}
                                alt={conversation.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-lg">👤</span>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-sm font-semibold text-slate-900 truncate">
                                {conversation.name}
                              </h3>
                              <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                                {conversation.timestamp}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate mb-1">
                              {conversation.phone}
                            </p>
                            <p className="text-sm text-slate-600 truncate">
                              {conversation.lastMessage}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Conversation View */}
            <div className="flex flex-col relative">
              {selectedConversation ? (
                <>
                  {/* Conversation Header */}
                  <div className="p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleProfileClick(selectedConversation)}
                        className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all"
                      >
                        {selectedConversation.avatar ? (
                          <img
                            src={selectedConversation.avatar}
                            alt={selectedConversation.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">👤</span>
                        )}
                      </button>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{selectedConversation.name}</h2>
                        <p className="text-sm text-slate-500">{selectedConversation.phone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-4">
                      {/* Original last message as history */}
                      <div className="flex justify-start">
                        <div className="max-w-[70%] bg-slate-100 rounded-lg p-3">
                          <p className="text-sm text-slate-900">{selectedConversation.lastMessage}</p>
                          <p className="text-xs text-slate-500 mt-1">{selectedConversation.timestamp}</p>
                        </div>
                      </div>

                      {/* User Sent Messages */}
                      {(messages[selectedConversation.id] || []).map((msg) => (
                        <div key={msg.id} className="flex justify-end">
                          <div className="max-w-[70%] bg-blue-600 text-white rounded-lg p-3">
                            <p className="text-sm">{msg.text}</p>
                            <p className="text-[10px] opacity-70 mt-1 text-right">{msg.timestamp}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Message Input */}
                  <div className="p-6 border-t border-slate-200">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                      }}
                      className="flex items-center gap-3"
                    >
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                      <button
                        type="submit"
                        className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all"
                      >
                        Send
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                      <Info className="w-12 h-12 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-600">Please select a user to view the conversation.</p>
                  </div>
                </div>
              )}

              {/* Settings Icon */}
              <button
                onClick={handleSettingsClick}
                className="absolute top-6 right-6 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                title="Chat Settings"
              >
                <Settings className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
