'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminShell from '@/app/components/admin/AdminShell';
import Btn from '@/app/components/admin/Btn';
import Card from '@/app/components/admin/Card';
import Field from '@/app/components/admin/Field';
import Input from '@/app/components/admin/Input';
import Modal from '@/app/components/admin/Modal';
import Pill from '@/app/components/admin/Pill';
import { useAdminUserStore } from '@/lib/stores/adminUserStore';
import {
  useAdminSubscriptionStore,
  type AdminCreateSubscriptionPayload,
} from '@/lib/stores/adminSubscriptionStore';
import { api } from '@/lib/services/http';
import Cookies from 'js-cookie';

type PackageItem = {
  id: number;
  title: string;
  category: 'personalizado' | 'semi_personalizado' | 'terapeutico';
  sessions_count: number;
  session_duration_minutes: number;
  price: string;
  currency: string;
  validity_days: number;
  is_active: boolean;
};

type PaymentMethod = 'cash' | 'transfer';

const CATEGORY_LABEL: Record<PackageItem['category'], string> = {
  personalizado: 'Personalizado',
  semi_personalizado: 'Pareja / Semi',
  terapeutico: 'Terapéutico',
};

const CATEGORY_TONE: Record<PackageItem['category'], string> = {
  personalizado: 'bg-kore-red/10 text-kore-red',
  semi_personalizado: 'bg-kore-sage/15 text-kore-sage',
  terapeutico: 'bg-kore-burgundy/10 text-kore-burgundy',
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatPrice(value: string | number, currency: string) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return '$0';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

function todayISODate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function addDaysISO(isoDate: string, days: number) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function NewSubscriptionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerParam = searchParams.get('customer');

  const { selected: selectedUser, fetchById: fetchUserById, fetchUsers, users } = useAdminUserStore();
  const { createOrEvolveSubscription, actionLoading } = useAdminSubscriptionStore();

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packageError, setPackageError] = useState('');

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(
    customerParam ? Number(customerParam) || null : null,
  );

  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [startsAt, setStartsAt] = useState<string>(todayISODate());
  const [sessionsUsed, setSessionsUsed] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Load all packages by walking the paginated /packages/ endpoint.
  // The default DRF pagination caps each page at 10 and ignores ?page_size,
  // so we follow `next` until exhausted instead of relying on a single call.
  useEffect(() => {
    let alive = true;
    setPackagesLoading(true);

    (async () => {
      try {
        const all: PackageItem[] = [];
        let page = 1;
        while (alive) {
          const { data } = await api.get('/packages/', {
            headers: authHeaders(),
            params: { page },
          });
          const results: PackageItem[] = (data?.results ?? data ?? []) as PackageItem[];
          all.push(...results);
          if (!data?.next) break;
          page += 1;
          if (page > 20) break; // safety stop
        }
        if (!alive) return;
        setPackages(all.filter((p) => p.is_active));
        setPackagesLoading(false);
      } catch {
        if (!alive) return;
        setPackageError('No se pudieron cargar los paquetes.');
        setPackagesLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Load user when customerId set.
  useEffect(() => {
    if (customerId) fetchUserById(customerId);
  }, [customerId, fetchUserById]);

  // Customer search for the picker.
  useEffect(() => {
    if (customerId) return;
    const handle = setTimeout(() => {
      fetchUsers({ search: customerSearch, role: 'customer', page: 1 });
    }, 200);
    return () => clearTimeout(handle);
  }, [customerSearch, customerId, fetchUsers]);

  const activeSub = useMemo(
    () => selectedUser?.subscriptions.find((s) => s.status === 'active') ?? null,
    [selectedUser],
  );
  const mode: 'create' | 'evolve' = activeSub ? 'evolve' : 'create';

  const currentPackage = useMemo(() => {
    if (!activeSub) return null;
    return packages.find((p) => p.title === activeSub.package.title) ?? null;
  }, [activeSub, packages]);

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  );

  const expiresAt = useMemo(() => {
    if (mode === 'evolve' && activeSub) return activeSub.expires_at.slice(0, 10);
    if (!selectedPackage) return '';
    return addDaysISO(startsAt, selectedPackage.validity_days);
  }, [mode, activeSub, selectedPackage, startsAt]);

  const downgradeReason = (pkg: PackageItem): string | null => {
    if (mode !== 'evolve' || !currentPackage) return null;
    if (pkg.id === currentPackage.id) return 'Es el plan actual.';
    if (parseFloat(pkg.price) <= parseFloat(currentPackage.price)) return 'Precio menor o igual al plan actual.';
    if (pkg.sessions_count <= currentPackage.sessions_count) return 'Tiene menos o igual número de sesiones.';
    return null;
  };

  const deltaAmount = useMemo(() => {
    if (mode !== 'evolve' || !selectedPackage || !currentPackage) return null;
    return parseFloat(selectedPackage.price) - parseFloat(currentPackage.price);
  }, [mode, selectedPackage, currentPackage]);

  const deltaSessions = useMemo(() => {
    if (mode !== 'evolve' || !selectedPackage || !currentPackage) return null;
    return selectedPackage.sessions_count - currentPackage.sessions_count;
  }, [mode, selectedPackage, currentPackage]);

  const submittable = !!customerId && !!selectedPackage && !downgradeReason(selectedPackage!);

  const handleSubmit = async () => {
    if (!customerId || !selectedPackage) return;
    setSubmitError('');

    const payload: AdminCreateSubscriptionPayload = {
      action: mode,
      customer_id: customerId,
      package_id: selectedPackage.id,
      payment_method: paymentMethod,
      notes: notes || undefined,
    };

    if (mode === 'create') {
      payload.starts_at = new Date(startsAt + 'T00:00:00').toISOString();
      payload.expires_at = new Date(expiresAt + 'T00:00:00').toISOString();
      payload.sessions_used = sessionsUsed;
    }

    const result = await createOrEvolveSubscription(payload);
    if (result.ok) {
      setConfirmOpen(false);
      router.push(`/admin-platform/subscriptions/${result.subscription.id}`);
      return;
    }

    if (result.error.status === 409 && result.error.expectedAction) {
      setSubmitError(
        `El estado del cliente cambió. ${
          result.error.expectedAction === 'evolve'
            ? 'Ahora tiene una suscripción activa; ciérrala o evoluciona desde su ficha.'
            : 'Ya no tiene una suscripción activa; crea una nueva.'
        }`,
      );
    } else {
      setSubmitError(result.error.detail);
    }
  };

  // ── Customer picker ─────────────────────────────────────────────────────
  const customerBlock = customerId && selectedUser ? (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
            Cliente
          </div>
          <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1">
            {selectedUser.full_name || selectedUser.email}
          </div>
          <div className="text-xs text-kore-burgundy/55 mt-0.5">{selectedUser.email}</div>
          <div className="mt-3 text-[12px] text-kore-burgundy/70">
            {activeSub ? (
              <>
                Plan actual: <strong>{activeSub.package.title}</strong> ·{' '}
                {activeSub.sessions_used}/{activeSub.sessions_total} sesiones · vence{' '}
                {new Date(activeSub.expires_at).toLocaleDateString('es-CO')}
              </>
            ) : (
              <>Sin suscripción activa.</>
            )}
          </div>
        </div>
        {!customerParam && (
          <Btn variant="ghost" size="sm" onClick={() => setCustomerId(null)}>
            Cambiar
          </Btn>
        )}
      </div>
    </Card>
  ) : (
    <Card className="p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55 mb-3">
        Selecciona el cliente
      </div>
      <Input
        placeholder="Buscar por email o nombre…"
        value={customerSearch}
        onChange={(e) => setCustomerSearch(e.target.value)}
      />
      <div className="mt-3 max-h-64 overflow-auto flex flex-col gap-1">
        {(() => {
          // Picker only surfaces customers without an active subscription — the
          // evolve flow is reached from the user's detail page, not from here.
          const eligible = users.filter((u) => !u.has_active_subscription);
          const hiddenWithActive = users.length - eligible.length;

          if (eligible.length === 0) {
            return (
              <div className="text-[12px] text-kore-burgundy/55 px-2 py-3 leading-relaxed">
                {users.length === 0
                  ? customerSearch
                    ? <>Sin resultados para “{customerSearch}”.</>
                    : <>Escribe para buscar un cliente.</>
                  : <>Todos los clientes de esta búsqueda ya tienen plan activo. Para evolucionar el plan de un cliente, entra a su ficha en <strong>/admin-platform/users</strong> y usa el botón <strong>Evolucionar plan</strong>.</>}
              </div>
            );
          }

          return (
            <>
              {eligible.slice(0, 12).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setCustomerId(u.id)}
                  className="text-left px-3 py-2 rounded-lg hover:bg-kore-burgundy/5 border border-transparent hover:border-kore-burgundy/10"
                >
                  <div className="text-[13px] font-semibold text-kore-burgundy">
                    {u.full_name || u.email}
                  </div>
                  <div className="text-[11px] text-kore-burgundy/55">{u.email}</div>
                </button>
              ))}
              {hiddenWithActive > 0 && (
                <div className="text-[10px] text-kore-burgundy/45 italic px-2 pt-2">
                  {hiddenWithActive} cliente{hiddenWithActive === 1 ? '' : 's'} con plan activo
                  oculto{hiddenWithActive === 1 ? '' : 's'} (usa su ficha para evolucionar el plan).
                </div>
              )}
            </>
          );
        })()}
      </div>
    </Card>
  );

  // ── State banner ────────────────────────────────────────────────────────
  const banner = customerId && selectedUser ? (
    activeSub ? (
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-[13px] text-blue-900">
        <strong>{selectedUser.full_name || selectedUser.email}</strong> ya tiene el plan{' '}
        <strong>{activeSub.package.title}</strong>. Esta operación será una{' '}
        <strong>evolución de plan</strong> — solo registrarás la diferencia de sesiones y precio.
      </div>
    ) : (
      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-[13px] text-emerald-900">
        Crearás una <strong>suscripción nueva</strong> para{' '}
        <strong>{selectedUser.full_name || selectedUser.email}</strong>.
      </div>
    )
  ) : null;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <AdminShell
      breadcrumb={[
        { label: 'Panel de administración', href: '/admin-platform/dashboard' },
        { label: 'Suscripciones', href: '/admin-platform/subscriptions' },
        { label: 'Crear' },
      ]}
      title="Crear / Evolucionar suscripción"
    >
      <div className="flex flex-col gap-4">
        {customerBlock}
        {banner}

        {customerId && (
          <Card className="p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55 mb-3">
              Paquete
            </div>

            {packagesLoading ? (
              <div className="text-[12px] text-kore-burgundy/55">Cargando paquetes…</div>
            ) : packageError ? (
              <div className="text-[12px] text-rose-600">{packageError}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {packages.map((pkg) => {
                  const blockedReason = downgradeReason(pkg);
                  const selected = selectedPackageId === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      disabled={!!blockedReason}
                      onClick={() => setSelectedPackageId(pkg.id)}
                      title={blockedReason ?? undefined}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        selected
                          ? 'border-kore-burgundy bg-kore-burgundy/5 shadow-sm'
                          : blockedReason
                          ? 'border-kore-burgundy/8 bg-kore-burgundy/4 opacity-40 cursor-not-allowed'
                          : 'border-kore-burgundy/10 hover:border-kore-burgundy/30 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-heading text-sm font-semibold text-kore-burgundy">
                          {pkg.title}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_TONE[pkg.category]}`}
                        >
                          {CATEGORY_LABEL[pkg.category]}
                        </span>
                      </div>
                      <div className="text-[11px] text-kore-burgundy/65 leading-relaxed">
                        {pkg.sessions_count} sesiones · {pkg.session_duration_minutes} min ·{' '}
                        {pkg.validity_days} días de vigencia
                      </div>
                      <div className="font-heading text-lg font-bold text-kore-burgundy mt-2">
                        {formatPrice(pkg.price, pkg.currency)}
                      </div>
                      {blockedReason && (
                        <div className="mt-2 text-[10px] text-kore-burgundy/55 italic">{blockedReason}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {selectedPackage && (
          <Card className="p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55 mb-3">
              Resumen del paquete
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12px]">
              <div>
                <div className="text-kore-burgundy/55">Categoría</div>
                <div className="font-semibold text-kore-burgundy">
                  {CATEGORY_LABEL[selectedPackage.category]}
                </div>
              </div>
              <div>
                <div className="text-kore-burgundy/55">Valor</div>
                <div className="font-semibold text-kore-burgundy">
                  {formatPrice(selectedPackage.price, selectedPackage.currency)}
                </div>
              </div>
              <div>
                <div className="text-kore-burgundy/55">Sesiones totales</div>
                <div className="font-semibold text-kore-burgundy">{selectedPackage.sessions_count}</div>
              </div>
              <div>
                <div className="text-kore-burgundy/55">Sesiones ya usadas</div>
                <div className="font-semibold text-kore-burgundy">
                  {mode === 'evolve' ? activeSub?.sessions_used ?? 0 : sessionsUsed}
                </div>
              </div>
              <div>
                <div className="text-kore-burgundy/55">Inicia</div>
                <div className="font-semibold text-kore-burgundy">
                  {mode === 'evolve' && activeSub
                    ? new Date(activeSub.starts_at).toLocaleDateString('es-CO')
                    : new Date(startsAt + 'T00:00:00').toLocaleDateString('es-CO')}
                </div>
              </div>
              <div>
                <div className="text-kore-burgundy/55">Termina</div>
                <div className="font-semibold text-kore-burgundy">
                  {mode === 'evolve' && activeSub
                    ? new Date(activeSub.expires_at).toLocaleDateString('es-CO')
                    : expiresAt
                    ? new Date(expiresAt + 'T00:00:00').toLocaleDateString('es-CO')
                    : '—'}
                </div>
              </div>
            </div>

            {mode === 'evolve' && deltaAmount !== null && deltaSessions !== null && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-kore-burgundy/5 border border-kore-burgundy/10">
                  <div className="text-[10px] uppercase tracking-wide text-kore-burgundy/55 font-bold">
                    Diferencia a pagar
                  </div>
                  <div className="font-heading text-xl font-bold text-kore-burgundy mt-1">
                    {formatPrice(deltaAmount, selectedPackage.currency)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-kore-sage/10 border border-kore-sage/20">
                  <div className="text-[10px] uppercase tracking-wide text-kore-sage font-bold">
                    Sesiones adicionales
                  </div>
                  <div className="font-heading text-xl font-bold text-kore-sage mt-1">+{deltaSessions}</div>
                </div>
              </div>
            )}
          </Card>
        )}

        {selectedPackage && (
          <Card className="p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55 mb-3">
              Forma de pago
            </div>
            <div className="flex gap-2">
              {(['cash', 'transfer'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 px-4 py-3 rounded-xl border text-[13px] font-semibold transition-all ${
                    paymentMethod === m
                      ? 'bg-kore-burgundy text-white border-kore-burgundy'
                      : 'bg-white text-kore-burgundy border-kore-burgundy/15 hover:border-kore-burgundy/40'
                  }`}
                >
                  {m === 'cash' ? 'Efectivo' : 'Transferencia'}
                </button>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-kore-burgundy/55 leading-relaxed">
              Los pagos por Wompi (tarjeta, Nequi, PSE, Botón Bancolombia) se registran automáticamente desde el
              checkout del cliente y no aparecen aquí.
            </div>
          </Card>
        )}

        {mode === 'create' && selectedPackage && (
          <Card className="p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55 mb-3">
              Detalles de la suscripción nueva
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Fecha de inicio">
                <Input
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </Field>
              <Field label="Fecha de fin">
                <Input
                  type="date"
                  value={expiresAt}
                  readOnly
                  className="bg-kore-burgundy/4 text-kore-burgundy/70"
                />
              </Field>
              <Field label={`Sesiones ya usadas (0 – ${selectedPackage.sessions_count})`}>
                <Input
                  type="number"
                  min={0}
                  max={selectedPackage.sessions_count}
                  value={sessionsUsed}
                  onChange={(e) => setSessionsUsed(Math.max(0, Math.min(selectedPackage.sessions_count, Number(e.target.value) || 0)))}
                />
              </Field>
            </div>
          </Card>
        )}

        {selectedPackage && (
          <Card className="p-5">
            <Field label="Notas (opcional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 250))}
                rows={3}
                placeholder="Ej: pago en sede principal, recibo #..."
                className="w-full px-3 py-2 rounded-xl border border-kore-burgundy/15 bg-white text-[13px] text-kore-burgundy placeholder:text-kore-burgundy/40 focus:outline-none focus:ring-2 focus:ring-kore-burgundy/20 resize-none"
              />
            </Field>
          </Card>
        )}

        {submitError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-700">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-1">
          <Btn variant="ghost" size="md" onClick={() => router.back()}>
            Cancelar
          </Btn>
          <Btn
            variant="primary"
            size="md"
            onClick={() => setConfirmOpen(true)}
            disabled={!submittable || actionLoading}
          >
            {mode === 'evolve' ? 'Evolucionar plan' : 'Crear suscripción'}
          </Btn>
        </div>

        <div className="text-[11px] text-kore-burgundy/45 flex items-center gap-2 mt-2">
          <Pill>{mode === 'evolve' ? 'Evolución' : 'Nueva'}</Pill>
          <span>
            Solo registras pagos fuera de plataforma — los cobros Wompi siguen su flujo automático.
          </span>
        </div>
      </div>

      {confirmOpen && selectedPackage && (
        <Modal
          title={mode === 'evolve' ? 'Confirmar evolución' : 'Confirmar nueva suscripción'}
          body={
            mode === 'evolve'
              ? `Vas a evolucionar la suscripción de ${
                  selectedUser?.full_name || selectedUser?.email
                } al plan ${selectedPackage.title}. Monto a registrar: ${formatPrice(deltaAmount ?? 0, selectedPackage.currency)} (${paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}).`
              : `Vas a crear una suscripción ${selectedPackage.title} para ${
                  selectedUser?.full_name || selectedUser?.email
                }. Monto a registrar: ${formatPrice(selectedPackage.price, selectedPackage.currency)} (${paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}).`
          }
          confirmLabel={actionLoading ? 'Registrando…' : 'Confirmar'}
          loading={actionLoading}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleSubmit}
        />
      )}
    </AdminShell>
  );
}
