// Supabase Edge Function: envía a Pura Tinta un email con la orden completa.
// La llama la web al confirmar un pedido. Cada pedido se avisa una sola vez y solo si es reciente
// (lo controla la función SQL claim_order_notification), así que no hace falta login.
// Secretos (Supabase → Edge Functions → Secrets): RESEND_API_KEY, ORDER_EMAIL_TO, ORDER_EMAIL_FROM (opcional), SITE_URL (opcional).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type File = { file_name: string; pages: number; copies: number; sides: 'simple' | 'doble'; subtotal: number };
type Order = {
  number: number; customer_name: string; customer_phone: string; customer_email: string | null;
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

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('ORDER_EMAIL_TO');
  if (!resendKey || !to) return json({ sent: false, reason: 'email no configurado' });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return json({ sent: false }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data } = await supabase.rpc('claim_order_notification', { p_id: id });
  const order = data as Order | null;
  if (!order) return json({ sent: false });

  const siteUrl = Deno.env.get('SITE_URL');
  const rows = order.files.map((f) => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px dashed #ccc">${escape(f.file_name)}<br>
        <small>Imprimir <b>${f.copies} ${f.copies === 1 ? 'copia' : 'copias'}</b> B/N <b>${f.sides === 'doble' ? 'doble faz' : 'simple faz'}</b> · ${f.pages} pág. = ${sheets(f)} hojas</small></td>
      <td style="padding:6px 0;border-bottom:1px dashed #ccc;text-align:right">${money(f.subtotal)}</td>
    </tr>`).join('');

  const html = `
  <div style="font-family:'Courier New',monospace;max-width:420px;margin:auto;padding:20px;border:1px solid #ddd;color:#080909">
    <p style="text-align:center;margin:0">ORDEN DE TRABAJO</p>
    <h1 style="text-align:center;margin:4px 0 16px">${code(order.number)}</h1>
    <p><b>Cliente:</b> ${escape(order.customer_name)}<br><b>WhatsApp:</b> ${escape(order.customer_phone)}
    ${order.customer_email ? `<br><b>Email:</b> ${escape(order.customer_email)}` : ''}</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    ${order.notes ? `<p><b>Indicaciones:</b><br>${escape(order.notes).replace(/\n/g, '<br>')}</p>` : ''}
    <h2>TOTAL ${money(order.total)}</h2>
    ${siteUrl ? `<p style="text-align:center"><a href="${siteUrl}/panel">Abrir panel para descargar los archivos</a></p>` : ''}
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('ORDER_EMAIL_FROM') || 'Pura Tinta <onboarding@resend.dev>',
      to: to.split(',').map((s) => s.trim()),
      subject: `Nuevo pedido ${code(order.number)} — ${order.customer_name} — ${money(order.total)}`,
      html,
    }),
  });
  return json({ sent: res.ok });
});
