import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { currentPadIdStorageKey } from "../services/padClientStorage";

export default function Checking() {
  const { checking, user } = useAuth();

  if (checking) {
    return null;
  }

  if (user) {
    const currentPadRaw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(currentPadIdStorageKey(user.uid))
        : null
    const currentPad =
      typeof currentPadRaw === "string" ? currentPadRaw.trim() : ""
    if (currentPad) {
      return <Navigate to={`/app/pad/${currentPad}`} replace />;
    }
    if (user.role === "teacher" || user.role === "admin") {
      return <Navigate to="/app/teacher" replace />;
    }
    return <Navigate to="/app/pad" replace />;
  }

  return <Navigate to="/signin" />;
}
