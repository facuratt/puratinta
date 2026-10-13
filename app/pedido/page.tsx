import type { Metadata } from 'next';
import OrderForm from '../order-form';
import PageShell from '../page-shell';

export const metadata: Metadata = { title: 'Hacer pedido — Pura Tinta' };

export default function PedidoPage() {
  return (
    <PageShell tag="hacer pedido" title={<>subí tus archivos<br />y retiralos impresos</>}>
      <ol className="steps">
        <li><b>1.</b> Subí tus archivos y elegí copias y simple o doble faz.</li>
        <li><b>2.</b> Confirmá: te llevás tu ticket con el número de pedido.</li>
        <li><b>3.</b> Te avisamos por WhatsApp cuando esté listo.</li>
      </ol>
      <OrderForm />
    </PageShell>
  );
}
