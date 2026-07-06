'use client';

import { useEffect, useRef, useState } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import { useStoreStore } from '@/lib/stores/storeStore';

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type AdminItem = { id: number; name: string; description: string; price_credits: number; item_type: string; is_active: boolean; image_url: string | null };

const TYPES = [
  { value: 'servicio', label: 'Servicio' },
  { value: 'producto', label: 'Producto' },
  { value: 'sesion_adicional', label: 'Sesión adicional' },
];

export default function TrainerTiendaPage() {
  const { pendingReviews, fetchPendingReviews, reviewRedemption } = useStoreStore();
  const [items, setItems] = useState<AdminItem[]>([]);
  const [editing, setEditing] = useState<AdminItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('servicio');
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Delivery-photo dialog state
  const [delivering, setDelivering] = useState<{ id: number; requiresPhoto: boolean } | null>(null);
  const deliverFileRef = useRef<HTMLInputElement>(null);
  const [deliverErr, setDeliverErr] = useState('');

  async function loadItems() {
    const { data } = await api.get('/trainer/store-items/', { headers: authHeaders() });
    setItems(Array.isArray(data) ? data : data.results ?? []);
  }
  useEffect(() => { loadItems(); fetchPendingReviews(); }, [fetchPendingReviews]);

  function resetForm() {
    setEditing(null); setName(''); setDescription(''); setPrice(''); setType('servicio'); setImage(null);
  }

  function startEdit(it: AdminItem) {
    setEditing(it); setName(it.name); setDescription(it.description || '');
    setPrice(String(it.price_credits)); setType(it.item_type); setImage(null); setError('');
  }

  async function saveItem() {
    setError('');
    const p = parseInt(price, 10);
    if (!name.trim() || !p || p <= 0) { setError('Nombre y precio (>0) son obligatorios.'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', description);
      fd.append('price_credits', String(p));
      fd.append('item_type', type);
      if (image) fd.append('image', image);
      if (editing) {
        await api.patch(`/trainer/store-items/${editing.id}/`, fd, { headers: authHeaders() });
      } else {
        await api.post('/trainer/store-items/', fd, { headers: authHeaders() });
      }
      resetForm();
      await loadItems();
    } catch {
      setError('No se pudo guardar el ítem.');
    } finally { setSaving(false); }
  }

  async function toggleActive(it: AdminItem) {
    await api.patch(`/trainer/store-items/${it.id}/`, { is_active: !it.is_active }, { headers: authHeaders() });
    await loadItems();
  }

  function openDeliver(r: { id: number; item_type?: string }) {
    const requiresPhoto = r.item_type === 'producto' || r.item_type === 'servicio';
    setDeliverErr('');
    setDelivering({ id: r.id, requiresPhoto });
  }

  async function confirmDeliver() {
    if (!delivering) return;
    const file = deliverFileRef.current?.files?.[0];
    if (delivering.requiresPhoto && !file) { setDeliverErr('La foto de entrega es obligatoria.'); return; }
    const ok = await reviewRedemption(delivering.id, 'fulfill', undefined, file ?? undefined);
    if (ok) setDelivering(null);
    else setDeliverErr('No se pudo entregar. Intenta de nuevo.');
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
                <button onClick={() => openDeliver(r)} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-kore-sage/20 text-kore-sage-deep">Entregar</button>
                <button onClick={() => reviewRedemption(r.id, 'reject', 'No disponible')} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">Rechazar</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Catalog management */}
      <section className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50">{editing ? 'Editar ítem' : 'Nuevo ítem'}</p>
        {error && <p className="text-[12px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        <div className="flex flex-wrap gap-2 items-end">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="flex-1 min-w-[140px] rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio" type="number" className="w-24 rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" rows={2} className="w-full rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]" />
        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="text-[12px]" data-testid="item-image-input" />
          <button onClick={saveItem} disabled={saving} className="rounded-xl bg-kore-red text-white px-4 py-2 text-[13px] font-medium disabled:opacity-60">
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar'}
          </button>
          {editing && <button onClick={resetForm} className="text-[12px] text-kore-gray-dark/60 px-2">Cancelar</button>}
        </div>
        <div className="divide-y divide-kore-gray-light/40 pt-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-kore-gray-dark truncate">{it.name}</p>
                <p className="text-[11px] text-kore-gray-dark/45">{it.price_credits} créditos · {it.item_type}</p>
              </div>
              <button onClick={() => startEdit(it)} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-kore-gray-light/40 text-kore-gray-dark/70">Editar</button>
              <button onClick={() => toggleActive(it)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${it.is_active ? 'bg-kore-sage/20 text-kore-sage-deep' : 'bg-kore-gray-light/40 text-kore-gray-dark/40'}`}>
                {it.is_active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Delivery-photo dialog */}
      {delivering && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={{ background: 'rgba(45,15,26,0.45)' }}>
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full" data-testid="deliver-dialog">
            <p className="font-heading text-[18px] font-semibold text-kore-wine-dark mb-1">Confirmar entrega</p>
            <p className="text-[12px] text-kore-gray-dark/60 mb-3">
              {delivering.requiresPhoto ? 'Sube una foto que verifique la entrega (obligatoria).' : 'Este canje no requiere foto.'}
            </p>
            {delivering.requiresPhoto && (
              <input ref={deliverFileRef} type="file" accept="image/*" className="text-[12px] mb-2" data-testid="deliver-photo-input" />
            )}
            {deliverErr && <p className="text-[12px] text-red-600 mb-2">{deliverErr}</p>}
            <div className="flex flex-col gap-2 mt-2">
              <button onClick={confirmDeliver} className="w-full py-2.5 rounded-2xl bg-kore-red text-white text-[13px] font-semibold">Entregar</button>
              <button onClick={() => setDelivering(null)} className="w-full py-2 text-[12px] text-kore-gray-dark/60">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
