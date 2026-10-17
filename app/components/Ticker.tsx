'use client';

import { formatMoney } from '../lib/config';
import { useLive } from '../lib/settings';

/** Marquesina inferior (de pouterby). Cada mitad repite la lista para cubrir pantallas anchas. */
export default function Ticker({ tone = 'ink' }: { tone?: 'ink' | 'paper' | 'violet' }) {
  const { prices, settings } = useLive();
  const words = [
    'Fotocopias B/N',
    `Simple faz ${formatMoney(prices.simple)}`,
    `Doble faz ${formatMoney(prices.doble)}`,
    'Subí tus archivos',
    'Retiralos impresos',
    `${settings.hours.weekdays.label} ${settings.hours.weekdays.open} a ${settings.hours.weekdays.close}`,
    `${settings.hours.weekend.label} ${settings.hours.weekend.open} a ${settings.hours.weekend.close}`,
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
