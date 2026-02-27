import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "./hooks/useWorkspace";
import { workspaceApi, teamApi } from "./api/client";
import { Layout } from "./components/Layout";
import { LandingPage } from "./components/LandingPage";
import { WorkspaceHome } from "./components/WorkspaceHome";
import type { Team } from "./types";

const TEAMS_KEY = "tssllm_teams";

function getStoredTeamIds(): string[] {
  try {
    const raw = localStorage.getItem(TEAMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function storeTeamId(id: string) {
  const ids = getStoredTeamIds();
  if (!ids.includes(id)) {
    ids.unshift(id);
    localStorage.setItem(TEAMS_KEY, JSON.stringify(ids));
  }
}

function removeStoredTeamId(id: string) {
  const ids = getStoredTeamIds().filter((i) => i !== id);
  localStorage.setItem(TEAMS_KEY, JSON.stringify(ids));
}

function App() {
  const [team, setTeam] = useState<Team | null>(null);
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [savedTeams, setSavedTeams] = useState<Team[]>([]);

  // Fetch details for all stored team IDs
  const refreshSavedTeams = useCallback(async () => {
    const ids = getStoredTeamIds();
    const teams: Team[] = [];
    for (const id of ids) {
      try {
        const t = await teamApi.get(id);
        teams.push(t);
      } catch {
        removeStoredTeamId(id);
      }
    }
    setSavedTeams(teams);
    return teams;
  }, []);

  // On mount: check URL, then load saved teams
  useEffect(() => {
    const init = async () => {
      const urlMatch = window.location.pathname.match(/^\/t\/([a-f0-9-]{36})/);
      if (urlMatch) {
        try {
          const t = await teamApi.get(urlMatch[1]);
          setTeam(t);
          storeTeamId(t.id);
          const nbMatch = window.location.pathname.match(/\/w\/([a-f0-9-]{36})/);
          if (nbMatch) setNotebookId(nbMatch[1]);
        } catch {
          // invalid URL team — fall through to landing
        }
      }
      await refreshSavedTeams();
      setInitializing(false);
    };
    init();
  }, []);

  const handleTeamReady = useCallback(async (t: Team, defaultNotebookId?: string) => {
    setTeam(t);
    storeTeamId(t.id);
    await refreshSavedTeams();
    if (defaultNotebookId) {
      setNotebookId(defaultNotebookId);
      window.history.replaceState(null, "", `/t/${t.id}/w/${defaultNotebookId}`);
    } else {
      window.history.replaceState(null, "", `/t/${t.id}`);
    }
  }, [refreshSavedTeams]);

  const handleLeave = useCallback(() => {
    setTeam(null);
    setNotebookId(null);
    window.history.replaceState(null, "", "/");
  }, []);

  const handleRemoveTeam = useCallback(async (id: string) => {
    removeStoredTeamId(id);
    await refreshSavedTeams();
  }, [refreshSavedTeams]);

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
    return <LandingPage onTeamReady={handleTeamReady} savedTeams={savedTeams} onRemoveTeam={handleRemoveTeam} />;
  }

  // Team but no notebook selected → Workspace Home
  if (!notebookId || !workspaceId) {
    return (
      <WorkspaceHome
        team={team}
        onOpenNotebook={handleOpenNotebook}
        onLeave={handleLeave}
        onTeamUpdated={(t) => { setTeam(t); refreshSavedTeams(); }}
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
