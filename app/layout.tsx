import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './globals.css';
import AppEffects from './components/AppEffects';
import SiteChrome from './components/SiteChrome';
import { addressLine, BUSINESS } from './lib/config';

const SITE = 'https://puratinta.pages.dev';
const TITLE = 'Pura Tinta — Fotocopias e impresiones en Cipolletti';
const DESCRIPTION = `Fotocopias e impresiones en blanco y negro en Cipolletti (${BUSINESS.street}). Simple faz $100, doble faz $150. Subí tus archivos online y retiralos impresos. WhatsApp ${BUSINESS.whatsappDisplay}.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: '%s — Pura Tinta, Cipolletti' },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  icons: { icon: [{ url: '/favicon.png', sizes: '48x48' }, { url: '/brand/icon-192.png', sizes: '192x192' }], apple: '/apple-touch-icon.png' },
  openGraph: {
    title: TITLE,
    description: `Subí tus archivos y retiralos impresos en ${addressLine}. Fotocopias B/N: simple faz $100, doble faz $150.`,
    url: SITE,
    siteName: 'Pura Tinta',
    images: [{ url: '/brand/icon-512.png', width: 512, height: 512 }],
    locale: 'es_AR',
    type: 'website',
  },
};

/** Datos del negocio para Google (negocio local): nombre, rubro, dirección, mapa, contacto. */
const LOCAL_BUSINESS = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE}/#negocio`,
  name: 'Impresiones y fotocopias Pura Tinta',
  alternateName: ['Pura Tinta', 'Impresiones Pura Tinta'],
  description: 'Fotocopias e impresiones en blanco y negro, simple y doble faz. Pedidos online con retiro en el local.',
  url: SITE,
  logo: `${SITE}/brand/icon-512.png`,
  image: `${SITE}/brand/icon-512.png`,
  telephone: BUSINESS.whatsappPretty,
  priceRange: '$',
  currenciesAccepted: 'ARS',
  paymentAccepted: 'Efectivo, transferencia',
  address: {
    '@type': 'PostalAddress',
    streetAddress: BUSINESS.street,
    addressLocality: BUSINESS.city,
    addressRegion: BUSINESS.region,
    postalCode: BUSINESS.postalCode,
    addressCountry: 'AR',
  },
  geo: { '@type': 'GeoCoordinates', latitude: BUSINESS.geo.lat, longitude: BUSINESS.geo.lng },
  hasMap: BUSINESS.mapsUrl,
  areaServed: ['Cipolletti', 'Neuquén', 'Fernández Oro', 'Allen', 'Cinco Saltos'],
  sameAs: [BUSINESS.instagramUrl, BUSINESS.mapsUrl],
  makesOffer: [
    { '@type': 'Offer', name: 'Fotocopia / impresión B/N simple faz', price: 100, priceCurrency: 'ARS' },
    { '@type': 'Offer', name: 'Fotocopia / impresión B/N doble faz (por hoja)', price: 150, priceCurrency: 'ARS' },
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6a6a9',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <head>
        <link rel="preload" as="image" href="/girl/g00.webp" fetchPriority="high" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS) }} />
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
