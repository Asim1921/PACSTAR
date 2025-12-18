'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, RefreshCw, Download, Container, Folder, Trophy, ExternalLink, Flag, CheckCircle, XCircle, Rocket, Clock, Users, RotateCcw, Globe, HelpCircle, Cloud, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { InfoBox } from '@/components/ui/InfoBox';
import { challengeAPI, fileAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

interface Challenge {
  id: string;
  name: string;
  description: string;
  challenge_category: 'containerized' | 'static' | 'openstack';
  status?: string;
  flag?: string;
  points: number;
  total_teams: number;
  is_active: boolean;
  instances?: Array<{
    team_id: string;
    instance_id: string;
    public_ip?: string;
    internal_ip?: string;
    status: string;
    created_at: string;
    // OpenStack specific fields
    stack_id?: string;
    stack_name?: string;
    server_id?: string;
    network_id?: string;
    vnc_console_url?: string;
    auto_delete_at?: string;
    last_reset_by?: string;
    last_reset_at?: string;
    // Containerized specific fields
    pod_name?: string;
    service_name?: string;
    namespace?: string;
  }>;
  created_at: string;
  config?: {
    challenge_type?: string;
    image?: string;
    ports?: number[];
    file_path?: string;
    file_name?: string;
    download_url?: string;
    heat_template?: string;
    heat_template_parameters?: any;
  };
  access_info?: {
    public_ip?: string;
    ip?: string;
    instance_ip?: string;
    ports?: number[];
    access_url?: string;
    url?: string;
    instance_url?: string;
    status?: string;
    [key: string]: any; // Allow additional properties
  };
  deployed_count?: number;
}

interface UserChallengesProps {
  teamId?: string | null;
}

export const UserChallenges: React.FC<UserChallengesProps> = ({ teamId: propTeamId }) => {
  const { showToast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [submittingFlagFor, setSubmittingFlagFor] = useState<string | null>(null);
  const [flagInputs, setFlagInputs] = useState<Record<string, string>>({});
  const [showFlagInput, setShowFlagInput] = useState<Record<string, boolean>>({});
  const [startingChallenge, setStartingChallenge] = useState<string | null>(null);
  const [refreshingChallenge, setRefreshingChallenge] = useState<string | null>(null);
  const [resettingChallenge, setResettingChallenge] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamCode, setTeamCode] = useState<string | null>(null);

  const fetchChallenges = async () => {
    try {
      setIsRefreshing(true);
      const response = await challengeAPI.listChallenges();
      
      // Handle both array and object with challenges property
      const challengesList = Array.isArray(response) 
        ? response 
        : (response.challenges || []);
      
      // Filter to show only active challenges
      const activeChallenges = challengesList.filter((challenge: Challenge) => 
        challenge.is_active !== false
      );
      
      // For containerized and openstack challenges, try to get access info and stats for the team
      const challengesWithAccess = await Promise.all(
        activeChallenges.map(async (challenge: Challenge) => {
              // Get team ID from prop or localStorage
              let currentTeamId = propTeamId;
              
              if (!currentTeamId) {
                const teamData = localStorage.getItem('team_info');
                if (teamData) {
                  try {
                    const parsed = JSON.parse(teamData);
                    currentTeamId = parsed.id || parsed.team_id;
                  } catch (e) {
                    console.error('Error parsing team data:', e);
                  }
                }
              }
              
          // Handle OpenStack challenges - use instance data directly
          if (challenge.challenge_category === 'openstack') {
            try {
              // Get stats for deployed count
              const stats = await challengeAPI.getChallengeStats(challenge.id);
              const deployedCount = stats.running_instances || 0;
              
              // Find the team's instance in the challenge instances array
              // Try multiple team_id patterns: direct match, team code, or just search all instances
              let teamInstance = null;
              if (challenge.instances && challenge.instances.length > 0) {
                // First try direct team_id match
                if (currentTeamId) {
                  teamInstance = challenge.instances.find(inst => inst.team_id === currentTeamId);
                }
                
                // If no match, try to find instance by checking if team_id contains our team info
                if (!teamInstance && currentTeamId) {
                  // Get team code if available
                  const teamData = localStorage.getItem('team_info');
                  let teamCode = null;
                  if (teamData) {
                    try {
                      const parsed = JSON.parse(teamData);
                      teamCode = parsed.team_code;
                    } catch (e) {
                      // ignore
                    }
                  }
                  
                  // Try to match by team code or other patterns
                  if (teamCode) {
                    teamInstance = challenge.instances.find(inst => 
                      inst.team_id?.includes(teamCode) || 
                      inst.team_id?.toLowerCase().includes(teamCode.toLowerCase())
                    );
                  }
                }
                
                // If still no match and we have instances, just take the first one (might be the user's)
                // This is a fallback - ideally we should always have the correct team_id
                if (!teamInstance && challenge.instances.length === 1) {
                  teamInstance = challenge.instances[0];
                }
              }
              
              if (teamInstance) {
                // Create access_info-like structure from instance data for consistency
                return {
                  ...challenge,
                  access_info: {
                    public_ip: teamInstance.public_ip, // This is the floating IP for OpenStack
                    status: teamInstance.status,
                    // OpenStack specific fields
                    stack_id: teamInstance.stack_id,
                    stack_name: teamInstance.stack_name,
                    server_id: teamInstance.server_id,
                    network_id: teamInstance.network_id,
                    vnc_console_url: teamInstance.vnc_console_url,
                    auto_delete_at: teamInstance.auto_delete_at,
                    last_reset_by: teamInstance.last_reset_by,
                    last_reset_at: teamInstance.last_reset_at,
                    team_id: teamInstance.team_id,
                  },
                  deployed_count: deployedCount,
                };
              }
              
              return {
                ...challenge,
                deployed_count: deployedCount,
              };
            } catch (error: any) {
              console.warn(`Failed to process OpenStack challenge ${challenge.id}:`, error);
              return challenge;
                }
              }
              
          // Only fetch access info and stats for containerized challenges
          if (challenge.challenge_category === 'containerized') {
            try {
              if (currentTeamId) {
                try {
                  const accessInfo = await challengeAPI.getTeamAccessInfo(challenge.id, currentTeamId);
                  console.log(`Access info for challenge ${challenge.id}:`, accessInfo);
                  // Try to get stats to get deployed count
                  try {
                    const stats = await challengeAPI.getChallengeStats(challenge.id);
                    return {
                      ...challenge,
                      access_info: accessInfo,
                      deployed_count: stats.running_instances || 0,
                    };
                  } catch {
                  return {
                    ...challenge,
                    access_info: accessInfo,
                      deployed_count: 0,
                    };
                  }
                } catch (error: any) {
                  // If access info fetch fails, check if challenge is deployed
                  // If deployedCount > 0, we should retry or show that we're fetching
                  // Only log non-404 errors as warnings
                  if (error.response?.status !== 404) {
                  console.warn(`Failed to fetch access info for challenge ${challenge.id}:`, error);
                  } else {
                    console.log(`Access info not available yet for challenge ${challenge.id} (404 - instance may not be started)`);
                  }
                  // If challenge shows as deployed but we don't have access info, 
                  // we'll still show the deployed state but without IP/URL (will show after refresh)
                }
              }
              // Try to get stats even without team ID
              try {
                const stats = await challengeAPI.getChallengeStats(challenge.id);
                const deployedCount = stats.running_instances || 0;
                
                // If challenge is deployed (deployedCount > 0) but we don't have access info yet,
                // try to fetch it one more time (maybe it was a timing issue or 404 was temporary)
                if (deployedCount > 0 && currentTeamId) {
                  try {
                    const accessInfo = await challengeAPI.getTeamAccessInfo(challenge.id, currentTeamId);
                    console.log(`Retrieved access info for deployed challenge ${challenge.id}:`, accessInfo);
                    return {
                      ...challenge,
                      access_info: accessInfo,
                      deployed_count: deployedCount,
                    };
                  } catch (retryError: any) {
                    console.warn(`Retry failed to fetch access info for challenge ${challenge.id}:`, retryError);
                    // Still return with deployed count even if access info fails
                    // The UI will show deployed state but may need refresh to get IP/URL
                    return {
                      ...challenge,
                      deployed_count: deployedCount,
                    };
                  }
                }
                
                return {
                  ...challenge,
                  deployed_count: deployedCount,
                };
              } catch {
                return {
                  ...challenge,
                  deployed_count: 0,
                };
              }
            } catch (error: any) {
              // If access info fetch fails, continue without it
              // 404 is expected if instance hasn't been started yet
              if (error.response?.status !== 404) {
              console.warn(`Failed to fetch access info for challenge ${challenge.id}:`, error);
              }
            }
          }
          return challenge;
        })
      );
      
      setChallenges(challengesWithAccess);
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
    // Get team ID and team code from prop or localStorage
    let currentTeamId: string | null = propTeamId || null;
    let currentTeamCode: string | null = null;
    
    if (!currentTeamId) {
      const teamData = localStorage.getItem('team_info');
      if (teamData) {
        try {
          const parsed = JSON.parse(teamData);
          currentTeamId = parsed.id || parsed.team_id || null;
          currentTeamCode = parsed.team_code || parsed.teamCode || null;
        } catch (e) {
          console.error('Error parsing team data:', e);
        }
      }
    } else {
      // If teamId is provided as prop, still try to get team_code from localStorage
      const teamData = localStorage.getItem('team_info');
      if (teamData) {
        try {
          const parsed = JSON.parse(teamData);
          currentTeamCode = parsed.team_code || parsed.teamCode || null;
        } catch (e) {
          console.error('Error parsing team data:', e);
        }
      }
    }
    
    setTeamId(currentTeamId);
    setTeamCode(currentTeamCode);
    fetchChallenges();
  }, [propTeamId]);


  const handleSubmitFlag = async (challengeId: string) => {
    const flag = flagInputs[challengeId]?.trim();
    if (!flag) {
      showToast('Please enter a flag', 'error');
      return;
    }

    setSubmittingFlagFor(challengeId);
    try {
      const result = await challengeAPI.submitFlag(challengeId, flag);
      if (result.success) {
        showToast(result.message || `Flag is correct! You earned ${result.points || 0} points.`, 'success');
        setFlagInputs((prev) => ({ ...prev, [challengeId]: '' }));
        setShowFlagInput((prev) => ({ ...prev, [challengeId]: false }));
        // Refresh challenges to update solved status
        fetchChallenges();
      } else {
        showToast(result.message || 'Incorrect flag', 'error');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to submit flag';
      showToast(errorMessage, 'error');
    } finally {
      setSubmittingFlagFor(null);
    }
  };

  const handleStartChallenge = async (challengeId: string) => {
    setStartingChallenge(challengeId);
    try {
      const result = await challengeAPI.startChallenge(challengeId);
      showToast('Challenge instance started successfully', 'success');
      // Wait a moment for the instance to be ready, then refresh
      setTimeout(async () => {
        await refreshChallenge(challengeId);
        // Refresh again after a bit more time to ensure IP is available
        setTimeout(async () => {
          await refreshChallenge(challengeId);
        }, 2000);
      }, 1000);
    } catch (error: any) {
      console.error('Start challenge error:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to start challenge';
      showToast(errorMessage, 'error');
    } finally {
      setStartingChallenge(null);
    }
  };

  const handleResetChallenge = async (challengeId: string) => {
    if (!confirm('Are you sure you want to reset your challenge instance? This will redeploy your instance.')) {
      return;
    }
    setResettingChallenge(challengeId);
    try {
      await challengeAPI.resetChallenge(challengeId);
      showToast('Challenge instance reset successfully', 'success');
      // Refresh the challenge to get updated status
      await refreshChallenge(challengeId);
    } catch (error: any) {
      console.error('Reset challenge error:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to reset challenge';
      showToast(errorMessage, 'error');
    } finally {
      setResettingChallenge(null);
    }
  };

  const handleResetChallengeOpenStack = async (challengeId: string, resetType: 'restart' | 'redeploy') => {
    const action = resetType === 'restart' ? 'restart' : 'redeploy';
    if (!confirm(`Are you sure you want to ${action} your VM instance?`)) {
      return;
    }
    setResettingChallenge(challengeId);
    try {
      await challengeAPI.resetChallenge(challengeId, resetType);
      showToast(`VM ${resetType === 'restart' ? 'restarted' : 'redeployed'} successfully`, 'success');
      // Refresh the challenge to get updated status
      await refreshChallenge(challengeId);
    } catch (error: any) {
      console.error(`Reset challenge (${resetType}) error:`, error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || `Failed to ${action} VM`;
      showToast(errorMessage, 'error');
    } finally {
      setResettingChallenge(null);
    }
  };

  const refreshChallenge = async (challengeId: string) => {
    setRefreshingChallenge(challengeId);
    try {
      // Refetch all challenges to get updated data including access info
      await fetchChallenges();
      // Log the challenge data after refresh to debug
      const refreshedChallenge = challenges.find(c => c.id === challengeId);
      if (refreshedChallenge) {
        console.log(`Refreshed challenge ${challengeId} data:`, {
          access_info: refreshedChallenge.access_info,
          deployed_count: refreshedChallenge.deployed_count,
        });
      }
    } catch (error: any) {
      console.error('Failed to refresh challenge:', error);
      // Still show a toast but don't fail completely
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to refresh challenge';
      showToast(errorMessage, 'error');
    } finally {
      setRefreshingChallenge(null);
    }
  };

  const handleDownloadFile = async (downloadUrl: string, fileName: string) => {
    try {
      showToast('Preparing download...', 'info');
      
      // Construct the full URL
      const backendUrl = 'http://192.168.15.248:8001';
      let fullUrl = downloadUrl;
      
      // If it's a relative URL, prepend backend URL
      if (!downloadUrl.startsWith('http')) {
        // Handle both /api/v1/files/serve/{id} and /files/serve/{id} formats
        if (downloadUrl.startsWith('/')) {
          fullUrl = `${backendUrl}${downloadUrl}`;
        } else {
          fullUrl = `${backendUrl}/api/v1/${downloadUrl}`;
        }
      }
      
      // Get auth token for authenticated download
      const token = localStorage.getItem('auth_token');
      
      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = fileName;
      link.target = '_blank';
      
      // If token exists, we might need to add it to headers, but for serve endpoint it should be public
      // For now, just open the link
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('File download started', 'success');
    } catch (error: any) {
      console.error('Failed to download file:', error);
      showToast('Failed to download file', 'error');
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-neon-green/10 rounded-xl flex items-center justify-center">
          <BookOpen className="text-neon-green" size={20} />
        </div>
          <h3 className="text-2xl font-bold gradient-text">
          Available Challenges
        </h3>
      </div>

      {isLoading ? (
        <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border p-12">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="inline-block animate-spin mb-4">
                <RefreshCw className="text-neon-green" size={32} />
              </div>
              <p className="text-white/60">Loading challenges...</p>
            </div>
          </div>
        </div>
      ) : challenges.length === 0 ? (
        <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border p-12">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-cyber-800/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="text-white/40" size={32} />
              </div>
              <p className="text-white/60">
                No challenges available at the moment.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {challenges.map((challenge) => {
            // Check for access info in multiple places
            const accessInfo: Record<string, unknown> = challenge.access_info || challenge.instances?.[0] || {};
            const hasAccessInfo = accessInfo && (
              accessInfo.access_url || 
              accessInfo.url || 
              accessInfo.instance_url ||
              accessInfo.public_ip || 
              accessInfo.ip || 
              accessInfo.instance_ip
            );
            const instanceStatus = String(accessInfo.status || challenge.access_info?.status || 'running');
            const deployedCount = challenge.deployed_count || 0;
            // Show RUNNING if deployed, otherwise show ACTIVE
            const challengeStatus = deployedCount > 0 ? 'RUNNING' : 'ACTIVE';
            const isRefreshing = refreshingChallenge === challenge.id;
            const isStarting = startingChallenge === challenge.id;
            const isResetting = resettingChallenge === challenge.id;
            // If deployedCount > 0, it means instance is deployed - show instance info, not Start button
            // OR if we have access info (IP/URL), show instance info
            // For OpenStack, check if we have instance data (stack_id, server_id, etc.)
            const hasOpenStackInstance = challenge.challenge_category === 'openstack' && 
              (challenge.access_info?.stack_id || challenge.access_info?.server_id || challenge.access_info?.public_ip);
            const isInstanceDeployed = deployedCount > 0 || hasAccessInfo || hasOpenStackInstance;
            
            // Debug logging
            if (isInstanceDeployed && !hasAccessInfo) {
              console.log(`Challenge ${challenge.id} is deployed but missing access info:`, {
                challenge,
                access_info: challenge.access_info,
                instances: challenge.instances,
              });
            }
            
            return (
              <div
                key={challenge.id}
                className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border p-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Side - Challenge Details */}
                  <div className="lg:col-span-2 space-y-4">
                {/* Challenge Header */}
                    <div className="flex items-start gap-3">
                    {challenge.challenge_category === 'containerized' ? (
                        <div className="w-12 h-12 bg-neon-green/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Container className="text-neon-green" size={24} />
                        </div>
                    ) : challenge.challenge_category === 'openstack' ? (
                        <div className="w-12 h-12 bg-neon-cyan/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Cloud className="text-neon-cyan" size={24} />
                        </div>
                    ) : (
                        <div className="w-12 h-12 bg-neon-orange/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Folder className="text-neon-orange" size={24} />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h4 className="text-xl font-bold text-white mb-2 break-words">
                        {challenge.name}
                      </h4>
                {challenge.description && (
                          <p className="text-white/60 text-sm mb-3">
                    {challenge.description}
                  </p>
                )}
                  </div>
                    </div>

                    {/* Challenge Status and Details */}
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-white/60">Status:</span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-semibold text-xs ${
                          challengeStatus === 'RUNNING'
                            ? 'bg-neon-green/10 text-neon-green border border-neon-green/30'
                            : 'bg-neon-green/10 text-neon-green border border-neon-green/30'
                        }`}>
                          {challengeStatus}
                        </span>
                    </div>
                      
                      <div className="flex items-center gap-2">
                        <Users className="text-white/40" size={16} />
                        <span className="text-white/60">Max Teams:</span>
                        <span className="text-white font-semibold">{challenge.total_teams || 0}</span>
                      </div>

                      {(challenge.challenge_category === 'containerized' || challenge.challenge_category === 'openstack') && (
                        <div className="flex items-center gap-2">
                          <span className="text-white/60">Deployed:</span>
                          <span className="text-neon-green font-semibold">
                            {deployedCount}/{challenge.total_teams || 0}
                          </span>
                        </div>
                      )}

                      {challenge.points && (
                        <div className="flex items-center gap-2">
                          <Trophy className="text-neon-orange" size={16} />
                          <span className="text-white/60">Points:</span>
                          <span className="text-neon-green font-semibold">{challenge.points}</span>
                        </div>
                      )}

                      {challenge.challenge_category === 'containerized' && challenge.config?.ports && (
                        <div className="flex items-center gap-2">
                          <span className="text-white/60">Ports:</span>
                          <span className="text-white font-medium">{challenge.config.ports.join(', ')}</span>
                    </div>
                  )}
                </div>


                  {/* Download button for static challenges */}
                  {challenge.challenge_category === 'static' && challenge.config?.download_url && (
                      <div className="mt-4">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => handleDownloadFile(
                        challenge.config!.download_url!,
                        challenge.config!.file_name || 'challenge-file'
                      )}
                    >
                      <Download size={16} className="mr-2" />
                      Download File
                    </Button>
                      </div>
                    )}
                  </div>

                  {/* Right Side - Action Panel */}
                  <div className="lg:col-span-1 space-y-4">
                    {/* Active Badge */}
                    {challenge.is_active && (
                      <div className="flex justify-end">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-neon-green/10 border border-neon-green/30 text-neon-green font-semibold text-xs">
                          <div className="w-2 h-2 bg-neon-green rounded-full mr-2" />
                          Active
                        </span>
                      </div>
                    )}

                    {/* Instance Information for OpenStack Challenges - When Deployed */}
                    {challenge.challenge_category === 'openstack' && isInstanceDeployed && (
                      <div className="space-y-4">
                        {/* Your Instance Running Badge */}
                        <div className="flex justify-end">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-neon-green/10 border border-neon-green/30 text-neon-green font-semibold text-xs">
                            <div className="w-2 h-2 bg-neon-green rounded-full mr-2 animate-pulse" />
                            Your Instance Running
                          </span>
                        </div>

                        {/* Instance Details */}
                        <div className="space-y-3 bg-neon-cyan/10 rounded-xl p-4 border border-neon-cyan/30">
                          {(() => {
                            const info = challenge.access_info || {};
                            const floatingIp = info.public_ip;
                            if (!floatingIp) return null;
                            
                            return (
                              <>
                                {/* Floating IP Address */}
                                <div className="flex items-center gap-2">
                                  <Globe className="text-neon-cyan" size={16} />
                                  <span className="text-white/60 text-sm">Floating IP Address:</span>
                                  <span className="text-neon-cyan font-semibold text-sm">{floatingIp}</span>
                                </div>
                                <div className="text-white/40 text-xs ml-6">
                                  This is your VM's accessible IP address from the external network
                                </div>

                                {/* VNC Console Access */}
                                {info.vnc_console_url && (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <Monitor className="text-neon-cyan" size={16} />
                                      <span className="text-white/60 text-sm">VNC Console Access:</span>
                                    </div>
                                    <a
                                      href={info.vnc_console_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-neon-cyan hover:text-neon-cyan/80 hover:underline font-semibold text-sm break-all ml-6 block"
                                    >
                                      {info.vnc_console_url}
                                    </a>
                                    <InfoBox
                                      type="info"
                                      message="Click the VNC Console link above to access your VM's desktop in the browser!"
                                    />
                                    <div className="text-white/40 text-xs ml-6">
                                      VNC Console provides remote desktop access to your OpenStack VM
                                    </div>
                                  </>
                                )}

                                {/* Stack Name */}
                                {info.stack_name && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/60 text-sm">Stack Name:</span>
                                    <span className="text-neon-cyan font-semibold text-sm">{info.stack_name}</span>
                                  </div>
                                )}

                                {/* Server ID */}
                                {info.server_id && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/60 text-sm">Server ID:</span>
                                    <span className="text-neon-cyan font-semibold text-sm font-mono text-xs">{info.server_id}</span>
                                  </div>
                                )}

                                {/* Auto-delete Information */}
                                {info.auto_delete_at && (
                                  <div className="flex items-start gap-2 p-2 bg-neon-orange/10 rounded border border-neon-orange/20">
                                    <span className="text-neon-orange">⚠</span>
                                    <div className="flex-1">
                                      <span className="text-white/60 text-sm block">Auto-delete:</span>
                                      <span className="text-neon-orange text-sm font-semibold">
                                        This VM will be automatically deleted at {new Date(info.auto_delete_at).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Status */}
                                <div className="flex items-center gap-2">
                                  <span className="text-white/60 text-sm">Status:</span>
                                  <span className="text-neon-green text-sm font-semibold">
                                    {info.status || 'running'}
                                  </span>
                                </div>

                                {/* Team ID */}
                                {(teamCode || teamId || info.team_id) && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/60 text-sm">Team ID:</span>
                                    <span className="text-neon-cyan text-sm font-semibold">{teamCode || teamId || info.team_id}</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* Separator */}
                        <div className="border-t border-neon-cyan/20 terminal-border my-4"></div>

                        {/* VM Management Actions */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="text-white/40" size={14} />
                            <span className="text-white/60 text-sm">Having issues? Reset your VM instance</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetChallengeOpenStack(challenge.id, 'restart')}
                              disabled={isResetting || isStarting}
                              className="w-full"
                            >
                              <RotateCcw size={16} className={`mr-2 ${isResetting ? 'animate-spin' : ''}`} />
                              Restart VM
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetChallengeOpenStack(challenge.id, 'redeploy')}
                              disabled={isResetting || isStarting}
                              className="w-full"
                            >
                              <RefreshCw size={16} className={`mr-2 ${isResetting ? 'animate-spin' : ''}`} />
                              Redeploy VM
                            </Button>
                          </div>
                        </div>

                        {/* Separator */}
                        <div className="border-t border-neon-cyan/20 terminal-border my-4"></div>

                        {/* Flag Submission Section */}
                        <div className="space-y-2">
                          <span className="text-white/80 text-sm font-semibold">Submit Flag to score points</span>
                          {!showFlagInput[challenge.id] ? (
                            <Button
                              variant="primary"
                              size="md"
                              onClick={() => setShowFlagInput((prev) => ({ ...prev, [challenge.id]: true }))}
                              className="w-full"
                            >
                              <Flag size={16} className="mr-2" />
                              Submit Flag
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              <Input
                                type="text"
                                placeholder="Enter flag"
                                value={flagInputs[challenge.id] || ''}
                                onChange={(e) => setFlagInputs((prev) => ({ ...prev, [challenge.id]: e.target.value }))}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSubmitFlag(challenge.id);
                                  }
                                }}
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  size="md"
                                  onClick={() => handleSubmitFlag(challenge.id)}
                                  disabled={submittingFlagFor === challenge.id || !flagInputs[challenge.id]?.trim()}
                                  isLoading={submittingFlagFor === challenge.id}
                                  className="flex-1"
                                >
                                  <CheckCircle size={16} className="mr-2" />
                                  Submit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="md"
                                  onClick={() => {
                                    setShowFlagInput((prev) => ({ ...prev, [challenge.id]: false }));
                                    setFlagInputs((prev) => ({ ...prev, [challenge.id]: '' }));
                                  }}
                                >
                                  <XCircle size={16} />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Instance Information for Containerized Challenges - When Deployed */}
                    {challenge.challenge_category === 'containerized' && isInstanceDeployed && (
                      <div className="space-y-4">
                        {/* Your Instance Running Badge */}
                        <div className="flex justify-end">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-neon-green/10 border border-neon-green/30 text-neon-green font-semibold text-xs">
                            <div className="w-2 h-2 bg-neon-green rounded-full mr-2 animate-pulse" />
                            Your Instance Running
                          </span>
                        </div>

                        {/* Instance Details */}
                        <div className="space-y-3 bg-neon-green/10 rounded-xl p-4 border border-neon-green/30">
                          {/* Your IP - Check multiple possible field names and locations */}
                          {(() => {
                            const info = challenge.access_info || accessInfo || {};
                            const ip = (info as any).public_ip || (info as any).ip || (info as any).instance_ip;
                            if (!ip) return null;
                            
                            // Get port from config or access_info, default to 80
                            const ports = challenge.config?.ports || (info as any).ports || [];
                            const port = ports.length > 0 ? ports[0] : 80;
                            
                            // Construct access URL if not provided
                            const providedUrl = (info as any).access_url || (info as any).url || (info as any).instance_url;
                            const accessUrl = providedUrl || `http://${ip}:${port}`;
                            
                            return (
                              <>
                                <div className="flex items-center gap-2">
                                  <Globe className="text-neon-green" size={16} />
                                  <span className="text-white/60 text-sm">Your IP:</span>
                                  <span className="text-neon-green font-semibold text-sm">{ip}</span>
                                </div>
                                
                                {/* Access URL - Always show if we have IP */}
                                <div className="flex items-center gap-2">
                                  <ExternalLink className="text-neon-green" size={16} />
                                  <span className="text-white/60 text-sm">Access URL:</span>
                                  <a
                                    href={accessUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-neon-cyan hover:text-neon-cyan/80 hover:underline font-semibold text-sm break-all"
                                  >
                                    {accessUrl}
                                  </a>
                                </div>

                                {/* InfoBox - Always show if we have access URL */}
                                <InfoBox
                                  type="info"
                                  message={`Open this URL in your browser to access your ${challenge.config?.challenge_type || 'Apache'} challenge!`}
                                />
                              </>
                            );
                          })()}

                          {/* Status */}
                          <div className="flex items-center gap-2">
                            <span className="text-white/60 text-sm">Status:</span>
                            <span className="text-neon-green text-sm font-semibold">
                              {String(accessInfo.status || challenge.access_info?.status || instanceStatus || 'running')}
                            </span>
                          </div>

                          {/* Team ID - Show team code if available, otherwise show team ID */}
                          {(teamCode || teamId) && (
                            <div className="flex items-center gap-2">
                              <span className="text-white/60 text-sm">Team ID:</span>
                              <span className="text-neon-green text-sm font-semibold">{teamCode || teamId}</span>
                            </div>
                          )}
                        </div>

                        {/* Separator */}
                        <div className="border-t border-neon-green/20 terminal-border my-4"></div>

                        {/* Reset Challenge Section */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="text-white/40" size={14} />
                            <span className="text-white/60 text-sm">Having issues? Reset your instance</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetChallenge(challenge.id)}
                            disabled={isResetting || isStarting}
                            className="w-full"
                          >
                            <RotateCcw size={16} className={`mr-2 ${isResetting ? 'animate-spin' : ''}`} />
                            {isResetting ? 'Resetting...' : 'Reset Challenge'}
                          </Button>
                        </div>

                        {/* Separator */}
                        <div className="border-t border-neon-green/20 terminal-border my-4"></div>

                        {/* Flag Submission Section */}
                        <div className="space-y-2">
                          <span className="text-white/80 text-sm font-semibold">Submit Flag to score points</span>
                          {!showFlagInput[challenge.id] ? (
                            <Button
                              variant="primary"
                              size="md"
                              onClick={() => setShowFlagInput((prev) => ({ ...prev, [challenge.id]: true }))}
                              className="w-full"
                            >
                              <Flag size={16} className="mr-2" />
                              Submit Flag
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              <Input
                                type="text"
                                placeholder="Enter flag"
                                value={flagInputs[challenge.id] || ''}
                                onChange={(e) => setFlagInputs((prev) => ({ ...prev, [challenge.id]: e.target.value }))}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSubmitFlag(challenge.id);
                                  }
                                }}
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  size="md"
                                  onClick={() => handleSubmitFlag(challenge.id)}
                                  disabled={submittingFlagFor === challenge.id || !flagInputs[challenge.id]?.trim()}
                                  isLoading={submittingFlagFor === challenge.id}
                                  className="flex-1"
                                >
                                  <CheckCircle size={16} className="mr-2" />
                                  Submit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="md"
                                  onClick={() => {
                                    setShowFlagInput((prev) => ({ ...prev, [challenge.id]: false }));
                                    setFlagInputs((prev) => ({ ...prev, [challenge.id]: '' }));
                                  }}
                                >
                                  <XCircle size={16} />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* InfoBox and Start Button for Containerized and OpenStack Challenges - When NOT Deployed */}
                    {(challenge.challenge_category === 'containerized' || challenge.challenge_category === 'openstack') && !isInstanceDeployed && (
                      <>
                        <InfoBox
                          type="info"
                          message={challenge.challenge_category === 'openstack' 
                            ? "Click 'Start' to deploy your team's OpenStack VM instance."
                            : "Click 'Start' to deploy your team's instance only."}
                        />
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={() => handleStartChallenge(challenge.id)}
                          disabled={isStarting || isRefreshing || isResetting}
                          isLoading={isStarting}
                          className="w-full"
                        >
                          <Rocket 
                            size={18} 
                            className="mr-2" 
                          />
                          {isStarting ? 'Starting...' : 'Start Challenge'}
                        </Button>
                        {/* Flag Submission Section for non-running challenges */}
                        <div className="mt-4 p-4 bg-cyber-800/50 rounded-xl border border-neon-green/20 terminal-border">
                          <span className="text-white/80 text-sm font-semibold block mb-2">Submit Flag</span>
                          {!showFlagInput[challenge.id] ? (
                            <Button
                              variant="outline"
                              size="md"
                              onClick={() => setShowFlagInput((prev) => ({ ...prev, [challenge.id]: true }))}
                              className="w-full"
                            >
                              <Flag size={16} className="mr-2" />
                              Submit Flag
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              <Input
                                type="text"
                                placeholder="Enter flag (e.g., CTF{flag_here})"
                                value={flagInputs[challenge.id] || ''}
                                onChange={(e) => setFlagInputs((prev) => ({ ...prev, [challenge.id]: e.target.value }))}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSubmitFlag(challenge.id);
                                  }
                                }}
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  size="md"
                                  onClick={() => handleSubmitFlag(challenge.id)}
                                  disabled={submittingFlagFor === challenge.id || !flagInputs[challenge.id]?.trim()}
                                  isLoading={submittingFlagFor === challenge.id}
                                  className="flex-1"
                                >
                                  <CheckCircle size={16} className="mr-2" />
                                  Submit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="md"
                                  onClick={() => {
                                    setShowFlagInput((prev) => ({ ...prev, [challenge.id]: false }));
                                    setFlagInputs((prev) => ({ ...prev, [challenge.id]: '' }));
                                  }}
                                >
                                  <XCircle size={16} />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

