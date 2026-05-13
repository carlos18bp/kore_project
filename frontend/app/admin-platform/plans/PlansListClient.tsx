'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import Btn from '@/app/components/admin/Btn';
import Card from '@/app/components/admin/Card';
import Field from '@/app/components/admin/Field';
import Input from '@/app/components/admin/Input';
import SubscriptionCategoryTabs from '@/app/components/admin/SubscriptionCategoryTabs';
import Toggle from '@/app/components/admin/Toggle';
import {
  useAdminPackageStore,
  type AdminPackage,
  type PackageCategory,
  type PackagePayload,
} from '@/lib/stores/adminPackageStore';

const CATEGORY_LABEL: Record<PackageCategory, string> = {
  personalizado: 'Personalizado',
  semi_personalizado: 'Pareja / Semi',
  terapeutico: 'Terapéutico',
};

const CATEGORY_OPTIONS: Array<{ value: PackageCategory; label: string }> = [
  { value: 'personalizado', label: 'Personalizado' },
  { value: 'semi_personalizado', label: 'Pareja / Semi' },
  { value: 'terapeutico', label: 'Terapéutico' },
];

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; pkg: AdminPackage };

type FormState = {
  title: string;
  category: PackageCategory;
  sessions_count: number;
  session_duration_minutes: number;
  price: string;
  validity_days: number;
  short_description: string;
  is_active: boolean;
};

function emptyForm(): FormState {
  return {
    title: '',
    category: 'personalizado',
    sessions_count: 1,
    session_duration_minutes: 60,
    price: '0',
    validity_days: 30,
    short_description: '',
    is_active: true,
  };
}

function formFromPackage(pkg: AdminPackage): FormState {
  return {
    title: pkg.title,
    category: pkg.category,
    sessions_count: pkg.sessions_count,
    session_duration_minutes: pkg.session_duration_minutes,
    price: String(pkg.price),
    validity_days: pkg.validity_days,
    short_description: pkg.short_description,
    is_active: pkg.is_active,
  };
}

