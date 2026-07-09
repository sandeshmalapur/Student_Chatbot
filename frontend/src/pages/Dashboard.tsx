import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { ChatSessionOut, NoteOut } from "../services/types";

export default function Dashboard() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteOut[]>([]);
  const [sessions, setSessions] = useState<ChatSessionOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<NoteOut[]>("/notes"), api.get<ChatSessionOut[]>("/chat/sessions")])
      .then(([notesRes, sessionsRes]) => {
        setNotes(notesRes.data);
        setSessions(sessionsRes.data);
      })
      .catch(() => setError("Failed to load dashboard data."));
  }, []);

  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-1 text-2xl font-semibold">Welcome, {user?.full_name}</h1>
        <p className="mb-6 text-gray-500">{user?.email}</p>

        {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-2 text-lg font-medium">Notes</h2>
            <p className="text-3xl font-semibold text-primary">{notes.length}</p>
            <p className="text-sm text-gray-500">
              {notes.filter((n) => n.is_indexed).length} indexed and ready for chat
            </p>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-2 text-lg font-medium">Chat sessions</h2>
            <p className="text-3xl font-semibold text-primary">{sessions.length}</p>
            <p className="text-sm text-gray-500">across all your notes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
