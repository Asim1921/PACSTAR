'use client';

import React, { useEffect, useState } from 'react';
import { List, RefreshCw, Eye, Edit, Trash2, Container, Folder, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { challengeAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import { ChallengeView } from './ChallengeView';

interface Challenge {
  id: string;
  name: string;
  description: string;
  challenge_category: 'containerized' | 'static';
  status?: string;
  flag?: string;
  points: number;
  total_teams: number;
  is_active: boolean;
  instances?: any[];
  created_at: string;
  updated_at: string;
  created_by?: string;
  config?: {
    challenge_type?: string;
    image?: string;
    ports?: number[];
    file_path?: string;
    file_name?: string;
    download_url?: string;
  };
}

interface ChallengeListProps {
  onEdit?: (challengeId: string) => void;
}

export const ChallengeList: React.FC<ChallengeListProps> = ({ onEdit }) => {
  const { showToast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingChallengeId, setViewingChallengeId] = useState<string | null>(null);

  const fetchChallenges = async () => {
    try {
      setIsRefreshing(true);
      const response = await challengeAPI.listChallenges();
      
      const challengesList = Array.isArray(response) 
        ? response 
        : (response.challenges || []);
      
      if (challengesList.length > 0) {
        console.log('Challenges from API:', challengesList);
        challengesList.forEach((challenge: any, index: number) => {
          console.log(`Challenge ${index + 1} (${challenge.name}):`, {
            challenge_category: challenge.challenge_category,
            category: challenge.category,
            fullChallenge: challenge
          });
        });
      }
      
      const normalizedChallenges = challengesList.map((challenge: any) => {
        const category = challenge.challenge_category || challenge.category;
        if (!category) {
          console.warn(`Challenge "${challenge.name}" is missing category field!`, challenge);
        }
        return {
          ...challenge,
          challenge_category: category || 'unknown',
        };
      });
      
      const activeChallenges = normalizedChallenges.filter((challenge: Challenge) => 
        challenge.is_active !== false
      );
      
      setChallenges(activeChallenges);
    } catch (error: any) {
      console.error('Failed to fetch challenges:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to fetch challenges';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const handleDelete = async (challengeId: string, challengeName: string) => {
    if (!confirm(`Are you sure you want to delete "${challengeName}"?\n\nThis will move the challenge to the deleted list. You can restore it later or permanently delete it.`)) {
      return;
    }

    try {
      await challengeAPI.updateChallenge(challengeId, {
        is_active: false,
      });
      
      showToast('Challenge moved to deleted list', 'success');
      await fetchChallenges();
    } catch (error: any) {
      console.error('Failed to delete challenge:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to delete challenge';
      showToast(errorMessage, 'error');
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
          <div className="w-10 h-10 bg-neon-green/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-neon-green/40">
            <List className="text-neon-green" size={20} />
          </div>
          <h3 className="text-2xl font-bold text-white gradient-text">
            All Challenges
          </h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchChallenges}
          disabled={isRefreshing}
          className="border-neon-green/30 hover:bg-neon-green/10 text-white"
        >
          <RefreshCw size={16} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Challenges Table */}
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border overflow-x-auto">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin mb-4">
              <RefreshCw className="text-neon-green" size={32} />
            </div>
            <p className="text-white/60">Loading challenges...</p>
          </div>
        ) : challenges.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-cyber-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neon-green/20">
              <Trophy className="text-neon-green/60" size={32} />
            </div>
            <p className="text-white/60">
              No challenges found. Create your first challenge to get started.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-cyber-800/50 border-b border-neon-green/20">
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Points</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Teams</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Created</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {challenges.map((challenge) => (
                <tr
                  key={challenge.id}
                  className="border-b border-neon-green/10 hover:bg-cyber-800/30 transition-colors"
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
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full font-semibold text-xs ${
                        challenge.is_active
                          ? 'bg-neon-green/20 text-neon-green border border-neon-green/40'
                          : 'bg-neon-orange/20 text-neon-orange border border-neon-orange/40'
                      }`}
                    >
                      {challenge.is_active ? 'Active' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white/80">
                      {challenge.config?.challenge_type || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-neon-green font-semibold">{challenge.points}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white/80">
                      {challenge.total_teams || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white/60 text-xs">
                      {formatDate(challenge.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingChallengeId(challenge.id)}
                        className="p-2 text-neon-cyan hover:bg-neon-cyan/10 rounded-lg border border-neon-cyan/30 hover:border-neon-cyan/50 transition-all"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (onEdit) {
                            onEdit(challenge.id);
                          }
                        }}
                        className="p-2 text-neon-green hover:bg-neon-green/10 rounded-lg border border-neon-green/30 hover:border-neon-green/50 transition-all"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(challenge.id, challenge.name)}
                        className="p-2 text-neon-orange hover:bg-neon-orange/10 rounded-lg border border-neon-orange/30 hover:border-neon-orange/50 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={16} />
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
      {challenges.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-cyber-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-neon-green/20 terminal-border p-6">
            <div className="text-white/60 text-sm mb-1">Total Challenges</div>
            <div className="text-neon-green text-3xl font-bold">{challenges.length}</div>
          </div>
          <div className="bg-cyber-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-neon-green/20 terminal-border p-6">
            <div className="text-white/60 text-sm mb-1">Active</div>
            <div className="text-neon-green text-3xl font-bold">
              {challenges.filter((c) => c.is_active).length}
            </div>
          </div>
          <div className="bg-cyber-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-neon-orange/20 terminal-border p-6">
            <div className="text-white/60 text-sm mb-1">Pending</div>
            <div className="text-neon-orange text-3xl font-bold">
              {challenges.filter((c) => !c.is_active).length}
            </div>
          </div>
        </div>
      )}

      {/* Challenge View Modal */}
      {viewingChallengeId && (
        <ChallengeView
          challengeId={viewingChallengeId}
          onClose={() => setViewingChallengeId(null)}
        />
      )}
    </div>
  );
};
