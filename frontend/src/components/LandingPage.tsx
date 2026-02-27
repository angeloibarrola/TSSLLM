import { useState } from "react";
import { Plus, Loader2, Play, Users, X } from "lucide-react";
import { teamApi } from "../api/client";
import type { Team } from "../types";

interface LandingPageProps {
  onTeamReady: (team: Team, defaultNotebookId?: string) => void;
  savedTeams: Team[];
  onRemoveTeam: (id: string) => void;
}

export function LandingPage({ onTeamReady, savedTeams, onRemoveTeam }: LandingPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const team = await teamApi.create();
      onTeamReady(team);
    } catch (err: any) {
      setError(err.message || "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await teamApi.demo();
      onTeamReady(res, res.default_notebook_id ?? undefined);
    } catch (err: any) {
      setError(err.message || "Demo workspace not available");
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = async (t: Team) => {
    onTeamReady(t);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-950 text-gray-100">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2">📚 TSS LLM</h1>
          <p className="text-gray-400 text-lg">Trust and Security Services</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-xl text-lg font-semibold transition-colors"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            Create Workspace
          </button>

          <button
            onClick={handleDemo}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 rounded-xl text-lg font-semibold transition-colors"
          >
            <Play size={20} />
            Demo Workspace
          </button>

          <p className="text-gray-500 text-sm text-center mt-4">
            Have a workspace link? Just open it in your browser to join.
          </p>

          {error && (
            <p className="text-red-400 text-sm text-center mt-2">{error}</p>
          )}
        </div>

        {/* Saved Workspaces */}
        {savedTeams.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Your Workspaces</h3>
            <div className="space-y-2">
              {savedTeams.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleEnter(t)}
                  className="flex items-center gap-3 p-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl cursor-pointer transition-colors group"
                >
                  <Users size={18} className="text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.name}</p>
                    <p className="text-xs text-gray-500">
                      Created {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveTeam(t.id); }}
                    className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove from list"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
