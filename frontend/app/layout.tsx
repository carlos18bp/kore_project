import type { Metadata } from 'next';
import { Cinzel, Montserrat } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-cinzel',
  display: 'auto',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-montserrat',
  display: 'auto',
});

const siteUrl = 'https://korehealths.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'KÓRE Health | Entrenador Personal en Bogotá - Metodología KÓRE',
    template: '%s | KÓRE Health',
  },
  description: 'Entrenador personal en Bogotá con metodología KÓRE. Entrenamiento personalizado enfocado en movimiento consciente, salud integral y procesos con sentido. Agenda tu valoración gratis.',
  keywords: [
    'entrenador personal bogotá',
    'entrenamiento personal bogotá',
    'metodología kóre',
    'movimiento consciente',
    'entrenamiento funcional bogotá',
    'salud integral',
    'personal trainer bogotá',
    'entrenador personalizado',
    'fitness bogotá',
    'bienestar corporal',
  ],
  authors: [{ name: 'KÓRE Health' }],
  creator: 'KÓRE Health',
  publisher: 'KÓRE Health',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    url: siteUrl,
    siteName: 'KÓRE Health',
    title: 'KÓRE Health | Entrenador Personal en Bogotá',
    description: 'Entrenamiento personal con metodología KÓRE. Movimiento consciente, salud integral y procesos personalizados. Agenda tu valoración gratis.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KÓRE Health | Entrenador Personal en Bogotá',
    description: 'Entrenamiento personal con metodología KÓRE. Movimiento consciente y salud integral.',
  },
  alternates: {
    canonical: siteUrl,
  },
  verification: {
    google: 'your-google-verification-code',
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
