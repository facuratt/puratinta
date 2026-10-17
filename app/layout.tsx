import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './globals.css';
import AppEffects from './components/AppEffects';
import SiteChrome from './components/SiteChrome';
import { PERF_SCRIPT } from './lib/perf';

export const metadata: Metadata = {
  metadataBase: new URL('https://puratinta.pages.dev'),
  title: 'Pura Tinta — Impresiones en blanco y negro',
  description: 'Impresiones y fotocopias en blanco y negro. Simple faz $100, doble faz $150. Subí tus archivos y retiralos impresos. WhatsApp 2972418448 · Lunes a viernes 06:30 a 22:30 · Sábados y domingos 10:00 a 22:30.',
  icons: { icon: [{ url: '/favicon.png', sizes: '48x48' }, { url: '/brand/icon-192.png', sizes: '192x192' }], apple: '/apple-touch-icon.png' },
  openGraph: {
    title: 'Pura Tinta — Impresiones en blanco y negro',
    description: 'Subí tus archivos y retiralos impresos. Fotocopias B/N: simple faz $100, doble faz $150.',
    images: [{ url: '/brand/icon-512.png', width: 512, height: 512 }],
    locale: 'es_AR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6a6a9',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" data-perf="high" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PERF_SCRIPT }} />
        <link rel="preload" as="image" href="/girl/g00.webp" fetchPriority="high" />
      </head>
      <body>
        <a href="#contenido" className="skip">Saltar al contenido</a>
        <SiteChrome />
        {children}
        <AppEffects />
      </body>
    </html>
  );
}
