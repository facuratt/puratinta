'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BUSINESS, formatMoney } from '../lib/config';
import { openStatus } from '../lib/hours';
import { useLive } from '../lib/settings';
import { GirlStage, type StageBounds } from './GirlStage';
import { ArrowRight, ArrowUpRight, WhatsAppGlyph } from './icons';
import Ticker from './Ticker';

/** Hero de marmalade: la chica mira hacia donde vayas, ubicada en el hueco que deja la tipografía. */
export default function Hero() {
  const navRef = useRef<HTMLDivElement>(null);
  const lockupRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<HTMLElement>(null);
  const bounds: StageBounds = useMemo(() => ({ nav: navRef, lockup: lockupRef, index: indexRef }), []);
  const { settings, prices } = useLive();
  const [status, setStatus] = useState<ReturnType<typeof openStatus> | null>(null);

  useEffect(() => {
    const tick = () => setStatus(openStatus(settings));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [settings]);

  return (
    <section className="hero" id="inicio">
      <GirlStage bounds={bounds} />

      <div className="hero__ui">
        {/* Espacio que ocupa la cápsula de navegación fija: la chica se acomoda debajo. */}
        <div className="hero__navspace" ref={navRef} aria-hidden="true" />

        <div className="hero__body">
          <div className="hero__lockup" ref={lockupRef}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hero__logo rise" style={{ ['--d' as string]: 0 }} src="/brand/logo-pura-tinta-480.webp"
              alt="Impresiones Pura Tinta" width="480" height="522" fetchPriority="high" />
            <p className="hero__eyebrow rise" style={{ ['--d' as string]: 1 }}>
              {status && <span className={`dot${status.open ? ' is-open' : ''}`} aria-hidden="true" />}
              {status ? `${status.label} · ${status.detail}` : 'Impresiones en blanco y negro'}
            </p>
            <h1 className="hero__title rise" style={{ ['--d' as string]: 2 }}>
              Subí tus archivos,<br /><em>retiralos</em> impresos.
            </h1>
            <p className="hero__lede rise" style={{ ['--d' as string]: 3 }}>
              Impresiones y fotocopias en blanco y negro. Mandás el pedido desde el celu o la compu,
              te llevás tu ticket y lo pasás a buscar.
            </p>
            <div className="hero__actions rise" style={{ ['--d' as string]: 4 }}>
              <Link href="/pedido" className="btn btn--cocoa btn--lg" data-sfx="pop">
                Hacer mi pedido <span className="btn__icon"><ArrowUpRight /></span>
              </Link>
              <Link href="/#precios" className="btn btn--line btn--lg">Ver precios</Link>
            </div>
          </div>

          <aside className="hero__index" ref={indexRef} aria-label="Datos del volante">
            <div className="flyer-card">
              <p className="flyer-card__k">Fotocopias B/N</p>
              <p className="flyer-card__row"><span>Simple faz</span><b>{formatMoney(prices.simple)}</b></p>
              <p className="flyer-card__row"><span>Doble faz</span><b>{formatMoney(prices.doble)}</b></p>
              {settings.bulk.enabled && <p className="flyer-card__row small"><span>Doble faz desde {settings.bulk.minSheets} hojas</span><b>{formatMoney(settings.bulk.dobleSheetPrice)}</b></p>}
              <span className="rule" />
              <p className="flyer-card__k">Horarios de atención</p>
              <p className="flyer-card__row small"><span>{settings.hours.weekdays.label}</span><b>{settings.hours.weekdays.open} a {settings.hours.weekdays.close}</b></p>
              <p className="flyer-card__row small"><span>{settings.hours.weekend.label}</span><b>{settings.hours.weekend.open} a {settings.hours.weekend.close}</b></p>
              <span className="rule" />
              <a className="flyer-card__wa" href={`https://wa.me/${BUSINESS.whatsappIntl}`} target="_blank" rel="noopener noreferrer">
                <WhatsAppGlyph /> {BUSINESS.whatsappDisplay}
              </a>
            </div>
          </aside>
        </div>

        <div className="hero__foot">
          <span className="tabular">Impresiones · Pura Tinta</span>
          <a href="#como-funciona" className="hero__scroll">Scrolleá para ver cómo funciona <ArrowRight /></a>
        </div>
      </div>
      <Ticker tone="ink" />
      <p className="sr-only">Una chica animada, con suéter rosa, que mira hacia donde movés el cursor.</p>
    </section>
  );
}
