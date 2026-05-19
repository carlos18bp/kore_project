'use client';

import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type ExerciseBrief = {
  id: number;
  name: string;
  pattern: string;
  youtube_url: string;
  explanation: string;
  is_corrective: boolean;
  primary_muscles: string;
  secondary_muscles: string;
};

export type ProgramExercise = {
  id: number;
  exercise: ExerciseBrief;
  sets: number;
  reps: number | null;
  duration_seconds: number | null;
  rest_seconds: number;
  order: number;
  notes: string;
};

export type ProgramDay = {
  id: number;
  day_number: number;
  date: string;
  day_type: 'training' | 'active_rest' | 'rest';
  exercises: ProgramExercise[];
};

export type MonthlyProgram = {
  id: number;
  customer_id: number;
  fitness_level: number;
  goal: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'published' | 'completed';
  trainer_notes: string;
  approved_at: string | null;
  created_at: string;
  days: ProgramDay[];
  booking_dates: string[];
};

export type ExerciseLog = {
  id: number;
  program_exercise: ProgramExercise;
  status: 'completed' | 'skipped' | 'not_done';
  notes: string;
};

export type DailyLog = {
  id: number;
  date: string;
  is_closed: boolean;
  closed_at: string | null;
  exercise_logs: ExerciseLog[];
};

export type TodayData = {
  program_day: ProgramDay;
  daily_log: DailyLog;
};

type ProgramState = {
  activeProgram: MonthlyProgram | null;
  todayData: TodayData | null;
  loading: boolean;
  todayLoading: boolean;
  error: string;
  fetchActiveProgram: () => Promise<void>;
  fetchTodayData: () => Promise<void>;
  updateExerciseStatus: (logId: number, exLogId: number, status: ExerciseLog['status']) => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useProgramStore = create<ProgramState>((set, get) => ({
  activeProgram: null,
  todayData: null,
  loading: false,
  todayLoading: false,
  error: '',

  fetchActiveProgram: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get<MonthlyProgram | null>('/my-program/', {
        headers: authHeaders(),
      });
      set({ activeProgram: data ?? null, loading: false });
    } catch {
      set({ activeProgram: null, loading: false, error: 'No se pudo cargar el programa.' });
    }
  },

  fetchTodayData: async () => {
    set({ todayLoading: true, error: '' });
    try {
      const { data } = await api.get<TodayData | null>('/my-program/today/', {
        headers: authHeaders(),
      });
      set({ todayData: data ?? null, todayLoading: false });
    } catch {
      set({ todayData: null, todayLoading: false, error: 'No se pudo cargar el día.' });
    }
  },

  updateExerciseStatus: async (logId, exLogId, status) => {
    try {
      const { data } = await api.patch<ExerciseLog>(
        `/my-program/logs/${logId}/exercises/${exLogId}/`,
        { status },
        { headers: authHeaders() },
      );
      set((state) => {
        if (!state.todayData) return state;
        return {
          todayData: {
            ...state.todayData,
            daily_log: {
              ...state.todayData.daily_log,
              exercise_logs: state.todayData.daily_log.exercise_logs.map((el) =>
                el.id === exLogId ? { ...el, status: data.status } : el,
              ),
            },
          },
        };
      });
    } catch {
      set({ error: 'No se pudo actualizar el ejercicio.' });
    }
  },
}));
