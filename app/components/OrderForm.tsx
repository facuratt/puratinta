'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { BUSINESS, formatMoney, sheetsFor, subtotalFor, whatsappUrl, type Sides } from '../lib/config';
import { useLive } from '../lib/settings';
import { play } from '../lib/sound';
import { BUCKET, orderCode, supabase, type Order } from '../lib/supabase';
import { downloadTicket, orderMessage } from '../lib/ticketImage';
import { ArrowRight, Check, Chevron, Download, FileIcon, Icon3D, Printer, Trash, Upload, WhatsAppGlyph } from './icons';
import Printer3D from './Printer3D';
import Ticket from './Ticket';

type Item = { key: string; file: File; pages: number; pagesGuessed: boolean; copies: number; sides: Sides; thumb?: string };

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';
const ACCEPT_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const EXT_TYPES: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const typeOf = (f: File) => f.type || EXT_TYPES[f.name.split('.').pop()?.toLowerCase() ?? ''] || '';

// Cuenta páginas de un PDF sin librerías: busca los objetos /Type /Page.
async function countPages(file: File): Promise<number | null> {
  const t = typeOf(file);
  if (t.startsWith('image/')) return 1;
  if (t !== 'application/pdf') return null;
  const text = new TextDecoder('latin1').decode(await file.arrayBuffer());
  const pages = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
  if (pages > 0) return pages;
  const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  return counts.length ? Math.max(...counts) : null;
}

const safeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80);
const prettySize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const TABS = ['Archivos', 'Tus datos', 'Confirmar'] as const;
const DRAFT = 'pt-cliente';

