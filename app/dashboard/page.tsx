'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, LogOut, User, Target, RefreshCw, ChevronDown, ChevronUp, Mail, Users, Crown, FileText, BookOpen, CheckCircle, Settings, Trophy, FileCode, BarChart3, Search, Cloud, Menu, X, Calendar, TrendingUp, Award, Activity, Bell, Send } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { authAPI, userAPI, teamAPI, challengeAPI, eventAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import { Challenges } from '@/components/admin/Challenges';
import { DockerfileToK8s } from '@/components/admin/DockerfileToK8s';
import { OpenStack } from '@/components/admin/OpenStack';
import { Events } from '@/components/admin/Events';
import { UserChallenges } from '@/components/user/UserChallenges';
import { Scoreboard } from '@/components/user/Scoreboard';
import { UserEvents } from '@/components/user/UserEvents';
import { Notifications } from '@/components/user/Notifications';
import ParticleBackground from '@/components/auth/ParticleBackground';

interface UserProfile {
  id?: string;
  username?: string;
  email?: string;
  role?: string;
  zone?: string;
  is_active?: boolean;
  is_verified?: boolean;
  team_id?: string | null;
  team_code?: string | null;
}

interface TeamMember {
  user_id: string;
  username: string;
  email: string;
  role: 'leader' | 'member';
  joined_at: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  team_code: string;
  leader_id: string;
  leader_username: string;
  members: TeamMember[];
  member_count: number;
  max_members: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type ViewMode = 'user' | 'admin';
type AdminTab = 'users' | 'challenges' | 'events' | 'dockerfile' | 'openstack' | 'stats';

interface AllUser {
  id: string;
  username: string;
  email: string;
  role: string;
  zone: string;
  is_active: boolean;
  is_verified?: boolean;
  team_id?: string | null;
  team_code?: string | null;
  team_name?: string | null;
}

export default function Dashboard() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [team, setTeam] = useState<Team | null>(null);
  const [showTeamGate, setShowTeamGate] = useState(false);
  const [joinTeamCode, setJoinTeamCode] = useState('');
  const [isJoiningTeam, setIsJoiningTeam] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(true);
  const [isTeamOpen, setIsTeamOpen] = useState(true);
  const [isTeamMembersOpen, setIsTeamMembersOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const hasCheckedAuth = useRef(false);
  
  // Admin Panel states
  const [viewMode, setViewMode] = useState<ViewMode>('user');
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('users');
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUnverifiedOnly, setShowUnverifiedOnly] = useState(false);
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [createAdminForm, setCreateAdminForm] = useState({
    username: '',
    email: '',
    password: '',
    zone: 'zone1',
    team_name: '',
  });
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [statsEvents, setStatsEvents] = useState<any[]>([]);
  const [selectedStatsEventId, setSelectedStatsEventId] = useState<string>('');
  const [eventLiveStats, setEventLiveStats] = useState<any | null>(null);
  const [isLoadingLiveStats, setIsLoadingLiveStats] = useState(false);
  const statsPollRef = useRef<any>(null);
  const [adminTeamsById, setAdminTeamsById] = useState<Record<string, Team>>({});
  const [challengesRefreshKey, setChallengesRefreshKey] = useState(0);

  // Master broadcast notifications (admin-only)
  const [notifTitle, setNotifTitle] = useState<string>('');
  const [notifTitlePreset, setNotifTitlePreset] = useState<string>('announcement');
  const [notifMessage, setNotifMessage] = useState<string>('');
  const [notifUiType, setNotifUiType] = useState<'toast' | 'alert' | 'background'>('toast');
  const [notifPlaySound, setNotifPlaySound] = useState<boolean>(false);
  const [notifIncludeAdmins, setNotifIncludeAdmins] = useState<boolean>(true);
  const [notifZone, setNotifZone] = useState<string>(''); // empty = all zones
  const [isSendingNotif, setIsSendingNotif] = useState<boolean>(false);
  const [broadcastFeed, setBroadcastFeed] = useState<any[]>([]);
  const [isLoadingBroadcastFeed, setIsLoadingBroadcastFeed] = useState<boolean>(false);
  
  // Check if user is Master role
  const isMaster = userProfile.role?.toLowerCase() === 'master';
  const isZoneAdmin = userProfile.role?.toLowerCase() === 'admin';
  const isAdminRole = isMaster || isZoneAdmin;
  const needsTeam =
    !isAdminRole &&
    !(userProfile.team_id || userProfile.team_code) &&
    !team;
  const needsVerification =
    !isAdminRole &&
    userProfile.is_verified === false;

  // Fetch user profile and team data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasCheckedAuth.current) return;

    const fetchData = async () => {
      try {
        const token = sessionStorage.getItem('auth_token');
        if (!token) {
          window.location.href = '/';
          return;
        }

        setIsDataLoading(true);

        // Fetch current user profile using the auth token (most reliable method)
        try {
          // First, try to get current user from /auth/me endpoint
              try {
            const currentUser = await authAPI.me();
            if (currentUser && currentUser.id) {
                  setUserProfile(currentUser);
                  sessionStorage.setItem('user_info', JSON.stringify(currentUser));
                    sessionStorage.setItem('user_id', currentUser.id);
                  }
          } catch (meError: any) {
            console.log('auth/me failed, trying alternative method:', meError);
            
            // Fallback: Try to get user ID from token and use getCurrentUser
            let userId = sessionStorage.getItem('user_id');
            
            if (!userId) {
              // Try to extract from token
              try {
                const token = sessionStorage.getItem('auth_token');
                if (token) {
                  const decoded = JSON.parse(atob(token.split('.')[1]));
                  userId = decoded.sub || decoded.user_id || decoded.id;
                  if (userId) {
                    sessionStorage.setItem('user_id', userId);
                  }
              }
              } catch (tokenError) {
                console.error('Error extracting user ID from token:', tokenError);
            }
          }

          if (userId) {
            try {
              const userResponse = await userAPI.getCurrentUser(userId);
              setUserProfile(userResponse);
              sessionStorage.setItem('user_info', JSON.stringify(userResponse));
              if (userResponse.id) {
                sessionStorage.setItem('user_id', userResponse.id);
              }
              } catch (userError: any) {
                console.error('Failed to fetch user profile by ID:', userError);
                // Last resort: use stored user info if available
                const storedUser = sessionStorage.getItem('user_info');
                if (storedUser) {
                  try {
                    const parsed = JSON.parse(storedUser);
                    setUserProfile(parsed);
                  } catch (e) {
                    console.error('Error parsing stored user info:', e);
                  }
                }
              }
            } else {
              // Last resort: use stored user info if available
              const storedUser = sessionStorage.getItem('user_info');
              if (storedUser) {
                try {
                  const parsed = JSON.parse(storedUser);
                  setUserProfile(parsed);
                  if (parsed.id) {
                    sessionStorage.setItem('user_id', parsed.id);
                  }
                } catch (e) {
                  console.error('Error parsing stored user info:', e);
                }
              }
            }
          }
        } catch (error: any) {
          console.error('Error in user profile fetch:', error);
          // Last resort: use stored user info if available
          const storedUser = sessionStorage.getItem('user_info');
          if (storedUser) {
            try {
              const parsed = JSON.parse(storedUser);
              setUserProfile(parsed);
            } catch (e) {
              console.error('Error parsing stored user info:', e);
            }
          }
        }

        try {
          const teamResponse = await teamAPI.getMyTeam();
          setTeam(teamResponse);
          if (teamResponse) {
            sessionStorage.setItem('team_info', JSON.stringify(teamResponse));
          }
          
          if (teamResponse) {
            setUserProfile((prev) => {
              const updated: UserProfile = {
                ...prev,
                zone: prev.zone || teamResponse.id,
              };
              
              if (!updated.email && teamResponse.members && Array.isArray(teamResponse.members)) {
                let currentUsername = prev.username;
                if (!currentUsername) {
                  try {
                    const storedUser = sessionStorage.getItem('user_info');
                    if (storedUser) {
                      const parsed = JSON.parse(storedUser);
                      currentUsername = parsed.username;
                    }
                  } catch (e) {
                    console.error('Error parsing stored user for username:', e);
                  }
                }
                
                if (currentUsername) {
                  const currentUserMember = teamResponse.members.find(
                    (member: TeamMember) => member.username === currentUsername
                  );
                  if (currentUserMember && currentUserMember.email) {
                    updated.email = currentUserMember.email;
                    try {
                      const storedUser = sessionStorage.getItem('user_info');
                      if (storedUser) {
                        const parsed = JSON.parse(storedUser);
                        parsed.email = currentUserMember.email;
                        sessionStorage.setItem('user_info', JSON.stringify(parsed));
                      }
                    } catch (e) {
                      console.error('Error updating stored user info with email:', e);
                    }
                  }
                }
              }
              
              return updated;
            });
          }
        } catch (error: any) {
          console.error('Failed to fetch team:', error);
          if (error.response?.status !== 404) {
            console.warn('Unexpected error fetching team:', error);
          }
          setTeam(null);
        }

        setIsDataLoading(false);
        setIsLoading(false);
        hasCheckedAuth.current = true;
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setIsDataLoading(false);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // If a user is blocked (no team or not verified), show gating modal.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setShowTeamGate(needsTeam || needsVerification);
  }, [needsTeam, needsVerification]);

  // Default Zone Admins to Admin Panel view on login
  useEffect(() => {
    if (isZoneAdmin && viewMode === 'user' && userProfile.role) {
      setViewMode('admin');
    }
  }, [isZoneAdmin, userProfile.role]);

