import { BUSINESS, formatMoney, sheetsFor, sidesLabel, STATUS_LABELS, type SiteSettings } from '../lib/config';
import { orderCode, orderFiles, type Order } from '../lib/supabase';

type Props = {
  order: Order;
  variant: 'cliente' | 'negocio';
  settings: SiteSettings;
  className?: string;
};

/** Código de barras decorativo, derivado del número de pedido (siempre el mismo para el mismo pedido). */
export function Barcode({ seed }: { seed: string }) {
  let h = 2166136261;
  const bars: number[] = [];
  for (let i = 0; i < 46; i++) {
    h ^= seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h, 16777619);
    bars.push(1 + (Math.abs(h) % 3));
  }
  let x = 0;
  return (
    <svg className="barcode" viewBox="0 0 140 30" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((w, i) => {
        const r = i % 2 === 0 ? <rect key={i} x={x} y="0" width={w} height="30" /> : null;
        x += w + 0.9;
        return r;
      })}
    </svg>
  );
}

export const ticketDate = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
    time: d.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }),
  };
};

export default function Ticket({ order, variant, settings, className = '' }: Props) {
  const files = orderFiles(order);
  const { date, time } = ticketDate(order.created_at);
  const totalSheets = files.reduce((n, f) => n + sheetsFor(f.pages, f.sides) * f.copies, 0);
  const code = orderCode(order.number);
  const alias = settings.mercadoPagoAlias.trim();

  return (
    <div className={`ticket ${className}`}>
      <div className="ticket__head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ticket__logo" src="/brand/logo-pura-tinta-480.webp" alt="Impresiones Pura Tinta" width="480" height="522" />
        <p className="ticket__kind">{variant === 'cliente' ? 'Comprobante de pedido' : 'Orden de trabajo'}</p>
        <p className="ticket__code">{code}</p>
        <p>{date} · {time} h</p>
        <p className="ticket__state">Estado: {STATUS_LABELS[order.status] ?? order.status}</p>
      </div>

      <div className="ticket__rule" />
      <p className="ticket__section">Cliente</p>
      <p><b>{order.customer_name}</b></p>
      <p>WhatsApp: {order.customer_phone}</p>
      {order.customer_email && <p className="ticket__break">Email: {order.customer_email}</p>}

      <div className="ticket__rule" />
      <p className="ticket__section">{variant === 'negocio' ? 'Instrucciones de impresión' : 'Detalle'} · {files.length} {files.length === 1 ? 'archivo' : 'archivos'}</p>
      <ol className="ticket__items">
        {files.map((f, i) => {
          const sheets = sheetsFor(f.pages, f.sides) * f.copies;
          return (
            <li key={f.id ?? i}>
              <span className="ticket__file">{i + 1}. {f.file_name}</span>
              <span>
                {variant === 'negocio' ? 'Imprimir ' : ''}{f.copies} {f.copies === 1 ? 'copia' : 'copias'} · B/N {sidesLabel(f.sides)} · {f.pages} {f.pages === 1 ? 'pág.' : 'págs.'} = {sheets} {sheets === 1 ? 'hoja' : 'hojas'}
              </span>
              <span className="ticket__amount">{formatMoney(f.subtotal)}</span>
            </li>
          );
        })}
      </ol>

      {order.notes && (
        <>
          <div className="ticket__rule" />
          <p className="ticket__section">{variant === 'negocio' ? 'Indicaciones del cliente' : 'Tus indicaciones'}</p>
          <p className="ticket__notes">{order.notes}</p>
        </>
      )}

      <div className="ticket__rule" />
      <p className="ticket__line"><span>Total de hojas</span><span>{totalSheets}</span></p>
      {settings.bulk.enabled && files.some((f) => f.sides === 'doble' && f.subtotal === sheetsFor(f.pages, f.sides) * f.copies * settings.bulk.dobleSheetPrice) && (
        <p className="ticket__line"><span>Precio por cantidad</span><span>doble faz {formatMoney(settings.bulk.dobleSheetPrice)}/hoja</span></p>
      )}
      <p className="ticket__total"><span>TOTAL</span><span>{formatMoney(order.total)}</span></p>

      <div className="ticket__rule" />
      {variant === 'cliente' ? (
        <div className="ticket__foot">
          {alias
            ? <p>Pagá por transferencia al alias de Mercado Pago <b>{alias}</b> y mandá el comprobante por WhatsApp.</p>
            : <p>Coordiná el pago por WhatsApp al <b>{BUSINESS.whatsappDisplay}</b>.</p>}
          <p>Te avisamos por WhatsApp cuando esté listo para retirar. Mostrá este ticket o decí tu número de pedido.</p>
          <p className="ticket__hours">
            {settings.hours.weekdays.label} {settings.hours.weekdays.open} a {settings.hours.weekdays.close}<br />
            {settings.hours.weekend.label} {settings.hours.weekend.open} a {settings.hours.weekend.close}
          </p>
          <p>WhatsApp {BUSINESS.whatsappDisplay} · IG @{BUSINESS.instagram}</p>
          <Barcode seed={code} />
          <p className="ticket__thanks">¡gracias por elegir Pura Tinta!</p>
        </div>
      ) : (
        <div className="ticket__foot ticket__checks">
          <span>☐ Archivos descargados</span><span>☐ Impreso</span><span>☐ Cobrado</span><span>☐ Entregado</span>
        </div>
      )}
    </div>
  );
}
