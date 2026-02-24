import { useState, useEffect } from "react";
import { FileUp, Globe, Trash2, Loader2, ClipboardPaste, X, CheckSquare, Square } from "lucide-react";
import { api } from "../../api/client";
import type { Source } from "../../types";

interface SourcesPaneProps {
  onSelectSource: (id: number) => void;
  selectedSourceId: number | null;
  enabledSourceIds: Set<number>;
  onToggleSource: (id: number) => void;
  onSetAllSources: (ids: number[]) => void;
  onSourcesChanged: (sourceIds: number[]) => void;
}

export function SourcesPane({ onSelectSource, selectedSourceId, enabledSourceIds, onToggleSource, onSetAllSources, onSourcesChanged }: SourcesPaneProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Processing...");
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");

  const fetchSources = async () => {
    try {
      const data = await api.getSources();
      setSources(data);
      onSourcesChanged(data.map((s) => s.id));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => { fetchSources(); }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setLoadingMsg("Uploading...");
    setError(null);
    try {
      await api.uploadFile(file);
      await fetchSources();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setLoadingMsg("Fetching...");
    try {
      await api.addUrl(url.trim());
      setUrl("");
      await fetchSources();
    } catch (err: any) {
      setError(err.message || "Failed to add URL");
    } finally {
      setLoading(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pasteTitle.trim() || !pasteContent.trim()) return;
    setLoading(true);
    setLoadingMsg("Adding...");
    setError(null);
    try {
      await api.pasteContent(pasteTitle.trim(), pasteContent.trim());
      setPasteTitle("");
      setPasteContent("");
      setShowPaste(false);
      await fetchSources();
    } catch (err: any) {
      setError(err.message || "Failed to add content");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteSource(id);
      await fetchSources();
    } catch {
      /* ignore */
    }
  };

  const sourceIcon = (type: string) => {
    switch (type) {
      case "docx": return "📄";
      case "sharepoint": return "🏢";
      case "paste": return "📋";
      case "vtt": return "🎙️";
      default: return "🌐";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Sources</h2>

        {/* File Upload */}
        <label className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer text-sm font-medium transition-colors mb-2">
          <FileUp size={16} />
          Upload file
          <input type="file" accept=".docx,.vtt" className="hidden" onChange={handleFileUpload} />
        </label>

        {/* URL Input */}
        <form onSubmit={handleAddUrl} className="flex gap-1 mb-2">
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button type="submit" className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            <Globe size={16} />
          </button>
        </form>

        {/* Paste Content Button */}
        <button
          onClick={() => setShowPaste(!showPaste)}
          className="flex items-center gap-2 w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
        >
          <ClipboardPaste size={14} />
          Paste content (SharePoint, etc.)
        </button>

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {/* Paste Content Panel */}
      {showPaste && (
        <div className="p-3 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400">Paste page content</span>
            <button onClick={() => setShowPaste(false)} className="text-gray-500 hover:text-gray-300">
              <X size={14} />
            </button>
          </div>
          <input
            type="text"
            placeholder="Title (e.g. PRSS Release Page)"
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
            className="w-full px-3 py-1.5 mb-2 bg-gray-800 border border-gray-700 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <textarea
            placeholder="Paste page content here (Ctrl+A, Ctrl+C from the page)..."
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            rows={6}
            className="w-full px-3 py-1.5 mb-2 bg-gray-800 border border-gray-700 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none font-mono"
          />
          <button
            onClick={handlePasteSubmit}
            disabled={!pasteTitle.trim() || !pasteContent.trim()}
            className="w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
          >
            Add Source
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center p-4 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          {loadingMsg}
        </div>
      )}

      {/* Source List */}
      <div className="flex-1 overflow-y-auto p-2">
        {sources.length > 0 && (
          <button
            onClick={() => {
              const allEnabled = sources.every((s) => enabledSourceIds.has(s.id));
              onSetAllSources(allEnabled ? [] : sources.map((s) => s.id));
            }}
            className="flex items-center gap-2 w-full px-2 py-1.5 mb-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded transition-colors"
          >
            {sources.every((s) => enabledSourceIds.has(s.id))
              ? <CheckSquare size={14} className="text-blue-500" />
              : sources.some((s) => enabledSourceIds.has(s.id))
                ? <Square size={14} className="text-blue-500/50" />
                : <Square size={14} />
            }
            {sources.every((s) => enabledSourceIds.has(s.id)) ? "Deselect all" : "Select all"}
          </button>
        )}
        {sources.length === 0 && !loading && (
          <p className="text-gray-500 text-sm text-center mt-8">No sources yet. Upload a document or add a URL.</p>
        )}
        {sources.map((source) => (
          <div
            key={source.id}
            className={`flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer group ${selectedSourceId === source.id ? "bg-gray-800 ring-1 ring-blue-500/50" : ""}`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSource(source.id); }}
              className="text-gray-400 hover:text-blue-400 transition-colors flex-shrink-0"
              title={enabledSourceIds.has(source.id) ? "Disable for chat" : "Enable for chat"}
            >
              {enabledSourceIds.has(source.id) ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
            </button>
            <div className="flex-1 min-w-0" onClick={() => onSelectSource(source.id)}>
              <span className="text-lg mr-1">{sourceIcon(source.source_type)}</span>
              <span className="text-sm font-medium">{source.name}</span>
              <p className="text-xs text-gray-500">{source.source_type}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(source.id); }}
              className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
