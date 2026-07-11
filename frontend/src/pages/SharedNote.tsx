import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import type { MessageOut, SharedNoteInfo } from "../services/types";

// Public, read-only chat page for a shared note. Deliberately NOT wrapped in
// ProtectedRoute — visitors don't need an account, the token in the URL is
// the only "credential" (same model as a Google Docs share link).
export default function SharedNote() {
  const { token } = useParams<{ token: string }>();
  const [noteInfo, setNoteInfo] = useState<SharedNoteInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      const res = await api.post<MessageOut>(`/shared/${token}/messages`, { content: userText });
      setMessages((prev) => [...prev, { ...res.data, id: Date.now() + 1 }]);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Message failed to send.");
    } finally {
      setIsSending(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">This share link is invalid or has been revoked.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col p-6">
      <div className="mb-4 rounded-lg border bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-gray-400">Shared Chat History</p>
        <h1 className="text-xl font-semibold">{noteInfo?.note_title ?? "Loading..."}</h1>
      </div>

      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border bg-white p-4">
        {messages.length === 0 ? (
          <p className="text-gray-400">Ask a question about this note to get started.</p>
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
                      <img key={i} src={url} alt={`Diagram ${i + 1}`} className="max-h-64 rounded border bg-white object-contain" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isSending || !noteInfo}
          placeholder="Ask something about this note..."
          className="flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={isSending || !noteInfo}
          className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-light disabled:opacity-50"
        >
          {isSending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}