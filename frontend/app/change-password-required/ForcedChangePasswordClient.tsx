'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import { useAuthStore } from '@/lib/stores/authStore';
import Btn from '@/app/components/admin/Btn';
import Field from '@/app/components/admin/Field';
import Input from '@/app/components/admin/Input';

function targetForRole(role: string | undefined): string {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'trainer') return '/trainer/dashboard';
  return '/dashboard';
}

export default function ForcedChangePasswordClient() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated, hydrate } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user && !user.must_change_password) {
      router.replace(targetForRole(user.role));
    }
  }, [hydrated, isAuthenticated, user, router]);

  const handleLogout = () => {
    Cookies.remove('kore_token');
    Cookies.remove('kore_refresh');
    Cookies.remove('kore_user');
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
    router.replace('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const localErrors: Record<string, string> = {};
    if (!currentPassword) localErrors.current_password = 'Requerido';
    if (!newPassword) localErrors.new_password = 'Requerido';
    else if (newPassword.length < 8) localErrors.new_password = 'Mínimo 8 caracteres';
    if (newPassword !== confirm) localErrors.new_password_confirm = 'Las contraseñas no coinciden';
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      await api.post(
        '/auth/change-password/',
        {
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirm: confirm,
        },
        {
          headers: {
            Authorization: `Bearer ${Cookies.get('kore_token')}`,
          },
        },
      );
      // Update the cached user so the guard releases.
      const cachedUser = useAuthStore.getState().user;
      if (cachedUser) {
        const updated = { ...cachedUser, must_change_password: false };
        useAuthStore.setState({ user: updated });
        Cookies.set('kore_user', JSON.stringify(updated), { expires: 7 });
      }
      router.replace(targetForRole(cachedUser?.role));
    } catch (err: unknown) {
      const errResp = (err as { response?: { data?: Record<string, string[] | string> } }).response;
      const data = errResp?.data ?? {};
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) {
        flat[k] = Array.isArray(v) ? v[0] : String(v);
      }
      setErrors(flat);
    } finally {
      setSubmitting(false);
    }
  };

  if (!hydrated || !user) {
    return (
      <div className="min-h-dvh bg-kore-cream flex items-center justify-center">
        <span className="text-sm text-kore-burgundy/55">Cargando…</span>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-kore-cream flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="font-heading text-3xl font-bold tracking-[0.10em] text-kore-burgundy">
            KÓRE
          </div>
        </div>

        <div className="bg-white/85 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
            Primer ingreso
          </div>
          <h1 className="font-heading text-xl font-semibold text-kore-burgundy mt-1 mb-2">
            Cambia tu contraseña
          </h1>
          <p className="text-[13px] text-kore-burgundy/65 leading-relaxed mb-5">
            Tu cuenta fue creada por un administrador. Por seguridad, debes establecer una nueva
            contraseña antes de continuar.
          </p>

          <form onSubmit={handleSubmit}>
            <Field
              label="Contraseña temporal"
              required
              error={errors.current_password}
              className="mb-3.5"
            >
              <Input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </Field>

            <Field label="Nueva contraseña" required error={errors.new_password} className="mb-3.5">
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>

            <Field
              label="Confirmar contraseña"
              required
              error={errors.new_password_confirm}
              className="mb-5"
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>

            {errors.detail && (
              <div className="mb-3 px-3 py-2 rounded-xl bg-kore-red/8 border border-kore-red/20 text-[11px] text-kore-red">
                {errors.detail}
              </div>
            )}

            <Btn variant="primary" type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Cambiando…' : 'Cambiar contraseña'}
            </Btn>
          </form>
        </div>

        <div className="text-center mt-5">
          <button
            type="button"
            onClick={handleLogout}
            className="text-[12px] text-kore-burgundy/55 hover:text-kore-burgundy"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
