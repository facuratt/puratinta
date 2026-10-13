import { BUSINESS, formatMoney, sheetsFor, STATUS_LABELS } from './config';
import { orderCode, type Order, type OrderFile } from './supabase';

type Props = {
  order: Order;
  variant: 'cliente' | 'negocio';
  className?: string;
};

const sidesLabel = (s: OrderFile['sides']) => (s === 'doble' ? 'doble faz' : 'simple faz');

export default function Ticket({ order, variant, className = '' }: Props) {
  const files = order.order_files ?? order.files ?? [];
  const date = new Date(order.created_at);
  const totalSheets = files.reduce((n, f) => n + sheetsFor(f.pages, f.sides) * f.copies, 0);

  return (
    <div className={`ticket ${className}`}>
      <div className="ticket-head">
        <span className="ticket-logo"><img src="/logo-pura-tinta.png" alt="Pura Tinta" width="120" height="120" /></span>
        <p className="ticket-kind">{variant === 'cliente' ? 'comprobante de pedido' : 'orden de trabajo'}</p>
        <p className="ticket-code">{orderCode(order.number)}</p>
        <p>{date.toLocaleDateString('es-AR')} · {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>

      <div className="ticket-rule" />
      <p><b>Cliente:</b> {order.customer_name}</p>
      {variant === 'negocio' && (
        <>
          <p><b>WhatsApp:</b> {order.customer_phone}</p>
          {order.customer_email && <p><b>Email:</b> {order.customer_email}</p>}
          <p><b>Estado:</b> {STATUS_LABELS[order.status] ?? order.status}</p>
        </>
      )}

      <div className="ticket-rule" />
      {variant === 'negocio' && <p className="ticket-section">instrucciones de impresión</p>}
      <ol className="ticket-items">
        {files.map((f, i) => (
          <li key={f.id ?? i}>
            <span className="ticket-file">{f.file_name}</span>
            {variant === 'negocio' ? (
              <span>
                Imprimir <b>{f.copies} {f.copies === 1 ? 'copia' : 'copias'}</b> en <b>B/N {sidesLabel(f.sides)}</b> ·{' '}
                {f.pages} {f.pages === 1 ? 'página' : 'páginas'} = {sheetsFor(f.pages, f.sides) * f.copies} hojas
              </span>
            ) : (
              <span>{f.pages} pág. · {sidesLabel(f.sides)} · x{f.copies}</span>
            )}
            <span className="ticket-amount">{formatMoney(f.subtotal)}</span>
          </li>
        ))}
      </ol>

      {order.notes && (
        <>
          <div className="ticket-rule" />
          <p className="ticket-section">{variant === 'negocio' ? 'indicaciones del cliente' : 'tus indicaciones'}</p>
          <p className="ticket-notes">{order.notes}</p>
        </>
      )}

      <div className="ticket-rule" />
      {variant === 'negocio' && <p>Total de hojas: <b>{totalSheets}</b></p>}
      <p className="ticket-total"><span>TOTAL</span><span>{formatMoney(order.total)}</span></p>

      <div className="ticket-rule" />
      {variant === 'cliente' ? (
        <div className="ticket-foot">
          {BUSINESS.mercadoPagoAlias
            ? <p>Pagá por transferencia al alias de Mercado Pago <b>{BUSINESS.mercadoPagoAlias}</b> y mandá el comprobante por WhatsApp.</p>
            : <p>Coordiná el pago por WhatsApp al <b>{BUSINESS.whatsappDisplay}</b>.</p>}
          <p>Te avisamos cuando esté listo para retirar.</p>
          <p>Lun a vie 06:30 a 22:30 · Sáb y dom 10:00 a 22:30</p>
          <p className="ticket-thanks">¡gracias por elegir Pura Tinta!</p>
        </div>
      ) : (
        <div className="ticket-foot">
          <p>☐ Archivos descargados &nbsp; ☐ Impreso &nbsp; ☐ Cobrado &nbsp; ☐ Entregado</p>
        </div>
      )}
    </div>
  );
}
