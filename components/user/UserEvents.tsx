'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Trophy, 
  Users, 
  Flag, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Play, 
  Pause, 
  RefreshCw,
  Search,
  Filter,
  Eye,
  Lightbulb,
  Award,
  Target,
  BarChart3,
  User as UserIcon,
  Shield,
  Zap,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { InfoBox } from '@/components/ui/InfoBox';
import { eventAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

interface Event {
  id: string;
  name: string;
  description: string;
  event_type: 'ctf' | 'cyber_exercise';
  participation_type: 'user_based' | 'team_based';
  zone: string;
  status: string;
  start_time: string;
  end_time: string;
  max_participants?: number;
  is_public: boolean;
  participant_count: number;
  challenge_count?: number;
  challenges?: Challenge[];
  event_admin_user_id?: string | null;
  event_admin_username?: string | null;
  banned_team_ids?: string[];
}

interface Challenge {
  challenge_id: string;
  challenge_name: string;
  challenge_category: string;
  description: string;
  visibility: 'visible' | 'hidden';
  points: number;
  order: number;
  is_unlocked: boolean;
  solve_count: number;
  hints?: Hint[];
}

interface Hint {
  id: string;
  content: string;
  hint_type: string;
  cost: number;
  order: number;
  unlocked_by?: string[];
}

type ViewType = 'list' | 'details' | 'scoreboard' | 'stats';

interface UserEventsProps {
  onJoinEvent?: () => void;
  isAdmin?: boolean;
}

export const UserEvents: React.FC<UserEventsProps> = ({ onJoinEvent, isAdmin = false }) => {
  const { showToast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [viewType, setViewType] = useState<ViewType>('list');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // For regular users, always filter to 'running'. For admins, allow all statuses
  const [statusFilter, setStatusFilter] = useState<string>(isAdmin ? 'all' : 'running');
  const [expandedChallenges, setExpandedChallenges] = useState<Set<string>>(new Set());
  
  // Flag submission
  const [flagInputs, setFlagInputs] = useState<Record<string, string>>({});
  const [submittingFlags, setSubmittingFlags] = useState<Set<string>>(new Set());
  
  // Scoreboard
  const [scoreboard, setScoreboard] = useState<any>(null);
  const [myStats, setMyStats] = useState<any>(null);
  const [eventTeams, setEventTeams] = useState<Array<{ team_id: string; team_name?: string; banned: boolean }>>([]);
  const [isLoadingEventTeams, setIsLoadingEventTeams] = useState(false);

  // Fetch events
  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const filters: any = {};
      // Regular users should only see running events
      if (!isAdmin) {
        filters.status_filter = 'running';
      } else if (statusFilter !== 'all') {
        filters.status_filter = statusFilter;
      }
      
      const response = await eventAPI.listEvents(filters);
      setEvents(response.events || []);
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to fetch events', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch event details
  const fetchEventDetails = async (eventId: string) => {
    setIsLoading(true);
    try {
      const response = await eventAPI.getEvent(eventId);
      setSelectedEvent(response);
      setViewType('details');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to fetch event details', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;
  const isEventAdminForSelected =
    !!selectedEvent?.event_admin_user_id && !!currentUserId && selectedEvent.event_admin_user_id === currentUserId;

  const fetchEventTeams = async (eventId: string) => {
    setIsLoadingEventTeams(true);
    try {
      const res = await eventAPI.listEventTeams(eventId);
      setEventTeams(res?.teams || []);
    } catch (error: any) {
      console.error('Failed to fetch event teams:', error);
    } finally {
      setIsLoadingEventTeams(false);
    }
  };

  const handlePauseResumeAsEventAdmin = async (paused: boolean) => {
    if (!selectedEvent) return;
    try {
      await eventAPI.pauseEvent(selectedEvent.id, paused, paused ? 'Paused by Event Admin' : 'Resumed by Event Admin');
      showToast(paused ? 'Event paused' : 'Event resumed', 'success');
      await fetchEventDetails(selectedEvent.id);
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to pause/resume event', 'error');
    }
  };

  const handleEndAsEventAdmin = async () => {
    if (!selectedEvent) return;
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to end this event?')) return;
    try {
      await eventAPI.endEvent(selectedEvent.id);
      showToast('Event ended', 'success');
      await fetchEventDetails(selectedEvent.id);
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to end event', 'error');
    }
  };

  const handleToggleBanTeam = async (teamId: string, ban: boolean) => {
    if (!selectedEvent) return;
    try {
      if (ban) {
        await eventAPI.banTeamForEvent(selectedEvent.id, teamId);
        showToast('Team banned for this event', 'success');
      } else {
        await eventAPI.unbanTeamForEvent(selectedEvent.id, teamId);
        showToast('Team unbanned for this event', 'success');
      }
      await fetchEventTeams(selectedEvent.id);
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to update team ban', 'error');
    }
  };

  // Fetch scoreboard
  const fetchScoreboard = async (eventId: string) => {
    setIsLoading(true);
    try {
      const response = await eventAPI.getScoreboard(eventId);
      setScoreboard(response);
      setViewType('scoreboard');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to fetch scoreboard', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch my stats
  const fetchMyStats = async (eventId: string) => {
    setIsLoading(true);
    try {
      const response = await eventAPI.getMyStats(eventId);
      setMyStats(response);
      setViewType('stats');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to fetch statistics', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Registration status tracking
  const [registeredEvents, setRegisteredEvents] = useState<Set<string>>(new Set());
  const [checkingRegistration, setCheckingRegistration] = useState<Set<string>>(new Set());

  // Check registration status for events
  const checkRegistrationStatus = async (eventId: string) => {
    if (checkingRegistration.has(eventId)) return;
    
    try {
      setCheckingRegistration(prev => new Set(prev).add(eventId));
      const status = await eventAPI.checkRegistrationStatus(eventId);
      if (status.is_registered) {
        setRegisteredEvents(prev => new Set(prev).add(eventId));
      }
    } catch (error: any) {
      // Silently fail - user might not be registered
      console.error('Failed to check registration status:', error);
    } finally {
      setCheckingRegistration(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [statusFilter]);

  // If user is the Event Admin for the currently-selected event, load event teams (for ban/unban UI)
  useEffect(() => {
    if (selectedEvent && isEventAdminForSelected) {
      fetchEventTeams(selectedEvent.id);
    } else {
      setEventTeams([]);
    }
  }, [selectedEvent?.id, isEventAdminForSelected]);

  // Check registration for all events on load
  useEffect(() => {
    events.forEach(event => {
      if (event.status === 'running' || event.status === 'scheduled' || event.status === 'approved') {
        checkRegistrationStatus(event.id);
      }
    });
  }, [events]);

  // Check registration for all events on load
  useEffect(() => {
    events.forEach(event => {
      if (event.status === 'running' || event.status === 'scheduled' || event.status === 'approved') {
        checkRegistrationStatus(event.id);
      }
    });
  }, [events]);

  // Register for event
  const handleRegister = async (eventId: string) => {
    try {
      await eventAPI.registerForEvent(eventId);
      setRegisteredEvents(prev => new Set(prev).add(eventId));
      showToast('Successfully joined the event! You can now see challenges.', 'success');
      fetchEvents();
      if (selectedEvent?.id === eventId) {
        fetchEventDetails(eventId);
      }
      // Trigger challenges refresh
      if (onJoinEvent) {
        onJoinEvent();
      }
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to join event', 'error');
    }
  };

  // Submit flag
  const handleSubmitFlag = async (eventId: string, challengeId: string) => {
    const flag = flagInputs[challengeId];
    if (!flag) {
      showToast('Please enter a flag', 'error');
      return;
    }

    setSubmittingFlags(new Set(Array.from(submittingFlags).concat(challengeId)));
    try {
      const response = await eventAPI.submitFlag(eventId, challengeId, flag);
      
      if (response.status === 'correct') {
        showToast(`Correct! You earned ${response.points_awarded} points!`, 'success');
        setFlagInputs({ ...flagInputs, [challengeId]: '' });
      } else if (response.status === 'already_solved') {
        showToast('You have already solved this challenge', 'info');
      } else if (response.status === 'max_attempts_reached') {
        showToast('Maximum attempts reached for this challenge', 'error');
      } else {
        showToast(response.message || 'Incorrect flag', 'error');
      }
      
      // Refresh event details
      if (selectedEvent) {
        fetchEventDetails(eventId);
        fetchMyStats(eventId);
        fetchScoreboard(eventId);
      }
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to submit flag', 'error');
    } finally {
      setSubmittingFlags(new Set(Array.from(submittingFlags).filter(id => id !== challengeId)));
    }
  };

  // Unlock hint
  const handleUnlockHint = async (eventId: string, challengeId: string, hintId: string) => {
    try {
      const response = await eventAPI.unlockHint(eventId, challengeId, hintId);
      if (response.success) {
        showToast(response.message, response.points_deducted > 0 ? 'info' : 'success');
        if (selectedEvent) {
          fetchEventDetails(eventId);
        }
      }
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to unlock hint', 'error');
    }
  };

  // Toggle challenge expansion
  const toggleChallenge = (challengeId: string) => {
    const newExpanded = new Set(expandedChallenges);
    if (newExpanded.has(challengeId)) {
      newExpanded.delete(challengeId);
    } else {
      newExpanded.add(challengeId);
    }
    setExpandedChallenges(newExpanded);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
      draft: { color: 'text-white/60', icon: Clock, label: 'Draft' },
      pending_approval: { color: 'text-neon-cyan', icon: AlertCircle, label: 'Pending' },
      approved: { color: 'text-neon-green', icon: CheckCircle, label: 'Approved' },
      scheduled: { color: 'text-neon-purple', icon: Calendar, label: 'Scheduled' },
      running: { color: 'text-neon-green', icon: Play, label: 'Live' },
      paused: { color: 'text-orange-500', icon: Pause, label: 'Paused' },
      completed: { color: 'text-white/60', icon: Trophy, label: 'Completed' },
    };

    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold ${config.color} bg-cyber-800/50 border border-current/20`}>
        <Icon size={14} />
        {config.label}
      </span>
    );
  };

  // Filter events
  const filteredEvents = events.filter((event) => {
    // Regular users should only see running events
    if (!isAdmin && event.status !== 'running') {
      return false;
    }
    
    // Admin users can filter by statusFilter
    if (isAdmin && statusFilter !== 'all' && event.status !== statusFilter) {
      return false;
    }
    
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Events List */}
      {viewType === 'list' && (
        <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-4 gradient-text">Available Events</h3>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-green/60 group-focus-within:text-neon-green transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl focus:outline-none focus:border-neon-green focus:ring-4 focus:ring-neon-green/20 text-white placeholder:text-white/30"
                />
              </div>
              {/* Only show status filter for admins */}
              {isAdmin && (
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-48 bg-cyber-800/50 border-neon-green/20 text-white"
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'running', label: 'Live' },
                    { value: 'paused', label: 'Paused' },
                    { value: 'completed', label: 'Completed' },
                  ]}
                />
              )}
              <Button
                variant="outline"
                size="md"
                onClick={fetchEvents}
                disabled={isLoading}
                className="border-neon-green/30 hover:bg-neon-green/10 text-white"
              >
                <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <div className="mb-4">
              <span className="text-white/80 font-medium">
                Total Events: <span className="text-neon-green font-bold">{filteredEvents.length}</span>
              </span>
            </div>
          </div>

          {/* Events Grid */}
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="animate-spin text-neon-green mx-auto mb-4" size={32} />
              <p className="text-white/60">Loading events...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="text-white/40 mx-auto mb-4" size={48} />
              <p className="text-white/60">No events found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEvents.map((event) => {
                const isRegistered = registeredEvents.has(event.id);
                const canJoin = (event.status === 'running' || event.status === 'scheduled' || event.status === 'approved') && !isRegistered;
                
                return (
                <div
                  key={event.id}
                  className="group bg-cyber-800/50 rounded-xl p-6 border-2 border-neon-green/20 hover:border-neon-green/50 transition-all duration-300 hover:shadow-xl hover:shadow-neon-green/20 hover:-translate-y-1 relative overflow-hidden"
                >
                  {/* Glow effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-neon-green/0 via-neon-green/5 to-neon-purple/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-white mb-2 group-hover:text-neon-green transition-colors">{event.name}</h4>
                        <p className="text-white/70 text-sm mb-3 line-clamp-2">{event.description}</p>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          {getStatusBadge(event.status)}
                          <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                            event.event_type === 'ctf' 
                              ? 'bg-neon-purple/20 text-neon-purple border-neon-purple/40 group-hover:border-neon-purple/60 group-hover:bg-neon-purple/30 transition-colors'
                              : 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 group-hover:border-neon-cyan/60 group-hover:bg-neon-cyan/30 transition-colors'
                          }`}>
                            {event.event_type.toUpperCase()}
                          </span>
                          {isRegistered && (
                            <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-neon-green/20 text-neon-green border border-neon-green/40">
                              Joined
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div className="bg-cyber-900/30 rounded-lg p-2 border border-neon-green/10">
                        <span className="text-white/60 text-xs">Start:</span>
                        <p className="text-white font-medium text-xs mt-1">{new Date(event.start_time).toLocaleString()}</p>
                      </div>
                      <div className="bg-cyber-900/30 rounded-lg p-2 border border-neon-green/10">
                        <span className="text-white/60 text-xs">Participants:</span>
                        <p className="text-white font-medium text-xs mt-1">{event.participant_count || 0}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => fetchEventDetails(event.id)}
                        className="flex-1 relative overflow-hidden group bg-gradient-to-r from-neon-green/20 to-neon-cyan/20 hover:from-neon-green/30 hover:to-neon-cyan/30 text-white border-2 border-neon-green/60 hover:border-neon-green/80 transition-all duration-300 shadow-lg shadow-neon-green/20 hover:shadow-neon-green/40 hover:shadow-xl font-bold py-3"
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2 text-white drop-shadow-[0_0_8px_rgba(34,255,134,0.5)]">
                          <Eye size={18} className="group-hover:scale-110 transition-transform drop-shadow-[0_0_4px_rgba(34,255,134,0.8)]" />
                          View Details
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-neon-green/0 via-neon-green/30 to-neon-cyan/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                      </Button>
                      {canJoin ? (
                        <Button
                          onClick={() => handleRegister(event.id)}
                          className="flex-1 relative overflow-hidden group bg-gradient-to-r from-neon-green to-neon-cyan hover:from-neon-green hover:to-neon-cyan/80 text-white border-2 border-neon-green/60 hover:border-neon-green/80 transition-all duration-300 shadow-lg shadow-neon-green/20 hover:shadow-neon-green/40 hover:shadow-xl font-bold py-3"
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2 text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]">
                            <Shield size={18} className="group-hover:scale-110 transition-transform" />
                            Join Event
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-neon-green/0 via-white/10 to-neon-cyan/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                        </Button>
                      ) : event.status === 'running' && isRegistered && (
                        <Button
                          onClick={() => fetchScoreboard(event.id)}
                          variant="outline"
                          className="relative overflow-hidden border-2 border-neon-purple/50 hover:border-neon-purple/70 bg-cyber-900/30 hover:bg-cyber-900/50 text-neon-purple hover:text-neon-purple transition-all duration-300 shadow-lg shadow-neon-purple/10 hover:shadow-neon-purple/30 px-4"
                        >
                          <Trophy size={18} className="hover:scale-110 transition-transform" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Event Details */}
      {viewType === 'details' && selectedEvent && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-white">{selectedEvent.name}</h3>
                  {getStatusBadge(selectedEvent.status)}
                </div>
                <p className="text-white/70 mb-4">{selectedEvent.description}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-white/60">Start:</span>
                    <p className="text-white font-medium">{new Date(selectedEvent.start_time).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-white/60">End:</span>
                    <p className="text-white font-medium">{new Date(selectedEvent.end_time).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-white/60">Participants:</span>
                    <p className="text-white font-medium">{selectedEvent.participant_count || 0}</p>
                  </div>
                  <div>
                    <span className="text-white/60">Challenges:</span>
                    <p className="text-white font-medium">{selectedEvent.challenges?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Admin Controls */}
            {isEventAdminForSelected && (
              <div className="mt-6 bg-cyber-800/30 border border-neon-orange/20 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                  <div>
                    <h4 className="text-lg font-bold text-white">Event Admin Controls</h4>
                    <p className="text-white/60 text-sm">
                      You are the Event Admin for this event. You can pause/resume, end, and ban/unban teams.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(selectedEvent.status === 'running' || selectedEvent.status === 'paused') && (
                      <Button
                        variant="outline"
                        onClick={() => handlePauseResumeAsEventAdmin(selectedEvent.status === 'running')}
                        className="border-neon-cyan/40 hover:bg-neon-cyan/10 text-neon-cyan"
                      >
                        {selectedEvent.status === 'running' ? (
                          <>
                            <Pause size={16} className="mr-2" /> Pause
                          </>
                        ) : (
                          <>
                            <Play size={16} className="mr-2" /> Resume
                          </>
                        )}
                      </Button>
                    )}
                    {(selectedEvent.status === 'running' || selectedEvent.status === 'paused') && (
                      <Button
                        variant="outline"
                        onClick={handleEndAsEventAdmin}
                        className="border-neon-orange/40 hover:bg-neon-orange/10 text-neon-orange"
                      >
                        <XCircle size={16} className="mr-2" /> End Event
                      </Button>
                    )}
                  </div>
                </div>

                {/* Team Ban/Unban */}
                {selectedEvent.participation_type === 'team_based' && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-white font-semibold">Teams in this event</h5>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchEventTeams(selectedEvent.id)}
                        className="border-neon-green/30 hover:bg-neon-green/10 text-white"
                      >
                        <RefreshCw size={14} className={`mr-2 ${isLoadingEventTeams ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                    {isLoadingEventTeams ? (
                      <p className="text-white/60 text-sm">Loading teams...</p>
                    ) : eventTeams.length === 0 ? (
                      <p className="text-white/60 text-sm">No teams registered yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {eventTeams.map((t) => (
                          <div
                            key={t.team_id}
                            className="flex items-center justify-between gap-3 p-3 bg-cyber-900/40 border border-neon-green/10 rounded-xl"
                          >
                            <div className="min-w-0">
                              <div className="text-white font-medium truncate">{t.team_name || t.team_id}</div>
                              <div className="text-xs text-white/50">{t.team_id}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {t.banned ? (
                                <span className="text-xs font-semibold text-neon-orange bg-neon-orange/10 border border-neon-orange/30 px-2 py-1 rounded-full">
                                  Banned
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-neon-green bg-neon-green/10 border border-neon-green/30 px-2 py-1 rounded-full">
                                  Active
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleBanTeam(t.team_id, !t.banned)}
                                className={`border-2 ${
                                  t.banned
                                    ? 'border-neon-green/40 hover:bg-neon-green/10 text-neon-green'
                                    : 'border-neon-orange/40 hover:bg-neon-orange/10 text-neon-orange'
                                }`}
                              >
                                {t.banned ? 'Unban' : 'Ban'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setViewType('list')}
                variant="outline"
                className="relative overflow-hidden group border-2 border-neon-green/40 hover:border-neon-green/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-white hover:text-neon-green transition-all duration-300 shadow-lg shadow-neon-green/10 hover:shadow-neon-green/20 font-semibold"
              >
                <span className="relative z-10 flex items-center gap-2">
                  ← Back to Events
                </span>
              </Button>
              {selectedEvent.status === 'running' && (
                <>
                  <Button
                    onClick={() => fetchScoreboard(selectedEvent.id)}
                    variant="outline"
                    className="relative overflow-hidden group border-2 border-neon-purple/40 hover:border-neon-purple/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-neon-purple hover:text-neon-purple transition-all duration-300 shadow-lg shadow-neon-purple/10 hover:shadow-neon-purple/20 font-semibold"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Trophy size={18} className="group-hover:scale-110 transition-transform" />
                      Scoreboard
                    </span>
                  </Button>
                  <Button
                    onClick={() => fetchMyStats(selectedEvent.id)}
                    variant="outline"
                    className="relative overflow-hidden group border-2 border-neon-cyan/40 hover:border-neon-cyan/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-neon-cyan hover:text-neon-cyan transition-all duration-300 shadow-lg shadow-neon-cyan/10 hover:shadow-neon-cyan/20 font-semibold"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <BarChart3 size={18} className="group-hover:scale-110 transition-transform" />
                      My Stats
                    </span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Challenges */}
          {selectedEvent.challenges && selectedEvent.challenges.length > 0 && (
            <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6">
              <h4 className="text-xl font-bold text-white mb-4 gradient-text">Challenges</h4>
              <div className="space-y-4">
                {selectedEvent.challenges
                  .filter((ch) => ch.visibility === 'visible')
                  .map((challenge) => (
                    <div
                      key={challenge.challenge_id}
                      className="bg-cyber-800/50 rounded-xl p-4 border border-neon-green/20 hover:border-neon-green/40 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="text-lg font-bold text-white">{challenge.challenge_name}</h5>
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-neon-purple/20 text-neon-purple border border-neon-purple/30">
                              {challenge.points} pts
                            </span>
                            <span className="text-white/60 text-sm">{challenge.challenge_category}</span>
                          </div>
                          <p className="text-white/70 text-sm">{challenge.description}</p>
                          {!challenge.is_unlocked && (
                            <p className="text-orange-500 text-sm mt-2 flex items-center gap-1">
                              <Shield size={14} />
                              Locked - Solve previous challenges to unlock
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={() => toggleChallenge(challenge.challenge_id)}
                          variant="outline"
                          size="sm"
                          className="border-neon-green/30 hover:bg-neon-green/10 text-white"
                        >
                          {expandedChallenges.has(challenge.challenge_id) ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </Button>
                      </div>

                      {expandedChallenges.has(challenge.challenge_id) && (
                        <div className="mt-4 pt-4 border-t border-neon-green/20 space-y-4">
                          {/* Flag Submission */}
                          <div>
                            <label className="block text-sm font-semibold text-white/90 mb-2">Submit Flag</label>
                            <div className="flex gap-2">
                              <Input
                                value={flagInputs[challenge.challenge_id] || ''}
                                onChange={(e) => setFlagInputs({ ...flagInputs, [challenge.challenge_id]: e.target.value })}
                                placeholder="FLAG{...}"
                                className="flex-1 bg-cyber-800/50 border-neon-green/20 text-white"
                                disabled={submittingFlags.has(challenge.challenge_id) || !challenge.is_unlocked}
                              />
                              <Button
                                onClick={() => handleSubmitFlag(selectedEvent.id, challenge.challenge_id)}
                                disabled={submittingFlags.has(challenge.challenge_id) || !challenge.is_unlocked}
                                className="relative overflow-hidden group bg-cyber-800/50 hover:bg-cyber-800/70 disabled:bg-cyber-800/30 disabled:opacity-50 text-neon-green border-2 border-neon-green/40 hover:border-neon-green/60 disabled:border-neon-green/20 transition-all duration-300 shadow-lg shadow-neon-green/10 hover:shadow-neon-green/20 disabled:shadow-none font-semibold"
                              >
                                <span className="relative z-10">
                                  {submittingFlags.has(challenge.challenge_id) ? (
                                    <RefreshCw size={18} className="animate-spin" />
                                  ) : (
                                    <Flag size={18} className="group-hover:scale-110 transition-transform" />
                                  )}
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-neon-green/0 via-neon-green/10 to-neon-green/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                              </Button>
                            </div>
                          </div>

                          {/* Hints */}
                          {challenge.hints && challenge.hints.length > 0 && (
                            <div>
                              <label className="block text-sm font-semibold text-white/90 mb-2">Hints</label>
                              <div className="space-y-2">
                                {challenge.hints.map((hint) => {
                                  const isUnlocked = hint.unlocked_by && hint.unlocked_by.length > 0;
                                  return (
                                    <div
                                      key={hint.id}
                                      className="flex items-center justify-between p-3 bg-cyber-900/50 rounded-lg border border-neon-cyan/10"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Lightbulb className="text-neon-cyan" size={16} />
                                        <span className="text-white/80 text-sm">
                                          Hint {hint.order}
                                          {hint.cost > 0 && (
                                            <span className="text-orange-500 ml-2">-{hint.cost} points</span>
                                          )}
                                        </span>
                                      </div>
                                      {isUnlocked ? (
                                        <div className="text-neon-green text-sm">
                                          <span className="text-white/60">{hint.content}</span>
                                        </div>
                                      ) : (
                                        <Button
                                          onClick={() => handleUnlockHint(selectedEvent.id, challenge.challenge_id, hint.id)}
                                          size="sm"
                                          variant="outline"
                                          className="relative overflow-hidden group border-2 border-neon-cyan/40 hover:border-neon-cyan/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-neon-cyan hover:text-neon-cyan transition-all duration-300 shadow-md shadow-neon-cyan/10 hover:shadow-neon-cyan/20 font-semibold text-xs"
                                        >
                                          <span className="relative z-10">Unlock</span>
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Register Button (if not registered) */}
          {selectedEvent.status === 'approved' || selectedEvent.status === 'scheduled' ? (
            <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6 text-center">
              <Button
                onClick={() => handleRegister(selectedEvent.id)}
                className="relative overflow-hidden group bg-cyber-800/50 hover:bg-cyber-800/70 text-neon-green border-2 border-neon-green/40 hover:border-neon-green/60 transition-all duration-300 shadow-lg shadow-neon-green/10 hover:shadow-neon-green/20 font-semibold px-8 py-4"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Shield size={20} className="group-hover:scale-110 transition-transform" />
                  Register for Event
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-neon-green/0 via-neon-green/10 to-neon-green/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* Scoreboard */}
      {viewType === 'scoreboard' && selectedEvent && (
        <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white gradient-text">
              Scoreboard - {selectedEvent.name}
            </h3>
            <Button
              onClick={() => setViewType('details')}
              variant="outline"
              className="relative overflow-hidden group border-2 border-neon-green/40 hover:border-neon-green/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-white hover:text-neon-green transition-all duration-300 shadow-lg shadow-neon-green/10 hover:shadow-neon-green/20 font-semibold"
            >
              <span className="relative z-10">← Back</span>
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="animate-spin text-neon-green mx-auto mb-4" size={32} />
              <p className="text-white/60">Loading scoreboard...</p>
            </div>
          ) : scoreboard ? (
            <div className="overflow-x-auto border border-neon-green/20 rounded-xl">
              <table className="w-full">
                <thead className="bg-cyber-800/50 border-b border-neon-green/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Rank</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                      {selectedEvent.participation_type === 'team_based' ? 'Team' : 'User'}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Points</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Solved</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">First Bloods</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreboard.scoreboard?.map((entry: any, index: number) => (
                    <tr
                      key={entry.participant_id}
                      className={`border-b border-neon-green/10 hover:bg-cyber-800/30 transition-colors ${
                        index < 3 ? 'bg-neon-green/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Trophy className="text-yellow-500" size={18} />}
                          {index === 1 && <Trophy className="text-gray-400" size={18} />}
                          {index === 2 && <Trophy className="text-orange-600" size={18} />}
                          <span className="text-white font-bold">{entry.rank}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{entry.participant_name}</td>
                      <td className="px-4 py-3 text-neon-green font-bold">{entry.total_points}</td>
                      <td className="px-4 py-3 text-white/80">{entry.challenges_solved}</td>
                      <td className="px-4 py-3 text-neon-purple">{entry.first_bloods || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-white/60">No scoreboard data available</p>
            </div>
          )}
        </div>
      )}

      {/* My Stats */}
      {viewType === 'stats' && selectedEvent && (
        <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white gradient-text">My Statistics</h3>
            <Button
              onClick={() => setViewType('details')}
              variant="outline"
              className="relative overflow-hidden group border-2 border-neon-green/40 hover:border-neon-green/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-white hover:text-neon-green transition-all duration-300 shadow-lg shadow-neon-green/10 hover:shadow-neon-green/20 font-semibold"
            >
              <span className="relative z-10">← Back</span>
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="animate-spin text-neon-green mx-auto mb-4" size={32} />
              <p className="text-white/60">Loading statistics...</p>
            </div>
          ) : myStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-cyber-800/50 rounded-xl p-4 border border-neon-green/20">
                <div className="text-white/60 text-sm mb-1">Total Points</div>
                <div className="text-2xl font-bold text-neon-green">{myStats.total_points || 0}</div>
              </div>
              <div className="bg-cyber-800/50 rounded-xl p-4 border border-neon-green/20">
                <div className="text-white/60 text-sm mb-1">Challenges Solved</div>
                <div className="text-2xl font-bold text-white">{myStats.challenges_solved || 0}</div>
              </div>
              <div className="bg-cyber-800/50 rounded-xl p-4 border border-neon-green/20">
                <div className="text-white/60 text-sm mb-1">First Bloods</div>
                <div className="text-2xl font-bold text-neon-purple">{myStats.first_bloods || 0}</div>
              </div>
              <div className="bg-cyber-800/50 rounded-xl p-4 border border-neon-green/20">
                <div className="text-white/60 text-sm mb-1">Total Submissions</div>
                <div className="text-2xl font-bold text-white">{myStats.total_submissions || 0}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-white/60">No statistics available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

