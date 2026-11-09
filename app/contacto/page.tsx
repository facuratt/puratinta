import type { Metadata } from 'next';
import ContactTiles from '../components/ContactTiles';
import Footer from '../components/Footer';
import PageHead from '../components/PageHead';
import TopBar from '../components/TopBar';
import ContactExtras from './ContactExtras';

export const metadata: Metadata = {
  title: 'Contacto y cómo llegar',
  description: 'Estamos en Belgrano 467, Cipolletti. Escribinos por WhatsApp al 2972418448, mirá los horarios y dejanos tu reseña en Google.',
  alternates: { canonical: '/contacto' },
};

export default function ContactoPage() {
  return (
    <>
      <TopBar />
      <main id="contenido" className="page page--contact">
        <PageHead
          tone="blush"
          eyebrow="Contacto"
          title={<>Escribinos,<br /><em>estamos para imprimir</em>.</>}
          lede="Tocá el ícono de WhatsApp y se abre el chat listo para mandarnos un mensaje, o el de Instagram para ver el perfil."
          icons={['mail', 'whatsapp', 'instagram']}
        />
        <ContactTiles heading={false} />
        <ContactExtras />
      </main>
      <Footer />
    </>
  );
}
