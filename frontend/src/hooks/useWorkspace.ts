import { useState, useEffect, useCallback } from "react";
import { workspaceApi } from "../api/client";
import type { Workspace } from "../types";

export function useWorkspace(teamId: string | null) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshWorkspaces = useCallback(async () => {
    const list = await workspaceApi.list(teamId ?? undefined);
    setWorkspaces(list);
    return list;
  }, [teamId]);

  const switchWorkspace = useCallback((id: string) => {
    setWorkspaceId(id);
    if (teamId) {
      window.history.replaceState(null, "", `/t/${teamId}/w/${id}`);
    } else {
      window.history.replaceState(null, "", `/w/${id}`);
    }
  }, [teamId]);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    const init = async () => {
      let list = await refreshWorkspaces();

      // Check URL for notebook ID
      const match = window.location.pathname.match(/\/w\/([a-f0-9-]{36})/);
      if (match && list.some((ws) => ws.id === match[1])) {
        setWorkspaceId(match[1]);
        setLoading(false);
        return;
      }

      if (list.length === 0) {
        const created = await workspaceApi.create("Untitled Notebook", teamId);
        list = await refreshWorkspaces();
        switchWorkspace(created.id);
        setLoading(false);
        return;
      }

      switchWorkspace(list[0].id);
      setLoading(false);
    };

    init();
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { workspaceId, workspaces, switchWorkspace, refreshWorkspaces, loading };
}
