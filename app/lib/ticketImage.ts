'use client';

import { BUSINESS, formatMoney, sheetsFor, sidesLabel, STATUS_LABELS, type SiteSettings } from './config';
import { orderCode, orderFiles, type Order } from './supabase';

// Dibuja el ticket en un canvas para descargarlo como imagen (sirve para mandarlo por WhatsApp).

const W = 640;
const PAD = 44;
const INK = '#0b0b0a';

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
    while (ctx.measureText(cur).width > max) {
      let i = cur.length;
      while (i > 1 && ctx.measureText(cur.slice(0, i)).width > max) i--;
      lines.push(cur.slice(0, i)); cur = cur.slice(i);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const loadImg = (src: string) => new Promise<HTMLImageElement | null>((res) => {
  const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
});

export async function ticketBlob(order: Order, settings: SiteSettings): Promise<Blob | null> {
  const mono = '"JetBrains Mono Variable", ui-monospace, Menlo, monospace';
  try { await document.fonts.load(`600 20px ${mono}`); } catch {}
  const logo = await loadImg('/brand/logo-pura-tinta-480.webp');
  const files = orderFiles(order);
  const code = orderCode(order.number);
  const d = new Date(order.created_at);
  const tz = { timeZone: 'America/Argentina/Buenos_Aires' } as const;

  // Primero medimos con un canvas descartable para saber el alto.
  const draw = (ctx: CanvasRenderingContext2D, paint: boolean) => {
    let y = 36;
    const max = W - PAD * 2;
    const text = (s: string, size = 20, weight = 400, align: CanvasTextAlign = 'left') => {
      ctx.font = `${weight} ${size}px ${mono}`;
      ctx.textAlign = align;
      const x = align === 'center' ? W / 2 : align === 'right' ? W - PAD : PAD;
      for (const line of wrap(ctx, s, max)) { if (paint) ctx.fillText(line, x, y + size); y += size * 1.45; }
    };
    const pair = (a: string, b: string, size = 20, weight = 400) => {
      ctx.font = `${weight} ${size}px ${mono}`;
      if (paint) { ctx.textAlign = 'left'; ctx.fillText(a, PAD, y + size); ctx.textAlign = 'right'; ctx.fillText(b, W - PAD, y + size); }
      y += size * 1.5;
    };
    const rule = () => {
      y += 10;
      if (paint) { ctx.save(); ctx.setLineDash([8, 7]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke(); ctx.restore(); }
      y += 18;
    };
    if (logo) { const lw = 190, lh = lw * (logo.height / logo.width); if (paint) ctx.drawImage(logo, (W - lw) / 2, y, lw, lh); y += lh + 8; }
    text('COMPROBANTE DE PEDIDO', 18, 600, 'center');
    text(code, 52, 800, 'center');
    text(`${d.toLocaleDateString('es-AR', tz)} · ${d.toLocaleTimeString('es-AR', { ...tz, hour: '2-digit', minute: '2-digit', hour12: false })} h`, 20, 400, 'center');
    text(`Estado: ${STATUS_LABELS[order.status] ?? order.status}`, 18, 400, 'center');
    rule();
    text('CLIENTE', 16, 700);
    text(order.customer_name, 22, 700);
    text(`WhatsApp: ${order.customer_phone}`);
    if (order.customer_email) text(`Email: ${order.customer_email}`);
    rule();
    text(`DETALLE · ${files.length} ${files.length === 1 ? 'ARCHIVO' : 'ARCHIVOS'}`, 16, 700);
    files.forEach((f, i) => {
      const sheets = sheetsFor(f.pages, f.sides) * f.copies;
      text(`${i + 1}. ${f.file_name}`, 19, 700);
      text(`${f.copies} ${f.copies === 1 ? 'copia' : 'copias'} · B/N ${sidesLabel(f.sides)} · ${f.pages} ${f.pages === 1 ? 'pág.' : 'págs.'} = ${sheets} ${sheets === 1 ? 'hoja' : 'hojas'}`, 18);
      pair('', formatMoney(f.subtotal), 20, 700);
    });
    if (order.notes) { rule(); text('TUS INDICACIONES', 16, 700); text(order.notes, 18); }
    rule();
    pair('Total de hojas', String(files.reduce((n, f) => n + sheetsFor(f.pages, f.sides) * f.copies, 0)));
    pair('TOTAL', formatMoney(order.total), 34, 800);
    rule();
    const alias = settings.mercadoPagoAlias.trim();
    text(alias ? `Pagá por transferencia al alias de Mercado Pago ${alias} y mandá el comprobante por WhatsApp.` : `Coordiná el pago por WhatsApp al ${BUSINESS.whatsappDisplay}.`, 17, 400, 'center');
    text('Te avisamos por WhatsApp cuando esté listo para retirar.', 17, 400, 'center');
    text(`${settings.hours.weekdays.label} ${settings.hours.weekdays.open} a ${settings.hours.weekdays.close}`, 17, 400, 'center');
    text(`${settings.hours.weekend.label} ${settings.hours.weekend.open} a ${settings.hours.weekend.close}`, 17, 400, 'center');
    text(`WhatsApp ${BUSINESS.whatsappDisplay} · IG @${BUSINESS.instagram}`, 16, 400, 'center');
    y += 8;
    text('¡gracias por elegir Pura Tinta!', 20, 700, 'center');
    return y + 40;
  };

  const probe = document.createElement('canvas').getContext('2d')!;
  const H = Math.ceil(draw(probe, false));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  draw(ctx, true);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

export async function downloadTicket(order: Order, settings: SiteSettings) {
  const blob = await ticketBlob(order, settings);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ticket-${orderCode(order.number)}-pura-tinta.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Texto completo del pedido, para WhatsApp. */
export function orderMessage(order: Order) {
  const files = orderFiles(order);
  const lines = [
    `Hola Pura Tinta! Hice el pedido *${orderCode(order.number)}* desde la web.`,
    '',
    `👤 ${order.customer_name}`,
    `📱 ${order.customer_phone}`,
    ...(order.customer_email ? [`✉️ ${order.customer_email}`] : []),
    '',
    ...files.map((f, i) => {
      const sheets = sheetsFor(f.pages, f.sides) * f.copies;
      return `${i + 1}. ${f.file_name} — ${f.copies} ${f.copies === 1 ? 'copia' : 'copias'} B/N ${sidesLabel(f.sides)}, ${f.pages} pág. = ${sheets} hojas (${formatMoney(f.subtotal)})`;
    }),
    ...(order.notes ? ['', `📝 ${order.notes}`] : []),
    '',
    `Total: *${formatMoney(order.total)}*`,
    'Los archivos ya están subidos en la web. ¡Gracias!',
  ];
  return lines.join('\n');
}
