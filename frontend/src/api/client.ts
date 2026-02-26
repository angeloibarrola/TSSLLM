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

function wsPrefix(workspaceId: string) {
  return `/api/workspaces/${workspaceId}`;
}

export function createApi(workspaceId: string) {
  const p = wsPrefix(workspaceId);
  return {
    // Sources
    getSources: () => request<import("../types").Source[]>(`${p}/sources`),
    getSource: (id: number) =>
      request<import("../types").Source>(`${p}/sources/${id}`),
    addUrl: (url: string) =>
      request<import("../types").Source>(`${p}/sources/url`, {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
    getSharePointStatus: () =>
      request<{ authenticated: boolean }>(`${p}/sources/sharepoint/status`),
    loginSharePoint: () =>
      request<{ ok: boolean }>(`${p}/sources/sharepoint/login`, { method: "POST" }),
    pasteContent: (title: string, content: string) =>
      request<import("../types").Source>(`${p}/sources/paste`, {
        method: "POST",
        body: JSON.stringify({ title, content }),
      }),
    uploadFile: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${p}/sources/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<import("../types").Source>;
    },
    deleteSource: (id: number) =>
      request<void>(`${p}/sources/${id}`, { method: "DELETE" }),

    // Chat
    getMessages: (after?: string) => {
      const params = after ? `?after=${encodeURIComponent(after)}` : "";
      return request<import("../types").ChatMessage[]>(`${p}/chat${params}`);
    },
    sendMessage: (content: string, source_ids?: number[], after?: string) =>
      request<import("../types").ChatMessage>(`${p}/chat`, {
        method: "POST",
        body: JSON.stringify({ content, source_ids, after }),
      }),
    getSuggestions: () =>
      request<{ suggestions: string[] }>(`${p}/chat/suggestions`).then((r) => r.suggestions),

    // Artifacts
    getArtifacts: () => request<import("../types").Artifact[]>(`${p}/artifacts`),
    createArtifact: (title: string, content_markdown: string) =>
      request<import("../types").Artifact>(`${p}/artifacts`, {
        method: "POST",
        body: JSON.stringify({ title, content_markdown }),
      }),
    updateArtifact: (id: number, title: string, content_markdown: string) =>
      request<import("../types").Artifact>(`${p}/artifacts/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title, content_markdown }),
      }),
    deleteArtifact: (id: number) =>
      request<void>(`${p}/artifacts/${id}`, { method: "DELETE" }),
  };
}

// Workspaces
export const workspaceApi = {
  list: () => request<import("../types").Workspace[]>("/api/workspaces"),
  create: (name?: string) =>
    request<{ id: string; name: string }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: name ?? "Untitled Notebook" }),
    }),
  get: (id: string) =>
    request<import("../types").Workspace>(`/api/workspaces/${id}`),
  rename: (id: string, name: string) =>
    request<import("../types").Workspace>(`/api/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  delete: (id: string) =>
    request<{ ok: boolean }>(`/api/workspaces/${id}`, { method: "DELETE" }),
};

export type Api = ReturnType<typeof createApi>;
