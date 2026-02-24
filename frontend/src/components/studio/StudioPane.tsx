import { useState, useEffect } from "react";
import { Plus, Trash2, Save, FileText, Eye, Pencil, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api } from "../../api/client";
import type { Artifact, Source } from "../../types";

export function StudioPane({ selectedSourceId, onClearSource }: { selectedSourceId: number | null; onClearSource: () => void }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // Source viewer state
  const [viewingSource, setViewingSource] = useState<Source | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  const fetchArtifacts = async () => {
    try {
      const data = await api.getArtifacts();
      setArtifacts(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => { fetchArtifacts(); }, []);

  // Fetch source content when a source is selected
  useEffect(() => {
    if (selectedSourceId === null) {
      setViewingSource(null);
      return;
    }
    setSourceLoading(true);
    api.getSource(selectedSourceId)
      .then((source) => setViewingSource(source))
      .catch(() => setViewingSource(null))
      .finally(() => setSourceLoading(false));
  }, [selectedSourceId]);

  const handleCreate = async () => {
    try {
      const artifact = await api.createArtifact("Untitled", "");
      setArtifacts((prev) => [artifact, ...prev]);
      selectArtifact(artifact);
      setEditing(true);
    } catch {
      /* ignore */
    }
  };

  const selectArtifact = (artifact: Artifact) => {
    setSelected(artifact);
    setTitle(artifact.title);
    setContent(artifact.content_markdown);
    setEditing(false);
  };

  const handleSave = async () => {
    if (!selected) return;
    try {
      const updated = await api.updateArtifact(selected.id, title, content);
      setSelected(updated);
      setArtifacts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setEditing(false);
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteArtifact(id);
      setArtifacts((prev) => prev.filter((a) => a.id !== id));
      if (selected?.id === id) {
        setSelected(null);
        setTitle("");
        setContent("");
      }
    } catch {
      /* ignore */
    }
  };

  // Source viewer mode
  if (selectedSourceId !== null) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2">
          <button onClick={onClearSource} className="text-xs text-gray-400 hover:text-gray-200">
            ← Back
          </button>
          <h2 className="text-sm font-semibold text-gray-300 truncate">
            {viewingSource?.name ?? "Loading..."}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {sourceLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" />
              Loading source...
            </div>
          ) : viewingSource?.content_text ? (
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
              {viewingSource.content_text}
            </pre>
          ) : (
            <p className="text-gray-500 text-sm text-center mt-8">No content available.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Studio</h2>
        <button onClick={handleCreate} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
          <Plus size={16} />
        </button>
      </div>

      {!selected ? (
        /* Artifact List */
        <div className="flex-1 overflow-y-auto p-2">
          {artifacts.length === 0 && (
            <p className="text-gray-500 text-sm text-center mt-8">
              No artifacts yet. Click + to create one.
            </p>
          )}
          {artifacts.map((artifact) => (
            <div
              key={artifact.id}
              onClick={() => selectArtifact(artifact)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer group"
            >
              <FileText size={16} className="text-gray-400" />
              <span className="flex-1 text-sm truncate">{artifact.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(artifact.id); }}
                className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Editor / Preview */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-gray-800">
            <button onClick={() => { setSelected(null); }} className="text-xs text-gray-400 hover:text-gray-200">
              ← Back
            </button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
              readOnly={!editing}
            />
            <button onClick={() => setEditing(!editing)} className="p-1 text-gray-400 hover:text-gray-200">
              {editing ? <Eye size={14} /> : <Pencil size={14} />}
            </button>
            {editing && (
              <button onClick={handleSave} className="p-1 text-green-400 hover:text-green-300">
                <Save size={14} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {editing ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write markdown here..."
                className="w-full h-full bg-transparent text-sm font-mono resize-none focus:outline-none placeholder-gray-600"
              />
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{content || "*Empty document*"}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
