import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../services/api";
import type { NoteOut } from "../services/types";

export default function Notes() {
  const [notes, setNotes] = useState<NoteOut[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

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
    <div>
      <Navbar />
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your Notes</h1>
          <label className="cursor-pointer rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-light">
            {isUploading ? "Uploading..." : "Upload PDF"}
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} disabled={isUploading} className="hidden" />
          </label>
        </div>

        {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

        {notes.length === 0 ? (
          <p className="text-gray-500">No notes uploaded yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{note.title}</p>
                    <p className="text-sm text-gray-500">
                      {note.is_indexed ? "Indexed \u2014 ready to chat" : "Processing..."}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleDelete(note.id)} className="text-sm text-red-600 hover:underline">
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}