import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS, instagramUrl, whatsappUrl } from '../config';
import PageShell from '../page-shell';
import CopyAlias from './copy-alias';

export const metadata: Metadata = { title: 'Contacto — Pura Tinta' };

export default function ContactoPage() {
  return (
    <PageShell tag="contacto" title={<>escribinos,<br />estamos para imprimir</>}>
      <div className="contact-grid">
        <a className="contact-item" href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
          <img src="/whatsapp.svg" alt="" width="40" height="40" />
          <span className="tag">WhatsApp</span>
          <span className="headline">{BUSINESS.whatsappDisplay}</span>
        </a>
        <a className="contact-item" href={instagramUrl} target="_blank" rel="noopener noreferrer">
          <img src="/instagram.svg" alt="" width="40" height="40" />
          <span className="tag">Instagram</span>
          <span className="headline contact-ig">@{BUSINESS.instagram}</span>
        </a>
        <div className="contact-item">
          <img src="/mercadopago.svg" alt="" width="40" height="40" />
          <span className="tag">pagos · Mercado Pago</span>
          {BUSINESS.mercadoPagoAlias
            ? <CopyAlias alias={BUSINESS.mercadoPagoAlias} />
            : <span className="contact-soon">Muy pronto vas a poder pagar con alias. Por ahora, coordiná el pago por WhatsApp.</span>}
        </div>
        <div className="contact-item">
          <img src="/clock.svg" alt="" width="40" height="40" />
          <span className="tag">horarios de atención</span>
          <span>Lunes a viernes 06:30 a 22:30</span>
          <span>Sábados y domingos 10:00 a 22:30</span>
        </div>
      </div>
      <p className="staff-link">¿Sos de Pura Tinta? <Link href="/panel">Ingresar al panel de pedidos</Link></p>
    </PageShell>
  );
}
