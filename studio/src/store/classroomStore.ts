import { create } from 'zustand';
import type { IClassroom, IClassroomMembership } from '../types';
import { classroomService } from '../services/classroomService';

const CURRENT_CLASSROOM_LS = 'pad_current_classroom_id_v1';

function readPersistedClassroomId(): string | null {
  try {
    const raw = localStorage.getItem(CURRENT_CLASSROOM_LS);
    if (raw && raw.trim()) return raw.trim();
  } catch {
    /* ignore */
  }
  return null;
}

function writePersistedClassroomId(id: string | null) {
  try {
    if (id) localStorage.setItem(CURRENT_CLASSROOM_LS, id);
    else localStorage.removeItem(CURRENT_CLASSROOM_LS);
  } catch {
    /* ignore */
  }
}

interface ClassroomStore {
  myClassrooms: IClassroom[];
  currentClassroom: IClassroom | null;
  members: IClassroomMembership[];
  loading: boolean;
  membersLoading: boolean;
  fetchMyClassrooms: (userId: string) => Promise<void>;
  selectClassroom: (classroom: IClassroom | null) => void;
  fetchMembers: (classroomId: string) => Promise<void>;
  createClassroom: (teacherId: string, data: Omit<IClassroom, 'id' | 'teacherId' | 'inviteCode' | '$createdAt' | '$updatedAt'>) => Promise<IClassroom>;
  updateClassroom: (
    id: string,
    data: Partial<
      Pick<IClassroom, 'name' | 'subject' | 'gradeLevel' | 'description' | 'rootFolderId' | 'materialsFolderId'>
    >
  ) => Promise<IClassroom>;
  removeMember: (membershipId: string) => Promise<void>;
  /** Refetch classrooms and current classroom members after admin roster edits. */
  refreshClassroomsAndMembers: (userId: string) => Promise<void>;
}

export const useClassroomStore = create<ClassroomStore>((set, get) => ({
  myClassrooms: [],
  currentClassroom: null,
  members: [],
  loading: false,
  membersLoading: false,

  fetchMyClassrooms: async (userId) => {
    set({ loading: true });
    try {
      const classrooms = await classroomService.listAccessibleClassrooms(userId);
      const persistedId = readPersistedClassroomId();
      let current = get().currentClassroom;
      if (persistedId) {
        const match = classrooms.find((c) => c.id === persistedId);
        if (match) current = match;
      }
      set({ myClassrooms: classrooms, currentClassroom: current ?? null, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  selectClassroom: (classroom) => {
    writePersistedClassroomId(classroom?.id ?? null);
    set({ currentClassroom: classroom, members: [] });
  },

  fetchMembers: async (classroomId) => {
    set({ membersLoading: true });
    try {
      const members = await classroomService.listMembers(classroomId);
      set({ members, membersLoading: false });
    } catch {
      set({ membersLoading: false });
    }
  },

  createClassroom: async (teacherId, data) => {
    const classroom = await classroomService.createClassroom(teacherId, data);
    set(state => ({ myClassrooms: [classroom, ...state.myClassrooms] }));
    return classroom;
  },

  updateClassroom: async (id, data) => {
    const updated = await classroomService.updateClassroom(id, data);
    set((state) => ({
      myClassrooms: state.myClassrooms.map((c) => (c.id === id ? updated : c)),
      currentClassroom: state.currentClassroom?.id === id ? updated : state.currentClassroom,
    }));
    return updated;
  },

  removeMember: async (membershipId) => {
    await classroomService.removeMember(membershipId);
    set(state => ({
      members: state.members.filter(m => m.id !== membershipId),
    }));
  },

  refreshClassroomsAndMembers: async (userId) => {
    await get().fetchMyClassrooms(userId);
    const cur = get().currentClassroom;
    if (cur) await get().fetchMembers(cur.id);
  },
}));
