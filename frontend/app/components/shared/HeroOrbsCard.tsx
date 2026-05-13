'use client';

import { ReactNode } from 'react';

type Radius = 'lg' | 'xl' | '2xl' | '3xl';

const RADIUS_CLASS: Record<Radius, string> = {
  lg: 'rounded-2xl',
  xl: 'rounded-[22px]',
  '2xl': 'rounded-3xl',
  '3xl': 'rounded-[28px]',
};

type Props = {
  children: ReactNode;
  className?: string;
  radius?: Radius;
};

export default function HeroOrbsCard({ children, className = '', radius = 'xl' }: Props) {
  return (
    <div
      className={`relative overflow-hidden shadow-2xl ${RADIUS_CLASS[radius]} ${className}`}
      style={{ background: 'linear-gradient(135deg, #0b1220 0%, #1e293b 50%, #0b1220 100%)' }}
    >
      <style>{`
        @keyframes kore-orb-1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.15)}}
        @keyframes kore-orb-2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-50px,40px) scale(0.9)}}
        @keyframes kore-orb-3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,30px) scale(1.1)}}
        @keyframes kore-aurora{0%,100%{opacity:0.45}50%{opacity:0.85}}
      `}</style>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 80% 20%, #9A052640 0%, transparent 50%), radial-gradient(ellipse at 10% 90%, #6A041A50 0%, transparent 55%)',
          animation: 'kore-aurora 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{ top: '20%', right: '10%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, #E0000066 0%, #AB0D2F22 50%, transparent 70%)', filter: 'blur(30px)', animation: 'kore-orb-1 9s ease-in-out infinite' }}
      />
      <div
        className="absolute pointer-events-none"
        style={{ bottom: '10%', left: '20%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, #9A052655 0%, transparent 70%)', filter: 'blur(40px)', animation: 'kore-orb-2 11s ease-in-out infinite' }}
      />
      <div
        className="absolute pointer-events-none"
        style={{ top: '50%', left: '50%', width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, #CD0C3644 0%, transparent 70%)', filter: 'blur(35px)', animation: 'kore-orb-3 7s ease-in-out infinite' }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
