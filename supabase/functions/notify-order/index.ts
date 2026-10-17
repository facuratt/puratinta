// Supabase Edge Function: avisa a Pura Tinta por email cada pedido nuevo, con la orden completa.
// La llama la web al confirmar un pedido. Cada pedido se avisa una sola vez y solo si es reciente
// (lo controla la función SQL claim_order_notification), así que no hace falta login.
//
// Destino: tabla privada `private_settings` (clave notify_email, editable desde el panel) o el secreto ORDER_EMAIL_TO.
// Envío:
//   1) Resend, si existe el secreto RESEND_API_KEY (opcional ORDER_EMAIL_FROM con dominio verificado).
//   2) Si no, FormSubmit (gratis, sin clave). La primera vez FormSubmit manda un mail de activación
//      al destino: hay que tocar "Activate" una sola vez y desde ahí llegan todos los pedidos.
// Con { "ping": true } responde qué método está configurado, sin enviar nada (lo usa el panel).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type File = { file_name: string; pages: number; copies: number; sides: 'simple' | 'doble'; subtotal: number };
type Order = {
  number: number; created_at: string; customer_name: string; customer_phone: string; customer_email: string | null;
  notes: string | null; total: number; files: File[];
};

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;
const code = (n: number) => `PT-${String(n).padStart(4, '0')}`;
const sheets = (f: File) => (f.sides === 'doble' ? Math.ceil(f.pages / 2) : f.pages) * f.copies;
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ sent: false }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const { data: setting } = await supabase.from('private_settings').select('value').eq('key', 'notify_email').maybeSingle();
  const to = (setting?.value || Deno.env.get('ORDER_EMAIL_TO') || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const method = resendKey ? 'resend' : 'formsubmit';

  const body = await req.json().catch(() => ({}));
  if (body?.ping) return json({ method, hasDestination: to.length > 0 });
  if (!to.length) return json({ sent: false, reason: 'sin email de destino' });

  const id = body?.id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return json({ sent: false }, 400);

  const { data } = await supabase.rpc('claim_order_notification', { p_id: id });
  const order = data as Order | null;
  if (!order) return json({ sent: false });

  const siteUrl = Deno.env.get('SITE_URL') || 'https://puratinta.pages.dev';
  const subject = `Nuevo pedido ${code(order.number)} — ${order.customer_name} — ${money(order.total)}`;
  const totalSheets = order.files.reduce((n, f) => n + sheets(f), 0);
  const when = new Date(order.created_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  if (method === 'resend') {
    const rows = order.files.map((f) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px dashed #ccc">${escape(f.file_name)}<br>
          <small>Imprimir <b>${f.copies} ${f.copies === 1 ? 'copia' : 'copias'}</b> B/N <b>${f.sides === 'doble' ? 'doble faz' : 'simple faz'}</b> · ${f.pages} pág. = ${sheets(f)} hojas</small></td>
        <td style="padding:6px 0;border-bottom:1px dashed #ccc;text-align:right">${money(f.subtotal)}</td>
      </tr>`).join('');
    const html = `
    <div style="font-family:'Courier New',monospace;max-width:420px;margin:auto;padding:20px;border:1px solid #ddd;color:#0b0b0a">
      <p style="text-align:center;margin:0">ORDEN DE TRABAJO</p>
      <h1 style="text-align:center;margin:4px 0 4px">${code(order.number)}</h1>
      <p style="text-align:center;margin:0 0 16px">${escape(when)}</p>
      <p><b>Cliente:</b> ${escape(order.customer_name)}<br><b>WhatsApp:</b> ${escape(order.customer_phone)}
      ${order.customer_email ? `<br><b>Email:</b> ${escape(order.customer_email)}` : ''}</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      ${order.notes ? `<p><b>Indicaciones:</b><br>${escape(order.notes).replace(/\n/g, '<br>')}</p>` : ''}
      <p>Total de hojas: <b>${totalSheets}</b></p>
      <h2>TOTAL ${money(order.total)}</h2>
      <p style="text-align:center"><a href="${siteUrl}/panel?pedido=${code(order.number)}">Abrir el panel para descargar los archivos</a></p>
    </div>`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('ORDER_EMAIL_FROM') || 'Pura Tinta <onboarding@resend.dev>', to, subject, html }),
    });
    return json({ sent: res.ok, method });
  }

  // FormSubmit: tabla con todos los datos de la orden.
  const fields: Record<string, string> = {
    _subject: subject,
    _template: 'table',
    _captcha: 'false',
    Pedido: code(order.number),
    Fecha: when,
    Cliente: order.customer_name,
    WhatsApp: order.customer_phone,
    Email: order.customer_email || '—',
  };
  order.files.forEach((f, i) => {
    fields[`Archivo ${i + 1}`] =
      `${f.file_name} — ${f.copies} ${f.copies === 1 ? 'copia' : 'copias'} B/N ${f.sides === 'doble' ? 'doble faz' : 'simple faz'} · ${f.pages} pág. = ${sheets(f)} hojas · ${money(f.subtotal)}`;
  });
  fields['Indicaciones'] = order.notes || '—';
  fields['Total de hojas'] = String(totalSheets);
  fields['TOTAL'] = money(order.total);
  fields['Panel (descargar archivos)'] = `${siteUrl}/panel?pedido=${code(order.number)}`;

  const results = await Promise.all(to.map((addr: string) =>
    fetch(`https://formsubmit.co/ajax/${encodeURIComponent(addr)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: siteUrl, Referer: `${siteUrl}/pedido` },
      body: JSON.stringify(fields),
    }).then((r) => r.ok).catch(() => false)));
  return json({ sent: results.some(Boolean), method });
});
