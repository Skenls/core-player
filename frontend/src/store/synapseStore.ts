import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Familiarity, Mood, SynapseFilters } from '@/types/synapse';

interface SynapseState {
  filters: SynapseFilters;
  notice: string | null;
  profileVersion: number;
  profileResetting: boolean;
  setFilters: (filters: SynapseFilters) => void;
  toggleFamiliarity: (value: Familiarity) => void;
  setMood: (mood: Mood | null) => void;
  setNotice: (notice: string | null) => void;
  resetLocalProfile: () => void;
  setProfileResetting: (value: boolean) => void;
}

export const useSynapseStore = create<SynapseState>()(persist((set) => ({
  filters: { familiarity: ['familiar', 'unfamiliar'], mood: null },
  notice: null,
  profileVersion: 0,
  profileResetting: false,
  setFilters: (filters) => set({ filters }),
  toggleFamiliarity: (value) => set(({ filters }) => {
    const selected = filters.familiarity.includes(value);
    if (selected && filters.familiarity.length === 1) return {};
    return { filters: { ...filters, familiarity: selected
      ? filters.familiarity.filter(item => item !== value) : [...filters.familiarity, value] } };
  }),
  setMood: (mood) => set(({ filters }) => ({ filters: { ...filters, mood: mood === filters.mood ? null : mood } })),
  setNotice: (notice) => set({ notice }),
  resetLocalProfile: () => set(state => ({ profileVersion: state.profileVersion + 1, notice: null })),
  setProfileResetting: (profileResetting) => set({ profileResetting })
}), { name: 'core-synapse-filters', partialize: ({ filters }) => ({ filters }) }));
