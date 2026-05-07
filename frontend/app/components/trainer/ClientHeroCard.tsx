'use client';

import Image from 'next/image';
import HeroOrbsCard from '@/app/components/shared/HeroOrbsCard';
import RiskBadge from './RiskBadge';
import type { ClientRiskScore } from '@/lib/stores/trainerStore';

type Client = {
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  profile: {
    primary_goal: string;
  };
  next_session?: {
    starts_at: string;
  } | null;
};

const GOAL_LABELS: Record<string, string> = {
  fat_loss: 'Perder grasa',
  muscle_gain: 'Ganar masa muscular',
  rehab: 'Rehabilitación',
  general_health: 'Salud general',
  sports_performance: 'Rendimiento deportivo',
};

type Props = {
  client: Client;
  alerts: ClientRiskScore[];
};

export default function ClientHeroCard({ client, alerts }: Props) {
  const topAlert = alerts.find((a) => a.level === 'alto') ?? alerts.find((a) => a.level === 'medio');

  return (
    <HeroOrbsCard radius="2xl">
      <div className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center ring-2 ring-white/20 flex-shrink-0 overflow-hidden relative">
            {client.avatar_url ? (
              <Image src={client.avatar_url} alt="" fill className="object-cover" />
            ) : (
              <span className="text-xl font-bold text-white">{client.first_name.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-lg leading-tight truncate">
              {client.first_name} {client.last_name}
            </p>
            <p className="text-white/55 text-xs truncate">
              {GOAL_LABELS[client.profile.primary_goal] ?? client.profile.primary_goal}
            </p>
          </div>
          {topAlert && <RiskBadge level={topAlert.level} size="sm" />}
        </div>
        {client.next_session && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
            <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <div className="min-w-0">
              <p className="text-white/55 text-[10px] uppercase tracking-[0.18em]">Próxima sesión</p>
              <p className="text-white text-sm font-medium">
                {new Date(client.next_session.starts_at).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' '}·{' '}
                {new Date(client.next_session.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
            </div>
          </div>
        )}
      </div>
    </HeroOrbsCard>
  );
}
