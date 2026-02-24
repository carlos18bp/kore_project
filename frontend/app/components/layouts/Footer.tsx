import Link from 'next/link';
import { WHATSAPP_URL } from '@/lib/constants';

const navLinks = [
  { href: '/', label: 'Inicio' },
  { href: '/kore-brand', label: 'Método Kore' },
  { href: '/programs', label: 'Programas' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contacto' },
  { href: '/terms', label: 'Términos y Condiciones' },
];

const socialLinks = [
  { href: 'https://www.instagram.com/fitnesslionwarrior?igsh=anFrOHdkeGc4Ym52&utm_source=qr', label: 'Instagram' },
  { href: WHATSAPP_URL, label: 'WhatsApp' },
  { href: 'mailto:info@korehealths.com', label: 'info@korehealths.com' },
];

export default function Footer() {
  return (
    <footer className="bg-kore-cream overflow-hidden">
      {/* Links row */}
      <div className="w-full px-6 md:px-10 lg:px-16 pt-12">
        <div className="flex justify-end gap-14 lg:gap-20">
          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-kore-gray-dark/50 hover:text-kore-red transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="space-y-2">
            {socialLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-kore-gray-dark/50 hover:text-kore-red transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Terms note */}
      <p className="text-[10px] text-kore-gray-dark/40 text-right px-6 md:px-10 lg:px-16 mt-6">
        Al reservar cualquier programa, aceptas nuestros{' '}
        <a href="/terms" className="underline hover:text-kore-red transition-colors">Términos y Condiciones</a>.
      </p>

      {/* KÓRE giant - stuck to bottom */}
      <span className="block font-heading font-semibold text-[14rem] md:text-[22rem] lg:text-[30rem] leading-[0.7] tracking-tight text-kore-gray-dark/5 select-none translate-y-[15%]">
        KÓRE
      </span>
    </footer>
  );
}
