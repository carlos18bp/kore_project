'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useWalletStore } from '@/lib/stores/walletStore';

export default function CreditBalanceBadge() {
  const { wallet, walletLoaded, fetchWallet } = useWalletStore();
  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  return (
    <Link
      href="/mis-creditos"
      aria-label="Ver mis créditos"
      className="block w-full cursor-pointer rounded-2xl px-2.5 py-1.5 transition-transform active:scale-95"
      style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(229,229,229,0.5)' }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Sparkles className="w-[14px] h-[14px] text-kore-gold-deep shrink-0" strokeWidth={2} />
        <span className="text-[11.5px] font-semibold text-kore-gray-dark truncate tabular-nums">
          {walletLoaded && wallet ? wallet.balance : '—'}{' '}
          <span className="font-normal text-kore-gray-dark/55">créditos</span>
        </span>
      </div>
    </Link>
  );
}
