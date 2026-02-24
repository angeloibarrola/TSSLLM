import { useState, useRef, useCallback } from "react";
import { Panel, Group as PanelGroup, usePanelRef, type PanelImperativeHandle, type PanelSize } from "react-resizable-panels";
import { BookOpen, MessageSquare, FileText } from "lucide-react";
import { SourcesPane } from "./sources/SourcesPane";
import { ChatPane } from "./chat/ChatPane";
import { StudioPane } from "./studio/StudioPane";
import { ResizeHandle } from "./ResizeHandle";
import { api } from "../api/client";

export function Layout() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [enabledSourceIds, setEnabledSourceIds] = useState<Set<number>>(new Set());
  const [pendingArtifactId, setPendingArtifactId] = useState<number | null>(null);
  const allKnownIds = useRef<Set<number>>(new Set());

  // Panel refs for programmatic collapse/expand
  const sourcesPanelRef = usePanelRef();
  const chatPanelRef = usePanelRef();
  const studioPanelRef = usePanelRef();

  // Track collapsed state for header button styling
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);

  const togglePanel = useCallback((ref: React.RefObject<PanelImperativeHandle | null>, collapsed: boolean) => {
    const panel = ref.current;
    if (!panel) return;
    if (collapsed) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, []);

  const makeResizeHandler = (setCollapsed: (v: boolean) => void) => {
    return (size: PanelSize) => {
      setCollapsed(size.asPercentage === 0);
    };
  };

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

  const setAllSources = (ids: number[]) => {
    setEnabledSourceIds(new Set(ids));
  };

  const onSourcesChanged = (sourceIds: number[]) => {
    const currentIds = new Set(sourceIds);
    setEnabledSourceIds((prev) => {
      if (prev.size === 0 && sourceIds.length > 0) {
        allKnownIds.current = currentIds;
        return new Set(sourceIds);
      }
      const next = new Set<number>();
      for (const id of prev) {
        if (currentIds.has(id)) next.add(id);
      }
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
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <h1 className="text-lg font-bold tracking-tight">
          📚 TSSLLM <span className="text-gray-400 font-normal text-sm ml-2">Team Source Studio</span>
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => togglePanel(sourcesPanelRef, sourcesCollapsed)}
            className={`p-1.5 rounded transition-colors ${sourcesCollapsed ? "text-gray-500 hover:text-gray-300" : "text-blue-400 hover:text-blue-300 bg-gray-800"}`}
            title={sourcesCollapsed ? "Show Sources" : "Hide Sources"}
          >
            <BookOpen size={18} />
          </button>
          <button
            onClick={() => togglePanel(chatPanelRef, chatCollapsed)}
            className={`p-1.5 rounded transition-colors ${chatCollapsed ? "text-gray-500 hover:text-gray-300" : "text-blue-400 hover:text-blue-300 bg-gray-800"}`}
            title={chatCollapsed ? "Show Chat" : "Hide Chat"}
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={() => togglePanel(studioPanelRef, studioCollapsed)}
            className={`p-1.5 rounded transition-colors ${studioCollapsed ? "text-gray-500 hover:text-gray-300" : "text-blue-400 hover:text-blue-300 bg-gray-800"}`}
            title={studioCollapsed ? "Show Studio" : "Hide Studio"}
          >
            <FileText size={18} />
          </button>
        </div>
      </header>
      <PanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
        <Panel
          id="sources"
          panelRef={sourcesPanelRef}
          defaultSize="20%"
          minSize="10%"
          collapsible
          collapsedSize="0%"
          onResize={makeResizeHandler(setSourcesCollapsed)}
          className="flex flex-col"
        >
          <SourcesPane
            onSelectSource={(id) => setSelectedSourceId(id)}
            selectedSourceId={selectedSourceId}
            enabledSourceIds={enabledSourceIds}
            onToggleSource={toggleSourceEnabled}
            onSetAllSources={setAllSources}
            onSourcesChanged={onSourcesChanged}
          />
        </Panel>
        <ResizeHandle id="sources-chat" />
        <Panel
          id="chat"
          panelRef={chatPanelRef}
          defaultSize="50%"
          minSize="20%"
          collapsible
          collapsedSize="0%"
          onResize={makeResizeHandler(setChatCollapsed)}
          className="flex flex-col min-w-0"
        >
          <ChatPane enabledSourceIds={enabledSourceIds} onSaveToNote={handleSaveToNote} />
        </Panel>
        <ResizeHandle id="chat-studio" />
        <Panel
          id="studio"
          panelRef={studioPanelRef}
          defaultSize="30%"
          minSize="10%"
          collapsible
          collapsedSize="0%"
          onResize={makeResizeHandler(setStudioCollapsed)}
          className="flex flex-col"
        >
          <StudioPane selectedSourceId={selectedSourceId} onClearSource={() => setSelectedSourceId(null)} pendingArtifactId={pendingArtifactId} onClearPending={() => setPendingArtifactId(null)} />
        </Panel>
      </PanelGroup>
    </div>
  );
}
