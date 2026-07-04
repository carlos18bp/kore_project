'use client';

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import { useStoreStore } from '@/lib/stores/storeStore';

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type AdminItem = { id: number; name: string; price_credits: number; item_type: string; is_active: boolean };

export default function TrainerTiendaPage() {
  const { pendingReviews, fetchPendingReviews, reviewRedemption } = useStoreStore();
  const [items, setItems] = useState<AdminItem[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('servicio');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadItems() {
    const { data } = await api.get('/trainer/store-items/', { headers: authHeaders() });
    setItems(Array.isArray(data) ? data : data.results ?? []);
  }
  useEffect(() => { loadItems(); fetchPendingReviews(); }, [fetchPendingReviews]);

  async function createItem() {
    setError('');
    const p = parseInt(price, 10);
    if (!name.trim() || !p || p <= 0) { setError('Nombre y precio (>0) son obligatorios.'); return; }
    setSaving(true);
    try {
      await api.post('/trainer/store-items/', { name, price_credits: p, item_type: type }, { headers: authHeaders() });
      setName(''); setPrice(''); setType('servicio');
      await loadItems();
    } catch {
      setError('No se pudo crear el ítem.');
    } finally { setSaving(false); }
  }

  async function toggleActive(it: AdminItem) {
    await api.patch(`/trainer/store-items/${it.id}/`, { is_active: !it.is_active }, { headers: authHeaders() });
    await loadItems();
  }

  return (
    <div className="px-5 xl:px-10 pt-20 pb-16 space-y-6" data-testid="trainer-tienda">
      <h1 className="font-heading text-[24px] font-semibold text-kore-wine-dark">Tienda</h1>

      {/* Redemptions inbox */}
      <section className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-3">Solicitudes de canje</p>
        {pendingReviews.length === 0 ? (
          <p className="text-[13px] text-kore-gray-dark/40">Sin solicitudes pendientes.</p>
        ) : (
          <div className="space-y-2">
            {pendingReviews.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-kore-gray-light/30 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-kore-gray-dark truncate">{r.item_name}</p>
                  <p className="text-[11px] text-kore-gray-dark/45">{r.customer_name} · {r.credits_spent} créditos</p>
                </div>
                <button onClick={() => reviewRedemption(r.id, 'fulfill')} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-kore-sage/20 text-kore-sage-deep">Entregar</button>
                <button onClick={() => reviewRedemption(r.id, 'reject', 'No disponible')} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">Rechazar</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Catalog management */}
      <section className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50">Catálogo</p>
        {error && <p className="text-[12px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        <div className="flex flex-wrap gap-2 items-end">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="flex-1 min-w-[140px] rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio" type="number" className="w-24 rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]">
            <option value="servicio">Servicio</option>
            <option value="producto">Producto</option>
            <option value="sesion_adicional">Sesión adicional</option>
            <option value="descuento">Descuento</option>
          </select>
          <button onClick={createItem} disabled={saving} className="rounded-xl bg-kore-red text-white px-4 py-2 text-[13px] font-medium disabled:opacity-60">
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
        <div className="divide-y divide-kore-gray-light/40">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-kore-gray-dark truncate">{it.name}</p>
                <p className="text-[11px] text-kore-gray-dark/45">{it.price_credits} créditos · {it.item_type}</p>
              </div>
              <button onClick={() => toggleActive(it)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${it.is_active ? 'bg-kore-sage/20 text-kore-sage-deep' : 'bg-kore-gray-light/40 text-kore-gray-dark/40'}`}>
                {it.is_active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
