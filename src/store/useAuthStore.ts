import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState } from '../types';
import { supabase } from '../lib/supabaseClient';

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            session: null,
            isLoading: false,
            isInitialized: false,
            setUser: (user) => set({ user }),
            setSession: (session) => set({ session }),
            setLoading: (isLoading) => set({ isLoading }),
            setInitialized: (isInitialized) => set({ isInitialized }),
            logout: async () => {
                await supabase.auth.signOut();
                set({ user: null, session: null, isLoading: false });
            },
        }),
        {
            name: 'zemly-auth-storage',
            partialize: (state) => ({
                user: state.user,
                session: state.session,
            }),
        }
    )
);
