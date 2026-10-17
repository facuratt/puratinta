'use client';

import { useEffect, useRef, useState } from 'react';
import { BUSINESS, whatsappUrl } from '../lib/config';
import { openStatus } from '../lib/hours';
import { useScrollScene } from '../lib/scroll';
import { useLive } from '../lib/settings';
import { Icon3D, WhatsAppGlyph } from './icons';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const toPct = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return ((h * 60 + m) / 1440) * 100; };

function arNow() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const d = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(g('weekday'));
  return { day: d, pct: (((Number(g('hour')) % 24) * 60 + Number(g('minute'))) / 1440) * 100 };
}

export default function Hours() {
  const ref = useRef<HTMLElement>(null);
  const { settings } = useLive();
  const [now, setNow] = useState<{ day: number; pct: number } | null>(null);
  const [status, setStatus] = useState<ReturnType<typeof openStatus> | null>(null);
  useScrollScene(ref, 'pass');

  useEffect(() => {
    const tick = () => { setNow(arNow()); setStatus(openStatus(settings)); };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [settings]);

  const { weekdays, weekend } = settings.hours;

  return (
    <section className="hours" id="horarios" ref={ref}>
      <div className="hours__clock" aria-hidden="true"><Icon3D name="clock" size={420} /></div>
      <div className="hours__content">
        <p className="eyebrow" data-reveal>Horarios de atención</p>
        <h2 className="display" data-reveal>Abrimos <em>temprano</em>,<br />cerramos tarde.</h2>
        {status && (
          <p className={`status-pill status-pill--lg${status.open ? ' is-open' : ''}`} data-reveal><i />{status.label} · {status.detail}</p>
        )}
        <dl className="hours__list" data-reveal>
          <div><dt>{weekdays.label}</dt><dd>{weekdays.open} <span>a</span> {weekdays.close}</dd></div>
          <div><dt>{weekend.label}</dt><dd>{weekend.open} <span>a</span> {weekend.close}</dd></div>
        </dl>

        <div className="week" data-reveal aria-label="Horario semanal">
          {DAYS.map((d, i) => {
            const h = i >= 5 ? weekend : weekdays;
            const today = now?.day === i;
            return (
              <div key={d} className={`week__row${today ? ' is-today' : ''}`}>
                <span className="week__d">{d}</span>
                <span className="week__bar">
                  <i style={{ left: `${toPct(h.open)}%`, width: `${toPct(h.close) - toPct(h.open)}%` }} />
                  {today && now && <b style={{ left: `${now.pct}%` }} title="Ahora" />}
                </span>
                <span className="week__h">{h.open}–{h.close}</span>
              </div>
            );
          })}
          <div className="week__scale" aria-hidden="true"><span>0 h</span><span>6</span><span>12</span><span>18</span><span>24 h</span></div>
        </div>

        <a className="btn btn--ink" data-reveal href={whatsappUrl('Hola Pura Tinta! Tengo una consulta 🙂')} target="_blank" rel="noopener noreferrer">
          <WhatsAppGlyph /> Consultar por WhatsApp · {BUSINESS.whatsappDisplay}
        </a>
      </div>
    </section>
  );
}
