import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "./hooks/useWorkspace";
import { workspaceApi, teamApi } from "./api/client";
import { Layout } from "./components/Layout";
import { LandingPage } from "./components/LandingPage";
import { WorkspaceHome } from "./components/WorkspaceHome";
import type { Team } from "./types";

const TEAM_KEY = "tssllm_team_id";

function App() {
  const [team, setTeam] = useState<Team | null>(null);
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Restore team from localStorage or URL on mount
  useEffect(() => {
    const init = async () => {
      // Check URL first: /t/{teamId}...
      const urlMatch = window.location.pathname.match(/^\/t\/([a-f0-9-]{36})/);
      const storedId = urlMatch?.[1] || localStorage.getItem(TEAM_KEY);

      if (storedId) {
        try {
          const t = await teamApi.get(storedId);
          setTeam(t);
          localStorage.setItem(TEAM_KEY, t.id);

          // Check if URL also has a notebook
          const nbMatch = window.location.pathname.match(/\/w\/([a-f0-9-]{36})/);
          if (nbMatch) {
            setNotebookId(nbMatch[1]);
          }
        } catch {
          localStorage.removeItem(TEAM_KEY);
        }
      }
      setInitializing(false);
    };
    init();
  }, []);

  const handleTeamReady = useCallback((t: Team) => {
    setTeam(t);
    localStorage.setItem(TEAM_KEY, t.id);
    window.history.replaceState(null, "", `/t/${t.id}`);
  }, []);

  const handleLeave = useCallback(() => {
    setTeam(null);
    setNotebookId(null);
    localStorage.removeItem(TEAM_KEY);
    window.history.replaceState(null, "", "/");
  }, []);

  const handleOpenNotebook = useCallback((id: string) => {
    setNotebookId(id);
    if (team) {
      window.history.replaceState(null, "", `/t/${team.id}/w/${id}`);
    }
  }, [team]);

  const handleBackToHome = useCallback(() => {
    setNotebookId(null);
    if (team) {
      window.history.replaceState(null, "", `/t/${team.id}`);
    }
  }, [team]);

  const { workspaceId, workspaces, switchWorkspace, refreshWorkspaces } = useWorkspace(team?.id ?? null);

  // Sync notebookId into useWorkspace
  useEffect(() => {
    if (notebookId && notebookId !== workspaceId) {
      switchWorkspace(notebookId);
    }
  }, [notebookId]);

  if (initializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // No team → Landing Page
  if (!team) {
    return <LandingPage onTeamReady={handleTeamReady} />;
  }

  // Team but no notebook selected → Workspace Home
  if (!notebookId || !workspaceId) {
    return (
      <WorkspaceHome
        team={team}
        onOpenNotebook={handleOpenNotebook}
        onLeave={handleLeave}
        onTeamUpdated={(t) => { setTeam(t); localStorage.setItem(TEAM_KEY, t.id); }}
      />
    );
  }

  // In a notebook → full Layout
  const handleCreateNotebook = async () => {
    const created = await workspaceApi.create("Untitled Notebook", team.id);
    await refreshWorkspaces();
    handleOpenNotebook(created.id);
  };

  const handleRenameNotebook = async (name: string) => {
    await workspaceApi.rename(workspaceId, name);
    await refreshWorkspaces();
  };

  const handleDeleteNotebook = async () => {
    await workspaceApi.delete(workspaceId);
    const list = await refreshWorkspaces();
    if (list.length > 0) {
      handleOpenNotebook(list[0].id);
    } else {
      handleBackToHome();
    }
  };

  return (
    <Layout
      key={workspaceId}
      workspaceId={workspaceId}
      workspaces={workspaces}
      onSwitchNotebook={(id) => handleOpenNotebook(id)}
      onCreateNotebook={handleCreateNotebook}
      onRenameNotebook={handleRenameNotebook}
      onDeleteNotebook={handleDeleteNotebook}
      onBackToHome={handleBackToHome}
      teamName={team.name}
      joinCode={team.join_code}
    />
  );
}

export default App;
