import { ID, Permission, Query, Role } from 'appwrite';
import { APPWRITE_DATABASE_ID } from '../config/appwriteEnv';
import { client, databases } from '../libs/appwrite';
import type { INotification, NotificationType } from '../types';

const DB = APPWRITE_DATABASE_ID;
const COL = 'notifications';

function docToNotification(doc: any): INotification {
  return {
    id: doc.$id,
    recipientId: doc.recipientId,
    type: doc.type as NotificationType,
    title: doc.title,
    message: doc.message,
    metadata: doc.metadata,
    read: doc.read ?? false,
    createdAt: doc.createdAt || doc.$createdAt,
  };
}

export const notificationService = {
  async createNotification(data: {
    recipientId: string;
    senderId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: string;
  }): Promise<INotification> {
    // Only set permissions for the caller (sender/teacher). Setting Role.user(recipientId)
    // from the sender's session 401s — Appwrite forbids granting roles you don't own.
    // Recipient read/update access is covered by table-level read/update("users").
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      recipientId: data.recipientId,
      type: data.type,
      title: data.title,
      message: data.message,
      metadata: data.metadata || null,
      read: false,
      createdAt: new Date().toISOString(),
    }, [
      Permission.read(Role.user(data.senderId)),
      Permission.update(Role.user(data.senderId)),
      Permission.delete(Role.user(data.senderId)),
    ]);
    return docToNotification(doc);
  },

  async getNotifications(recipientId: string, unreadOnly = false): Promise<INotification[]> {
    const queries = [
      Query.equal('recipientId', recipientId),
      Query.orderDesc('createdAt'),
      Query.limit(50),
    ];
    if (unreadOnly) queries.push(Query.equal('read', false));
    const res = await databases.listDocuments(DB, COL, queries);
    return res.documents.map(docToNotification);
  },

  async getUnreadCount(recipientId: string): Promise<number> {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal('recipientId', recipientId),
      Query.equal('read', false),
      Query.limit(100),
    ]);
    return res.total;
  },

  async markRead(id: string): Promise<void> {
    await databases.updateDocument(DB, COL, id, { read: true });
  },

  async markAllRead(recipientId: string): Promise<void> {
    const unread = await databases.listDocuments(DB, COL, [
      Query.equal('recipientId', recipientId),
      Query.equal('read', false),
      Query.limit(100),
    ]);
    await Promise.all(unread.documents.map(doc => databases.updateDocument(DB, COL, doc.$id, { read: true })));
  },

  /**
   * Subscribe to real-time notification events for a user.
   * Returns an unsubscribe function.
   */
  subscribeToNotifications(
    recipientId: string,
    onNew: (notification: INotification) => void,
  ): () => void {
    const channel = `databases.${DB}.collections.${COL}.documents`;
    return client.subscribe(channel, (response: any) => {
      const events: string[] = response.events || [];
      const isCreate = events.some(e => e.includes('.create'));
      if (!isCreate) return;
      const doc = response.payload;
      if (doc?.recipientId === recipientId) {
        onNew(docToNotification(doc));
      }
    });
  },
};
