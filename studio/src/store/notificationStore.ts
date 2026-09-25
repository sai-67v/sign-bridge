import { create } from 'zustand';
import type { INotification } from '../types';
import { notificationService } from '../services/notificationService';

interface NotificationStore {
  notifications: INotification[];
  unreadCount: number;
  loading: boolean;
  unsubscribe: (() => void) | null;
  fetchNotifications: (userId: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;
  subscribeRealtime: (userId: string) => void;
  unsubscribeRealtime: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  unsubscribe: null,

  fetchNotifications: async (userId) => {
    set({ loading: true });
    try {
      const notifications = await notificationService.getNotifications(userId);
      const unreadCount = notifications.filter(n => !n.read).length;
      set({ notifications, unreadCount, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    await notificationService.markRead(id);
    set(state => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllRead: async (userId) => {
    await notificationService.markAllRead(userId);
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  subscribeRealtime: (userId) => {
    const { unsubscribe: existingUnsub } = get();
    if (existingUnsub) existingUnsub();

    const unsub = notificationService.subscribeToNotifications(userId, (notification) => {
      set(state => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }));
    });
    set({ unsubscribe: unsub });
  },

  unsubscribeRealtime: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null });
    }
  },
}));
