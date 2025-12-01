'use client';

import React, { useEffect, useState } from 'react';
import { X, Container, Folder, Trophy, Calendar, User, Flag, Target, Play, RotateCcw, Rocket, Square, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { challengeAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

interface Challenge {
  id: string;
  name: string;
  description: string;
  challenge_category: 'containerized' | 'static';
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
    environment_vars?: any;
    resources?: {
      cpu?: string;
      memory?: string;
    };
    file_path?: string;
    file_name?: string;
    download_url?: string;
  };
  allowed_teams?: string[] | null;
}

interface ChallengeViewProps {
  challengeId: string;
  onClose: () => void;
}

export const ChallengeView: React.FC<ChallengeViewProps> = ({ challengeId, onClose }) => {
  const { showToast } = useToast();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        setIsLoading(true);
        const data = await challengeAPI.getChallengeById(challengeId);
        setChallenge(data);
      } catch (error: any) {
        console.error('Failed to fetch challenge:', error);
        const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to fetch challenge';
        showToast(errorMessage, 'error');
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    if (challengeId) {
      fetchChallenge();
    }
  }, [challengeId, onClose, showToast]);

  const fetchStats = async () => {
    if (!challengeId) return;
    try {
      setIsLoadingStats(true);
      const data = await challengeAPI.getChallengeStats(challengeId);
      setStats(data);
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
      // Don't show error toast for stats, it's optional
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleStartChallenge = async () => {
    if (!challengeId) return;
    setIsActionLoading('start');
    try {
      await challengeAPI.startChallenge(challengeId);
      showToast('Challenge instance started successfully', 'success');
      fetchStats();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to start challenge';
      showToast(errorMessage, 'error');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleResetChallenge = async () => {
    if (!challengeId) return;
    setIsActionLoading('reset');
    try {
      await challengeAPI.resetChallenge(challengeId);
      showToast('Challenge instance reset successfully', 'success');
      fetchStats();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to reset challenge';
      showToast(errorMessage, 'error');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleDeployChallenge = async () => {
    if (!challengeId) return;
    setIsActionLoading('deploy');
    try {
      await challengeAPI.deployChallenge(challengeId, null, false);
      showToast('Challenge deployed successfully', 'success');
      fetchStats();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to deploy challenge';
      showToast(errorMessage, 'error');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleStopChallenge = async () => {
    if (!challengeId) return;
    if (!confirm('Are you sure you want to stop this challenge? This will stop all instances.')) {
      return;
    }
    setIsActionLoading('stop');
    try {
      await challengeAPI.stopChallenge(challengeId, false);
      showToast('Challenge stopped successfully', 'success');
      fetchStats();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to stop challenge';
      showToast(errorMessage, 'error');
    } finally {
      setIsActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-cyber-900/95 backdrop-blur-xl rounded-2xl shadow-xl p-8 border border-neon-green/20 terminal-border">
          <div className="text-center">
            <div className="inline-block animate-spin mb-4">
              <Trophy className="text-neon-green" size={32} />
            </div>
            <p className="text-white/80">Loading challenge details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-cyber-900/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 lg:p-8 border border-neon-green/20 terminal-border relative z-10 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {challenge.challenge_category === 'containerized' ? (
              <div className="w-12 h-12 bg-neon-green/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-neon-green/40">
                <Container className="text-neon-green" size={24} />
              </div>
            ) : (
              <div className="w-12 h-12 bg-neon-cyan/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-neon-cyan/40">
                <Folder className="text-neon-cyan" size={24} />
              </div>
            )}
            <h2 className="text-xl lg:text-2xl font-bold text-white gradient-text">
              {challenge.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-cyber-800/50 rounded-lg border border-neon-green/20 hover:border-neon-green/40 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Challenge Details */}
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
                  Description
                </label>
                <div className="p-4 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white/80 text-sm">
                  {challenge.description || 'No description provided'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
                  CATEGORY
                </label>
                <div className="flex items-center gap-2">
                  {challenge.challenge_category === 'containerized' ? (
                    <Container className="text-neon-green" size={16} />
                  ) : (
                    <Folder className="text-neon-cyan" size={16} />
                  )}
                  <span className="text-white font-mono capitalize">{challenge.challenge_category}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
                  CHALLENGE TYPE
                </label>
                <div className="text-white/80 font-mono">{challenge.config?.challenge_type || 'N/A'}</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
                  POINTS
                </label>
                <div className="flex items-center gap-2">
                  <Trophy className="text-neon-green" size={16} />
                  <span className="text-neon-green font-mono font-bold">{challenge.points}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
                  TOTAL TEAMS
                </label>
                <div className="flex items-center gap-2">
                  <Target className="text-neon-cyan" size={16} />
                  <span className="text-white font-mono">{challenge.total_teams || 0}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
                  ACTIVE STATUS
                </label>
                <div className="text-white/80 font-mono">
                  {challenge.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
                  CREATED AT
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="text-neon-cyan" size={16} />
                  <span className="text-white/60 font-mono text-xs">{formatDate(challenge.created_at)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
                  UPDATED AT
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="text-neon-cyan" size={16} />
                  <span className="text-white/60 font-mono text-xs">{formatDate(challenge.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Containerized Challenge Config */}
          {challenge.challenge_category === 'containerized' && challenge.config && (
            <div className="pt-6 border-t border-neon-green/20">
              <h3 className="text-base font-mono font-bold text-neon-green tracking-wider mb-4">
                Container Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white/90 mb-2">
                    DOCKER IMAGE
                  </label>
                  <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white/80 font-mono text-sm">
                    {challenge.config.image || 'N/A'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white/90 mb-2">
                    PORTS
                  </label>
                  <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white/80 font-mono text-sm">
                    {challenge.config.ports?.join(', ') || 'N/A'}
                  </div>
                </div>
                {challenge.config.resources && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-2">
                        CPU REQUEST
                      </label>
                      <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white/80 font-mono text-sm">
                        {challenge.config.resources.cpu || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-2">
                        MEMORY REQUEST
                      </label>
                      <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white/80 font-mono text-sm">
                        {challenge.config.resources.memory || 'N/A'}
                      </div>
                    </div>
                  </>
                )}
                {challenge.config.environment_vars && Object.keys(challenge.config.environment_vars).length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-white/90 mb-2">
                      ENVIRONMENT VARIABLES
                    </label>
                    <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white/80 font-mono text-sm">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(challenge.config.environment_vars, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Static Challenge Config */}
          {challenge.challenge_category === 'static' && challenge.config && (
            <div className="pt-6 border-t border-neon-green/20">
              <h3 className="text-base font-mono font-bold text-neon-cyan tracking-wider mb-4">
                File Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white/90 mb-2">
                    FILE NAME
                  </label>
                  <div className="p-3 bg-cyber-800/50 border-2 border-neon-cyan/20 rounded-xl text-white/80 font-mono text-sm">
                    {challenge.config.file_name || 'N/A'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white/90 mb-2">
                    FILE PATH
                  </label>
                  <div className="p-3 bg-cyber-800/50 border-2 border-neon-cyan/20 rounded-xl text-white/80 font-mono text-sm break-all">
                    {challenge.config.file_path || 'N/A'}
                  </div>
                </div>
                {challenge.config.download_url && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-white/90 mb-2">
                      DOWNLOAD URL
                    </label>
                    <div className="p-3 bg-cyber-800/50 border-2 border-neon-cyan/20 rounded-xl">
                      <a
                        href={challenge.config.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neon-cyan hover:text-neon-cyan/80 hover:underline font-mono text-sm break-all"
                      >
                        {challenge.config.download_url}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Team Restrictions */}
          {challenge.allowed_teams && challenge.allowed_teams.length > 0 && (
            <div className="pt-6 border-t border-neon-green/20">
              <h3 className="text-base font-mono font-bold text-neon-purple tracking-wider mb-4">
                Team Restrictions
              </h3>
              <div className="p-4 bg-cyber-800/50 border-2 border-neon-purple/20 rounded-xl">
                <div className="flex flex-wrap gap-2">
                  {challenge.allowed_teams.map((team, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-neon-purple/20 border border-neon-purple/50 text-neon-purple font-mono text-xs"
                    >
                      {team}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Challenge Actions (Admin Only) */}
          {challenge.challenge_category === 'containerized' && (
            <div className="pt-6 border-t border-neon-green/20">
              <h3 className="text-base font-mono font-bold text-neon-green tracking-wider mb-4">
                Challenge Actions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartChallenge}
                  disabled={isActionLoading !== null}
                  className="text-xs border-neon-green/30 hover:bg-neon-green/10 text-white"
                >
                  <Play size={14} className="mr-2" />
                  {isActionLoading === 'start' ? 'Starting...' : 'Start'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetChallenge}
                  disabled={isActionLoading !== null}
                  className="text-xs border-neon-cyan/30 hover:bg-neon-cyan/10 text-white"
                >
                  <RotateCcw size={14} className="mr-2" />
                  {isActionLoading === 'reset' ? 'Resetting...' : 'Reset'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeployChallenge}
                  disabled={isActionLoading !== null}
                  className="text-xs border-neon-purple/30 hover:bg-neon-purple/10 text-white"
                >
                  <Rocket size={14} className="mr-2" />
                  {isActionLoading === 'deploy' ? 'Deploying...' : 'Deploy'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStopChallenge}
                  disabled={isActionLoading !== null}
                  className="text-xs border-neon-orange/30 text-neon-orange hover:bg-neon-orange/10 hover:border-neon-orange/50 text-white"
                >
                  <Square size={14} className="mr-2" />
                  {isActionLoading === 'stop' ? 'Stopping...' : 'Stop'}
                </Button>
              </div>
            </div>
          )}

          {/* Challenge Stats */}
          <div className="pt-6 border-t border-neon-green/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-mono font-bold text-neon-green tracking-wider">
                Challenge Statistics
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStats}
                disabled={isLoadingStats}
                className="border-neon-green/30 hover:bg-neon-green/10 text-white text-xs"
              >
                <BarChart3 size={14} className={`mr-2 ${isLoadingStats ? 'animate-spin' : ''}`} />
                {isLoadingStats ? 'Loading...' : 'Refresh Stats'}
              </Button>
            </div>
            {stats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl">
                  <div className="text-white/60 text-xs font-mono mb-1">Total Instances</div>
                  <div className="text-neon-green text-xl font-bold font-mono">{stats.total_instances || 0}</div>
                </div>
                <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl">
                  <div className="text-white/60 text-xs font-mono mb-1">Running</div>
                  <div className="text-neon-green text-xl font-bold font-mono">{stats.running_instances || 0}</div>
                </div>
                <div className="p-3 bg-cyber-800/50 border-2 border-neon-orange/20 rounded-xl">
                  <div className="text-white/60 text-xs font-mono mb-1">Failed</div>
                  <div className="text-neon-orange text-xl font-bold font-mono">{stats.failed_instances || 0}</div>
                </div>
                <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl">
                  <div className="text-white/60 text-xs font-mono mb-1">Total Teams</div>
                  <div className="text-neon-green text-xl font-bold font-mono">{stats.total_teams || 0}</div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-cyber-800/50 border border-neon-green/20 text-center rounded-xl">
                <p className="text-white/60 font-mono text-sm">Click "Refresh Stats" to load statistics</p>
              </div>
            )}
          </div>

          {/* Close Button */}
          <div className="pt-6 border-t border-neon-green/20 flex justify-end">
            <Button
              variant="outline"
              size="md"
              onClick={onClose}
              className="border-neon-green/30 hover:bg-neon-green/10 text-white font-semibold tracking-wider"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

