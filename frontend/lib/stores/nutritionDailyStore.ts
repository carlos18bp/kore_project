'use client';

import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type MealSuggestionBrief = {
  id: number;
  title: string;
  description: string;
  calories_estimate: number;
  meal_block: string;
};

export type MealEntry = {
  id: number;
  meal_block: string;
  suggestion: MealSuggestionBrief | null;
  status: 'completed' | 'skipped' | 'not_done';
  notes: string;
  photo_url: string | null;
};

export type NutritionDailyLog = {
  id: number;
  date: string;
  is_closed: boolean;
  closed_at: string | null;
  notes: string;
  meal_entries: MealEntry[];
};

type NutritionDailyState = {
  todayLog: NutritionDailyLog | null;
  loading: boolean;
  error: string;
  fetchTodayLog: () => Promise<void>;
  updateMealEntry: (logId: number, mealId: number, status: MealEntry['status'], notes?: string) => Promise<void>;
  uploadMealPhoto: (logId: number, mealId: number, file: File) => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useNutritionDailyStore = create<NutritionDailyState>((set, get) => ({
  todayLog: null,
  loading: false,
  error: '',

  fetchTodayLog: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get<NutritionDailyLog>('/my-nutrition-daily/today/', {
        headers: authHeaders(),
      });
      set({ todayLog: data, loading: false });
    } catch {
      set({ todayLog: null, loading: false, error: 'No se pudo cargar la nutrición de hoy.' });
    }
  },

  updateMealEntry: async (logId, mealId, status, notes) => {
    try {
      const { data } = await api.patch<MealEntry>(
        `/my-nutrition-daily/${logId}/meals/${mealId}/`,
        { status, ...(notes !== undefined && { notes }) },
        { headers: authHeaders() },
      );
      set((state) => {
        if (!state.todayLog) return state;
        return {
          todayLog: {
            ...state.todayLog,
            meal_entries: state.todayLog.meal_entries.map((e) =>
              e.id === mealId ? { ...e, status: data.status, notes: data.notes } : e,
            ),
          },
        };
      });
    } catch {
      set({ error: 'No se pudo actualizar la comida.' });
    }
  },

  uploadMealPhoto: async (logId, mealId, file) => {
    const form = new FormData();
    form.append('photo', file);
    try {
      const { data } = await api.post<MealEntry>(
        `/my-nutrition-daily/${logId}/meals/${mealId}/photo/`,
        form,
        { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } },
      );
      set((state) => {
        if (!state.todayLog) return state;
        return {
          todayLog: {
            ...state.todayLog,
            meal_entries: state.todayLog.meal_entries.map((e) =>
              e.id === mealId ? { ...e, photo_url: data.photo_url } : e,
            ),
          },
        };
      });
    } catch {
      set({ error: 'No se pudo subir la foto.' });
    }
  },
}));
