import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { ChatSessionOut, NoteOut } from "../services/types";
import { FileText, MessageSquare, Plus, ArrowRight, Sparkles, Database, Clock } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteOut[]>([]);
  const [sessions, setSessions] = useState<ChatSessionOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<NoteOut[]>("/notes"), api.get<ChatSessionOut[]>("/chat/sessions")])
      .then(([notesRes, sessionsRes]) => {
        setNotes(notesRes.data);
        setSessions(sessionsRes.data);
      })
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      
      <main className="mx-auto max-w-5xl px-6 py-10 sm:px-8">
        {/* Welcome Banner */}
        <div className="relative mb-10 overflow-hidden rounded-2xl border border-indigo-500/10 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/60 p-8 md:p-10">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute left-1/3 bottom-0 -mb-20 h-64 w-64 rounded-full bg-purple-500/5 blur-3xl" />
          
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 border border-indigo-500/20">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span>AI Study Partner Ready</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Welcome back, <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{user?.full_name}</span>
              </h1>
              <p className="text-slate-400 max-w-lg text-sm sm:text-base">
                Upload your lecture notes, extract high-quality diagrams, and chat with our advanced AI to master your courses.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3 flex-shrink-0">
              <Link
                to="/notes"
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-600/30 hover:scale-[1.01]"
              >
                <Plus className="h-4 w-4" />
                <span>Upload Notes</span>
              </Link>
              <Link
                to="/chat"
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-all duration-200 hover:border-slate-700 hover:bg-slate-900"
              >
                <span>Open Chat</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          <div className="glass-panel-glow rounded-2xl border border-slate-800/80 p-6 flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex-shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Notes</p>
              <p className="text-3xl font-extrabold text-white mt-1">
                {isLoading ? "..." : notes.length}
              </p>
              <p className="text-xs text-indigo-400 font-medium mt-1">
                {isLoading ? "" : `${notes.filter((n) => n.is_indexed).length} fully indexed & ready`}
              </p>
            </div>
          </div>

          <div className="glass-panel-glow rounded-2xl border border-slate-800/80 p-6 flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex-shrink-0">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Chat Sessions</p>
              <p className="text-3xl font-extrabold text-white mt-1">
                {isLoading ? "..." : sessions.length}
              </p>
              <p className="text-xs text-purple-400 font-medium mt-1">
                Active chat conversations
              </p>
            </div>
          </div>

          <div className="glass-panel-glow rounded-2xl border border-slate-800/80 p-6 flex items-start gap-4 sm:col-span-2 lg:col-span-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Vector Status</p>
              <p className="text-3xl font-extrabold text-white mt-1">Online</p>
              <p className="text-xs text-emerald-400 font-medium mt-1">
                Qdrant DB active
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Recent Notes */}
          <div className="glass-panel rounded-2xl border border-slate-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                <span>Recent Notes</span>
              </h2>
              <Link to="/notes" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                <span>View all</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-slate-900/50 animate-pulse" />
                ))}
              </div>
            ) : notes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-500 text-sm">
                No notes uploaded yet. Get started by uploading a PDF lecture.
              </div>
            ) : (
              <ul className="space-y-3">
                {notes.slice(0, 3).map((note) => (
                  <li key={note.id} className="flex items-center justify-between rounded-xl bg-slate-900/40 border border-slate-900 p-3 hover:border-slate-800 transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-200 truncate">{note.title}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(note.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-3xs font-medium border ${
                      note.is_indexed 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                    }`}>
                      {note.is_indexed ? "Indexed" : "Processing"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active Chats */}
          <div className="glass-panel rounded-2xl border border-slate-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-400" />
                <span>Active Chats</span>
              </h2>
              <Link to="/chat" className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1">
                <span>Open chat</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-slate-900/50 animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-500 text-sm">
                No active chat sessions. Pick a note in the Chat window to start.
              </div>
            ) : (
              <ul className="space-y-3">
                {sessions.slice(0, 3).map((session) => (
                  <li key={session.id} className="flex items-center justify-between rounded-xl bg-slate-900/40 border border-slate-900 p-3 hover:border-slate-800 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-200 truncate">{session.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-xs">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(session.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Link
                      to="/chat"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
