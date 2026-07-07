'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useCreditPurchaseStore, type CreditPackage } from '@/lib/stores/creditPurchaseStore';
import { useWalletStore } from '@/lib/stores/walletStore';

function ComprarCreditosInner() {
  const { packages, loading, error, fetchCreditPackages, startCreditPurchase, fetchPurchaseStatus } = useCreditPurchaseStore();
  const { fetchWallet } = useWalletStore();
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'approved' | 'declined' | null>(null);

  useEffect(() => { fetchCreditPackages(); }, [fetchCreditPackages]);

  // On return from Wompi, poll the purchase status a few times.
  useEffect(() => {
    if (!ref) return;
    let tries = 0;
    const id = setInterval(async () => {
      tries += 1;
      const status = await fetchPurchaseStatus(ref);
      if (status && status.status !== 'pending') {
        setResult(status.status);
        if (status.status === 'approved') fetchWallet(true);
        clearInterval(id);
      }
      if (tries >= 10) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [ref, fetchPurchaseStatus, fetchWallet]);

  async function buy(pkg: CreditPackage) {
    setBusy(true);
    const url = await startCreditPurchase(pkg.id);
    if (url) window.location.href = url;
    else setBusy(false);
  }

  return (
    <div className="px-5 xl:px-10 pt-20 pb-16 space-y-5" data-testid="comprar-creditos">
      <h1 className="font-heading text-[24px] font-semibold text-kore-wine-dark">Comprar créditos</h1>

      {result === 'approved' && <p className="text-[13px] text-kore-sage-deep bg-kore-sage/15 rounded-xl px-3 py-2">¡Pago aprobado! Tus créditos ya están en tu saldo.</p>}
      {result === 'declined' && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">El pago no se completó. Intenta de nuevo.</p>}
      {ref && !result && <p className="text-[13px] text-kore-gray-dark/50">Confirmando tu pago…</p>}
      {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      {loading ? (
        <p className="text-[13px] text-kore-gray-dark/40">Cargando…</p>
      ) : packages.length === 0 ? (
        <p className="text-[13px] text-kore-gray-dark/40 py-8 text-center">No hay paquetes disponibles.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-2xl p-4 border border-kore-gray-light/40 shadow-sm flex flex-col" data-testid="credit-package">
              <span className="inline-flex items-center gap-1 text-[15px] font-bold text-kore-gold-deep">
                <Sparkles className="w-4 h-4" strokeWidth={2} />{pkg.credits}
              </span>
              <p className="text-[12px] text-kore-gray-dark/50 mt-1 flex-1">{pkg.name}</p>
              <p className="text-[13px] font-semibold text-kore-gray-dark mt-2">${pkg.price_cop.toLocaleString('es-CO')}</p>
              <button type="button" disabled={busy} onClick={() => buy(pkg)} className="mt-3 py-2 rounded-xl bg-kore-red text-white text-[12px] font-semibold hover:bg-kore-red-dark transition-colors disabled:opacity-60">
                {busy ? 'Abriendo…' : 'Comprar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComprarCreditosPage() {
  return (
    <Suspense fallback={<div className="px-5 xl:px-10 pt-20 text-[13px] text-kore-gray-dark/40">Cargando…</div>}>
      <ComprarCreditosInner />
    </Suspense>
  );
}
