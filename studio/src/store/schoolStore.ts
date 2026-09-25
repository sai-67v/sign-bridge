import { create } from 'zustand';
import type { ISchool } from '../types';
import { schoolService } from '../services/schoolService';

interface SchoolStore {
  schools: ISchool[];
  mySchool: ISchool | null;
  loading: boolean;
  fetchSchools: () => Promise<void>;
  setMySchool: (school: ISchool | null) => void;
  createSchool: (adminId: string, data: Omit<ISchool, 'id' | 'adminId' | '$createdAt'>) => Promise<ISchool>;
}

export const useSchoolStore = create<SchoolStore>((set, get) => ({
  schools: [],
  mySchool: null,
  loading: false,

  fetchSchools: async () => {
    set({ loading: true });
    try {
      const schools = await schoolService.listSchools();
      set({ schools, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setMySchool: (school) => set({ mySchool: school }),

  createSchool: async (adminId, data) => {
    const school = await schoolService.createSchool(adminId, data);
    set(state => ({ schools: [school, ...state.schools] }));
    return school;
  },
}));
