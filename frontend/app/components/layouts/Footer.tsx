import Link from 'next/link';

const navLinks = [
  { href: '/', label: 'Inicio' },
  { href: '/la-marca-kore', label: 'La Marca Kóre' },
  { href: '/programas', label: 'Programas' },
];

const socialLinks = [
  { href: 'https://instagram.com/', label: 'Instagram' },
  { href: 'https://facebook.com/', label: 'Facebook' },
  { href: 'https://wa.me/', label: 'WhatsApp' },
  { href: 'mailto:contacto@kore.co', label: 'contacto@kore.co' },
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

      {/* KÓRE giant - stuck to bottom */}
      <span className="block font-heading font-semibold text-[14rem] md:text-[22rem] lg:text-[30rem] leading-[0.7] tracking-tight text-kore-gray-dark/5 select-none translate-y-[15%]">
        KÓRE
      </span>
    </footer>
  );
}
