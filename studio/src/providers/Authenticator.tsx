import { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAccount, isAppwriteAuthEnabled } from "../libs/appwriteAuth";
import { setAppwriteUserId } from "../services/appwriteApi";
import { bootstrapPadClientPersistence } from "../services/padClientPersistence";
import type { UserRole } from "../services/roleService";
import { useRoleStore } from "../store/roleStore";
import { useEnsureInbox } from "../hooks/useEnsureInbox";

export interface IAuthenUser {
  email: string | null;
  displayName: string | null;
  uid: string;
  photoURL: string | null;
  role: UserRole;
}

interface IAuthenContext {
  checking: boolean;
  user: IAuthenUser | null;
}

export const AuthenContext = createContext<IAuthenContext>({
  checking: true,
  user: null,
});

interface AuthenProviderProps {
  children: JSX.Element | JSX.Element[];
}

export const AuthenProvider = ({ children }: AuthenProviderProps) => {
  const [authInfo, setAuthInfo] = useState<IAuthenContext>({
    checking: true,
    user: null,
  });
  const setRole = useRoleStore((state) => state.setRole);

  const navigate = useNavigate();

  useEnsureInbox(authInfo.user?.uid);

  useEffect(() => {
    if (isAppwriteAuthEnabled()) {
      // Appwrite: resolve session and scope data by user
      getAccount()
        .then((user) => {
          if (user) {
            setAppwriteUserId(user.uid);
            bootstrapPadClientPersistence(user.uid);
            setAuthInfo({ checking: false, user });
            // Sync role to roleStore for backward compatibility
            setRole(user.role);
          } else {
            setAppwriteUserId(null);
            bootstrapPadClientPersistence(null);
            setAuthInfo({ checking: false, user: null });
            setRole('student'); // Reset to default
          }
          const path = window.location.pathname;
          if (path === "/" && user) {
            navigate(
              user.role === "teacher" || user.role === "admin"
                ? "/app/teacher"
                : "/app/pad"
            );
          }
        })
        .catch(() => {
          setAppwriteUserId(null);
          bootstrapPadClientPersistence(null);
          setAuthInfo({ checking: false, user: null });
          setRole('student'); // Reset to default
        });
      return;
    }

    // No Appwrite: demo/local mode – treat as logged-in local user
    const localUser = {
      displayName: "Local User",
      email: "local@canis.note",
      photoURL: null,
      uid: "local-user-123",
      role: 'student' as UserRole,
    };
    setAppwriteUserId(localUser.uid);
    bootstrapPadClientPersistence(localUser.uid);
    setAuthInfo({
      checking: false,
      user: localUser,
    });
    setRole(localUser.role);
    const path = window.location.pathname;
    if (path === "/signin" || path === "/" || path === "/signup") {
      navigate(
        localUser.role === "teacher" || localUser.role === "admin"
          ? "/app/teacher"
          : "/app/pad"
      );
    }
  }, [navigate, setRole]);

  return (
    <AuthenContext.Provider value={authInfo}>{children}</AuthenContext.Provider>
  );
};
