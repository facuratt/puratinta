'use client';

import { useRef, useState } from 'react';
import { BUSINESS, depositFor, formatMoney, notConfirmedText, whatsappUrl, type SiteSettings } from '../lib/config';
import { play } from '../lib/sound';
import { BUCKET, orderCode, supabase } from '../lib/supabase';
import { Check, Copy, Upload, WhatsAppGlyph } from './icons';

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_RECEIPT = 15 * 1024 * 1024;

/** Mensaje de WhatsApp para mandar el comprobante (el cliente adjunta la foto o el PDF en el chat). */
export function receiptMessage(order: { number: number; total: number; customer_name: string }, settings: SiteSettings) {
  const dep = depositFor(order.total, settings.depositPct);
  return [
    `Hola Pura Tinta! Soy ${order.customer_name}. Te mando el comprobante de pago del pedido *${orderCode(order.number)}*.`,
    '',
    `Seña (${settings.depositPct}%): ${formatMoney(dep)} · Total: ${formatMoney(order.total)}`,
    'Adjunto el comprobante 👇',
  ].join('\n');
}

/** Datos para pagar: alias con botón de copiar y los dos montos posibles. */
function PayInfo({ total, settings }: { total: number; settings: SiteSettings }) {
  const [copied, setCopied] = useState(false);
  const alias = settings.mercadoPagoAlias.trim();
  const dep = depositFor(total, settings.depositPct);
  const copy = async () => {
    try { await navigator.clipboard.writeText(alias); } catch { /* sin portapapeles */ }
    setCopied(true); play('pop');
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <>
      <div className="pay__amounts">
        <div><small>Seña ({settings.depositPct}%)</small><b>{formatMoney(dep)}</b></div>
        <span>o</span>
        <div><small>Total</small><b>{formatMoney(total)}</b></div>
      </div>
      {alias ? (
        <div className="pay__alias">
          <div><small>Transferí al alias</small><code>{alias}</code></div>
          <button type="button" className="btn btn--line btn--sm" onClick={() => void copy()} data-sfx="none">
            {copied ? <><Check /> Copiado</> : <><Copy /> Copiar</>}
          </button>
        </div>
      ) : (
        <p className="pay__fine">Escribinos por WhatsApp al {BUSINESS.whatsappDisplay} y te pasamos los datos para transferir.</p>
      )}
    </>
  );
}

/** Aviso en el paso "Enviar", antes de mandar el pedido. */
export function PaymentNotice({ total, settings }: { total: number; settings: SiteSettings }) {
  return (
    <div className="pay pay--notice" role="note">
      <p className="pay__title">Pago para confirmar</p>
      <p className="pay__warn">{notConfirmedText(settings.depositPct)}</p>
      <PayInfo total={total} settings={settings} />
      <p className="pay__fine">Después de enviar el pedido, mandanos el comprobante: lo podés subir acá mismo o mandarlo por WhatsApp.</p>
    </div>
  );
}

/** Después de crear el pedido: datos de pago + subir el comprobante o mandarlo por WhatsApp. */
export default function PaymentBox({ order, settings }: {
  order: { id: string; number: number; total: number; customer_name: string };
  settings: SiteSettings;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function upload(file: File) {
    setError('');
    const type = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
    if (!RECEIPT_TYPES.includes(type)) { setError('Subí una foto (JPG o PNG) o un PDF del comprobante.'); setState('error'); play('error'); return; }
    if (file.size > MAX_RECEIPT) { setError('El archivo pesa más de 15 MB.'); setState('error'); play('error'); return; }
    setState('uploading');
    const ext = type === 'application/pdf' ? 'pdf' : type.split('/')[1].replace('jpeg', 'jpg');
    const path = `${order.id}/comprobante-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: type });
    const { data: ok } = upErr ? { data: false } : await supabase.rpc('attach_receipt', { p_id: order.id, p_path: path });
    if (upErr || !ok) {
      setError('No se pudo subir. Probá de nuevo o mandalo por WhatsApp.');
      setState('error'); play('error');
      return;
    }
    setState('done'); play('ding');
    // Aviso por mail a Pura Tinta (no bloquea).
    supabase.functions.invoke('notify-order', { body: { id: order.id, receipt: true } }).catch(() => {});
  }

  return (
    <div className="pay" aria-live="polite">
      <p className="pay__title">Falta un paso: el pago</p>
      <p className="pay__warn">{notConfirmedText(settings.depositPct)}</p>
      <PayInfo total={order.total} settings={settings} />

      {state === 'done' ? (
        <p className="pay__ok"><Check /> ¡Recibimos tu comprobante! Lo revisamos y te confirmamos el pedido por WhatsApp.</p>
      ) : (
        <>
          <p className="pay__label">Mandanos el comprobante como te quede más cómodo:</p>
          <div className="pay__actions">
            <button type="button" className="btn btn--sun" onClick={() => inputRef.current?.click()} disabled={state === 'uploading'} data-sfx="click">
              <Upload /> {state === 'uploading' ? 'Subiendo…' : 'Subir comprobante'}
            </button>
            <a className="btn btn--wa" href={whatsappUrl(receiptMessage(order, settings))} target="_blank" rel="noopener noreferrer" data-sfx="pop">
              <WhatsAppGlyph /> Por WhatsApp
            </a>
          </div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          {error && <p className="pay__error" role="alert">{error}</p>}
        </>
      )}
    </div>
  );
}
