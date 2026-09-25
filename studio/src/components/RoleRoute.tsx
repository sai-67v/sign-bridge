import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoadingRoute from "./LoadingRoute";
import type { UserRole } from "../services/roleService";

interface IRoleRouteProps {
  children: JSX.Element | JSX.Element[];
  allowedRoles: UserRole[];
  redirectTo?: string;
}

/**
 * RoleRoute - Protects routes based on user role.
 * Only allows access if user's role is in the allowedRoles array.
 */
export default function RoleRoute({ 
  children, 
  allowedRoles,
  redirectTo = "/app/pad"
}: IRoleRouteProps) {
  const { checking, user } = useAuth();

  if (checking) {
    return <LoadingRoute />;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  const userRole = user.role || 'student';
  
  if (!allowedRoles.includes(userRole)) {
    // Redirect unauthorized users
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
