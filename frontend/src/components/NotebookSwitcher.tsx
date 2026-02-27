import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import type { Workspace } from "../types";

interface NotebookSwitcherProps {
  workspaces: Workspace[];
  currentWorkspaceId: string;
  onSwitch: (id: string) => void;
  onCreateNotebook: () => void;
  onRenameNotebook: (name: string) => void;
  onDeleteNotebook: () => void;
}

export default function NotebookSwitcher({
  workspaces,
  currentWorkspaceId,
  onSwitch,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
}: NotebookSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setRenaming(false);
        setConfirmingDelete(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  function handleRenameStart() {
    setRenameValue(currentWorkspace?.name ?? "");
    setRenaming(true);
  }

  function handleRenameSubmit() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== currentWorkspace?.name) {
      onRenameNotebook(trimmed);
    }
    setRenaming(false);
  }

  function handleDeleteConfirm() {
    onDeleteNotebook();
    setConfirmingDelete(false);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700 rounded px-3 py-1.5 text-sm"
      >
        <BookOpen size={14} />
        <span className="max-w-[160px] truncate">
          {currentWorkspace?.name ?? "Notebook"}
        </span>
        <ChevronDown size={14} />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[240px]">
          {/* Notebook list */}
          <div className="py-1 max-h-[240px] overflow-y-auto">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => {
                  onSwitch(ws.id);
                  setOpen(false);
                }}
                className={`px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm flex items-center gap-2 ${
                  ws.id === currentWorkspaceId
                    ? "bg-gray-700 font-medium text-white"
                    : "text-gray-300"
                }`}
              >
                <BookOpen size={14} className="shrink-0" />
                <span className="truncate">{ws.name}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 my-1" />

          {/* Actions */}
          <div className="py-1">
            {/* New Notebook */}
            <div
              onClick={() => {
                onCreateNotebook();
                setOpen(false);
              }}
              className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer flex items-center gap-2"
            >
              <Plus size={14} />
              New Notebook
            </div>

            {/* Rename */}
            {renaming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRenameSubmit();
                }}
                className="px-4 py-2"
              >
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setRenaming(false);
                  }}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 outline-none focus:border-blue-500"
                />
              </form>
            ) : (
              <div
                onClick={handleRenameStart}
                className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer flex items-center gap-2"
              >
                <Pencil size={14} />
                Rename
              </div>
            )}

            {/* Delete */}
            {workspaces.length > 1 && (
              <div
                onClick={() => setConfirmingDelete(true)}
                className="px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 cursor-pointer flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-6 max-w-sm mx-4">
            <h3 className="text-white font-medium mb-2">
              Delete '{currentWorkspace?.name}'?
            </h3>
            <p className="text-gray-400 text-sm mb-5">
              All sources, chat, and artifacts will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
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
