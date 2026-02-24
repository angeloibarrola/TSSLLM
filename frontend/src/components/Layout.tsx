import { useState } from "react";
import { SourcesPane } from "./sources/SourcesPane";
import { ChatPane } from "./chat/ChatPane";
import { StudioPane } from "./studio/StudioPane";

export function Layout() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="flex items-center px-6 py-3 bg-gray-900 border-b border-gray-800">
        <h1 className="text-lg font-bold tracking-tight">
          📚 TSSLLM <span className="text-gray-400 font-normal text-sm ml-2">Team Source Studio</span>
        </h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r border-gray-800 flex flex-col">
          <SourcesPane onSelectSource={(id) => setSelectedSourceId(id)} selectedSourceId={selectedSourceId} />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPane />
        </div>
        <div className="w-96 border-l border-gray-800 flex flex-col">
          <StudioPane selectedSourceId={selectedSourceId} onClearSource={() => setSelectedSourceId(null)} />
        </div>
      </div>
    </div>
  );
}
