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
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <List className="text-green-600" size={20} />
          </div>
          <h3 className="text-2xl font-bold text-brown-900">
            All Challenges
          </h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchChallenges}
          disabled={isRefreshing}
        >
          <RefreshCw size={16} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Challenges Table */}
      <div className="bg-white rounded-2xl shadow-md border border-brown-200 overflow-x-auto">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin mb-4">
              <RefreshCw className="text-green-600" size={32} />
            </div>
            <p className="text-brown-600">Loading challenges...</p>
          </div>
        ) : challenges.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-brown-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trophy className="text-brown-400" size={32} />
            </div>
            <p className="text-brown-600">
              No challenges found. Create your first challenge to get started.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-brown-50 border-b border-brown-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Points</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Teams</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Created</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {challenges.map((challenge) => (
                <tr
                  key={challenge.id}
                  className="border-b border-brown-100 hover:bg-brown-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {challenge.challenge_category === 'containerized' ? (
                        <Container className="text-green-600" size={16} />
                      ) : (
                        <Folder className="text-orange-600" size={16} />
                      )}
                      <div>
                        <div className="text-brown-900 font-semibold">{challenge.name}</div>
                        {challenge.description && (
                          <div className="text-brown-600 text-xs mt-1 line-clamp-1">
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
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-orange-100 text-orange-700 border border-orange-200'
                      }`}
                    >
                      {challenge.is_active ? 'Active' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-brown-700">
                      {challenge.config?.challenge_type || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-green-600 font-semibold">{challenge.points}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-brown-700">
                      {challenge.total_teams || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-brown-600 text-xs">
                      {formatDate(challenge.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingChallengeId(challenge.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg border border-green-200 hover:border-green-300 transition-all"
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
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg border border-green-200 hover:border-green-300 transition-all"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(challenge.id, challenge.name)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg border border-orange-200 hover:border-orange-300 transition-all"
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
          <div className="bg-white rounded-xl shadow-md border border-brown-200 p-6">
            <div className="text-brown-600 text-sm mb-1">Total Challenges</div>
            <div className="text-green-600 text-3xl font-bold">{challenges.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-brown-200 p-6">
            <div className="text-brown-600 text-sm mb-1">Active</div>
            <div className="text-green-600 text-3xl font-bold">
              {challenges.filter((c) => c.is_active).length}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-brown-200 p-6">
            <div className="text-brown-600 text-sm mb-1">Pending</div>
            <div className="text-orange-600 text-3xl font-bold">
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
