import type { SiteSettings } from './config';

const TZ = 'America/Argentina/Buenos_Aires';
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Hora actual en Argentina, sin depender de la zona horaria del visitante. */
function nowInAR(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const minutes = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
  return { day, minutes };
}

const hoursFor = (day: number, s: SiteSettings) => (day === 0 || day === 6 ? s.hours.weekend : s.hours.weekdays);

export type OpenStatus = { open: boolean; label: string; detail: string };

export function openStatus(s: SiteSettings, date = new Date()): OpenStatus {
  const { day, minutes } = nowInAR(date);
  const today = hoursFor(day, s);
  const o = toMin(today.open);
  const c = toMin(today.close);
  if (minutes >= o && minutes < c) {
    const left = c - minutes;
    return { open: true, label: 'Abierto ahora', detail: left <= 60 ? `cierra en ${left} min (${today.close})` : `hasta las ${today.close}` };
  }
  if (minutes < o) return { open: false, label: 'Cerrado', detail: `hoy abre a las ${today.open}` };
  const next = (day + 1) % 7;
  return { open: false, label: 'Cerrado', detail: `abre ${next === (day + 1) % 7 ? 'mañana' : DAYS[next]} a las ${hoursFor(next, s).open}` };
}
