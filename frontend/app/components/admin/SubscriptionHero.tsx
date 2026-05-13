import ProgressRing from './ProgressRing';

type DarkPillTone = 'default' | 'sage' | 'amber' | 'neutral';

function DarkPill({ tone = 'default', children }: { tone?: DarkPillTone; children: React.ReactNode }) {
  const tones: Record<DarkPillTone, string> = {
    default: 'bg-kore-gold/10 border-kore-gold/22 text-kore-ivory/85',
    sage: 'bg-kore-sage/18 border-kore-sage/40 text-kore-sage-soft',
    amber: 'bg-kore-amber/18 border-kore-amber/40 text-kore-amber',
    neutral: 'bg-kore-ivory/6 border-kore-ivory/15 text-kore-ivory/65',
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-[0.06em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

type Props = {
  id: number | string;
  categoryLabel: string;
  packageTitle: string;
  status: 'active' | 'expired' | 'canceled';
  startsAt: string;
  expiresAt: string;
  sessionsUsed: number;
  sessionsTotal: number;
};

const STATUS_LABEL: Record<Props['status'], string> = {
  active: 'Activa',
  expired: 'Expirada',
  canceled: 'Cancelada',
};

const STATUS_TONE: Record<Props['status'], DarkPillTone> = {
  active: 'sage',
  expired: 'neutral',
  canceled: 'neutral',
};

export default function SubscriptionHero({
  id,
  categoryLabel,
  packageTitle,
  status,
  startsAt,
  expiresAt,
  sessionsUsed,
  sessionsTotal,
}: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-7 xl:p-9 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-kore-gold/15 shadow-lg">
      <div className="absolute -top-16 -right-10 w-60 h-60 rounded-full bg-kore-petal/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 left-40 w-48 h-48 rounded-full bg-kore-gold/15 blur-3xl pointer-events-none" />

      <div className="relative grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-8 items-center">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.30em] text-kore-gold">
            Suscripción #{id} · {categoryLabel}
          </div>
          <div className="font-heading text-2xl xl:text-[30px] font-semibold text-kore-ivory mt-1 tracking-tight">
            {packageTitle}
          </div>
          <div className="flex gap-2 mt-3.5 flex-wrap">
            <DarkPill tone={STATUS_TONE[status]}>● {STATUS_LABEL[status]}</DarkPill>
            <DarkPill>Inicia {startsAt}</DarkPill>
            <DarkPill>{status === 'active' ? `Vence ${expiresAt}` : `Venció ${expiresAt}`}</DarkPill>
          </div>
        </div>

        <div className="flex justify-center xl:justify-end">
          <ProgressRing used={sessionsUsed} total={sessionsTotal} />
        </div>
      </div>
    </div>
  );
}
