import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import { useAuthStore } from '@/lib/stores/authStore';

export type CustomerProfile = {
  avatar_url: string | null;
  sex: string;
  date_of_birth: string | null;
  eps: string;
  id_type: string;
  id_number: string;
  id_expedition_date: string | null;
  address: string;
  height_cm: string | null;
  current_weight_kg: string | null;
  city: string;
  primary_goal: string;
  kore_start_date: string | null;
  profile_completed: boolean;
};

export type TodayMood = {
  mood: 'motivated' | 'neutral' | 'tired';
  date: string;
};

export type ProfileData = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  customer_profile: CustomerProfile | null;
  today_mood: TodayMood | null;
};

type UpdateProfilePayload = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  sex?: string;
  date_of_birth?: string | null;
  eps?: string;
  id_type?: string;
  id_number?: string;
  id_expedition_date?: string | null;
  address?: string;
  city?: string;
  primary_goal?: string;
};

type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
};

type ProfileState = {
  profile: ProfileData | null;
  todayMood: TodayMood | null;
  loading: boolean;
  saving: boolean;
  error: string;
  successMessage: string;

  fetchProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfilePayload) => Promise<{ success: boolean; error?: string }>;
  uploadAvatar: (file: File) => Promise<{ success: boolean; avatar_url?: string; error?: string }>;
  changePassword: (data: ChangePasswordPayload) => Promise<{ success: boolean; error?: string }>;
  submitMood: (mood: 'motivated' | 'neutral' | 'tired') => Promise<{ success: boolean; error?: string }>;
  submitWeight: (weightKg: number) => Promise<{ success: boolean; error?: string }>;
  clearMessages: () => void;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function syncAuthStoreUser(profile: ProfileData) {
  const cp = profile.customer_profile;
  const first = profile.first_name || '';
  const last = profile.last_name || '';
  const mappedUser = {
    id: String(profile.id),
    email: profile.email,
    first_name: first,
    last_name: last,
    phone: profile.phone || '',
    role: profile.role,
    name: [first, last].filter(Boolean).join(' ') || profile.email,
    profile_completed: cp?.profile_completed ?? false,
    avatar_url: cp?.avatar_url ?? null,
  };

  // Only update authStore if data actually changed to prevent infinite re-render loops
  const current = useAuthStore.getState().user;
  if (current) {
    const same = (Object.keys(mappedUser) as (keyof typeof mappedUser)[]).every(
      (k) => current[k as keyof typeof current] === mappedUser[k],
    );
    if (same) return;
  }

  useAuthStore.setState({ user: mappedUser });
  Cookies.set('kore_user', JSON.stringify(mappedUser), { expires: 7 });
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  todayMood: null,
  loading: false,
  saving: false,
  error: '',
  successMessage: '',

  fetchProfile: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get<{ user: ProfileData }>('/auth/profile/', {
        headers: authHeaders(),
      });
      set({ profile: data.user, todayMood: data.user.today_mood, loading: false });
      syncAuthStoreUser(data.user);
    } catch {
      set({ loading: false, error: 'No se pudo cargar el perfil.' });
    }
  },

  updateProfile: async (payload) => {
    set({ saving: true, error: '', successMessage: '' });
    try {
      const { data } = await api.patch<{ user: ProfileData }>('/auth/profile/', payload, {
        headers: authHeaders(),
      });
      set({ profile: data.user, saving: false, successMessage: 'Perfil actualizado correctamente.' });
      syncAuthStoreUser(data.user);
      return { success: true };
    } catch {
      set({ saving: false, error: 'Error al actualizar el perfil.' });
      return { success: false, error: 'Error al actualizar el perfil.' };
    }
  },

  uploadAvatar: async (file) => {
    set({ saving: true, error: '' });
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await api.post<{ avatar_url: string }>('/auth/profile/avatar/', formData, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      // Refresh full profile to get updated data
      const profileResp = await api.get<{ user: ProfileData }>('/auth/profile/', {
        headers: authHeaders(),
      });
      set({ profile: profileResp.data.user, saving: false });
      syncAuthStoreUser(profileResp.data.user);
      return { success: true, avatar_url: data.avatar_url };
    } catch {
      set({ saving: false, error: 'Error al subir la imagen.' });
      return { success: false, error: 'Error al subir la imagen.' };
    }
  },

  changePassword: async (payload) => {
    set({ saving: true, error: '', successMessage: '' });
    try {
      await api.post('/auth/change-password/', payload, {
        headers: authHeaders(),
      });
      set({ saving: false, successMessage: 'Contraseña actualizada correctamente.' });
      return { success: true };
    } catch (err) {
      const axiosErr = err as import('axios').AxiosError<Record<string, unknown>>;
      const respData = axiosErr.response?.data;
      let message = 'Error al cambiar la contraseña.';
      if (respData) {
        const firstVal = Object.values(respData)[0];
        if (Array.isArray(firstVal)) message = firstVal[0] as string;
        else if (typeof firstVal === 'string') message = firstVal;
      }
      set({ saving: false, error: message });
      return { success: false, error: message };
    }
  },

  submitMood: async (mood) => {
    try {
      const { data } = await api.post<TodayMood>('/auth/mood/', { mood }, {
        headers: authHeaders(),
      });
      set({ todayMood: data });
      // Update profile cache
      const current = get().profile;
      if (current) {
        set({ profile: { ...current, today_mood: data } });
      }
      return { success: true };
    } catch {
      return { success: false, error: 'No se pudo registrar tu estado anímico.' };
    }
  },

  submitWeight: async (weightKg) => {
    set({ saving: true });
    try {
      await api.post('/auth/weight/', { weight_kg: weightKg }, {
        headers: authHeaders(),
      });
      // Refresh profile to get updated weight
      await get().fetchProfile();
      set({ saving: false });
      return { success: true };
    } catch {
      set({ saving: false });
      return { success: false, error: 'No se pudo registrar el peso.' };
    }
  },

  clearMessages: () => {
    set({ error: '', successMessage: '' });
  },
}));
