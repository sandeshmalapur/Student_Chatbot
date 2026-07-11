import { useEffect, useRef, useState, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import api from "../services/api";
import type { ChatSessionOut, MessageOut, NoteOut, SharedLinkOut } from "../services/types";

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
  const bottomRef = useRef<HTMLDivElement>(null);

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
    const note = notes.find((n) => n.id === selectedNoteId);
    const res = await api.post<ChatSessionOut>("/chat/sessions", {
      note_id: selectedNoteId,
      title: note ? `Chat: ${note.title}` : "New Chat",
    });
    setSessions((prev) => [res.data, ...prev]);
    setActiveSessionId(res.data.id);
    setMessages([]);
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
      const res = await api.post<MessageOut>(`/chat/sessions/${activeSessionId}/messages`, { content: userText });
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
  }

  return (
    <div>
      <Navbar />
      <div className="mx-auto flex h-[calc(100vh-64px)] max-w-5xl gap-4 p-6">
        <aside className="w-64 flex-shrink-0 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Start new chat</label>
            <select
              value={selectedNoteId}
              onChange={(e) => setSelectedNoteId(e.target.value ? Number(e.target.value) : "")}
              className="mb-2 w-full rounded border px-2 py-2 text-sm"
            >
              <option value="">Select a note...</option>
              {notes.map((n) => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
            <button onClick={handleNewSession} className="w-full rounded bg-primary py-2 text-sm text-white hover:bg-primary-light">
              New Chat
            </button>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Sessions</p>
            <ul className="space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setActiveSessionId(s.id)}
                    className={`w-full truncate rounded px-3 py-2 text-left text-sm ${
                      activeSessionId === s.id ? "bg-primary text-white" : "bg-white hover:bg-gray-100"
                    }`}
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="flex flex-1 flex-col rounded-lg border bg-white overflow-hidden">
          {activeSessionId !== null && (
            <div className="flex items-center justify-between border-b p-3 bg-gray-50 flex-shrink-0">
              <span className="font-medium text-sm truncate max-w-[60%]">
                {sessions.find((s) => s.id === activeSessionId)?.title || "Chat"}
              </span>
              <div className="flex items-center gap-2">
                {!shareUrl ? (
                  <button
                    onClick={handleShareChat}
                    disabled={isSharing}
                    className="rounded bg-primary px-3 py-1 text-xs text-white hover:bg-primary-light disabled:opacity-50"
                  >
                    {isSharing ? "Sharing..." : "Share Chat"}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 truncate max-w-40 bg-white border rounded px-2 py-1">{shareUrl}</span>
                    <button onClick={() => copyToClipboard(shareUrl)} className="text-primary hover:underline font-medium">
                      Copy
                    </button>
                    <button onClick={handleUnshareChat} className="text-red-600 hover:underline font-medium">
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="m-3 rounded bg-red-50 p-2 text-sm text-red-600 flex-shrink-0">{error}</p>}

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {activeSessionId === null ? (
              <p className="text-gray-400">Select or start a chat session to begin.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] space-y-2 rounded-lg px-4 py-2 text-sm ${
                    m.role === "user" ? "bg-primary text-white" : "bg-gray-100 text-gray-900"
                  }`}>
                    <p>{m.content}</p>
                    {m.image_urls?.length > 0 && (
                      <div className="space-y-2">
                        {m.image_urls.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Diagram ${i + 1} from note`}
                            className="max-h-64 rounded border bg-white object-contain"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="flex gap-2 border-t p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={activeSessionId === null || isSending}
              placeholder="Ask something about this note..."
              className="flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={activeSessionId === null || isSending}
              className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-light disabled:opacity-50"
            >
              {isSending ? "..." : "Send"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}