'use client';

import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type DayAdherence = {
  date: string;
  day_type: string;
  training_adherence: number;
  nutrition_adherence: number;
  combined_adherence: number;
  exercises_completed: number;
  exercises_total: number;
  meals_completed: number;
  meals_total: number;
};

export type WeeklySummary = {
  week_number: number;
  days: DayAdherence[];
  week_average: number;
  streak: { current: number; longest: number; start_date: string | null };
};

export type Projection = {
  projected_final_adherence: number;
  weight_projection: number | null;
  trend: 'improving' | 'stable' | 'declining';
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
  days_elapsed: number;
  days_remaining: number;
};

export type ComparisonField = {
  before: number | null;
  after: number | null;
  delta: number | null;
};

export type MonthlySummary = {
  program_id: number;
  start_date: string;
  end_date: string;
  overall_adherence: number;
  training_adherence: number;
  nutrition_adherence: number;
  comparisons: {
    bmi: ComparisonField;
    body_fat_pct: ComparisonField;
    physical_index: ComparisonField;
  };
  mood: { first_week: number | null; last_week: number | null };
  weight: { start: number | null; end: number | null; delta: number | null };
  streak_best: number;
};

type ProgressState = {
  weeklySummary: WeeklySummary | null;
  projection: Projection | null;
  monthlySummary: MonthlySummary | null;
  weeklyLoading: boolean;
  projectionLoading: boolean;
  monthlyLoading: boolean;
  fetchWeeklySummary: (week?: number) => Promise<void>;
  fetchProjection: () => Promise<void>;
  fetchMonthlySummary: (programId?: number) => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useProgressStore = create<ProgressState>((set) => ({
  weeklySummary: null,
  projection: null,
  monthlySummary: null,
  weeklyLoading: false,
  projectionLoading: false,
  monthlyLoading: false,

  fetchWeeklySummary: async (week) => {
    set({ weeklyLoading: true });
    try {
      const params = week ? `?week=${week}` : '';
      const { data } = await api.get<WeeklySummary>(`/my-program/weekly-summary/${params}`, {
        headers: authHeaders(),
      });
      set({ weeklySummary: data, weeklyLoading: false });
    } catch {
      set({ weeklyLoading: false });
    }
  },

  fetchProjection: async () => {
    set({ projectionLoading: true });
    try {
      const { data } = await api.get<Projection>('/my-program/projection/', {
        headers: authHeaders(),
      });
      set({ projection: data, projectionLoading: false });
    } catch {
      set({ projectionLoading: false });
    }
  },

  fetchMonthlySummary: async (programId) => {
    set({ monthlyLoading: true });
    try {
      const params = programId ? `?program=${programId}` : '';
      const { data } = await api.get<MonthlySummary>(`/my-program/monthly-summary/${params}`, {
        headers: authHeaders(),
      });
      set({ monthlySummary: data, monthlyLoading: false });
    } catch {
      set({ monthlyLoading: false });
    }
  },
}));
