import { useState, useRef, useMemo } from "react";
import { Panel, Group as PanelGroup, usePanelRef, type PanelSize } from "react-resizable-panels";
import { Share2, Check, ArrowLeft } from "lucide-react";
import { SourcesPane } from "./sources/SourcesPane";
import { AddSourceModal } from "./sources/AddSourceModal";
import { ChatPane } from "./chat/ChatPane";
import { StudioPane } from "./studio/StudioPane";
import { ResizeHandle } from "./ResizeHandle";
import NotebookSwitcher from "./NotebookSwitcher";
import { createApi } from "../api/client";
import { useWorkspaceSync } from "../hooks/useWorkspaceSync";
import type { Workspace } from "../types";

interface LayoutProps {
  workspaceId: string;
  workspaces: Workspace[];
  onSwitchNotebook: (id: string) => void;
  onCreateNotebook: () => void;
  onRenameNotebook: (name: string) => void;
  onDeleteNotebook: () => void;
  onBackToHome?: () => void;
  teamName?: string;
  joinCode?: string;
}

export function Layout({ workspaceId, workspaces, onSwitchNotebook, onCreateNotebook, onRenameNotebook, onDeleteNotebook, onBackToHome, teamName }: LayoutProps) {
  const api = useMemo(() => createApi(workspaceId), [workspaceId]);

  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [enabledSourceIds, setEnabledSourceIds] = useState<Set<number>>(new Set());
  const [pendingArtifactId, setPendingArtifactId] = useState<number | null>(null);
  const allKnownIds = useRef<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  // Empty-state modal: show when notebook has no sources
  const [sourcesEmpty, setSourcesEmpty] = useState(true);
  const [modalDismissed, setModalDismissed] = useState(false);

  // Sync refresh counters — increment to trigger refetch in child panes
  const [sourcesRefresh, setSourcesRefresh] = useState(0);
  const [chatRefresh, setChatRefresh] = useState(0);
  const [artifactsRefresh, setArtifactsRefresh] = useState(0);

  useWorkspaceSync(workspaceId, {
    onSourcesChanged: () => setSourcesRefresh((n) => n + 1),
    onChatMessage: () => setChatRefresh((n) => n + 1),
    onArtifactsChanged: () => setArtifactsRefresh((n) => n + 1),
  });

  // Panel refs for programmatic collapse/expand
  const sourcesPanelRef = usePanelRef();
  const chatPanelRef = usePanelRef();
  const studioPanelRef = usePanelRef();

  // Track collapsed state for header button styling
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);

  const makeResizeHandler= (setCollapsed: (v: boolean) => void) => {
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
    setSourcesEmpty(sourceIds.length === 0);
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

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
              title="Back to workspace"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="text-lg font-bold tracking-tight">
            AI Knowledge Notebook {teamName && <span className="text-gray-400 font-normal text-sm ml-1">{teamName}</span>}
          </h1>
          <NotebookSwitcher
            workspaces={workspaces}
            currentWorkspaceId={workspaceId}
            onSwitch={onSwitchNotebook}
            onCreateNotebook={onCreateNotebook}
            onRenameNotebook={onRenameNotebook}
            onDeleteNotebook={onDeleteNotebook}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors bg-green-600 hover:bg-green-700 text-white"
            title="Copy workspace link"
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            {copied ? "Copied!" : "Share"}
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
            api={api}
            refreshKey={sourcesRefresh}
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
          <ChatPane api={api} refreshKey={chatRefresh} enabledSourceIds={enabledSourceIds} onSaveToNote={handleSaveToNote} />
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
          <StudioPane api={api} refreshKey={artifactsRefresh} selectedSourceId={selectedSourceId} onClearSource={() => setSelectedSourceId(null)} pendingArtifactId={pendingArtifactId} onClearPending={() => setPendingArtifactId(null)} />
        </Panel>
      </PanelGroup>
      {sourcesEmpty && !modalDismissed && (
        <AddSourceModal
          api={api}
          onSourceAdded={() => setSourcesRefresh((n) => n + 1)}
          onDismiss={() => setModalDismissed(true)}
        />
      )}
    </div>
  );
}
