/**
 * Appwrite Auth helpers for canis.studio.
 * Use when REACT_APP_APPWRITE_DATABASE_ID is set (Appwrite-backed app).
 */
import { ID } from "appwrite";
import { isAppwriteConfigured } from "../config/appwriteEnv";
import { account } from "./appwrite";
import type { IAuthenUser } from "../providers/Authenticator";
import { getUserRole, initializeUserRole, type UserRole } from "../services/roleService";

export interface AppwriteAuthError {
  code: number;
  message: string;
  type?: string;
}

/** Get a user-friendly message from an Appwrite (or other) error. */
export function getAuthErrorMessage(err: unknown): string {
  const e = err as { code?: number; message?: string; response?: string };
  if (e?.message) {
    const msg = String(e.message);
    if (msg.includes("Invalid credentials") || e.code === 401) return "Invalid email or password.";
    if (msg.includes("already exists") || e.code === 409) return "Email already in use.";
    if (msg.includes("disabled") || msg.includes("provider")) return "Email/password sign-in is not enabled. Enable it in Appwrite Console → Auth.";
    if (msg.includes("Network") || msg.includes("Failed to fetch")) return "Network error. Check Appwrite endpoint and CORS.";
    return msg;
  }
  if (e?.response) {
    try {
      const body = JSON.parse(e.response);
      if (body?.message) return String(body.message);
    } catch {}
  }
  return "Sign in failed. Open the browser console (F12) for details.";
}

async function toAuthenUser(user: { $id: string; email?: string; name?: string }): Promise<IAuthenUser> {
  // Fetch user role from Appwrite
  let role: UserRole = 'student';
  try {
    const fetchedRole = await getUserRole(user.$id);
    if (fetchedRole) {
      role = fetchedRole;
    } else {
      // Initialize default role if profile doesn't exist
      role = await initializeUserRole(user.$id);
    }
  } catch (error) {
    console.warn('Failed to fetch user role, defaulting to student:', error);
  }

  return {
    uid: user.$id,
    email: user.email ?? null,
    displayName: user.name ?? (user.email ? user.email.split("@")[0] : null),
    photoURL: null,
    role,
  };
}

/**
 * Get current session user. Returns null if not logged in or session expired.
 */
export async function getAccount(): Promise<IAuthenUser | null> {
  try {
    const user = await account.get();
    return await toAuthenUser(user);
  } catch {
    return null;
  }
}

/**
 * Sign in with email and password.
 */
export async function login(email: string, password: string): Promise<IAuthenUser> {
  await account.createEmailPasswordSession(email, password);
  const user = await account.get();
  return await toAuthenUser(user);
}

/**
 * Create account and start session (sign up).
 */
export async function signUp(
  email: string,
  password: string,
  name?: string,
  role?: UserRole
): Promise<IAuthenUser> {
  await account.create({
    userId: ID.unique(),
    email,
    password,
    name: name ?? undefined,
  });
  await account.createEmailPasswordSession({ email, password });
  const user = await account.get();
  const authenUser = await toAuthenUser(user);
  
  // If role is provided during signup, set it (otherwise defaults to student)
  if (role && role !== 'student') {
    try {
      const { setUserRole } = await import("../services/roleService");
      await setUserRole(user.$id, role);
      authenUser.role = role;
    } catch (error) {
      console.warn('Failed to set user role during signup:', error);
    }
  }
  
  return authenUser;
}

/**
 * Sign out (delete current session).
 */
export async function logout(): Promise<void> {
  try {
    await account.deleteSession("current");
  } catch (e) {
    console.warn("Appwrite logout:", e);
  }
}

/**
 * Check if Appwrite auth is enabled. Uses same fallbacks as api/appwrite
 * so when the app uses Appwrite for data, login is required.
 */
export function isAppwriteAuthEnabled(): boolean {
  return isAppwriteConfigured();
}

/**
 * Get user role helper (exported for convenience).
 */
export async function getUserRoleFromAuth(userId: string): Promise<UserRole> {
  const role = await getUserRole(userId);
  if (role) return role;
  return await initializeUserRole(userId);
}
