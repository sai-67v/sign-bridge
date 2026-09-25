import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotificationStore } from '../../store/notificationStore';
import './NotificationBell.css';

export default function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount, fetchNotifications, subscribeRealtime, unsubscribeRealtime } = useNotificationStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.uid) return;
    fetchNotifications(user.uid);
    subscribeRealtime(user.uid);
    return () => unsubscribeRealtime();
  }, [user?.uid]);

  if (!user) return null;

  return (
    <button
      className="notification-bell"
      onClick={() => navigate('/app/notifications')}
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      title="Notifications"
    >
      <span className="bell-icon">🔔</span>
      {unreadCount > 0 && (
        <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
      )}
    </button>
  );
}
