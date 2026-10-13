'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { formatMoney, STATUS_LABELS, whatsappUrl } from '../config';
import { BUCKET, orderCode, supabase, type Order } from '../supabase';
import Ticket from '../ticket';

const FILTERS = ['activos', 'nuevo', 'en_proceso', 'listo', 'entregado', 'cancelado', 'todos'] as const;

// WhatsApp del cliente: si escribió un número local argentino, lo pasamos a formato wa.me.
const customerWhatsapp = (phone: string, text: string) => {
  let digits = phone.replace(/\D/g, '').replace(/^0/, '');
  if (!digits.startsWith('54')) digits = `549${digits.replace(/^(\d{2,4})15/, '$1')}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};

export default function PanelPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('activos');
  const [selected, setSelected] = useState<string | null>(null);
  const [loginError, setLoginError] = useState('');
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_files(*)')
      .order('created_at', { ascending: false })
      .limit(200);
    setOrders((data as Order[]) ?? []);
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(Boolean(data)));
  }, [session]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    // Pedidos nuevos en vivo.
    const channel = supabase
      .channel('orders-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        setNewCount((n) => n + 1);
        // El pedido se completa (archivos y total) un instante después del INSERT.
        setTimeout(() => void load(), 1500);
        if ('Notification' in window && Notification.permission === 'granted') new Notification('Pura Tinta: ¡pedido nuevo!');
      })
      .subscribe();
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
    const poll = setInterval(() => void load(), 60000);
    return () => { void supabase.removeChannel(channel); clearInterval(poll); };
  }, [isAdmin, load]);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError('');
    const data = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(data.get('email')),
      password: String(data.get('password')),
    });
    if (error) setLoginError('Email o contraseña incorrectos.');
  }

  async function setStatus(order: Order, status: string) {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    await supabase.from('orders').update({ status }).eq('id', order.id);
  }

  async function download(path: string, name: string) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300, { download: name });
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  }

  function printTicket(id: string) {
    setSelected(id);
    requestAnimationFrame(() => window.print());
  }

  if (checking) return <div className="panel"><p>Cargando…</p></div>;

  if (!session) {
    return (
      <div className="panel panel-login">
        <span className="panel-logo"><img src="/logo-pura-tinta.webp" alt="Pura Tinta" width="160" height="160" /></span>
        <h1 className="headline">panel de pedidos</h1>
        <form onSubmit={login} className="fields">
          <label>Email<input name="email" type="email" required autoComplete="username" /></label>
          <label>Contraseña<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="pill-button" type="submit">entrar</button>
          {loginError && <p className="form-error">{loginError}</p>}
        </form>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="panel panel-login">
        <h1 className="headline">sin acceso</h1>
        <p>Esta cuenta todavía no tiene permiso para ver pedidos.</p>
        <button className="pill-button" onClick={() => supabase.auth.signOut()}>salir</button>
      </div>
    );
  }

  const visible = orders.filter((o) =>
    filter === 'todos' ? true : filter === 'activos' ? ['nuevo', 'en_proceso', 'listo'].includes(o.status) : o.status === filter);

  return (
    <div className="panel">
      <header className="panel-header">
        <span className="panel-logo"><img src="/logo-pura-tinta.webp" alt="Pura Tinta" width="80" height="80" /></span>
        <h1 className="headline">pedidos</h1>
        {newCount > 0 && <span className="tag panel-new">{newCount} nuevo{newCount > 1 ? 's' : ''} desde que abriste</span>}
        <button className="pill-button pill-light" onClick={() => supabase.auth.signOut()}>salir</button>
      </header>

      <div className="panel-filters">
        {FILTERS.map((f) => (
          <button key={f} className={`chip${filter === f ? ' is-on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'activos' ? 'Activos' : f === 'todos' ? 'Todos' : STATUS_LABELS[f]}
            {' '}({orders.filter((o) => f === 'todos' || (f === 'activos' ? ['nuevo', 'en_proceso', 'listo'].includes(o.status) : o.status === f)).length})
          </button>
        ))}
      </div>

      {visible.length === 0 && <p className="panel-empty">No hay pedidos acá todavía.</p>}

      <div className="panel-grid">
        {visible.map((o) => (
          <article key={o.id} className={`panel-order status-${o.status}`}>
            <Ticket order={o} variant="negocio" className={selected === o.id ? 'ticket--print' : ''} />
            <div className="panel-actions">
              <label>
                Estado
                <select value={o.status} onChange={(e) => void setStatus(o, e.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              {(o.order_files ?? []).map((f) => (
                <button key={f.id} className="chip" onClick={() => void download(f.path, f.file_name)}>
                  ⬇ {f.file_name}
                </button>
              ))}
              <button className="pill-button" onClick={() => printTicket(o.id)}>imprimir ticket</button>
              <a className="pill-button pill-light" target="_blank" rel="noopener noreferrer"
                href={customerWhatsapp(o.customer_phone,
                  o.status === 'listo'
                    ? `Hola ${o.customer_name}! Tu pedido ${orderCode(o.number)} de Pura Tinta ya está listo para retirar. Total: ${formatMoney(o.total)}.`
                    : `Hola ${o.customer_name}! Te escribimos de Pura Tinta por tu pedido ${orderCode(o.number)}.`)}>
                WhatsApp al cliente
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className="panel-foot">
        Consultas generales: <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">WhatsApp de la tienda</a>
      </p>
    </div>
  );
}
