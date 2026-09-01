'use client';

import { useEffect, useRef, useState } from 'react';
import { useTrainerTasksStore, type CreditReview } from '@/lib/stores/trainerTasksStore';
import { useStoreStore } from '@/lib/stores/storeStore';

function typeLabel(r: CreditReview): string {
  if (r.reference_type === 'daily_log') return 'Entrenamiento';
  if (r.reference_type === 'meal_entry') return 'Comida';
  return 'Actividad';
}

function isOverdue(r: CreditReview): boolean {
  return !!r.review_deadline && new Date(r.review_deadline).getTime() < Date.now();
}

export default function TrainerTasksPage() {
  const { creditReviews, loading, fetchPendingCreditReviews, reviewCreditTransaction } =
    useTrainerTasksStore();
  const { pendingReviews, fetchPendingReviews, reviewRedemption } = useStoreStore();

  const [tab, setTab] = useState<'creditos' | 'canjes'>('creditos');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [deliver, setDeliver] = useState<{ id: number; requiresPhoto: boolean } | null>(null);
  const deliverFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPendingCreditReviews();
    fetchPendingReviews();
  }, [fetchPendingCreditReviews, fetchPendingReviews]);

  const confirmReject = async (id: number) => {
    await reviewCreditTransaction(id, 'reject', note.trim() || undefined);
    setRejectingId(null);
    setNote('');
  };

  const openDeliver = (r: { id: number; item_type?: string }) =>
    setDeliver({ id: r.id, requiresPhoto: r.item_type === 'producto' || r.item_type === 'servicio' });

  const confirmDeliver = async () => {
    if (!deliver) return;
    const file = deliverFileRef.current?.files?.[0];
    if (deliver.requiresPhoto && !file) return;
    await reviewRedemption(deliver.id, 'fulfill', undefined, file ?? undefined);
    setDeliver(null);
  };

  return (
    <section className="min-h-screen bg-kore-cream">
      <div className="px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-5" data-testid="trainer-tareas">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-kore-wine-dark">Tareas pendientes</h1>
          <p className="text-[13px] text-kore-gray-dark/50">
            Revisa los puntos de tus clientes y las solicitudes de canje.
          </p>
        </header>

        <div className="flex gap-2">
          <button
            onClick={() => setTab('creditos')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold ${
              tab === 'creditos'
                ? 'bg-kore-red text-white'
                : 'bg-white text-kore-gray-dark/60 border border-kore-gray-light/40'
            }`}
          >
            Créditos ({creditReviews.length})
          </button>
          <button
            onClick={() => setTab('canjes')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold ${
              tab === 'canjes'
                ? 'bg-kore-red text-white'
                : 'bg-white text-kore-gray-dark/60 border border-kore-gray-light/40'
            }`}
          >
            Canjes ({pendingReviews.length})
          </button>
        </div>

        {tab === 'creditos' && (
          <div className="space-y-3">
            {creditReviews.length === 0 && !loading && (
              <p className="text-[13px] text-kore-gray-dark/40">No hay créditos por revisar.</p>
            )}
            {creditReviews.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-4 border border-kore-gray-light/40 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-kore-gray-dark truncate">
                      {r.customer_name || r.customer_email}
                    </p>
                    <p className="text-[11px] text-kore-gray-dark/45">
                      {typeLabel(r)} · +{r.amount} créditos
                    </p>
                  </div>
                  {isOverdue(r) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                      Atrasado
                    </span>
                  )}
                </div>

                {r.photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {r.photos.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt="evidencia"
                        className="w-24 h-24 object-cover rounded-lg border border-kore-gray-light/30 shrink-0"
                      />
                    ))}
                  </div>
                )}

                {rejectingId === r.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Motivo del rechazo (opcional)"
                      rows={2}
                      data-testid={`reject-note-${r.id}`}
                      className="w-full text-[13px] rounded-lg border border-kore-gray-light/40 p-2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmReject(r.id)}
                        className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-red-100 text-red-600"
                      >
                        Confirmar rechazo
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setNote('');
                        }}
                        className="text-[12px] font-semibold px-3 py-1.5 rounded-full text-kore-gray-dark/50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewCreditTransaction(r.id, 'approve')}
                      className="text-[12px] font-bold px-3.5 py-1.5 rounded-full bg-kore-sage/20 text-kore-sage-deep"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(r.id);
                        setNote('');
                      }}
                      className="text-[12px] font-bold px-3.5 py-1.5 rounded-full bg-red-100 text-red-600"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'canjes' && (
          <div className="space-y-3">
            {pendingReviews.length === 0 && (
              <p className="text-[13px] text-kore-gray-dark/40">No hay canjes pendientes.</p>
            )}
            {pendingReviews.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-4 border border-kore-gray-light/40 shadow-sm flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-kore-gray-dark truncate">
                    {r.item_name}
                  </p>
                  <p className="text-[11px] text-kore-gray-dark/45">
                    {r.customer_name} · {r.credits_spent} créditos
                  </p>
                </div>
                <button
                  onClick={() => openDeliver(r)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-kore-sage/20 text-kore-sage-deep"
                >
                  Entregar
                </button>
                <button
                  onClick={() => reviewRedemption(r.id, 'reject', 'No disponible')}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600"
                >
                  Rechazar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {deliver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          data-testid="deliver-dialog"
        >
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3">
            <p className="text-[14px] font-semibold text-kore-gray-dark">Confirmar entrega</p>
            {deliver.requiresPhoto && (
              <>
                <p className="text-[12px] text-kore-gray-dark/50">
                  Sube una foto que verifique la entrega.
                </p>
                <input
                  ref={deliverFileRef}
                  type="file"
                  accept="image/*"
                  data-testid="deliver-photo-input"
                  className="text-[12px]"
                />
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeliver(null)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full text-kore-gray-dark/50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeliver}
                className="text-[12px] font-bold px-3.5 py-1.5 rounded-full bg-kore-red text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
