import { create } from 'zustand';

interface UserState {
  auth: boolean;
  name: string;
  group: string;
  setAuth: (auth: boolean) => void;
  setUser: (name: string, group: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  auth: false,
  name: '',
  group: '',
  setAuth: (auth) => set({ auth }),
  setUser: (name, group) => set({ name, group }),
  logout: () => set({ name: '', group: '', auth: false }),
}));
