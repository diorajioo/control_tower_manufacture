"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FloatingChatProps {
  filters?: {
    plant: string;
    startDate: string;
    endDate: string;
  };
}

const QUICK_ACTIONS = [
  "Kenapa OEE turun?",
  "Analisa lead time bulan ini",
  "Plant mana bulk loss tertinggi?",
  "Tren RFT 3 bulan terakhir",
];

export function FloatingChat({ filters }: FloatingChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading || streaming) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context: filters }),
      });

      if (!res.ok || !res.body) throw new Error("Gagal mendapatkan respons");

      // Mulai streaming — tambah pesan kosong dulu, isi sedikit demi sedikit
      setMessages([...next, { role: "assistant", content: "" }]);
      setLoading(false);
      setStreaming(true);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Maaf, terjadi kesalahan. Coba lagi beberapa saat." },
      ]);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-96 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
          style={{ height: "540px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-brand-800 text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-md p-1">
                <Sparkles size={13} className="text-blue-200" />
              </div>
              <span className="text-sm font-semibold">AI Analyst</span>
              <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full text-blue-200 font-medium">
                Groq · llama-3.3-70b
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Context pill */}
          {filters?.plant && (
            <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100 shrink-0">
              <span className="text-[11px] text-gray-500">
                Konteks: <span className="font-medium text-gray-700">{filters.plant}</span>
                {" · "}{filters.startDate} s/d {filters.endDate}
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="bg-brand-50 rounded-full p-4">
                  <Sparkles size={24} className="text-brand-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Tanya tentang manufacturing</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Analisa KPI, deteksi anomali, atau cari pola dari data Snowflake langsung.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full mt-1">
                  {QUICK_ACTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs text-left bg-gray-50 hover:bg-brand-50 hover:text-brand-700 border border-gray-200 hover:border-brand-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-brand-800 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  )}
                >
                  {msg.content}
                  {streaming && i === messages.length - 1 && msg.role === "assistant" && (
                    <span className="inline-block w-0.5 h-3.5 bg-gray-500 ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100 shrink-0 flex gap-2 items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanya tentang KPI atau pola data..."
              disabled={loading}
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 placeholder:text-gray-400 disabled:opacity-50 transition-all"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="shrink-0 w-9 h-9 bg-brand-800 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className="group w-12 h-12 bg-brand-800 hover:bg-brand-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
      >
        {open ? <X size={18} /> : <MessageSquare size={18} />}
        {!open && (
          <>
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-75" />
          </>
        )}
      </button>
    </div>
  );
}
