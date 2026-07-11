import { useEffect, useRef, useState, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import api from "../services/api";
import type { ChatSessionOut, MessageOut, NoteOut, SharedLinkOut } from "../services/types";
import {
  MessageSquare,
  Plus,
  Send,
  Share2,
  Copy,
  Check,
  Trash2,
  Loader2,
  ChevronRight,
  Maximize2,
  X,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  Sparkles
} from "lucide-react";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "kn", name: "ಕನ್ನಡ (Kannada)" },
  { code: "ta", name: "தமிழ் (Tamil)" },
  { code: "te", name: "తెలుగు (Telugu)" },
  { code: "mr", name: "मराठी (Marathi)" }
];

export default function Chat() {
  const [notes, setNotes] = useState<NoteOut[]>([]);
  const [sessions, setSessions] = useState<ChatSessionOut[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [input, setInput] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<number | "">("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    api.get<NoteOut[]>("/notes").then((res) => setNotes(res.data.filter((n) => n.is_indexed)));
    api.get<ChatSessionOut[]>("/chat/sessions").then((res) => setSessions(res.data));
  }, []);

  useEffect(() => {
    if (activeSessionId === null) return;
    setShareUrl(null);
    api.get<MessageOut[]>(`/chat/sessions/${activeSessionId}/messages`).then((res) => setMessages(res.data));
  }, [activeSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleNewSession() {
    if (!selectedNoteId) {
      setError("Pick a note first.");
      return;
    }
    setError(null);
    const note = notes.find((n) => n.id === selectedNoteId);
    try {
      const res = await api.post<ChatSessionOut>("/chat/sessions", {
        note_id: selectedNoteId,
        title: note ? `Chat: ${note.title}` : "New Chat",
      });
      setSessions((prev) => [res.data, ...prev]);
      setActiveSessionId(res.data.id);
      setMessages([]);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to create chat session.");
    }
  }

  async function handleDeleteSession(sessionId: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this chat session?")) return;
    try {
      await api.delete(`/chat/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
        setShareUrl(null);
      }
    } catch {
      setError("Failed to delete chat session.");
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || activeSessionId === null) return;

    setError(null);
    setIsSending(true);
    const userText = input;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: userText, image_urls: [], created_at: new Date().toISOString() },
    ]);

    try {
      const res = await api.post<MessageOut>(`/chat/sessions/${activeSessionId}/messages`, {
        content: userText,
        answer_language: selectedLanguage
      });
      setMessages((prev) => [...prev, res.data]);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Message failed to send.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleShareChat() {
    if (activeSessionId === null) return;
    setIsSharing(true);
    setError(null);
    try {
      const res = await api.post<SharedLinkOut>(`/chat/sessions/${activeSessionId}/share`);
      const fullUrl = `${window.location.origin}${res.data.share_path}`;
      setShareUrl(fullUrl);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to share chat.");
    } finally {
      setIsSharing(false);
    }
  }

  async function handleUnshareChat() {
    if (activeSessionId === null) return;
    setError(null);
    try {
      await api.delete(`/chat/sessions/${activeSessionId}/share`);
      setShareUrl(null);
    } catch {
      setError("Failed to revoke share link.");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      
      <div className="flex-1 flex overflow-hidden h-[calc(100vh-64px)] relative">
        
        {/* Toggle Sidebar Button when closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-all shadow-lg"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        )}

        {/* Sidebar */}
        <aside
          className={`glass-panel border-r border-slate-900 w-72 flex-shrink-0 flex flex-col justify-between transition-all duration-300 z-30 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full absolute md:relative"
          }`}
        >
          <div className="p-5 overflow-y-auto flex-1 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Chat Sessions</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <PanelLeftClose className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* New Session Config */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Context</label>
              <select
                value={selectedNoteId}
                onChange={(e) => setSelectedNoteId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="" className="bg-slate-950">Select a note...</option>
                {notes.map((n) => (
                  <option key={n.id} value={n.id} className="bg-slate-950">
                    {n.title}
                  </option>
                ))}
              </select>
              <button
                onClick={handleNewSession}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/10 hover:bg-indigo-500 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>New Chat</span>
              </button>
            </div>

            {/* Session List */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Conversations</p>
              
              {sessions.length === 0 ? (
                <p className="text-slate-500 text-xs italic p-2">No active sessions yet.</p>
              ) : (
                <ul className="space-y-1">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <div
                        onClick={() => setActiveSessionId(s.id)}
                        className={`group flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200 ${
                          activeSessionId === s.id
                            ? "bg-indigo-500/15 border border-indigo-500/30 text-white"
                            : "hover:bg-slate-900/60 border border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MessageSquare className={`h-4 w-4 flex-shrink-0 ${activeSessionId === s.id ? "text-indigo-400" : "text-slate-500"}`} />
                          <span className="truncate text-sm font-medium">{s.title}</span>
                        </div>
                        
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 text-slate-500 transition-all rounded-lg hover:bg-slate-800"
                          title="Delete Session"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {/* Sidebar Footer info */}
          <div className="p-4 border-t border-slate-900 bg-slate-950/20 text-2xs text-slate-500 flex items-center gap-1.5 justify-center">
            <HelpCircle className="h-3.5 w-3.5 text-slate-600" />
            <span>EduNotes Chatbot v1.0</span>
          </div>
        </aside>

        {/* Chat Main Window */}
        <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
          
          {/* Chat Header */}
          {activeSessionId !== null && (
            <div className="flex items-center justify-between border-b border-slate-900 bg-slate-950/60 px-6 py-3.5 backdrop-blur-md flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <span className="font-semibold text-sm text-slate-100 truncate">
                  {sessions.find((s) => s.id === activeSessionId)?.title || "Chat Session"}
                </span>
              </div>
              
              {/* Share Controls */}
              <div className="flex items-center gap-2">
                {!shareUrl ? (
                  <button
                    onClick={handleShareChat}
                    disabled={isSharing}
                    className="flex items-center gap-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50"
                  >
                    {isSharing ? (
                      <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                    ) : (
                      <Share2 className="h-3.5 w-3.5" />
                    )}
                    <span>Share Link</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-900 border border-indigo-500/20 rounded-xl px-2.5 py-1 text-xs">
                    <span className="text-slate-400 font-medium truncate max-w-40 select-all">{shareUrl}</span>
                    <button 
                      onClick={() => copyToClipboard(shareUrl)} 
                      className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-0.5"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <div className="w-px h-3 bg-slate-800" />
                    <button onClick={handleUnshareChat} className="text-red-400 hover:text-red-300 font-semibold">
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="m-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 text-xs text-red-400 flex items-center gap-2 flex-shrink-0">
              <X className="h-4 w-4 cursor-pointer" onClick={() => setError(null)} />
              <span>{error}</span>
            </div>
          )}

          {/* Messages Display Area */}
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6 scrollbar-thin">
            {activeSessionId === null ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 mb-4 animate-float">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-200">Start an AI Chat</h3>
                <p className="text-sm text-slate-500 mt-2">
                  Select a note from the left sidebar and click "New Chat" to begin asking questions grounded directly in your uploaded notes.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8">
                <MessageSquare className="h-8 w-8 text-slate-700 mb-2" />
                <p className="text-sm">Ask a question about this note to get started.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-md transition-all ${
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
                                alt={`Diagram ${i + 1} from note`}
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

          {/* Form Input Area */}
          <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-900/60 p-4 bg-slate-950 flex-shrink-0 items-center">
            {/* Language Selector Dropdown */}
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={activeSessionId === null || isSending}
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
              disabled={activeSessionId === null || isSending}
              placeholder={
                activeSessionId === null 
                  ? "Select a session to begin chatting..." 
                  : "Ask something about this note..."
              }
              className="flex-1 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={activeSessionId === null || isSending || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-colors shadow-md shadow-indigo-600/10 flex-shrink-0"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4.5 w-4.5" />
              )}
            </button>
          </form>
        </main>
      </div>

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