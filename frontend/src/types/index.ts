export interface Source {
  id: number;
  name: string;
  source_type: "docx" | "url" | "sharepoint" | "paste" | "vtt";
  url: string | null;
  file_path: string | null;
  content_text?: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources_cited: string | null;
  created_at: string;
}

export interface Artifact {
  id: number;
  title: string;
  content_markdown: string;
  created_at: string;
  updated_at: string;
}
