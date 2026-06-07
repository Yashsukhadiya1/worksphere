import { create } from "zustand";
import type { UserProfile } from "@/types";
import * as api from "@/api/endpoints";

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem("access_token"),
  refreshToken: localStorage.getItem("refresh_token"),

  login: async (email, password) => {
    const tokens = await api.login({ email, password });
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
    set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
    const user = await api.getMe();
    set({ user });
  },

  logout: async () => {
    const rt = get().refreshToken;
    if (rt) await api.logout(rt).catch(() => {});
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null, accessToken: null, refreshToken: null });
  },

  loadUser: async () => {
    if (!get().accessToken) return;
    try {
      const user = await api.getMe();
      set({ user });
    } catch {
      set({ user: null });
    }
  },
}));