  const handleJoinTeamFromGate = async () => {
    const code = joinTeamCode.trim();
    if (!code) {
      showToast('Please enter a team code', 'error');
      return;
    }
    setIsJoiningTeam(true);
    try {
      const joined = await teamAPI.joinTeam(code);
      sessionStorage.setItem('team_info', JSON.stringify(joined));
      setTeam(joined);

      // Refresh profile so team_id/team_code also populate (from /auth/me)
      try {
        const me = await authAPI.me();
        setUserProfile(me);
        sessionStorage.setItem('user_info', JSON.stringify(me));
        if (me?.id) sessionStorage.setItem('user_id', me.id);
      } catch {
        // ignore
      }

      showToast('Joined team successfully', 'success');
      setJoinTeamCode('');
      setShowTeamGate(false);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to join team', 'error');
    } finally {
      setIsJoiningTeam(false);
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    showToast('User logged out successfully', 'info');
    router.push('/');
  };

  const handleRefresh = async () => {
    setIsDataLoading(true);
    try {
      const storedUser = sessionStorage.getItem('user_info');
      const userId = sessionStorage.getItem('user_id');
      
      if (userId) {
        try {
          const userResponse = await userAPI.getCurrentUser(userId);
          setUserProfile(userResponse);
          sessionStorage.setItem('user_info', JSON.stringify(userResponse));
        } catch (error: any) {
          console.error('Failed to refresh user profile:', error);
        }
      }
      
      try {
        const teamResponse = await teamAPI.getMyTeam();
        setTeam(teamResponse);
        if (teamResponse) {
          sessionStorage.setItem('team_info', JSON.stringify(teamResponse));
        }
        showToast('Data refreshed successfully', 'success');
      } catch (error: any) {
        console.error('Failed to refresh team:', error);
        if (error.code === 'ERR_NETWORK' || error.message?.includes('CORS')) {
          showToast('Refresh failed: CORS issue. Please check backend configuration.', 'error');
        } else {
          showToast('Failed to refresh team data', 'error');
        }
      }
    } catch (error: any) {
      console.error('Refresh error:', error);
      showToast('Failed to refresh data', 'error');
    } finally {
      setIsDataLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    if (!isAdminRole) return;
    
    setIsLoadingUsers(true);
    try {
      const users = await userAPI.listUsers();
      setAllUsers(Array.isArray(users) ? users : []);
      showToast('Users refreshed successfully', 'success');
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      if (error.code === 'ERR_NETWORK' || error.message?.includes('CORS')) {
        showToast('Failed to fetch users: CORS issue', 'error');
      } else {
        showToast('Failed to fetch users', 'error');
      }
    } finally {
      setIsLoadingUsers(false);
    }
  };


  const fetchStatsEvents = async () => {
    if (!isAdminRole) return;
    try {
      const res = await eventAPI.listEvents();
      const events = (res as any)?.events || res || [];
      setStatsEvents(Array.isArray(events) ? events : []);
    } catch (error) {
      // Keep stats fetching silent (avoid noisy toasts)
    }
  };

  const fetchEventLiveStats = async (eventId: string) => {
    if (!isAdminRole || !eventId) return;
    try {
      setIsLoadingLiveStats(true);
      const res = await eventAPI.getLiveStats(eventId);
      setEventLiveStats(res);
    } catch (error: any) {
      setEventLiveStats(null);
      // Surface the error so admins know why analytics is empty (403/404/500, etc.)
      showToast(error?.response?.data?.detail || 'Failed to load event analytics', 'error');
    } finally {
      setIsLoadingLiveStats(false);
    }
  };

  // Live polling for Event Analytics while Stats tab is open.
  useEffect(() => {
    const shouldPoll =
      viewMode === 'admin' &&
      activeAdminTab === 'stats' &&
      isAdminRole &&
      !!selectedStatsEventId;

    if (!shouldPoll) {
      if (statsPollRef.current) {
        clearInterval(statsPollRef.current);
        statsPollRef.current = null;
      }
      return;
    }

    // Kick once immediately
    fetchEventLiveStats(selectedStatsEventId);

    // Poll every 10s
    if (!statsPollRef.current) {
      statsPollRef.current = setInterval(() => {
        fetchEventLiveStats(selectedStatsEventId);
      }, 10_000);
    }

    return () => {
      if (statsPollRef.current) {
        clearInterval(statsPollRef.current);
        statsPollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeAdminTab, selectedStatsEventId, isAdminRole]);

  const fetchBroadcastFeed = async () => {
    if (!isMaster) return;
    try {
      setIsLoadingBroadcastFeed(true);
      const res = await eventAPI.getBroadcastNotificationsFeed(notifZone || undefined);
      setBroadcastFeed(res?.broadcasts || []);
    } catch (e: any) {
      // keep silent-ish
      setBroadcastFeed([]);
    } finally {
      setIsLoadingBroadcastFeed(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!isMaster) return;
    const title =
      (notifTitlePreset === 'custom' ? notifTitle : (
        notifTitlePreset === 'maintenance' ? 'Maintenance' :
        notifTitlePreset === 'warning' ? 'Warning' :
        notifTitlePreset === 'info' ? 'Info' :
        'Announcement'
      )).trim();

    if (!title) {
      showToast('Please select/enter a notification title', 'error');
      return;
    }
    if (!notifMessage.trim()) {
      showToast('Please enter notification content', 'error');
      return;
    }

    setIsSendingNotif(true);
    try {
      const res = await eventAPI.broadcastNotification({
        title,
        message: notifMessage.trim(),
        ui_type: notifUiType,
        play_sound: notifPlaySound,
        zone: notifZone || null,
        include_admins: notifIncludeAdmins,
      });
      showToast(`Notification sent to ${res?.targets_count ?? 0} users`, 'success');
      setNotifMessage('');
      // refresh feed
      fetchBroadcastFeed();
    } catch (e: any) {
      showToast(e?.response?.data?.detail || 'Failed to send notification', 'error');
    } finally {
      setIsSendingNotif(false);
    }
  };

  const fetchAdminTeams = async () => {
    if (!isMaster) return;
    try {
      const res = await teamAPI.listTeams(0, 1000, true);
      const teams: Team[] = res?.teams || [];
      const map: Record<string, Team> = {};
      (Array.isArray(teams) ? teams : []).forEach((t) => {
        if (t?.id) map[t.id] = t;
      });
      setAdminTeamsById(map);
    } catch (error: any) {
      console.error('Failed to fetch teams for admin:', error);
    }
  };

  const handleAdminRefresh = async () => {
    if (activeAdminTab === 'users') {
      await fetchAllUsers();
      await fetchAdminTeams();
    } else if (activeAdminTab === 'stats') {
      await fetchStatsEvents();
    } else {
      showToast('Refresh functionality for this tab coming soon', 'info');
    }
  };

  useEffect(() => {
    if (viewMode === 'admin' && activeAdminTab === 'users' && isAdminRole && allUsers.length === 0) {
      fetchAllUsers();
      fetchAdminTeams();
    }
  }, [viewMode, activeAdminTab]);

  useEffect(() => {
    if (viewMode === 'admin' && activeAdminTab === 'stats' && isAdminRole && statsEvents.length === 0) {
      fetchStatsEvents();
    }
  }, [viewMode, activeAdminTab]);

  const handleSetTeamActive = async (teamId: string, nextActive: boolean) => {
    try {
      // eslint-disable-next-line no-restricted-globals
      if (!confirm(`Are you sure you want to ${nextActive ? 'UNBAN (activate)' : 'BAN (disable)'} this team?`)) return;
      await teamAPI.setTeamActive(teamId, nextActive);
      showToast(`Team ${nextActive ? 'unbanned' : 'banned'} successfully`, 'success');
      await fetchAdminTeams();
      await fetchAllUsers();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to update team status', 'error');
    }
  };

  const handleToggleUserVerification = async (userId: string, nextVerified: boolean) => {
    try {
      // eslint-disable-next-line no-restricted-globals
      if (!confirm(`Are you sure you want to mark this user as ${nextVerified ? 'VERIFIED' : 'NOT VERIFIED'}?`)) return;
      await userAPI.setUserVerified(userId, nextVerified);
      showToast(`User ${nextVerified ? 'verified' : 'unverified'} successfully`, 'success');
      await fetchAllUsers();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to update verification status', 'error');
    }
  };

  const handleDeleteUser = async (userId: string, username?: string) => {
    try {
      // eslint-disable-next-line no-restricted-globals
      if (!confirm(`Delete user ${username || userId}? This cannot be undone.`)) return;
      await userAPI.deleteUser(userId);
      showToast(`Deleted user ${username || ''}`.trim(), 'success');
      await fetchAllUsers();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to delete user', 'error');
    }
  };

  const handleDeleteTeam = async (teamId: string, teamLabel?: string) => {
    try {
      // eslint-disable-next-line no-restricted-globals
      if (!confirm(`Delete team ${teamLabel || teamId}? All members will be removed from the team.`)) return;
      await teamAPI.deleteTeam(teamId);
      showToast(`Deleted team ${teamLabel || ''}`.trim(), 'success');
      await fetchAdminTeams();
      await fetchAllUsers();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to delete team', 'error');
    }
  };

  const handlePromoteToZoneAdmin = async (userId: string, username?: string, currentZone?: string) => {
    try {
      if (!isMaster) return;
      const defaultZone = (currentZone || '').trim() || 'zone1';
      const zone = window.prompt(
        `Enter zone for new Admin (e.g. zone1/zone2/zone3/zone4/zone5/main)\nUser: ${username || userId}`,
        defaultZone
      );
      if (!zone) return;
      const trimmed = zone.trim();
      if (!trimmed) return;
      // eslint-disable-next-line no-restricted-globals
      if (!confirm(`Promote ${username || userId} to Admin for zone "${trimmed}"?`)) return;
      await userAPI.updateUser(userId, { role: 'Admin', zone: trimmed });
      showToast(`User promoted to Admin (${trimmed})`, 'success');
      await fetchAllUsers();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to promote user', 'error');
    }
  };

  const handleCreateAdminUser = async () => {
    try {
      if (!isMaster) return;
      const username = createAdminForm.username.trim();
      const email = createAdminForm.email.trim();
      const password = createAdminForm.password;
      const zone = createAdminForm.zone.trim();
      const team_name = createAdminForm.team_name.trim();
      if (!username || !email || !password || !zone) {
        showToast('Please fill in username, email, password and zone', 'error');
        return;
      }
      setIsCreatingAdmin(true);
      await userAPI.createAdminUser({ username, email, password, zone, team_name: team_name || undefined });
      showToast(`Admin user "${username}" created`, 'success');
      setShowCreateAdminModal(false);
      setCreateAdminForm({ username: '', email: '', password: '', zone: 'zone1', team_name: '' });
      await fetchAllUsers();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to create admin user', 'error');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleMoveUserToTeam = async (userId: string, username?: string) => {
    try {
      const teamCode = window.prompt(`Move ${username || userId} to which Team Code? (e.g., ABC123)`);
      if (!teamCode) return;
      await teamAPI.moveUserToTeam(userId, teamCode.trim());
      showToast(`Moved ${username || 'user'} to team ${teamCode.trim().toUpperCase()}`, 'success');
      await fetchAdminTeams();
      await fetchAllUsers();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to move user to team', 'error');
    }
  };

  const filteredUsers = allUsers.filter((user) => {
    const searchLower = userSearchTerm.toLowerCase();
    if (showUnverifiedOnly && user.is_verified !== false) return false;
    return (
      user.username.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower) ||
      user.zone.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-cyber-darker flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 security-pattern opacity-20" />
        <div className="bg-cyber-900/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-neon-green/20 terminal-border relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-neon-green/20 backdrop-blur-sm rounded-xl flex items-center justify-center border-2 border-neon-green/50 glow-accent">
              <Shield className="text-neon-green" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white gradient-text">Loading...</h2>
              <p className="text-white/60 text-sm">Verifying credentials...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-cyber-darker relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 security-pattern opacity-20" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-neon-green/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-neon-cyan/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      <ParticleBackground />

      {/* Team gate for individually registered users */}
      {showTeamGate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-xl bg-cyber-900/95 border border-neon-green/30 rounded-2xl shadow-2xl terminal-border p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-neon-orange/15 rounded-xl flex items-center justify-center border border-neon-orange/40">
                <Users className="text-neon-orange" size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white">
                  {needsTeam ? 'Join a team to continue' : 'Account not verified'}
                </h3>
                <p className="text-white/60 mt-1 text-sm">
                  {needsTeam
                    ? 'Your account is registered individually. You won’t be able to view events or challenges until you join a team.'
                    : 'Your account is not verified yet. Please contact your Zone Admin or Master Admin for verification.'}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3">
              {needsTeam && (
                <div>
                  <label className="text-sm font-semibold text-white/70">Team Code</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={joinTeamCode}
                      onChange={(e) => setJoinTeamCode(e.target.value)}
                      placeholder="Enter team code (e.g., ABC123)"
                      className="flex-1 px-4 py-3 bg-cyber-800/60 border-2 border-neon-green/20 rounded-xl focus:outline-none focus:border-neon-green focus:ring-4 focus:ring-neon-green/20 text-white placeholder:text-white/30"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleJoinTeamFromGate();
                      }}
                    />
                    <Button
                      onClick={handleJoinTeamFromGate}
                      disabled={isJoiningTeam}
                      className="px-6"
                    >
                      {isJoiningTeam ? 'Joining...' : 'Join'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-2 text-xs text-white/50">
                {needsTeam
                  ? 'If you don’t have a team code, contact your Zone Admin or Master to be added to a team.'
                  : 'Only Master Admin and Zone Admin can change verification status.'}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="border-2 border-neon-orange/40 hover:bg-neon-orange/10 text-neon-orange"
                >
                  Logout
                </Button>
                <div className="text-xs text-white/40">
                  {needsTeam
                    ? 'You must join a team to access events and challenges.'
                    : 'Verification is required to join events and access challenges.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="bg-cyber-900/90 backdrop-blur-xl border-b border-neon-green/20 shadow-lg sticky top-0 z-50 relative">
        <div className="flex items-center justify-between px-4 lg:px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-cyber-800 rounded-lg transition-colors text-white/80 hover:text-white"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-neon-green to-neon-cyan rounded-xl flex items-center justify-center shadow-lg shadow-neon-green/30">
                <Shield className="text-cyber-darker" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white neon-text">PACSTAR</h1>
                <p className="text-xs text-white/60">Challenge Management</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Notifications - Only show for non-Master users */}
            {!isMaster && (
              <Notifications 
                onJoinEvent={(eventId) => {
                  // Refresh challenges when user joins an event
                  setChallengesRefreshKey(prev => prev + 1);
                }}
              />
            )}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-neon-green/10 rounded-lg border border-neon-green/30 backdrop-blur-sm">
              <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
              <span className="text-sm font-medium text-neon-green">Online</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2 border-neon-orange/30 hover:bg-neon-orange/10 text-white hover:text-neon-orange"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex relative z-10">
        {/* Sidebar */}
        <div className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          fixed lg:static inset-y-0 left-0 z-40
          w-80 bg-cyber-900/90 backdrop-blur-xl border-r border-neon-green/20 shadow-lg lg:shadow-none
          transition-transform duration-300 ease-in-out
          pt-20 lg:pt-0
        `}>
          <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* User Info Card */}
            <div className="bg-gradient-to-br from-cyber-800 via-cyber-900 to-cyber-darker rounded-2xl p-6 text-white shadow-lg border border-neon-green/20 terminal-border relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-full h-full circuit-lines" />
              </div>
              <div className="relative z-10">
              <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-neon-green/20 backdrop-blur-sm rounded-xl flex items-center justify-center border-2 border-neon-green/50 glow-accent">
                    <User className="text-neon-green" size={28} />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-lg text-white">{userProfile.username || 'User'}</h3>
                    <p className="text-white/60 text-sm">{userProfile.role || 'User'}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                    <Mail size={16} className="text-neon-cyan/70" />
                    <span className="text-white/80">{userProfile.email || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Target size={16} className="text-neon-purple/70" />
                    <span className="text-white/80">
                    {team ? `Team: ${team.team_code}` : (userProfile.zone || 'N/A')}
                  </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation for Master and Zone Admin Users */}
            {isAdminRole && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white/90 mb-2">View Mode</label>
                  <div className="flex gap-2 p-1 bg-cyber-800/50 rounded-xl border border-neon-green/20">
                    <button
                      onClick={() => setViewMode('user')}
                      className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all relative overflow-hidden ${
                        viewMode === 'user'
                          ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-lg shadow-neon-green/20'
                          : 'text-white/60 hover:text-white hover:bg-cyber-700/50'
                      }`}
                    >
                      {viewMode === 'user' && (
                        <div className="absolute inset-0 bg-neon-green/10 animate-pulse" />
                      )}
                      <span className="relative z-10">User</span>
                    </button>
                    <button
                      onClick={() => setViewMode('admin')}
                      className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all relative overflow-hidden ${
                        viewMode === 'admin'
                          ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-lg shadow-neon-green/20'
                          : 'text-white/60 hover:text-white hover:bg-cyber-700/50'
                      }`}
                    >
                      {viewMode === 'admin' && (
                        <div className="absolute inset-0 bg-neon-green/10 animate-pulse" />
                      )}
                      <span className="relative z-10">Admin</span>
                    </button>
                  </div>
                </div>

                {/* Events Menu */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white/90 mb-2">Events</label>
                  <button
                    onClick={() => {
                      setViewMode('user');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-cyber-800/50 hover:bg-cyber-700/50 rounded-xl border border-neon-purple/20 hover:border-neon-purple/40 transition-all group"
                  >
                    <div className="w-10 h-10 bg-neon-purple/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-neon-purple/40 group-hover:border-neon-purple/60 transition-colors">
                      <Calendar className="text-neon-purple" size={20} />
                    </div>
                    <span className="text-white font-semibold group-hover:text-neon-purple transition-colors">Events</span>
                  </button>
                </div>
              </div>
            )}

            {/* Events Menu for Non-Master Users */}
            {!isMaster && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white/90 mb-2">Events</label>
                <button
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-cyber-800/50 hover:bg-cyber-700/50 rounded-xl border border-neon-purple/20 hover:border-neon-purple/40 transition-all group"
                >
                  <div className="w-10 h-10 bg-neon-purple/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-neon-purple/40 group-hover:border-neon-purple/60 transition-colors">
                    <Calendar className="text-neon-purple" size={20} />
                  </div>
                  <span className="text-white font-semibold group-hover:text-neon-purple transition-colors">Events</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-screen relative">
          <div className="p-4 lg:p-8">
            {/* User View */}
            {viewMode === 'user' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white gradient-text">Dashboard</h2>
                    <p className="text-white/60 mt-1">Welcome back, {userProfile.username}!</p>
                  </div>
                </div>

                {/* Profile Section */}
                <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border overflow-hidden">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="w-full flex items-center justify-between p-6 hover:bg-cyber-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-neon-green/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-neon-green/40">
                        <FileText className="text-neon-green" size={24} />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-white">My Profile</h3>
                        <p className="text-sm text-white/60">View your account information</p>
                      </div>
                    </div>
                    {isProfileOpen ? <ChevronUp className="text-neon-green" size={20} /> : <ChevronDown className="text-white/60" size={20} />}
                  </button>
                  {isProfileOpen && (
                    <div className="px-6 pb-6 border-t border-neon-green/20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-semibold text-white/60">Username</label>
                            <p className="text-white font-medium mt-1">{userProfile.username || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-white/60">Email</label>
                            {userProfile.email ? (
                              <a href={`mailto:${userProfile.email}`} className="text-neon-cyan hover:text-neon-cyan/80 font-medium mt-1 block">
                                {userProfile.email}
                              </a>
                            ) : (
                              <p className="text-white/40 mt-1">N/A</p>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-white/60">Role</label>
                            <p className="text-white font-medium mt-1">{userProfile.role || 'User'}</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-semibold text-white/60">Zone</label>
                            <p className="text-white font-medium mt-1">
                              {team ? `Team: ${team.team_code}` : (userProfile.zone || 'N/A')}
                            </p>
                          </div>
                          {team && (
                            <>
                              <div>
                                <label className="text-sm font-semibold text-white/60">Team Code</label>
                                <p className="text-neon-green font-bold mt-1">{team.team_code}</p>
                              </div>
                              <div>
                                <label className="text-sm font-semibold text-white/60">Status</label>
                                <div className="flex items-center gap-2 mt-1">
                                  <CheckCircle className="text-neon-green" size={18} />
                                  <span className="text-neon-green font-medium">Active</span>
                                </div>
                              </div>
                            </>
                          )}
                          <div>
                            <label className="text-sm font-semibold text-white/60">Verification</label>
                            <div className="mt-1">
                              {userProfile.is_verified === false ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-neon-orange/10 text-neon-orange border border-neon-orange/30">
                                  Not Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-neon-green/10 text-neon-green border border-neon-green/30">
                                  Verified
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Team Section */}
                {team && (
                  <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-cyan/20 terminal-border overflow-hidden">
                    <button
                      onClick={() => setIsTeamOpen(!isTeamOpen)}
                      className="w-full flex items-center justify-between p-6 hover:bg-cyber-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-neon-cyan/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-neon-cyan/40">
                          <Users className="text-neon-cyan" size={24} />
                        </div>
                        <div className="text-left">
                          <h3 className="text-lg font-bold text-white">My Team</h3>
                          <p className="text-sm text-white/60">{team.name}</p>
                        </div>
                      </div>
                      {isTeamOpen ? <ChevronUp className="text-neon-cyan" size={20} /> : <ChevronDown className="text-white/60" size={20} />}
                    </button>
                    {isTeamOpen && (
                      <div className="px-6 pb-6 border-t border-neon-cyan/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-semibold text-white/60">Team Name</label>
                              <p className="text-white font-medium mt-1">{team.name}</p>
                            </div>
                            <div>
                              <label className="text-sm font-semibold text-white/60">Team Code</label>
                              <p className="text-neon-cyan font-bold mt-1">{team.team_code}</p>
                            </div>
                            <div>
                              <label className="text-sm font-semibold text-white/60">Members</label>
                              <p className="text-white font-medium mt-1">
                                {team.member_count}/{team.max_members}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-semibold text-white/60">Leader</label>
                              <p className="text-white font-medium mt-1">{team.leader_username}</p>
                            </div>
                            <div>
                              <button
                                onClick={() => setIsTeamMembersOpen(!isTeamMembersOpen)}
                                className="text-neon-cyan hover:text-neon-cyan/80 font-semibold text-sm flex items-center gap-2"
                              >
                                View Team Members
                                {isTeamMembersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                              {isTeamMembersOpen && team.members && team.members.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {team.members.map((member) => (
                                    <div key={member.user_id} className="flex items-center gap-2 p-2 bg-cyber-800/50 rounded-lg border border-neon-cyan/10 hover:border-neon-cyan/30 transition-colors">
                                      {member.role === 'leader' ? (
                                        <Crown className="text-neon-purple" size={16} />
                                      ) : (
                                        <User className="text-white/60" size={16} />
                                      )}
                                      <span className="text-sm text-white">{member.username}</span>
                                      <a href={`mailto:${member.email}`} className="text-neon-cyan hover:text-neon-cyan/80 text-xs ml-auto">
                                        {member.email}
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Events + Challenges are gated for individually registered users OR unverified users */}
                {!(needsTeam || needsVerification) ? (
                  <>
                {/* Events Section */}
                <div className="mt-6">
                  <UserEvents 
                    onJoinEvent={() => setChallengesRefreshKey(prev => prev + 1)} 
                    isAdmin={isAdminRole}
                  />
                </div>

                {/* Challenges Section */}
                {isZoneAdmin ? (
                  <div className="mt-6 bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-purple/20 terminal-border p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-neon-purple/10 rounded-xl flex items-center justify-center border border-neon-purple/30">
                        <Trophy className="text-neon-purple" size={18} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Challenges are event-only for Zone Admin</h3>
                        <p className="text-white/60 text-sm mt-1">
                          Create an event (Admin Panel → Events), add challenges, submit for approval, and wait for Master approval.
                          After approval, register/join the event in Events to access its challenges.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                <UserChallenges teamId={team?.id} refreshKey={challengesRefreshKey} />
                )}
                  </>
                ) : (
                  <div className="mt-6 bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-orange/20 terminal-border p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-neon-orange/10 rounded-xl flex items-center justify-center border border-neon-orange/30">
                        <Users className="text-neon-orange" size={18} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {needsTeam ? 'Team required' : 'Verification required'}
                        </h3>
                        <p className="text-white/60 text-sm mt-1">
                          {needsTeam
                            ? 'Join a team using a team code to access Events and Challenges.'
                            : 'Your account must be verified by Master/Zone Admin to join events and access challenges.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scoreboard Section */}
                {!isZoneAdmin ? (
                <div className="mt-6">
                  <Scoreboard />
                </div>
                ) : null}
              </div>
            )}

            {/* Admin Panel View */}
            {viewMode === 'admin' && isAdminRole && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-white gradient-text">Admin Panel</h2>
                  <p className="text-white/60 mt-1">Manage users, challenges, and system settings</p>
                </div>

                {/* Admin Tabs */}
                <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 p-2 terminal-border">
                  <div className="flex flex-wrap gap-2">
                    {(isMaster
                      ? [
                          { id: 'users', label: 'Users', icon: User },
                          { id: 'challenges', label: 'Challenges', icon: Trophy },
                          { id: 'events', label: 'Events', icon: Calendar },
                          { id: 'dockerfile', label: 'Dockerfile', icon: FileCode },
                          { id: 'openstack', label: 'OpenStack', icon: Cloud },
                          { id: 'stats', label: 'Stats', icon: BarChart3 },
                        ]
                      : [
                          { id: 'users', label: 'Users', icon: User },
                          { id: 'events', label: 'Events', icon: Calendar },
                          { id: 'stats', label: 'Stats', icon: BarChart3 },
                        ]
                    ).map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveAdminTab(tab.id as AdminTab)}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all relative overflow-hidden ${
                            activeAdminTab === tab.id
                              ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-lg shadow-neon-green/20'
                              : 'text-white/60 hover:text-white hover:bg-cyber-800/50'
                          }`}
                        >
                          {activeAdminTab === tab.id && (
                            <div className="absolute inset-0 bg-neon-green/10 animate-pulse" />
                          )}
                          <Icon size={18} className="relative z-10" />
                          <span className="relative z-10">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Users Tab Content */}
                {activeAdminTab === 'users' && (
                  <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-white mb-4 gradient-text">User Management</h3>
                      
                      <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="flex-1 relative group">
                          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-green/60 group-focus-within:text-neon-green transition-colors" size={18} />
                          <input
                            type="text"
                            placeholder="Search users..."
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl focus:outline-none focus:border-neon-green focus:ring-4 focus:ring-neon-green/20 text-white placeholder:text-white/30"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => setShowUnverifiedOnly((v) => !v)}
                          className={`border-2 ${
                            showUnverifiedOnly
                              ? 'border-neon-orange/50 text-neon-orange hover:bg-neon-orange/10'
                              : 'border-neon-cyan/30 text-white hover:bg-neon-cyan/10'
                          }`}
                        >
                          {showUnverifiedOnly ? 'Showing Unverified' : 'Show Unverified'}
                        </Button>
                        {isMaster ? (
                          <Button
                            variant="outline"
                            size="md"
                            onClick={() => setShowCreateAdminModal(true)}
                            className="border-2 border-neon-purple/40 hover:bg-neon-purple/10 text-neon-purple"
                          >
                            Create Admin
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="md"
                          onClick={handleAdminRefresh}
                          disabled={isLoadingUsers}
                          className="border-neon-green/30 hover:bg-neon-green/10 text-white"
                        >
                          <RefreshCw size={16} className={`mr-2 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>

                      <div className="mb-4">
                        <span className="text-white/80 font-medium">
                          Total Users: <span className="text-neon-green font-bold">{filteredUsers.length}</span>
                        </span>
                      </div>

                      <div className="overflow-x-auto border border-neon-green/20 rounded-xl">
                        <table className="w-full">
                          <thead className="bg-cyber-800/50 border-b border-neon-green/20">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Username</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Email</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Role</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Verified</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Leader</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Zone</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Team</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Team Status</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Actions</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Active</th>
                            </tr>
                          </thead>
                          <tbody>
                            {isLoadingUsers ? (
                              <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-white/60">
                                  Loading users...
                                </td>
                              </tr>
                            ) : filteredUsers.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-white/60">
                                  {userSearchTerm ? 'No users found matching your search.' : 'No users available.'}
                                </td>
                              </tr>
                            ) : (
                              filteredUsers.map((user) => (
                                <tr
                                  key={user.id}
                                  className="border-b border-neon-green/10 hover:bg-cyber-800/30 transition-colors"
                                >
                                  <td className="px-4 py-3 text-white font-medium">{user.username}</td>
                                  <td className="px-4 py-3">
                                    <a
                                      href={`mailto:${user.email}`}
                                      className="text-neon-cyan hover:text-neon-cyan/80 hover:underline"
                                    >
                                      {user.email}
                                    </a>
                                  </td>
                                  <td className="px-4 py-3 text-white/80">{user.role}</td>
                                  <td className="px-4 py-3">
                                    {user.is_verified === false ? (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-neon-orange/10 text-neon-orange border border-neon-orange/30">
                                        No
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-neon-green/10 text-neon-green border border-neon-green/30">
                                        Yes
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {user.team_id && adminTeamsById[user.team_id] ? (
                                      adminTeamsById[user.team_id].leader_id === user.id ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-neon-purple/10 text-neon-purple border border-neon-purple/30">
                                          Leader
                                        </span>
                                      ) : (
                                        <span className="text-white/40">—</span>
                                      )
                                    ) : (
                                      <span className="text-white/40">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-white/80">{user.zone || 'N/A'}</td>
                                  <td className="px-4 py-3 text-white/80">
                                    {user.team_name || (user.team_id && adminTeamsById[user.team_id]?.name) ? (
                                      <div>
                                        <div className="font-medium text-white">
                                          {user.team_name || (user.team_id ? adminTeamsById[user.team_id]?.name : '')}
                                        </div>
                                        <div className="text-xs text-white/50">
                                          {user.team_code || (user.team_id ? adminTeamsById[user.team_id]?.team_code : '') || '—'}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-white/40">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-white/80">
                                    {user.team_id && adminTeamsById[user.team_id] ? (
                                      adminTeamsById[user.team_id].is_active ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-neon-green/10 text-neon-green border border-neon-green/30">
                                          Active
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-neon-orange/10 text-neon-orange border border-neon-orange/30">
                                          Banned
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-white/40">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-2">
                                      {(isMaster || isZoneAdmin) && user.role === 'User' ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleToggleUserVerification(user.id, user.is_verified === false)}
                                          className={`border-2 ${
                                            user.is_verified === false
                                              ? 'border-neon-green/40 hover:bg-neon-green/10 text-neon-green'
                                              : 'border-neon-orange/40 hover:bg-neon-orange/10 text-neon-orange'
                                          }`}
                                        >
                                          {user.is_verified === false ? 'Verify User' : 'Unverify User'}
                                        </Button>
                                      ) : null}

                                      {isMaster && user.role !== 'Master' && user.id !== userProfile.id ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleDeleteUser(user.id, user.username)}
                                          className="border-2 border-red-500/40 hover:bg-red-500/10 text-red-300"
                                        >
                                          Delete User
                                        </Button>
                                      ) : null}

                                      {isMaster && user.role === 'User' ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleMoveUserToTeam(user.id, user.username)}
                                          className="border-2 border-neon-cyan/40 hover:bg-neon-cyan/10 text-neon-cyan"
                                        >
                                          Move to Team
                                        </Button>
                                      ) : null}

                                      {isMaster && user.role === 'User' ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handlePromoteToZoneAdmin(user.id, user.username, user.zone)}
                                          className="border-2 border-neon-purple/40 hover:bg-neon-purple/10 text-neon-purple"
                                        >
                                          Make Zone Admin
                                        </Button>
                                      ) : null}

                                      {isMaster && user.team_id && adminTeamsById[user.team_id] ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleDeleteTeam(
                                              user.team_id as string,
                                              adminTeamsById[user.team_id as string]?.team_code ||
                                                adminTeamsById[user.team_id as string]?.name ||
                                                (user.team_id as string)
                                            )
                                          }
                                          className="border-2 border-red-500/40 hover:bg-red-500/10 text-red-300"
                                        >
                                          Delete Team
                                        </Button>
                                      ) : null}

                                      {isMaster && user.team_id && adminTeamsById[user.team_id] ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleSetTeamActive(
                                              user.team_id as string,
                                              !adminTeamsById[user.team_id as string].is_active
                                            )
                                          }
                                          className={`border-2 ${
                                            adminTeamsById[user.team_id as string].is_active
                                              ? 'border-neon-orange/40 hover:bg-neon-orange/10 text-neon-orange'
                                              : 'border-neon-green/40 hover:bg-neon-green/10 text-neon-green'
                                          }`}
                                        >
                                          {adminTeamsById[user.team_id as string].is_active ? 'Ban Team' : 'Unban Team'}
                                        </Button>
                                      ) : null}

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                          const newPw = window.prompt(`Set a new password for ${user.username} (min 8 chars):`);
                                          if (!newPw) return;
                                          if (newPw.length < 8) {
                                            showToast('Password must be at least 8 characters', 'error');
                                            return;
                                          }
                                          try {
                                            await userAPI.resetPassword(user.id, newPw);
                                            showToast(`Password reset for ${user.username}`, 'success');
                                          } catch (err: any) {
                                            showToast(err?.response?.data?.detail || 'Failed to reset password', 'error');
                                          }
                                        }}
                                        className="border-2 border-neon-purple/40 hover:bg-neon-purple/10 text-neon-purple"
                                      >
                                        Reset Password
                                      </Button>

                                      {!isMaster && !isZoneAdmin && (
                                        <span className="text-white/40">—</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {user.is_active ? (
                                      <CheckCircle className="text-neon-green" size={20} />
                                    ) : (
                                      <span className="text-white/40">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {showCreateAdminModal && isMaster ? (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                        <div className="w-full max-w-lg bg-cyber-900/95 border border-neon-green/20 rounded-2xl shadow-2xl p-6">
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                              <div className="text-xl font-bold text-white">Create Zone Admin</div>
                              <div className="text-sm text-white/60">Creates an Admin account for a specific zone</div>
                            </div>
                            <button
                              onClick={() => !isCreatingAdmin && setShowCreateAdminModal(false)}
                              className="text-white/70 hover:text-white"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-semibold text-white/90 mb-2">Username</label>
                              <Input
                                value={createAdminForm.username}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setCreateAdminForm((p) => ({ ...p, username: e.target.value }))
                                }
                                placeholder="zoneadmin1"
                                className="bg-cyber-800/50 border-neon-green/20 text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-white/90 mb-2">Email</label>
                              <Input
                                value={createAdminForm.email}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setCreateAdminForm((p) => ({ ...p, email: e.target.value }))
                                }
                                placeholder="admin@zone.com"
                                className="bg-cyber-800/50 border-neon-green/20 text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-white/90 mb-2">Password</label>
                              <Input
                                type="password"
                                value={createAdminForm.password}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setCreateAdminForm((p) => ({ ...p, password: e.target.value }))
                                }
                                placeholder="Strong password (min 8 chars)"
                                className="bg-cyber-800/50 border-neon-green/20 text-white"
                              />
                              <div className="text-xs text-white/50 mt-1">Must include uppercase, lowercase, number, and special (@$!%*?&#).</div>
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-white/90 mb-2">Zone</label>
                              <select
                                value={createAdminForm.zone}
                                onChange={(e) => setCreateAdminForm((p) => ({ ...p, zone: e.target.value }))}
                                className="w-full px-4 py-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white focus:outline-none focus:border-neon-green"
                              >
                                <option value="zone1">zone1</option>
                                <option value="zone2">zone2</option>
                                <option value="zone3">zone3</option>
                                <option value="zone4">zone4</option>
                                <option value="zone5">zone5</option>
                                <option value="main">main</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-white/90 mb-2">Team Name (optional)</label>
                              <Input
                                value={createAdminForm.team_name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setCreateAdminForm((p) => ({ ...p, team_name: e.target.value }))
                                }
                                placeholder="Zone Admin Team"
                                className="bg-cyber-800/50 border-neon-green/20 text-white"
                              />
                              <div className="text-xs text-white/50 mt-1">
                                If provided, a team will be created and this Admin will be the leader; other users can join via team code.
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="outline"
                                className="border-white/20 text-white hover:bg-white/10"
                                onClick={() => setShowCreateAdminModal(false)}
                                disabled={isCreatingAdmin}
                              >
                                Cancel
                              </Button>
                              <Button
                                className="bg-neon-purple/20 border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/30"
                                onClick={handleCreateAdminUser}
                                disabled={isCreatingAdmin}
                              >
                                {isCreatingAdmin ? 'Creating…' : 'Create Admin'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Challenges Tab Content */}
                {activeAdminTab === 'challenges' && (
                  <Challenges />
                )}

                {/* Events Tab Content */}
                {activeAdminTab === 'events' && (
                  <Events />
                )}

                {/* Dockerfile to K8s Tab Content */}
                {activeAdminTab === 'dockerfile' && (
                  <DockerfileToK8s />
                )}

                {/* OpenStack Tab Content */}
                {activeAdminTab === 'openstack' && (
                  <OpenStack />
                )}

                {/* Stats Tab Content */}
                {activeAdminTab === 'stats' && (
                  <div className="space-y-6">
                    {/* Master Notification Center */}
                    {isMaster && (
                    <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6">
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-neon-green/20 rounded-xl flex items-center justify-center border border-neon-green/40">
                              <Bell className="text-neon-green" size={20} />
                            </div>
                        <div>
                              <h3 className="text-xl font-bold text-white gradient-text">Send a Notification</h3>
                              <p className="text-white/60 text-sm">Broadcast to all users/teams (optionally filter by zone)</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                              onClick={fetchBroadcastFeed}
                              disabled={isLoadingBroadcastFeed}
                            className="border-neon-green/30 hover:bg-neon-green/10 text-white"
                          >
                              <RefreshCw size={14} className={`mr-2 ${isLoadingBroadcastFeed ? 'animate-spin' : ''}`} />
                              Refresh Feed
                          </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Form */}
                          <div className="bg-cyber-800/30 border border-neon-green/20 rounded-2xl p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-semibold text-white/90 mb-2">Title</label>
                                <select
                                  value={notifTitlePreset}
                                  onChange={(e) => setNotifTitlePreset(e.target.value)}
                                  className="w-full px-4 py-3 bg-cyber-900/50 border-2 border-neon-green/20 rounded-xl text-white focus:outline-none focus:border-neon-green"
                                >
                                  <option value="announcement">Announcement</option>
                                  <option value="info">Info</option>
                                  <option value="warning">Warning</option>
                                  <option value="maintenance">Maintenance</option>
                                  <option value="custom">Custom…</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-white/90 mb-2">Zone (optional)</label>
                                <select
                                  value={notifZone}
                                  onChange={(e) => setNotifZone(e.target.value)}
                                  className="w-full px-4 py-3 bg-cyber-900/50 border-2 border-neon-green/20 rounded-xl text-white focus:outline-none focus:border-neon-green"
                                >
                                  <option value="">All zones</option>
                                  <option value="zone1">Zone 1</option>
                                  <option value="zone2">Zone 2</option>
                                  <option value="zone3">Zone 3</option>
                                  <option value="zone4">Zone 4</option>
                                  <option value="zone5">Zone 5</option>
                                  <option value="main">Main</option>
                                </select>
                              </div>
                            </div>

                            {notifTitlePreset === 'custom' && (
                              <div>
                                <label className="block text-sm font-semibold text-white/90 mb-2">Custom Title</label>
                                <input
                                  value={notifTitle}
                                  onChange={(e) => setNotifTitle(e.target.value)}
                                  placeholder="Enter title"
                                  className="w-full px-4 py-3 bg-cyber-900/50 border-2 border-neon-green/20 rounded-xl text-white focus:outline-none focus:border-neon-green"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-sm font-semibold text-white/90 mb-2">Content</label>
                              <textarea
                                value={notifMessage}
                                onChange={(e) => setNotifMessage(e.target.value)}
                                placeholder="Write your notification message…"
                                rows={5}
                                className="w-full px-4 py-3 bg-cyber-900/50 border-2 border-neon-green/20 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-neon-green resize-y"
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-semibold text-white/90 mb-2">Notification Type</label>
                                <select
                                  value={notifUiType}
                                  onChange={(e) => setNotifUiType(e.target.value as any)}
                                  className="w-full px-4 py-3 bg-cyber-900/50 border-2 border-neon-green/20 rounded-xl text-white focus:outline-none focus:border-neon-green"
                                >
                                  <option value="toast">Toast</option>
                                  <option value="alert">Alert</option>
                                  <option value="background">Background</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-4 pt-7">
                                <label className="flex items-center gap-2 text-sm text-white/80">
                                  <input
                                    type="checkbox"
                                    checked={notifPlaySound}
                                    onChange={(e) => setNotifPlaySound(e.target.checked)}
                                    className="accent-neon-green"
                                  />
                                  Play Sound
                                </label>
                                <label className="flex items-center gap-2 text-sm text-white/80">
                                  <input
                                    type="checkbox"
                                    checked={notifIncludeAdmins}
                                    onChange={(e) => setNotifIncludeAdmins(e.target.checked)}
                                    className="accent-neon-green"
                                  />
                                  Include Admins
                                </label>
                              </div>
                            </div>

                          <Button
                              onClick={handleSendBroadcast}
                              disabled={isSendingNotif}
                              className="w-full bg-gradient-to-r from-neon-green/20 to-neon-cyan/20 border-2 border-neon-green/60 hover:border-neon-green/80 text-white"
                            variant="outline"
                          >
                              <Send size={16} className={`mr-2 ${isSendingNotif ? 'animate-pulse' : ''}`} />
                              {isSendingNotif ? 'Sending…' : 'Send Notification'}
                          </Button>
                      </div>

                          {/* Feed */}
                      <div className="bg-cyber-800/30 border border-neon-green/20 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-lg font-bold text-white">Notification Feed</h4>
                              <div className="text-xs text-white/50">Latest 50</div>
                        </div>
                            {isLoadingBroadcastFeed ? (
                              <div className="text-white/60 text-sm py-4">Loading…</div>
                            ) : (broadcastFeed.length === 0 ? (
                              <div className="text-white/60 text-sm py-4">No broadcasts yet.</div>
                            ) : (
                              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                                {broadcastFeed.map((b: any) => (
                                  <div key={b.id} className="p-3 bg-cyber-900/40 border border-neon-green/10 rounded-xl">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-white font-semibold truncate">{b.title}</div>
                                        <div className="text-white/70 text-sm whitespace-pre-wrap break-words">{b.message}</div>
                                        <div className="text-xs text-white/50 mt-2">
                                          {b.created_at ? new Date(b.created_at).toLocaleString() : '—'} · {b.ui_type} · targets {b.targets_count ?? 0}{b.zone ? ` · ${b.zone}` : ''}{b.play_sound ? ' · 🔊' : ''}
                                          </div>
                                          </div>
                                          </div>
                                        </div>
                                ))}
                                  </div>
                            ))}
                            </div>
                          </div>
                      </div>
                    )}

                    <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-gradient-to-br from-neon-green/20 to-neon-cyan/20 rounded-xl border border-neon-green/30">
                            <BarChart3 className="text-neon-green" size={24} />
                          </div>
                        <div>
                            <h4 className="text-2xl font-bold text-white gradient-text">Event Analytics</h4>
                            <p className="text-white/60 text-sm">Comprehensive insights and performance metrics</p>
                          </div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <select
                            value={selectedStatsEventId}
                            onChange={(e) => {
                              const id = e.target.value;
                              setSelectedStatsEventId(id);
                              fetchEventLiveStats(id);
                            }}
                            className="px-4 py-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white focus:outline-none focus:border-neon-green hover:border-neon-green/40 transition-all"
                          >
                            <option value="">Select event…</option>
                            {statsEvents.map((ev: any) => (
                              <option key={ev.id} value={ev.id}>
                                {ev.name} ({ev.status})
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={fetchStatsEvents}
                            className="border-neon-green/30 hover:bg-neon-green/10 text-white hover:border-neon-green/50 transition-all"
                          >
                            <RefreshCw size={16} className="mr-2" />
                            Refresh Events
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => selectedStatsEventId && fetchEventLiveStats(selectedStatsEventId)}
                            disabled={!selectedStatsEventId || isLoadingLiveStats}
                            className="border-neon-green/30 hover:bg-neon-green/10 text-white hover:border-neon-green/50 transition-all"
                          >
                            <RefreshCw size={16} className={`mr-2 ${isLoadingLiveStats ? 'animate-spin' : ''}`} />
                            Refresh
                          </Button>
                        </div>
                      </div>

                      {isLoadingLiveStats ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <RefreshCw className="animate-spin text-neon-green mb-4" size={32} />
                          <div className="text-white/60 text-sm">Loading event analytics…</div>
                        </div>
                      ) : !eventLiveStats ? (
                        <div className="flex flex-col items-center justify-center py-12 bg-cyber-800/30 rounded-xl border border-neon-green/10">
                          <BarChart3 className="text-neon-green/40 mb-4" size={48} />
                          <div className="text-white/60 text-sm">
                            {selectedStatsEventId ? 'Failed to load analytics for the selected event' : 'Select an event to view analytics'}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* High-level KPI Cards with Icons */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-cyber-800/60 to-cyber-800/40 border-2 border-neon-green/30 rounded-xl p-5 hover:border-neon-green/50 transition-all shadow-lg hover:shadow-neon-green/20 group">
                              <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-neon-green/20 rounded-lg">
                                  <Users className="text-neon-green" size={20} />
                                </div>
                                <TrendingUp className="text-neon-green/40 group-hover:text-neon-green transition-colors" size={18} />
                              </div>
                              <h5 className="text-white/70 text-sm font-semibold mb-3">Registrations</h5>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60 text-xs">Users</span>
                                  <span className="text-white font-bold text-lg">{eventLiveStats.total_users ?? 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60 text-xs">Teams</span>
                                  <span className="text-white font-bold text-lg">{eventLiveStats.total_teams ?? 0}</span>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-neon-green/10">
                                  <span className="text-neon-green text-xs font-semibold">Total Participants</span>
                                  <span className="text-neon-green font-bold text-xl">{eventLiveStats.total_participants ?? 0}</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-gradient-to-br from-cyber-800/60 to-cyber-800/40 border-2 border-neon-cyan/30 rounded-xl p-5 hover:border-neon-cyan/50 transition-all shadow-lg hover:shadow-neon-cyan/20 group">
                              <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-neon-cyan/20 rounded-lg">
                                  <Activity className="text-neon-cyan" size={20} />
                                </div>
                                <TrendingUp className="text-neon-cyan/40 group-hover:text-neon-cyan transition-colors" size={18} />
                              </div>
                              <h5 className="text-white/70 text-sm font-semibold mb-3">Submissions</h5>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60 text-xs">Total</span>
                                  <span className="text-white font-bold text-lg">{eventLiveStats.total_submissions ?? 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60 text-xs">Correct</span>
                                  <span className="text-neon-green font-bold text-lg">
                                    {eventLiveStats.correct_submissions ?? 0} ({Number(eventLiveStats.correct_submission_percent ?? 0).toFixed(1)}%)
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60 text-xs">Incorrect</span>
                                  <span className="text-orange-400 font-bold text-lg">
                                    {eventLiveStats.incorrect_submissions ?? 0} ({Number(eventLiveStats.incorrect_submission_percent ?? 0).toFixed(1)}%)
                                  </span>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-neon-cyan/10">
                                  <span className="text-neon-cyan text-xs font-semibold">IP Addresses</span>
                                  <span className="text-neon-cyan font-bold text-xl">{eventLiveStats.unique_ip_count ?? 0}</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-gradient-to-br from-cyber-800/60 to-cyber-800/40 border-2 border-neon-purple/30 rounded-xl p-5 hover:border-neon-purple/50 transition-all shadow-lg hover:shadow-neon-purple/20 group">
                              <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-neon-purple/20 rounded-lg">
                                  <Target className="text-neon-purple" size={20} />
                                </div>
                                <TrendingUp className="text-neon-purple/40 group-hover:text-neon-purple transition-colors" size={18} />
                              </div>
                              <h5 className="text-white/70 text-sm font-semibold mb-3">Challenges</h5>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60 text-xs">Total Challenges</span>
                                  <span className="text-white font-bold text-lg">{eventLiveStats.total_challenges ?? 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60 text-xs">Total Points</span>
                                  <span className="text-white font-bold text-lg">{eventLiveStats.total_possible_points ?? 0}</span>
                                </div>
                                <div className="pt-2 border-t border-neon-purple/10">
                                  <div className="text-white/60 text-xs mb-1">Most Solved</div>
                                  <div className="text-neon-purple font-semibold text-sm truncate">
                                    {eventLiveStats.most_solved_challenge?.challenge_name || '—'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Submissions Chart */}
                          <div className="bg-gradient-to-br from-cyber-800/60 to-cyber-800/40 border-2 border-neon-green/30 rounded-xl p-6 shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                              <BarChart3 className="text-neon-green" size={20} />
                              <h5 className="text-white font-bold text-lg">Submission Distribution</h5>
                            </div>
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: 'Correct', value: eventLiveStats.correct_submissions ?? 0, color: '#00FF88' },
                                    { name: 'Incorrect', value: eventLiveStats.incorrect_submissions ?? 0, color: '#FF6B35' }
                                  ]}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, percent }) => `${name}: ${(((percent ?? 0) as number) * 100).toFixed(1)}%`}
                                  outerRadius={100}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {[
                                    { name: 'Correct', value: eventLiveStats.correct_submissions ?? 0, color: '#00FF88' },
                                    { name: 'Incorrect', value: eventLiveStats.incorrect_submissions ?? 0, color: '#FF6B35' }
                                  ].map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                                    border: '1px solid rgba(0, 255, 136, 0.3)',
                                    borderRadius: '8px',
                                    color: '#fff'
                                  }}
                                />
                                <Legend 
                                  wrapperStyle={{ color: '#fff', paddingTop: '20px' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          {/* IP Address Details */}
                          <div className="bg-gradient-to-br from-cyber-800/60 to-cyber-800/40 border-2 border-neon-cyan/30 rounded-xl p-6 shadow-lg">
                            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-neon-cyan/20 rounded-lg">
                                  <Cloud className="text-neon-cyan" size={18} />
                                </div>
                                <h5 className="text-white font-bold text-lg">
                                  IP Addresses ({eventLiveStats.unique_ip_count ?? 0})
                                </h5>
                              </div>
                              <div className="text-xs text-white/50 bg-cyber-900/50 px-3 py-1 rounded-lg">
                                Source: submissions tracking
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                              <div className="p-4 bg-cyber-900/50 border border-neon-cyan/20 rounded-xl hover:border-neon-cyan/40 transition-all">
                                <div className="text-white/60 text-xs mb-2">Unique IP Addresses</div>
                                <div className="text-neon-cyan font-bold text-2xl">{eventLiveStats.unique_ip_count ?? 0}</div>
                              </div>
                              <div className="p-4 bg-cyber-900/50 border border-neon-cyan/20 rounded-xl hover:border-neon-cyan/40 transition-all">
                                <div className="text-white/60 text-xs mb-2">Most Active IP</div>
                                <div className="text-white font-bold text-lg">
                                  {eventLiveStats.most_active_ip ? (
                                    <>
                                      <div className="text-neon-cyan">{eventLiveStats.most_active_ip}</div>
                                      <div className="text-white/60 text-sm mt-1">({eventLiveStats.most_active_ip_activities ?? 0} activities)</div>
                                    </>
                                  ) : (
                                    <span className="text-white/40">—</span>
                                  )}
                                </div>
                              </div>
                              <div className="p-4 bg-cyber-900/50 border border-neon-cyan/20 rounded-xl hover:border-neon-cyan/40 transition-all">
                                <div className="text-white/60 text-xs mb-2">Total Activities</div>
                                <div className="text-white font-bold text-2xl">{eventLiveStats.total_activities_tracked ?? 0}</div>
                              </div>
                              <div className="p-4 bg-cyber-900/50 border border-neon-cyan/20 rounded-xl hover:border-neon-cyan/40 transition-all">
                                <div className="text-white/60 text-xs mb-2">IP Records</div>
                                <div className="text-white font-bold text-2xl">{(eventLiveStats.ip_details || []).length}</div>
                              </div>
                            </div>

                            {(eventLiveStats.ip_details || []).length === 0 ? (
                              <div className="text-center py-8">
                                <Cloud className="text-neon-cyan/40 mx-auto mb-2" size={32} />
                                <div className="text-white/50 text-sm">No IP activity yet.</div>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                {(eventLiveStats.ip_details || []).map((row: any, idx: number) => {
                                  const users = Array.isArray(row.users) ? row.users : [];
                                  const sources = Array.isArray(row.sources) ? row.sources : ['submissions'];
                                  const lastSeen = row.last_seen ? new Date(row.last_seen).toLocaleString() : '—';
                                  const maxActivities = Math.max(...(eventLiveStats.ip_details || []).map((r: any) => r.activities || 0), 1);
                                  const activityPercent = ((row.activities || 0) / maxActivities) * 100;
                                  return (
                                    <div 
                                      key={`${row.ip_address}-${idx}`} 
                                      className="p-4 bg-cyber-900/50 border border-neon-cyan/10 rounded-lg hover:border-neon-cyan/30 transition-all"
                                    >
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                          {idx < 3 && (
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                              idx === 0 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                              idx === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30' :
                                              'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                            }`}>
                                              {idx + 1}
                                            </div>
                                          )}
                                          <div>
                                            <div className="font-semibold text-white">{row.ip_address}</div>
                                            <div className="text-xs text-white/50 mt-1">
                                              {users.length ? `${users.length} user(s): ${users.slice(0, 2).join(', ')}${users.length > 2 ? '...' : ''}` : 'No users'}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-neon-cyan font-bold text-lg">{row.activities ?? 0}</div>
                                          <div className="text-white/60 text-xs">activities</div>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs text-white/60">
                                          <span>Sources: {sources.join(', ')}</span>
                                          <span>Last seen: {lastSeen}</span>
                                        </div>
                                        <div className="bg-cyber-800/50 rounded-full h-2 overflow-hidden">
                                          <div 
                                            className="h-full bg-gradient-to-r from-neon-cyan to-neon-green transition-all"
                                            style={{ width: `${Math.min(activityPercent, 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Top 10 Users with Chart */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-gradient-to-br from-cyber-800/60 to-cyber-800/40 border-2 border-neon-green/30 rounded-xl p-6 shadow-lg">
                              <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-neon-green/20 rounded-lg">
                                  <Trophy className="text-neon-green" size={18} />
                                </div>
                                <h5 className="text-white font-bold text-lg">Top 10 Users</h5>
                              </div>
                              {(eventLiveStats.top_users || []).length === 0 ? (
                                <div className="text-white/50 text-sm text-center py-8">No user stats yet.</div>
                              ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                  {(eventLiveStats.top_users || []).slice(0, 10).map((u: any, idx: number) => {
                                    const total = Number(u.total_submissions || 0);
                                    const correct = Number(u.correct_submissions || 0);
                                    const pct = total ? (correct / total) * 100 : 0;
                                    return (
                                      <div 
                                        key={u.user_id} 
                                        className="p-3 bg-cyber-900/50 border border-neon-green/10 rounded-lg hover:border-neon-green/30 transition-all"
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                              idx === 0 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                              idx === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30' :
                                              idx === 2 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                              'bg-neon-green/10 text-neon-green border border-neon-green/20'
                                            }`}>
                                              {idx + 1}
                                            </div>
                                            <div>
                                              <div className="font-semibold text-white text-sm">{u.username || '—'}</div>
                                              <div className="text-xs text-white/50">{u.user_id?.substring(0, 12)}...</div>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-neon-green font-bold">{u.total_points || 0} pts</div>
                                            <div className="text-white/60 text-xs">{u.challenges_solved || 0} solves</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                          <div className="flex-1 bg-cyber-800/50 rounded-full h-2 overflow-hidden">
                                            <div 
                                              className="h-full bg-gradient-to-r from-neon-green to-neon-cyan transition-all"
                                              style={{ width: `${Math.min(pct, 100)}%` }}
                                            />
                                          </div>
                                          <span className="text-white/70 text-xs min-w-[50px] text-right">{pct.toFixed(1)}%</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Top Users Bar Chart */}
                            {(eventLiveStats.top_users || []).length > 0 && (
                              <div className="bg-gradient-to-br from-cyber-800/60 to-cyber-800/40 border-2 border-neon-green/30 rounded-xl p-6 shadow-lg">
                                <div className="flex items-center gap-2 mb-4">
                                  <BarChart3 className="text-neon-green" size={18} />
                                  <h5 className="text-white font-bold text-lg">User Performance</h5>
                                </div>
                                <ResponsiveContainer width="100%" height={300}>
                                  <BarChart data={(eventLiveStats.top_users || []).slice(0, 10).map((u: any) => ({
                                    name: u.username?.substring(0, 10) || 'User',
                                    points: u.total_points || 0,
                                    solves: u.challenges_solved || 0,
                                    fullName: u.username,
                                    userId: u.user_id
                                  }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 136, 0.1)" />
                                    <XAxis 
                                      dataKey="name" 
                                      tick={{ fill: '#fff', fontSize: 12 }}
                                      angle={-45}
                                      textAnchor="end"
                                      height={80}
                                    />
                                    <YAxis tick={{ fill: '#fff', fontSize: 12 }} />
                                    <Tooltip 
                                      contentStyle={{ 
                                        backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                                        border: '1px solid rgba(0, 255, 136, 0.3)',
                                        borderRadius: '8px',
                                        color: '#fff'
                                      }}
                                    />
                                    <Legend 
                                      wrapperStyle={{ color: '#fff', paddingTop: '10px' }}
                                    />
                                    <Bar 
                                      dataKey="points" 
                                      fill="#00FF88" 
                                      radius={[8, 8, 0, 0]}
                                      onClick={(data: any, index: number) => {
                                        const userData = (eventLiveStats.top_users || []).slice(0, 10)[index];
                                        if (userData) {
                                          showToast(`User: ${userData.username} - ${userData.total_points} points, ${userData.challenges_solved} solves`, 'info');
                                        }
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <Bar 
                                      dataKey="solves" 
                                      fill="#00D9FF" 
                                      radius={[8, 8, 0, 0]}
                                      onClick={(data: any, index: number) => {
                                        const userData = (eventLiveStats.top_users || []).slice(0, 10)[index];
                                        if (userData) {
                                          showToast(`User: ${userData.username} - ${userData.total_points} points, ${userData.challenges_solved} solves`, 'info');
                                        }
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </div>

                          {/* Challenge breakdown with Chart */}
                          <div className="bg-gradient-to-br from-cyber-800/60 to-cyber-800/40 border-2 border-neon-purple/30 rounded-xl p-6 shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="p-2 bg-neon-purple/20 rounded-lg">
                                <Target className="text-neon-purple" size={18} />
                              </div>
                              <h5 className="text-white font-bold text-lg">Challenge Breakdown</h5>
                            </div>
                            {(eventLiveStats.challenge_stats || []).length === 0 ? (
                              <div className="text-white/50 text-sm text-center py-8">No challenges data yet.</div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                  {(eventLiveStats.challenge_stats || []).map((c: any) => {
                                    const denom =
                                      (eventLiveStats.participation_type === 'team_based'
                                        ? Number(eventLiveStats.total_teams || 0)
                                        : Number(eventLiveStats.total_users || 0)) || 0;
                                    const solves = Number(c.solve_count || 0);
                                    const attempts = Number(c.attempt_count || 0);
                                    const solvePct = denom ? (solves / denom) * 100 : 0;
                                    const attemptShare = (eventLiveStats.total_submissions || 0)
                                      ? (attempts / Number(eventLiveStats.total_submissions || 1)) * 100
                                      : 0;
                                    return (
                                      <div 
                                        key={c.challenge_id} 
                                        className="p-4 bg-cyber-900/50 border border-neon-purple/10 rounded-lg hover:border-neon-purple/30 transition-all"
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex-1">
                                            <div className="font-semibold text-white text-sm mb-1">{c.challenge_name || '—'}</div>
                                            <div className="text-xs text-white/50 mb-2">{c.category || '—'}</div>
                                          </div>
                                          <div className="text-right ml-4">
                                            <div className="text-neon-purple font-bold">{solves}</div>
                                            <div className="text-white/60 text-xs">solves</div>
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="text-white/60">Solve Rate</span>
                                            <span className="text-white/80">{solvePct.toFixed(1)}%</span>
                                          </div>
                                          <div className="bg-cyber-800/50 rounded-full h-2 overflow-hidden">
                                            <div 
                                              className="h-full bg-gradient-to-r from-neon-purple to-neon-cyan transition-all"
                                              style={{ width: `${Math.min(solvePct, 100)}%` }}
                                            />
                                          </div>
                                          <div className="flex items-center justify-between text-xs text-white/60">
                                            <span>Attempts: {attempts}</span>
                                            <span>Share: {attemptShare.toFixed(1)}%</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div>
                                  <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={(eventLiveStats.challenge_stats || []).map((c: any) => {
                                      const denom =
                                        (eventLiveStats.participation_type === 'team_based'
                                          ? Number(eventLiveStats.total_teams || 0)
                                          : Number(eventLiveStats.total_users || 0)) || 0;
                                      const solves = Number(c.solve_count || 0);
                                      const attempts = Number(c.attempt_count || 0);
                                      const solvePct = denom ? (solves / denom) * 100 : 0;
                                      return {
                                        name: c.challenge_name?.substring(0, 15) || 'Challenge',
                                        solves: solves,
                                        solveRate: solvePct,
                                        fullName: c.challenge_name,
                                        challengeId: c.challenge_id,
                                        attempts: attempts,
                                        category: c.category,
                                        points: c.points
                                      };
                                    })}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(157, 78, 221, 0.1)" />
                                      <XAxis 
                                        dataKey="name" 
                                        tick={{ fill: '#fff', fontSize: 11 }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                      />
                                      <YAxis tick={{ fill: '#fff', fontSize: 12 }} />
                                      <Tooltip 
                                        contentStyle={{ 
                                          backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                                          border: '1px solid rgba(157, 78, 221, 0.3)',
                                          borderRadius: '8px',
                                          color: '#fff'
                                        }}
                                      />
                                      <Legend 
                                        wrapperStyle={{ color: '#fff', paddingTop: '10px' }}
                                      />
                                      <Bar 
                                        dataKey="solves" 
                                        fill="#9D4EDD" 
                                        radius={[8, 8, 0, 0]}
                                        onClick={(data: any, index: number) => {
                                          const challengeData = (eventLiveStats.challenge_stats || [])[index];
                                          if (challengeData) {
                                            const solves = Number(challengeData.solve_count || 0);
                                            const attempts = Number(challengeData.attempt_count || 0);
                                            showToast(
                                              `Challenge: ${challengeData.challenge_name}\n` +
                                              `Solves: ${solves} | Attempts: ${attempts}\n` +
                                              `Category: ${challengeData.category || 'N/A'} | Points: ${challengeData.points || 0}`,
                                              'info'
                                            );
                                          }
                                        }}
                                        style={{ cursor: 'pointer' }}
                                      />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Category breakdown */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="bg-cyber-900/30 border border-neon-green/10 rounded-xl p-4">
                              <h5 className="text-white font-semibold mb-3">Category breakdown (challenges)</h5>
                              <div className="space-y-2">
                                {Object.entries(eventLiveStats.challenges_by_category || {}).map(([cat, count]: any) => (
                                  <div key={cat} className="flex items-center justify-between text-sm">
                                    <div className="text-white/80">{cat}</div>
                                    <div className="text-white/60">{count}</div>
                                  </div>
                                ))}
                                {Object.keys(eventLiveStats.challenges_by_category || {}).length === 0 && (
                                  <div className="text-white/50 text-sm">No category data yet.</div>
                                )}
                            </div>
                          </div>

                          <div className="bg-cyber-900/30 border border-neon-green/10 rounded-xl p-4">
                              <h5 className="text-white font-semibold mb-3">Category proficiency (solves/attempts)</h5>
                            <div className="space-y-2">
                              {Object.entries(eventLiveStats.category_proficiency_distribution || {}).map(([cat, v]: any) => (
                                <div key={cat} className="flex items-center justify-between text-sm">
                                  <div className="text-white/80">{cat}</div>
                                  <div className="text-white/60">
                                    solves {v.total_solves || 0} · attempts {v.total_attempts || 0}
                                  </div>
                                </div>
                              ))}
                              {Object.keys(eventLiveStats.category_proficiency_distribution || {}).length === 0 && (
                                <div className="text-white/50 text-sm">No category data yet.</div>
                              )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
