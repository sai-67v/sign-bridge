import { create } from 'zustand';
import type { UserRole } from '../services/roleService';

interface RoleState {
    role: UserRole;
    setRole: (role: UserRole) => void;
}

/**
 * Role store that syncs with auth context.
 * This is a read-only store for backward compatibility.
 * Components should use role from useAuth() hook instead.
 */
export const useRoleStore = create<RoleState>((set) => ({
    role: 'student', // Default

    setRole: (role: UserRole) => {
        set({ role });
    },
}));
