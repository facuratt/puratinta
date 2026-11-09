import { shifts, type SiteSettings } from './config';

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

/** Abierto o cerrado ahora, contemplando un segundo turno (ej.: 06:30–13:00 y 21:30–22:30). */
export function openStatus(s: SiteSettings, date = new Date()): OpenStatus {
  const { day, minutes } = nowInAR(date);
  const today = shifts(hoursFor(day, s));
  const current = today.find(([o, c]) => minutes >= toMin(o) && minutes < toMin(c));
  if (current) {
    const left = toMin(current[1]) - minutes;
    return { open: true, label: 'Abierto ahora', detail: left <= 60 ? `cierra en ${left} min (${current[1]})` : `hasta las ${current[1]}` };
  }
  const later = today.find(([o]) => minutes < toMin(o));
  if (later) {
    const reopening = today.some(([, c]) => minutes >= toMin(c));
    return { open: false, label: 'Cerrado', detail: `${reopening ? 'vuelve a abrir' : 'hoy abre'} a las ${later[0]}` };
  }
  const next = (day + 1) % 7;
  return { open: false, label: 'Cerrado', detail: `abre mañana a las ${shifts(hoursFor(next, s))[0][0]}` };
}
