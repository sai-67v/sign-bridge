import { create } from 'zustand';

interface ProfileEmojiState {
  profileEmoji: string | null;
  setProfileEmoji: (emoji: string | null) => void;
}

export const useProfileEmojiStore = create<ProfileEmojiState>((set) => ({
  profileEmoji: null,
  setProfileEmoji: (profileEmoji) => set({ profileEmoji }),
}));
