import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotificationStore } from '../../store/notificationStore';
import { submissionService } from '../../services/submissionService';
import type { INotification, INotificationMetadata } from '../../types';
import './NotificationsPanel.css';

function NotificationItem({
  notification,
  onRead,
  userId,
  userRole,
}: {
  notification: INotification;
  onRead: (id: string) => void;
  userId?: string;
  userRole?: string;
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!notification.read) onRead(notification.id);
    void (async () => {
      try {
        const meta: INotificationMetadata = notification.metadata ? JSON.parse(notification.metadata) : {};
        if (meta.distributionId && meta.classroomId && userId) {
          if (userRole === "student") {
            const sub = await submissionService.getSubmissionForDistributionAndStudent(meta.distributionId, userId);
            if (sub) {
              navigate(`/app/pad/assignment/${encodeURIComponent(sub.id)}`);
              return;
            }
            navigate(`/app/pad/classroom/${encodeURIComponent(meta.classroomId)}?tab=assignments`);
            return;
          }
          if (userRole === "teacher" || userRole === "admin") {
            navigate(
              `/app/pad/classroom/${encodeURIComponent(meta.classroomId)}?tab=submissions&distribution=${encodeURIComponent(meta.distributionId)}`
            );
            return;
          }
        }
        if (meta.classroomId) {
          navigate(`/app/pad/classroom/${encodeURIComponent(meta.classroomId)}`);
          return;
        }
      } catch {
        // no-op
      }
    })();
  };

  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div
      className={`notification-item ${notification.read ? '' : 'unread'}`}
      onClick={handleClick}
    >
      <div className="notif-icon">{notification.type === 'worksheet_received' ? '📄' : '✅'}</div>
      <div className="notif-body">
        <div className="notif-title">{notification.title}</div>
        <div className="notif-message">{notification.message}</div>
        <div className="notif-time">{timeAgo(notification.createdAt)}</div>
      </div>
      {!notification.read && <div className="notif-dot" />}
    </div>
  );
}

type NotificationsPanelProps = {
  /** When true, the parent (e.g. overlay) already shows the panel title — skip duplicate heading. */
  titleInChrome?: boolean
}

export default function NotificationsPanel({ titleInChrome = false }: NotificationsPanelProps) {
  const { user } = useAuth();
  const { notifications, loading, unreadCount, fetchNotifications, markRead, markAllRead } = useNotificationStore();

  useEffect(() => {
    if (user?.uid) fetchNotifications(user.uid);
  }, [user?.uid]);

  if (!user) return null;

  const showHeaderRow =
    !titleInChrome || unreadCount > 0

  return (
    <div className="notifications-panel">
      {showHeaderRow ? (
        <div
          className={
            titleInChrome
              ? "notif-panel-header notif-panel-header--chrome-title"
              : "notif-panel-header"
          }
        >
          {!titleInChrome ? <h2>Notifications</h2> : null}
          {unreadCount > 0 ? (
            <button className="mark-all-btn" onClick={() => markAllRead(user.uid)}>
              Mark all read
            </button>
          ) : null}
        </div>
      ) : null}

      {loading && <div className="notif-loading">Loading…</div>}

      {!loading && notifications.length === 0 && (
        <div className="notif-empty">
          <span>🔔</span>
          <p>No notifications yet</p>
        </div>
      )}

      <div className="notif-list">
        {notifications.map(n => (
          <NotificationItem
            key={n.id}
            notification={n}
            onRead={markRead}
            userId={user.uid}
            userRole={user.role}
          />
        ))}
      </div>
    </div>
  );
}
