import type { Metadata } from 'next';
import './globals.css';
import './pages.css';
export const metadata: Metadata = {
  title: 'Pura Tinta — Impresiones',
  description: 'Impresiones y fotocopias en blanco y negro. Simple faz $100, doble faz $150. WhatsApp +54 9 2972418448.',
  icons: { icon: '/logo-pura-tinta.webp' },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="es"><body>{children}</body></html>;
}
