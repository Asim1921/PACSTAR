'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, X, Calendar, CheckCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { eventAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

interface Notification {
  id: string;
  type: string;
  event_id: string;
  event_name: string;
  title?: string;
  message: string;
  action: string;
  ui_type?: 'toast' | 'alert' | 'background' | string;
  play_sound?: boolean;
  source?: string;
  broadcast_id?: string;
  created_at: string;
  read: boolean;
}

interface NotificationsProps {
  onJoinEvent?: (eventId: string) => void;
}

export const Notifications: React.FC<NotificationsProps> = ({ onJoinEvent }) => {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);

  // Track "seen" + "sound played" without causing rerenders
  const seenIdsRef = useRef<Set<string>>(new Set());
  const soundedIdsRef = useRef<Set<string>>(new Set());

  // Browsers require a user gesture to start audio. We "unlock" an AudioContext on first interaction.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef<boolean>(false);

  useEffect(() => {
    const unlock = async () => {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === 'suspended') {
          await ctx.resume();
        }
        audioUnlockedRef.current = true;
      } catch {
        // ignore
      }
    };

    // Run once after first user gesture
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock as any);
      window.removeEventListener('keydown', unlock as any);
    };
  }, []);

  const playBeep = () => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx || !audioUnlockedRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
        } catch {}
      }, 180);
    } catch {
      // ignore audio failures
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await eventAPI.getNotifications(false);
      const notifs = response.notifications || [];

      // Detect newly-received notifications (by id) and surface them immediately.
      // This avoids requiring the user to open the bell dropdown or refresh the page.
      const newlyArrived: Notification[] = [];
      for (const n of notifs as Notification[]) {
        if (!n?.id) continue;
        if (!seenIdsRef.current.has(n.id)) {
          seenIdsRef.current.add(n.id);
          newlyArrived.push(n);
        }
      }

      // Show new notifications immediately (only if unread).
      for (const n of newlyArrived) {
        if (n.read) continue;
        const ui = (n.ui_type || 'toast').toString().toLowerCase();
        const title = n.title || n.event_name || 'Notification';
        const msg = n.message || '';
        if (ui === 'alert') {
          // Using toast provider for non-blocking alert-style; can be upgraded to modal if desired.
          showToast(`${title}\n${msg}`, 'error');
        } else if (ui === 'background') {
          showToast(`${title}: ${msg}`, 'info');
        } else {
          // toast
          showToast(`${title}: ${msg}`, 'info');
        }

        // Sound (if requested)
        if (n.play_sound && !soundedIdsRef.current.has(n.id)) {
          soundedIdsRef.current.add(n.id);
          playBeep();
        }
      }

      setNotifications(notifs);
      setUnreadCount(response.unread_count || 0);
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error);
      // Only show toast for non-auth errors
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        // Silently fail for network errors during polling
        if (!error.code || error.code !== 'ERR_NETWORK') {
          console.warn('Notification fetch failed:', error.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll frequently so users don't feel like they must refresh.
    const interval = setInterval(fetchNotifications, 5000);

    // Also refetch when tab becomes visible / focused.
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };
    const onFocus = () => fetchNotifications();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchNotifications]);

  const handleJoinEvent = async (eventId: string, notificationId: string) => {
    try {
      setJoiningEventId(eventId);
      
      // Register for event
      await eventAPI.registerForEvent(eventId);
      
      // Mark notification as read
      await eventAPI.markNotificationRead(notificationId);
      
      showToast('Successfully joined the event! You can now see challenges.', 'success');
      
      // Refresh notifications
      await fetchNotifications();
      
      // Call parent callback if provided
      if (onJoinEvent) {
        onJoinEvent(eventId);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to join event';
      showToast(errorMessage, 'error');
    } finally {
      setJoiningEventId(null);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await eventAPI.markNotificationRead(notificationId);
      await fetchNotifications();
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-cyber-800/50 hover:bg-cyber-800/70 border border-neon-green/20 hover:border-neon-green/40 transition-all"
        aria-label="Notifications"
      >
        <Bell className="text-neon-green" size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-neon-orange text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Panel */}
          <div className="absolute right-0 top-12 w-96 bg-cyber-900/95 backdrop-blur-xl border-2 border-neon-green/30 rounded-xl shadow-2xl z-50 max-h-[600px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-neon-green/20 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Bell className="text-neon-green" size={20} />
                Notifications
                {unreadCount > 0 && (
                  <span className="bg-neon-orange text-white text-xs font-bold rounded-full px-2 py-1">
                    {unreadCount}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {isLoading ? (
                <div className="p-8 text-center text-white/60">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-white/60">
                  <Bell className="mx-auto mb-2 text-white/40" size={32} />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-neon-green/10">
                  {/* Unread Notifications */}
                  {unreadNotifications.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-neon-green/10 text-neon-green text-xs font-semibold">
                        NEW
                      </div>
                      {unreadNotifications.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onJoinEvent={handleJoinEvent}
                          onMarkAsRead={handleMarkAsRead}
                          isJoining={joiningEventId === notification.event_id}
                        />
                      ))}
                    </div>
                  )}

                  {/* Read Notifications */}
                  {readNotifications.length > 0 && (
                    <div>
                      {unreadNotifications.length > 0 && (
                        <div className="px-4 py-2 bg-cyber-800/30 text-white/60 text-xs font-semibold">
                          READ
                        </div>
                      )}
                      {readNotifications.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onJoinEvent={handleJoinEvent}
                          onMarkAsRead={handleMarkAsRead}
                          isJoining={joiningEventId === notification.event_id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onJoinEvent: (eventId: string, notificationId: string) => void;
  onMarkAsRead: (notificationId: string) => void;
  isJoining: boolean;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onJoinEvent,
  onMarkAsRead,
  isJoining,
}) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Debug: Log notification data
  console.log('Rendering notification:', {
    id: notification.id,
    action: notification.action,
    read: notification.read,
    event_id: notification.event_id,
    shouldShowButton: notification.action === 'join_event' && !notification.read
  });

  return (
    <div
      className={`p-4 hover:bg-cyber-800/50 transition-colors ${
        !notification.read ? 'bg-neon-green/5' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <div className="w-10 h-10 bg-neon-green/20 rounded-lg flex items-center justify-center border border-neon-green/30">
            <Calendar className="text-neon-green" size={18} />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm mb-1">
            {notification.title || notification.event_name || 'Notification'}
          </p>
          <p className="text-white/70 text-xs mb-3">
            {notification.message}
          </p>
          
          {/* Always show Join Event button for unread event_started notifications */}
          {notification.type === 'event_started' && !notification.read && (
            <Button
              onClick={() => onJoinEvent(notification.event_id, notification.id)}
              disabled={isJoining}
              className="w-full bg-gradient-to-r from-neon-green to-neon-cyan hover:from-neon-green hover:to-neon-cyan/90 !text-black border-2 border-neon-green/60 hover:border-neon-green/80 transition-all duration-300 shadow-lg shadow-neon-green/20 hover:shadow-neon-green/40 font-bold text-sm py-2.5 relative overflow-hidden"
              size="sm"
              style={{ color: '#000000' }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2 !text-black font-bold" style={{ color: '#000000' }}>
                {isJoining ? (
                  <>
                    <span className="animate-spin mr-2" style={{ color: '#000000' }}>⏳</span>
                    <span style={{ color: '#000000' }}>Joining...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink size={14} style={{ color: '#000000' }} />
                    <span style={{ color: '#000000' }}>Join Event</span>
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-700" />
            </Button>
          )}
          
          {/* Show joined status if read and action is join_event */}
          {notification.read && notification.action === 'join_event' && (
            <div className="flex items-center gap-2 text-xs text-neon-green/60">
              <CheckCircle size={12} />
              <span>Event joined</span>
            </div>
          )}
          
          <p className="text-white/40 text-xs mt-2">
            {formatTime(notification.created_at)}
          </p>
        </div>
        
        {!notification.read && (
          <button
            onClick={() => onMarkAsRead(notification.id)}
            className="flex-shrink-0 text-white/40 hover:text-white/80 transition-colors"
            title="Mark as read"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

