'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

const goalLabels: Record<string, string> = {
  fat_loss: 'Perder grasa',
  muscle_gain: 'Ganar masa muscular',
  rehab: 'Rehabilitación',
  general_health: 'Salud general',
  sports_performance: 'Rendimiento deportivo',
};

export default function TrainerClientsPage() {
  const { user } = useAuthStore();
  const { clients, clientsLoading, fetchClients } = useTrainerStore();
  const [search, setSearch] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    return name.includes(q) || c.email.toLowerCase().includes(q);
  });

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-6 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-16">
        {/* Header */}
        <div data-hero="badge" className="mb-8 xl:mb-10">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Gestión</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            Mis Clientes
          </h1>
        </div>

        {/* Search */}
        <div data-hero="heading" className="mb-6">
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kore-gray-dark/40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar cliente por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/70 backdrop-blur-sm border border-kore-gray-light/40 rounded-xl text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/40 focus:outline-none focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red/30 transition-all"
            />
          </div>
        </div>

        {/* Client List */}
        <div data-hero="body">
          {clientsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-kore-gray-light/50 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kore-cream flex items-center justify-center">
                <svg className="w-8 h-8 text-kore-gray-dark/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <p className="text-sm text-kore-gray-dark/50">
                {search ? 'No se encontraron clientes con esa búsqueda.' : 'Aún no tienes clientes asignados.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((client) => (
                <div
                  key={client.id}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm hover:shadow-md transition-all"
                >
                  <Link href={`/trainer/clients/client?id=${client.id}`} className="flex items-start gap-4 group">
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-kore-red/20 to-kore-burgundy/10 flex items-center justify-center ring-2 ring-white shadow-sm overflow-hidden">
                      {client.avatar_url ? (
                        <img src={client.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-heading text-lg font-semibold text-kore-red">
                          {client.first_name.charAt(0)}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-kore-gray-dark truncate group-hover:text-kore-red transition-colors">
                        {client.first_name} {client.last_name}
                      </p>
                      <p className="text-xs text-kore-gray-dark/40 truncate">{client.email}</p>
                      {client.primary_goal && (
                        <span className="inline-block mt-1.5 text-xs text-kore-red/70 bg-kore-red/5 px-2 py-0.5 rounded-full font-medium">
                          {goalLabels[client.primary_goal] || client.primary_goal}
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Stats */}
                  <div className="mt-3 pt-3 border-t border-kore-gray-light/30 flex items-center gap-3 text-xs text-kore-gray-dark/50">
                    {client.active_package && (
                      <span className="font-medium text-kore-gray-dark/70">{client.active_package}</span>
                    )}
                    <span>{client.completed_sessions} sesiones</span>
                    {client.sessions_remaining > 0 && (
                      <span className="text-green-600 font-medium">{client.sessions_remaining} rest.</span>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/trainer/clients/client?id=${client.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-kore-cream/60 hover:bg-kore-cream text-kore-gray-dark/60 hover:text-kore-gray-dark text-xs font-medium transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      Ficha
                    </Link>
                    <Link
                      href={`/trainer/clients/client/anthropometry?id=${client.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-kore-red/5 hover:bg-kore-red/10 text-kore-red/70 hover:text-kore-red text-xs font-medium transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                      Antropometría
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
