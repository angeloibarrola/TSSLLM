import { useState, useEffect } from "react";
import { Plus, Link, Check, LogOut, Pencil, Trash2, BookOpen } from "lucide-react";
import { teamApi, workspaceApi } from "../api/client";
import type { Team, Workspace } from "../types";

interface WorkspaceHomeProps {
  team: Team;
  onOpenNotebook: (notebookId: string) => void;
  onLeave: () => void;
  onTeamUpdated: (team: Team) => void;
}

export function WorkspaceHome({ team, onOpenNotebook, onLeave, onTeamUpdated }: WorkspaceHomeProps) {
  const [notebooks, setNotebooks] = useState<Workspace[]>([]);
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(team.name);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const fetchNotebooks = async () => {
    const list = await workspaceApi.list(team.id);
    setNotebooks(list);
  };

  useEffect(() => {
    fetchNotebooks();
  }, [team.id]);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/t/${team.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateNotebook = async () => {
    const created = await workspaceApi.create("Untitled Notebook", team.id);
    await fetchNotebooks();
    onOpenNotebook(created.id);
  };

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== team.name) {
      const updated = await teamApi.rename(team.id, trimmed);
      onTeamUpdated(updated);
    }
    setRenaming(false);
  };

  const handleDeleteNotebook = async (id: string) => {
    await workspaceApi.delete(id);
    setConfirmingDelete(null);
    await fetchNotebooks();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">AI Knowledge Notebook</h1>
        </div>
        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
        >
          <LogOut size={14} />
          Leave Workspace
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex justify-center pt-12 px-4">
        <div className="max-w-lg w-full">
          {/* Workspace Info */}
          <div className="text-center mb-8">
            {renaming ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleRename(); }}
                className="inline-flex items-center gap-2"
              >
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRename}
                  autoFocus
                  className="text-2xl font-bold bg-transparent border-b-2 border-blue-500 text-center focus:outline-none"
                />
              </form>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-bold">{team.name}</h2>
                <button
                  onClick={() => { setRenameValue(team.name); setRenaming(true); }}
                  className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}

            {/* Share Link */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
                title="Copy invite link"
              >
                {copied ? <Check size={14} /> : <Link size={14} />}
                {copied ? "Link Copied!" : "Copy Invite Link"}
              </button>
            </div>
          </div>

          {/* Notebooks Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Notebooks</h3>
              <button
                onClick={handleCreateNotebook}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={14} />
                New Notebook
              </button>
            </div>

            {notebooks.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">
                No notebooks yet. Create one to get started.
              </p>
            )}

            {notebooks.map((nb) => (
              <div
                key={nb.id}
                onClick={() => onOpenNotebook(nb.id)}
                className="flex items-center gap-3 p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl cursor-pointer transition-colors group"
              >
                <BookOpen size={20} className="text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{nb.name}</p>
                  <p className="text-xs text-gray-500">
                    Created {new Date(nb.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmingDelete(nb.id); }}
                  className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-6 max-w-sm mx-4">
            <h3 className="text-white font-medium mb-2">Delete this notebook?</h3>
            <p className="text-gray-400 text-sm mb-5">All sources, chat, and artifacts will be permanently deleted.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmingDelete(null)}
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNotebook(confirmingDelete)}
                className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-500 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
