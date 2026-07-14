'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import Btn from '@/app/components/admin/Btn';
import Card from '@/app/components/admin/Card';
import Field from '@/app/components/admin/Field';
import Input from '@/app/components/admin/Input';
import Modal from '@/app/components/admin/Modal';
import Toggle from '@/app/components/admin/Toggle';
import { useAdminNutritionStore } from '@/lib/stores/adminNutritionStore';
import { useAdminPackageStore } from '@/lib/stores/adminPackageStore';

const COP = new Intl.NumberFormat('es-CO');

export default function NutritionAdminClient() {
  const product = useAdminNutritionStore((s) => s.product);
  const activeSubscriptions = useAdminNutritionStore((s) => s.activeSubscriptions);
  const loading = useAdminNutritionStore((s) => s.loading);
  const actionLoading = useAdminNutritionStore((s) => s.actionLoading);
  const storeError = useAdminNutritionStore((s) => s.error);
  const fetchProduct = useAdminNutritionStore((s) => s.fetchProduct);
  const updateProduct = useAdminNutritionStore((s) => s.updateProduct);

  const packages = useAdminPackageStore((s) => s.packages);
  const fetchPackages = useAdminPackageStore((s) => s.fetchPackages);
  const toggleNutrition = useAdminPackageStore((s) => s.toggleNutrition);

  // The price is edited as a raw string so the admin can clear and retype it;
  // validation happens on save, not on every keystroke.
  const [price, setPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetchProduct();
    fetchPackages();
  }, [fetchProduct, fetchPackages]);

  useEffect(() => {
    if (!product) return;
    setPrice(String(product.price_cop));
    setIsActive(product.is_active);
  }, [product]);

  const priceChanged = !!product && Number(price) !== product.price_cop;

  const persist = async () => {
    setConfirmOpen(false);
    await updateProduct({ price_cop: Number(price), is_active: isActive });
  };

  const handleSave = () => {
    const value = Number(price);
    if (!price.trim() || !Number.isInteger(value) || value < 0) {
      setFormError('El precio debe ser un número entero en COP, mayor o igual a 0.');
      return;
    }
    setFormError('');
    // A price change hits every nutrition subscriber's next renewal — confirm first.
    if (priceChanged) {
      setConfirmOpen(true);
      return;
    }
    persist();
  };

  return (
    <AdminShell
      breadcrumb={[
        { label: 'Panel de administración', href: '/admin-platform/dashboard' },
        { label: 'Nutrición' },
      ]}
      title="Gestión de nutrición"
    >
      <div data-testid="nutrition-admin" className="space-y-6">
        {storeError && (
          <p className="text-[13px] font-semibold text-kore-red">{storeError}</p>
        )}

        <Card className="p-5 space-y-4">
          <div>
            <h2 className="text-[15px] font-bold text-kore-burgundy">Add-on Nutrición</h2>
            <p className="text-[12px] text-kore-burgundy/60">
              Precio mensual que se suma al cobro recurrente de quien contrata nutrición.
            </p>
          </div>

          <Field
            label="Precio mensual (COP)"
            required
            error={formError}
            hint={`${activeSubscriptions} suscripción(es) activa(s) con nutrición.`}
          >
            <Input
              data-testid="nutrition-price-input"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={loading}
            />
          </Field>

          <div className="flex items-center gap-3">
            <span data-testid="nutrition-active-toggle">
              <Toggle
                checked={isActive}
                onChange={() => setIsActive(!isActive)}
                label={isActive ? 'Add-on activo' : 'Add-on inactivo'}
              />
            </span>
            <span className="text-[13px] font-semibold text-kore-burgundy">
              {isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          <Btn
            data-testid="nutrition-save"
            variant="primary"
            onClick={handleSave}
            disabled={actionLoading || loading}
          >
            Guardar precio
          </Btn>
        </Card>

        <Card className="p-5 space-y-3">
          <div>
            <h2 className="text-[15px] font-bold text-kore-burgundy">
              Planes que incluyen nutrición
            </h2>
            <p className="text-[12px] text-kore-burgundy/60">
              Quien contrate uno de estos planes recibe nutrición desde el día uno.
            </p>
          </div>

          {packages.length === 0 ? (
            <p className="text-[13px] text-kore-burgundy/60">No hay planes cargados.</p>
          ) : (
            <ul className="divide-y divide-kore-burgundy/10">
              {packages.map((pkg) => (
                <li key={pkg.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-[14px] font-semibold text-kore-burgundy">{pkg.title}</p>
                    <p className="text-[12px] text-kore-burgundy/60">
                      {COP.format(Math.trunc(Number(pkg.price) || 0))} COP
                    </p>
                  </div>
                  <span data-testid={`nutrition-toggle-${pkg.id}`}>
                    <Toggle
                      checked={pkg.includes_nutrition}
                      onChange={() => toggleNutrition(pkg.id, !pkg.includes_nutrition)}
                      label={`Nutrición en ${pkg.title}`}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {confirmOpen && (
        <div data-testid="nutrition-confirm-dialog">
          <Modal
            title="Confirmar cambio de precio"
            body={
              <p className="text-[13px] text-kore-burgundy/80">
                Esto cambiará el cobro de {activeSubscriptions} suscripción(es) activa(s) con
                nutrición en su próxima renovación.
              </p>
            }
            confirmLabel="Confirmar cambio"
            cancelLabel="Cancelar"
            loading={actionLoading}
            onClose={() => setConfirmOpen(false)}
            onConfirm={persist}
          />
        </div>
      )}
    </AdminShell>
  );
}
