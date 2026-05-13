import Avatar from './Avatar';

type DarkPillTone = 'default' | 'sage' | 'amber' | 'neutral';

type DarkPillProps = { tone?: DarkPillTone; children: React.ReactNode };

function DarkPill({ tone = 'default', children }: DarkPillProps) {
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

type UserHeroProps = {
  id: number | string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  joinedLabel?: string;
};

export default function UserHero({
  id,
  fullName,
  email,
  role,
  isActive,
  mustChangePassword,
  joinedLabel,
}: UserHeroProps) {
  const isTrainer = role === 'trainer';
  return (
    <div className="relative overflow-hidden rounded-2xl p-7 xl:p-9 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-kore-gold/15 shadow-lg">
      <div className="absolute -top-16 -right-10 w-60 h-60 rounded-full bg-kore-petal/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 left-40 w-48 h-48 rounded-full bg-kore-gold/15 blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-6 flex-wrap">
        <div className="relative flex-shrink-0">
          <Avatar name={fullName} size={84} tone={isTrainer ? 'sage' : 'sakura'} />
          {mustChangePassword && (
            <span
              title="Debe cambiar contraseña"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-kore-amber border-[3px] border-slate-900 flex items-center justify-center text-sm font-bold text-kore-wine-deep"
            >
              !
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.30em] text-kore-gold">
            Usuario #{id}
          </div>
          <div className="font-heading text-2xl xl:text-[30px] font-semibold text-kore-ivory mt-1 tracking-tight">
            {fullName}
          </div>
          <div className="text-[13px] text-kore-ivory/70 mt-1">{email}</div>
          <div className="flex gap-2 mt-3.5 flex-wrap">
            <DarkPill>{isTrainer ? '✦ Entrenador' : '♀ Cliente'}</DarkPill>
            <DarkPill tone={isActive ? 'sage' : 'neutral'}>● {isActive ? 'Activo' : 'Inactivo'}</DarkPill>
            {joinedLabel && <DarkPill>Miembro desde {joinedLabel}</DarkPill>}
            {mustChangePassword && <DarkPill tone="amber">Cambio pendiente</DarkPill>}
          </div>
        </div>
      </div>
    </div>
  );
}
