'use client';

import React, { useEffect, useState } from 'react';
import { Trophy, RefreshCw, Medal, Award, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { challengeAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

interface ScoreboardEntry {
  team_id: string;
  team_name: string;
  points: number;
  solves: number;
}

export const Scoreboard: React.FC = () => {
  const { showToast } = useToast();
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchScoreboard = async () => {
    try {
      setIsRefreshing(true);
      const response = await challengeAPI.getScoreboard();
      
      // Handle both array and object responses
      const entries = Array.isArray(response) 
        ? response 
        : (response.scoreboard || []);
      
      // Sort by points (descending), then by solves (descending)
      const sorted = [...entries].sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return b.solves - a.solves;
      });
      
      setScoreboard(sorted);
    } catch (error: any) {
      console.error('Failed to fetch scoreboard:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to fetch scoreboard';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScoreboard();
  }, []);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Medal className="text-yellow-400" size={20} />;
    if (index === 1) return <Medal className="text-gray-300" size={20} />;
    if (index === 2) return <Medal className="text-neon-orange" size={20} />;
    return <Award className="text-neon-green" size={20} />;
  };

  if (isLoading) {
    return (
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border p-12">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="inline-block animate-spin mb-4">
              <RefreshCw className="text-neon-green" size={32} />
            </div>
            <p className="text-white/60">Loading scoreboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-neon-orange/10 rounded-xl flex items-center justify-center">
          <Trophy className="text-neon-orange" size={20} />
        </div>
        <h3 className="text-2xl font-bold gradient-text">
          Scoreboard
        </h3>
      </div>

      {scoreboard.length === 0 ? (
        <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border p-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-neon-orange/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trophy className="text-orange-400" size={32} />
            </div>
            <p className="text-white/60">
              No scores available yet. Be the first to solve a challenge!
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-cyber-800/50 border-b border-neon-green/20 terminal-border">
                <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Rank</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Team</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Points</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Solves</th>
              </tr>
            </thead>
            <tbody>
              {scoreboard.map((entry, index) => (
                <tr
                  key={entry.team_id}
                  className={`border-b border-brown-100 hover:bg-cyber-800/50 transition-colors ${
                    index < 3 ? 'bg-neon-green/10/50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getRankIcon(index)}
                      <span className={`font-bold ${index < 3 ? 'text-neon-green' : 'text-white'}`}>
                        #{index + 1}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users className="text-white/40" size={16} />
                      <span className="text-white font-semibold">{entry.team_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-semibold text-xs ${
                      index === 0 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-400/30' :
                      index === 1 ? 'bg-gray-500/10 text-gray-300 border border-gray-500/30' :
                      index === 2 ? 'bg-neon-orange/10 text-neon-orange border border-neon-orange/30' :
                      'bg-neon-green/10 text-neon-green border border-neon-green/30'
                    }`}>
                      <Trophy size={12} className="mr-1" />
                      {entry.points}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white/80">{entry.solves}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

