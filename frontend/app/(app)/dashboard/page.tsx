'use client';

import { useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import UpcomingSessionReminder from '@/app/components/booking/UpcomingSessionReminder';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  // TODO: Replace with real data from backend when booking/package endpoints are integrated
  const sessionsRemaining = 0;
  const program = 'Sin programa activo';
  const formattedDate = 'Sin agendar';
  const formattedTime = '';
  const memberDate = '—';

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <UpcomingSessionReminder />
      <div className="w-full px-6 md:px-10 lg:px-16 pt-8 pb-16">
        {/* Top bar */}
        <div data-hero="badge" className="flex items-center justify-between mb-12">
          <div>
            <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Inicio</p>
            <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
              Hola, {user.name.split(' ')[0]}
            </h1>
          </div>
        </div>

        {/* Stats Grid */}
        <div data-hero="heading" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Program Card */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
            <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-3">Tu programa</p>
            <p className="font-heading text-xl font-semibold text-kore-wine-dark">{program}</p>
            <p className="text-sm text-kore-gray-dark/50 mt-1">Miembro desde {memberDate}</p>
          </div>

          {/* Sessions Card */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
            <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-3">Sesiones restantes</p>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-4xl font-semibold text-kore-red">{sessionsRemaining}</span>
              <span className="text-sm text-kore-gray-dark/40">de 12</span>
            </div>
            <div className="mt-3 h-2 bg-kore-gray-light/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-kore-red rounded-full transition-all duration-500"
                style={{ width: `${(sessionsRemaining / 12) * 100}%` }}
              />
            </div>
          </div>

          {/* Next Session Card */}
          <div className="bg-kore-red rounded-2xl p-6 text-white">
            <p className="text-xs text-white/60 uppercase tracking-widest mb-3">Próxima sesión</p>
            <p className="font-heading text-xl font-semibold capitalize">{formattedDate}</p>
            <p className="text-white/70 text-sm mt-1">{formattedTime}</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div data-hero="body" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Acciones rápidas</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Agendar sesión', icon: '📅' },
                  { label: 'Mi programa', icon: '📋' },
                  { label: 'Historial', icon: '📊' },
                  { label: 'Soporte', icon: '💬' },
                ].map((action) => (
                  <button
                    key={action.label}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-kore-cream/60 hover:bg-kore-cream transition-colors text-center"
                  >
                    <span className="text-2xl">{action.icon}</span>
                    <span className="text-xs text-kore-gray-dark/60 font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Actividad reciente</h2>
              <div className="space-y-4">
                {[
                  { date: '10 Feb', title: 'Sesión completada', desc: 'Tren superior — fuerza funcional', type: 'session' },
                  { date: '07 Feb', title: 'Sesión completada', desc: 'Movilidad articular y core', type: 'session' },
                  { date: '05 Feb', title: 'Evaluación postural', desc: 'Revisión trimestral de posturometría', type: 'eval' },
                  { date: '03 Feb', title: 'Sesión completada', desc: 'Tren inferior — estabilidad', type: 'session' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 py-3 border-b border-kore-gray-light/30 last:border-0">
                    <div className="flex-shrink-0 w-12 text-center">
                      <p className="text-xs text-kore-gray-dark/40">{item.date}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-kore-gray-dark">{item.title}</p>
                      <p className="text-xs text-kore-gray-dark/50 mt-0.5">{item.desc}</p>
                    </div>
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                      item.type === 'eval' ? 'bg-kore-wine-dark' : 'bg-kore-red'
                    }`} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right - Profile Sidebar */}
          <div data-hero="cta" className="space-y-6">
            {/* Profile Card */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Tu perfil</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-kore-red/10 flex items-center justify-center">
                  <span className="font-heading text-lg font-semibold text-kore-red">
                    {user.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-kore-gray-dark">{user.name}</p>
                  <p className="text-xs text-kore-gray-dark/40">{user.email}</p>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-kore-gray-light/30">
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/40">Programa</span>
                  <span className="text-kore-gray-dark font-medium">{program.split(' ')[0]}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/40">Sesiones</span>
                  <span className="text-kore-gray-dark font-medium">{sessionsRemaining} restantes</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-kore-gray-dark/40">Miembro desde</span>
                  <span className="text-kore-gray-dark font-medium capitalize">{memberDate}</span>
                </div>
              </div>
            </div>

            {/* Contact Card */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">¿Necesitas ayuda?</h2>
              <p className="text-sm text-kore-gray-dark/50 mb-4">
                Escríbenos para reagendar, resolver dudas o ajustar tu programa.
              </p>
              <a
                href="https://wa.me/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-kore-cream hover:bg-kore-gray-light/60 text-kore-gray-dark/70 font-medium py-3 rounded-lg transition-colors duration-200 text-sm"
              >
                Escribir por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
