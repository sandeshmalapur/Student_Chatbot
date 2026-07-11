import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import type { MessageOut, SharedNoteInfo } from "../services/types";
import {
  Send,
  Loader2,
  X,
  Maximize2,
  Sparkles,
  BookOpen,
  MessageSquare,
  AlertCircle
} from "lucide-react";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "kn", name: "ಕನ್ನಡ (Kannada)" },
  { code: "ta", name: "தமிழ் (Tamil)" },
  { code: "te", name: "తెలుగు (Telugu)" },
  { code: "mr", name: "मराठी (Marathi)" }
];

export default function SharedNote() {
  const { token } = useParams<{ token: string }>();
  const [noteInfo, setNoteInfo] = useState<SharedNoteInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    localStorage.getItem("answer_language") || "en"
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    localStorage.setItem("answer_language", lang);
  };

  useEffect(() => {
    if (!token) return;
    api
      .get<SharedNoteInfo>(`/shared/${token}`)
      .then((res) => {
        setNoteInfo(res.data);
        if (res.data.messages) {
          setMessages(res.data.messages);
        }
      })
      .catch(() => setNotFound(true));
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || !token) return;

    setError(null);
    setIsSending(true);
    const userText = input;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: userText, image_urls: [], created_at: new Date().toISOString() },
    ]);

    try {
      const res = await api.post<MessageOut>(`/shared/${token}/messages`, {
        content: userText,
        answer_language: selectedLanguage
      });
      setMessages((prev) => [...prev, { ...res.data, id: Date.now() + 1 }]);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Message failed to send.");
    } finally {
      setIsSending(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100 p-6 text-center">
        <div className="max-w-md space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Link Invalid or Revoked</h2>
          <p className="text-sm text-slate-400">This shared conversation link is invalid or the owner has revoked it.</p>
          <Link to="/login" className="inline-block text-xs font-semibold text-indigo-400 hover:underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between h-screen overflow-hidden">
      
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-900 bg-slate-950/70 px-8 py-4 backdrop-blur-lg flex-shrink-0">
        <div className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-md">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <span className="text-2xs uppercase tracking-wider text-slate-500 font-semibold block leading-none">Shared Chat</span>
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-base font-bold tracking-wide text-transparent">
              {noteInfo?.note_title ?? "Loading..."}
            </span>
          </div>
        </div>
        
        <Link 
          to="/register" 
          className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-1.5 text-xs font-semibold text-slate-300 transition-all duration-200 hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-400"
        >
          Create Account
        </Link>
      </header>

      {error && (
        <div className="m-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 text-xs text-red-400 flex items-center gap-2 flex-shrink-0 max-w-2xl mx-auto w-full">
          <X className="h-4 w-4 cursor-pointer" onClick={() => setError(null)} />
          <span>{error}</span>
        </div>
      )}

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin max-w-2xl mx-auto w-full space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto text-slate-500">
            <MessageSquare className="h-8 w-8 text-slate-750 mb-2" />
            <p className="text-sm">No messages in this shared chat yet.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md transition-all ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-none border border-indigo-500/15"
                    : "bg-slate-900 text-slate-200 rounded-bl-none border border-slate-800/80"
                }`}
              >
                {m.role === "assistant" && m.answer_language && m.answer_language !== "en" && (
                  <span className="inline-block bg-indigo-500/20 text-indigo-400 border border-indigo-500/10 text-2xs px-2 py-0.5 rounded-md font-semibold mb-1 uppercase tracking-wide">
                    {LANGUAGES.find(l => l.code === m.answer_language)?.name.split(" ")[0] || m.answer_language}
                  </span>
                )}
                <div className="prose prose-invert max-w-none break-words leading-relaxed text-sm">
                  {m.content}
                </div>
                
                {/* Diagram Attachments */}
                {m.image_urls && m.image_urls.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-1 text-2xs uppercase tracking-wider text-slate-400 font-semibold">
                      <Sparkles className="h-3 w-3 text-indigo-400" />
                      <span>Extracted Diagrams</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {m.image_urls.map((url, i) => (
                        <div 
                          key={i} 
                          className="group relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden cursor-zoom-in"
                          onClick={() => setActiveImage(url)}
                        >
                          <img
                            src={url}
                            alt={`Diagram ${i + 1}`}
                            className="max-h-48 w-full object-contain rounded-lg p-1 group-hover:scale-[1.01] transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/90 text-slate-200 shadow-md">
                              <Maximize2 className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <footer className="border-t border-slate-900/60 p-4 bg-slate-950 flex-shrink-0">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto w-full flex gap-2 items-center">
          {/* Language Selector Dropdown */}
          <select
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={isSending || !noteInfo}
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-slate-950 text-slate-200">
                {lang.name}
              </option>
            ))}
          </select>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending || !noteInfo}
            placeholder="Ask a follow-up question..."
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSending || !noteInfo || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-colors shadow-md shadow-indigo-600/10 flex-shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4.5 w-4.5" />
            )}
          </button>
        </form>
      </footer>

      {/* Lightbox zoom modal for diagrams */}
      {activeImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 transition-all duration-200"
          onClick={() => setActiveImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2 shadow-2xl flex flex-col items-center">
            <button
              onClick={() => setActiveImage(null)}
              className="absolute top-4 right-4 rounded-full bg-slate-800/80 p-2 text-slate-400 hover:text-white border border-slate-800/20 hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={activeImage}
              alt="Enlarged diagram"
              className="max-w-full max-h-[80vh] object-contain rounded-lg p-2"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="py-2.5 text-xs text-slate-400 font-medium">Extracted Lecture Diagram</div>
          </div>
        </div>
      )}
    </div>
  );
}