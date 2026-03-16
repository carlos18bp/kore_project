import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

const LS_PREFIX = 'kore_seen_';

function getSeenAt(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`${LS_PREFIX}${key}`);
}

function isUnseen(key: string, latestAt: string | null): boolean {
  if (!latestAt) return false;
  const seenAt = getSeenAt(key);
  if (!seenAt) return true;
  return new Date(latestAt) > new Date(seenAt);
}

export type KoreIndex = {
  kore_score: number | null;
  kore_category: string;
  kore_color: string;
  kore_message: string;
  components: Record<string, number>;
  modules_available: number;
  modules_total: number;
};

type PendingAssessmentsState = {
  nutritionDue: boolean;
  parqDue: boolean;
  anthropometryUnseen: boolean;
  posturometryUnseen: boolean;
  physicalEvalUnseen: boolean;
  profileIncomplete: boolean;
  subscriptionExpiring: boolean;
  koreIndex: KoreIndex | null;
  loaded: boolean;
  fetchPending: () => Promise<void>;
  markSeen: (key: string) => void;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const usePendingAssessmentsStore = create<PendingAssessmentsState>((set, get) => ({
  nutritionDue: false,
  parqDue: false,
  anthropometryUnseen: false,
  posturometryUnseen: false,
  physicalEvalUnseen: false,
  profileIncomplete: false,
  subscriptionExpiring: false,
  koreIndex: null,
  loaded: false,

  fetchPending: async () => {
    try {
      const { data } = await api.get('/my-pending-assessments/', {
        headers: authHeaders(),
      });
      set({
        nutritionDue: data.nutrition_due,
        parqDue: data.parq_due,
        anthropometryUnseen: isUnseen('anthropometry', data.latest_anthropometry_at),
        posturometryUnseen: isUnseen('posturometry', data.latest_posturometry_at),
        physicalEvalUnseen: isUnseen('physical_eval', data.latest_physical_eval_at),
        profileIncomplete: data.profile_incomplete,
        subscriptionExpiring: data.subscription_expiring,
        koreIndex: data.kore_index || null,
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  markSeen: (key: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${LS_PREFIX}${key}`, new Date().toISOString());
    // Update the corresponding flag
    if (key === 'anthropometry') set({ anthropometryUnseen: false });
    else if (key === 'posturometry') set({ posturometryUnseen: false });
    else if (key === 'physical_eval') set({ physicalEvalUnseen: false });
  },
}));
