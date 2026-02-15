import type { Metadata } from 'next';
import { Cinzel, Montserrat } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-cinzel',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KÓRE',
  description: 'KÓRE - Entrenamiento Personal',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${cinzel.variable} ${montserrat.variable}`}
    >
      <body suppressHydrationWarning className="antialiased font-body">
        {children}
      </body>
    </html>
  );
}
