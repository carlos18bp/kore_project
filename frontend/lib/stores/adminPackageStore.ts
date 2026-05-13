import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type PackageCategory = 'personalizado' | 'semi_personalizado' | 'terapeutico';

export type AdminPackage = {
  id: number;
  title: string;
  short_description: string;
  description: string;
  category: PackageCategory;
  sessions_count: number;
  session_duration_minutes: number;
  price: string;
  currency: string;
  validity_days: number;
  terms_and_conditions: string;
  is_active: boolean;
  order: number;
  created_at: string;
  updated_at: string;
};

export type PackagePayload = {
  title: string;
  short_description?: string;
  category: PackageCategory;
  sessions_count: number;
  session_duration_minutes: number;
  price: string;
  currency?: string;
  validity_days: number;
  is_active?: boolean;
  order?: number;
};

type AdminPackageState = {
  packages: AdminPackage[];
  loading: boolean;
  actionLoading: boolean;
  error: string;

  fetchPackages: () => Promise<void>;
  createPackage: (payload: PackagePayload) => Promise<
    { ok: true; pkg: AdminPackage } | { ok: false; error: string }
  >;
  updatePackage: (
    id: number,
    payload: Partial<PackagePayload>,
  ) => Promise<{ ok: true; pkg: AdminPackage } | { ok: false; error: string }>;
  toggleActive: (id: number, next: boolean) => Promise<boolean>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function describeError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: Record<string, unknown> } };
  const data = e.response?.data;
  if (data && typeof data === 'object') {
    if (typeof data.detail === 'string') return data.detail;
    const firstField = Object.entries(data).find(([, v]) => Array.isArray(v) && v.length > 0);
    if (firstField) {
      const [field, msgs] = firstField as [string, string[]];
      return `${field}: ${msgs[0]}`;
    }
  }
  return fallback;
}

export const useAdminPackageStore = create<AdminPackageState>((set, get) => ({
  packages: [],
  loading: false,
  actionLoading: false,
  error: '',

  fetchPackages: async () => {
    // /packages/ paginates at 10 and ignores ?page_size, so walk `next` until
    // exhausted. Admin sees both active and inactive plans.
    set({ loading: true, error: '' });
    try {
      const collected: AdminPackage[] = [];
      let page = 1;
      while (true) {
        const { data } = await api.get('/packages/', {
          headers: authHeaders(),
          params: { page },
        });
        const list: AdminPackage[] = (data?.results ?? data ?? []) as AdminPackage[];
        collected.push(...list);
        if (!data?.next) break;
        page += 1;
        if (page > 20) break;
      }
      set({ packages: collected, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar los planes.', loading: false });
    }
  },

  createPackage: async (payload) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.post('/packages/', payload, { headers: authHeaders() });
      const pkg = data as AdminPackage;
      set((state) => ({
        packages: [...state.packages, pkg],
        actionLoading: false,
      }));
      return { ok: true as const, pkg };
    } catch (err) {
      const msg = describeError(err, 'No se pudo crear el plan.');
      set({ actionLoading: false, error: msg });
      return { ok: false as const, error: msg };
    }
  },

  updatePackage: async (id, payload) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.patch(`/packages/${id}/`, payload, {
        headers: authHeaders(),
      });
      const pkg = data as AdminPackage;
      set((state) => ({
        packages: state.packages.map((p) => (p.id === id ? pkg : p)),
        actionLoading: false,
      }));
      return { ok: true as const, pkg };
    } catch (err) {
      const msg = describeError(err, 'No se pudo actualizar el plan.');
      set({ actionLoading: false, error: msg });
      return { ok: false as const, error: msg };
    }
  },

  toggleActive: async (id, next) => {
    const before = get().packages;
    // Optimistic toggle keeps the UI snappy; rollback on error.
    set({
      packages: before.map((p) => (p.id === id ? { ...p, is_active: next } : p)),
      actionLoading: true,
      error: '',
    });
    try {
      const { data } = await api.patch(
        `/packages/${id}/`,
        { is_active: next },
        { headers: authHeaders() },
      );
      const pkg = data as AdminPackage;
      set((state) => ({
        packages: state.packages.map((p) => (p.id === id ? pkg : p)),
        actionLoading: false,
      }));
      return true;
    } catch (err) {
      const msg = describeError(err, 'No se pudo cambiar el estado del plan.');
      set({ packages: before, actionLoading: false, error: msg });
      return false;
    }
  },
}));
