'use client';

import React, { useEffect, useState } from 'react';
import { Trash2, RefreshCw, RotateCcw, XCircle, AlertTriangle, Container, Folder } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { challengeAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import { InfoBox } from '@/components/ui/InfoBox';

interface Challenge {
  id: string;
  name: string;
  description: string;
  challenge_category: 'containerized' | 'static';
  flag?: string;
  points: number;
  total_teams: number;
  is_active: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  config?: {
    challenge_type?: string;
    image?: string;
    ports?: number[];
    file_path?: string;
    file_name?: string;
    download_url?: string;
  };
}

export const ChallengeDeleteView: React.FC = () => {
  const { showToast } = useToast();
  const [deletedChallenges, setDeletedChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDeletedChallenges = async () => {
    try {
      setIsRefreshing(true);
      const response = await challengeAPI.listChallenges();
      
      const challengesList = Array.isArray(response) 
        ? response 
        : (response.challenges || []);
      
      const deleted = challengesList.filter((challenge: Challenge) => 
        !challenge.is_active
      );
      
      setDeletedChallenges(deleted);
    } catch (error: any) {
      console.error('Failed to fetch deleted challenges:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to fetch deleted challenges';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeletedChallenges();
  }, []);

  const handleRestore = async (challengeId: string, challengeName: string) => {
    if (!confirm(`Are you sure you want to restore "${challengeName}"?`)) {
      return;
    }

    setRestoringId(challengeId);
    try {
      await challengeAPI.updateChallenge(challengeId, {
        is_active: true,
      });
      
      showToast('Challenge restored successfully', 'success');
      await fetchDeletedChallenges();
    } catch (error: any) {
      console.error('Failed to restore challenge:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to restore challenge';
      showToast(errorMessage, 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (challengeId: string, challengeName: string) => {
    if (!confirm(`⚠️ WARNING: Are you sure you want to PERMANENTLY DELETE "${challengeName}"?\n\nThis action cannot be undone and will remove the challenge from the database forever.`)) {
      return;
    }

    if (!confirm(`This is your last chance. Permanently delete "${challengeName}"?`)) {
      return;
    }

    setDeletingId(challengeId);
    try {
      await challengeAPI.deleteChallenge(challengeId);
      
      showToast('Challenge permanently deleted', 'success');
      await fetchDeletedChallenges();
    } catch (error: any) {
      console.error('Failed to permanently delete challenge:', error);
      if (error.response?.status === 204) {
        showToast('Challenge permanently deleted', 'success');
        await fetchDeletedChallenges();
      } else {
        const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to permanently delete challenge';
        showToast(errorMessage, 'error');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neon-orange/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-neon-orange/40">
            <Trash2 className="text-neon-orange" size={20} />
          </div>
          <h3 className="text-2xl font-bold text-white gradient-text">
            Deleted Challenges
          </h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDeletedChallenges}
          disabled={isRefreshing}
          className="border-neon-orange/30 hover:bg-neon-orange/10 text-white"
        >
          <RefreshCw size={16} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Warning Info Box */}
      <InfoBox
        type="warning"
        message="Deleted challenges can be restored or permanently removed. Permanent deletion cannot be undone."
      />

      {/* Deleted Challenges Table */}
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-orange/20 terminal-border overflow-x-auto">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin mb-4">
              <RefreshCw className="text-neon-orange" size={32} />
            </div>
            <p className="text-white/60">Loading deleted challenges...</p>
          </div>
        ) : deletedChallenges.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-cyber-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neon-orange/20">
              <Trash2 className="text-neon-orange/60" size={32} />
            </div>
            <p className="text-white/60">
              No deleted challenges found.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-cyber-800/50 border-b border-neon-orange/20">
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Category</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Points</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Deleted At</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deletedChallenges.map((challenge) => (
                <tr
                  key={challenge.id}
                  className="border-b border-neon-orange/10 hover:bg-cyber-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {challenge.challenge_category === 'containerized' ? (
                        <Container className="text-neon-green" size={16} />
                      ) : (
                        <Folder className="text-neon-cyan" size={16} />
                      )}
                      <div>
                        <div className="text-white font-semibold">{challenge.name}</div>
                        {challenge.description && (
                          <div className="text-white/60 text-xs mt-1 line-clamp-1">
                            {challenge.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white/80 capitalize">
                      {challenge.challenge_category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white/80">
                      {challenge.config?.challenge_type || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-neon-orange font-semibold">{challenge.points}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white/60 text-xs">
                      {challenge.deleted_at 
                        ? formatDate(challenge.deleted_at)
                        : challenge.updated_at 
                        ? formatDate(challenge.updated_at)
                        : 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestore(challenge.id, challenge.name)}
                        disabled={restoringId === challenge.id || deletingId === challenge.id}
                        className="p-2 text-neon-green hover:bg-neon-green/10 rounded-lg border border-neon-green/30 hover:border-neon-green/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Restore Challenge"
                      >
                        {restoringId === challenge.id ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <RotateCcw size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(challenge.id, challenge.name)}
                        disabled={restoringId === challenge.id || deletingId === challenge.id}
                        className="p-2 text-neon-orange hover:bg-neon-orange/10 rounded-lg border border-neon-orange/30 hover:border-neon-orange/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Permanently Delete"
                      >
                        {deletingId === challenge.id ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <XCircle size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary Stats */}
      {deletedChallenges.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-cyber-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-neon-orange/20 terminal-border p-6">
            <div className="text-white/60 text-sm mb-1">Total Deleted</div>
            <div className="text-neon-orange text-3xl font-bold">{deletedChallenges.length}</div>
          </div>
          <div className="bg-cyber-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-neon-orange/20 terminal-border p-6">
            <div className="text-white/60 text-sm mb-1">Containerized</div>
            <div className="text-neon-orange text-3xl font-bold">
              {deletedChallenges.filter((c) => c.challenge_category === 'containerized').length}
            </div>
          </div>
          <div className="bg-cyber-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-neon-orange/20 terminal-border p-6">
            <div className="text-white/60 text-sm mb-1">Static</div>
            <div className="text-neon-orange text-3xl font-bold">
              {deletedChallenges.filter((c) => c.challenge_category === 'static').length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
