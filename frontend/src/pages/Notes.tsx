import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../services/api";
import type { NoteOut } from "../services/types";
import { UploadCloud, Trash2, FileText, Loader2, CheckCircle2, AlertCircle, FileUp } from "lucide-react";

export default function Notes() {
  const [notes, setNotes] = useState<NoteOut[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadNotes() {
    api
      .get<NoteOut[]>("/notes")
      .then((res) => setNotes(res.data))
      .catch(() => setError("Failed to load notes."));
  }

  useEffect(() => {
    loadNotes();
  }, []);

  // Poll for indexing status of notes that are processing
  useEffect(() => {
    const hasProcessingNotes = notes.some((n) => !n.is_indexed);
    if (!hasProcessingNotes) return;

    const interval = setInterval(() => {
      api.get<NoteOut[]>("/notes").then((res) => {
        // If there's a status change, update the state
        const statusChanged = res.data.some(
          (newNote) => {
            const oldNote = notes.find((n) => n.id === newNote.id);
            return oldNote && oldNote.is_indexed !== newNote.is_indexed;
          }
        );
        if (statusChanged || res.data.length !== notes.length) {
          setNotes(res.data);
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [notes]);

  async function handleUpload(file: File) {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }

    setError(null);
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.post("/notes", formData, { headers: { "Content-Type": "multipart/form-data" } });
      loadNotes();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this note? This also removes its chat sessions and any share link.")) return;
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setError("Failed to delete note.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      
      <div className="mx-auto max-w-4xl p-6 sm:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Your Notes</h1>
            <p className="text-slate-400 text-sm mt-1">Upload lecture PDFs to start querying them using AI.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group mb-8 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? "border-indigo-500 bg-indigo-500/10"
              : "border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
          
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900/80 text-indigo-400 border border-slate-800 group-hover:scale-105 group-hover:border-indigo-500/30 group-hover:text-indigo-300 transition-all duration-200">
            {isUploading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <UploadCloud className="h-7 w-7" />
            )}
          </div>
          
          <p className="font-semibold text-slate-200">
            {isUploading ? "Uploading & Analyzing..." : "Click to upload or drag & drop"}
          </p>
          <p className="text-xs text-slate-500 mt-1">PDF documents up to 20MB</p>
        </div>

        {/* Notes Grid */}
        <h2 className="mb-4 text-sm font-semibold tracking-wider text-slate-400 uppercase">Documents</h2>
        
        {notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/10 p-12 text-center text-slate-500">
            <FileUp className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm">No notes uploaded yet. Get started by uploading a PDF lecture above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="glass-card rounded-2xl p-5 border border-slate-900 flex flex-col justify-between h-36"
              >
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 flex-shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-200 text-sm truncate leading-tight">{note.title}</p>
                    <p className="text-2xs text-slate-500 mt-1 truncate">{note.original_filename}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-900/60">
                  <div className="flex items-center gap-1.5">
                    {note.is_indexed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20 animate-pulse">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Indexing</span>
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                    title="Delete Note"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}