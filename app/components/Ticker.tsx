'use client';

import { formatMoney, hoursText } from '../lib/config';
import { useLive } from '../lib/settings';

/** Marquesina inferior (de pouterby). Cada mitad repite la lista para cubrir pantallas anchas. */
export default function Ticker({ tone = 'ink' }: { tone?: 'ink' | 'paper' | 'violet' }) {
  const { prices, settings } = useLive();
  const words = [
    'Fotocopias B/N',
    `Simple faz ${formatMoney(prices.simple)}`,
    `Doble faz ${formatMoney(prices.doble)}`,
    ...(settings.bulk.enabled ? [`Desde ${settings.bulk.minSheets} hojas doble faz ${formatMoney(settings.bulk.dobleSheetPrice / 2)} la carilla`] : []),
    'Subí tus archivos',
    'Retiralos impresos',
    `${settings.hours.weekdays.label} ${hoursText(settings.hours.weekdays)}`,
    `${settings.hours.weekend.label} ${hoursText(settings.hours.weekend)}`,
    'WhatsApp 2972418448',
  ];
  const half = [...words, ...words];
  const row = (key: string) => half.map((w, i) => (
    <span key={`${key}${i}`} className={i % 2 ? 'serif' : undefined}>
      {w}
      <b aria-hidden="true">✦</b>
    </span>
  ));
  return (
    <div className={`ticker ticker--${tone}`} aria-hidden="true">
      <div className="ticker__track">{row('a')}{row('b')}</div>
    </div>
  );
}
