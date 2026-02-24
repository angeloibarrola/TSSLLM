const BASE = "";

export interface SharePointAuth {
  auth_required: boolean;
  type: string;
  user_code: string;
  verification_uri: string;
  message: string;
  url: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    // Check for SharePoint auth required (401 with auth_required)
    if (res.status === 401) {
      try {
        const parsed = JSON.parse(text);
        const detail = typeof parsed.detail === "string" ? JSON.parse(parsed.detail) : parsed.detail;
        if (detail?.auth_required) {
          const err = new Error("SHAREPOINT_AUTH_REQUIRED") as Error & { authInfo: SharePointAuth };
          err.authInfo = detail;
          throw err;
        }
      } catch (e) {
        if (e instanceof Error && e.message === "SHAREPOINT_AUTH_REQUIRED") throw e;
      }
    }
    throw new Error(text);
  }
  return res.json();
}

export const api = {
  // Sources
  getSources: () => request<import("../types").Source[]>("/api/sources"),
  getSource: (id: number) =>
    request<import("../types").Source>(`/api/sources/${id}`),
  addUrl: (url: string) =>
    request<import("../types").Source>("/api/sources/url", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  getSharePointStatus: () =>
    request<{ authenticated: boolean }>("/api/sources/sharepoint/status"),
  loginSharePoint: () =>
    request<{ ok: boolean }>("/api/sources/sharepoint/login", { method: "POST" }),
  pasteContent: (title: string, content: string) =>
    request<import("../types").Source>("/api/sources/paste", {
      method: "POST",
      body: JSON.stringify({ title, content }),
    }),
  uploadFile: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/sources/upload", { method: "POST", body: form });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<import("../types").Source>;
  },
  deleteSource: (id: number) =>
    request<void>(`/api/sources/${id}`, { method: "DELETE" }),

  // Chat
  getMessages: () => request<import("../types").ChatMessage[]>("/api/chat"),
  sendMessage: (content: string) =>
    request<import("../types").ChatMessage>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  // Artifacts
  getArtifacts: () => request<import("../types").Artifact[]>("/api/artifacts"),
  createArtifact: (title: string, content_markdown: string) =>
    request<import("../types").Artifact>("/api/artifacts", {
      method: "POST",
      body: JSON.stringify({ title, content_markdown }),
    }),
  updateArtifact: (id: number, title: string, content_markdown: string) =>
    request<import("../types").Artifact>(`/api/artifacts/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title, content_markdown }),
    }),
  deleteArtifact: (id: number) =>
    request<void>(`/api/artifacts/${id}`, { method: "DELETE" }),
};
