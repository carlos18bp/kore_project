'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { useStoreStore, type StoreItem } from '@/lib/stores/storeStore';

function ItemCard({ item, balance, onRedeem }: { item: StoreItem; balance: number; onRedeem: (item: StoreItem) => void }) {
  const affordable = balance >= item.price_credits;
  return (
    <div className="bg-white rounded-2xl border border-kore-gray-light/40 shadow-sm overflow-hidden flex flex-col" data-testid="store-item">
      <div className="aspect-[4/3] bg-kore-cream relative">
        {item.image_url && (
          <Image src={item.image_url} alt={item.name} fill className="object-cover" unoptimized />
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="text-[14px] font-semibold text-kore-gray-dark">{item.name}</p>
        {item.description && <p className="text-[12px] text-kore-gray-dark/50 mt-1 line-clamp-2 flex-1">{item.description}</p>}
        <div className="flex items-center justify-between mt-3">
          <span className="inline-flex items-center gap-1 text-[13px] font-bold text-kore-gold-deep">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />{item.price_credits}
          </span>
          <button
            type="button"
            disabled={!affordable}
            onClick={() => onRedeem(item)}
            className={`text-[12px] font-semibold px-3 py-1.5 rounded-xl transition-colors ${affordable ? 'bg-kore-red text-white hover:bg-kore-red-dark' : 'bg-kore-gray-light/40 text-kore-gray-dark/40'}`}
          >
            {affordable ? 'Canjear' : 'Sin saldo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TiendaPage() {
  const { items, balance, loading, error, fetchCatalog, redeem } = useStoreStore();
  const [confirming, setConfirming] = useState<StoreItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState('');

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  async function doRedeem() {
    if (!confirming) return;
    setBusy(true);
    const ok = await redeem(confirming.id);
    setBusy(false);
    setConfirming(null);
    if (ok) { setOkMsg('¡Canje solicitado! Tu entrenador lo gestionará.'); setTimeout(() => setOkMsg(''), 4000); }
  }

  return (
    <div className="px-5 xl:px-10 pt-20 pb-6 space-y-5" data-testid="tienda">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[24px] font-semibold text-kore-wine-dark">Tienda</h1>
        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-kore-gold-deep bg-kore-gold/10 px-3 py-1 rounded-full">
          <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />{balance} disponibles
        </span>
      </div>

      {okMsg && <p className="text-[13px] text-kore-sage-deep bg-kore-sage/15 rounded-xl px-3 py-2">{okMsg}</p>}
      {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      {loading ? (
        <p className="text-[13px] text-kore-gray-dark/40">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-kore-gray-dark/40 py-8 text-center">Aún no hay productos en la tienda.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((it) => <ItemCard key={it.id} item={it} balance={balance} onRedeem={setConfirming} />)}
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={{ background: 'rgba(45,15,26,0.45)' }}>
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center">
            <p className="font-heading text-[18px] font-semibold text-kore-wine-dark mb-1">¿Canjear {confirming.name}?</p>
            <p className="text-[13px] text-kore-gray-dark/60 mb-5">Se descontarán <b>{confirming.price_credits} créditos</b> de tu saldo.</p>
            <div className="flex flex-col gap-2.5">
              <button type="button" disabled={busy} onClick={doRedeem} className="w-full py-3 rounded-2xl bg-kore-red text-white text-[14px] font-semibold hover:bg-kore-red-dark transition-colors disabled:opacity-60">
                {busy ? 'Canjeando…' : 'Confirmar canje'}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(null)} className="w-full py-2.5 text-[13px] text-kore-gray-dark/60">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
