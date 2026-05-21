'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import Btn from '@/app/components/admin/Btn';
import Card from '@/app/components/admin/Card';
import DarkInfoBanner from '@/app/components/admin/DarkInfoBanner';
import Field from '@/app/components/admin/Field';
import Input from '@/app/components/admin/Input';
import RoleCard from '@/app/components/admin/RoleCard';
import { useAdminUserStore, type CreateUserPayload } from '@/lib/stores/adminUserStore';

type FormState = CreateUserPayload;

const INITIAL_FORM: FormState = {
  email: '',
  first_name: '',
  last_name: '',
  phone: '',
  role: 'customer',
};

function flatten(errors: Record<string, string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors)) {
    out[k] = Array.isArray(v) ? v[0] : String(v);
  }
  return out;
}

export default function NewUserClient() {
  const router = useRouter();
  const { actionLoading, createUser } = useAdminUserStore();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const setField = <K extends keyof FormState>(key: K) => (value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const localErrors: Record<string, string> = {};
    if (!form.email) localErrors.email = 'Requerido';
    else if (!/.+@.+\..+/.test(form.email)) localErrors.email = 'Email inválido';
    if (!form.first_name) localErrors.first_name = 'Requerido';
    if (!form.last_name) localErrors.last_name = 'Requerido';
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }

    const result = await createUser(form);
    if (result.ok) {
      setSuccess(form.email);
    } else {
      setErrors(flatten(result.errors));
    }
  };

  if (success) {
    return (
      <AdminShell
        breadcrumb={[
          { label: 'Panel de administración', href: '/admin-platform/dashboard' },
          { label: 'Usuarios', href: '/admin-platform/users' },
          { label: 'Inscribir' },
        ]}
        title="Usuario inscrito"
      >
        <div className="max-w-[560px] mx-auto text-center pt-10">
          <div className="w-[84px] h-[84px] rounded-full bg-gradient-to-br from-kore-sage to-kore-sage-deep mx-auto mb-6 flex items-center justify-center shadow-[0_12px_30px_-10px_rgba(102,153,89,0.4)]">
            <span className="text-4xl text-white">✓</span>
          </div>
          <div className="font-heading text-[26px] font-semibold text-kore-burgundy mb-2">
            Usuario inscrito
          </div>
          <div className="text-sm text-kore-burgundy/65 leading-relaxed mb-7">
            Enviamos las credenciales a{' '}
            <strong className="text-kore-burgundy">{success}</strong>. Cuando ingresen por primera vez,
            se les pedirá cambiar la contraseña temporal.
          </div>
          <div className="flex justify-center gap-2.5">
            <Btn variant="ghost" onClick={() => router.push('/admin-platform/users')}>
              Ver lista de usuarios
            </Btn>
            <Btn
              variant="primary"
              onClick={() => {
                setForm(INITIAL_FORM);
                setErrors({});
                setSuccess(null);
              }}
            >
              Inscribir otro
            </Btn>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      breadcrumb={[
        { label: 'Panel de administración', href: '/admin-platform/dashboard' },
        { label: 'Usuarios', href: '/admin-platform/users' },
        { label: 'Inscribir' },
      ]}
      title="Inscribir nuevo usuario"
    >
      <div className="max-w-[720px] mx-auto">
        <Link
          href="/admin-platform/users"
          prefetch={false}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-kore-burgundy/60 mb-5 hover:text-kore-burgundy"
        >
          ← Volver a usuarios
        </Link>

        <form onSubmit={handleSubmit}>
          <Card className="p-7 mb-5">
            <div className="font-heading text-[17px] font-semibold text-kore-burgundy mb-1">
              Información del usuario
            </div>
            <div className="text-xs text-kore-burgundy/60 mb-5">
              Datos básicos para crear la cuenta. La contraseña se genera automáticamente.
            </div>

            <Field label="Correo electrónico" required error={errors.email} className="mb-4">
              <Input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={form.email}
                onChange={(e) => setField('email')(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
              <Field label="Nombre" required error={errors.first_name}>
                <Input
                  placeholder="Ana"
                  value={form.first_name}
                  onChange={(e) => setField('first_name')(e.target.value)}
                />
              </Field>
              <Field label="Apellido" required error={errors.last_name}>
                <Input
                  placeholder="Martínez"
                  value={form.last_name}
                  onChange={(e) => setField('last_name')(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Teléfono" hint="Opcional" className="mb-5">
              <Input
                placeholder="+57 300 1234567"
                value={form.phone ?? ''}
                onChange={(e) => setField('phone')(e.target.value)}
              />
            </Field>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-kore-burgundy/55 mb-2.5">
                Rol asignado <span className="text-kore-red">*</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <RoleCard
                  selected={form.role === 'customer'}
                  onSelect={() => setField('role')('customer')}
                  title="Cliente"
                  description="Accede al app móvil, ve evaluaciones y rutinas."
                  icon="♀"
                  tone="sakura"
                />
                <RoleCard
                  selected={form.role === 'trainer'}
                  onSelect={() => setField('role')('trainer')}
                  title="Entrenador"
                  description="Equipo interno. Gestiona sesiones y evaluaciones."
                  icon="✦"
                  tone="sage"
                />
              </div>
              {errors.role && <div className="mt-2 text-[11px] text-kore-red">{errors.role}</div>}
            </div>
          </Card>

          <DarkInfoBanner
            title="Cómo funciona la inscripción"
            description="Se generará una contraseña temporal aleatoria y se enviará al correo del usuario. Al primer ingreso, el sistema le pedirá establecer una nueva. Tú no verás la temporal por seguridad."
            chips={['📧 Email automático', '🔒 Cambio forzado al ingresar', '🛡 Contraseña no visible']}
          />

          <div className="flex flex-col-reverse gap-2.5 mt-6 sm:flex-row sm:justify-end">
            <Btn
              variant="ghost"
              type="button"
              className="w-full sm:w-auto"
              onClick={() => router.push('/admin-platform/users')}
            >
              Cancelar
            </Btn>
            <Btn variant="primary" type="submit" className="w-full sm:w-auto" disabled={actionLoading}>
              {actionLoading ? 'Enviando…' : 'Crear y enviar credenciales'}
            </Btn>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
