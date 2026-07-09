export interface UserOut {
  id: number;
  email: string;
  full_name: string;
  created_at: string;
}

export interface NoteOut {
  id: number;
  title: string;
  original_filename: string;
  is_indexed: boolean;
  created_at: string;
}

export interface ChatSessionOut {
  id: number;
  note_id: number;
  title: string;
  created_at: string;
}

export interface MessageOut {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
