'use client';

import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { formatMoney, PRICES, sheetsFor, subtotalFor, whatsappUrl, type Sides } from './config';
import { BUCKET, orderCode, supabase, type Order } from './supabase';
import Printer3D from './printer-3d';
import Ticket from './ticket';

type Item = {
  key: string;
  file: File;
  pages: number;
  pagesGuessed: boolean;
  copies: number;
  sides: Sides;
};

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';
const ACCEPT_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Cuenta páginas de un PDF sin librerías: busca los objetos /Type /Page.
async function countPages(file: File): Promise<number | null> {
  if (file.type.startsWith('image/')) return 1;
  if (file.type !== 'application/pdf') return null;
  const text = new TextDecoder('latin1').decode(await file.arrayBuffer());
  const pages = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
  if (pages > 0) return pages;
  const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  return counts.length ? Math.max(...counts) : null;
}

const safeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80);

export default function OrderForm() {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const total = items.reduce((n, it) => n + subtotalFor(it.pages, it.copies, it.sides), 0);

  async function addFiles(list: FileList | File[]) {
    setError('');
    const accepted: Item[] = [];
    for (const file of Array.from(list)) {
      if (!ACCEPT_TYPES.includes(file.type)) { setError(`“${file.name}” no es un formato aceptado (PDF, Word o imagen).`); continue; }
      if (file.size > MAX_BYTES) { setError(`“${file.name}” pesa más de 50 MB.`); continue; }
      const pages = await countPages(file);
      accepted.push({ key: crypto.randomUUID(), file, pages: pages ?? 1, pagesGuessed: pages === null, copies: 1, sides: 'simple' });
    }
    setItems((prev) => [...prev, ...accepted].slice(0, 30));
  }

  const update = (key: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!items.length) { setError('Subí al menos un archivo.'); return; }
    const data = new FormData(e.currentTarget);
    setError('');
    setStatus('sending');
    const id = crypto.randomUUID();
    try {
      const files = [];
      for (const [i, it] of items.entries()) {
        setProgress(`Subiendo ${i + 1} de ${items.length}: ${it.file.name}`);
        const path = `${id}/${i + 1}-${safeName(it.file.name)}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, it.file, { contentType: it.file.type });
        if (upErr) throw new Error(`No se pudo subir “${it.file.name}”.`);
        files.push({ path, name: it.file.name, size: it.file.size, pages: it.pages, copies: it.copies, sides: it.sides });
      }
      setProgress('Confirmando pedido…');
      const { data: result, error: rpcErr } = await supabase.rpc('create_order', {
        p_id: id,
        p_name: String(data.get('name') ?? ''),
        p_phone: String(data.get('phone') ?? ''),
        p_email: String(data.get('email') ?? ''),
        p_notes: String(data.get('notes') ?? ''),
        p_files: files,
      });
      if (rpcErr || !result?.[0]) throw new Error('No se pudo registrar el pedido. Probá de nuevo.');
      // Aviso por email a Pura Tinta (si está configurado). No bloquea al cliente.
      void supabase.functions.invoke('notify-order', { body: { id } }).catch(() => {});

      setOrder({
        id,
        number: result[0].order_number,
        total: result[0].order_total,
        created_at: new Date().toISOString(),
        customer_name: String(data.get('name')),
        customer_phone: String(data.get('phone')),
        customer_email: String(data.get('email') || '') || null,
        notes: String(data.get('notes') || '') || null,
        status: 'nuevo',
        files: files.map((f, i) => ({
          id: i, path: f.path, file_name: f.name, size_bytes: f.size, pages: f.pages, copies: f.copies, sides: f.sides,
          subtotal: subtotalFor(f.pages, f.copies, f.sides),
        })),
      });
      setItems([]);
      e.currentTarget?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal. Probá de nuevo.');
    } finally {
      setStatus('idle');
      setProgress('');
    }
  }

  const whatsappMessage = order
    ? `Hola Pura Tinta! Hice el pedido ${orderCode(order.number)} a nombre de ${order.customer_name} por ${formatMoney(order.total)}.`
    : '';

  return (
    <>
      <form className="order-form" onSubmit={onSubmit}>
        <div
          className={`dropzone${dragging ? ' is-dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        >
          <span className="headline">arrastrá tus archivos acá</span>
          <span>o tocá para elegirlos · PDF, Word o imágenes · hasta 50 MB c/u</span>
          <input
            ref={inputRef} type="file" multiple accept={ACCEPT} hidden
            onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {items.length > 0 && (
          <ul className="file-list">
            {items.map((it) => (
              <li key={it.key}>
                <div className="file-name">
                  <span>{it.file.name}</span>
                  <button type="button" className="file-remove" aria-label={`Quitar ${it.file.name}`}
                    onClick={() => setItems((prev) => prev.filter((p) => p.key !== it.key))}>×</button>
                </div>
                <div className="file-options">
                  <label>
                    Páginas
                    <input type="number" min={1} max={2000} value={it.pages} required
                      onChange={(e) => update(it.key, { pages: Math.max(1, Number(e.target.value) || 1), pagesGuessed: false })} />
                  </label>
                  <label>
                    Copias
                    <input type="number" min={1} max={500} value={it.copies} required
                      onChange={(e) => update(it.key, { copies: Math.max(1, Number(e.target.value) || 1) })} />
                  </label>
                  <div className="sides" role="radiogroup" aria-label="Tipo de impresión">
                    {(['simple', 'doble'] as const).map((s) => (
                      <button key={s} type="button" role="radio" aria-checked={it.sides === s}
                        className={it.sides === s ? 'is-on' : ''} onClick={() => update(it.key, { sides: s })}>
                        {s === 'simple' ? 'Simple faz' : 'Doble faz'}
                      </button>
                    ))}
                  </div>
                  <span className="file-subtotal">
                    {sheetsFor(it.pages, it.sides) * it.copies} hojas · {formatMoney(subtotalFor(it.pages, it.copies, it.sides))}
                  </span>
                </div>
                {it.pagesGuessed && <p className="file-hint">No pudimos contar las páginas de este archivo: revisá la cantidad.</p>}
              </li>
            ))}
          </ul>
        )}

        <div className="fields">
          <label>Nombre<input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
          <label>WhatsApp<input name="phone" required minLength={6} maxLength={30} inputMode="tel" autoComplete="tel" placeholder="Ej: 2972 123456" /></label>
          <label><span>Email <small>(opcional)</small></span><input name="email" type="email" maxLength={120} autoComplete="email" /></label>
          <label className="field-wide"><span>Indicaciones <small>(opcional)</small></span>
            <textarea name="notes" maxLength={1000} rows={3} placeholder="Ej: abrochado, imprimir solo páginas 3 a 10, lo retiro mañana a la tarde…" />
          </label>
        </div>

        <div className="order-summary">
          <div>
            <span className="tag">total estimado</span>
            <span className="headline order-total">{formatMoney(total)}</span>
            <span className="order-prices">Simple faz {formatMoney(PRICES.simple)} · Doble faz {formatMoney(PRICES.doble)} por hoja</span>
          </div>
          <button type="submit" className="pill-button" disabled={status === 'sending'}>
            {status === 'sending' ? 'enviando…' : 'confirmar pedido'}
          </button>
        </div>
        {progress && <p className="form-progress" aria-live="polite">{progress}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>

      {order && (
        <Printer3D
          actions={
            <>
              <button type="button" className="pill-button" onClick={() => window.print()}>guardar ticket</button>
              <a className="pill-button pill-light" href={whatsappUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">
                avisar por WhatsApp
              </a>
              <button type="button" className="pill-button pill-light" onClick={() => setOrder(null)}>cerrar</button>
            </>
          }
        >
          <Ticket order={order} variant="cliente" className="ticket--print" />
        </Printer3D>
      )}
    </>
  );
}
