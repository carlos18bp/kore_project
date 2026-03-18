'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import {
  GOAL_OPTIONS, MOOD_OPTIONS, MOOD_MESSAGES, MOOD_COLORS,
} from '@/app/components/profile/ProfileIcons';
import PasswordResetModal from '@/app/components/profile/PasswordResetModal';
import { api } from '@/lib/services/http';

const SEX_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'otro', label: 'Otro' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decir' },
];

const ID_TYPE_OPTIONS = [
  { value: 'ti', label: 'Tarjeta de identidad' },
  { value: 'cc', label: 'Cédula de ciudadanía' },
  { value: 'ce', label: 'Cédula de extranjería' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'dni', label: 'DNI' },
];

export default function ProfilePage() {
  const { user } = useAuthStore();
  const {
    profile, todayMood, loading, saving, error, successMessage,
    fetchProfile, updateProfile, uploadAvatar, submitMood, clearMessages,
  } = useProfileStore();

  const sectionRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useHeroAnimation(sectionRef);

  // Form state
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', phone: '', sex: '',
    date_of_birth: '', eps: '', id_type: '', id_number: '',
    id_expedition_date: '', address: '', city: '', primary_goal: '',
  });
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCodeSending, setResetCodeSending] = useState(false);
  const [resetCodeMessage, setResetCodeMessage] = useState('');
  const [moodJustSet, setMoodJustSet] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [toastState, setToastState] = useState<'hidden' | 'typing' | 'saved'>('hidden');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFieldRef = useRef<{ field: string; value: string } | null>(null);

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchProfile();
  }, [fetchProfile]);

  // Sync form when profile loads
  useEffect(() => {
    if (profile) {
      const cp = profile.customer_profile;
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        sex: cp?.sex || '',
        date_of_birth: cp?.date_of_birth || '',
        eps: cp?.eps || '',
        id_type: cp?.id_type || '',
        id_number: cp?.id_number || '',
        id_expedition_date: cp?.id_expedition_date || '',
        address: cp?.address || '',
        city: cp?.city || '',
        primary_goal: cp?.primary_goal || '',
      });
      setAvatarPreview(cp?.avatar_url || null);
    }
  }, [profile]);

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearMessages();
    
    // Show typing toast and debounce save
    setToastState('typing');
    pendingFieldRef.current = { field, value };
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      if (pendingFieldRef.current) {
        void handleFieldSave(pendingFieldRef.current.field, pendingFieldRef.current.value);
        pendingFieldRef.current = null;
      }
    }, 1200);
  };

  const handleFieldSave = async (field: string, value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingFieldRef.current = null;
    
    clearMessages();
    const dateFields = ['date_of_birth', 'id_expedition_date'];
    const payload: Record<string, string | number | null> = {};
    if (dateFields.includes(field)) {
      payload[field] = value || null;
    } else {
      payload[field] = value;
    }
    const result = await updateProfile(payload);
    if (result?.success) {
      setToastState('saved');
      setTimeout(() => setToastState('hidden'), 2000);
    } else {
      setToastState('hidden');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    const result = await uploadAvatar(file);
    if (result.success && result.avatar_url) {
      setAvatarPreview(result.avatar_url);
    }
  };

  const handleRequestResetCode = async () => {
    if (!user?.email) return;
    setResetCodeSending(true);
    setResetCodeMessage('');
    try {
      await api.post('/auth/password-reset/request-code/', { email: user.email });
      setShowResetModal(true);
      setResetCodeMessage('');
    } catch {
      setResetCodeMessage('Error al enviar el código. Intenta de nuevo.');
    } finally {
      setResetCodeSending(false);
    }
  };

  void moodJustSet; // mood is now submitted via MoodCheckIn modal

  if (!user || loading) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  const avatarUrl = avatarPreview || profile?.customer_profile?.avatar_url;
  const koreStartDate = profile?.customer_profile?.kore_start_date
    ? new Date(profile.customer_profile.kore_start_date + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream relative overflow-hidden">
      {/* Decorative element */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.03] pointer-events-none lg:w-96 lg:h-96">
        <Image src="/images/flower_leaves.webp" alt="" fill className="object-contain" />
      </div>

      <div className="w-full px-6 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-16 relative z-10">
        {/* Save Toast */}
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${toastState !== 'hidden' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <div className={`flex items-center gap-2 px-4 py-2.5 bg-white rounded-full shadow-lg border transition-colors ${toastState === 'typing' ? 'border-amber-200' : 'border-green-100'}`}>
            {toastState === 'typing' ? (
              <>
                <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-amber-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-amber-700">Guardando...</span>
              </>
            ) : (
              <>
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-kore-gray-dark">Guardado</span>
              </>
            )}
          </div>
        </div>
        {/* Header */}
        <div data-hero="badge" className="mb-8 xl:mb-12">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Tu espacio personal</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            Mi perfil
          </h1>
        </div>

        {/* ─── Two-column dashboard grid ─── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ══════ LEFT — Main content (2 cols wide) ══════ */}
          <div className="xl:col-span-2 space-y-6 order-4 xl:order-1 contents xl:block">

            {/* ─── Card: Personal Info Form ─── */}
            <div data-hero="heading" className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/60 shadow-sm order-4 xl:order-none">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-6">Mi información</h2>

              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1.5">Nombre</label>
                    <input
                      type="text" value={formData.first_name}
                      onChange={(e) => handleFieldChange('first_name', e.target.value)}
                      onBlur={() => handleFieldSave('first_name', formData.first_name)}
                      className="w-full px-4 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1.5">Apellido</label>
                    <input
                      type="text" value={formData.last_name}
                      onChange={(e) => handleFieldChange('last_name', e.target.value)}
                      onBlur={() => handleFieldSave('last_name', formData.last_name)}
                      className="w-full px-4 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1.5">Teléfono</label>
                    <input
                      type="tel" value={formData.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      onBlur={() => handleFieldSave('phone', formData.phone)}
                      className="w-full px-4 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1.5">Sexo</label>
                    <select
                      value={formData.sex}
                      onChange={(e) => { handleFieldChange('sex', e.target.value); handleFieldSave('sex', e.target.value); }}
                      className="w-full px-4 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
                    >
                      <option value="">Seleccionar</option>
                      {SEX_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1.5">Dirección</label>
                    <input
                      type="text" value={formData.address}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      onBlur={() => handleFieldSave('address', formData.address)}
                      placeholder="Tu dirección de residencia"
                      className="w-full px-4 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1.5">Ciudad</label>
                    <input
                      type="text" value={formData.city}
                      onChange={(e) => handleFieldChange('city', e.target.value)}
                      onBlur={() => handleFieldSave('city', formData.city)}
                      placeholder="Tu ciudad"
                      className="w-full px-4 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1.5">Fecha de nacimiento</label>
                    <input
                      type="date" value={formData.date_of_birth}
                      onChange={(e) => { handleFieldChange('date_of_birth', e.target.value); handleFieldSave('date_of_birth', e.target.value); }}
                      className="w-full px-4 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1.5">EPS</label>
                    <input
                      type="text" value={formData.eps}
                      onChange={(e) => handleFieldChange('eps', e.target.value)}
                      onBlur={() => handleFieldSave('eps', formData.eps)}
                      placeholder="Tu EPS"
                      className="w-full px-4 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1.5">Tipo de documento</label>
                    <select
                      value={formData.id_type}
                      onChange={(e) => { handleFieldChange('id_type', e.target.value); handleFieldSave('id_type', e.target.value); }}
                      className="w-full px-4 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
                    >
                      <option value="">Seleccionar</option>
                      {ID_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1.5">Número de documento</label>
                    <input
                      type="text" value={formData.id_number}
                      onChange={(e) => handleFieldChange('id_number', e.target.value)}
                      onBlur={() => handleFieldSave('id_number', formData.id_number)}
                      placeholder="Tu número de documento"
                      className="w-full px-4 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1.5">Fecha de expedición</label>
                    <input
                      type="date" value={formData.id_expedition_date}
                      onChange={(e) => { handleFieldChange('id_expedition_date', e.target.value); handleFieldSave('id_expedition_date', e.target.value); }}
                      className="w-full px-4 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
                    />
                  </div>
                </div>

                              </div>
            </div>

            {/* ─── Card: Goal Selector ─── */}
            <div data-hero="body" className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/60 shadow-sm order-3 xl:order-none">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-2">Mi meta principal</h2>
              <p className="text-sm text-kore-gray-dark/50 mb-5">Selecciona tu objetivo para personalizar tu experiencia.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {GOAL_OPTIONS.map((goal) => {
                  const isSelected = formData.primary_goal === goal.value;
                  return (
                    <button
                      key={goal.value}
                      type="button"
                      onClick={async () => { 
                        setFormData((prev) => ({ ...prev, primary_goal: goal.value }));
                        setToastState('typing');
                        const result = await updateProfile({ primary_goal: goal.value }); 
                        if (result?.success) {
                          setToastState('saved');
                          setTimeout(() => setToastState('hidden'), 2000);
                        } else {
                          setToastState('hidden');
                        }
                      }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-center ${
                        isSelected
                          ? 'border-kore-red bg-kore-red/5 shadow-sm'
                          : 'border-kore-gray-light/40 bg-white/30 hover:border-kore-gray-light hover:bg-white/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isSelected ? 'bg-kore-red/10' : 'bg-kore-cream/80'
                      }`}>
                        <goal.Icon className={`w-5 h-5 ${isSelected ? 'text-kore-red' : 'text-kore-gray-dark/50'}`} />
                      </div>
                      <span className={`text-xs font-medium ${
                        isSelected ? 'text-kore-red' : 'text-kore-gray-dark/60'
                      }`}>{goal.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── Card: Security ─── */}
            <div data-hero="cta" className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/60 shadow-sm order-6 xl:order-none">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-2">Seguridad</h2>
              <p className="text-sm text-kore-gray-dark/50 mb-5">
                Para cambiar tu contraseña, te enviaremos un código de verificación a tu correo electrónico.
              </p>

              {resetCodeMessage && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2 mb-4">{resetCodeMessage}</p>
              )}

              <button
                type="button"
                onClick={handleRequestResetCode}
                disabled={resetCodeSending}
                className="w-full sm:w-auto px-8 py-3 bg-kore-gray-dark text-white font-heading font-semibold text-sm rounded-xl hover:bg-kore-gray-dark/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {resetCodeSending ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Enviando código...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Cambiar contraseña
                  </>
                )}
              </button>
            </div>

            {/* Password Reset Modal */}
            {showResetModal && user?.email && (
              <PasswordResetModal
                email={user.email}
                onClose={() => setShowResetModal(false)}
              />
            )}
          </div>

          {/* ══════ RIGHT — Sidebar cards ══════ */}
          <div className="space-y-6 contents xl:block">

            {/* ─── Card: Profile / Avatar ─── */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm order-1 xl:order-none">
              <div className="flex flex-col items-center text-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-kore-red/20 to-kore-burgundy/10 flex items-center justify-center ring-2 ring-white shadow-sm hover:ring-kore-red/30 transition-all mb-4"
                >
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                  ) : (
                    <span className="font-heading text-3xl font-semibold text-kore-red">
                      {user.name.charAt(0)}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </div>
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
                <p className="font-heading text-lg font-semibold text-kore-gray-dark">{user.name}</p>
                <p className="text-xs text-kore-gray-dark/40 mt-0.5">{user.email}</p>
                <p className="text-xs text-kore-gray-dark/40 mt-1">Miembro desde {koreStartDate}</p>
              </div>
            </div>

            {/* ─── Card: Mood Check-in (1-10) ─── */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm order-2 xl:order-none">
              <h2 className="font-heading text-base font-semibold text-kore-gray-dark mb-1">
                {todayMood ? 'Tu estado de hoy' : '¿Cómo te sientes hoy?'}
              </h2>
              <p className="text-xs text-kore-gray-dark/50 mb-4">
                Del 1 al 10, tu bienestar es parte de tu proceso.
              </p>

              {todayMood ? (
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-heading text-xl font-bold ${
                    todayMood.score >= 7 ? 'bg-green-100 text-green-700'
                    : todayMood.score >= 4 ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-600'
                  }`}>
                    {todayMood.score}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${
                      todayMood.score >= 7 ? 'text-green-700' : todayMood.score >= 4 ? 'text-amber-700' : 'text-red-600'
                    }`}>
                      {todayMood.score >= 9 ? 'Excelente' : todayMood.score >= 7 ? 'Bien' : todayMood.score >= 5 ? 'Regular' : todayMood.score >= 3 ? 'Bajo' : 'Muy bajo'}
                    </p>
                    <p className="text-xs text-kore-gray-dark/40">de 10</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-kore-gray-dark/40">Aún no has registrado tu estado de hoy.</p>
              )}

              {moodJustSet && todayMood && (
                <div className="mt-3 p-2.5 bg-kore-cream/50 rounded-xl text-center">
                  <p className="text-xs text-kore-gray-dark/70">Registrado correctamente.</p>
                </div>
              )}
            </div>

            {/* ─── Card: Quick Stats ─── */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm order-5 xl:order-none">
              <h2 className="font-heading text-base font-semibold text-kore-gray-dark mb-4">Resumen</h2>
              <div className="space-y-3">
                {formData.city && (
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/50">Ciudad</span>
                    <span className="text-kore-gray-dark font-medium">{formData.city}</span>
                  </div>
                )}
                {formData.date_of_birth && (
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/50">Fecha de nacimiento</span>
                    <span className="text-kore-gray-dark font-medium">{new Date(formData.date_of_birth + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                )}
                {formData.eps && (
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/50">EPS</span>
                    <span className="text-kore-gray-dark font-medium">{formData.eps}</span>
                  </div>
                )}
                {formData.primary_goal && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-kore-gray-dark/50">Objetivo</span>
                    <span className="text-kore-red font-medium text-xs">
                      {GOAL_OPTIONS.find((g) => g.value === formData.primary_goal)?.label}
                    </span>
                  </div>
                )}
                {!formData.city && !formData.date_of_birth && !formData.primary_goal && (
                  <p className="text-xs text-kore-gray-dark/40 text-center py-2">Completa tu perfil para ver tu resumen</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
