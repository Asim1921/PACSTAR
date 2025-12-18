'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, LogOut, User, Target, RefreshCw, ChevronDown, ChevronUp, Mail, Users, Crown, FileText, BookOpen, CheckCircle, Settings, Trophy, FileCode, BarChart3, Search, Cloud, Menu, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { authAPI, userAPI, teamAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import { Challenges } from '@/components/admin/Challenges';
import { DockerfileToK8s } from '@/components/admin/DockerfileToK8s';
import { OpenStack } from '@/components/admin/OpenStack';
import { Events } from '@/components/admin/Events';
import { UserChallenges } from '@/components/user/UserChallenges';
import { Scoreboard } from '@/components/user/Scoreboard';
import { UserEvents } from '@/components/user/UserEvents';
import ParticleBackground from '@/components/auth/ParticleBackground';

interface UserProfile {
  id?: string;
  username?: string;
  email?: string;
  role?: string;
  zone?: string;
  is_active?: boolean;
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
}

export default function Dashboard() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [team, setTeam] = useState<Team | null>(null);
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
  
  // Check if user is Master role
  const isMaster = userProfile.role?.toLowerCase() === 'master';

  // Fetch user profile and team data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasCheckedAuth.current) return;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
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
                  localStorage.setItem('user_info', JSON.stringify(currentUser));
                    localStorage.setItem('user_id', currentUser.id);
                  }
          } catch (meError: any) {
            console.log('auth/me failed, trying alternative method:', meError);
            
            // Fallback: Try to get user ID from token and use getCurrentUser
            let userId = localStorage.getItem('user_id');
            
            if (!userId) {
              // Try to extract from token
              try {
                const token = localStorage.getItem('auth_token');
                if (token) {
                  const decoded = JSON.parse(atob(token.split('.')[1]));
                  userId = decoded.sub || decoded.user_id || decoded.id;
                  if (userId) {
                    localStorage.setItem('user_id', userId);
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
              localStorage.setItem('user_info', JSON.stringify(userResponse));
              if (userResponse.id) {
                localStorage.setItem('user_id', userResponse.id);
              }
              } catch (userError: any) {
                console.error('Failed to fetch user profile by ID:', userError);
                // Last resort: use stored user info if available
                const storedUser = localStorage.getItem('user_info');
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
              const storedUser = localStorage.getItem('user_info');
              if (storedUser) {
                try {
                  const parsed = JSON.parse(storedUser);
                  setUserProfile(parsed);
                  if (parsed.id) {
                    localStorage.setItem('user_id', parsed.id);
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
          const storedUser = localStorage.getItem('user_info');
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
            localStorage.setItem('team_info', JSON.stringify(teamResponse));
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
                    const storedUser = localStorage.getItem('user_info');
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
                      const storedUser = localStorage.getItem('user_info');
                      if (storedUser) {
                        const parsed = JSON.parse(storedUser);
                        parsed.email = currentUserMember.email;
                        localStorage.setItem('user_info', JSON.stringify(parsed));
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

  const handleLogout = () => {
    authAPI.logout();
    showToast('User logged out successfully', 'info');
    router.push('/');
  };

  const handleRefresh = async () => {
    setIsDataLoading(true);
    try {
      const storedUser = localStorage.getItem('user_info');
      const userId = localStorage.getItem('user_id');
      
      if (userId) {
        try {
          const userResponse = await userAPI.getCurrentUser(userId);
          setUserProfile(userResponse);
          localStorage.setItem('user_info', JSON.stringify(userResponse));
        } catch (error: any) {
          console.error('Failed to refresh user profile:', error);
        }
      }
      
      try {
        const teamResponse = await teamAPI.getMyTeam();
        setTeam(teamResponse);
        if (teamResponse) {
          localStorage.setItem('team_info', JSON.stringify(teamResponse));
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
    if (!isMaster) return;
    
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

  const handleAdminRefresh = async () => {
    if (activeAdminTab === 'users') {
      await fetchAllUsers();
    } else {
      showToast('Refresh functionality for this tab coming soon', 'info');
    }
  };

  useEffect(() => {
    if (viewMode === 'admin' && activeAdminTab === 'users' && isMaster && allUsers.length === 0) {
      fetchAllUsers();
    }
  }, [viewMode, activeAdminTab]);

  const filteredUsers = allUsers.filter((user) => {
    const searchLower = userSearchTerm.toLowerCase();
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

            {/* Navigation for Master Users */}
            {isMaster && (
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

                {/* Events Section */}
                <div className="mt-6">
                  <UserEvents />
                </div>

                {/* Challenges Section */}
                <UserChallenges teamId={team?.id} />

                {/* Scoreboard Section */}
                <div className="mt-6">
                  <Scoreboard />
                </div>
              </div>
            )}

            {/* Admin Panel View */}
            {viewMode === 'admin' && isMaster && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-white gradient-text">Admin Panel</h2>
                  <p className="text-white/60 mt-1">Manage users, challenges, and system settings</p>
                </div>

                {/* Admin Tabs */}
                <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 p-2 terminal-border">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'users', label: 'Users', icon: User },
                      { id: 'challenges', label: 'Challenges', icon: Trophy },
                      { id: 'events', label: 'Events', icon: Calendar },
                      { id: 'dockerfile', label: 'Dockerfile', icon: FileCode },
                      { id: 'openstack', label: 'OpenStack', icon: Cloud },
                      { id: 'stats', label: 'Stats', icon: BarChart3 },
                    ].map((tab) => {
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
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Zone</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Active</th>
                            </tr>
                          </thead>
                          <tbody>
                            {isLoadingUsers ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-white/60">
                                  Loading users...
                                </td>
                              </tr>
                            ) : filteredUsers.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-white/60">
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
                                  <td className="px-4 py-3 text-white/80">{user.zone || 'N/A'}</td>
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
                  <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-12">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-neon-green/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neon-green/40 glow-accent">
                        <BarChart3 className="text-neon-green" size={40} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2 gradient-text">Statistics Dashboard</h3>
                      <p className="text-white/60">Coming soon...</p>
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