export default function OrderForm() {
  const { settings, prices } = useLive();
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState('');
  const [pct, setPct] = useState(0);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [mailed, setMailed] = useState<boolean | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const closed = !settings.ordersOpen || settings.maintenance;
  const total = items.reduce((n, it) => n + subtotalFor(it.pages, it.copies, it.sides, prices), 0);
  const sheets = items.reduce((n, it) => n + sheetsFor(it.pages, it.sides) * it.copies, 0);

  useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d) setForm((f) => ({ ...f, name: d.name || '', phone: d.phone || '', email: d.email || '' })); } catch {}
  }, []);
  useEffect(() => () => items.forEach((it) => it.thumb && URL.revokeObjectURL(it.thumb)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addFiles(list: FileList | File[]) {
    setError('');
    const accepted: Item[] = [];
    for (const file of Array.from(list)) {
      const t = typeOf(file);
      if (!ACCEPT_TYPES.includes(t)) { setError(`“${file.name}” no es un formato aceptado (PDF, Word o imagen).`); play('error'); continue; }
      if (file.size > MAX_BYTES) { setError(`“${file.name}” pesa más de 50 MB.`); play('error'); continue; }
      const pages = await countPages(file);
      accepted.push({
        key: crypto.randomUUID(), file, pages: pages ?? 1, pagesGuessed: pages === null, copies: 1, sides: 'simple',
        thumb: t.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      });
    }
    if (accepted.length) play('pop');
    setItems((prev) => [...prev, ...accepted].slice(0, 30));
  }

  const update = (key: string, patch: Partial<Item>) => setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const setAllSides = (s: Sides) => setItems((prev) => prev.map((it) => ({ ...it, sides: s })));

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  }

  const validData = form.name.trim().length >= 2 && form.phone.replace(/\D/g, '').length >= 6;
  const canGo = (t: number) => t === 0 || (t >= 1 && items.length > 0 && (t === 1 || validData));

  function go(t: number) {
    if (t > tab && tab === 0 && !items.length) { setError('Subí al menos un archivo.'); play('error'); return; }
    if (t === 2 && !validData) { setError('Completá tu nombre y tu WhatsApp.'); play('error'); formRef.current?.reportValidity(); return; }
    setError('');
    setTab(t);
    play('paper');
    window.scrollTo({ top: (formRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 110, behavior: 'smooth' });
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (closed) return;
    if (!items.length) { setTab(0); setError('Subí al menos un archivo.'); return; }
    if (!validData) { setTab(1); setError('Completá tu nombre y tu WhatsApp.'); return; }
    setError('');
    setSending(true);
    try { localStorage.setItem(DRAFT, JSON.stringify({ name: form.name, phone: form.phone, email: form.email })); } catch {}
    const id = crypto.randomUUID();
    try {
      const files = [];
      for (const [i, it] of items.entries()) {
        setProgress(`Subiendo ${i + 1} de ${items.length}: ${it.file.name}`);
        setPct(Math.round((i / items.length) * 90));
        const path = `${id}/${i + 1}-${safeName(it.file.name)}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, it.file, { contentType: typeOf(it.file) });
        if (upErr) throw new Error(`No se pudo subir “${it.file.name}”. Revisá tu conexión y probá de nuevo.`);
        files.push({ path, name: it.file.name, size: it.file.size, pages: it.pages, copies: it.copies, sides: it.sides });
      }
      setProgress('Confirmando pedido…');
      setPct(95);
      const { data: result, error: rpcErr } = await supabase.rpc('create_order', {
        p_id: id, p_name: form.name, p_phone: form.phone, p_email: form.email, p_notes: form.notes, p_files: files,
      });
      if (rpcErr || !result?.[0]) {
        if (rpcErr?.message?.includes('pausados')) throw new Error(settings.pausedMessage);
        throw new Error('No se pudo registrar el pedido. Probá de nuevo en un momento.');
      }
      setPct(100);
      // Aviso por email a Pura Tinta. No bloquea al cliente.
      supabase.functions.invoke('notify-order', { body: { id } })
        .then(({ data }) => setMailed(Boolean((data as { sent?: boolean } | null)?.sent)))
        .catch(() => setMailed(false));
      setOrder({
        id, number: result[0].order_number, total: result[0].order_total, created_at: new Date().toISOString(),
        customer_name: form.name.trim(), customer_phone: form.phone.trim(), customer_email: form.email.trim() || null,
        notes: form.notes.trim() || null, status: 'nuevo',
        files: files.map((f, i) => ({ id: i, path: f.path, file_name: f.name, size_bytes: f.size, pages: f.pages, copies: f.copies, sides: f.sides, subtotal: subtotalFor(f.pages, f.copies, f.sides, prices) })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal. Probá de nuevo.');
      play('error');
    } finally {
      setSending(false);
      setProgress('');
    }
  }

  function reset() {
    items.forEach((it) => it.thumb && URL.revokeObjectURL(it.thumb));
    setItems([]);
    setForm((f) => ({ ...f, notes: '' }));
    setOrder(null);
    setMailed(null);
    setTab(0);
    setPct(0);
  }

  if (closed && !order) {
    return (
      <div className="paused">
        <Icon3D name="clock" size={160} />
        <h2 className="display-sm">Pedidos online en pausa</h2>
        <p>{settings.maintenance ? 'Estamos haciendo mantenimiento en la web.' : settings.pausedMessage}</p>
        <a className="btn btn--ink" href={whatsappUrl('Hola Pura Tinta! Quería hacer un pedido de impresiones.')} target="_blank" rel="noopener noreferrer">
          <WhatsAppGlyph /> Pedir por WhatsApp · {BUSINESS.whatsappDisplay}
        </a>
      </div>
    );
  }

  return (
    <>
      <form className="order" ref={formRef} onSubmit={submit} noValidate>
        <div className="order__main">
          <div className="tabs" role="tablist" aria-label="Pasos del pedido">
            {TABS.map((t, i) => (
              <button key={t} type="button" role="tab" id={`tab-${i}`} aria-controls={`panel-${i}`} aria-selected={tab === i}
                className={`tabs__tab${tab === i ? ' is-on' : ''}${i < tab ? ' is-done' : ''}`} disabled={!canGo(i)} onClick={() => go(i)} data-sfx="none">
                <span className="tabs__n">{i < tab ? <Check /> : i + 1}</span>{t}
              </button>
            ))}
            <span className="tabs__ink" style={{ ['--i' as string]: tab }} aria-hidden="true" />
          </div>

          {/* 1 · Archivos */}
          <section role="tabpanel" id="panel-0" aria-labelledby="tab-0" hidden={tab !== 0} className="pane">
            <div className={`drop${dragging ? ' is-dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (!dragging) { setDragging(true); play('tick'); } }}
              onDragLeave={() => setDragging(false)} onDrop={onDrop}
              onClick={() => inputRef.current?.click()} role="button" tabIndex={0} data-sfx="click"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}>
              <Icon3D name="upload" size={128} className="drop__icon" eager />
              <span className="drop__title">Arrastrá tus archivos acá</span>
              <span className="drop__sub">o tocá para elegirlos · PDF, Word o imágenes · hasta 50 MB c/u</span>
              <span className="btn btn--ink btn--sm"><Upload /> Elegir archivos</span>
              <input ref={inputRef} type="file" multiple accept={ACCEPT} hidden
                onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ''; }} />
            </div>

            {items.length > 0 && (
              <>
                <div className="files__bar">
                  <span>{items.length} {items.length === 1 ? 'archivo' : 'archivos'}</span>
                  <span className="files__all">Todos en:
                    <button type="button" className="chip" onClick={() => setAllSides('simple')}>Simple faz</button>
                    <button type="button" className="chip" onClick={() => setAllSides('doble')}>Doble faz</button>
                  </span>
                </div>
                <ul className="files">
                  {items.map((it) => {
                    const sh = sheetsFor(it.pages, it.sides) * it.copies;
                    return (
                      <li key={it.key} className="file">
                        <div className="file__thumb">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {it.thumb ? <img src={it.thumb} alt="" /> : <FileIcon />}
                          <span>{it.file.name.split('.').pop()?.toUpperCase()}</span>
                        </div>
                        <div className="file__body">
                          <div className="file__name">
                            <strong title={it.file.name}>{it.file.name}</strong>
                            <small>{prettySize(it.file.size)}</small>
                          </div>
                          <div className="file__opts">
                            <label className="mini">Páginas
                              <input type="number" min={1} max={2000} value={it.pages} required
                                onChange={(e) => update(it.key, { pages: Math.max(1, Math.min(2000, Number(e.target.value) || 1)), pagesGuessed: false })} />
                            </label>
                            <label className="mini">Copias
                              <input type="number" min={1} max={500} value={it.copies} required
                                onChange={(e) => update(it.key, { copies: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })} />
                            </label>
                            <div className="seg seg--sm" role="radiogroup" aria-label={`Tipo de impresión de ${it.file.name}`}>
                              {(['simple', 'doble'] as const).map((s) => (
                                <button key={s} type="button" role="radio" aria-checked={it.sides === s} className={it.sides === s ? 'is-on' : ''}
                                  data-sfx="toggle" onClick={() => update(it.key, { sides: s })}>{s === 'simple' ? 'Simple faz' : 'Doble faz'}</button>
                              ))}
                            </div>
                          </div>
                          {it.pagesGuessed && <p className="file__hint">No pudimos contar las páginas de este archivo: revisá la cantidad.</p>}
                        </div>
                        <div className="file__side">
                          <span className="file__sub">{formatMoney(subtotalFor(it.pages, it.copies, it.sides, prices))}</span>
                          <small>{sh} {sh === 1 ? 'hoja' : 'hojas'}</small>
                          <button type="button" className="icon-btn icon-btn--sm" aria-label={`Quitar ${it.file.name}`}
                            onClick={() => { setItems((prev) => prev.filter((p) => p.key !== it.key)); play('paper'); }} data-sfx="none"><Trash /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <div className="pane__nav">
              <span />
              <button type="button" className="btn btn--ink" onClick={() => go(1)} disabled={!items.length}>Seguir con tus datos <ArrowRight /></button>
            </div>
          </section>

          {/* 2 · Datos */}
          <section role="tabpanel" id="panel-1" aria-labelledby="tab-1" hidden={tab !== 1} className="pane">
            <div className="fields">
              <label className="field">Nombre<input name="name" required minLength={2} maxLength={80} autoComplete="name"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cómo te llamás" /></label>
              <label className="field">WhatsApp<input name="phone" required minLength={6} maxLength={30} inputMode="tel" autoComplete="tel"
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Ej: 2972 123456" /></label>
              <label className="field field--wide"><span>Email <small>(opcional)</small></span><input name="email" type="email" maxLength={120} autoComplete="email"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Para mandarte novedades del pedido" /></label>
              <label className="field field--wide"><span>Indicaciones <small>(opcional)</small></span>
                <textarea name="notes" maxLength={1000} rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ej: abrochado, imprimir solo páginas 3 a 10, lo retiro mañana a la tarde…" />
              </label>
            </div>
            <div className="pane__nav">
              <button type="button" className="btn btn--line" onClick={() => go(0)}><Chevron dir="left" /> Archivos</button>
              <button type="button" className="btn btn--ink" onClick={() => go(2)}>Revisar pedido <ArrowRight /></button>
            </div>
          </section>

          {/* 3 · Confirmar */}
          <section role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden={tab !== 2} className="pane">
            <div className="review">
              <div className="review__row"><span>Nombre</span><b>{form.name || '—'}</b></div>
              <div className="review__row"><span>WhatsApp</span><b>{form.phone || '—'}</b></div>
              {form.email && <div className="review__row"><span>Email</span><b>{form.email}</b></div>}
              {form.notes && <div className="review__row review__row--wide"><span>Indicaciones</span><b>{form.notes}</b></div>}
              <ul className="review__files">
                {items.map((it) => (
                  <li key={it.key}>
                    <span>{it.file.name}</span>
                    <small>{it.copies} {it.copies === 1 ? 'copia' : 'copias'} · {it.sides === 'doble' ? 'doble faz' : 'simple faz'} · {it.pages} pág.</small>
                    <b>{formatMoney(subtotalFor(it.pages, it.copies, it.sides, prices))}</b>
                  </li>
                ))}
              </ul>
              <p className="review__note">Al confirmar subimos tus archivos, se imprime tu ticket con el número de pedido y le avisamos a Pura Tinta.</p>
            </div>
            {sending && (
              <div className="upload-bar" aria-live="polite">
                <span style={{ width: `${pct}%` }} />
                <p>{progress}</p>
              </div>
            )}
            <div className="pane__nav">
              <button type="button" className="btn btn--line" onClick={() => go(1)} disabled={sending}><Chevron dir="left" /> Tus datos</button>
              <button type="submit" className="btn btn--sun btn--lg" disabled={sending} data-sfx="stamp">
                {sending ? 'Enviando…' : <>Confirmar pedido · {formatMoney(total)}</>}
              </button>
            </div>
          </section>

          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <aside className="order__aside" aria-label="Resumen">
          <div className="summary">
            <Icon3D name="ticket" size={96} className="summary__icon" />
            <p className="eyebrow">Total estimado</p>
            <p className="summary__total" key={total}>{formatMoney(total)}</p>
            <p className="summary__sub">{items.length} {items.length === 1 ? 'archivo' : 'archivos'} · {sheets} {sheets === 1 ? 'hoja' : 'hojas'}</p>
            <div className="summary__prices">
              <span>Simple faz <b>{formatMoney(prices.simple)}</b></span>
              <span>Doble faz <b>{formatMoney(prices.doble)}</b></span>
              <small>por hoja · fotocopias B/N</small>
            </div>
            <ol className="summary__steps">
              {TABS.map((t, i) => <li key={t} className={i <= tab ? 'is-on' : ''}>{t}</li>)}
            </ol>
            <p className="summary__help">¿Dudas? <a href={whatsappUrl('Hola Pura Tinta! Tengo una duda con mi pedido.')} target="_blank" rel="noopener noreferrer">Escribinos por WhatsApp</a></p>
          </div>
        </aside>
      </form>

      {order && (
        <Printer3D
          onClose={reset}
          note={mailed === null ? null : (
            <p className="pr-note">{mailed ? '✉️ También le avisamos a Pura Tinta por mail.' : 'Mandá el aviso por WhatsApp así Pura Tinta lo ve al toque.'}</p>
          )}
          actions={
            <>
              <a className="btn btn--wa" href={whatsappUrl(orderMessage(order))} target="_blank" rel="noopener noreferrer" data-sfx="pop">
                <WhatsAppGlyph /> Enviar pedido por WhatsApp
              </a>
              <button type="button" className="btn btn--paper" onClick={() => void downloadTicket(order, settings)}><Download /> Descargar ticket</button>
              <button type="button" className="btn btn--paper" onClick={() => window.print()}><Printer /> Imprimir / PDF</button>
              <button type="button" className="btn btn--ghost-light" onClick={reset}>Hacer otro pedido</button>
              <Link href="/" className="btn btn--ghost-light">Volver al inicio</Link>
            </>
          }
        >
          <Ticket order={order} variant="cliente" settings={settings} className="ticket--print" />
        </Printer3D>
      )}
      {order && <span className="sr-only" aria-live="assertive">Pedido {orderCode(order.number)} confirmado.</span>}
    </>
  );
}
