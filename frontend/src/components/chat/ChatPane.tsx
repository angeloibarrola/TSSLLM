import { useState, useEffect, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { api } from "../../api/client";
import type { ChatMessage } from "../../types";

export function ChatPane({ enabledSourceIds }: { enabledSourceIds: Set<number> }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getMessages().then(setMessages).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userContent = input.trim();
    setInput("");

    // Optimistic user message
    const tempUser: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: userContent,
      sources_cited: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);
    setLoading(true);

    try {
      const sourceIds = enabledSourceIds.size > 0 ? Array.from(enabledSourceIds) : undefined;
      await api.sendMessage(userContent, sourceIds);
      // Refresh all messages to get proper IDs
      const updated = await api.getMessages();
      setMessages(updated);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          sources_cited: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Chat</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Ask a question about your sources...
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-gray-800 text-gray-100 rounded-bl-md"
              }`}
            >
              {msg.content}
              {msg.sources_cited && (
                <div className="mt-2 pt-2 border-t border-gray-700/50 text-xs text-gray-400">
                  📚 Sources: {JSON.parse(msg.sources_cited).join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 px-4 py-2.5 rounded-2xl rounded-bl-md">
              <Loader2 size={16} className="animate-spin text-gray-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your sources..."
            className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
