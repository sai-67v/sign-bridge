/**
 * Role management service for Appwrite-backed user profiles.
 * Handles fetching, setting, and initializing user roles.
 */
import { ID, Permission, Query, Role } from 'appwrite';
import { APPWRITE_DATABASE_ID } from '../config/appwriteEnv';
import { databases } from '../libs/appwrite';

const DATABASE_ID = APPWRITE_DATABASE_ID;
const USER_PROFILES_COLLECTION = 'user_profiles';

export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserProfile {
  $id: string;
  userId: string;
  role: UserRole;
  schoolId?: string;
  displayName?: string;
  avatarFileId?: string;
  /** User-selected emoji shown as profile picture in nav (e.g. "👨‍🎓") */
  profileEmoji?: string;
  $createdAt: string;
  $updatedAt: string;
}

/**
 * Get user role from Appwrite user_profiles collection.
 * Returns null if profile doesn't exist.
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      USER_PROFILES_COLLECTION,
      [Query.equal('userId', userId)]
    );

    if (response.documents && response.documents.length > 0) {
      const profile = response.documents[0] as unknown as UserProfile;
      return profile.role as UserRole;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch user role:', error);
    return null;
  }
}

/**
 * Set user role. Creates profile if it doesn't exist, updates if it does.
 */
export async function setUserRole(userId: string, role: UserRole, extra?: { schoolId?: string; displayName?: string }): Promise<void> {
  try {
    const existing = await databases.listDocuments(
      DATABASE_ID,
      USER_PROFILES_COLLECTION,
      [Query.equal('userId', userId)]
    );

    const payload: Record<string, unknown> = { userId, role, ...extra };

    if (existing.documents && existing.documents.length > 0) {
      const profileId = existing.documents[0].$id;
      await databases.updateDocument(DATABASE_ID, USER_PROFILES_COLLECTION, profileId, payload);
    } else {
      await databases.createDocument(
        DATABASE_ID,
        USER_PROFILES_COLLECTION,
        ID.unique(),
        payload,
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
        ],
      );
    }
  } catch (error) {
    console.error('Failed to set user role:', error);
    throw error;
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const response = await databases.listDocuments(DATABASE_ID, USER_PROFILES_COLLECTION, [Query.equal('userId', userId)]);
    if (response.documents.length > 0) return response.documents[0] as unknown as UserProfile;
    return null;
  } catch {
    return null;
  }
}

/**
 * Initialize user role with default 'student' if profile doesn't exist.
 * Returns the role (either existing or newly created).
 */
export async function initializeUserRole(userId: string): Promise<UserRole> {
  try {
    const existingRole = await getUserRole(userId);
    if (existingRole) {
      return existingRole;
    }

    // Create default student profile
    await setUserRole(userId, 'student');
    return 'student';
  } catch (error) {
    console.error('Failed to initialize user role:', error);
    // Return default on error
    return 'student';
  }
}

/** Default emoji per role when user has not set a profile emoji. */
export const ROLE_DEFAULT_EMOJI: Record<UserRole, string> = {
  teacher: '👨‍🏫',
  admin: '👨‍💼',
  student: '👨‍🎓',
};

/**
 * Get the profile emoji for the user (from user_profiles). Returns null if not set.
 */
export async function getProfileEmoji(userId: string): Promise<string | null> {
  const profile = await getUserProfile(userId);
  const emoji = profile?.profileEmoji;
  return typeof emoji === 'string' && emoji.length > 0 ? emoji : null;
}

/**
 * Update the profile emoji in user_profiles. Creates profile if it doesn't exist.
 * Requires the user_profiles collection to have a string attribute "profileEmoji"
 * (add it in Appwrite Console: your database → user_profiles → Create attribute).
 */
export async function updateProfileEmoji(userId: string, emoji: string): Promise<void> {
  const existing = await databases.listDocuments(
    DATABASE_ID,
    USER_PROFILES_COLLECTION,
    [Query.equal('userId', userId)]
  );

  const payload = { userId, profileEmoji: emoji };

  if (existing.documents && existing.documents.length > 0) {
    const profileId = existing.documents[0].$id;
    await databases.updateDocument(DATABASE_ID, USER_PROFILES_COLLECTION, profileId, payload);
  } else {
    const role = await getUserRole(userId);
    await databases.createDocument(
      DATABASE_ID,
      USER_PROFILES_COLLECTION,
      ID.unique(),
      { ...payload, role: role ?? 'student' },
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
      ]
    );
  }
}

/** True if the error is "Unknown attribute: profileEmoji" (attribute not yet added in Appwrite). */
export function isProfileEmojiAttributeMissingError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? '');
  return msg.includes('Unknown attribute') && msg.includes('profileEmoji');
}
