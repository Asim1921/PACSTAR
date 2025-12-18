'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  List, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play, 
  Pause, 
  Square, 
  Send,
  Eye,
  EyeOff,
  RefreshCw,
  Trophy,
  Users,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Calendar as CalendarIcon,
  Target,
  Zap,
  BarChart3,
  X,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { InfoBox } from '@/components/ui/InfoBox';
import { eventAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

type EventAction = 'list' | 'create' | 'pending' | 'edit' | 'view' | 'stats';
type EventStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
type EventType = 'ctf' | 'cyber_exercise';
type ParticipationType = 'user_based' | 'team_based';

interface Event {
  id: string;
  name: string;
  description: string;
  event_type: EventType;
  participation_type: ParticipationType;
  zone: string;
  status: EventStatus;
  start_time: string;
  end_time: string;
  max_participants?: number;
  is_public: boolean;
  participant_count: number;
  challenge_count?: number;
  created_by_username: string;
  created_at: string;
}

export const Events: React.FC = () => {
  const { showToast } = useToast();
  const [activeAction, setActiveAction] = useState<EventAction>('list');
  const [events, setEvents] = useState<Event[]>([]);
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  
  // Create event form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    event_type: 'ctf' as EventType,
    participation_type: 'team_based' as ParticipationType,
    zone: '',
    start_time: '',
    end_time: '',
    max_participants: '',
    is_public: false,
  });
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [availableChallenges, setAvailableChallenges] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventStats, setEventStats] = useState<any>(null);
  const [eventScoreboard, setEventScoreboard] = useState<any>(null);
  const [eventDetails, setEventDetails] = useState<any>(null);
  const [challengeConfigs, setChallengeConfigs] = useState<Record<string, any>>({});

  // Fetch events
  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const filters: any = {};
      if (statusFilter !== 'all') filters.status_filter = statusFilter;
      if (eventTypeFilter !== 'all') filters.event_type = eventTypeFilter;
      
      const response = await eventAPI.listEvents(filters);
      setEvents(response.events || []);
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to fetch events', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch pending approvals
  const fetchPendingApprovals = async () => {
    setIsLoading(true);
    try {
      const response = await eventAPI.getPendingApprovals();
      setPendingEvents(Array.isArray(response) ? response : []);
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to fetch pending approvals', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch available challenges
  const fetchAvailableChallenges = async () => {
    try {
      const response = await eventAPI.getAvailableChallenges();
      setAvailableChallenges(Array.isArray(response) ? response : []);
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to fetch available challenges', 'error');
    }
  };

  useEffect(() => {
    if (activeAction === 'list') {
      fetchEvents();
    } else if (activeAction === 'pending') {
      fetchPendingApprovals();
    } else if (activeAction === 'create') {
      fetchAvailableChallenges();
    }
  }, [activeAction, statusFilter, eventTypeFilter]);

  // Create event (creates as draft, then submits for approval)
  const handleCreateEvent = async () => {
    if (!formData.name || !formData.description || !formData.zone || !formData.start_time || !formData.end_time) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create event as draft first
      const eventData = {
        ...formData,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : undefined,
        challenges: selectedChallenges.map((challengeId) => ({
          challenge_id: challengeId,
          visibility: 'visible',
          order: 1,
        })),
      };

      const response = await eventAPI.createEvent(eventData);
      
      // Automatically submit for approval
      if (response.id) {
        try {
          await eventAPI.submitForApproval(response.id);
          showToast('Event created and submitted for approval!', 'success');
        } catch (approvalError: any) {
          // If submission fails, still show success for creation
          console.error('Failed to submit for approval:', approvalError);
          showToast('Event created as draft. Please submit for approval manually.', 'info');
        }
      } else {
        showToast('Event created successfully!', 'success');
      }
      
      setActiveAction('pending'); // Show pending approvals
      setFormData({
        name: '',
        description: '',
        event_type: 'ctf',
        participation_type: 'team_based',
        zone: '',
        start_time: '',
        end_time: '',
        max_participants: '',
        is_public: false,
      });
      setSelectedChallenges([]);
      setChallengeConfigs({});
      
      // Fetch pending approvals to show the new event
      if (activeAction === 'create') {
        setActiveAction('pending');
        fetchPendingApprovals();
      } else {
        fetchEvents();
      }
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to create event', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle event actions
  const handleSubmitForApproval = async (eventId: string) => {
    try {
      await eventAPI.submitForApproval(eventId);
      showToast('Event submitted for approval', 'success');
      fetchEvents();
      fetchPendingApprovals();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to submit for approval', 'error');
    }
  };

  const handleApproveEvent = async (eventId: string, approved: boolean) => {
    try {
      await eventAPI.approveEvent(eventId, approved, approved ? 'Approved' : 'Rejected');
      showToast(`Event ${approved ? 'approved' : 'rejected'} successfully`, 'success');
      fetchPendingApprovals();
      fetchEvents();
    } catch (error: any) {
      showToast(error.response?.data?.detail || `Failed to ${approved ? 'approve' : 'reject'} event`, 'error');
    }
  };

  const handleStartEvent = async (eventId: string) => {
    try {
      await eventAPI.startEvent(eventId);
      showToast('Event started successfully', 'success');
      fetchEvents();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to start event', 'error');
    }
  };

  const handlePauseEvent = async (eventId: string, paused: boolean) => {
    try {
      await eventAPI.pauseEvent(eventId, paused, paused ? 'Paused by admin' : 'Resumed by admin');
      showToast(`Event ${paused ? 'paused' : 'resumed'} successfully`, 'success');
      fetchEvents();
    } catch (error: any) {
      showToast(error.response?.data?.detail || `Failed to ${paused ? 'pause' : 'resume'} event`, 'error');
    }
  };

  const handleEndEvent = async (eventId: string) => {
    try {
      await eventAPI.endEvent(eventId);
      showToast('Event ended successfully', 'success');
      fetchEvents();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to end event', 'error');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }

    try {
      await eventAPI.deleteEvent(eventId);
      showToast('Event deleted successfully', 'success');
      fetchEvents();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to delete event', 'error');
    }
  };

  // View event details
  const handleViewEvent = async (eventId: string) => {
    setIsLoading(true);
    try {
      const event = await eventAPI.getEvent(eventId);
      setEventDetails(event);
      setSelectedEvent(event);
      
      // Fetch stats if event is running
      if (event.status === 'running' || event.status === 'paused') {
        try {
          const stats = await eventAPI.getLiveStats(eventId);
          setEventStats(stats);
          const scoreboard = await eventAPI.getScoreboard(eventId);
          setEventScoreboard(scoreboard);
        } catch (err) {
          console.error('Failed to fetch stats:', err);
        }
      }
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to fetch event details', 'error');
      setSelectedEvent(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Close event details modal
  const handleCloseEventModal = () => {
    setSelectedEvent(null);
    setEventDetails(null);
    setEventStats(null);
    setEventScoreboard(null);
  };

  // Edit event
  const handleEditEvent = async (event: Event) => {
    setEditingEventId(event.id);
    setFormData({
      name: event.name,
      description: event.description,
      event_type: event.event_type,
      participation_type: event.participation_type,
      zone: event.zone,
      start_time: new Date(event.start_time).toISOString().slice(0, 16),
      end_time: new Date(event.end_time).toISOString().slice(0, 16),
      max_participants: event.max_participants?.toString() || '',
      is_public: event.is_public,
    });
    
    // Fetch event details to get challenges
    try {
      const eventDetails = await eventAPI.getEvent(event.id);
      if (eventDetails.challenges) {
        setSelectedChallenges(eventDetails.challenges.map((c: any) => c.challenge_id));
        const configs: Record<string, any> = {};
        eventDetails.challenges.forEach((c: any) => {
          configs[c.challenge_id] = {
            points_override: c.points_override,
            order: c.order || 1,
            visibility: c.visibility || 'visible',
            max_attempts: c.max_attempts,
          };
        });
        setChallengeConfigs(configs);
      }
      fetchAvailableChallenges();
      setActiveAction('edit');
    } catch (error: any) {
      showToast('Failed to load event details', 'error');
    }
  };

  // Update event
  const handleUpdateEvent = async () => {
    if (!editingEventId) return;
    
    if (!formData.name || !formData.description || !formData.zone || !formData.start_time || !formData.end_time) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData = {
        name: formData.name,
        description: formData.description,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : undefined,
        is_public: formData.is_public,
      };

      await eventAPI.updateEvent(editingEventId, updateData);
      showToast('Event updated successfully!', 'success');
      setActiveAction('list');
      setEditingEventId(null);
      setFormData({
        name: '',
        description: '',
        event_type: 'ctf',
        participation_type: 'team_based',
        zone: '',
        start_time: '',
        end_time: '',
        max_participants: '',
        is_public: false,
      });
      setSelectedChallenges([]);
      setChallengeConfigs({});
      fetchEvents();
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to update event', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update challenge visibility
  const handleUpdateChallengeVisibility = async (eventId: string, challengeId: string, visibility: 'visible' | 'hidden') => {
    try {
      await eventAPI.updateChallengeVisibility(eventId, challengeId, visibility);
      showToast(`Challenge ${visibility === 'visible' ? 'shown' : 'hidden'} successfully`, 'success');
      if (selectedEvent) {
        handleViewEvent(eventId);
      }
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to update challenge visibility', 'error');
    }
  };

  // Filter events
  const filteredEvents = events.filter((event) => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Get status badge
  const getStatusBadge = (status: EventStatus) => {
    const statusConfig: Record<EventStatus, { color: string; icon: any; label: string }> = {
      draft: { color: 'text-white/60', icon: Clock, label: 'Draft' },
      pending_approval: { color: 'text-neon-cyan', icon: AlertCircle, label: 'Pending Approval' },
      approved: { color: 'text-neon-green', icon: CheckCircle, label: 'Approved' },
      rejected: { color: 'text-red-500', icon: XCircle, label: 'Rejected' },
      scheduled: { color: 'text-neon-purple', icon: CalendarIcon, label: 'Scheduled' },
      running: { color: 'text-neon-green', icon: Play, label: 'Live' },
      paused: { color: 'text-orange-500', icon: Pause, label: 'Paused' },
      completed: { color: 'text-white/60', icon: CheckCircle2, label: 'Completed' },
      cancelled: { color: 'text-red-500', icon: XCircle, label: 'Cancelled' },
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

  return (
    <div className="space-y-6">
      {/* Action Tabs */}
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 p-2 terminal-border">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'list', label: 'All Events', icon: List },
            { id: 'create', label: 'Create Event', icon: Plus },
            { id: 'pending', label: 'Pending Approvals', icon: Send },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveAction(tab.id as EventAction)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all relative overflow-hidden ${
                  activeAction === tab.id
                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-lg shadow-neon-green/20'
                    : 'text-white/60 hover:text-white hover:bg-cyber-800/50'
                }`}
              >
                {activeAction === tab.id && (
                  <div className="absolute inset-0 bg-neon-green/10 animate-pulse" />
                )}
                <Icon size={18} className="relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List Events */}
      {activeAction === 'list' && (
        <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-4 gradient-text">All Events</h3>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center">
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
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-48 bg-cyber-800/50 border-neon-green/20 text-white"
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'pending_approval', label: 'Pending Approval' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'running', label: 'Live' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'completed', label: 'Completed' },
                ]}
              />
              <Select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="w-full sm:w-48 bg-cyber-800/50 border-neon-green/20 text-white"
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'ctf', label: 'CTF' },
                  { value: 'cyber_exercise', label: 'Cyber Exercise' },
                ]}
              />
              <Button
                variant="outline"
                onClick={fetchEvents}
                disabled={isLoading}
                className="border-neon-green/30 hover:bg-neon-green/10 text-white w-full sm:w-auto sm:flex-shrink-0 h-[48px] flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </Button>
            </div>

            <div className="mb-4">
              <span className="text-white/80 font-medium">
                Total Events: <span className="text-neon-green font-bold">{filteredEvents.length}</span>
              </span>
            </div>
          </div>

          {/* Events Table */}
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
            <div className="overflow-x-auto border border-neon-green/20 rounded-xl">
              <table className="w-full">
                <thead className="bg-cyber-800/50 border-b border-neon-green/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Zone</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Start Time</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Participants</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-neon-green/10 hover:bg-cyber-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white font-medium">{event.name}</p>
                          <p className="text-white/60 text-xs mt-1 line-clamp-1">{event.description}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          event.event_type === 'ctf' 
                            ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                            : 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                        }`}>
                          {event.event_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(event.status)}</td>
                      <td className="px-4 py-3 text-white/80">{event.zone}</td>
                      <td className="px-4 py-3 text-white/80 text-sm">
                        {new Date(event.start_time).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-white/80">
                        {event.participant_count || 0}
                        {event.max_participants && ` / ${event.max_participants}`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {event.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSubmitForApproval(event.id)}
                              className="relative overflow-hidden group border-2 border-neon-cyan/40 hover:border-neon-cyan/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-neon-cyan hover:text-neon-cyan transition-all duration-300 shadow-md shadow-neon-cyan/10 hover:shadow-neon-cyan/20 font-semibold text-xs"
                            >
                              <span className="relative z-10 flex items-center gap-1">
                                <Send size={14} className="group-hover:scale-110 transition-transform" />
                                Submit
                              </span>
                            </Button>
                          )}
                          {event.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartEvent(event.id)}
                              className="relative overflow-hidden group border-2 border-neon-green/40 hover:border-neon-green/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-neon-green hover:text-neon-green transition-all duration-300 shadow-md shadow-neon-green/10 hover:shadow-neon-green/20 font-semibold text-xs"
                            >
                              <span className="relative z-10 flex items-center gap-1">
                                <Play size={14} className="group-hover:scale-110 transition-transform" />
                                Start
                              </span>
                            </Button>
                          )}
                          {event.status === 'running' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePauseEvent(event.id, true)}
                                className="relative overflow-hidden group border-2 border-orange-500/40 hover:border-orange-500/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-orange-400 hover:text-orange-300 transition-all duration-300 shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 font-semibold text-xs"
                              >
                                <span className="relative z-10 flex items-center gap-1">
                                  <Pause size={14} className="group-hover:scale-110 transition-transform" />
                                  Pause
                                </span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEndEvent(event.id)}
                                className="relative overflow-hidden group border-2 border-red-500/40 hover:border-red-500/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-red-400 hover:text-red-300 transition-all duration-300 shadow-md shadow-red-500/10 hover:shadow-red-500/20 font-semibold text-xs"
                              >
                                <span className="relative z-10 flex items-center gap-1">
                                  <Square size={14} className="group-hover:scale-110 transition-transform" />
                                  End
                                </span>
                              </Button>
                            </>
                          )}
                          {event.status === 'paused' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePauseEvent(event.id, false)}
                              className="relative overflow-hidden group border-2 border-neon-green/40 hover:border-neon-green/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-neon-green hover:text-neon-green transition-all duration-300 shadow-md shadow-neon-green/10 hover:shadow-neon-green/20 font-semibold text-xs"
                            >
                              <span className="relative z-10 flex items-center gap-1">
                                <Play size={14} className="group-hover:scale-110 transition-transform" />
                                Resume
                              </span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewEvent(event.id)}
                            className="relative overflow-hidden group border-2 border-neon-cyan/40 hover:border-neon-cyan/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-neon-cyan hover:text-neon-cyan transition-all duration-300 shadow-md shadow-neon-cyan/10 hover:shadow-neon-cyan/20 font-semibold text-xs"
                          >
                            <span className="relative z-10">
                              <Eye size={14} className="group-hover:scale-110 transition-transform" />
                            </span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditEvent(event)}
                            className="relative overflow-hidden group border-2 border-neon-green/40 hover:border-neon-green/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-neon-green hover:text-neon-green transition-all duration-300 shadow-md shadow-neon-green/10 hover:shadow-neon-green/20 font-semibold text-xs"
                          >
                            <span className="relative z-10">
                              <Edit size={14} className="group-hover:scale-110 transition-transform" />
                            </span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteEvent(event.id)}
                            className="relative overflow-hidden group border-2 border-red-500/40 hover:border-red-500/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-red-400 hover:text-red-300 transition-all duration-300 shadow-md shadow-red-500/10 hover:shadow-red-500/20 font-semibold text-xs"
                          >
                            <span className="relative z-10">
                              <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                            </span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Event */}
      {(activeAction === 'create' || activeAction === 'edit') && (
        <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6">
          <h3 className="text-xl font-bold text-white mb-6 gradient-text">
            {editingEventId ? 'Edit Event' : 'Create New Event'}
          </h3>
          
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">Event Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter Event Name Here"
                  className="bg-cyber-800/50 border-neon-green/20 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">Zone *</label>
                <Input
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  placeholder="zone1"
                  className="bg-cyber-800/50 border-neon-green/20 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/90 mb-2">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Event description..."
                rows={4}
                className="w-full px-4 py-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl focus:outline-none focus:border-neon-green focus:ring-4 focus:ring-neon-green/20 text-white placeholder:text-white/30 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">Event Type *</label>
                <Select
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value as EventType })}
                  className="bg-cyber-800/50 border-neon-green/20 text-white"
                  options={[
                    { value: 'ctf', label: 'CTF' },
                    { value: 'cyber_exercise', label: 'Cyber Exercise' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">Participation Type *</label>
                <Select
                  value={formData.participation_type}
                  onChange={(e) => setFormData({ ...formData, participation_type: e.target.value as ParticipationType })}
                  className="bg-cyber-800/50 border-neon-green/20 text-white"
                  options={[
                    { value: 'user_based', label: 'User Based' },
                    { value: 'team_based', label: 'Team Based' },
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">Start Time *</label>
                <Input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="bg-cyber-800/50 border-neon-green/20 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">End Time *</label>
                <Input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="bg-cyber-800/50 border-neon-green/20 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">Max Participants</label>
                <Input
                  type="number"
                  value={formData.max_participants}
                  onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  className="bg-cyber-800/50 border-neon-green/20 text-white"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_public}
                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    className="w-5 h-5 rounded border-neon-green/30 bg-cyber-800/50 text-neon-green focus:ring-neon-green/20"
                  />
                  <span className="text-white/90 font-semibold">Public Event</span>
                </label>
              </div>
            </div>

            {/* Challenges Selection */}
            <div>
              <label className="block text-sm font-semibold text-white/90 mb-2">Select Challenges</label>
              <div className="bg-cyber-800/30 rounded-xl p-4 border border-neon-green/20 max-h-60 overflow-y-auto">
                {availableChallenges.length === 0 ? (
                  <p className="text-white/60 text-center py-4">No challenges available</p>
                ) : (
                  <div className="space-y-2">
                    {availableChallenges.map((challenge) => (
                      <label key={challenge.id} className="flex items-center gap-3 p-3 bg-cyber-900/50 rounded-lg hover:bg-cyber-900/70 cursor-pointer border border-neon-green/10 hover:border-neon-green/30 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedChallenges.includes(challenge.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedChallenges([...selectedChallenges, challenge.id]);
                            } else {
                              setSelectedChallenges(selectedChallenges.filter((id) => id !== challenge.id));
                            }
                          }}
                          className="w-5 h-5 rounded border-neon-green/30 bg-cyber-800/50 text-neon-green focus:ring-neon-green/20"
                        />
                        <div className="flex-1">
                          <p className="text-white font-medium">{challenge.name}</p>
                          <p className="text-white/60 text-xs">{challenge.category} • {challenge.points} points</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={editingEventId ? handleUpdateEvent : handleCreateEvent}
                disabled={isSubmitting}
                className="relative overflow-hidden group bg-gradient-to-r from-neon-green/20 to-neon-cyan/20 hover:from-neon-green/30 hover:to-neon-cyan/30 disabled:from-neon-green/10 disabled:to-neon-cyan/10 disabled:opacity-50 text-white border-2 border-neon-green/60 hover:border-neon-green/80 disabled:border-neon-green/30 transition-all duration-300 shadow-lg shadow-neon-green/20 hover:shadow-neon-green/40 hover:shadow-xl disabled:shadow-none font-bold px-8 py-3"
              >
                <span className="relative z-10 flex items-center gap-2 text-white drop-shadow-[0_0_8px_rgba(34,255,134,0.6)]">
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={18} className="animate-spin drop-shadow-[0_0_4px_rgba(34,255,134,0.8)]" />
                      {editingEventId ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingEventId ? (
                        <>
                          <Edit size={18} className="group-hover:scale-110 transition-transform drop-shadow-[0_0_4px_rgba(34,255,134,0.8)]" />
                          Update Event
                        </>
                      ) : (
                        <>
                          <Plus size={18} className="group-hover:scale-110 transition-transform drop-shadow-[0_0_4px_rgba(34,255,134,0.8)]" />
                          Create Event
                        </>
                      )}
                    </>
                  )}
                </span>
                {!isSubmitting && (
                  <div className="absolute inset-0 bg-gradient-to-r from-neon-green/0 via-neon-green/20 to-neon-cyan/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveAction('list')}
                className="relative overflow-hidden group border-2 border-neon-green/40 hover:border-neon-green/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-white hover:text-neon-green transition-all duration-300 shadow-lg shadow-neon-green/10 hover:shadow-neon-green/20 font-semibold"
              >
                <span className="relative z-10">Cancel</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-cyber-900/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 lg:p-8 border border-neon-green/20 terminal-border relative z-10 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 backdrop-blur-sm rounded-xl flex items-center justify-center border ${
                  selectedEvent.event_type === 'ctf' 
                    ? 'bg-neon-purple/20 border-neon-purple/40' 
                    : 'bg-neon-cyan/20 border-neon-cyan/40'
                }`}>
                  <Calendar className={selectedEvent.event_type === 'ctf' ? 'text-neon-purple' : 'text-neon-cyan'} size={24} />
                </div>
                <div>
                  <h2 className="text-xl lg:text-2xl font-bold text-white gradient-text">
                    {selectedEvent.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(selectedEvent.status)}
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      selectedEvent.event_type === 'ctf' 
                        ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                        : 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                    }`}>
                      {selectedEvent.event_type.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseEventModal}
                className="p-2 text-white/60 hover:text-white hover:bg-cyber-800/50 rounded-lg border border-neon-green/20 hover:border-neon-green/40 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="animate-spin text-neon-green mx-auto mb-4" size={32} />
                <p className="text-white/60">Loading event details...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-white/90 mb-2">Description</label>
                    <div className="p-4 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white/80 text-sm">
                      {selectedEvent.description || 'No description provided'}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-2">Zone</label>
                      <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white/80 font-mono">
                        {selectedEvent.zone}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-2">Participation Type</label>
                      <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white/80 font-mono capitalize">
                        {selectedEvent.participation_type.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Time Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-white/90 mb-2">Start Time</label>
                    <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white/80">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="text-neon-green" size={16} />
                        <span>{new Date(selectedEvent.start_time).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-white/90 mb-2">End Time</label>
                    <div className="p-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white/80">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="text-neon-green" size={16} />
                        <span>{new Date(selectedEvent.end_time).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Participants and Other Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl">
                    <label className="block text-xs font-semibold text-white/60 mb-1">Participants</label>
                    <div className="flex items-center gap-2">
                      <Users className="text-neon-green" size={16} />
                      <span className="text-white font-bold">
                        {selectedEvent.participant_count || 0}
                        {selectedEvent.max_participants && ` / ${selectedEvent.max_participants}`}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl">
                    <label className="block text-xs font-semibold text-white/60 mb-1">Visibility</label>
                    <div className="text-white font-mono text-sm">
                      {selectedEvent.is_public ? 'Public' : 'Private'}
                    </div>
                  </div>
                  <div className="p-4 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl">
                    <label className="block text-xs font-semibold text-white/60 mb-1">Created By</label>
                    <div className="text-white/80 font-mono text-sm truncate">
                      {selectedEvent.created_by_username || 'N/A'}
                    </div>
                  </div>
                  <div className="p-4 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl">
                    <label className="block text-xs font-semibold text-white/60 mb-1">Challenges</label>
                    <div className="flex items-center gap-2">
                      <Trophy className="text-neon-green" size={16} />
                      <span className="text-white font-bold">
                        {eventDetails?.challenges?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Challenges List */}
                {eventDetails?.challenges && eventDetails.challenges.length > 0 && (
                  <div className="pt-6 border-t border-neon-green/20">
                    <h3 className="text-base font-mono font-bold text-neon-green tracking-wider mb-4">
                      Event Challenges
                    </h3>
                    <div className="space-y-3">
                      {eventDetails.challenges.map((challenge: any, index: number) => (
                        <div
                          key={challenge.challenge_id || index}
                          className="p-4 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl hover:border-neon-green/40 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Trophy className="text-neon-green" size={16} />
                                <span className="text-white font-semibold">
                                  {challenge.challenge_name || `Challenge ${index + 1}`}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  challenge.visibility === 'visible'
                                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                }`}>
                                  {challenge.visibility === 'visible' ? 'Visible' : 'Hidden'}
                                </span>
                              </div>
                              {challenge.points_override && (
                                <div className="text-white/60 text-xs ml-6">
                                  Points: {challenge.points_override}
                                </div>
                              )}
                            </div>
                            {(selectedEvent.status === 'running' || selectedEvent.status === 'paused') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateChallengeVisibility(
                                  selectedEvent.id,
                                  challenge.challenge_id,
                                  challenge.visibility === 'visible' ? 'hidden' : 'visible'
                                )}
                                className={`border-2 font-semibold text-xs ${
                                  challenge.visibility === 'visible'
                                    ? 'border-orange-500/40 hover:border-orange-500/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-orange-400 hover:text-orange-300'
                                    : 'border-neon-green/40 hover:border-neon-green/60 bg-cyber-800/30 hover:bg-cyber-800/50 text-neon-green hover:text-neon-green'
                                }`}
                              >
                                {challenge.visibility === 'visible' ? (
                                  <>
                                    <EyeOff size={14} className="mr-1" />
                                    Hide
                                  </>
                                ) : (
                                  <>
                                    <Eye size={14} className="mr-1" />
                                    Show
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Stats (for running/paused events) */}
                {(selectedEvent.status === 'running' || selectedEvent.status === 'paused') && eventStats && (
                  <div className="pt-6 border-t border-neon-green/20">
                    <h3 className="text-base font-mono font-bold text-neon-green tracking-wider mb-4">
                      Live Statistics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl">
                        <div className="text-white/60 text-xs font-mono mb-1">Total Participants</div>
                        <div className="text-neon-green text-xl font-bold font-mono">{eventStats.total_participants || 0}</div>
                      </div>
                      <div className="p-4 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl">
                        <div className="text-white/60 text-xs font-mono mb-1">Total Submissions</div>
                        <div className="text-neon-green text-xl font-bold font-mono">{eventStats.total_submissions || 0}</div>
                      </div>
                      <div className="p-4 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl">
                        <div className="text-white/60 text-xs font-mono mb-1">Solved Challenges</div>
                        <div className="text-neon-green text-xl font-bold font-mono">{eventStats.solved_challenges || 0}</div>
                      </div>
                      <div className="p-4 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl">
                        <div className="text-white/60 text-xs font-mono mb-1">Hints Unlocked</div>
                        <div className="text-orange-400 text-xl font-bold font-mono">{eventStats.hints_unlocked || 0}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scoreboard (for running/paused events) */}
                {(selectedEvent.status === 'running' || selectedEvent.status === 'paused') && eventScoreboard && (
                  <div className="pt-6 border-t border-neon-green/20">
                    <h3 className="text-base font-mono font-bold text-neon-green tracking-wider mb-4">
                      Scoreboard
                    </h3>
                    <div className="overflow-x-auto border border-neon-green/20 rounded-xl">
                      <table className="w-full">
                        <thead className="bg-cyber-800/50 border-b border-neon-green/20">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">Rank</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                              {selectedEvent.participation_type === 'team_based' ? 'Team' : 'User'}
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">Points</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">Solves</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventScoreboard.rankings && eventScoreboard.rankings.length > 0 ? (
                            eventScoreboard.rankings.map((entry: any, index: number) => (
                              <tr
                                key={entry.id || index}
                                className="border-b border-neon-green/10 hover:bg-cyber-800/30 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {index < 3 && (
                                      <Award className={`${
                                        index === 0 ? 'text-yellow-400' :
                                        index === 1 ? 'text-gray-300' :
                                        'text-orange-400'
                                      }`} size={16} />
                                    )}
                                    <span className="text-white font-mono font-bold">#{index + 1}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-white/80 font-mono">
                                  {entry.name || entry.username || 'Unknown'}
                                </td>
                                <td className="px-4 py-3 text-neon-green font-mono font-bold">
                                  {entry.total_points || 0}
                                </td>
                                <td className="px-4 py-3 text-white/80 font-mono">
                                  {entry.solved_count || 0}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-white/60">
                                No rankings yet
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Close Button */}
                <div className="pt-6 border-t border-neon-green/20 flex justify-end">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleCloseEventModal}
                    className="border-neon-green/30 hover:bg-neon-green/10 text-white font-semibold tracking-wider"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Approvals */}
      {activeAction === 'pending' && (
        <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6">
          <h3 className="text-xl font-bold text-white mb-6 gradient-text">Pending Approvals</h3>
          
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="animate-spin text-neon-green mx-auto mb-4" size={32} />
              <p className="text-white/60">Loading pending approvals...</p>
            </div>
          ) : pendingEvents.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="text-white/40 mx-auto mb-4" size={48} />
              <p className="text-white/60">No events pending approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-cyber-800/50 rounded-xl p-6 border border-neon-cyan/20 hover:border-neon-cyan/40 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-bold text-white">{event.name}</h4>
                        {getStatusBadge(event.status)}
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          event.event_type === 'ctf' 
                            ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                            : 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                        }`}>
                          {event.event_type.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-white/70 mb-4">{event.description}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-white/60">Zone:</span>
                          <p className="text-white font-medium">{event.zone}</p>
                        </div>
                        <div>
                          <span className="text-white/60">Start:</span>
                          <p className="text-white font-medium">{new Date(event.start_time).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-white/60">Created by:</span>
                          <p className="text-white font-medium">{event.created_by_username}</p>
                        </div>
                        <div>
                          <span className="text-white/60">Participants:</span>
                          <p className="text-white font-medium">{event.participant_count || 0}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 ml-4">
                      <Button
                        onClick={() => handleApproveEvent(event.id, true)}
                        className="relative overflow-hidden group bg-gradient-to-r from-neon-green/25 to-neon-green/15 hover:from-neon-green/35 hover:to-neon-green/25 text-white border-2 border-neon-green/60 hover:border-neon-green/80 transition-all duration-300 shadow-lg shadow-neon-green/20 hover:shadow-neon-green/40 hover:shadow-xl font-bold min-w-[140px] py-3"
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2 text-white drop-shadow-[0_0_8px_rgba(34,255,134,0.7)]">
                          <CheckCircle size={18} className="group-hover:scale-110 transition-transform drop-shadow-[0_0_4px_rgba(34,255,134,0.9)]" />
                          Approve
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-neon-green/0 via-neon-green/25 to-neon-green/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                      </Button>
                      <Button
                        onClick={() => handleApproveEvent(event.id, false)}
                        variant="outline"
                        className="relative overflow-hidden group border-2 border-red-500/60 hover:border-red-500/80 bg-gradient-to-r from-red-500/20 to-red-500/10 hover:from-red-500/30 hover:to-red-500/20 text-white hover:text-white transition-all duration-300 shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:shadow-xl font-bold min-w-[140px] py-3"
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2 text-white drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]">
                          <XCircle size={18} className="group-hover:scale-110 transition-transform drop-shadow-[0_0_4px_rgba(239,68,68,0.9)]" />
                          Reject
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/25 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

