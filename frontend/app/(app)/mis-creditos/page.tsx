'use client';

import { useEffect, useRef } from 'react';
import { Flame, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';
import GlowRing from '@/app/components/shared/GlowRing';
import { useWalletStore, type CreditTransaction } from '@/lib/stores/walletStore';
import { useStoreStore } from '@/lib/stores/storeStore';

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function StreakWeekDots({ streak }: { streak: number }) {
  // Light the last `streak` days up to 7 (visual only — the streak count is the source of truth).
  const filled = Math.min(streak, 7);
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      {WEEK.map((d, i) => {
        const on = i >= 7 - filled;
        return (
          <span key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${on ? 'bg-kore-sage/30 text-kore-sage-deep' : 'bg-kore-gray-dark/[0.06] text-kore-gray-dark/30'}`}>
            {d}
          </span>
        );
      })}
    </div>
  );
}

function TxRow({ tx }: { tx: CreditTransaction }) {
  const pending = tx.status === 'pending';
  const positive = tx.amount >= 0;
  const Icon = pending ? Clock : positive ? ArrowUpRight : ArrowDownLeft;
  const tone = pending ? 'bg-amber-100 text-amber-600' : positive ? 'bg-kore-sage/20 text-kore-sage-deep' : 'bg-red-100 text-red-600';
  const date = new Date(tx.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tone}`}>
        <Icon className="w-4 h-4" strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-kore-gray-dark truncate">{tx.description}</p>
        <p className="text-[11px] text-kore-gray-dark/40">{date}{pending ? ' · en validación' : ''}</p>
      </div>
      <span className={`text-[14px] font-bold tabular-nums flex-shrink-0 ${positive ? 'text-kore-sage-deep' : 'text-red-600'}`}>
        {positive ? '+' : ''}{tx.amount}
      </span>
    </div>
  );
}

export default function MisCreditosPage() {
  const { wallet, walletLoaded, fetchWallet, transactions, txLoading, fetchTransactions } = useWalletStore();
  const { redemptions, fetchMyRedemptions } = useStoreStore();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchWallet(true); }, [fetchWallet]);
  useEffect(() => { fetchTransactions(true); }, [fetchTransactions]);
  useEffect(() => { fetchMyRedemptions(); }, [fetchMyRedemptions]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchTransactions();
    }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [fetchTransactions]);

  const ms = wallet?.next_milestone ?? null;
  const bonusProgress = ms ? Math.round(((ms.days - ms.remaining) / ms.days) * 100) : 100;

  return (
    <div className="px-4 py-6 max-w-xl mx-auto space-y-5" data-testid="mis-creditos">
      <h1 className="font-heading text-[24px] font-semibold text-kore-wine-dark">Mis créditos</h1>

      {/* Balance */}
      <div className="rounded-2xl p-6 shadow-lg text-center" style={{ background: 'linear-gradient(135deg, #2D0F1A 0%, #4A1828 55%, #670F22 100%)' }}>
        <p className="text-[11px] uppercase tracking-[0.16em] font-semibold" style={{ color: '#E7C8A0' }}>Balance</p>
        <div className="flex items-stretch justify-center gap-6 mt-3">
          <div>
            <p className="font-heading font-black tabular-nums leading-none" style={{ color: '#FFF8EC', fontSize: 'clamp(36px, 11vw, 52px)' }}>
              {walletLoaded && wallet ? wallet.balance : '—'}
            </p>
            <p className="text-[11px] mt-1" style={{ color: '#FFE9DC', opacity: 0.75 }}>Disponibles</p>
          </div>
          <div className="w-px self-stretch" style={{ background: 'rgba(231,200,160,0.25)' }} />
          <div>
            <p className="font-heading font-black tabular-nums leading-none" style={{ color: '#E7C8A0', fontSize: 'clamp(36px, 11vw, 52px)' }}>
              {wallet ? wallet.pending_balance : '—'}
            </p>
            <p className="text-[11px] mt-1" style={{ color: '#FFE9DC', opacity: 0.6 }}>Por aprobar</p>
          </div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: '#FFE9DC', opacity: 0.55 }}>
          Solo puedes canjear con los créditos disponibles.
        </p>
      </div>

      {/* Streak */}
      <div className="bg-white rounded-2xl p-6 border border-kore-gray-light/40 shadow-sm text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-4">Tu racha</p>
        <div className="flex justify-center">
          <GlowRing value={ms ? bonusProgress : 100} size={132} stroke={10} gradientFrom="#E7C8A0" gradientTo="#E00000" glowColor="rgba(224,0,0,0.35)" trackColor="rgba(103,15,34,0.10)">
            <div className="flex flex-col items-center">
              <Flame className="w-5 h-5 text-kore-red mb-0.5" strokeWidth={2} />
              <span className="font-heading text-[30px] font-black text-kore-wine-dark leading-none tabular-nums">{wallet?.current_streak ?? 0}</span>
              <span className="text-[10px] text-kore-gray-dark/50 font-semibold uppercase tracking-wide">días</span>
            </div>
          </GlowRing>
        </div>
        <StreakWeekDots streak={wallet?.current_streak ?? 0} />
        {ms ? (
          <p className="text-[13px] text-kore-gray-dark/70 mt-4">
            Faltan <span className="font-bold text-kore-wine-dark">{ms.remaining}</span> {ms.remaining === 1 ? 'día' : 'días'} para tu bono de <span className="font-bold text-kore-red">+{ms.bonus}</span>
          </p>
        ) : (
          <p className="text-[13px] text-kore-gray-dark/70 mt-4">¡Racha máxima! Sigue así para mantenerla.</p>
        )}
        {wallet && wallet.longest_streak > 0 && (
          <p className="text-[11px] text-kore-gray-dark/40 mt-1">Tu récord: {wallet.longest_streak} días</p>
        )}
      </div>

      {/* Mis canjes */}
      {redemptions.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-kore-gray-light/40 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-1 px-1">Mis canjes</p>
          <div className="divide-y divide-kore-gray-light/40">
            {redemptions.map((r) => {
              const tone = r.status === 'fulfilled' ? 'bg-kore-sage/20 text-kore-sage-deep'
                : r.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600';
              const label = r.status === 'fulfilled' ? 'Entregado' : r.status === 'rejected' ? 'Rechazado' : 'Pendiente';
              return (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-kore-gray-dark truncate">{r.item_name}</p>
                    <p className="text-[11px] text-kore-gray-dark/40">{new Date(r.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {r.credits_spent} créditos</p>
                    {r.delivery_photo_url && (
                      <a href={r.delivery_photo_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-kore-sage-deep underline">Ver comprobante</a>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tone}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-2xl p-4 border border-kore-gray-light/40 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-1 px-1">Historial</p>
        {transactions.length === 0 && !txLoading ? (
          <p className="text-[13px] text-kore-gray-dark/40 py-6 text-center">
            Aún no tienes movimientos. Completa tu check-in para empezar a ganar.
          </p>
        ) : (
          <div className="divide-y divide-kore-gray-light/40">
            {transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)}
          </div>
        )}
        {txLoading && <p className="text-[12px] text-kore-gray-dark/40 py-3 text-center">Cargando…</p>}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </div>
  );
}
