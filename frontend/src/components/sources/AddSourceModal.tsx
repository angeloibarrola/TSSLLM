import { useState } from "react";
import { FileUp, Globe, ClipboardPaste, X, Loader2 } from "lucide-react";
import type { Api } from "../../api/client";

interface AddSourceModalProps {
  api: Api;
  onSourceAdded: () => void;
  onDismiss: () => void;
}

export function AddSourceModal({ api, onSourceAdded, onDismiss }: AddSourceModalProps) {
  const [url, setUrl] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setLoadingMsg("Uploading...");
    setError(null);
    try {
      await api.uploadFile(file);
      onSourceAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setLoadingMsg("Fetching...");
    setError(null);
    try {
      await api.addUrl(url.trim());
      onSourceAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add URL");
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
      onSourceAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add content");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Add your first source</h2>
            <p className="text-sm text-gray-400 mt-0.5">Upload a file, add a URL, or paste text to get started.</p>
          </div>
          <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
            <Loader2 size={16} className="animate-spin" />
            {loadingMsg}
          </div>
        )}

        {/* Error */}
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        {/* Upload file */}
        <label className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer text-sm font-medium transition-colors mb-3 w-full">
          <FileUp size={16} />
          Upload file (.docx, .pdf, .vtt)
          <input type="file" accept=".docx,.vtt,.pdf" className="hidden" onChange={handleFileUpload} disabled={loading} />
        </label>

        {/* URL input */}
        <form onSubmit={handleAddUrl} className="flex gap-1.5 mb-3">
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg transition-colors"
          >
            <Globe size={16} />
          </button>
        </form>

        {/* Paste toggle */}
        <button
          onClick={() => setShowPaste(!showPaste)}
          disabled={loading}
          className="flex items-center gap-2 w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
        >
          <ClipboardPaste size={14} />
          Paste copied text
        </button>

        {/* Paste panel */}
        {showPaste && (
          <div className="mt-3 p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
            <input
              type="text"
              placeholder="Title (e.g. PRSS Release Page)"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-1.5 mb-2 bg-gray-800 border border-gray-700 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <textarea
              placeholder="Paste page content here..."
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              rows={4}
              disabled={loading}
              className="w-full px-3 py-1.5 mb-2 bg-gray-800 border border-gray-700 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none font-mono"
            />
            <button
              onClick={handlePasteSubmit}
              disabled={loading || !pasteTitle.trim() || !pasteContent.trim()}
              className="w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
            >
              Add Source
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
