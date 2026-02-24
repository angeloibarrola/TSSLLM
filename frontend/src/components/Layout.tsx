import { useState, useRef } from "react";
import { SourcesPane } from "./sources/SourcesPane";
import { ChatPane } from "./chat/ChatPane";
import { StudioPane } from "./studio/StudioPane";
import { api } from "../api/client";

export function Layout() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [enabledSourceIds, setEnabledSourceIds] = useState<Set<number>>(new Set());
  const [pendingArtifactId, setPendingArtifactId] = useState<number | null>(null);
  const allKnownIds = useRef<Set<number>>(new Set());

  const handleSaveToNote = async (content: string) => {
    const title = content.slice(0, 50).replace(/\n/g, " ").trim() || "Chat Note";
    const artifact = await api.createArtifact(title, content);
    setSelectedSourceId(null);
    setPendingArtifactId(artifact.id);
  };

  const toggleSourceEnabled = (id: number) => {
    setEnabledSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSourcesChanged = (sourceIds: number[]) => {
    const currentIds = new Set(sourceIds);
    setEnabledSourceIds((prev) => {
      if (prev.size === 0 && sourceIds.length > 0) {
        // First load: enable all existing sources
        allKnownIds.current = currentIds;
        return new Set(sourceIds);
      }
      const next = new Set<number>();
      // Keep only IDs that still exist and were enabled
      for (const id of prev) {
        if (currentIds.has(id)) next.add(id);
      }
      // Enable any brand new sources
      for (const id of sourceIds) {
        if (!allKnownIds.current.has(id)) {
          next.add(id);
        }
      }
      allKnownIds.current = currentIds;
      return next;
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="flex items-center px-6 py-3 bg-gray-900 border-b border-gray-800">
        <h1 className="text-lg font-bold tracking-tight">
          📚 TSSLLM <span className="text-gray-400 font-normal text-sm ml-2">Team Source Studio</span>
        </h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r border-gray-800 flex flex-col">
          <SourcesPane
            onSelectSource={(id) => setSelectedSourceId(id)}
            selectedSourceId={selectedSourceId}
            enabledSourceIds={enabledSourceIds}
            onToggleSource={toggleSourceEnabled}
            onSourcesChanged={onSourcesChanged}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPane enabledSourceIds={enabledSourceIds} onSaveToNote={handleSaveToNote} />
        </div>
        <div className="w-96 border-l border-gray-800 flex flex-col">
          <StudioPane selectedSourceId={selectedSourceId} onClearSource={() => setSelectedSourceId(null)} pendingArtifactId={pendingArtifactId} onClearPending={() => setPendingArtifactId(null)} />
        </div>
      </div>
    </div>
  );
}
