import { useState, useEffect, useRef } from "react";
import { Send, Loader2, BookmarkPlus, Sparkles, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Api } from "../../api/client";
import type { ChatMessage } from "../../types";

export function ChatPane({ api, refreshKey, enabledSourceIds, onSaveToNote }: { api: Api; refreshKey: number; enabledSourceIds: Set<number>; onSaveToNote: (content: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [followups, setFollowups] = useState<string[]>([]);
  const [loadingFollowups, setLoadingFollowups] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingTeachRef = useRef<string | null>(null);

  useEffect(() => {
    api.getMessages().then((msgs) => {
      setMessages(msgs);
      // Restore follow-up suggestions for existing conversations
      if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
        setLoadingFollowups(true);
        api.getFollowups()
          .then(setFollowups)
          .catch(() => setFollowups([]))
          .finally(() => setLoadingFollowups(false));
      }
    }).catch(() => {});
  }, [refreshKey]);

  // Fetch suggestions when chat is empty and sources exist
  useEffect(() => {
    if (messages.length === 0 && enabledSourceIds.size > 0) {
      setLoadingSuggestions(true);
      api.getSuggestions()
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
        .finally(() => setLoadingSuggestions(false));
    } else {
      setSuggestions([]);
    }
  }, [messages.length, enabledSourceIds.size]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, followups]);

  const SLASH_COMMANDS: Record<string, string> = {
    "/new": "Clear the chat and start a fresh conversation",
    "/restore": "Restore all previous messages",
    "/teach": "Explain a topic with clarity and intuition — usage: /teach <topic>",
    "/help": "Show available commands",
  };

  const handleSlashCommand = (command: string): boolean => {
    const cmd = command.toLowerCase().trim();

    if (cmd === "/new") {
      api.resetChat().then(() => setMessages([])).catch(() => {});
      return true;
    }

    if (cmd === "/restore") {
      api.restoreChat().then(() => {
        api.getMessages().then(setMessages).catch(() => {});
      }).catch(() => {});
      return true;
    }

    if (cmd.startsWith("/teach")) {
      const topic = command.replace(/^\/teach\s*/i, "").trim();
      if (!topic) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: "assistant",
            content: "Please provide a topic. Usage: **/teach** `<topic or question>`",
            sources_cited: null,
            created_at: new Date().toISOString(),
          },
        ]);
        return true;
      }
      // Store the enriched prompt, let handleSend continue with original text
      pendingTeachRef.current = `Explain this topic as if you are a world-class teacher who combines Andrej Karpathy's clarity and intuition for complex technical ideas and Richard Feynman's ability to simplify without dumbing down.

Follow these rules:
1. Start with a plain-language explanation a smart 12-year-old could understand.
2. Then give a slightly more technical explanation for a college student.
3. Use analogies, metaphors, and real-world examples.
4. Avoid jargon unless you immediately explain it.
5. Break the idea into small logical steps instead of big jumps.
6. Include a short "why this matters" section.
7. End with one intuitive mental model or visual description I can remember.
8. If useful, add a tiny example or mini scenario.
9. For deeper technical clarity, provide the underlying mechanics, but keep them approachable.
10. For product/engineering context, include how this concept appears in real software systems or products.
11. End with a one-sentence "sticky summary" I could tweet.

The topic to teach: ${topic}`;
      return false; // let handleSend continue
    }

    if (cmd === "/help") {
      const helpText = Object.entries(SLASH_COMMANDS)
        .map(([cmd, desc]) => `**${cmd}** — ${desc}`)
        .join("\n");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: `Available commands:\n\n${helpText}`,
          sources_cited: null,
          created_at: new Date().toISOString(),
        },
      ]);
      return true;
    }

    if (cmd.startsWith("/")) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: `Unknown command \`${cmd}\`. Type **/help** for available commands.`,
          sources_cited: null,
          created_at: new Date().toISOString(),
        },
      ]);
      return true;
    }

    return false;
  };

  const handleSend = async (e?: React.FormEvent, overrideContent?: string) => {
    if (e) e.preventDefault();
    const userContent = overrideContent?.trim() || input.trim();
    if (!userContent || loading) return;
    setInput("");

    // Handle slash commands locally
    if (userContent.startsWith("/")) {
      if (!handleSlashCommand(userContent)) {
        // handleSlashCommand returned false — check if a /teach prompt is pending
      } else {
        return;
      }
    }

    // Determine what to send to the API (may be enriched by /teach)
    const apiContent = pendingTeachRef.current || userContent;
    pendingTeachRef.current = null;
    const displayContent = userContent.startsWith("/teach") ? userContent.replace(/^\/teach\s*/i, "").trim() : userContent;

    setSuggestions([]);
    setFollowups([]);

    // Optimistic user message
    const tempUser: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: displayContent,
      sources_cited: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);
    setLoading(true);

    try {
      const sourceIds = enabledSourceIds.size > 0 ? Array.from(enabledSourceIds) : undefined;
      await api.sendMessage(apiContent, sourceIds);
      // Refresh all messages to get proper IDs
      const updated = await api.getMessages();
      setMessages(updated);
      // Fetch follow-up suggestions in the background
      setLoadingFollowups(true);
      api.getFollowups()
        .then(setFollowups)
        .catch(() => setFollowups([]))
        .finally(() => setLoadingFollowups(false));
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
          <div className="flex items-center justify-center h-full">
            {loadingSuggestions ? (
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <Sparkles size={20} className="animate-pulse" />
                <span className="text-sm">Generating suggestions...</span>
              </div>
            ) : suggestions.length > 0 ? (
              <div className="flex flex-col items-center gap-3 max-w-sm w-full px-4">
                <div className="flex items-center gap-1.5 text-gray-400 text-sm mb-1">
                  <Sparkles size={14} />
                  <span>Try asking:</span>
                </div>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(undefined, s)}
                    className="w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-xl text-sm text-gray-200 transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-gray-500 text-sm">Ask a question about your sources...</span>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md whitespace-pre-wrap"
                  : "bg-gray-800 text-gray-100 rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-code:text-blue-300 prose-a:text-blue-400">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
              {msg.sources_cited && (
                <div className="mt-2 pt-2 border-t border-gray-700/50 text-xs text-gray-400">
                  📚 Sources: {JSON.parse(msg.sources_cited).join(", ")}
                </div>
              )}
            </div>
            {msg.role === "assistant" && (
              <div className="mt-1 flex items-center gap-1">
                <button
                  onClick={() => onSaveToNote(msg.content)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg transition-colors"
                >
                  <BookmarkPlus size={12} />
                  Save to Note
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(msg.content);
                    setCopiedId(msg.id);
                    setTimeout(() => setCopiedId(null), 2000);
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg transition-colors"
                >
                  {copiedId === msg.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  {copiedId === msg.id ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 px-4 py-2.5 rounded-2xl rounded-bl-md">
              <Loader2 size={16} className="animate-spin text-gray-400" />
            </div>
          </div>
        )}
        {!loading && (loadingFollowups || followups.length > 0) && (
          <div className="flex flex-col items-start gap-2 mt-2">
            {loadingFollowups ? (
              <div className="flex items-center gap-1.5 text-gray-500 text-xs px-1">
                <Sparkles size={12} className="animate-pulse" />
                <span>Thinking of follow-ups...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-gray-500 text-xs px-1">
                  <Sparkles size={12} />
                  <span>Follow up:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {followups.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(undefined, f)}
                      className="px-3 py-2 bg-gray-800/60 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-xl text-xs text-gray-300 transition-colors cursor-pointer text-left max-w-xs"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => handleSend(e)} className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your sources or type /help for commands"
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
