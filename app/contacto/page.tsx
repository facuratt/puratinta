import type { Metadata } from 'next';
import ContactTiles from '../components/ContactTiles';
import Footer from '../components/Footer';
import PageHead from '../components/PageHead';
import TopBar from '../components/TopBar';
import ContactExtras from './ContactExtras';

export const metadata: Metadata = { title: 'Contacto — Pura Tinta' };

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
