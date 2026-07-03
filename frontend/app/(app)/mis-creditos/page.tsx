'use client';

import { useEffect } from 'react';
import { Flame } from 'lucide-react';
import GlowRing from '@/app/components/shared/GlowRing';
import { useWalletStore } from '@/lib/stores/walletStore';

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

export default function MisCreditosPage() {
  const { wallet, walletLoaded, fetchWallet } = useWalletStore();
  useEffect(() => { fetchWallet(true); }, [fetchWallet]);

  const ms = wallet?.next_milestone ?? null;
  const bonusProgress = ms ? Math.round(((ms.days - ms.remaining) / ms.days) * 100) : 100;

  return (
    <div className="px-4 py-6 max-w-xl mx-auto space-y-5" data-testid="mis-creditos">
      <h1 className="font-heading text-[24px] font-semibold text-kore-wine-dark">Mis créditos</h1>

      {/* Balance */}
      <div className="rounded-2xl p-6 shadow-lg text-center" style={{ background: 'linear-gradient(135deg, #2D0F1A 0%, #4A1828 55%, #670F22 100%)' }}>
        <p className="text-[11px] uppercase tracking-[0.16em] font-semibold" style={{ color: '#E7C8A0' }}>Balance</p>
        <p className="font-heading font-black tabular-nums mt-2" style={{ color: '#FFF8EC', fontSize: 'clamp(44px, 14vw, 64px)' }}>
          {walletLoaded && wallet ? wallet.balance : '—'}
        </p>
        <p className="text-[13px]" style={{ color: '#FFE9DC', opacity: 0.75 }}>créditos disponibles</p>
        {wallet && wallet.pending_balance > 0 && (
          <p className="text-[12px] mt-2 inline-block px-3 py-1 rounded-full" style={{ background: 'rgba(231,200,160,0.15)', color: '#E7C8A0' }}>
            +{wallet.pending_balance} en validación por tu entrenador
          </p>
        )}
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

      {/* History mounts here in Task 7 */}
    </div>
  );
}