function formatPrice(value: string, currency: string) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function PlansListClient() {
  const { packages, loading, actionLoading, error, fetchPackages, createPackage, updatePackage, toggleActive } =
    useAdminPackageStore();

  const [activeCategory, setActiveCategory] = useState<PackageCategory>('personalizado');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const filtered = useMemo(
    () =>
      packages
        .filter((p) => p.category === activeCategory)
        .sort((a, b) => a.order - b.order || a.sessions_count - b.sessions_count),
    [packages, activeCategory],
  );

  const counts = useMemo(() => {
    const acc: Record<PackageCategory, number> = {
      personalizado: 0,
      semi_personalizado: 0,
      terapeutico: 0,
    };
    for (const p of packages) acc[p.category] += 1;
    return acc;
  }, [packages]);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError('');
    setModal({ mode: 'create' });
  };

  const openEdit = (pkg: AdminPackage) => {
    setForm(formFromPackage(pkg));
    setFormError('');
    setModal({ mode: 'edit', pkg });
  };

  const closeModal = () => setModal({ mode: 'closed' });

  const handleSubmit = async () => {
    setFormError('');

    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      setFormError('El título es obligatorio.');
      return;
    }
    if (form.sessions_count < 1) {
      setFormError('Debe tener al menos 1 sesión.');
      return;
    }
    if (form.session_duration_minutes < 1) {
      setFormError('La duración por sesión debe ser mayor a 0.');
      return;
    }
    if (parseFloat(form.price) < 0 || Number.isNaN(parseFloat(form.price))) {
      setFormError('El precio no es válido.');
      return;
    }
    if (form.validity_days < 1) {
      setFormError('La vigencia debe ser de al menos 1 día.');
      return;
    }

    const payload: PackagePayload = {
      title: trimmedTitle,
      short_description: form.short_description.trim(),
      category: form.category,
      sessions_count: form.sessions_count,
      session_duration_minutes: form.session_duration_minutes,
      price: form.price,
      validity_days: form.validity_days,
      is_active: form.is_active,
    };

    const result =
      modal.mode === 'create'
        ? await createPackage(payload)
        : modal.mode === 'edit'
        ? await updatePackage(modal.pkg.id, payload)
        : null;

    if (!result) return;
    if (result.ok) {
      // Switch tab to the category we just touched so the new/edited card is visible.
      setActiveCategory(result.pkg.category);
      closeModal();
    } else {
      setFormError(result.error);
    }
  };

  return (
    <AdminShell
      breadcrumb={[
        { label: 'Panel de administración', href: '/admin-platform/dashboard' },
        { label: 'Planes' },
      ]}
      title="Gestión de planes"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-kore-burgundy/55">
          Define los planes de entrenamiento que los clientes pueden contratar. Activa o desactiva
          un plan para controlar si aparece en checkout.
        </p>
        <Btn variant="primary" size="sm" onClick={openCreate}>
          ＋ Crear plan
        </Btn>
      </div>

      <SubscriptionCategoryTabs
        active={activeCategory}
        counts={counts}
        onChange={(cat) => setActiveCategory(cat as PackageCategory)}
      />

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="p-10 text-center">
          <div className="text-[13px] text-kore-burgundy/55">Cargando planes…</div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="font-heading text-lg font-semibold text-kore-burgundy">
            Sin planes en esta categoría
          </div>
          <div className="text-[13px] text-kore-burgundy/55 mt-2">
            Crea el primero con el botón “Crear plan”.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((pkg) => (
            <Card key={pkg.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-heading text-base font-semibold text-kore-burgundy leading-tight">
                    {pkg.title}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide font-bold text-kore-burgundy/55 mt-1">
                    {CATEGORY_LABEL[pkg.category]}
                  </div>
                </div>
                <Toggle
                  checked={pkg.is_active}
                  onChange={() => toggleActive(pkg.id, !pkg.is_active)}
                  label={pkg.is_active ? 'Activo' : 'Inactivo'}
                  disabled={actionLoading}
                />
              </div>

              {pkg.short_description && (
                <div className="text-[12px] text-kore-burgundy/70 leading-relaxed">
                  {pkg.short_description}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-[11px] text-kore-burgundy/65 mt-1">
                <div>
                  <div className="font-bold text-kore-burgundy text-[14px]">{pkg.sessions_count}</div>
                  <div>sesiones</div>
                </div>
                <div>
                  <div className="font-bold text-kore-burgundy text-[14px]">
                    {pkg.session_duration_minutes}′
                  </div>
                  <div>por sesión</div>
                </div>
                <div>
                  <div className="font-bold text-kore-burgundy text-[14px]">{pkg.validity_days}</div>
                  <div>días vigencia</div>
                </div>
              </div>

              <div className="font-heading text-xl font-bold text-kore-burgundy">
                {formatPrice(pkg.price, pkg.currency)}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-kore-burgundy/8">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide ${
                    pkg.is_active ? 'text-kore-sage' : 'text-kore-burgundy/45'
                  }`}
                >
                  {pkg.is_active ? '● Activo' : '○ Inactivo'}
                </span>
                <Btn variant="ghost" size="sm" onClick={() => openEdit(pkg)}>
                  Editar
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal.mode !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-kore-wine-deep/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-kore-burgundy/10">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
                {modal.mode === 'create' ? 'Nuevo plan' : `Editando plan #${modal.pkg.id}`}
              </div>
              <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1">
                {modal.mode === 'create' ? 'Crear plan de entrenamiento' : modal.pkg.title}
              </div>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <Field label="Título" required>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej. Plan Estándar"
                  maxLength={255}
                />
              </Field>

              <Field label="Categoría" required>
                <div className="flex gap-1.5 p-1 bg-kore-burgundy/6 rounded-xl border border-kore-burgundy/8">
                  {CATEGORY_OPTIONS.map((opt) => {
                    const sel = form.category === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, category: opt.value })}
                        className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold tracking-wide transition-all ${
                          sel
                            ? 'bg-white text-kore-burgundy shadow-sm'
                            : 'text-kore-burgundy/65 hover:text-kore-burgundy'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Número de sesiones" required>
                  <Input
                    type="number"
                    min={1}
                    value={form.sessions_count}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sessions_count: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </Field>
                <Field label="Duración por sesión (min)" required>
                  <Input
                    type="number"
                    min={1}
                    value={form.session_duration_minutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        session_duration_minutes: Math.max(1, Number(e.target.value) || 60),
                      })
                    }
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Precio (COP)" required>
                  <Input
                    type="number"
                    min={0}
                    step="1000"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </Field>
                <Field label="Vigencia (días)" required>
                  <Input
                    type="number"
                    min={1}
                    value={form.validity_days}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        validity_days: Math.max(1, Number(e.target.value) || 30),
                      })
                    }
                  />
                </Field>
              </div>

              <Field label="Descripción corta (opcional)" hint={`${form.short_description.length}/500`}>
                <textarea
                  value={form.short_description}
                  onChange={(e) =>
                    setForm({ ...form, short_description: e.target.value.slice(0, 500) })
                  }
                  rows={3}
                  placeholder="Frase visible en el checkout (opcional)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/85 border border-kore-burgundy/10 text-[13px] text-kore-gray-dark outline-none transition-all duration-150 focus:border-kore-red focus:ring-2 focus:ring-kore-red/15 placeholder:text-kore-burgundy/40 resize-none"
                />
              </Field>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-kore-burgundy/10 bg-kore-burgundy/3">
                <div>
                  <div className="text-[13px] font-semibold text-kore-burgundy">
                    {form.is_active ? 'Plan visible en checkout' : 'Plan oculto'}
                  </div>
                  <div className="text-[11px] text-kore-burgundy/60 mt-0.5">
                    {form.is_active
                      ? 'Los clientes pueden contratarlo.'
                      : 'No aparece para nuevos clientes (las suscripciones existentes no se ven afectadas).'}
                  </div>
                </div>
                <Toggle
                  checked={form.is_active}
                  onChange={() => setForm({ ...form, is_active: !form.is_active })}
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-700">
                  {formError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-kore-burgundy/10 flex items-center justify-end gap-2">
              <Btn variant="ghost" size="sm" onClick={closeModal} disabled={actionLoading}>
                Cancelar
              </Btn>
              <Btn variant="primary" size="sm" onClick={handleSubmit} disabled={actionLoading}>
                {actionLoading
                  ? 'Guardando…'
                  : modal.mode === 'create'
                  ? 'Crear plan'
                  : 'Guardar cambios'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
