import type { Metadata } from 'next';
import Footer from '../components/Footer';
import OrderForm from '../components/OrderForm';
import PageHead from '../components/PageHead';
import TopBar from '../components/TopBar';

export const metadata: Metadata = { title: 'Hacer pedido — Pura Tinta' };

export default function PedidoPage() {
  return (
    <>
      <TopBar />
      <main id="contenido" className="page page--order">
        <PageHead
          eyebrow="Hacer pedido"
          title={<>Subí tus archivos<br />y <em>retiralos impresos</em>.</>}
          lede={<>1. Subí tus archivos y elegí copias y simple o doble faz. 2. Confirmá: te llevás tu ticket con el número de pedido. 3. Te avisamos por WhatsApp cuando esté listo.</>}
          icons={['printer', 'upload', 'ticket']}
        />
        <OrderForm />
      </main>
      <Footer />
    </>
  );
}
