'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, LogOut, User, Target, RefreshCw, ChevronDown, ChevronUp, Mail, Users, Crown, FileText, BookOpen, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authAPI, userAPI, teamAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

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
  const hasCheckedAuth = useRef(false);

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

        // Test Users API first
        console.log('=== Testing Users API ===');
        console.log('Token exists:', !!token);
        console.log('Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'N/A');

        // Try to list users first (to test API connectivity)
        try {
          console.log('Attempting to list users (GET /users/)...');
          const usersList = await userAPI.listUsers();
          console.log('✅ Users list API response:', usersList);
          
          // If we get a list, try to find current user
          if (Array.isArray(usersList) && usersList.length > 0) {
            console.log(`Found ${usersList.length} users`);
            // Try to match by username from stored info
            const storedUser = localStorage.getItem('user_info');
            if (storedUser) {
              try {
                const parsed = JSON.parse(storedUser);
                const currentUser = usersList.find((u: any) => u.username === parsed.username);
                if (currentUser) {
                  console.log('✅ Found current user in list:', currentUser);
                  // Make sure email is included
                  if (currentUser.email) {
                    console.log('✅ User email from API:', currentUser.email);
                  }
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
          console.error('❌ Failed to list users:', listError);
          console.error('Error details:', {
            status: listError.response?.status,
            statusText: listError.response?.statusText,
            data: listError.response?.data,
            message: listError.message,
          });
        }

        // Fetch user profile using user ID
        try {
          // Try to get user ID from stored info first
          const storedUser = localStorage.getItem('user_info');
          let userId = localStorage.getItem('user_id');
          
          console.log('Stored user_id:', userId);
          console.log('Stored user_info:', storedUser);
          
          // If no user_id in localStorage, try to extract from stored user info
          if (!userId && storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              console.log('Parsed stored user:', parsedUser);
              if (parsedUser.id) {
                userId = parsedUser.id;
                localStorage.setItem('user_id', parsedUser.id);
                console.log('Extracted user_id from stored user_info:', userId);
              }
            } catch (e) {
              console.error('Error parsing stored user info:', e);
            }
          }

          // If we have a user ID, fetch the full profile
          if (userId) {
            console.log(`Attempting to get user by ID: ${userId} (GET /users/${userId})...`);
            try {
              const userResponse = await userAPI.getCurrentUser(userId);
              console.log('✅ User profile API response:', userResponse);
              // Check if email is in response
              if (userResponse.email) {
                console.log('✅ User email from API:', userResponse.email);
              } else {
                console.warn('⚠️ Email not found in user API response');
              }
              setUserProfile(userResponse);
              // Store in localStorage for sidebar
              localStorage.setItem('user_info', JSON.stringify(userResponse));
              // Ensure user_id is stored
              if (userResponse.id) {
                localStorage.setItem('user_id', userResponse.id);
              }
            } catch (error: any) {
              console.error('❌ Failed to fetch user profile by ID:', error);
              console.error('Error details:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message,
                url: error.config?.url,
              });
              // Fallback to stored user info
              if (storedUser) {
                try {
                  setUserProfile(JSON.parse(storedUser));
                  console.log('Using stored user info as fallback');
                } catch (e) {
                  console.error('Error parsing stored user info:', e);
                }
              }
            }
          } else {
            // No user ID available, use stored info
            console.warn('⚠️ No user ID found, using stored user info');
            if (storedUser) {
              try {
                setUserProfile(JSON.parse(storedUser));
                console.log('Using stored user info');
              } catch (e) {
                console.error('Error parsing stored user info:', e);
              }
            }
          }
        } catch (error: any) {
          console.error('❌ Error in user profile fetch:', error);
          console.error('Error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
          });
          // Fallback to stored user info
          const storedUser = localStorage.getItem('user_info');
          if (storedUser) {
            try {
              setUserProfile(JSON.parse(storedUser));
            } catch (e) {
              console.error('Error parsing stored user info:', e);
            }
          }
        }
        
        console.log('=== End Users API Test ===');

        // Fetch team information
        try {
          const teamResponse = await teamAPI.getMyTeam();
          setTeam(teamResponse);
          
          // Update user profile with team info if available
          if (teamResponse) {
            setUserProfile((prev) => {
              const updated: UserProfile = {
                ...prev,
                zone: prev.zone || teamResponse.id,
              };
              
              // Extract email from team members if not already set
              if (!updated.email && teamResponse.members && Array.isArray(teamResponse.members)) {
                // Try to get current username from multiple sources
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
                    console.log('✅ Extracted email from team member:', currentUserMember.email);
                    // Also update localStorage
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
          // User might not be in a team (404), that's okay
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
      // Refresh both user and team data
      const storedUser = localStorage.getItem('user_info');
      const userId = localStorage.getItem('user_id');
      
      // Refresh user profile
      if (userId) {
        try {
          const userResponse = await userAPI.getCurrentUser(userId);
          setUserProfile(userResponse);
          localStorage.setItem('user_info', JSON.stringify(userResponse));
        } catch (error: any) {
          console.error('Failed to refresh user profile:', error);
          // CORS or other error - use stored data
        }
      }
      
      // Refresh team data
      try {
        const teamResponse = await teamAPI.getMyTeam();
        setTeam(teamResponse);
        showToast('Data refreshed successfully', 'success');
      } catch (error: any) {
        console.error('Failed to refresh team:', error);
        // CORS error - show warning but don't fail completely
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

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-background security-pattern flex items-center justify-center relative overflow-hidden scan-line">
        <div className="absolute inset-0 hex-pattern opacity-30 pointer-events-none" />
        <div className="data-panel terminal-border p-8 bg-secondary/20 border-2 border-accent relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-accent/20 border-2 border-accent flex items-center justify-center">
                <Shield className="text-accent" size={20} />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent pulse-ring" />
            </div>
            <div>
              <h2 className="text-lg font-mono font-bold text-accent tracking-wider">
                [LOADING] AUTHENTICATION_CHECK
              </h2>
              <p className="text-xs text-secondary font-mono">Verifying credentials...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background security-pattern flex flex-col lg:flex-row relative overflow-hidden scan-line">
      {/* Animated Grid Background */}
      <div className="absolute inset-0 hex-pattern opacity-30 pointer-events-none" />
      
      {/* Left Sidebar - Authentication Panel */}
      <div className="w-full lg:w-80 xl:w-96 relative z-10 border-b-2 lg:border-b-0 lg:border-r-2 border-accent/30">
        {/* Military-style header bar */}
        <div className="bg-primary/40 border-b-2 border-accent p-4 data-panel">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-accent/20 border-2 border-accent flex items-center justify-center">
                <Shield className="text-accent" size={20} />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent pulse-ring" />
            </div>
            <div>
              <h1 className="text-lg font-mono font-bold text-accent tracking-wider">
                AUTHENTICATION
              </h1>
              <p className="text-xs text-secondary font-mono">SYSTEM_STATUS</p>
            </div>
          </div>
        </div>

        {/* User Info Panel */}
        <div className="p-4 lg:p-6 space-y-4">
          <div className="data-panel terminal-border p-3 lg:p-4 bg-accent/10 border-2 border-accent">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-6 bg-accent glow-accent" />
              <h2 className="text-xs lg:text-sm font-mono font-bold text-accent tracking-wider">
                [USER_INFO]
              </h2>
            </div>
            <div className="space-y-2 font-mono text-xs lg:text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-accent">Logged in as:</span>
                <span className="text-text font-semibold break-all">{userProfile.username || 'User'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-accent">Role:</span>
                <span className="text-text">{userProfile.role || 'User'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-accent">Zone:</span>
                <span className="text-text break-all">{userProfile.zone || team?.id || 'N/A'}</span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="md"
            onClick={handleLogout}
            className="w-full badge-military font-mono font-semibold tracking-wider"
          >
            <LogOut size={18} className="mr-2" />
            &gt; LOGOUT
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Top Status Bar */}
        <div className="bg-primary/40 border-b-2 border-accent p-3 lg:p-4 data-panel">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 lg:gap-4">
              <div className="flex items-center gap-1 lg:gap-2">
                <Target className="text-accent" size={20} />
                <h1 className="text-lg lg:text-2xl font-mono font-bold text-accent tracking-wider">
                  <span className="hidden sm:inline">PACSTAR CHALLENGE MANAGEMENT</span>
                  <span className="sm:hidden">PACSTAR</span>
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent rounded-full glow-accent" />
              <span className="text-xs text-accent font-mono">ONLINE</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <div className="mb-4 lg:mb-6">
            <div className="flex items-center gap-2 mb-2">
              <User className="text-accent" size={20} />
              <h2 className="text-xl lg:text-2xl font-mono font-bold text-accent tracking-wider">
                USER DASHBOARD
            </h2>
            </div>
          </div>

          {/* My Profile Section */}
          <div className="mb-4 lg:mb-6">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-full flex items-center justify-between p-3 lg:p-4 bg-secondary/20 border-2 border-accent/30 data-panel terminal-border hover:border-accent/50 transition-all"
            >
              <div className="flex items-center gap-2 lg:gap-3">
                <FileText className="text-accent" size={18} />
                <h3 className="text-base lg:text-lg font-mono font-bold text-accent tracking-wider">
                  MY PROFILE
                </h3>
                {isProfileOpen ? (
                  <ChevronUp className="text-accent" size={16} />
                ) : (
                  <ChevronDown className="text-accent" size={16} />
                )}
              </div>
            </button>
            {isProfileOpen && (
              <div className="mt-2 p-4 lg:p-6 bg-secondary/10 border-2 border-accent/20 data-panel terminal-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 font-mono text-sm">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-text">Username: </span>
                      <span className="text-accent font-semibold">{userProfile.username || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-text">Email: </span>
                      {userProfile.email ? (
                        <a 
                          href={`mailto:${userProfile.email}`}
                          className="text-accent hover:underline"
                        >
                          {userProfile.email}
                        </a>
                      ) : (
                        <span className="text-text/60">N/A</span>
                      )}
                    </div>
                    <div>
                      <span className="text-text">Role: </span>
                      <span className="text-accent">{userProfile.role || 'User'}</span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-text">Zone: </span>
                      <span className="text-accent">{userProfile.zone || team?.id || 'N/A'}</span>
                    </div>
                    {team && (
                      <>
                        <div>
                          <span className="text-text">Team Code: </span>
                          <span className="inline-block px-3 py-1 bg-accent/20 border border-accent text-accent font-semibold">
                            {team.team_code}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-text">Active: </span>
                          <CheckCircle className="text-accent" size={18} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* My Team Section */}
          {team && (
            <div className="mb-4 lg:mb-6">
              <button
                onClick={() => setIsTeamOpen(!isTeamOpen)}
                className="w-full flex items-center justify-between p-3 lg:p-4 bg-secondary/20 border-2 border-accent/30 data-panel terminal-border hover:border-accent/50 transition-all"
              >
                <div className="flex items-center gap-2 lg:gap-3">
                  <Users className="text-accent" size={18} />
                  <h3 className="text-base lg:text-lg font-mono font-bold text-accent tracking-wider">
                    MY TEAM
                  </h3>
                  {isTeamOpen ? (
                    <ChevronUp className="text-accent" size={16} />
                  ) : (
                    <ChevronDown className="text-accent" size={16} />
                  )}
                </div>
              </button>
              {isTeamOpen && (
                <div className="mt-2 p-4 lg:p-6 bg-secondary/10 border-2 border-accent/20 data-panel terminal-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 font-mono text-sm">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div>
                        <span className="text-text">Team Name: </span>
                        <span className="text-accent font-semibold">{team.name}</span>
                      </div>
                      <div>
                        <span className="text-text">Team Code: </span>
                        <span className="text-accent">{team.team_code}</span>
                      </div>
                      
                      {/* View Team Members - Collapsible */}
                      <div>
                        <button
                          onClick={() => setIsTeamMembersOpen(!isTeamMembersOpen)}
                          className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors"
                        >
                          <span>View Team Members</span>
                          {isTeamMembersOpen ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>
                        {isTeamMembersOpen && team.members && team.members.length > 0 && (
                          <div className="mt-3 ml-4 space-y-2">
                            {team.members.map((member) => (
                              <div key={member.user_id} className="flex items-center gap-2 text-sm">
                                {member.role === 'leader' ? (
                                  <>
                                    <Crown className="text-warning" size={16} />
                                    <span className="text-text">
                                      Leader {member.username} (
                                      <a 
                                        href={`mailto:${member.email}`}
                                        className="text-accent hover:underline"
                                      >
                                        {member.email}
                                      </a>
                                      )
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <User className="text-accent" size={16} />
                                    <span className="text-text">
                                      Member {member.username} (
                                      <a 
                                        href={`mailto:${member.email}`}
                                        className="text-accent hover:underline"
                                      >
                                        {member.email}
                                      </a>
                                      )
                                    </span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <div>
                        <span className="text-text">Members: </span>
                        <span className="text-accent">
                          {team.member_count}/{team.max_members}
                        </span>
                      </div>
                      <div>
                        <span className="text-text">Leader: </span>
                        <span className="text-accent">{team.leader_username}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Available Challenges Section */}
          <div>
            <div className="flex items-center justify-between mb-3 lg:mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="text-accent" size={18} />
                <h3 className="text-base lg:text-lg font-mono font-bold text-accent tracking-wider">
                  <span className="hidden sm:inline">AVAILABLE CHALLENGES</span>
                  <span className="sm:hidden">CHALLENGES</span>
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="badge-military font-mono text-xs"
              >
                <RefreshCw size={14} className="mr-1 lg:mr-2" />
                <span className="hidden sm:inline">REFRESH</span>
                <span className="sm:hidden">↻</span>
              </Button>
            </div>
            <div className="data-panel terminal-border p-4 lg:p-6 bg-secondary/10 border-2 border-accent/20">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="p-4 bg-accent/10 border-2 border-accent/30 rounded mb-4">
                    <p className="text-text/80 font-mono text-sm">
                      No challenges available at the moment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
