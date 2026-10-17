'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BUSINESS, whatsappUrl } from '../lib/config';
import { useLive } from '../lib/settings';
import { supabase } from '../lib/supabase';
import { Icon3D, InstagramGlyph, WhatsAppGlyph } from './icons';

/** Banda de aviso (editable desde el panel) y pantalla de mantenimiento. */
export default function SiteChrome() {
  const { settings } = useLive();
  const pathname = usePathname() || '/';
  const [admin, setAdmin] = useState(false);
  const [hidden, setHidden] = useState(false);
  const staffRoute = pathname.startsWith('/panel') || pathname.startsWith('/ingresar');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAdmin(Boolean(data.session)));
  }, []);

  const text = settings.announcement.enabled ? settings.announcement.text.trim() : '';
  useEffect(() => { setHidden(false); }, [text]);

  useEffect(() => {
    document.documentElement.classList.toggle('has-announcement', Boolean(text) && !hidden && !staffRoute);
  }, [text, hidden, staffRoute]);

  if (settings.maintenance && !admin && !staffRoute) {
    return (
      <div className="maintenance" role="dialog" aria-modal="true" aria-labelledby="mt-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-pura-tinta.webp" alt="Impresiones Pura Tinta" width="821" height="893" className="maintenance__logo" />
        <h1 id="mt-title" className="display">Estamos <em>cargando tinta</em></h1>
        <p>La web vuelve en un ratito. Mientras tanto, escribinos y te imprimimos igual.</p>
        <div className="maintenance__row">
          <a className="btn btn--ink" href={whatsappUrl('Hola Pura Tinta! Quería hacer un pedido de impresiones.')} target="_blank" rel="noopener noreferrer">
            <WhatsAppGlyph /> WhatsApp {BUSINESS.whatsappDisplay}
          </a>
          <a className="btn btn--ghost" href={BUSINESS.instagramUrl} target="_blank" rel="noopener noreferrer"><InstagramGlyph /> @{BUSINESS.instagram}</a>
        </div>
        <Icon3D name="printer" size={140} className="maintenance__icon" eager />
        <Link href="/ingresar" className="maintenance__staff">Soy del equipo</Link>
      </div>
    );
  }

  if (!text || hidden || staffRoute) return null;
  return (
    <div className="announce" role="status">
      <span className="announce__dot" aria-hidden="true" />
      <p>{text}</p>
      <button type="button" className="announce__close" aria-label="Cerrar aviso" onClick={() => setHidden(true)}>×</button>
    </div>
  );
}
