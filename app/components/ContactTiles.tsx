'use client';

import { BUSINESS, whatsappUrl } from '../lib/config';
import { ArrowUpRight, Icon3D } from './icons';

/** Accesos directos: el ícono de WhatsApp abre el chat listo para escribir; el de Instagram, el perfil. */
export default function ContactTiles({ heading = true }: { heading?: boolean }) {
  return (
    <section className="tiles" id="contacto">
      {heading && (
        <div className="tiles__head" data-reveal>
          <p className="eyebrow">Hablemos</p>
          <h2 className="display">Escribinos o <em>seguinos</em>.</h2>
        </div>
      )}
      <div className="tiles__grid">
        <a className="tile tile--wa" data-reveal href={whatsappUrl('Hola Pura Tinta! Quería consultar por unas impresiones.')}
          target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp para escribir al ${BUSINESS.whatsappDisplay}`} data-sfx="pop">
          <Icon3D name="whatsapp" size={220} className="tile__icon" />
          <span className="tile__k">WhatsApp</span>
          <span className="tile__v">{BUSINESS.whatsappDisplay}</span>
          <span className="tile__go">Abrir chat <ArrowUpRight /></span>
        </a>
        <a className="tile tile--ig" data-reveal style={{ ['--d' as string]: 1 }} href={BUSINESS.instagramUrl} target="_blank"
          rel="noopener noreferrer" aria-label={`Abrir el perfil de Instagram @${BUSINESS.instagram}`} data-sfx="pop">
          <Icon3D name="instagram" size={220} className="tile__icon" />
          <span className="tile__k">Instagram</span>
          <span className="tile__v tile__v--sm">@impresiones.<wbr />cipo.<wbr />puratinta</span>
          <span className="tile__go">Ver perfil <ArrowUpRight /></span>
        </a>
      </div>
    </section>
  );
}
