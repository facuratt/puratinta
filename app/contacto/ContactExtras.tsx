'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { Icon3D, Lock, WhatsAppGlyph, Copy, Check } from '../components/icons';
import { BUSINESS, whatsappUrl } from '../lib/config';
import { openStatus } from '../lib/hours';
import { useLive } from '../lib/settings';
import { play } from '../lib/sound';

function QR({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0b0b0a', light: '#0000' } })
      .then(setSvg).catch(() => {});
  }, [value]);
  return (
    <figure className="qr">
      <div className="qr__code" role="img" aria-label={`Código QR: ${label}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export default function ContactExtras() {
  const { settings } = useLive();
  const [msg, setMsg] = useState({ name: '', text: '' });
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<ReturnType<typeof openStatus> | null>(null);
  useEffect(() => { setStatus(openStatus(settings)); }, [settings]);
  const alias = settings.mercadoPagoAlias.trim();

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = `Hola Pura Tinta! Soy ${msg.name.trim() || 'un cliente'}.\n\n${msg.text.trim()}`;
    window.open(whatsappUrl(text), '_blank', 'noopener');
  };

  return (
    <section className="cx">
      <form className="cx__card cx__form" onSubmit={send} data-reveal>
        <div className="cx__title"><Icon3D name="pen" size={72} /><h2>Mandanos un mensaje</h2></div>
        <label className="field">Tu nombre<input value={msg.name} onChange={(e) => setMsg({ ...msg, name: e.target.value })} maxLength={80} autoComplete="name" placeholder="Cómo te llamás" /></label>
        <label className="field">Mensaje<textarea value={msg.text} onChange={(e) => setMsg({ ...msg, text: e.target.value })} required rows={4} maxLength={800} placeholder="Ej: ¿Me imprimen 40 copias de un apunte para mañana?" /></label>
        <button type="submit" className="btn btn--wa" data-sfx="pop"><WhatsAppGlyph /> Enviar por WhatsApp</button>
        <p className="cx__fine">Se abre WhatsApp con tu mensaje listo para mandar al {BUSINESS.whatsappDisplay}.</p>
      </form>

      <div className="cx__card cx__qr" data-reveal style={{ ['--d' as string]: 1 }}>
        <h2>Escaneá desde el celu</h2>
        <div className="cx__qrs">
          <QR value={`https://wa.me/${BUSINESS.whatsappIntl}`} label={`WhatsApp ${BUSINESS.whatsappDisplay}`} />
          <QR value={BUSINESS.instagramUrl} label={`Instagram @${BUSINESS.instagram}`} />
        </div>
      </div>

      <div className="cx__card" data-reveal style={{ ['--d' as string]: 2 }}>
        <div className="cx__title"><Icon3D name="clock" size={72} /><h2>Horarios de atención</h2></div>
        <p className="cx__row"><span>{settings.hours.weekdays.label}</span><b>{settings.hours.weekdays.open} a {settings.hours.weekdays.close}</b></p>
        <p className="cx__row"><span>{settings.hours.weekend.label}</span><b>{settings.hours.weekend.open} a {settings.hours.weekend.close}</b></p>
        {status && <p className={`status-pill${status.open ? ' is-open' : ''}`}><i />{status.label} · {status.detail}</p>}
      </div>

      <div className="cx__card" data-reveal style={{ ['--d' as string]: 3 }}>
        <div className="cx__title"><Icon3D name="card" size={72} /><h2>Pagos · Mercado Pago</h2></div>
        {alias ? (
          <button type="button" className="alias" onClick={async () => {
            try { await navigator.clipboard.writeText(alias); setCopied(true); play('ding'); setTimeout(() => setCopied(false), 2000); } catch {}
          }} data-sfx="none">
            <span className="alias__v">{alias}</span>
            <span className="alias__h">{copied ? <><Check /> ¡copiado!</> : <><Copy /> tocá para copiar el alias</>}</span>
          </button>
        ) : (
          <p className="cx__soon">Muy pronto vas a poder pagar con alias. Por ahora, coordiná el pago por WhatsApp.</p>
        )}
      </div>

      <p className="cx__staff">¿Sos de Pura Tinta? <Link href="/ingresar"><Lock /> Ingresar al panel</Link></p>
    </section>
  );
}
