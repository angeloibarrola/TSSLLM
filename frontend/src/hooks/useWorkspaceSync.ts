import { useEffect, useRef, useCallback } from "react";

interface SyncCallbacks {
  onSourcesChanged?: () => void;
  onChatMessage?: () => void;
  onArtifactsChanged?: () => void;
}

export function useWorkspaceSync(workspaceId: string | null, callbacks: SyncCallbacks) {
  const wsRef = useRef<WebSocket | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const connect = useCallback(() => {
    if (!workspaceId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/workspaces/${workspaceId}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "sources_changed":
            callbacksRef.current.onSourcesChanged?.();
            break;
          case "chat_message":
            callbacksRef.current.onChatMessage?.();
            break;
          case "artifacts_changed":
            callbacksRef.current.onArtifactsChanged?.();
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      // Auto-reconnect after 2 seconds
      setTimeout(() => {
        if (wsRef.current === ws) {
          connect();
        }
      }, 2000);
    };

    wsRef.current = ws;
  }, [workspaceId]);

  useEffect(() => {
    connect();
    return () => {
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [connect]);
}
