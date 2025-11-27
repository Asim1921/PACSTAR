'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, LogOut, User, Target, RefreshCw, ChevronDown, ChevronUp, Mail, Users, Crown, FileText, BookOpen, CheckCircle, Settings, Trophy, FileCode, BarChart3, Search, Cloud, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { authAPI, userAPI, teamAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import { Challenges } from '@/components/admin/Challenges';
import { DockerfileToK8s } from '@/components/admin/DockerfileToK8s';
import { OpenStack } from '@/components/admin/OpenStack';
import { UserChallenges } from '@/components/user/UserChallenges';
import { Scoreboard } from '@/components/user/Scoreboard';

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
type AdminTab = 'users' | 'challenges' | 'dockerfile' | 'openstack' | 'stats';

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

        try {
          const usersList = await userAPI.listUsers();
          if (Array.isArray(usersList) && usersList.length > 0) {
            const storedUser = localStorage.getItem('user_info');
            if (storedUser) {
              try {
                const parsed = JSON.parse(storedUser);
                const currentUser = usersList.find((u: any) => u.username === parsed.username);
                if (currentUser) {
                  setUserProfile(currentUser);
                  localStorage.setItem('user_info', JSON.stringify(currentUser));
                  if (currentUser.id) {
                    localStorage.setItem('user_id', currentUser.id);
                  }
                }
              } catch (e) {
                console.error('Error parsing stored user:', e);
              }
            }
          }
        } catch (listError: any) {
          console.error('Failed to list users:', listError);
        }

        try {
          const storedUser = localStorage.getItem('user_info');
          let userId = localStorage.getItem('user_id');
          
          if (!userId && storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              if (parsedUser.id) {
                userId = parsedUser.id;
                localStorage.setItem('user_id', parsedUser.id);
              }
            } catch (e) {
              console.error('Error parsing stored user info:', e);
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
            } catch (error: any) {
              console.error('Failed to fetch user profile by ID:', error);
              if (storedUser) {
                try {
                  setUserProfile(JSON.parse(storedUser));
                } catch (e) {
                  console.error('Error parsing stored user info:', e);
                }
              }
            }
          } else {
            if (storedUser) {
              try {
                setUserProfile(JSON.parse(storedUser));
              } catch (e) {
                console.error('Error parsing stored user info:', e);
              }
            }
          }
        } catch (error: any) {
          console.error('Error in user profile fetch:', error);
          const storedUser = localStorage.getItem('user_info');
          if (storedUser) {
            try {
              setUserProfile(JSON.parse(storedUser));
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
      <div className="min-h-screen w-full bg-gradient-to-br from-white via-brown-50 to-orange-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-brown-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Shield className="text-green-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brown-900">Loading...</h2>
              <p className="text-brown-600 text-sm">Verifying credentials...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white via-brown-50 to-orange-50">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-brown-200 shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 lg:px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-brown-50 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X size={24} className="text-brown-700" /> : <Menu size={24} className="text-brown-700" />}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                <Shield className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-brown-900">PACSTAR</h1>
                <p className="text-xs text-brown-600">Challenge Management</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-700">Online</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          fixed lg:static inset-y-0 left-0 z-40
          w-80 bg-white border-r border-brown-200 shadow-lg lg:shadow-none
          transition-transform duration-300 ease-in-out
          pt-20 lg:pt-0
        `}>
          <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* User Info Card */}
            <div className="bg-gradient-to-br from-brown-600 to-brown-700 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border-2 border-white/30">
                  <User className="text-white" size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{userProfile.username || 'User'}</h3>
                  <p className="text-white/80 text-sm">{userProfile.role || 'User'}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-white/70" />
                  <span className="text-white/90">{userProfile.email || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-white/70" />
                  <span className="text-white/90">
                    {team ? `Team: ${team.team_code}` : (userProfile.zone || 'N/A')}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation for Master Users */}
            {isMaster && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-brown-700 mb-2">View Mode</label>
                <div className="flex gap-2 p-1 bg-brown-50 rounded-xl">
                  <button
                    onClick={() => setViewMode('user')}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                      viewMode === 'user'
                        ? 'bg-white text-brown-900 shadow-sm'
                        : 'text-brown-600 hover:text-brown-900'
                    }`}
                  >
                    User
                  </button>
                  <button
                    onClick={() => setViewMode('admin')}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                      viewMode === 'admin'
                        ? 'bg-white text-brown-900 shadow-sm'
                        : 'text-brown-600 hover:text-brown-900'
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-screen">
          <div className="p-4 lg:p-8">
            {/* User View */}
            {viewMode === 'user' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-brown-900">Dashboard</h2>
                    <p className="text-brown-600 mt-1">Welcome back, {userProfile.username}!</p>
                  </div>
                </div>

                {/* Profile Section */}
                <div className="bg-white rounded-2xl shadow-md border border-brown-200 overflow-hidden">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="w-full flex items-center justify-between p-6 hover:bg-brown-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <FileText className="text-green-600" size={24} />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-brown-900">My Profile</h3>
                        <p className="text-sm text-brown-600">View your account information</p>
                      </div>
                    </div>
                    {isProfileOpen ? <ChevronUp className="text-brown-400" size={20} /> : <ChevronDown className="text-brown-400" size={20} />}
                  </button>
                  {isProfileOpen && (
                    <div className="px-6 pb-6 border-t border-brown-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-semibold text-brown-600">Username</label>
                            <p className="text-brown-900 font-medium mt-1">{userProfile.username || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-brown-600">Email</label>
                            {userProfile.email ? (
                              <a href={`mailto:${userProfile.email}`} className="text-green-600 hover:text-green-700 font-medium mt-1 block">
                                {userProfile.email}
                              </a>
                            ) : (
                              <p className="text-brown-400 mt-1">N/A</p>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-brown-600">Role</label>
                            <p className="text-brown-900 font-medium mt-1">{userProfile.role || 'User'}</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-semibold text-brown-600">Zone</label>
                            <p className="text-brown-900 font-medium mt-1">
                              {team ? `Team: ${team.team_code}` : (userProfile.zone || 'N/A')}
                            </p>
                          </div>
                          {team && (
                            <>
                              <div>
                                <label className="text-sm font-semibold text-brown-600">Team Code</label>
                                <p className="text-green-600 font-bold mt-1">{team.team_code}</p>
                              </div>
                              <div>
                                <label className="text-sm font-semibold text-brown-600">Status</label>
                                <div className="flex items-center gap-2 mt-1">
                                  <CheckCircle className="text-green-600" size={18} />
                                  <span className="text-green-600 font-medium">Active</span>
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
                  <div className="bg-white rounded-2xl shadow-md border border-brown-200 overflow-hidden">
                    <button
                      onClick={() => setIsTeamOpen(!isTeamOpen)}
                      className="w-full flex items-center justify-between p-6 hover:bg-brown-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                          <Users className="text-orange-600" size={24} />
                        </div>
                        <div className="text-left">
                          <h3 className="text-lg font-bold text-brown-900">My Team</h3>
                          <p className="text-sm text-brown-600">{team.name}</p>
                        </div>
                      </div>
                      {isTeamOpen ? <ChevronUp className="text-brown-400" size={20} /> : <ChevronDown className="text-brown-400" size={20} />}
                    </button>
                    {isTeamOpen && (
                      <div className="px-6 pb-6 border-t border-brown-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-semibold text-brown-600">Team Name</label>
                              <p className="text-brown-900 font-medium mt-1">{team.name}</p>
                            </div>
                            <div>
                              <label className="text-sm font-semibold text-brown-600">Team Code</label>
                              <p className="text-green-600 font-bold mt-1">{team.team_code}</p>
                            </div>
                            <div>
                              <label className="text-sm font-semibold text-brown-600">Members</label>
                              <p className="text-brown-900 font-medium mt-1">
                                {team.member_count}/{team.max_members}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-semibold text-brown-600">Leader</label>
                              <p className="text-brown-900 font-medium mt-1">{team.leader_username}</p>
                            </div>
                            <div>
                              <button
                                onClick={() => setIsTeamMembersOpen(!isTeamMembersOpen)}
                                className="text-green-600 hover:text-green-700 font-semibold text-sm flex items-center gap-2"
                              >
                                View Team Members
                                {isTeamMembersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                              {isTeamMembersOpen && team.members && team.members.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {team.members.map((member) => (
                                    <div key={member.user_id} className="flex items-center gap-2 p-2 bg-brown-50 rounded-lg">
                                      {member.role === 'leader' ? (
                                        <Crown className="text-orange-600" size={16} />
                                      ) : (
                                        <User className="text-brown-400" size={16} />
                                      )}
                                      <span className="text-sm text-brown-900">{member.username}</span>
                                      <a href={`mailto:${member.email}`} className="text-green-600 hover:text-green-700 text-xs ml-auto">
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
                  <h2 className="text-3xl font-bold text-brown-900">Admin Panel</h2>
                  <p className="text-brown-600 mt-1">Manage users, challenges, and system settings</p>
                </div>

                {/* Admin Tabs */}
                <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-2">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'users', label: 'Users', icon: User },
                      { id: 'challenges', label: 'Challenges', icon: Trophy },
                      { id: 'dockerfile', label: 'Dockerfile', icon: FileCode },
                      { id: 'openstack', label: 'OpenStack', icon: Cloud },
                      { id: 'stats', label: 'Stats', icon: BarChart3 },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveAdminTab(tab.id as AdminTab)}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
                            activeAdminTab === tab.id
                              ? 'bg-green-500 text-white shadow-md'
                              : 'text-brown-700 hover:bg-brown-50'
                          }`}
                        >
                          <Icon size={18} />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Users Tab Content */}
                {activeAdminTab === 'users' && (
                  <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-6">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-brown-900 mb-4">User Management</h3>
                      
                      <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="flex-1 relative">
                          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-brown-400" size={18} />
                          <input
                            type="text"
                            placeholder="Search users..."
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-brown-50 border-2 border-brown-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-brown-900"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="md"
                          onClick={handleAdminRefresh}
                          disabled={isLoadingUsers}
                        >
                          <RefreshCw size={16} className={`mr-2 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>

                      <div className="mb-4">
                        <span className="text-brown-700 font-medium">
                          Total Users: <span className="text-green-600 font-bold">{filteredUsers.length}</span>
                        </span>
                      </div>

                      <div className="overflow-x-auto border border-brown-200 rounded-xl">
                        <table className="w-full">
                          <thead className="bg-brown-50 border-b border-brown-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Username</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Email</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Role</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Zone</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-brown-700">Active</th>
                            </tr>
                          </thead>
                          <tbody>
                            {isLoadingUsers ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-brown-600">
                                  Loading users...
                                </td>
                              </tr>
                            ) : filteredUsers.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-brown-600">
                                  {userSearchTerm ? 'No users found matching your search.' : 'No users available.'}
                                </td>
                              </tr>
                            ) : (
                              filteredUsers.map((user) => (
                                <tr
                                  key={user.id}
                                  className="border-b border-brown-100 hover:bg-brown-50 transition-colors"
                                >
                                  <td className="px-4 py-3 text-brown-900 font-medium">{user.username}</td>
                                  <td className="px-4 py-3">
                                    <a
                                      href={`mailto:${user.email}`}
                                      className="text-green-600 hover:text-green-700 hover:underline"
                                    >
                                      {user.email}
                                    </a>
                                  </td>
                                  <td className="px-4 py-3 text-brown-700">{user.role}</td>
                                  <td className="px-4 py-3 text-brown-700">{user.zone || 'N/A'}</td>
                                  <td className="px-4 py-3">
                                    {user.is_active ? (
                                      <CheckCircle className="text-green-600" size={20} />
                                    ) : (
                                      <span className="text-brown-400">—</span>
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
                  <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-12">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-brown-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BarChart3 className="text-brown-600" size={40} />
                      </div>
                      <h3 className="text-xl font-bold text-brown-900 mb-2">Statistics Dashboard</h3>
                      <p className="text-brown-600">Coming soon...</p>
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
