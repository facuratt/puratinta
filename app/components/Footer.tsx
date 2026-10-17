'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BUSINESS, formatMoney, whatsappUrl } from '../lib/config';
import { openStatus } from '../lib/hours';
import { getTier, onTierChange, setTier, type Tier } from '../lib/perf';
import { useLive } from '../lib/settings';
import { ArrowUpRight, Bolt, InstagramGlyph, Lock, WhatsAppGlyph } from './icons';
import { SoundToggle } from './TopBar';

export function LiteToggle() {
  const [tier, setT] = useState<Tier>('high');
  useEffect(() => { setT(getTier()); return onTierChange(setT); }, []);
  const lite = tier === 'low';
  return (
    <button type="button" className={`switch-btn${lite ? ' is-on' : ''}`} aria-pressed={lite} data-sfx="toggle"
      onClick={() => setTier(lite ? 'high' : 'low')} title="Menos animación, ideal para equipos lentos o datos móviles">
      <Bolt /> Modo liviano <span className="switch-btn__pill" aria-hidden="true"><i /></span>
    </button>
  );
}

export default function Footer() {
  const { settings, prices } = useLive();
  const [status, setStatus] = useState<ReturnType<typeof openStatus> | null>(null);
  useEffect(() => {
    const tick = () => setStatus(openStatus(settings));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [settings]);

  return (
    <footer className="footer">
      <div className="footer__cta" data-reveal>
        <p className="eyebrow">¿Lo imprimimos?</p>
        <Link href="/pedido" className="footer__big" data-sfx="pop">
          Hacé tu <em>pedido</em> <ArrowUpRight />
        </Link>
      </div>

      <div className="footer__grid">
        <div className="footer__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-pura-tinta-480.webp" alt="Impresiones Pura Tinta" width="480" height="522" loading="lazy" />
        </div>
        <nav className="footer__col" aria-label="Secciones">
          <h3>Navegá</h3>
          <Link href="/">Inicio</Link>
          <Link href="/#como-funciona">Cómo funciona</Link>
          <Link href="/#precios">Precios</Link>
          <Link href="/#horarios">Horarios</Link>
          <Link href="/pedido">Hacer pedido</Link>
          <Link href="/contacto">Contacto</Link>
        </nav>
        <div className="footer__col">
          <h3>Horarios de atención</h3>
          <p><span>{settings.hours.weekdays.label}</span><b>{settings.hours.weekdays.open} a {settings.hours.weekdays.close}</b></p>
          <p><span>{settings.hours.weekend.label}</span><b>{settings.hours.weekend.open} a {settings.hours.weekend.close}</b></p>
          {status && <p className={`status-pill${status.open ? ' is-open' : ''}`}><i />{status.label} · {status.detail}</p>}
          <h3 className="mt">Fotocopias B/N</h3>
          <p><span>Simple faz</span><b>{formatMoney(prices.simple)}</b></p>
          <p><span>Doble faz</span><b>{formatMoney(prices.doble)}</b></p>
          {settings.bulk.enabled && <p><span>Doble faz desde {settings.bulk.minSheets} hojas</span><b>{formatMoney(settings.bulk.dobleSheetPrice)}</b></p>}
        </div>
        <div className="footer__col">
          <h3>Contacto</h3>
          <a href={whatsappUrl('Hola Pura Tinta! 👋')} target="_blank" rel="noopener noreferrer" className="footer__social"><WhatsAppGlyph /> {BUSINESS.whatsappDisplay}</a>
          <a href={BUSINESS.instagramUrl} target="_blank" rel="noopener noreferrer" className="footer__social"><InstagramGlyph /> @{BUSINESS.instagram}</a>
          <h3 className="mt">Preferencias</h3>
          <div className="footer__prefs"><SoundToggle className="icon-btn--label" /><LiteToggle /></div>
        </div>
      </div>

      <div className="footer__base">
        <span>© {new Date().getFullYear()} Impresiones Pura Tinta · impresiones en blanco y negro</span>
        <Link href="/ingresar" className="footer__staff"><Lock /> Equipo</Link>
      </div>
    </footer>
  );
}
